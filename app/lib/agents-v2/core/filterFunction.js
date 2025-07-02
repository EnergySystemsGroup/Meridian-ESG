/**
 * Filter Function V2 - New Gating System Logic
 * 
 * Applies programmatic filtering based on opportunity scores from Analysis Agent V2.
 * Uses new gating system: clientProjectRelevance (0-6), fundingAttractiveness (0-3), fundingType (0-1).
 * 
 * Exports: filterOpportunities(opportunities, config)
 */

/**
 * Default filtering configuration for new gating system
 */
const DEFAULT_CONFIG = {
  // Primary gating thresholds
  minimumClientProjectRelevance: 2,    // Primary gate: must score ≥2 to pass
  autoQualificationThreshold: 5,       // Auto-qualify if clientProjectRelevance ≥5
  
  // Secondary filtering criteria (for scores 2-4)
  minimumFundingAttractiveness: 1,     // 0-3 scale: moderate funding required
  
  // Funding amount thresholds (dollar amounts)
  minimumTotalFunding: 50000,          // $50K minimum total funding pool
  minimumAwardAmount: 25000,           // $25K minimum per award
};

/**
 * Filters opportunities based on new gating system scores and configurable criteria
 * @param {Array} opportunities - Enhanced opportunities from AnalysisAgent V2
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
    
    console.log(`[FilterFunction] 🔍 Filtering ${opportunities.length} opportunities with new gating system`);
    
    if (opportunities.length === 0) {
      return {
        includedOpportunities: [],
        excludedOpportunities: [],
        filterMetrics: {
          totalAnalyzed: 0,
          included: 0,
          excluded: 0,
          exclusionReasons: {},
          gatingMetrics: {
            failedPrimaryGate: 0,
            autoQualified: 0,
            secondaryFiltered: 0
          }
        },
        executionTime: Math.max(1, Date.now() - startTime)
      };
    }
    
    console.log(`[FilterFunction] ⚙️ Using gating: primaryGate≥${filterConfig.minimumClientProjectRelevance}, autoQualify≥${filterConfig.autoQualificationThreshold}`);
    
    const includedOpportunities = [];
    const excludedOpportunities = [];
    const exclusionReasons = {};
    const gatingMetrics = {
      failedPrimaryGate: 0,
      autoQualified: 0,
      secondaryFiltered: 0
    };
    
    for (const opportunity of opportunities) {
      const filterResult = evaluateOpportunityWithGating(opportunity, filterConfig, gatingMetrics);
      
      if (filterResult.include) {
        includedOpportunities.push({
          ...opportunity,
          filterResult: {
            passed: true,
            reason: filterResult.reason,
            gateType: filterResult.gateType
          }
        });
      } else {
        excludedOpportunities.push({
          ...opportunity,
          filterResult: {
            passed: false,
            reason: filterResult.reason,
            gateType: filterResult.gateType
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
      gatingMetrics,
      inclusionRate: Math.round((includedOpportunities.length / opportunities.length) * 100)
    };
    
    const executionTime = Math.max(1, Date.now() - startTime);
    
    console.log(`[FilterFunction] ✅ Filtering completed in ${executionTime}ms`);
    console.log(`[FilterFunction] 📊 Results: ${filterMetrics.included}/${filterMetrics.totalAnalyzed} included (${filterMetrics.inclusionRate}%)`);
    console.log(`[FilterFunction] 🚪 Gating: ${gatingMetrics.autoQualified} auto-qualified, ${gatingMetrics.failedPrimaryGate} failed primary gate`);
    
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
 * Evaluates a single opportunity against new gating system criteria
 * @param {Object} opportunity - The opportunity to evaluate
 * @param {Object} config - Filtering configuration
 * @param {Object} gatingMetrics - Metrics object to update
 * @returns {Object} - Evaluation result with include/exclude decision, reason, and gate type
 */
function evaluateOpportunityWithGating(opportunity, config, gatingMetrics) {
  const scoring = opportunity.scoring || {};
  
  // Validate scoring object has new fields
  if (!scoring.hasOwnProperty('clientProjectRelevance')) {
    console.warn(`[FilterFunction] ⚠️ Opportunity missing new scoring fields, using fallback:`, opportunity.title);
    return {
      include: false,
      reason: 'missing_new_scoring_fields',
      gateType: 'validation_failed'
    };
  }
  
  // Extract new scoring fields with validation
  const clientProjectRelevance = Math.max(0, Math.min(6, scoring.clientProjectRelevance || 0));
  const fundingAttractiveness = Math.max(0, Math.min(3, scoring.fundingAttractiveness || 0)); 
  const fundingType = Math.max(0, Math.min(1, scoring.fundingType || 0));
  
  // PRIMARY GATE: clientProjectRelevance ≥ 2
  if (clientProjectRelevance < config.minimumClientProjectRelevance) {
    gatingMetrics.failedPrimaryGate++;
    return {
      include: false,
      reason: `failed_primary_gate_score_${clientProjectRelevance}`,
      gateType: 'primary_gate_failed'
    };
  }
  
  // AUTO-QUALIFICATION GATE: clientProjectRelevance ≥ 5
  if (clientProjectRelevance >= config.autoQualificationThreshold) {
    gatingMetrics.autoQualified++;
    return {
      include: true,
      reason: `auto_qualified_score_${clientProjectRelevance}`,
      gateType: 'auto_qualified'
    };
  }
  
  // SECONDARY FILTERING: For scores 2-4, apply additional criteria
  gatingMetrics.secondaryFiltered++;
  
  // Check funding amount thresholds (only exclude if amounts are known and below threshold)
  const totalFunding = opportunity.totalFundingAvailable;
  const maxAward = opportunity.maximumAward;
  
  // Only check funding thresholds if amounts are known (not null/undefined)
  if (totalFunding !== null && totalFunding !== undefined && totalFunding < config.minimumTotalFunding) {
    return {
      include: false,
      reason: `funding_too_small_total_${totalFunding}`,
      gateType: 'secondary_funding_failed'
    };
  }
  
  if (maxAward !== null && maxAward !== undefined && maxAward < config.minimumAwardAmount) {
    return {
      include: false,
      reason: `funding_too_small_award_${maxAward}`,
      gateType: 'secondary_funding_failed'
    };
  }
  
  // Check funding attractiveness threshold (fallback for when dollar amounts aren't available)
  if (fundingAttractiveness < config.minimumFundingAttractiveness) {
    return {
      include: false,
      reason: `insufficient_funding_attractiveness_${fundingAttractiveness}`,
      gateType: 'secondary_funding_failed'
    };
  }
  
  // Opportunity passes all gates and secondary filtering
  return {
    include: true,
    reason: `passed_secondary_filtering_score_${clientProjectRelevance}_${fundingAttractiveness}_${fundingType}`,
    gateType: 'secondary_passed'
  };
}

/**
 * Creates a custom filtering configuration for new gating system
 * @param {Object} overrides - Configuration overrides
 * @returns {Object} - Merged configuration
 */
export function createFilterConfig(overrides = {}) {
  return { ...DEFAULT_CONFIG, ...overrides };
}

/**
 * Gets the default filtering configuration for new gating system
 * @returns {Object} - Default configuration
 */
export function getDefaultFilterConfig() {
  return { ...DEFAULT_CONFIG };
} 