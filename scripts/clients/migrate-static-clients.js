/**
 * Migration script to insert static clients from data/clients.json into database
 *
 * Geocodes each client's location (state name) and detects coverage areas.
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { geocodeAddress } = require('../../lib/services/geocoder.js');
const clientsData = require('../../data/clients.json');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Convert budget string to numeric value
 */
function convertBudget(budgetString) {
  const budgetMap = {
    'small': 50000,
    'medium': 250000,
    'large': 1000000,
    'very_large': 5000000
  };
  return budgetMap[budgetString] || null;
}

/**
 * Convert DAC string to boolean
 */
function convertDAC(dacString) {
  if (typeof dacString === 'boolean') return dacString;
  if (typeof dacString === 'string') {
    return dacString.toLowerCase() === 'yes';
  }
  return false;
}

/**
 * Migrate a single client to the database
 */
async function migrateClient(staticClient) {
  const result = {
    id: staticClient.id,
    name: staticClient.name,
    success: false,
    error: null
  };

  try {
    console.log(`\n📍 Processing: ${staticClient.name}`);
    console.log(`   Location: ${staticClient.location}`);

    // For state-only locations, look up the state directly instead of geocoding
    let coverageAreaIds = [];
    let lat, lng, city, county, state, stateCode, zipcode;

    if (staticClient.location === 'California') {
      // Look up California state coverage area directly
      const { data: stateArea, error: stateError } = await supabase
        .from('coverage_areas')
        .select('id, state_code')
        .eq('name', 'California')
        .eq('kind', 'state')
        .single();

      if (stateError || !stateArea) {
        result.error = 'California state coverage area not found in database';
        console.log(`   ❌ ${result.error}`);
        return result;
      }

      coverageAreaIds = [stateArea.id];
      stateCode = stateArea.state_code;
      state = 'California';

      // Use state centroid for point location
      lat = 36.7783;
      lng = -119.4179;

      console.log(`   ✅ Using state-level coverage area`);
      console.log(`   📍 State: California (${stateCode})`);

    } else {
      // Step 1: Geocode the location
      const geocodeResult = await geocodeAddress(staticClient.location);

      if (!geocodeResult.success) {
        result.error = `Geocoding failed: ${geocodeResult.error}`;
        console.log(`   ❌ ${result.error}`);
        return result;
      }

      lat = geocodeResult.coordinates.lat;
      lng = geocodeResult.coordinates.lng;
      city = geocodeResult.location.city;
      county = geocodeResult.location.county;
      state = geocodeResult.location.state;
      stateCode = geocodeResult.location.stateCode;
      zipcode = geocodeResult.location.zipcode;

      console.log(`   ✅ Geocoded to: ${lat}, ${lng}`);
      console.log(`   📍 Location: ${city || 'N/A'}, ${county || 'N/A'}, ${state || 'N/A'}`);

      // Step 2: Find coverage areas for this point
      const { data: coverageAreas, error: coverageError } = await supabase
        .rpc('find_coverage_areas_for_point', {
          lng: lng,
          lat: lat
        });

      if (coverageError) {
        result.error = `Coverage area lookup failed: ${coverageError.message}`;
        console.log(`   ❌ ${result.error}`);
        return result;
      }

      coverageAreaIds = coverageAreas?.map(ca => ca.id) || [];
    }

    console.log(`   🗺️  Found ${coverageAreaIds.length} coverage areas`);

    // Step 3: Prepare client data for insertion
    const clientData = {
      name: staticClient.name,
      type: staticClient.type,
      address: staticClient.location === 'California' ? 'California (statewide)' : (geocodeResult?.formattedAddress || staticClient.location),
      location_point: `POINT(${lng} ${lat})`,
      coverage_area_ids: coverageAreaIds,
      state_code: stateCode,
      county_name: county,
      city,
      zipcode,
      project_needs: staticClient.projectNeeds || [],
      budget: convertBudget(staticClient.budget),
      contact: staticClient.contact || null,
      description: staticClient.description || null,
      dac: convertDAC(staticClient.DAC)
    };

    // Step 4: Insert into database
    const { data: client, error: insertError } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (insertError) {
      // Check if it's a duplicate key error
      if (insertError.code === '23505') {
        result.error = 'Client already exists (duplicate name)';
        console.log(`   ⚠️  ${result.error}`);
      } else {
        result.error = `Insert failed: ${insertError.message}`;
        console.log(`   ❌ ${result.error}`);
      }
      return result;
    }

    result.success = true;
    result.clientId = client.id;
    console.log(`   ✅ Inserted into database: ${client.id}`);

  } catch (error) {
    result.error = `Processing error: ${error.message}`;
    console.log(`   ❌ ${result.error}`);
  }

  return result;
}

/**
 * Main migration function
 */
async function migrateStaticClients() {
  console.log('🔄 Starting static clients migration...\n');
  console.log('='.repeat(80));

  const clients = clientsData.clients;

  if (!clients || clients.length === 0) {
    console.log('ℹ️  No clients found in data/clients.json');
    return;
  }

  console.log(`📊 Found ${clients.length} clients to migrate\n`);

  const stats = {
    total: clients.length,
    processed: 0,
    successful: 0,
    failed: 0,
    duplicates: 0,
    errors: []
  };

  // Process each client
  for (const staticClient of clients) {
    const result = await migrateClient(staticClient);

    stats.processed++;

    if (result.success) {
      stats.successful++;
    } else {
      stats.failed++;
      if (result.error && result.error.includes('duplicate')) {
        stats.duplicates++;
      } else {
        stats.errors.push({
          id: result.id,
          name: result.name,
          error: result.error
        });
      }
    }

    // Rate limiting - small delay between geocoding requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Migration Summary\n');
  console.log(`Total Clients: ${stats.total}`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`✅ Successfully Migrated: ${stats.successful}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log(`⚠️  Duplicates Skipped: ${stats.duplicates}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(err => {
      console.log(`   - ${err.name}: ${err.error}`);
    });
  }

  console.log('\n✅ Migration complete!\n');
}

// Run the migration
migrateStaticClients().catch(console.error);
