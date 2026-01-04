/**
 * Backfill script for opportunity_coverage_areas junction table
 *
 * Processes all existing funding opportunities and matches their eligible_locations
 * to coverage_area IDs using the fuzzy location matcher.
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { fuzzyMatchLocation } = require('../../lib/services/locationMatcher.js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Process a single opportunity and link to coverage areas
 */
async function processOpportunity(opportunity) {
  const result = {
    id: opportunity.id,
    title: opportunity.title,
    success: false,
    linked: [],
    unmatched: [],
    low_confidence: [],
    errors: []
  };

  try {
    // Handle eligible_locations array (includes national if extracted by LLM)
    if (opportunity.eligible_locations && Array.isArray(opportunity.eligible_locations)) {
      for (const locationText of opportunity.eligible_locations) {
        if (!locationText || typeof locationText !== 'string') {
          result.errors.push(`Invalid location text: ${locationText}`);
          continue;
        }

        const match = await fuzzyMatchLocation(locationText);

        if (match.success) {
          if (match.confidence >= 0.7) {
            // High confidence - insert into junction table
            const { error } = await supabase
              .from('opportunity_coverage_areas')
              .insert({
                opportunity_id: opportunity.id,
                coverage_area_id: match.coverage_area_id
              });

            if (error) {
              // Handle duplicate key constraint (already linked)
              if (error.code === '23505') {
                // Silently skip duplicates
                continue;
              }
              result.errors.push(`Failed to link ${locationText}: ${error.message}`);
            } else {
              result.linked.push({
                original: locationText,
                matched: match.name,
                confidence: match.confidence,
                match_type: match.match_type
              });
            }
          } else {
            // Low confidence - flag for manual review
            result.low_confidence.push({
              original: locationText,
              matched: match.name,
              confidence: match.confidence
            });
          }
        } else {
          // No match found
          result.unmatched.push({
            original: locationText,
            reason: match.error,
            detected_type: match.detected_type
          });
        }
      }
    }

    result.success = result.errors.length === 0;

  } catch (error) {
    result.errors.push(`Processing error: ${error.message}`);
  }

  return result;
}

/**
 * Main backfill function
 */
async function backfillOpportunityCoverageAreas() {
  console.log('🔄 Starting opportunity_coverage_areas backfill...\n');

  // Fetch all opportunities
  const { data: opportunities, error: fetchError } = await supabase
    .from('funding_opportunities')
    .select('id, title, is_national, eligible_locations')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Failed to fetch opportunities:', fetchError);
    return;
  }

  if (!opportunities || opportunities.length === 0) {
    console.log('ℹ️  No opportunities found to process.');
    return;
  }

  console.log(`📊 Found ${opportunities.length} opportunities to process\n`);
  console.log('='.repeat(80));

  // Stats tracking
  const stats = {
    total: opportunities.length,
    processed: 0,
    successful: 0,
    with_errors: 0,
    total_linked: 0,
    total_unmatched: 0,
    total_low_confidence: 0,
    data_quality_issues: []
  };

  // Process each opportunity
  for (const opportunity of opportunities) {
    console.log(`\n📍 Processing: ${opportunity.title}`);
    console.log(`   ID: ${opportunity.id}`);
    console.log(`   Is National: ${opportunity.is_national}`);
    console.log(`   Locations: ${JSON.stringify(opportunity.eligible_locations)}`);

    // Check for data quality issues
    if (opportunity.is_national === null) {
      stats.data_quality_issues.push({
        id: opportunity.id,
        issue: 'is_national is NULL'
      });
      console.log('   ⚠️  Warning: is_national is NULL');
    }

    if (!opportunity.eligible_locations || opportunity.eligible_locations.length === 0) {
      if (opportunity.is_national !== true) {
        stats.data_quality_issues.push({
          id: opportunity.id,
          issue: 'No eligible_locations and not national'
        });
        console.log('   ⚠️  Warning: No eligible_locations and not marked as national');
      }
    }

    const result = await processOpportunity(opportunity);

    stats.processed++;
    if (result.success) {
      stats.successful++;
    } else {
      stats.with_errors++;
    }

    stats.total_linked += result.linked.length;
    stats.total_unmatched += result.unmatched.length;
    stats.total_low_confidence += result.low_confidence.length;

    // Log results
    if (result.linked.length > 0) {
      console.log(`   ✅ Linked ${result.linked.length} coverage areas:`);
      result.linked.forEach(l => {
        console.log(`      - "${l.original}" → ${l.matched} (${(l.confidence * 100).toFixed(1)}%)`);
      });
    }

    if (result.unmatched.length > 0) {
      console.log(`   ❌ Unmatched ${result.unmatched.length} locations:`);
      result.unmatched.forEach(u => {
        console.log(`      - "${u.original}": ${u.reason}`);
      });
    }

    if (result.low_confidence.length > 0) {
      console.log(`   ⚠️  Low confidence ${result.low_confidence.length} matches:`);
      result.low_confidence.forEach(l => {
        console.log(`      - "${l.original}" → ${l.matched} (${(l.confidence * 100).toFixed(1)}%)`);
      });
    }

    if (result.errors.length > 0) {
      console.log(`   ❌ Errors:`);
      result.errors.forEach(e => console.log(`      - ${e}`));
    }

    // Rate limiting - small delay between opportunities
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Backfill Summary\n');
  console.log(`Total Opportunities: ${stats.total}`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Successful: ${stats.successful}`);
  console.log(`With Errors: ${stats.with_errors}`);
  console.log(`\nCoverage Areas Linked: ${stats.total_linked}`);
  console.log(`Unmatched Locations: ${stats.total_unmatched}`);
  console.log(`Low Confidence Matches: ${stats.total_low_confidence}`);
  console.log(`Data Quality Issues: ${stats.data_quality_issues.length}`);

  if (stats.data_quality_issues.length > 0) {
    console.log('\n⚠️  Data Quality Issues Found:');
    stats.data_quality_issues.forEach(issue => {
      console.log(`   - ${issue.id}: ${issue.issue}`);
    });
  }

  console.log('\n✅ Backfill complete!\n');
}

// Run the backfill
backfillOpportunityCoverageAreas().catch(console.error);
