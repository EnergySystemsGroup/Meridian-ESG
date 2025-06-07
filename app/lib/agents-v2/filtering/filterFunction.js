/**
 * Filter Function V2 - Simple Threshold Logic
 * 
 * Applies programmatic filtering based on opportunity scores and criteria.
 * Replaces complex AI-based filtering with fast, objective thresholds.
 * 
 * Exports: filterOpportunities(opportunities, config)
 */

/**
 * Default filtering configuration
 */
const DEFAULT_CONFIG = {
  // Score thresholds (0-10 scale)
  minimumOverallScore: 2,        // Only opportunities scoring 2+ pass
  minimumProjectTypeMatch: 1,    // Must have some project type relevance
  minimumClientTypeMatch: 1,     // Must have some client type relevance
  
  // Funding preferences
  preferGrants: true,            // Prefer grants over loans/tax credits
  preferFundingThreshold: false, // Don't require $1M+ threshold (too restrictive)
  
  // Status filtering
  excludeClosedOpportunities: true,  // Skip opportunities with status 'closed'
  
  // Quality filtering
  requireDescription: false,     // Don't require description (some APIs lack it)
  requireFundingInfo: false      // Don't require funding amounts (some lack it)
};

/**
 * Filters opportunities based on scores and configurable criteria
 * @param {Array} opportunities - Enhanced opportunities from AnalysisAgent
 * @param {Object} config - Filtering configuration (optional)
 * @returns {Object} - Filtered opportunities with metrics
 */
export function filterOpportunities(opportunities, config = DEFAULT_CONFIG) {
  const startTime = Date.now();
  const filterConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    // Input validation
    if (!opportunities || !Array.isArray(opportunities)) {
      throw new Error('Opportunities must be an array');
    }
    
    console.log(`[FilterFunction] 🔍 Filtering ${opportunities.length} opportunities with thresholds`);
    
    if (opportunities.length === 0) {
      return {
        includedOpportunities: [],
        excludedOpportunities: [],
        filterMetrics: {
          totalAnalyzed: 0,
          included: 0,
          excluded: 0,
          exclusionReasons: {}
        },
        executionTime: Math.max(1, Date.now() - startTime)
      };
    }
    
    console.log(`[FilterFunction] ⚙️ Using config: minScore=${filterConfig.minimumOverallScore}, preferGrants=${filterConfig.preferGrants}`);
    
    const includedOpportunities = [];
    const excludedOpportunities = [];
    const exclusionReasons = {};
    
    for (const opportunity of opportunities) {
      const filterResult = evaluateOpportunity(opportunity, filterConfig);
      
      if (filterResult.include) {
        includedOpportunities.push({
          ...opportunity,
          filterResult: {
            passed: true,
            reason: filterResult.reason
          }
        });
      } else {
        excludedOpportunities.push({
          ...opportunity,
          filterResult: {
            passed: false,
            reason: filterResult.reason
          }
        });
        
        // Track exclusion reasons for metrics
        exclusionReasons[filterResult.reason] = (exclusionReasons[filterResult.reason] || 0) + 1;
      }
    }
    
    const filterMetrics = {
      totalAnalyzed: opportunities.length,
      included: includedOpportunities.length,
      excluded: excludedOpportunities.length,
      exclusionReasons,
      inclusionRate: Math.round((includedOpportunities.length / opportunities.length) * 100)
    };
    
    const executionTime = Math.max(1, Date.now() - startTime);
    
    console.log(`[FilterFunction] ✅ Filtering completed in ${executionTime}ms`);
    console.log(`[FilterFunction] 📊 Results: ${filterMetrics.included}/${filterMetrics.totalAnalyzed} included (${filterMetrics.inclusionRate}%)`);
    
    if (Object.keys(exclusionReasons).length > 0) {
      console.log(`[FilterFunction] 🚫 Exclusion reasons:`, exclusionReasons);
    }
    
    return {
      includedOpportunities,
      excludedOpportunities,
      filterMetrics,
      executionTime
    };
    
  } catch (error) {
    console.error(`[FilterFunction] ❌ Error filtering opportunities:`, error);
    throw error;
  }
}

/**
 * Evaluates a single opportunity against filtering criteria
 * @param {Object} opportunity - The opportunity to evaluate
 * @param {Object} config - Filtering configuration
 * @returns {Object} - Evaluation result with include/exclude decision and reason
 */
function evaluateOpportunity(opportunity, config) {
  const scoring = opportunity.scoring || {};
  
  // Check overall score threshold
  const overallScore = scoring.overallScore || 0;
  if (overallScore < config.minimumOverallScore) {
    return {
      include: false,
      reason: `low_overall_score_${overallScore}`
    };
  }
  
  // Check project type relevance
  const projectTypeMatch = scoring.projectTypeMatch || 0;
  if (projectTypeMatch < config.minimumProjectTypeMatch) {
    return {
      include: false,
      reason: 'insufficient_project_type_match'
    };
  }
  
  // Check client type relevance
  const clientTypeMatch = scoring.clientTypeMatch || 0;
  if (clientTypeMatch < config.minimumClientTypeMatch) {
    return {
      include: false,
      reason: 'insufficient_client_type_match'
    };
  }
  
  // Check status filtering
  if (config.excludeClosedOpportunities) {
    const status = (opportunity.status || '').toLowerCase();
    if (status === 'closed' || status === 'expired') {
      return {
        include: false,
        reason: 'opportunity_closed'
      };
    }
  }
  
  // Check funding preferences (non-exclusionary, just affects scoring)
  if (config.preferGrants) {
    const fundingType = scoring.fundingType || 0;
    if (fundingType === 0 && overallScore < config.minimumOverallScore + 2) {
      // Non-grant funding needs higher overall score to compensate
      return {
        include: false,
        reason: 'non_grant_funding_insufficient_score'
      };
    }
  }
  
  // Check funding threshold preference (non-exclusionary)
  if (config.preferFundingThreshold) {
    const fundingThreshold = scoring.fundingThreshold || 0;
    if (fundingThreshold === 0 && overallScore < config.minimumOverallScore + 3) {
      // Sub-$1M funding needs higher overall score to compensate
      return {
        include: false,
        reason: 'below_funding_threshold_insufficient_score'
      };
    }
  }
  
  // Check quality requirements
  if (config.requireDescription && !opportunity.enhancedDescription && !opportunity.description) {
    return {
      include: false,
      reason: 'missing_description'
    };
  }
  
  if (config.requireFundingInfo && !opportunity.maximumAward && !opportunity.totalFundingAvailable) {
    return {
      include: false,
      reason: 'missing_funding_info'
    };
  }
  
  // Opportunity passes all filters
  return {
    include: true,
    reason: `passed_with_score_${overallScore}`
  };
}

/**
 * Creates a custom filtering configuration
 * @param {Object} overrides - Configuration overrides
 * @returns {Object} - Merged configuration
 */
export function createFilterConfig(overrides = {}) {
  return { ...DEFAULT_CONFIG, ...overrides };
}

/**
 * Gets the default filtering configuration
 * @returns {Object} - Default configuration
 */
export function getDefaultFilterConfig() {
  return { ...DEFAULT_CONFIG };
}

/**
 * Applies strict filtering for high-value opportunities only
 * @param {Array} opportunities - Opportunities to filter
 * @returns {Object} - Strictly filtered opportunities
 */
export function applyStrictFiltering(opportunities) {
  const strictConfig = createFilterConfig({
    minimumOverallScore: 7,        // High score required
    minimumProjectTypeMatch: 2,    // Strong project type match
    minimumClientTypeMatch: 2,     // Strong client type match
    preferGrants: true,            // Grants only
    preferFundingThreshold: true,  // $1M+ preferred
    excludeClosedOpportunities: true,
    requireDescription: true,      // Must have description
    requireFundingInfo: true       // Must have funding info
  });
  
  console.log(`[FilterFunction] 🎯 Applying strict filtering criteria`);
  return filterOpportunities(opportunities, strictConfig);
}

/**
 * Applies lenient filtering for broader opportunity capture
 * @param {Array} opportunities - Opportunities to filter
 * @returns {Object} - Leniently filtered opportunities
 */
export function applyLenientFiltering(opportunities) {
  const lenientConfig = createFilterConfig({
    minimumOverallScore: 1,        // Very low threshold
    minimumProjectTypeMatch: 0,    // Any project type match
    minimumClientTypeMatch: 0,     // Any client type match
    preferGrants: false,           // Accept all funding types
    preferFundingThreshold: false, // Accept all funding amounts
    excludeClosedOpportunities: true,  // Still exclude closed
    requireDescription: false,     // Don't require description
    requireFundingInfo: false      // Don't require funding info
  });
  
  console.log(`[FilterFunction] 🌐 Applying lenient filtering criteria`);
  return filterOpportunities(opportunities, lenientConfig);
} 