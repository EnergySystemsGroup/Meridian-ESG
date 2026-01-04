-- Add unique constraint and import helper function
-- Migration: Helper functions for coverage area imports

-- Add unique constraint on code (for upsert operations)
ALTER TABLE coverage_areas
  DROP CONSTRAINT IF EXISTS coverage_areas_code_kind_key;

ALTER TABLE coverage_areas
  ADD CONSTRAINT coverage_areas_code_kind_key UNIQUE (code, kind);

-- Helper function to import coverage area from WKT
CREATE OR REPLACE FUNCTION import_coverage_area(
  p_name TEXT,
  p_kind TEXT,
  p_code TEXT,
  p_state_code CHAR(2),
  p_wkt TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO coverage_areas (name, kind, code, state_code, geom, metadata)
  VALUES (
    p_name,
    p_kind,
    p_code,
    p_state_code,
    ST_GeomFromText(p_wkt, 4326),
    p_metadata
  )
  ON CONFLICT (code, kind) DO UPDATE
  SET
    name = EXCLUDED.name,
    geom = EXCLUDED.geom,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to import from GeoJSON
CREATE OR REPLACE FUNCTION import_coverage_area_geojson(
  p_name TEXT,
  p_kind TEXT,
  p_code TEXT,
  p_state_code CHAR(2),
  p_geojson TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_source_srid INTEGER DEFAULT 4326
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_geom GEOMETRY;
BEGIN
  -- Parse GeoJSON
  v_geom := ST_GeomFromGeoJSON(p_geojson);

  -- Set source SRID and transform to WGS84 if needed
  v_geom := ST_SetSRID(v_geom, p_source_srid);
  IF p_source_srid != 4326 THEN
    v_geom := ST_Transform(v_geom, 4326);
  END IF;

  -- Cast to MultiPolygon
  v_geom := v_geom::geometry(MultiPolygon, 4326);

  INSERT INTO coverage_areas (name, kind, code, state_code, geom, metadata)
  VALUES (
    p_name,
    p_kind,
    p_code,
    p_state_code,
    v_geom,
    p_metadata
  )
  ON CONFLICT (code, kind) DO UPDATE
  SET
    name = EXCLUDED.name,
    geom = EXCLUDED.geom,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
