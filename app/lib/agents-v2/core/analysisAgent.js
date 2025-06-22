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
import { schemas } from '../../utils/anthropicClient.js';

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

1. ENHANCED_DESCRIPTION: Write a detailed, strategic description of this funding opportunity. Summarize what it is, why it's important, who qualifies, and what kinds of projects are eligible. Then provide 2–3 short use case examples showing how our clients—such as cities, school districts, or state facilities—could take advantage of the opportunity. Focus on narrative clarity and practical insight, not boilerplate language.

2. ACTIONABLE_SUMMARY: Write an actionable summary of this funding opportunity for a sales team. Focus on what the opportunity is about, who can apply, what types of projects are eligible, and whether this is relevant to our company or client types. Keep it concise, focused, and framed to help a sales rep quickly assess whether to pursue it.

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

For each opportunity, return the COMPLETE opportunity object with all original data plus your analysis enhancements. Use the opportunityAnalysis schema format.`;

  // Use structured schema-based response
  const response = await anthropic.callWithSchema(
    prompt,
    schemas.opportunityAnalysis,
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
    
    // LLM returns complete opportunity objects with proper scoring via schema
    // No need for additional processing since schema ensures correct format
    console.log(`[AnalysisAgent] ✅ Enhanced ${analysisResults.length} opportunities`);
    return analysisResults;
    
  } catch (schemaError) {
    console.error(`[AnalysisAgent] ❌ Failed to process structured AI response:`, schemaError);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Return original opportunities with default analysis if parsing fails
    return opportunities.map(opportunity => ({
      ...opportunity,
      // Add missing analysis fields with defaults
      enhancedDescription: opportunity.description || 'No description available',
      actionableSummary: `${opportunity.title} - Analysis failed, requires manual review`,
      scoring: getDefaultScoring(),
      relevanceReasoning: 'AI analysis failed - requires manual review',
      concerns: ['AI analysis failed']
    }));
  }
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