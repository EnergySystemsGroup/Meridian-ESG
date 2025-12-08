-- =============================================================================
-- SEED SCRIPT: Add Gas Utilities and Water Districts to Coverage Areas
-- =============================================================================
-- This is NOT a migration - run manually when needed on staging/production
--
-- Usage:
--   psql $DATABASE_URL -f supabase/seeds/add_gas_and_water_utilities.sql
--
-- These utilities offer commercial rebate programs but were missing from our
-- electric-only dataset sourced from CEC.
-- =============================================================================

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
    metadata = coverage_areas.metadata || EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GAS UTILITIES (2)
-- =====================================================

-- SoCalGas (Southern California Gas Company)
-- Service: 22M people across 12 counties in Central/Southern CA
SELECT create_utility_from_counties(
  'Southern California Gas Company (SoCalGas)',
  'SOCALGAS',
  ARRAY['06037','06059','06065','06071','06111','06029','06083','06025','06079','06019','06031','06107'],
  '{
    "utility_type": "gas",
    "customers": 22000000,
    "website": "https://www.socalgas.com",
    "phone": "(800) 427-2200",
    "commercial_rebates": true,
    "rebate_url": "https://www.socalgas.com/for-your-business/rebates",
    "description": "Largest gas distribution utility in the US, serving Central and Southern California"
  }'::jsonb
);

-- Southwest Gas Corporation (California)
-- Service: ~200K customers in high desert areas of San Bernardino and Riverside Counties
SELECT create_utility_from_counties(
  'Southwest Gas Corporation',
  'SWGAS',
  ARRAY['06071','06065'],
  '{
    "utility_type": "gas",
    "customers": 200000,
    "website": "https://www.swgas.com",
    "phone": "(877) 860-6020",
    "commercial_rebates": true,
    "rebate_url": "https://www.swgas.com/en/rebates",
    "description": "Natural gas utility serving high desert communities in San Bernardino and Riverside Counties"
  }'::jsonb
);

-- =====================================================
-- TIER 1 WATER DISTRICTS - Large with Confirmed Commercial Programs (12)
-- =====================================================

-- EBMUD (East Bay Municipal Utility District)
SELECT create_utility_from_counties(
  'East Bay Municipal Utility District (EBMUD)',
  'EBMUD',
  ARRAY['06001','06013'],
  '{
    "utility_type": "water",
    "customers": 1400000,
    "website": "https://www.ebmud.com",
    "phone": "(866) 403-2683",
    "commercial_rebates": true,
    "max_commercial_rebate": 15000,
    "rebate_url": "https://www.ebmud.com/water/conservation-and-rebates/commercial",
    "description": "Water and wastewater services for East Bay region including Oakland, Berkeley, Richmond"
  }'::jsonb
);

-- SFPUC (San Francisco Public Utilities Commission)
SELECT create_utility_from_counties(
  'San Francisco Public Utilities Commission (SFPUC)',
  'SFPUC',
  ARRAY['06075','06001','06081','06085'],
  '{
    "utility_type": "water",
    "customers": 2700000,
    "website": "https://www.sfpuc.gov",
    "phone": "(415) 551-4730",
    "commercial_rebates": true,
    "max_commercial_rebate": 750000,
    "rebate_url": "https://www.sfpuc.gov/accounts-services/sign-up-for-savings/commercial-equipment-rebate",
    "description": "Water, wastewater, and power for SF and wholesale to 26 agencies in Bay Area"
  }'::jsonb
);

-- Santa Clara Valley Water District (Valley Water)
SELECT create_utility_from_counties(
  'Santa Clara Valley Water District (Valley Water)',
  'SCVWD',
  ARRAY['06085'],
  '{
    "utility_type": "water",
    "customers": 2000000,
    "website": "https://www.valleywater.org",
    "phone": "(408) 630-2205",
    "commercial_rebates": true,
    "max_commercial_rebate": 110000,
    "rebate_url": "https://www.valleywater.org/saving-water/rebates-surveys/commercial-facility-rebates",
    "description": "Countywide water supply and flood protection for Santa Clara County"
  }'::jsonb
);

-- Contra Costa Water District
SELECT create_utility_from_counties(
  'Contra Costa Water District',
  'CCWD',
  ARRAY['06013'],
  '{
    "utility_type": "water",
    "customers": 520000,
    "website": "https://www.ccwater.com",
    "phone": "(925) 688-8000",
    "commercial_rebates": true,
    "max_commercial_rebate": 20000,
    "rebate_url": "https://www.ccwater.com/157/Rebates-and-Coupons",
    "description": "Water service for central and eastern Contra Costa County"
  }'::jsonb
);

-- Alameda County Water District (ACWD)
SELECT create_utility_from_counties(
  'Alameda County Water District (ACWD)',
  'ACWD',
  ARRAY['06001'],
  '{
    "utility_type": "water",
    "customers": 350000,
    "website": "https://www.acwd.org",
    "phone": "(510) 668-4200",
    "commercial_rebates": true,
    "max_commercial_rebate": 20000,
    "rebate_url": "https://www.acwd.org/145/Rebates",
    "description": "Water service for Fremont, Newark, Union City and southern Hayward"
  }'::jsonb
);

-- San Diego County Water Authority
SELECT create_utility_from_counties(
  'San Diego County Water Authority',
  'SDCWA',
  ARRAY['06073'],
  '{
    "utility_type": "water",
    "customers": 3300000,
    "website": "https://www.sdcwa.org",
    "phone": "(858) 522-6600",
    "commercial_rebates": true,
    "rebate_url": "https://www.sdcwa.org/your-water/conservation/commercial-rebates-programs/",
    "description": "Wholesale water supplier for western San Diego County via 22 member agencies"
  }'::jsonb
);

-- West Basin Municipal Water District
SELECT create_utility_from_counties(
  'West Basin Municipal Water District',
  'WBMWD',
  ARRAY['06037'],
  '{
    "utility_type": "water",
    "customers": 1000000,
    "website": "https://www.westbasin.org",
    "phone": "(310) 217-2411",
    "commercial_rebates": true,
    "rebate_url": "https://www.westbasin.org/water-use-efficiency/programs/commercial-water-use-efficiency",
    "description": "Wholesale water for 17 cities in coastal LA County from Palos Verdes to Malibu"
  }'::jsonb
);

-- Municipal Water District of Orange County (MWDOC)
SELECT create_utility_from_counties(
  'Municipal Water District of Orange County (MWDOC)',
  'MWDOC',
  ARRAY['06059'],
  '{
    "utility_type": "water",
    "customers": 3200000,
    "website": "https://www.mwdoc.com",
    "phone": "(714) 963-3058",
    "commercial_rebates": true,
    "rebate_url": "https://www.mwdoc.com/save-water/",
    "description": "Wholesale water for Orange County (except Anaheim, Fullerton, Santa Ana) via 27 agencies"
  }'::jsonb
);

-- Eastern Municipal Water District
SELECT create_utility_from_counties(
  'Eastern Municipal Water District (EMWD)',
  'EMWD',
  ARRAY['06065'],
  '{
    "utility_type": "water",
    "customers": 1000000,
    "website": "https://www.emwd.org",
    "phone": "(951) 928-3777",
    "commercial_rebates": true,
    "rebate_url": "https://www.emwd.org/rebates-savings",
    "description": "Water and wastewater for western Riverside County including Hemet, Murrieta, Temecula"
  }'::jsonb
);

-- Western Municipal Water District of Riverside County
SELECT create_utility_from_counties(
  'Western Municipal Water District',
  'WMWD',
  ARRAY['06065'],
  '{
    "utility_type": "water",
    "customers": 1000000,
    "website": "https://www.westernwater.com",
    "phone": "(951) 571-7100",
    "commercial_rebates": true,
    "rebate_url": "https://www.wmwd.com/conservation",
    "description": "Wholesale and retail water for western Riverside County from Corona to Temecula"
  }'::jsonb
);

-- Inland Empire Utilities Agency
SELECT create_utility_from_counties(
  'Inland Empire Utilities Agency (IEUA)',
  'IEUA',
  ARRAY['06071'],
  '{
    "utility_type": "water",
    "customers": 950000,
    "website": "https://www.ieua.org",
    "phone": "(909) 993-1600",
    "commercial_rebates": true,
    "rebate_url": "https://www.ieua.org/water-use-efficiency/",
    "description": "Wholesale water and wastewater for Chino, Fontana, Ontario, Rancho Cucamonga, Upland"
  }'::jsonb
);

-- =====================================================
-- TIER 2 WATER DISTRICTS - MWD Members (6)
-- =====================================================

-- Central Basin Municipal Water District
SELECT create_utility_from_counties(
  'Central Basin Municipal Water District',
  'CBMWD',
  ARRAY['06037'],
  '{
    "utility_type": "water",
    "customers": 2000000,
    "website": "https://www.centralbasin.org",
    "phone": "(323) 201-5500",
    "commercial_rebates": true,
    "rebate_url": "https://www.centralbasin.org/conservation",
    "description": "Wholesale water for 24 cities in SE LA County including Downey, Norwalk, Lakewood"
  }'::jsonb
);

-- Three Valleys Municipal Water District
SELECT create_utility_from_counties(
  'Three Valleys Municipal Water District',
  'TVMWD',
  ARRAY['06037'],
  '{
    "utility_type": "water",
    "customers": 500000,
    "website": "https://www.threevalleys.com",
    "phone": "(909) 621-5568",
    "commercial_rebates": true,
    "rebate_url": "https://www.threevalleys.com/conservation",
    "description": "Wholesale water for Pomona, Claremont, Covina, Glendora, Diamond Bar, West Covina"
  }'::jsonb
);

-- Upper San Gabriel Valley Municipal Water District
SELECT create_utility_from_counties(
  'Upper San Gabriel Valley Municipal Water District',
  'USGVMWD',
  ARRAY['06037'],
  '{
    "utility_type": "water",
    "customers": 950000,
    "website": "https://www.upperdistrict.org",
    "phone": "(626) 443-2297",
    "commercial_rebates": true,
    "rebate_url": "https://www.upperdistrict.org/conservation",
    "description": "Water management and wholesale for 18 cities in Upper San Gabriel Valley"
  }'::jsonb
);

-- Las Virgenes Municipal Water District
SELECT create_utility_from_counties(
  'Las Virgenes Municipal Water District',
  'LVMWD',
  ARRAY['06037','06111'],
  '{
    "utility_type": "water",
    "customers": 70000,
    "website": "https://www.lvmwd.com",
    "phone": "(818) 251-2100",
    "commercial_rebates": true,
    "rebate_url": "https://www.lvmwd.com/for-customers/rebates-programs",
    "description": "Water and wastewater for Calabasas, Agoura Hills, Hidden Hills, Westlake Village"
  }'::jsonb
);

-- Calleguas Municipal Water District
SELECT create_utility_from_counties(
  'Calleguas Municipal Water District',
  'CMWD',
  ARRAY['06111'],
  '{
    "utility_type": "water",
    "customers": 640000,
    "website": "https://www.calleguas.com",
    "phone": "(805) 526-9323",
    "commercial_rebates": true,
    "rebate_url": "https://www.calleguas.com/conservation",
    "description": "Wholesale water for SE Ventura County including Thousand Oaks, Simi Valley, Camarillo"
  }'::jsonb
);

-- Foothill Municipal Water District
SELECT create_utility_from_counties(
  'Foothill Municipal Water District',
  'FMWD',
  ARRAY['06037'],
  '{
    "utility_type": "water",
    "customers": 80000,
    "website": "https://www.fmwd.com",
    "phone": "(818) 790-4036",
    "commercial_rebates": true,
    "rebate_url": "https://www.fmwd.com/conservation",
    "description": "Wholesale water for La Canada Flintridge, Altadena, La Crescenta"
  }'::jsonb
);

-- Clean up helper function
DROP FUNCTION IF EXISTS create_utility_from_counties;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT
  metadata->>'utility_type' as utility_type,
  COUNT(*) as count
FROM coverage_areas
WHERE kind = 'utility'
  AND (metadata->>'utility_type' = 'gas' OR metadata->>'utility_type' = 'water')
GROUP BY metadata->>'utility_type'
ORDER BY utility_type;
