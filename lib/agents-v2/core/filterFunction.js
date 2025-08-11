/**
 * Filter Function - Stage 4 of Processing Pipeline
 * 
 * Simple, inclusive filtering logic:
 * - EXCLUDE if 2 out of 3 core categories have 0 scores
 * - OTHERWISE INCLUDE
 * 
 * Core categories: clientRelevance, projectRelevance, fundingAttractiveness
 * This ensures we don't miss opportunities that are strong in at least 2 dimensions
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
      twoZeroCategories: 0,
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
  
  // Core filtering logic: Count zeros in the three main categories
  const coreCategories = [
    scoring.clientRelevance || 0,
    scoring.projectRelevance || 0,
    scoring.fundingAttractiveness || 0
  ];

  const zeroCount = coreCategories.filter(score => score === 0).length;

  // Exclude if 2 or more categories are 0
  if (zeroCount >= 2) {
    return {
      include: false,
      reason: `${zeroCount} out of 3 core categories scored 0 (client: ${scoring.clientRelevance || 0}, project: ${scoring.projectRelevance || 0}, funding: ${scoring.fundingAttractiveness || 0})`,
      reasonKey: 'twoZeroCategories'
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
  console.log(`   • Two zero categories: ${metrics.exclusionReasons.twoZeroCategories}`);
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