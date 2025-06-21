/**
 * AnalysisAgent V2 - Modular Agent
 * 
 * Handles content enhancement and systematic scoring of opportunities.
 * Replaces detailProcessorAgent with focused, objective scoring approach.
 * 
 * Exports: enhanceOpportunities(opportunities, source, anthropic)
 */

import { createSupabaseClient, logAgentExecution } from '../../supabase.js';
import { TAXONOMIES } from '../../constants/taxonomies.js';

/**
 * Enhances opportunities with better content and systematic scoring
 * @param {Array} opportunities - Standardized opportunities from DataExtractionAgent
 * @param {Object} source - The source object for context
 * @param {Object} anthropic - Anthropic client instance
 * @returns {Promise<Object>} - Enhanced opportunities with scores
 */
export async function enhanceOpportunities(opportunities, source, anthropic) {
  const startTime = Date.now();
  
  try {
    // Input validation
    if (!opportunities || !Array.isArray(opportunities)) {
      throw new Error('Opportunities must be an array');
    }
    
    console.log(`[AnalysisAgent] 🧠 Enhancing ${opportunities.length} opportunities from: ${source.name}`);
    
    if (opportunities.length === 0) {
      return {
        opportunities: [],
        analysisMetrics: {
          totalAnalyzed: 0,
          averageScore: 0,
          scoreDistribution: { high: 0, medium: 0, low: 0 },
          meetsFundingThreshold: 0,
          grantFunding: 0
        },
        executionTime: Math.max(1, Date.now() - startTime)
      };
    }
    
    // Process opportunities in batches of 5 for efficiency
    const batchSize = 5;
    const enhancedOpportunities = [];
    
    for (let i = 0; i < opportunities.length; i += batchSize) {
      const batch = opportunities.slice(i, i + batchSize);
      const enhancedBatch = await processBatch(batch, source, anthropic);
      enhancedOpportunities.push(...enhancedBatch);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < opportunities.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Calculate analysis metrics
    const analysisMetrics = calculateAnalysisMetrics(enhancedOpportunities);
    
    const executionTime = Math.max(1, Date.now() - startTime);
    console.log(`[AnalysisAgent] ✅ Analysis completed in ${executionTime}ms`);
    console.log(`[AnalysisAgent] 📊 Average score: ${analysisMetrics.averageScore}/10`);
    console.log(`[AnalysisAgent] 🎯 High relevance: ${analysisMetrics.scoreDistribution.high} opportunities`);
    
    const result = {
      opportunities: enhancedOpportunities,
      analysisMetrics,
      executionTime
    };
    
    // Log agent execution for tracking
    try {
      const supabase = createSupabaseClient();
      await logAgentExecution(
        supabase,
        'analysis_v2',
        { 
          source: { id: source.id, name: source.name },
          opportunityCount: opportunities.length
        },
        result,
        executionTime,
        null // TODO: Add token usage tracking from Anthropic SDK
      );
    } catch (logError) {
      console.error('[AnalysisAgent] ❌ Failed to log execution:', logError);
      // Don't throw - logging failure shouldn't break the pipeline
    }
    
    return result;
    
  } catch (error) {
    console.error(`[AnalysisAgent] ❌ Error enhancing opportunities:`, error);
    
    // Log failed execution
    try {
      const supabase = createSupabaseClient();
      const executionTime = Math.max(1, Date.now() - startTime);
      await logAgentExecution(
        supabase,
        'analysis_v2',
        { 
          source: { id: source.id, name: source.name },
          opportunityCount: opportunities.length
        },
        null,
        executionTime,
        null,
        error
      );
    } catch (logError) {
      console.error('[AnalysisAgent] ❌ Failed to log error execution:', logError);
    }
    
    throw error;
  }
}

/**
 * Processes a batch of opportunities for content enhancement and scoring
 */
async function processBatch(opportunities, source, anthropic) {
  const prompt = `You are analyzing funding opportunities for an energy services business. Enhance the content and provide systematic scoring for each opportunity.

OUR BUSINESS CONTEXT:
- Energy services company with expertise in energy and infrastructure projects
- TARGET CLIENTS: ${TAXONOMIES.TARGET_CLIENT_TYPES.join(', ')}
- TARGET PROJECTS: ${TAXONOMIES.TARGET_PROJECT_TYPES.join(', ')}
- Strong preference for opportunities with clear infrastructure focus, particularly in the energy space
- Prefer grants with significant funding potential per applicant
- Target opportunities where our energy services expertise provides competitive advantage

OPPORTUNITIES TO ANALYZE:
${opportunities.map((opp, index) => `
OPPORTUNITY ${index + 1}:
Title: ${opp.title}
Description: ${opp.description || 'No description provided'}
Funding: $${opp.totalFundingAvailable?.toLocaleString() || 'Unknown'} total, $${opp.minimumAward?.toLocaleString() || 'Unknown'} - $${opp.maximumAward?.toLocaleString() || 'Unknown'} per award
Deadline: ${opp.closeDate || 'Unknown'}
Eligible Applicants: ${opp.eligibleApplicants?.join(', ') || 'Unknown'}
Project Types: ${opp.eligibleProjectTypes?.join(', ') || 'Unknown'}
Locations: ${opp.eligibleLocations?.join(', ') || 'Unknown'}
Status: ${opp.status || 'Unknown'}
`).join('\n')}

For each opportunity, provide:

1. ENHANCED_DESCRIPTION: Rewrite as comprehensive 2-3 paragraph description that:
   - Explains the program clearly and professionally
   - Highlights key benefits and funding details
   - Notes important deadlines and requirements
   - Uses professional grant language

2. ACTIONABLE_SUMMARY: One concise paragraph (2-3 sentences) for sales team with:
   - Who can apply and for what projects
   - Funding amounts and key deadlines
   - Why it's relevant to our clients

3. SYSTEMATIC_SCORING: Rate each criterion based on the opportunity data above:

   - clientProjectRelevance (0-6): How well this fits our energy services business
     • 6 = Perfect: Both "Eligible Applicants" AND "Project Types" match our targets exactly
     • 5 = Near perfect: One field matches exactly + other is closely related
     • 4 = Strong: Both fields are strong fits for our energy services business  
     • 3 = Good: One field is a strong fit + other is reasonable
     • 2 = Reasonable: Both fields could work with our business (use judgment)
     • 1 = Weak: Only one field has minimal relevance to our services
     • 0 = No fit: Neither eligible applicants nor project types fit our focus
   
   - fundingAttractiveness (0-3): Based on the "Funding:" line for each opportunity
     • 3 = Exceptional: Shows $5M+ total funding OR $2M+ maximum per award
     • 2 = Strong: Shows $1M+ total funding OR $500K+ maximum per award  
     • 1 = Moderate: Shows meaningful funding amounts
     • 0 = Low/Unknown: Shows "Unknown" amounts or very small funding
   
   - fundingType (0-1): Based on funding mechanism
     • 1 = Grant (preferred)
     • 0 = Loan, tax credit, other mechanism, or unknown

4. SCORING_EXPLANATION: Brief explanation of the scoring rationale

5. CONCERNS: Any red flags, unusual requirements, or limitations to note

NOTE: Opportunities need clientProjectRelevance ≥2 to be viable, or ≥5 for auto-qualification.

Return as JSON array with this exact structure:
[
  {
    "opportunityIndex": 0,
    "enhancedDescription": "...",
    "actionableSummary": "...",
    "scoring": {
      "clientProjectRelevance": 6,
      "fundingAttractiveness": 3, 
      "fundingType": 1,
      "overallScore": 10
    },
    "scoringExplanation": "...",
    "concerns": ["concern1", "concern2"],
    "fundingPerApplicant": 1000000
  }
]`;

  // Use structured schema-based response
  const response = await anthropic.callWithSchema(
    prompt,
    {
      type: "object",
      properties: {
        opportunities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              opportunityIndex: { type: "number" },
              enhancedDescription: { type: "string" },
              actionableSummary: { type: "string" },
              scoring: {
                type: "object",
                properties: {
                  clientProjectRelevance: { type: "number", minimum: 0, maximum: 6 },
                  fundingAttractiveness: { type: "number", minimum: 0, maximum: 3 },
                  fundingType: { type: "number", minimum: 0, maximum: 1 }
                },
                required: ["clientProjectRelevance", "fundingAttractiveness", "fundingType"]
              },
              scoringExplanation: { type: "string" },
              concerns: { type: "array", items: { type: "string" } },
              fundingPerApplicant: { type: "number", nullable: true }
            },
            required: ["opportunityIndex", "enhancedDescription", "actionableSummary", "scoring", "scoringExplanation"]
          }
        }
      },
      required: ["opportunities"]
    },
    {
      maxTokens: 4000,
      temperature: 0.1
    }
  );
  
  try {
    const analysisResults = response.data.opportunities;
    
    if (!Array.isArray(analysisResults)) {
      throw new Error('Response opportunities is not an array');
    }
    
    // Merge analysis results with original opportunities
    const enhancedOpportunities = opportunities.map((opportunity, index) => {
      const analysis = analysisResults.find(result => result.opportunityIndex === index);
      
      if (!analysis) {
        console.warn(`[AnalysisAgent] ⚠️ No analysis found for opportunity ${index}`);
        return {
          // ===== EXTRACTED DATA (preserved from DataExtractionAgent) =====
          id: opportunity.id,
          title: opportunity.title,
          description: opportunity.description,
          fundingType: opportunity.fundingType,
          funding_source: opportunity.funding_source,
          totalFundingAvailable: opportunity.totalFundingAvailable,
          minimumAward: opportunity.minimumAward,
          maximumAward: opportunity.maximumAward,
          notes: opportunity.notes,
          openDate: opportunity.openDate,
          closeDate: opportunity.closeDate,
          eligibleApplicants: opportunity.eligibleApplicants,
          eligibleProjectTypes: opportunity.eligibleProjectTypes,
          eligibleLocations: opportunity.eligibleLocations,
          url: opportunity.url,
          matchingRequired: opportunity.matchingRequired,
          matchingPercentage: opportunity.matchingPercentage,
          categories: opportunity.categories,
          tags: opportunity.tags,
          status: opportunity.status,
          isNational: opportunity.isNational,
          
          // ===== ANALYSIS ENHANCEMENTS (fallback defaults) =====
          enhancedDescription: opportunity.description || 'No description available',
          actionableSummary: `${opportunity.title} - Review required`,
          scoring: getDefaultScoring(),
          scoringExplanation: 'Analysis failed - requires manual review',
          concerns: ['Analysis failed'],
          fundingPerApplicant: opportunity.maximumAward || 0
        };
      }
      
      // Clamp individual scores first, then calculate overall score
      const clampedScoring = {
        clientProjectRelevance: Math.min(6, Math.max(0, analysis.scoring?.clientProjectRelevance || 0)),
        fundingAttractiveness: Math.min(3, Math.max(0, analysis.scoring?.fundingAttractiveness || 0)),
        fundingType: Math.min(1, Math.max(0, analysis.scoring?.fundingType || 0))
      };
      
      // Return COMPLETE opportunity with all extracted data + analysis enhancements
      return {
        // ===== EXTRACTED DATA (preserved from DataExtractionAgent) =====
        id: opportunity.id,
        title: opportunity.title,
        description: opportunity.description,
        fundingType: opportunity.fundingType,
        funding_source: opportunity.funding_source,
        totalFundingAvailable: opportunity.totalFundingAvailable,
        minimumAward: opportunity.minimumAward,
        maximumAward: opportunity.maximumAward,
        notes: opportunity.notes,
        openDate: opportunity.openDate,
        closeDate: opportunity.closeDate,
        eligibleApplicants: opportunity.eligibleApplicants,
        eligibleProjectTypes: opportunity.eligibleProjectTypes,
        eligibleLocations: opportunity.eligibleLocations,
        url: opportunity.url,
        matchingRequired: opportunity.matchingRequired,
        matchingPercentage: opportunity.matchingPercentage,
        categories: opportunity.categories,
        tags: opportunity.tags,
        status: opportunity.status,
        isNational: opportunity.isNational,
        
        // ===== ANALYSIS ENHANCEMENTS (added by AnalysisAgent) =====
        enhancedDescription: analysis.enhancedDescription || opportunity.description,
        actionableSummary: analysis.actionableSummary || `${opportunity.title} - Review required`,
        scoring: {
          ...clampedScoring,
          overallScore: calculateOverallScore(clampedScoring)
        },
        scoringExplanation: analysis.scoringExplanation || 'No explanation provided',
        concerns: Array.isArray(analysis.concerns) ? analysis.concerns : [],
        fundingPerApplicant: analysis.fundingPerApplicant || opportunity.maximumAward || 0
      };
    });
    
    console.log(`[AnalysisAgent] ✅ Enhanced ${enhancedOpportunities.length} opportunities`);
    return enhancedOpportunities;
    
  } catch (schemaError) {
    console.error(`[AnalysisAgent] ❌ Failed to process structured AI response:`, schemaError);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Return opportunities with default analysis if parsing fails
    return opportunities.map(opportunity => ({
      // ===== EXTRACTED DATA (preserved from DataExtractionAgent) =====
      id: opportunity.id,
      title: opportunity.title,
      description: opportunity.description,
      fundingType: opportunity.fundingType,
      funding_source: opportunity.funding_source,
      totalFundingAvailable: opportunity.totalFundingAvailable,
      minimumAward: opportunity.minimumAward,
      maximumAward: opportunity.maximumAward,
      notes: opportunity.notes,
      openDate: opportunity.openDate,
      closeDate: opportunity.closeDate,
      eligibleApplicants: opportunity.eligibleApplicants,
      eligibleProjectTypes: opportunity.eligibleProjectTypes,
      eligibleLocations: opportunity.eligibleLocations,
      url: opportunity.url,
      matchingRequired: opportunity.matchingRequired,
      matchingPercentage: opportunity.matchingPercentage,
      categories: opportunity.categories,
      tags: opportunity.tags,
      status: opportunity.status,
      isNational: opportunity.isNational,
      
      // ===== ANALYSIS ENHANCEMENTS (fallback defaults) =====
      enhancedDescription: opportunity.description || 'No description available',
      actionableSummary: `${opportunity.title} - Analysis failed, requires manual review`,
      scoring: getDefaultScoring(),
      scoringExplanation: 'AI analysis failed - requires manual review',
      concerns: ['AI analysis failed'],
      fundingPerApplicant: opportunity.maximumAward || 0
    }));
  }
}

/**
 * Calculate overall score from individual scoring components using gating system
 */
function calculateOverallScore(scoring) {
  if (!scoring) return 0;
  
  const total = (scoring.clientProjectRelevance || 0) + 
                (scoring.fundingAttractiveness || 0) + 
                (scoring.fundingType || 0);
                
  return Math.min(10, Math.max(0, Math.round(total)));
}

/**
 * Get default scoring when analysis fails
 */
function getDefaultScoring() {
  return {
    clientProjectRelevance: 0,
    fundingAttractiveness: 0,
    fundingType: 0,
    overallScore: 0
  };
}

/**
 * Calculate comprehensive analysis metrics
 */
function calculateAnalysisMetrics(opportunities) {
  if (opportunities.length === 0) {
    return {
      totalAnalyzed: 0,
      averageScore: 0,
      scoreDistribution: { high: 0, medium: 0, low: 0 },
      meetsFundingThreshold: 0,
      grantFunding: 0
    };
  }
  
  const scores = opportunities.map(opp => opp.scoring?.overallScore || 0);
  const averageScore = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  
  const scoreDistribution = {
    high: scores.filter(score => score >= 7).length,    // 7-10 points
    medium: scores.filter(score => score >= 4 && score < 7).length,  // 4-6 points  
    low: scores.filter(score => score < 4).length       // 0-3 points
  };
  
  const meetsFundingThreshold = opportunities.filter(opp => 
    opp.scoring?.fundingAttractiveness >= 2
  ).length;
  
  const grantFunding = opportunities.filter(opp => 
    opp.fundingType === 'grant' || opp.scoring?.fundingType === 1
  ).length;
  
  return {
    totalAnalyzed: opportunities.length,
    averageScore,
    scoreDistribution,
    meetsFundingThreshold,
    grantFunding
  };
} 