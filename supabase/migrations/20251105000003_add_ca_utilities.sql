-- Add Major California Utility Territories
-- These are approximate boundaries based on primary service areas

-- Helper function to create utility territory from county union
CREATE OR REPLACE FUNCTION create_utility_from_counties(
  p_utility_name TEXT,
  p_utility_code TEXT,
  p_county_codes TEXT[],
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_geom GEOMETRY;
BEGIN
  -- Union all county geometries and cast to MultiPolygon
  SELECT ST_Multi(ST_Union(geom))::geometry(MultiPolygon, 4326) INTO v_geom
  FROM coverage_areas
  WHERE kind = 'county'
    AND code = ANY(p_county_codes);

  -- Insert utility coverage area
  INSERT INTO coverage_areas (name, kind, code, state_code, geom, metadata)
  VALUES (
    p_utility_name,
    'utility',
    p_utility_code,
    'CA',
    v_geom,
    p_metadata || jsonb_build_object('approximate', true, 'based_on_counties', p_county_codes)
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

-- PG&E (Pacific Gas & Electric) - Northern & Central California
SELECT create_utility_from_counties(
  'Pacific Gas & Electric (PG&E)',
  'PGE',
  ARRAY['06001','06007','06013','06017','06019','06021','06023','06029','06033',
        '06035','06039','06041','06043','06045','06047','06049','06051','06053',
        '06055','06057','06061','06063','06065','06067','06069','06071','06073',
        '06075','06077','06079','06081','06083','06085','06087','06089','06091',
        '06093','06095','06097','06099','06101','06103','06105','06107','06109',
        '06113','06115'],
  '{"utility_type": "electric", "customers": 5500000}'::jsonb
);

-- SCE (Southern California Edison)
SELECT create_utility_from_counties(
  'Southern California Edison (SCE)',
  'SCE',
  ARRAY['06029','06037','06059','06065','06071','06111','06025','06083'],
  '{"utility_type": "electric", "customers": 5000000}'::jsonb
);

-- SDG&E (San Diego Gas & Electric)
SELECT create_utility_from_counties(
  'San Diego Gas & Electric (SDG&E)',
  'SDGE',
  ARRAY['06073','06025'],
  '{"utility_type": "electric_and_gas", "customers": 3600000}'::jsonb
);

-- SMUD (Sacramento Municipal Utility District)
SELECT create_utility_from_counties(
  'Sacramento Municipal Utility District (SMUD)',
  'SMUD',
  ARRAY['06067'],
  '{"utility_type": "electric", "customers": 650000, "municipal": true}'::jsonb
);

-- LADWP (Los Angeles Department of Water & Power)
SELECT create_utility_from_counties(
  'Los Angeles Department of Water & Power (LADWP)',
  'LADWP',
  ARRAY['06037'],
  '{"utility_type": "electric_and_water", "customers": 4000000, "municipal": true}'::jsonb
);

-- EBMUD (East Bay Municipal Utility District)
SELECT create_utility_from_counties(
  'East Bay Municipal Utility District (EBMUD)',
  'EBMUD',
  ARRAY['06001','06013'],
  '{"utility_type": "water", "customers": 1400000, "municipal": true}'::jsonb
);

-- Clean up helper function
DROP FUNCTION IF EXISTS create_utility_from_counties;
