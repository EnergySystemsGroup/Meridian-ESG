/**
 * Test script for fuzzy location matcher
 *
 * Tests various location strings against the coverage_areas database
 */

require('dotenv').config({ path: '.env.local' });

const { fuzzyMatchLocation, matchOpportunityLocations } = require('../../lib/services/locationMatcher.js');

const testCases = [
  // National
  'National',
  'Nationwide',

  // States
  'California',
  'CA', // Should it match?

  // Counties
  'Los Angeles County',
  'Sacramento County',
  'San Diego County',

  // Utilities (exact names)
  'Pacific Gas & Electric Company',
  'Sacramento Municipal Utility District',
  'San Diego Gas & Electric',

  // Utilities (common variations)
  'PG&E',
  'PG&E service territory',
  'SMUD territory',
  'SDG&E',
  'Southern California Edison',
  'SCE service area',
  'LADWP',
  'Los Angeles Department of Water & Power',

  // Edge cases
  'San Francisco', // City (no city data imported yet)
  'Bay Area', // Region (no region data)
  'PGE', // Typo/variation
];

async function runTests() {
  console.log('🧪 Testing Fuzzy Location Matcher\n');
  console.log('='.repeat(80));

  for (const testCase of testCases) {
    console.log(`\n📍 Testing: "${testCase}"`);

    const result = await fuzzyMatchLocation(testCase);

    if (result.success) {
      console.log(`  ✅ Match found!`);
      console.log(`     Name: ${result.name}`);
      console.log(`     Kind: ${result.kind}`);
      console.log(`     Code: ${result.code || 'N/A'}`);
      console.log(`     Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`     Match Type: ${result.match_type}`);
    } else if (result.skipped) {
      console.log(`  ⏭️  Skipped`);
      console.log(`     Reason: ${result.reason}`);
    } else {
      console.log(`  ❌ No match`);
      console.log(`     Reason: ${result.error || result.reason}`);
      console.log(`     Detected Type: ${result.detected_type || 'unknown'}`);
      if (result.suggestions && result.suggestions.length > 0) {
        console.log(`     Suggestions: ${result.suggestions.join(', ')}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Testing Batch Matching\n');

  const batchTest = [
    'California',
    'PG&E service territory',
    'Los Angeles County',
    'SMUD',
    'National'
  ];

  console.log(`Testing batch: ${batchTest.join(', ')}\n`);

  const batchResult = await matchOpportunityLocations(batchTest);

  console.log(`Total locations: ${batchResult.total}`);
  console.log(`✅ Matched: ${batchResult.matched}`);
  console.log(`❌ Unmatched: ${batchResult.unmatched}`);
  console.log(`⚠️  Low confidence: ${batchResult.low_confidence}`);

  if (batchResult.matches.length > 0) {
    console.log('\nMatched locations:');
    batchResult.matches.forEach(m => {
      console.log(`  - "${m.original_text}" → ${m.name} (${(m.confidence * 100).toFixed(1)}%)`);
    });
  }

  if (batchResult.unmatched_locations.length > 0) {
    console.log('\nUnmatched locations:');
    batchResult.unmatched_locations.forEach(u => {
      console.log(`  - "${u.text}": ${u.reason}`);
    });
  }

  console.log('\n✅ Tests complete!\n');
}

runTests().catch(console.error);
