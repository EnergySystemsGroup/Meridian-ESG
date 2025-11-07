# GIS Data Import Scripts

Scripts for importing geographic boundary data into the PostGIS-enabled `coverage_areas` table.

## Overview

These scripts import real geographic boundaries from authoritative sources to enable precise location-based matching of clients to funding opportunities.

## Scripts

### import-coverage-areas.js

Imports US states and counties from Census Bureau shapefiles.

**Data Sources:**
- **US States:** [Census Bureau TIGER/Line 2023](https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip)
- **US Counties:** [Census Bureau TIGER/Line 2023](https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip)

**What it imports:**
- 56 US states and territories
- 3,235 US counties

**Usage:**
```bash
# Download shapefiles to /tmp/gis_data/
mkdir -p /tmp/gis_data
cd /tmp/gis_data
curl -O https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip
curl -O https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip
unzip cb_2023_us_state_500k.zip
unzip cb_2023_us_county_500k.zip

# Run import
cd /path/to/project
node scripts/gis-import/import-coverage-areas.js
```

**Dependencies:**
- `shapefile` npm package (for reading .shp files)
- `@supabase/supabase-js`
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### import-cec-utilities.js

Imports California electric utility territories from California Energy Commission GeoJSON data.

**Data Sources:**
- **IOU/POU Utilities:** [CEC Electric Load Serving Entities](https://cecgis-caenergy.opendata.arcgis.com/datasets/CAEnergy::electric-load-serving-entities-iou-pou.geojson)
- **Municipal/Other:** [CEC Electric Other Utilities](https://cecgis-caenergy.opendata.arcgis.com/datasets/CAEnergy::electric-load-serving-entities-other.geojson)

**What it imports:**
- 85 California electric utility territories
- Includes major utilities (PG&E, SCE, SDG&E, SMUD, LADWP) plus municipal and co-op utilities

**Usage:**
```bash
# Download GeoJSON files
mkdir -p /tmp/gis_data
cd /tmp/gis_data
curl -L -o cec_iou_pou.geojson "https://cecgis-caenergy.opendata.arcgis.com/datasets/CAEnergy::electric-load-serving-entities-iou-pou.geojson"
curl -L -o cec_other.geojson "https://cecgis-caenergy.opendata.arcgis.com/datasets/CAEnergy::electric-load-serving-entities-other.geojson"

# Run import
cd /path/to/project
node scripts/gis-import/import-cec-utilities.js
```

**Features:**
- Handles coordinate transformation (EPSG:3857 → EPSG:4326)
- Strips Z-coordinates (elevation data)
- Converts Polygon → MultiPolygon automatically

**Dependencies:**
- `@supabase/supabase-js`
- `dotenv` (loads from `.env.local`)

### fix-invalid-utilities.sql

Fixes topology issues in utility geometries using PostGIS ST_MakeValid function.

**Purpose:**
Some imported geometries may have self-intersections, nested shells, or other topology issues. This script automatically repairs them.

**Usage:**
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f scripts/gis-import/fix-invalid-utilities.sql
```

**What it does:**
- Identifies invalid geometries in CA utility territories
- Applies ST_MakeValid() to repair topology
- Verifies all geometries are valid after fix

### run-sql-file.js

Helper script to execute SQL files via Supabase client (useful when direct psql access is not available).

**Usage:**
```bash
node scripts/gis-import/run-sql-file.js path/to/file.sql
```

**Note:** This splits SQL by semicolons, so complex scripts with procedures/functions may need direct psql instead.

## Database Setup

Before running these scripts, ensure PostGIS is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

This is done automatically by the migration `20251105000001_enable_postgis_coverage_areas.sql`.

## Verification

After importing, verify the data:

```sql
-- Count by type
SELECT kind, COUNT(*) as count
FROM coverage_areas
GROUP BY kind
ORDER BY kind;

-- Test point-in-polygon query (LA City Hall)
SELECT name, kind, code
FROM coverage_areas
WHERE ST_Contains(geom, ST_SetSRID(ST_Point(-118.2427, 34.0537), 4326))
ORDER BY kind;
```

Expected results:
- 1 national
- 56 states
- 3,235 counties
- 85 utilities (California only)

## Performance

Spatial queries using the GIST index typically execute in <2ms:

```sql
EXPLAIN ANALYZE
SELECT name FROM coverage_areas
WHERE ST_Contains(geom, ST_SetSRID(ST_Point(-118.2427, 34.0537), 4326));
```

## Related Documentation

- **PRD:** `docs/prd/Location/location-based-client-matching.md`
- **Phase 1 Summary:** `docs/prd/Location/location-based-matching-phase1-complete.md`
- **Migrations:** `supabase/migrations/202511050000*_*.sql`

## Data Updates

These datasets should be refreshed periodically:

- **Census boundaries:** Updated every 10 years (major), annually (minor adjustments)
- **Utility territories:** Check CEC website for updates (utilities occasionally merge or change boundaries)

To re-import, simply run the import scripts again. The functions use `ON CONFLICT DO UPDATE` for idempotent imports.
