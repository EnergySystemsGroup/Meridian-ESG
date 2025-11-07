-- Enable PostGIS and Create Coverage Areas Infrastructure
-- Migration: Location-Based Client Matching System
-- Created: 2025-11-05
-- Description: Adds PostGIS support and creates tables for geographic coverage areas

-- =====================================
-- Enable PostGIS Extension
-- =====================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For fuzzy text matching on coverage area names

-- =====================================
-- Create Coverage Areas Table
-- =====================================

CREATE TABLE IF NOT EXISTS coverage_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  name TEXT NOT NULL,                      -- "PG&E", "Los Angeles County", "California"
  kind TEXT NOT NULL,                      -- "utility", "county", "state", "national", "region"
  code TEXT,                               -- "PGE", "06037" (FIPS), "CA"

  -- Geographic data (WGS84 lat/lng coordinate system)
  geom GEOMETRY(MultiPolygon, 4326),       -- The polygon boundary

  -- Metadata
  state_code CHAR(2),                      -- "CA" (for filtering)
  metadata JSONB DEFAULT '{}'::jsonb,      -- { utility_type: "electric", population: 500000, ... }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (kind IN ('national', 'state', 'county', 'city', 'utility', 'region', 'tribal'))
);

-- =====================================
-- Create Opportunity Coverage Areas Junction Table
-- =====================================

CREATE TABLE IF NOT EXISTS opportunity_coverage_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE NOT NULL,
  coverage_area_id UUID REFERENCES coverage_areas(id) ON DELETE CASCADE NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(opportunity_id, coverage_area_id)
);

-- =====================================
-- Create Clients Table
-- =====================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic info
  name TEXT NOT NULL,
  type TEXT,                               -- "K-12 School Districts", "Municipal Government", etc.

  -- Location
  address TEXT,                            -- "333 S Beaudry Ave, Los Angeles, CA 90017"
  location_point GEOMETRY(Point, 4326),    -- Geocoded lat/lng as geometric point

  -- Cached attributes (for filtering without spatial queries)
  state_code CHAR(2),
  county_name TEXT,
  city TEXT,
  zipcode TEXT,

  -- Cached coverage areas (denormalized for performance)
  coverage_area_ids UUID[],                -- Precomputed list of all containing coverage areas

  -- Project details
  project_needs TEXT[],
  budget TEXT,
  contact TEXT,
  description TEXT,
  dac BOOLEAN DEFAULT false,               -- Disadvantaged Community status

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- Create Unmatched Locations Table (for manual review)
-- =====================================

CREATE TABLE IF NOT EXISTS unmatched_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE,
  location_text TEXT NOT NULL,
  needs_review BOOLEAN DEFAULT true,
  reviewed_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================
-- Create Indexes
-- =====================================

-- Critical: GIST index for fast spatial queries on coverage_areas
CREATE INDEX IF NOT EXISTS idx_coverage_areas_geom ON coverage_areas USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_coverage_areas_kind ON coverage_areas (kind);
CREATE INDEX IF NOT EXISTS idx_coverage_areas_state ON coverage_areas (state_code);
CREATE INDEX IF NOT EXISTS idx_coverage_areas_name_trgm ON coverage_areas USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_coverage_areas_code ON coverage_areas (code);

-- Indexes for opportunity_coverage_areas junction table
CREATE INDEX IF NOT EXISTS idx_opp_coverage_opp ON opportunity_coverage_areas(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_coverage_area ON opportunity_coverage_areas(coverage_area_id);

-- Indexes for clients table
CREATE INDEX IF NOT EXISTS idx_clients_location ON clients USING GIST (location_point);
CREATE INDEX IF NOT EXISTS idx_clients_state ON clients (state_code);
CREATE INDEX IF NOT EXISTS idx_clients_coverage_areas ON clients USING gin (coverage_area_ids);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients (name);

-- Index for unmatched_locations
CREATE INDEX IF NOT EXISTS idx_unmatched_locations_needs_review ON unmatched_locations (needs_review) WHERE needs_review = true;

-- =====================================
-- Create Update Triggers
-- =====================================

-- Trigger for coverage_areas updated_at
CREATE TRIGGER update_coverage_areas_updated_at
  BEFORE UPDATE ON coverage_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for clients updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================
-- Create Database Functions
-- =====================================

-- Function: Find coverage areas containing a specific point
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
) AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- Function: Match clients to opportunities based on coverage areas
CREATE OR REPLACE FUNCTION match_client_to_opportunities(
  client_id_param UUID
)
RETURNS TABLE (
  opportunity_id UUID,
  opportunity_title TEXT,
  match_level TEXT,
  coverage_name TEXT
) AS $$
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
$$ LANGUAGE plpgsql STABLE;

-- Function: Fuzzy search coverage areas by name (for opportunity assignment)
CREATE OR REPLACE FUNCTION find_similar_coverage_areas(
  search_text TEXT,
  threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  kind TEXT,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.name,
    ca.kind,
    similarity(ca.name, search_text) AS sim_score
  FROM coverage_areas ca
  WHERE similarity(ca.name, search_text) > threshold
  ORDER BY sim_score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Update client's cached coverage areas based on location point
CREATE OR REPLACE FUNCTION update_client_coverage_areas(client_id_param UUID)
RETURNS UUID[] AS $$
DECLARE
  coverage_ids UUID[];
BEGIN
  -- Find all coverage areas containing the client's location point
  SELECT ARRAY_AGG(ca.id)
  INTO coverage_ids
  FROM clients c
  JOIN coverage_areas ca ON ST_Contains(ca.geom, c.location_point)
  WHERE c.id = client_id_param;

  -- Update the client record with cached coverage area IDs
  UPDATE clients
  SET coverage_area_ids = COALESCE(coverage_ids, ARRAY[]::UUID[])
  WHERE id = client_id_param;

  RETURN coverage_ids;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- Insert Base Coverage Area (United States)
-- =====================================

-- Insert a placeholder for United States (will be replaced with actual polygon)
INSERT INTO coverage_areas (name, kind, code, state_code)
VALUES ('United States', 'national', 'US', NULL)
ON CONFLICT DO NOTHING;

-- =====================================
-- Create View for Admin UI
-- =====================================

CREATE OR REPLACE VIEW coverage_areas_summary AS
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

-- =====================================
-- Comments for Documentation
-- =====================================

COMMENT ON TABLE coverage_areas IS 'Geographic coverage areas (states, counties, utilities, etc.) stored as PostGIS polygons';
COMMENT ON COLUMN coverage_areas.geom IS 'MultiPolygon geometry in WGS84 (SRID 4326) coordinate system';
COMMENT ON COLUMN coverage_areas.kind IS 'Type of coverage area: national, state, county, city, utility, region, tribal';
COMMENT ON TABLE opportunity_coverage_areas IS 'Junction table linking funding opportunities to their eligible coverage areas';
COMMENT ON TABLE clients IS 'Client organizations with geocoded locations and cached coverage area memberships';
COMMENT ON COLUMN clients.coverage_area_ids IS 'Cached array of coverage_area IDs - updated when location_point changes';
COMMENT ON FUNCTION find_coverage_areas_for_point IS 'Returns all coverage areas containing a given lat/lng point, ordered by specificity';
COMMENT ON FUNCTION match_client_to_opportunities IS 'Returns opportunities matched to a client based on coverage area intersection';
