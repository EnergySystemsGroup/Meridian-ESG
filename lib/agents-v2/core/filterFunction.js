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
    // Core filtering logic
    excludeIfTwoZeros: true,
    
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
 * @param {Object} config - Filter configuration
 * @returns {Object} - Filter results with included opportunities and metrics
 */
export function filterOpportunities(opportunities, config = null) {
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
    }
  };

  const includedOpportunities = [];
  const excludedOpportunities = [];

  // Process each opportunity
  for (const opportunity of opportunities) {
    const result = evaluateOpportunity(opportunity, filterConfig);
    
    if (result.include) {
      includedOpportunities.push(opportunity);
      metrics.included++;
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
 * @param {Object} config - Filter configuration
 * @returns {Object} - Evaluation result with include/exclude decision and reason
 */
function evaluateOpportunity(opportunity, config) {
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

  // Include the opportunity
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
  
  if (typeof config.excludeIfTwoZeros !== 'boolean') {
    errors.push('excludeIfTwoZeros must be a boolean');
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