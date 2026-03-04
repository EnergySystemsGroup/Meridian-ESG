-- ============================================================================
-- Relocate PostGIS from public schema to extensions schema
-- ============================================================================
-- Problem: PostGIS was installed in public schema (migration 20251105000001).
-- This created spatial_ref_sys in public, owned by supabase_admin.
-- We cannot enable RLS on it (wrong owner), so Supabase linter flags it.
--
-- Solution: Back up geometry data as plain text, drop PostGIS, reinstall in
-- extensions schema, restore data. All within one transaction.
--
-- Affected columns:
--   coverage_areas.geom           — GEOMETRY(MultiPolygon, 4326)
--   clients.location_point        — GEOMETRY(Point, 4326)
--
-- Affected objects (dropped by CASCADE, recreated below):
--   - idx_coverage_areas_geom (GIST index)
--   - idx_clients_location (GIST index)
--   - coverage_areas_summary view (references geom)
--   - find_coverage_areas_for_point()
--   - match_client_to_opportunities()
--   - update_client_coverage_areas()
--   - import_coverage_area()
--   - import_coverage_area_geojson()
--   - get_coverage_areas_geojson()
-- ============================================================================

-- ============================================================================
-- STEP 1: Back up geometry data as plain text
-- ============================================================================

-- Coverage areas: save id + WKT text representation of each polygon
CREATE TEMP TABLE _backup_coverage_areas AS
SELECT id, ST_AsText(geom) AS geom_wkt
FROM coverage_areas
WHERE geom IS NOT NULL;

-- Clients: save id + WKT text representation of each point
CREATE TEMP TABLE _backup_clients AS
SELECT id, ST_AsText(location_point) AS point_wkt
FROM clients
WHERE location_point IS NOT NULL;

-- ============================================================================
-- STEP 2: Drop geometry columns (prevents CASCADE from destroying data)
-- ============================================================================

-- Drop the view that references geom first (it would block column drop)
DROP VIEW IF EXISTS coverage_areas_summary CASCADE;

ALTER TABLE coverage_areas DROP COLUMN IF EXISTS geom;
ALTER TABLE clients DROP COLUMN IF EXISTS location_point;

-- ============================================================================
-- STEP 3: Drop PostGIS from public schema
-- ============================================================================

-- With geometry columns already gone, CASCADE only removes the type system,
-- ST_ functions, and spatial_ref_sys — no data loss.
DROP EXTENSION IF EXISTS postgis CASCADE;

-- ============================================================================
-- STEP 4: Reinstall PostGIS in extensions schema
-- ============================================================================

CREATE EXTENSION postgis SCHEMA extensions;

-- ============================================================================
-- STEP 5: Recreate geometry columns
-- ============================================================================

ALTER TABLE coverage_areas
  ADD COLUMN geom extensions.geometry(MultiPolygon, 4326);

ALTER TABLE clients
  ADD COLUMN location_point extensions.geometry(Point, 4326);

-- ============================================================================
-- STEP 6: Restore data from backup
-- ============================================================================

UPDATE coverage_areas ca
SET geom = extensions.ST_GeomFromText(b.geom_wkt, 4326)
FROM _backup_coverage_areas b
WHERE ca.id = b.id;

UPDATE clients c
SET location_point = extensions.ST_GeomFromText(b.point_wkt, 4326)
FROM _backup_clients b
WHERE c.id = b.id;

-- ============================================================================
-- STEP 7: Recreate spatial indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_coverage_areas_geom
  ON coverage_areas USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_clients_location
  ON clients USING GIST (location_point);

-- ============================================================================
-- STEP 8: Drop temp tables
-- ============================================================================

DROP TABLE _backup_coverage_areas;
DROP TABLE _backup_clients;

-- ============================================================================
-- STEP 9: Recreate dependent view
-- ============================================================================

CREATE VIEW coverage_areas_summary
WITH (security_invoker = true)
AS
SELECT
  kind,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) as with_geometry,
  COUNT(*) FILTER (WHERE geom IS NULL) as without_geometry
FROM coverage_areas
GROUP BY kind
ORDER BY
  CASE kind
    WHEN 'national' THEN 1
    WHEN 'state' THEN 2
    WHEN 'county' THEN 3
    WHEN 'city' THEN 4
    WHEN 'utility' THEN 5
    WHEN 'region' THEN 6
    WHEN 'tribal' THEN 7
    ELSE 8
  END;

GRANT SELECT ON coverage_areas_summary TO authenticated;
COMMENT ON VIEW coverage_areas_summary IS 'Summary of coverage areas by type - security_invoker enabled';

-- ============================================================================
-- STEP 10: Recreate dependent RPC functions
-- ============================================================================

-- Function: find_coverage_areas_for_point
CREATE OR REPLACE FUNCTION find_coverage_areas_for_point(
  lng DOUBLE PRECISION,
  lat DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  kind TEXT,
  state_code CHAR(2),
  code TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.name,
    ca.kind,
    ca.state_code,
    ca.code
  FROM coverage_areas ca
  WHERE ST_Contains(ca.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  ORDER BY
    CASE ca.kind
      WHEN 'national' THEN 1
      WHEN 'state' THEN 2
      WHEN 'region' THEN 3
      WHEN 'county' THEN 4
      WHEN 'city' THEN 5
      WHEN 'utility' THEN 6
      WHEN 'tribal' THEN 7
      ELSE 8
    END;
END;
$$;

-- Function: match_client_to_opportunities
CREATE OR REPLACE FUNCTION match_client_to_opportunities(
  client_id_param UUID
)
RETURNS TABLE (
  opportunity_id UUID,
  opportunity_title TEXT,
  match_level TEXT,
  coverage_name TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    o.id,
    o.title,
    ca.kind,
    ca.name
  FROM funding_opportunities o
  LEFT JOIN opportunity_coverage_areas oca ON o.id = oca.opportunity_id
  LEFT JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
  JOIN clients c ON c.id = client_id_param
  WHERE o.is_national = true
     OR oca.coverage_area_id = ANY(c.coverage_area_ids)
  ORDER BY
    CASE ca.kind
      WHEN 'utility' THEN 1
      WHEN 'city' THEN 2
      WHEN 'county' THEN 3
      WHEN 'region' THEN 4
      WHEN 'state' THEN 5
      WHEN 'national' THEN 6
      ELSE 7
    END,
    o.title;
END;
$$;

-- Function: update_client_coverage_areas
CREATE OR REPLACE FUNCTION update_client_coverage_areas(client_id_param UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  coverage_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(ca.id)
  INTO coverage_ids
  FROM clients c
  JOIN coverage_areas ca ON ST_Contains(ca.geom, c.location_point)
  WHERE c.id = client_id_param;

  UPDATE clients
  SET coverage_area_ids = COALESCE(coverage_ids, ARRAY[]::UUID[])
  WHERE id = client_id_param;

  RETURN coverage_ids;
END;
$$;

-- Function: import_coverage_area
CREATE OR REPLACE FUNCTION import_coverage_area(
  p_name TEXT,
  p_kind TEXT,
  p_state_code TEXT,
  p_code TEXT DEFAULT NULL,
  p_geom extensions.geometry DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO coverage_areas (name, kind, state_code, code, geom)
  VALUES (p_name, p_kind, p_state_code, p_code, p_geom)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Function: import_coverage_area_geojson
CREATE OR REPLACE FUNCTION import_coverage_area_geojson(
  p_geojson JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  imported_count INTEGER := 0;
  feature JSONB;
BEGIN
  FOR feature IN SELECT * FROM jsonb_array_elements(p_geojson->'features')
  LOOP
    INSERT INTO coverage_areas (
      name,
      kind,
      state_code,
      code,
      geom
    ) VALUES (
      feature->'properties'->>'name',
      feature->'properties'->>'kind',
      feature->'properties'->>'state_code',
      feature->'properties'->>'code',
      ST_GeomFromGeoJSON(feature->>'geometry')
    )
    ON CONFLICT DO NOTHING;
    imported_count := imported_count + 1;
  END LOOP;
  RETURN imported_count;
END;
$$;

-- Function: get_coverage_areas_geojson
CREATE OR REPLACE FUNCTION get_coverage_areas_geojson(
  p_state_code TEXT,
  p_kind TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', ca.id,
        'properties', json_build_object(
          'id', ca.id,
          'name', ca.name,
          'code', ca.code,
          'kind', ca.kind,
          'state_code', ca.state_code
        ),
        'geometry', ST_AsGeoJSON(ca.geom)::json
      )
    ), '[]'::json)
  )
  INTO result
  FROM coverage_areas ca
  WHERE ca.state_code = p_state_code
    AND ca.kind = p_kind
    AND ca.geom IS NOT NULL;

  RETURN result;
END;
$$;

-- ============================================================================
-- DONE: PostGIS now lives in extensions schema.
-- spatial_ref_sys is in extensions, hidden from Supabase linter.
-- All geometry data restored, indexes rebuilt, functions recreated.
-- ============================================================================
