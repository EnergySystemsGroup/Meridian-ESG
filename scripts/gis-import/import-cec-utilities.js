/**
 * Import Real California Utility Territories from CEC GeoJSON
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Convert Polygon to MultiPolygon and strip Z coordinates
 */
function normalizeGeometry(geometry) {
  if (!geometry) return null;

  const processCoordinates = (coords) => {
    if (Array.isArray(coords[0])) {
      // Recursively process nested arrays
      return coords.map(processCoordinates);
    } else {
      // This is a coordinate pair/triple - return only [lng, lat]
      return [coords[0], coords[1]];
    }
  };

  // Clone geometry to avoid modifying original
  const normalized = { ...geometry };

  // Strip Z coordinates
  normalized.coordinates = processCoordinates(geometry.coordinates);

  // Convert Polygon to MultiPolygon
  if (normalized.type === 'Polygon') {
    normalized.type = 'MultiPolygon';
    normalized.coordinates = [normalized.coordinates];
  }

  return normalized;
}

/**
 * Import utilities from CEC GeoJSON file
 */
async function importCECUtilities(filepath, utilityType) {
  console.log(`\n📍 Importing ${utilityType} utilities from ${filepath}...`);

  const geojson = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const features = geojson.features;

  console.log(`Found ${features.length} utilities`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const feature of features) {
    const props = feature.properties;
    const utilityName = props.Utility;
    const acronym = props.Acronym?.trim() || props.Utility.substring(0, 10).toUpperCase().replace(/\s+/g, '');

    // Skip if no geometry
    if (!feature.geometry) {
      console.log(`  ⏭️  Skipping ${utilityName} - no geometry`);
      skipped++;
      continue;
    }

    try {
      // Normalize geometry (strip Z coords, convert Polygon to MultiPolygon)
      const normalizedGeometry = normalizeGeometry(feature.geometry);

      // Insert using GeoJSON import function
      // CEC data is in EPSG:3857 (Web Mercator), transform to EPSG:4326 (WGS84)
      const { error } = await supabase.rpc('import_coverage_area_geojson', {
        p_name: utilityName,
        p_kind: 'utility',
        p_code: acronym,
        p_state_code: 'CA',
        p_geojson: JSON.stringify(normalizedGeometry),
        p_metadata: {
          utility_type: 'electric',
          ownership: props.Type,
          agency_num: props.AgencyNum,
          phone: props.Phone,
          url: props.URL,
          address: props.Address,
          hifld_id: props.HIFLD_ID,
          source: 'CEC',
          precise: true
        },
        p_source_srid: 3857
      });

      if (error) {
        console.error(`  ❌ Error importing ${utilityName}:`, error.message.substring(0,100));
        errors++;
      } else {
        imported++;
        if (imported % 10 === 0) {
          console.log(`  ✓ Imported ${imported} utilities...`);
        }
      }
    } catch (err) {
      console.error(`  ❌ Error processing ${utilityName}:`, err.message.substring(0,100));
      errors++;
    }
  }

  console.log(`\n✅ ${utilityType} import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  return { imported, skipped, errors };
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting CEC Utility Import\n');
  console.log('Target: Local Supabase');
  console.log('==================================');

  try {
    // Import IOU/POU (investor-owned and publicly-owned utilities)
    const iouResults = await importCECUtilities(
      '/tmp/gis_data/cec_iou_pou.geojson',
      'IOU/POU'
    );

    // Import Other (municipal and smaller utilities)
    const otherResults = await importCECUtilities(
      '/tmp/gis_data/cec_other.geojson',
      'Municipal/Other'
    );

    console.log('\n✅ All imports complete!');
    console.log(`\nTotal utilities imported: ${iouResults.imported + otherResults.imported}`);
    console.log('\nRun this query to verify:');
    console.log('SELECT name, code, metadata FROM coverage_areas WHERE kind = \'utility\' ORDER BY name LIMIT 10;');

  } catch (err) {
    console.error('\n❌ Import failed:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { importCECUtilities };
