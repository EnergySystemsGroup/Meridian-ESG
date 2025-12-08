/**
 * Import Gas and Water Utility Territories from CEC and DWR GeoJSON
 *
 * Data Sources:
 * - Gas: CEC Natural Gas Service Areas (EPSG:4326)
 * - Water: DWR i03_WaterDistricts (EPSG:3857)
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Mapping of utility codes to their full names and metadata
const GAS_UTILITIES = {
  'SCG': {
    name: 'Southern California Gas Company (SoCalGas)',
    code: 'SOCALGAS',
    metadata: {
      customers: 22000000,
      website: 'https://www.socalgas.com',
      phone: '(800) 427-2200',
      commercial_rebates: true,
      rebate_url: 'https://www.socalgas.com/for-your-business/rebates',
      description: 'Largest gas distribution utility in the US, serving Central and Southern California'
    }
  },
  'SWGAS': {
    name: 'Southwest Gas Corporation',
    code: 'SWGAS',
    metadata: {
      customers: 200000,
      website: 'https://www.swgas.com',
      phone: '(877) 860-6020',
      commercial_rebates: true,
      rebate_url: 'https://www.swgas.com/en/rebates',
      description: 'Natural gas utility serving high desert communities in San Bernardino and Riverside Counties'
    }
  }
};

const WATER_UTILITIES = {
  'EBMUD': {
    name: 'East Bay Municipal Utility District (EBMUD)',
    code: 'EBMUD',
    metadata: {
      customers: 1400000,
      website: 'https://www.ebmud.com',
      phone: '(866) 403-2683',
      commercial_rebates: true,
      max_commercial_rebate: 15000,
      rebate_url: 'https://www.ebmud.com/water/conservation-and-rebates/commercial',
      description: 'Water and wastewater services for East Bay region including Oakland, Berkeley, Richmond'
    }
  },
  'ACWD': {
    name: 'Alameda County Water District (ACWD)',
    code: 'ACWD',
    metadata: {
      customers: 350000,
      website: 'https://www.acwd.org',
      phone: '(510) 668-4200',
      commercial_rebates: true,
      max_commercial_rebate: 20000,
      rebate_url: 'https://www.acwd.org/145/Rebates',
      description: 'Water service for Fremont, Newark, Union City and southern Hayward'
    }
  },
  'SFPUC': {
    name: 'San Francisco Public Utilities Commission (SFPUC)',
    code: 'SFPUC',
    metadata: {
      customers: 2700000,
      website: 'https://www.sfpuc.gov',
      phone: '(415) 551-4730',
      commercial_rebates: true,
      max_commercial_rebate: 750000,
      rebate_url: 'https://www.sfpuc.gov/accounts-services/sign-up-for-savings/commercial-equipment-rebate',
      description: 'Water, wastewater, and power for SF and wholesale to 26 agencies in Bay Area'
    }
  },
  'SCVWD': {
    name: 'Santa Clara Valley Water District (Valley Water)',
    code: 'SCVWD',
    metadata: {
      customers: 2000000,
      website: 'https://www.valleywater.org',
      phone: '(408) 630-2205',
      commercial_rebates: true,
      max_commercial_rebate: 110000,
      rebate_url: 'https://www.valleywater.org/saving-water/rebates-surveys/commercial-facility-rebates',
      description: 'Countywide water supply and flood protection for Santa Clara County'
    }
  },
  'CCWD': {
    name: 'Contra Costa Water District',
    code: 'CCWD',
    metadata: {
      customers: 520000,
      website: 'https://www.ccwater.com',
      phone: '(925) 688-8000',
      commercial_rebates: true,
      max_commercial_rebate: 20000,
      rebate_url: 'https://www.ccwater.com/157/Rebates-and-Coupons',
      description: 'Water service for central and eastern Contra Costa County'
    }
  },
  'CMWD': {
    name: 'Calleguas Municipal Water District',
    code: 'CMWD',
    metadata: {
      customers: 640000,
      website: 'https://www.calleguas.com',
      phone: '(805) 526-9323',
      commercial_rebates: true,
      rebate_url: 'https://www.calleguas.com/conservation',
      description: 'Wholesale water for SE Ventura County including Thousand Oaks, Simi Valley, Camarillo'
    }
  },
  'CBMWD': {
    name: 'Central Basin Municipal Water District',
    code: 'CBMWD',
    metadata: {
      customers: 2000000,
      website: 'https://www.centralbasin.org',
      phone: '(323) 201-5500',
      commercial_rebates: true,
      rebate_url: 'https://www.centralbasin.org/conservation',
      description: 'Wholesale water for 24 cities in SE LA County including Downey, Norwalk, Lakewood'
    }
  },
  'EMWD': {
    name: 'Eastern Municipal Water District (EMWD)',
    code: 'EMWD',
    metadata: {
      customers: 1000000,
      website: 'https://www.emwd.org',
      phone: '(951) 928-3777',
      commercial_rebates: true,
      rebate_url: 'https://www.emwd.org/rebates-savings',
      description: 'Water and wastewater for western Riverside County including Hemet, Murrieta, Temecula'
    }
  },
  'IEUA': {
    name: 'Inland Empire Utilities Agency (IEUA)',
    code: 'IEUA',
    metadata: {
      customers: 950000,
      website: 'https://www.ieua.org',
      phone: '(909) 993-1600',
      commercial_rebates: true,
      rebate_url: 'https://www.ieua.org/water-use-efficiency/',
      description: 'Wholesale water and wastewater for Chino, Fontana, Ontario, Rancho Cucamonga, Upland'
    }
  },
  'LVMWD': {
    name: 'Las Virgenes Municipal Water District',
    code: 'LVMWD',
    metadata: {
      customers: 70000,
      website: 'https://www.lvmwd.com',
      phone: '(818) 251-2100',
      commercial_rebates: true,
      rebate_url: 'https://www.lvmwd.com/for-customers/rebates-programs',
      description: 'Water and wastewater for Calabasas, Agoura Hills, Hidden Hills, Westlake Village'
    }
  },
  'MWDOC': {
    name: 'Municipal Water District of Orange County (MWDOC)',
    code: 'MWDOC',
    metadata: {
      customers: 3200000,
      website: 'https://www.mwdoc.com',
      phone: '(714) 963-3058',
      commercial_rebates: true,
      rebate_url: 'https://www.mwdoc.com/save-water/',
      description: 'Wholesale water for Orange County (except Anaheim, Fullerton, Santa Ana) via 27 agencies'
    }
  },
  'SDCWA': {
    name: 'San Diego County Water Authority',
    code: 'SDCWA',
    metadata: {
      customers: 3300000,
      website: 'https://www.sdcwa.org',
      phone: '(858) 522-6600',
      commercial_rebates: true,
      rebate_url: 'https://www.sdcwa.org/your-water/conservation/commercial-rebates-programs/',
      description: 'Wholesale water supplier for western San Diego County via 22 member agencies'
    }
  },
  'TVMWD': {
    name: 'Three Valleys Municipal Water District',
    code: 'TVMWD',
    metadata: {
      customers: 500000,
      website: 'https://www.threevalleys.com',
      phone: '(909) 621-5568',
      commercial_rebates: true,
      rebate_url: 'https://www.threevalleys.com/conservation',
      description: 'Wholesale water for Pomona, Claremont, Covina, Glendora, Diamond Bar, West Covina'
    }
  },
  'USGVMWD': {
    name: 'Upper San Gabriel Valley Municipal Water District',
    code: 'USGVMWD',
    metadata: {
      customers: 950000,
      website: 'https://www.upperdistrict.org',
      phone: '(626) 443-2297',
      commercial_rebates: true,
      rebate_url: 'https://www.upperdistrict.org/conservation',
      description: 'Water management and wholesale for 18 cities in Upper San Gabriel Valley'
    }
  },
  'WBMWD': {
    name: 'West Basin Municipal Water District',
    code: 'WBMWD',
    metadata: {
      customers: 1000000,
      website: 'https://www.westbasin.org',
      phone: '(310) 217-2411',
      commercial_rebates: true,
      rebate_url: 'https://www.westbasin.org/water-use-efficiency/programs/commercial-water-use-efficiency',
      description: 'Wholesale water for 17 cities in coastal LA County from Palos Verdes to Malibu'
    }
  },
  'WMWD': {
    name: 'Western Municipal Water District',
    code: 'WMWD',
    metadata: {
      customers: 1000000,
      website: 'https://www.westernwater.com',
      phone: '(951) 571-7100',
      commercial_rebates: true,
      rebate_url: 'https://www.wmwd.com/conservation',
      description: 'Wholesale and retail water for western Riverside County from Corona to Temecula'
    }
  }
};

/**
 * Convert Polygon to MultiPolygon
 */
function normalizeGeometry(geometry) {
  if (!geometry) return null;

  const normalized = { ...geometry };

  // Convert Polygon to MultiPolygon
  if (normalized.type === 'Polygon') {
    normalized.type = 'MultiPolygon';
    normalized.coordinates = [normalized.coordinates];
  }

  return normalized;
}

/**
 * Import gas utilities from CEC GeoJSON
 */
async function importGasUtilities(filepath) {
  console.log('\n=== Importing Gas Utilities ===\n');

  const geojson = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const features = geojson.features;

  console.log(`Found ${features.length} gas utility features`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Group Southwest Gas features (they have 3 separate service areas)
  const swgasFeatures = features.filter(f => f.properties.ABR === 'SWGAS');
  const otherFeatures = features.filter(f => f.properties.ABR !== 'SWGAS');

  // Process SoCalGas
  for (const feature of otherFeatures) {
    const abbr = feature.properties.ABR;
    const config = GAS_UTILITIES[abbr];

    if (!config) {
      console.log(`  Skipping ${feature.properties.SERVICE} (${abbr}) - not in our list`);
      skipped++;
      continue;
    }

    try {
      const normalizedGeometry = normalizeGeometry(feature.geometry);

      const { error } = await supabase.rpc('import_coverage_area_geojson', {
        p_name: config.name,
        p_kind: 'utility',
        p_code: config.code,
        p_state_code: 'CA',
        p_geojson: JSON.stringify(normalizedGeometry),
        p_metadata: {
          utility_type: 'gas',
          precise: true,
          source: 'CEC',
          category: feature.properties.CATEGORY,
          ...config.metadata
        },
        p_source_srid: 4326  // CEC gas data is already in WGS84
      });

      if (error) {
        console.error(`  X Error importing ${config.name}:`, error.message.substring(0, 100));
        errors++;
      } else {
        console.log(`  OK ${config.code}: ${config.name}`);
        imported++;
      }
    } catch (err) {
      console.error(`  X Error processing ${config.name}:`, err.message);
      errors++;
    }
  }

  // Process Southwest Gas - merge all 3 service areas into one MultiPolygon
  if (swgasFeatures.length > 0) {
    const config = GAS_UTILITIES['SWGAS'];
    console.log(`  Merging ${swgasFeatures.length} Southwest Gas service areas...`);

    try {
      // Combine all polygons into one MultiPolygon
      const allPolygons = [];
      for (const feature of swgasFeatures) {
        if (feature.geometry.type === 'MultiPolygon') {
          allPolygons.push(...feature.geometry.coordinates);
        } else if (feature.geometry.type === 'Polygon') {
          allPolygons.push(feature.geometry.coordinates);
        }
      }

      const combinedGeometry = {
        type: 'MultiPolygon',
        coordinates: allPolygons
      };

      const { error } = await supabase.rpc('import_coverage_area_geojson', {
        p_name: config.name,
        p_kind: 'utility',
        p_code: config.code,
        p_state_code: 'CA',
        p_geojson: JSON.stringify(combinedGeometry),
        p_metadata: {
          utility_type: 'gas',
          precise: true,
          source: 'CEC',
          category: 'IOU',
          service_areas: swgasFeatures.length,
          ...config.metadata
        },
        p_source_srid: 4326
      });

      if (error) {
        console.error(`  X Error importing ${config.name}:`, error.message.substring(0, 100));
        errors++;
      } else {
        console.log(`  OK ${config.code}: ${config.name} (${swgasFeatures.length} areas merged)`);
        imported++;
      }
    } catch (err) {
      console.error(`  X Error processing Southwest Gas:`, err.message);
      errors++;
    }
  }

  console.log(`\nGas utilities: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  return { imported, skipped, errors };
}

/**
 * Import water utilities from DWR GeoJSON
 */
async function importWaterUtilities(filepath) {
  console.log('\n=== Importing Water Utilities ===\n');

  const geojson = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const features = geojson.features;

  console.log(`Found ${features.length} water district features`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Group features by CODE (some districts like CCWD have multiple polygons)
  const byCode = {};
  for (const feature of features) {
    const code = feature.properties.CODE;
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push(feature);
  }

  for (const [code, districtFeatures] of Object.entries(byCode)) {
    const config = WATER_UTILITIES[code];

    if (!config) {
      console.log(`  Skipping ${code} - not in our list`);
      skipped++;
      continue;
    }

    try {
      // Combine all polygons for this district into one MultiPolygon
      const allPolygons = [];
      for (const feature of districtFeatures) {
        if (feature.geometry.type === 'MultiPolygon') {
          allPolygons.push(...feature.geometry.coordinates);
        } else if (feature.geometry.type === 'Polygon') {
          allPolygons.push(feature.geometry.coordinates);
        }
      }

      const combinedGeometry = {
        type: 'MultiPolygon',
        coordinates: allPolygons
      };

      const { error } = await supabase.rpc('import_coverage_area_geojson', {
        p_name: config.name,
        p_kind: 'utility',
        p_code: config.code,
        p_state_code: 'CA',
        p_geojson: JSON.stringify(combinedGeometry),
        p_metadata: {
          utility_type: 'water',
          precise: true,
          source: 'DWR',
          ...config.metadata
        },
        p_source_srid: 3857  // DWR data is in Web Mercator
      });

      if (error) {
        console.error(`  X Error importing ${config.name}:`, error.message.substring(0, 100));
        errors++;
      } else {
        const polygonCount = districtFeatures.length > 1 ? ` (${districtFeatures.length} polygons merged)` : '';
        console.log(`  OK ${config.code}: ${config.name}${polygonCount}`);
        imported++;
      }
    } catch (err) {
      console.error(`  X Error processing ${config.name}:`, err.message);
      errors++;
    }
  }

  console.log(`\nWater utilities: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  return { imported, skipped, errors };
}

/**
 * Main import function
 */
async function main() {
  console.log('======================================');
  console.log('  Gas & Water Utility GIS Import');
  console.log('======================================');
  console.log('Target: Local Supabase\n');

  const gasFile = path.join(__dirname, '../../temp/gis-import/cec_natural_gas.geojson');
  const waterFile = path.join(__dirname, '../../temp/gis-import/dwr_water_districts.geojson');

  // Check files exist
  if (!fs.existsSync(gasFile)) {
    console.error(`Gas file not found: ${gasFile}`);
    process.exit(1);
  }
  if (!fs.existsSync(waterFile)) {
    console.error(`Water file not found: ${waterFile}`);
    process.exit(1);
  }

  try {
    const gasResults = await importGasUtilities(gasFile);
    const waterResults = await importWaterUtilities(waterFile);

    console.log('\n======================================');
    console.log('  Import Complete!');
    console.log('======================================');
    console.log(`Gas: ${gasResults.imported} imported`);
    console.log(`Water: ${waterResults.imported} imported`);
    console.log(`Total: ${gasResults.imported + waterResults.imported} utilities\n`);

    console.log('Verification query:');
    console.log(`SELECT name, code, metadata->>'utility_type' as type, metadata->>'precise' as precise, ST_NPoints(geom) as points`);
    console.log(`FROM coverage_areas WHERE kind = 'utility' AND (metadata->>'utility_type' = 'gas' OR metadata->>'utility_type' = 'water') ORDER BY name;`);

  } catch (err) {
    console.error('\nImport failed:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { importGasUtilities, importWaterUtilities };
