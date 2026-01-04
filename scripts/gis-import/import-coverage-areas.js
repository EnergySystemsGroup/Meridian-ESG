/**
 * Import Geographic Coverage Areas from Shapefiles
 *
 * This script imports US states, counties, and utility territories
 * into the coverage_areas table with PostGIS geometry.
 */

const shapefile = require('shapefile');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Convert GeoJSON geometry to PostGIS WKT format (always MultiPolygon)
 */
function geojsonToWKT(geojson) {
  const type = geojson.type.toUpperCase();

  if (type === 'POLYGON') {
    // Convert single Polygon to MultiPolygon
    const polygon = geojson.coordinates.map(ring => {
      const coords = ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
      return `(${coords})`;
    }).join(', ');
    return `MULTIPOLYGON((${polygon}))`;
  }

  if (type === 'MULTIPOLYGON') {
    const polygons = geojson.coordinates.map(polygon => {
      const rings = polygon.map(ring => {
        const coords = ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
        return `(${coords})`;
      }).join(', ');
      return `(${rings})`;
    }).join(', ');
    return `MULTIPOLYGON(${polygons})`;
  }

  throw new Error(`Unsupported geometry type: ${type}`);
}

/**
 * Import US States from shapefile
 */
async function importStates() {
  console.log('\\n📍 Importing US States...');
  const shapefilePath = '/tmp/gis_data/cb_2023_us_state_500k.shp';

  let imported = 0;
  let errors = 0;

  try {
    const source = await shapefile.open(shapefilePath);
    let result;

    while ((result = await source.read()) && !result.done) {
      const feature = result.value;
      const properties = feature.properties;

      try {
        // Convert geometry to WKT
        const wkt = geojsonToWKT(feature.geometry);

        // Insert into coverage_areas using ST_GeomFromText
        const { error } = await supabase.rpc('import_coverage_area', {
          p_name: properties.NAME,
          p_kind: 'state',
          p_code: properties.STUSPS,  // Two-letter state code
          p_state_code: properties.STUSPS,
          p_wkt: wkt,
          p_metadata: {
            geoid: properties.GEOID,
            state_fips: properties.STATEFP,
            affgeoid: properties.AFFGEOID
          }
        });

        if (error) {
          console.error(`  ❌ Error importing ${properties.NAME}:`, error.message);
          errors++;
        } else {
          imported++;
          if (imported % 10 === 0) {
            console.log(`  ✓ Imported ${imported} states...`);
          }
        }
      } catch (err) {
        console.error(`  ❌ Error processing ${properties.NAME}:`, err.message);
        errors++;
      }
    }

    console.log(`\\n✅ States import complete: ${imported} imported, ${errors} errors`);
  } catch (err) {
    console.error('❌ Failed to import states:', err.message);
    throw err;
  }
}

/**
 * Import US Counties from shapefile
 */
async function importCounties() {
  console.log('\\n📍 Importing US Counties...');
  const shapefilePath = '/tmp/gis_data/cb_2023_us_county_500k.shp';

  let imported = 0;
  let errors = 0;

  try {
    const source = await shapefile.open(shapefilePath);
    let result;

    while ((result = await source.read()) && !result.done) {
      const feature = result.value;
      const properties = feature.properties;

      try {
        // Convert geometry to WKT
        const wkt = geojsonToWKT(feature.geometry);

        // Get state code from STATEFP
        const stateFips = properties.STATEFP;

        // Insert into coverage_areas
        const { error } = await supabase.rpc('import_coverage_area', {
          p_name: `${properties.NAME} County`,
          p_kind: 'county',
          p_code: properties.GEOID,  // Full FIPS code
          p_state_code: properties.STUSPS || null,  // State code if available
          p_wkt: wkt,
          p_metadata: {
            geoid: properties.GEOID,
            county_fips: properties.COUNTYFP,
            state_fips: stateFips,
            affgeoid: properties.AFFGEOID,
            name_raw: properties.NAME
          }
        });

        if (error) {
          console.error(`  ❌ Error importing ${properties.NAME} County:`, error.message);
          errors++;
        } else {
          imported++;
          if (imported % 100 === 0) {
            console.log(`  ✓ Imported ${imported} counties...`);
          }
        }
      } catch (err) {
        console.error(`  ❌ Error processing ${properties.NAME} County:`, err.message);
        errors++;
      }
    }

    console.log(`\\n✅ Counties import complete: ${imported} imported, ${errors} errors`);
  } catch (err) {
    console.error('❌ Failed to import counties:', err.message);
    throw err;
  }
}

/**
 * Create helper function in database for imports
 */
async function createImportFunction() {
  console.log('📦 Creating import helper function...');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
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
        ON CONFLICT (code) DO UPDATE
        SET
          name = EXCLUDED.name,
          geom = EXCLUDED.geom,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING id INTO v_id;

        RETURN v_id;
      END;
      $$ LANGUAGE plpgsql;
    `
  });

  if (error) {
    console.log('  Note: import helper function may already exist or exec_sql not available');
    console.log('  Will try direct import method...');
  } else {
    console.log('  ✓ Import helper function created');
  }
}

/**
 * Import using direct SQL (fallback method)
 */
async function importStatesDirectSQL() {
  console.log('\\n📍 Importing US States (direct SQL method)...');
  const shapefilePath = '/tmp/gis_data/cb_2023_us_state_500k.shp';

  let imported = 0;
  let errors = 0;

  try {
    const source = await shapefile.open(shapefilePath);
    let result;

    while ((result = await source.read()) && !result.done) {
      const feature = result.value;
      const properties = feature.properties;

      try {
        // Convert geometry to GeoJSON string
        const geomGeoJSON = JSON.stringify(feature.geometry);

        // Insert using Supabase query with PostGIS function
        const { error } = await supabase
          .from('coverage_areas')
          .insert({
            name: properties.NAME,
            kind: 'state',
            code: properties.STUSPS,
            state_code: properties.STUSPS,
            // Use raw SQL for geometry
            geom: supabase.raw(`ST_GeomFromGeoJSON('${geomGeoJSON}')`),
            metadata: {
              geoid: properties.GEOID,
              state_fips: properties.STATEFP,
              affgeoid: properties.AFFGEOID
            }
          });

        if (error) {
          console.error(`  ❌ Error importing ${properties.NAME}:`, error.message);
          errors++;
        } else {
          imported++;
          if (imported % 10 === 0) {
            console.log(`  ✓ Imported ${imported} states...`);
          }
        }
      } catch (err) {
        console.error(`  ❌ Error processing ${properties.NAME}:`, err.message);
        errors++;
      }
    }

    console.log(`\\n✅ States import complete: ${imported} imported, ${errors} errors`);
  } catch (err) {
    console.error('❌ Failed to import states:', err.message);
    throw err;
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting Coverage Areas Import\\n');
  console.log('Target: Local Supabase');
  console.log('==================================');

  try {
    // Try to create import helper function
    await createImportFunction();

    // Import states
    await importStates();

    // Import counties
    await importCounties();

    console.log('\\n✅ All imports complete!');
    console.log('\\nRun this query to verify:');
    console.log('SELECT kind, COUNT(*) FROM coverage_areas GROUP BY kind;');

  } catch (err) {
    console.error('\\n❌ Import failed:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { importStates, importCounties };
