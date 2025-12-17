/**
 * Filter Function - Stage 4 of Processing Pipeline
 * 
 * Simple threshold filtering logic:
 * - EXCLUDE if finalScore < 2
 * - OTHERWISE INCLUDE
 * 
 * This accounts for both base scoring and activity multipliers naturally.
 * Opportunities with low base scores or weak activities will be filtered out.
 */

/**
 * Default filter configuration
 */
export function getDefaultFilterConfig() {
  return {
    // Logging and debugging
    enableLogging: true,
    logLevel: 'info'
  };
}

/**
 * Create custom filter configuration
 */
export function createFilterConfig(overrides = {}) {
  return {
    ...getDefaultFilterConfig(),
    ...overrides
  };
}

/**
 * Main filter function
 * @param {Array} opportunities - Array of analyzed opportunities
 * @param {Object} config - Filter configuration (can include forceFullProcessing, supabase, sourceId)
 * @returns {Promise<Object>} - Filter results with included opportunities and metrics
 */
export async function filterOpportunities(opportunities, config = null) {
  const filterConfig = config || getDefaultFilterConfig();
  const startTime = Date.now();
  
  if (filterConfig.enableLogging) {
    console.log(`\n🔍 Stage 4: Filter Function Starting`);
    console.log(`📊 Input: ${opportunities.length} opportunities to filter`);
  }

  // Initialize metrics
  const metrics = {
    totalAnalyzed: opportunities.length,
    included: 0,
    excluded: 0,
    exclusionReasons: {
      lowFinalScore: 0,
      missingScoring: 0
    },
    inclusionReasons: {
      existingBypass: 0  // Track bypassed updates for forceFullProcessing
    }
  };

  const includedOpportunities = [];
  const excludedOpportunities = [];

  // Process each opportunity
  for (const opportunity of opportunities) {
    const result = await evaluateOpportunity(opportunity, filterConfig);

    if (result.include) {
      includedOpportunities.push(opportunity);
      metrics.included++;
      // Track bypass reasons
      if (result.reasonKey === 'existingBypass') {
        metrics.inclusionReasons.existingBypass++;
      }
    } else {
      excludedOpportunities.push({
        ...opportunity,
        exclusionReason: result.reason
      });
      metrics.excluded++;
      metrics.exclusionReasons[result.reasonKey]++;
    }
  }

  const processingTime = Date.now() - startTime;

  if (filterConfig.enableLogging) {
    logFilterResults(metrics, processingTime);
  }

  // Debug: Log detailed filter results
  console.log(`[FilterFunction] 📊 FILTER SUMMARY:`, {
    totalInput: opportunities.length,
    totalIncluded: includedOpportunities.length,
    totalExcluded: excludedOpportunities.length,
    inclusionRate: ((includedOpportunities.length / opportunities.length) * 100).toFixed(1) + '%'
  });

  if (excludedOpportunities.length > 0) {
    console.log(`[FilterFunction] 📋 Sample excluded opportunities:`, excludedOpportunities.slice(0, 3).map(opp => ({
      id: opp.id,
      finalScore: opp.scoring?.finalScore,
      exclusionReason: opp.exclusionReason
    })));
  }

  if (includedOpportunities.length > 0) {
    console.log(`[FilterFunction] ✅ Sample included opportunities:`, includedOpportunities.slice(0, 3).map(opp => ({
      id: opp.id,
      finalScore: opp.scoring?.finalScore
    })));
  }

  return {
    success: true,
    includedOpportunities,
    excludedOpportunities,
    filterMetrics: metrics,
    processingTime,
    config: filterConfig
  };
}

/**
 * Evaluate a single opportunity against filter criteria
 * @param {Object} opportunity - The opportunity to evaluate
 * @param {Object} config - Filter configuration (may include forceFullProcessing, supabase, sourceId)
 * @returns {Promise<Object>} - Evaluation result with include/exclude decision and reason
 */
async function evaluateOpportunity(opportunity, config) {
  const { forceFullProcessing, supabase, sourceId } = config;

  // Smart filter bypass: If forceFullProcessing and opportunity exists in DB, bypass score filter
  // Rationale: Existing records already passed quality check once; we want to allow updates
  if (forceFullProcessing && supabase && sourceId) {
    try {
      const { data: existing } = await supabase
        .from('funding_opportunities')
        .select('id')
        .eq('title', opportunity.title)
        .eq('api_source_id', sourceId)
        .single();

      if (existing) {
        console.log(`[FilterFunction] ✅ BYPASS: "${opportunity.title}" exists in DB, skipping score filter for update`);
        return {
          include: true,
          reason: 'Existing record - bypassing filter for update',
          reasonKey: 'existingBypass'
        };
      }
    } catch (err) {
      // If query fails, continue with normal filtering
      console.log(`[FilterFunction] ⚠️ Could not check for existing record, applying normal filter`);
    }
  }

  // Check for missing scoring data
  if (!opportunity.scoring) {
    return {
      include: false,
      reason: 'Missing scoring data',
      reasonKey: 'missingScoring'
    };
  }

  const scoring = opportunity.scoring;

  // Simple threshold filtering: exclude if finalScore < 2
  const finalScore = scoring.finalScore || 0;

  if (finalScore < 2) {
    return {
      include: false,
      reason: `Final score ${finalScore} is below threshold of 2 (base: ${scoring.baseScore || 0} × multiplier: ${scoring.activityMultiplier || 0})`,
      reasonKey: 'lowFinalScore'
    };
  }

  return {
    include: true,
    reason: 'Passed filter criteria',
    reasonKey: 'included'
  };
}

/**
 * Log filter results
 */
function logFilterResults(metrics, processingTime) {
  const inclusionRate = ((metrics.included / metrics.totalAnalyzed) * 100).toFixed(1);
  
  console.log(`\n✅ Filter Function Complete`);
  console.log(`⏱️  Processing time: ${processingTime}ms`);
  console.log(`📊 Results:`);
  console.log(`   • Total analyzed: ${metrics.totalAnalyzed}`);
  console.log(`   • Included: ${metrics.included} (${inclusionRate}%)`);
  console.log(`   • Excluded: ${metrics.excluded} (${(100 - inclusionRate).toFixed(1)}%)`);
  
  console.log(`\n📋 Exclusion Breakdown:`);
  console.log(`   • Final score < 2: ${metrics.exclusionReasons.lowFinalScore}`);
  console.log(`   • Missing scoring: ${metrics.exclusionReasons.missingScoring}`);
}

/**
 * Validate filter configuration
 */
export function validateFilterConfig(config) {
  const errors = [];

  if (typeof config !== 'object' || config === null) {
    errors.push('Config must be an object');
    return {
      isValid: false,
      errors
    };
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export default {
  filterOpportunities,
  getDefaultFilterConfig,
  createFilterConfig,
  validateFilterConfig
}; 