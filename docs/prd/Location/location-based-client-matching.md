# Location-Based Client Matching System
**Product Requirements Document**

**Version:** 1.0
**Date:** January 2025
**Status:** Planning
**Owner:** ESG Engineering Team

---

## Executive Summary

Meridian is ESG's Policy & Funding Intelligence Platform that streamlines how we match clients with relevant funding opportunities and monitor critical legislative developments. The platform combines AI-powered data processing with interactive geographic visualization and real-time tracking to dramatically accelerate our funding discovery and qualification process, enabling our team to deliver faster, more accurate results to clients. Built specifically for ESG, Meridian filters and curates intelligence relevant to the types of projects we specialize in, equipping our sales team with targeted insights that drive higher close rates.

This PRD outlines the upgrade from state-only location matching to a comprehensive GIS-based system that enables precise matching across multiple geographic levels: national, state, county, utility territory, and custom regions.

---

## Problem Statement

### Current Limitations

**State-Level Matching Only:**
- Clients are matched based on simple state-level eligibility checks
- Current implementation: `eligible_locations.includes("California")`
- Cannot distinguish between county-specific programs (e.g., "Marin County Resilience Grant")
- Cannot handle utility territory restrictions (e.g., "PG&E customers only")
- Results in false positives and missed opportunities

**Manual Client Location Management:**
- No structured address storage
- Location data is just a text string (e.g., "California")
- No geographic precision beyond state boundaries

**Rigid Eligibility Representation:**
- Opportunities have `is_national` flag or text array `eligible_locations`
- No systematic way to represent complex geographic eligibility
- Difficult to query and filter efficiently

### Business Impact

- **Lower Match Accuracy:** Clients see irrelevant opportunities they can't actually access
- **Missed Revenue:** Sales team misses county/utility-specific funding that clients qualify for
- **Manual Work:** Team must manually verify geographic eligibility for each match
- **Reduced Credibility:** Platform appears less intelligent than competitors with precise location matching

---

## Solution Overview

### Approach: GIS-Based Coverage Areas

Implement a **PostGIS-powered geographic coverage system** that:

1. **Stores all geographic boundaries as polygons** (counties, utility territories, states, etc.)
2. **Geocodes client addresses** to precise latitude/longitude coordinates
3. **Performs spatial queries** to find all coverage areas containing a client's location
4. **Matches opportunities** based on overlapping coverage areas at multiple levels

### Key Benefits

- ✅ **99%+ Match Accuracy:** Precise point-in-polygon geographic matching
- ✅ **Simple Client Input:** Users just enter an address, system handles all geographic detection
- ✅ **Multi-Level Matching:** Single client can match national, state, county, and utility programs simultaneously
- ✅ **Scalable:** Add new coverage types (census tracts, tribal lands, etc.) without schema changes
- ✅ **Fast Queries:** Spatial indexes enable sub-50ms matching queries
- ✅ **Future-Proof:** Supports complex geographic eligibility as funding landscape evolves

---

## Technical Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT ONBOARDING                         │
│  User enters address → Geocode → Find coverage areas         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   COVERAGE AREAS TABLE                       │
│  PostGIS polygons: Counties, Utilities, States, etc.        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              OPPORTUNITY ASSIGNMENT                          │
│  Agent extracts eligibility → Match to coverage areas        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   MATCHING ENGINE                            │
│  WHERE client.coverage_areas ∩ opportunity.coverage_areas   │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **PostGIS:** PostgreSQL extension for spatial data and queries
- **Mapbox Geocoding API:** Convert addresses to lat/lng coordinates
- **QGIS / ogr2ogr:** Tools for importing shapefiles into database
- **Census Bureau:** Source for official county boundary data
- **HIFLD / CEC:** Sources for utility territory shapefiles

---

## Database Schema

### 1. Coverage Areas Table

**Purpose:** Store all geographic boundaries as polygons

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE coverage_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  name TEXT NOT NULL,                      -- "PG&E", "Los Angeles County", "California"
  kind TEXT NOT NULL,                      -- "utility", "county", "state", "national", "region"
  code TEXT,                               -- "PGE", "06037" (FIPS), "CA"

  -- Geographic data
  geom GEOMETRY(MultiPolygon, 4326),       -- The polygon boundary (WGS84 lat/lng)

  -- Metadata
  state_code CHAR(2),                      -- "CA" (for filtering)
  metadata JSONB,                          -- { utility_type: "electric", population: 500000, ... }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Critical: GIST index for fast spatial queries
CREATE INDEX idx_coverage_areas_geom ON coverage_areas USING GIST (geom);
CREATE INDEX idx_coverage_areas_kind ON coverage_areas (kind);
CREATE INDEX idx_coverage_areas_state ON coverage_areas (state_code);
CREATE INDEX idx_coverage_areas_name_trgm ON coverage_areas USING gin (name gin_trgm_ops);
```

**Example Data:**
```
id   | name              | kind     | state | geom
-----|-------------------|----------|-------|---------------------
uuid1| United States     | national | NULL  | [full USA polygon]
uuid2| California        | state    | CA    | [CA polygon]
uuid3| Los Angeles County| county   | CA    | [LA County polygon]
uuid4| PG&E              | utility  | CA    | [PG&E territory polygon]
uuid5| LADWP             | utility  | CA    | [LADWP territory polygon]
```

### 2. Opportunity Coverage Areas (Junction Table)

**Purpose:** Link opportunities to their eligible coverage areas

```sql
CREATE TABLE opportunity_coverage_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE,
  coverage_area_id UUID REFERENCES coverage_areas(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(opportunity_id, coverage_area_id)
);

CREATE INDEX idx_opp_coverage_opp ON opportunity_coverage_areas(opportunity_id);
CREATE INDEX idx_opp_coverage_area ON opportunity_coverage_areas(coverage_area_id);
```

**Example Data:**
```
opportunity_id          | coverage_area_id
------------------------|------------------
national-microgrid-123  | uuid1 (USA)
ca-climate-456          | uuid2 (California)
marin-resilience-789    | uuid3 (Marin County)
pge-incentive-012       | uuid4 (PG&E)
```

### 3. Clients Table

**Purpose:** Store client information including geocoded location

```sql
CREATE TABLE clients (
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

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_location ON clients USING GIST (location_point);
CREATE INDEX idx_clients_state ON clients (state_code);
CREATE INDEX idx_clients_coverage_areas ON clients USING gin (coverage_area_ids);
```

### 4. Database Functions

**Find coverage areas for a point:**
```sql
CREATE OR REPLACE FUNCTION find_coverage_areas_for_point(
  lng DOUBLE PRECISION,
  lat DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  kind TEXT,
  state_code CHAR(2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.name,
    ca.kind,
    ca.state_code
  FROM coverage_areas ca
  WHERE ST_Contains(ca.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  ORDER BY
    CASE ca.kind
      WHEN 'national' THEN 1
      WHEN 'state' THEN 2
      WHEN 'county' THEN 3
      WHEN 'utility' THEN 4
      WHEN 'region' THEN 5
      ELSE 6
    END;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Match clients to opportunities:**
```sql
CREATE OR REPLACE FUNCTION match_client_to_opportunities(
  client_id_param UUID
)
RETURNS TABLE (
  opportunity_id UUID,
  match_level TEXT,
  coverage_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    o.id,
    ca.kind,
    ca.name
  FROM funding_opportunities o
  JOIN opportunity_coverage_areas oca ON o.id = oca.opportunity_id
  JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
  JOIN clients c ON c.id = client_id_param
  WHERE o.is_national = true
     OR oca.coverage_area_id = ANY(c.coverage_area_ids)
  ORDER BY ca.kind, ca.name;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## Data Sources & Import Process

### Data Sources

#### 1. US Counties (Required)
**Source:** US Census Bureau Cartographic Boundary Files
- URL: https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html
- File: `cb_2023_us_county_500k.zip` (simplified boundaries, ~50MB)
- Format: Shapefile (.shp, .dbf, .shx, .prj)
- Coverage: All 3,143 US counties
- Update frequency: Annual

#### 2. US States (Required)
**Source:** US Census Bureau
- URL: Same as counties
- File: `cb_2023_us_state_500k.zip`
- Coverage: All 50 states + DC + territories

#### 3. California Electric Utilities (High Priority)
**Source:** California Energy Commission (CEC)
- URL: https://cecgis-caenergy.opendata.arcgis.com/
- Dataset: "Electric Utility Service Territories"
- Format: Shapefile or GeoJSON
- Utilities: PG&E, SCE, SDG&E, SMUD, LADWP, etc. (~40 utilities)

#### 4. California Water Utilities (Medium Priority)
**Source:** California State Water Resources Control Board
- Manual collection from utility websites (most don't have shapefiles)
- Fallback: Create polygons from ZIP code lists

#### 5. Other States (As Needed)
- Collect utility data as client base expands beyond California

### Import Tools

#### Option A: QGIS (Recommended for first time)
**GUI-based, visual, good for learning**

Steps:
1. Install QGIS: https://qgis.org/
2. Load shapefile: `Layer → Add Vector Layer → Browse to .shp file`
3. Connect to Supabase: `Layer → Add PostgreSQL Layer`
   - Host: db.supabase.co
   - Database: postgres
   - SSL Mode: require
4. Import: `Database → DB Manager → Import Layer`
   - Source: shapefile layer
   - Target schema: public
   - Target table: coverage_areas
   - Geometry column: geom
   - Source SRID: (auto-detect)
   - Target SRID: 4326
   - Map fields appropriately

#### Option B: ogr2ogr (Command line, repeatable)
**Fast, scriptable, good for automation**

```bash
# Install GDAL
brew install gdal  # macOS
apt-get install gdal-bin  # Linux

# Set connection string
export PG_CONN="postgresql://postgres:PASSWORD@db.supabase.co:5432/postgres"

# Import counties
ogr2ogr -f PostgreSQL \
  "$PG_CONN" \
  cb_2023_us_county_500k.shp \
  -nln coverage_areas \
  -nlt MULTIPOLYGON \
  -lco GEOMETRY_NAME=geom \
  -lco OVERWRITE=NO \
  -append \
  -sql "SELECT
    NAME as name,
    'county' as kind,
    GEOID as code,
    STATEFP as state_code,
    geom
  FROM cb_2023_us_county_500k"

# Import utilities (similar process)
ogr2ogr -f PostgreSQL \
  "$PG_CONN" \
  ca_electric_utilities.shp \
  -nln coverage_areas \
  -append \
  ...
```

### Data Quality Checks

After import, verify:

```sql
-- Check counts
SELECT kind, COUNT(*)
FROM coverage_areas
GROUP BY kind;

-- Verify geometries are valid
SELECT id, name, ST_IsValid(geom), ST_IsEmpty(geom)
FROM coverage_areas
WHERE NOT ST_IsValid(geom);

-- Check SRID is correct
SELECT DISTINCT ST_SRID(geom) FROM coverage_areas;
-- Should return: 4326

-- Test sample queries
SELECT name, kind
FROM coverage_areas
WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(-118.2571, 34.0571), 4326));
-- Should return: United States, California, Los Angeles County, LADWP
```

---

## Implementation Phases

### Phase 1: Database Foundation (Week 1)
**Goal:** Set up PostGIS infrastructure and test with sample data

**Tasks:**
1. Enable PostGIS extension in Supabase
2. Create `coverage_areas` table with geometry columns
3. Create `opportunity_coverage_areas` junction table
4. Add spatial indexes (GIST)
5. Import sample data:
   - 1 national coverage (USA)
   - 50 states
   - 10-20 California counties
   - 3-5 major CA utilities (PG&E, SCE, LADWP, SMUD, SDG&E)
6. Create and test database functions
7. Run performance tests on spatial queries

**Success Criteria:**
- Spatial queries return results in <50ms
- Point-in-polygon queries work correctly
- Sample data verifiable in QGIS

### Phase 2: Full Data Import (Week 2)
**Goal:** Populate complete coverage areas dataset

**Tasks:**
1. Download all Census boundary files
2. Import all 3,143 US counties
3. Import all 50 US states
4. Import all ~40 California electric utilities
5. Import California water/gas utilities (if available)
6. Verify data quality and fix geometry issues
7. Create admin UI for browsing coverage areas

**Success Criteria:**
- All counties imported and queryable
- All major CA utilities represented
- No invalid geometries
- Admin can visualize coverage areas on map

### Phase 3: Opportunity Auto-Assignment (Week 3)
**Goal:** Update agent to automatically link opportunities to coverage areas

**Tasks:**
1. Modify storage agent to extract geographic eligibility
2. Build fuzzy-matching function to find coverage areas by name
3. Auto-assign coverage areas on opportunity insert
4. Create fallback for unmatched locations (manual review queue)
5. Update admin UI to manually adjust coverage areas
6. Backfill existing opportunities using migration script
7. Add logging/monitoring for match quality

**Success Criteria:**
- New opportunities auto-assigned coverage areas with 80%+ accuracy
- Manual review queue captures ambiguous cases
- Admin can easily correct mismatches
- All existing opportunities migrated

### Phase 4: Client Geocoding Workflow (Week 4)
**Goal:** Enable client address input with automatic coverage detection

**Tasks:**
1. Update `clients` table schema
2. Build Mapbox geocoding integration
3. Implement coverage area detection on client save
4. Cache coverage area IDs on client record
5. Build client management UI
6. Create client profile page showing matched coverage areas
7. Add address validation and error handling

**Success Criteria:**
- User enters address, system auto-detects all coverage areas
- Coverage areas cached for fast queries
- UI shows "Client is in: CA, Los Angeles County, LADWP territory"
- Address validation prevents bad data

### Phase 5: Updated Matching Engine (Week 5)
**Goal:** Switch matching logic to use coverage areas

**Tasks:**
1. Update matching API to use coverage area queries
2. Implement hierarchical match scoring (national < state < county < utility)
3. Update client matching UI to show match levels
4. Add performance monitoring
5. Parallel run old vs new matching for validation
6. Deprecate old state-only matching
7. Update documentation and API docs

**Success Criteria:**
- Matching queries run in <100ms
- Match accuracy improves measurably
- Sales team reports higher quality matches
- No regressions in existing functionality

---

## Workflows

### Workflow 1: New Opportunity Processing

```
1. Agent fetches opportunity from API
   ↓
2. AI extracts eligibility information
   {
     title: "PG&E Clean Energy Incentive",
     eligibility: "Available to commercial customers in PG&E territory",
     eligible_locations: ["PG&E territory", "Northern California"]
   }
   ↓
3. Agent inserts opportunity into funding_opportunities table
   ↓
4. Agent searches coverage_areas for matching names
   - Search: "PG&E territory" → Finds coverage_area id=uuid4 (PG&E utility)
   - Search: "Northern California" → Finds coverage_area id=uuid2 (California state)
   ↓
5. Agent inserts into opportunity_coverage_areas junction table
   - (opportunity_id, uuid4)
   - (opportunity_id, uuid2)
   ↓
6. Opportunity is now matchable to any client in PG&E territory OR California
```

**Edge Case Handling:**
- **No match found:** Insert into `unmatched_locations` table for manual review
- **Multiple matches:** Add all matches (inclusive approach)
- **Ambiguous match:** Flag for admin review with suggestions

### Workflow 2: Client Onboarding

```
1. User enters client information
   - Name: "Los Angeles Unified School District"
   - Address: "333 S Beaudry Ave, Los Angeles, CA 90017"
   - Project needs: ["HVAC Systems", "Solar Panels"]
   ↓
2. System geocodes address via Mapbox API
   Response: { lat: 34.0571, lng: -118.2571 }
   ↓
3. System queries coverage_areas with point-in-polygon
   SELECT id, name, kind FROM coverage_areas
   WHERE ST_Contains(geom, ST_Point(-118.2571, 34.0571))
   ↓
4. Returns all containing coverage areas:
   - uuid1: United States (national)
   - uuid2: California (state)
   - uuid3: Los Angeles County (county)
   - uuid5: LADWP (utility)
   ↓
5. System stores client with cached coverage_area_ids
   clients.coverage_area_ids = [uuid1, uuid2, uuid3, uuid5]
   ↓
6. UI displays to user:
   "Client location detected:
    - State: California
    - County: Los Angeles County
    - Utility: LADWP
    ✓ Ready to match opportunities"
```

**Validation:**
- Address must geocode successfully (verify with Mapbox)
- At minimum, must match to a state coverage area
- If no utility match, that's OK (not all funding is utility-specific)

### Workflow 3: Client-Opportunity Matching

```
1. User views client profile or runs match query
   ↓
2. System retrieves client's cached coverage_area_ids
   [uuid1, uuid2, uuid3, uuid5]
   ↓
3. System queries opportunities
   SELECT DISTINCT o.*, ca.name as match_level
   FROM funding_opportunities o
   JOIN opportunity_coverage_areas oca ON o.id = oca.opportunity_id
   JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
   WHERE o.is_national = true
      OR oca.coverage_area_id = ANY(ARRAY[uuid1, uuid2, uuid3, uuid5])
   ORDER BY
     CASE ca.kind
       WHEN 'utility' THEN 1    -- Most specific
       WHEN 'county' THEN 2
       WHEN 'state' THEN 3
       WHEN 'national' THEN 4   -- Least specific
     END
   ↓
4. Returns matched opportunities grouped by level:

   UTILITY-LEVEL (1 match):
   - PG&E Clean Energy Incentive (utility: LADWP) ← Most relevant!

   COUNTY-LEVEL (3 matches):
   - LA County Resilience Grant (county: Los Angeles)
   - Metro Green Infrastructure (county: Los Angeles)
   - South Bay Water Project (county: Los Angeles)

   STATE-LEVEL (12 matches):
   - California Climate Investment (state: CA)
   - CARB Zero-Emission Program (state: CA)
   ...

   NATIONAL (45 matches):
   - DOE Microgrid Grants (national)
   - EPA Clean School Bus (national)
   ...
   ↓
5. UI displays hierarchical list with match level badges
6. Sales team prioritizes utility/county matches (highest relevance)
```

---

## Example Scenarios

### Scenario 1: Client in Marin County

**Client:** Marin Community College
- **Address:** 835 College Ave, Kentfield, CA 94904
- **Geocoded:** 37.95°N, 122.56°W

**Coverage Areas Detected:**
1. United States (national)
2. California (state)
3. Marin County (county)
4. PG&E (utility)

**Opportunities Matched:**

| Opportunity | Coverage Level | Match Type |
|-------------|---------------|------------|
| DOE Microgrid Program | National | USA |
| California Climate Investment | State | California |
| Bay Area Clean Air Grants | County | Marin County |
| PG&E Energy Efficiency Rebates | Utility | PG&E |

**Result:** 4 opportunities at different geographic levels, all valid matches

### Scenario 2: Client in SMUD Territory (Sacramento)

**Client:** Elk Grove Unified School District
- **Address:** 9510 Elk Grove-Florin Rd, Elk Grove, CA 95624
- **Geocoded:** 38.41°N, 121.39°W

**Coverage Areas Detected:**
1. United States (national)
2. California (state)
3. Sacramento County (county)
4. SMUD (utility)

**Opportunities Matched:**

| Opportunity | Coverage Level | NOT Matched |
|-------------|---------------|-------------|
| DOE School Grants | National | ✓ Matched |
| CA Clean Energy Fund | State | ✓ Matched |
| Sacramento Metro Projects | County | ✓ Matched |
| SMUD Solar Rebate | Utility | ✓ Matched |
| PG&E Energy Efficiency | Utility | ✗ Not matched (wrong utility) |

**Result:** Correctly excludes PG&E program despite being in California

### Scenario 3: Multi-State Opportunity

**Opportunity:** Western States Solar Consortium
- **Eligibility:** "Available to organizations in California, Nevada, and Oregon"

**Coverage Areas Assigned:**
- California (state)
- Nevada (state)
- Oregon (state)

**Matches:**
- ✓ Client in Los Angeles (has CA coverage area)
- ✓ Client in Las Vegas (has NV coverage area)
- ✓ Client in Portland (has OR coverage area)
- ✗ Client in Phoenix, AZ (no matching coverage area)

---

## Edge Cases & Fallbacks

### Edge Case 1: Address on Utility Boundary

**Problem:** Client address sits exactly on boundary between PG&E and SMUD territories

**Solution:**
- PostGIS `ST_Contains` will match to ALL overlapping polygons
- Client gets BOTH utility coverage areas
- Matches to opportunities from both utilities
- UI can show: "Your location may be served by PG&E or SMUD - verify with your utility provider"

### Edge Case 2: Unincorporated County Area

**Problem:** Address is in unincorporated county area, no city coverage

**Solution:**
- County coverage area is sufficient for matching
- City field remains NULL, that's OK
- Most funding is county-level anyway

### Edge Case 3: Opportunity with Vague Eligibility

**Problem:** Opportunity says "Available in Northern California" but no precise definition

**Solution:**
- Create regional coverage areas for common terms:
  - "Northern California" coverage area (multi-county polygon)
  - "Central Valley" coverage area
  - "Bay Area" coverage area
- Auto-match opportunities to these regional areas
- If truly ambiguous, flag for manual review

### Edge Case 4: Address Cannot Be Geocoded

**Problem:** Mapbox can't geocode address (typo, PO Box, rural address)

**Solution:**
- Show error: "Unable to geocode address. Please verify and try again."
- Allow manual state/county selection as fallback
- Still functional but lower precision
- Flag for review to improve address data

### Edge Case 5: Coverage Area Not Found for Opportunity

**Problem:** Opportunity eligibility mentions "Riverside Transit Authority service area" but we don't have that shapefile

**Solution:**
- Log to `unmatched_locations` table
- Admin reviews and either:
  - Adds coverage area manually (import new shapefile)
  - Maps to existing coverage area (e.g., Riverside County)
  - Flags as "requires manual verification"

### Edge Case 6: Opportunity Eligibility Changes

**Problem:** PG&E expands service territory, opportunity coverage needs update

**Solution:**
- Reimport updated PG&E shapefile
- Coverage area geometry updates automatically
- All clients re-geocode on next login (or batch job)
- Matches update automatically based on new boundaries

---

## Success Metrics

### Accuracy Metrics
- **Match Precision:** >95% of matches should be valid (client actually eligible)
- **Match Recall:** >90% of eligible opportunities should be surfaced
- **Geographic Accuracy:** >99% of addresses correctly geocoded
- **Coverage Completeness:** 100% of CA counties, 90%+ of CA utilities represented

### Performance Metrics
- **Geocoding Time:** <500ms per address (Mapbox API)
- **Coverage Detection Query:** <50ms (point-in-polygon with GIST index)
- **Matching Query:** <100ms for typical client (100-200 opportunities)
- **Page Load Time:** Client profile page loads in <2s

### Business Metrics
- **Sales Efficiency:** Time to identify qualified opportunities reduces by 40%
- **Match Quality Score:** Sales team rates match relevance 4+ stars (out of 5)
- **Close Rate Impact:** Increase in client conversion due to better targeting
- **Reduced False Positives:** 50% reduction in "this doesn't apply to us" feedback

### Operational Metrics
- **Data Freshness:** Coverage areas updated within 30 days of source updates
- **Manual Review Queue:** <5% of opportunities require manual coverage assignment
- **System Uptime:** 99.9% availability for geocoding and matching services
- **Error Rate:** <1% of geocoding operations fail

---

## Future Enhancements

### Phase 2 Enhancements (Post-MVP)
1. **Census Tract / Block Group Support:** Enable matching for equity programs (DACs, EJ communities)
2. **Custom Region Builder:** Allow admins to draw custom eligibility regions
3. **Tribal Lands Coverage:** Add federally recognized tribal territory boundaries
4. **Time-Based Eligibility:** Coverage areas valid only during certain date ranges
5. **Multi-Location Clients:** Support clients with facilities in multiple locations
6. **Predictive Matching:** ML model to suggest likely eligibility before geocoding

### Integration Opportunities
1. **CRM Integration:** Sync client locations with Salesforce/HubSpot
2. **Email Alerts:** Notify clients when new opportunities match their location
3. **Embeddable Map Widget:** Public-facing map showing funding availability by region
4. **API Endpoints:** Allow partners to query eligibility programmatically

---

## Appendix

### A. Glossary

- **PostGIS:** PostgreSQL extension adding support for geographic objects and spatial queries
- **GIST Index:** Generalized Search Tree index, optimized for spatial data queries
- **Shapefile:** Industry-standard format for geographic vector data (points, lines, polygons)
- **WGS84 (SRID 4326):** World Geodetic System 1984, standard coordinate reference system for GPS
- **MultiPolygon:** Geographic data type supporting disconnected regions (e.g., islands)
- **Point-in-Polygon:** Spatial query determining if a coordinate point falls within a polygon boundary
- **Geocoding:** Converting address text to latitude/longitude coordinates
- **Coverage Area:** A defined geographic region with specific boundaries

### B. References

- **PostGIS Documentation:** https://postgis.net/documentation/
- **US Census Bureau:** https://www.census.gov/geographies/mapping-files.html
- **Mapbox Geocoding API:** https://docs.mapbox.com/api/search/geocoding/
- **HIFLD Open Data:** https://hifld-geoplatform.opendata.arcgis.com/
- **California Energy Commission GIS:** https://cecgis-caenergy.opendata.arcgis.com/
- **QGIS User Guide:** https://docs.qgis.org/

### C. Related Documents

- `docs/main/client-matching-algorithm.md` - Current matching implementation
- `docs/main/data-models.md` - Overall data architecture
- `docs/main/api-integration-agent-architecture.md` - Agent processing pipeline
- `docs/prd/roadmap061725.md` - Product roadmap

---

**Document Status:** Ready for Implementation
**Next Steps:** Begin Phase 1 - Database Foundation
**Questions/Feedback:** Contact Engineering Team
