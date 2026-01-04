-- Fix invalid utility geometries using ST_MakeValid
-- Some CEC geometries have self-intersections or topology issues

UPDATE coverage_areas
SET geom = ST_Multi(ST_MakeValid(geom))::geometry(MultiPolygon, 4326),
    updated_at = NOW()
WHERE kind = 'utility'
  AND state_code = 'CA'
  AND ST_IsValid(geom) = false;

-- Verify all geometries are now valid
SELECT
  COUNT(*) as total_utilities,
  COUNT(*) FILTER (WHERE ST_IsValid(geom) = false) as invalid_geometries,
  COUNT(*) FILTER (WHERE ST_IsValid(geom) = true) as valid_geometries
FROM coverage_areas
WHERE kind = 'utility' AND state_code = 'CA';
