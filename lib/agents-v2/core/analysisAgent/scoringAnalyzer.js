import { TAXONOMIES } from '../../../constants/taxonomies.js';

/**
 * Deterministic Scoring Helper Functions
 */

/**
 * Calculate tier-based score for a field against a tiered taxonomy
 * @param {string[]} opportunityField - Array of values from the opportunity
 * @param {Object} taxonomy - Tiered taxonomy object with hot/strong/mild/weak
 * @returns {number} Score based on highest matching tier (3=hot, 2=strong, 1=mild, 0=weak/none)
 */
function calculateTierScore(opportunityField, taxonomy) {
  console.log(`[ScoringAnalyzer] 🔍 calculateTierScore input:`, {
    field: opportunityField,
    fieldType: typeof opportunityField,
    fieldLength: opportunityField?.length,
    taxonomyKeys: taxonomy ? Object.keys(taxonomy) : 'taxonomy is null/undefined'
  });

  if (!opportunityField || opportunityField.length === 0) return 0;
  
  // Check each tier from highest to lowest
  if (opportunityField.some(item => taxonomy.hot.includes(item))) return 3;
  if (opportunityField.some(item => taxonomy.strong.includes(item))) return 2;
  if (opportunityField.some(item => taxonomy.mild.includes(item))) return 1;
  return 0; // weak or not found
}

/**
 * Calculate activity multiplier based on highest matching tier
 * @param {string[]} activities - Array of eligible activities
 * @param {Object} taxonomy - Activities taxonomy with tiers
 * @returns {number} Multiplier (1.0=hot, 0.75=strong, 0.5=mild, 0.25=weak)
 */
function calculateActivityMultiplier(activities, taxonomy) {
  if (!activities || activities.length === 0) return 0.25; // default to weak
  
  if (activities.some(activity => taxonomy.hot.includes(activity))) return 1.0;
  if (activities.some(activity => taxonomy.strong.includes(activity))) return 0.75;
  if (activities.some(activity => taxonomy.mild.includes(activity))) return 0.5;
  return 0.25; // weak tier
}

/**
 * Calculate funding attractiveness score based on dollar amounts
 * @param {Object} opportunity - Opportunity with funding amount fields
 * @returns {number} Score (3=exceptional, 2=strong, 1=moderate, 0=low)
 */
function calculateFundingScore(opportunity) {
  const total = opportunity.totalFundingAvailable || 0;
  const maxAward = opportunity.maximumAward || 0;
  
  // Exceptional: $50M+ total OR $5M+ per award
  if (total >= 50000000 || maxAward >= 5000000) return 3;
  
  // Strong: $25M+ total OR $2M+ per award
  if (total >= 25000000 || maxAward >= 2000000) return 2;
  
  // Moderate: $10M+ total OR $1M+ per award, OR unknown amounts
  if (total >= 10000000 || maxAward >= 1000000 || (!total && !maxAward)) return 1;
  
  // Low: Under thresholds
  return 0;
}

/**
 * Calculate funding type score based on tiered taxonomy
 * @param {string} fundingType - Single funding type from opportunity
 * @param {Object} taxonomy - Funding types taxonomy with tiers
 * @returns {number} Score (1=hot/strong, 0.5=mild, 0=weak/unknown)
 */
function calculateFundingTypeScore(fundingType, taxonomy) {
  if (!fundingType) return 0;
  
  if (taxonomy.hot.includes(fundingType) || taxonomy.strong.includes(fundingType)) return 1;
  if (taxonomy.mild.includes(fundingType)) return 0.5;
  return 0; // weak or unknown
}

/**
 * Generate deterministic reasoning text explaining the scores
 * @param {Object} params - Scoring parameters and results
 * @returns {string} Human-readable reasoning
 */
function generateDeterministicReasoning({
  opportunity,
  clientRelevance,
  projectTypeRelevance,
  fundingAttractiveness,
  fundingType,
  activityMultiplier,
  baseScore,
  finalScore
}) {
  const getTierName = (score, max = 3) => {
    if (max === 3) {
      if (score === 3) return 'Hot';
      if (score === 2) return 'Strong';
      if (score === 1) return 'Mild';
      return 'Weak';
    } else { // funding attractiveness
      if (score === 3) return 'Exceptional';
      if (score === 2) return 'Strong';
      if (score === 1) return 'Moderate';
      return 'Low';
    }
  };

  const getMultiplierName = (multiplier) => {
    if (multiplier === 1.0) return 'Hot';
    if (multiplier === 0.75) return 'Strong';
    if (multiplier === 0.5) return 'Mild';
    return 'Weak';
  };

  return `CLIENT RELEVANCE (${clientRelevance}/3): "${opportunity.eligibleApplicants?.join(', ') || 'Unknown'}" → Tier: ${getTierName(clientRelevance)} → Score: ${clientRelevance}

PROJECT TYPE RELEVANCE (${projectTypeRelevance}/3): "${opportunity.eligibleProjectTypes?.join(', ') || 'Unknown'}" → Tier: ${getTierName(projectTypeRelevance)} → Score: ${projectTypeRelevance}

FUNDING ATTRACTIVENESS (${fundingAttractiveness}/3): "$${opportunity.totalFundingAvailable?.toLocaleString() || 'Unknown'} total, $${opportunity.maximumAward?.toLocaleString() || 'Unknown'} max award" → Tier: ${getTierName(fundingAttractiveness)} → Score: ${fundingAttractiveness}

FUNDING TYPE (${fundingType}/1): "${opportunity.fundingType || 'Unknown'}" → Score: ${fundingType}

ACTIVITY MULTIPLIER (${activityMultiplier}x): "${opportunity.eligibleActivities?.join(', ') || 'Unknown'}" → Tier: ${getMultiplierName(activityMultiplier)} → Multiplier: ${activityMultiplier}x

BASE SCORE: ${baseScore} | FINAL SCORE: ${baseScore} × ${activityMultiplier} = ${finalScore}`;
}

/**
 * Identify basic concerns with an opportunity
 * @param {Object} opportunity - The opportunity to analyze
 * @returns {string[]} Array of concern strings
 */
function identifyBasicConcerns(opportunity) {
  const concerns = [];
  
  if (!opportunity.eligibleApplicants || opportunity.eligibleApplicants.length === 0) {
    concerns.push("No eligible applicants specified - manual review required");
  }
  
  if (!opportunity.eligibleProjectTypes || opportunity.eligibleProjectTypes.length === 0) {
    concerns.push("No project types specified - manual review required");
  }
  
  if (!opportunity.eligibleActivities || opportunity.eligibleActivities.length === 0) {
    concerns.push("No activities specified - may limit scoring accuracy");
  }
  
  if (!opportunity.totalFundingAvailable && !opportunity.maximumAward) {
    concerns.push("Funding amounts unknown - may impact attractiveness scoring");
  }
  
  if (opportunity.description && opportunity.description.toLowerCase().includes('research only')) {
    concerns.push("Research-only opportunity - may not align with implementation services");
  }
  
  return concerns;
}

/**
 * Scoring Analysis Function - Deterministic with Optional LLM Enhancement
 * Uses taxonomy matching for consistent, fast scoring
 */
export async function analyzeOpportunityScoring(opportunities, source) {
  console.log(`[ScoringAnalyzer] 📊 Analyzing scoring for ${opportunities.length} opportunities using deterministic approach`);

  // Debug: Log sample opportunity structure
  if (opportunities.length > 0) {
    console.log(`[ScoringAnalyzer] 🔍 First opportunity sample:`, JSON.stringify(opportunities[0], null, 2));
  }

  // Debug: Verify TAXONOMIES are loaded
  console.log(`[ScoringAnalyzer] 📚 TAXONOMIES loaded:`, {
    hasEligibleApplicants: !!TAXONOMIES?.ELIGIBLE_APPLICANTS,
    hasProjectTypes: !!TAXONOMIES?.ELIGIBLE_PROJECT_TYPES,
    hasActivities: !!TAXONOMIES?.ELIGIBLE_ACTIVITIES,
    hasFundingTypes: !!TAXONOMIES?.FUNDING_TYPES,
    taxonomiesType: typeof TAXONOMIES
  });

  try {
    // Deterministically calculate scores for all opportunities
    const scoringResults = opportunities.map((opportunity, index) => {
      try {
        console.log(`[ScoringAnalyzer] 🎯 Processing opportunity ${index + 1}/${opportunities.length}: ${opportunity.id || 'no-id'}`);

        // Calculate individual components using taxonomy matching
        const clientRelevance = calculateTierScore(opportunity.eligibleApplicants, TAXONOMIES.ELIGIBLE_APPLICANTS);
        const projectTypeRelevance = calculateTierScore(opportunity.eligibleProjectTypes, TAXONOMIES.ELIGIBLE_PROJECT_TYPES);
        const fundingAttractiveness = calculateFundingScore(opportunity);
        const fundingType = calculateFundingTypeScore(opportunity.fundingType, TAXONOMIES.FUNDING_TYPES);
        const activityMultiplier = calculateActivityMultiplier(opportunity.eligibleActivities, TAXONOMIES.ELIGIBLE_ACTIVITIES);

        // Calculate final scores
        const baseScore = clientRelevance + projectTypeRelevance + fundingAttractiveness + fundingType;
        const finalScore = Math.round(baseScore * activityMultiplier * 10) / 10; // Round to 1 decimal

        // Debug: Log calculated scores
        console.log(`[ScoringAnalyzer] 📊 Scores for ${opportunity.id}:`, {
          clientRelevance,
          projectTypeRelevance,
          fundingAttractiveness,
          fundingType,
          activityMultiplier,
          baseScore,
          finalScore
        });

        // Generate basic reasoning
        const relevanceReasoning = generateDeterministicReasoning({
          opportunity,
          clientRelevance,
          projectTypeRelevance,
          fundingAttractiveness,
          fundingType,
          activityMultiplier,
          baseScore,
          finalScore
        });

        return {
          id: opportunity.id,
          scoring: {
            clientRelevance,
            projectTypeRelevance,
            fundingAttractiveness,
            fundingType,
            activityMultiplier,
            baseScore,
            finalScore
          },
          relevanceReasoning,
          concerns: identifyBasicConcerns(opportunity)
        };

      } catch (oppError) {
        console.error(`[ScoringAnalyzer] ❌ Error processing individual opportunity ${opportunity.id}:`, {
          error: oppError.message,
          stack: oppError.stack,
          opportunity: JSON.stringify(opportunity, null, 2)
        });

        // Return error state for this opportunity
        return {
          id: opportunity.id,
          scoring: {
            clientRelevance: 0,
            projectTypeRelevance: 0,
            fundingAttractiveness: 0,
            fundingType: 0,
            activityMultiplier: 0.25,
            baseScore: 0,
            finalScore: 0
          },
          relevanceReasoning: `ERROR: ${oppError.message} - manual review required`,
          concerns: ["Individual scoring analysis failed - manual review required"]
        };
      }
    });

    console.log(`[ScoringAnalyzer] ✅ Deterministic scoring completed for ${scoringResults.length} opportunities`);

    return scoringResults;

  } catch (error) {
    console.error(`[ScoringAnalyzer] ❌ CRITICAL ERROR in scoring analysis:`, {
      errorMessage: error.message,
      errorStack: error.stack,
      errorType: error.constructor.name,
      opportunitiesCount: opportunities.length,
      sourceId: source?.id,
      sourceName: source?.name
    });
    
    // Fallback: return default scoring for each opportunity
    console.log(`[ScoringAnalyzer] 🔄 Using fallback scoring`);
    return opportunities.map(opportunity => ({
      id: opportunity.id,
      scoring: {
        clientRelevance: 0,
        projectTypeRelevance: 0,
        fundingAttractiveness: 0,
        fundingType: 0,
        activityMultiplier: 0.25,
        baseScore: 0,
        finalScore: 0
      },
      relevanceReasoning: `${opportunity.title} - Scoring analysis failed, requires manual assessment`,
      concerns: ["Analysis failed - manual review required"]
    }));
  }
} 