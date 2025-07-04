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
import { schemas } from '../utils/anthropicClient.js';

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
    
    // Adaptive batch sizing based on opportunity complexity
    let batchSize = 5;
    
    // Reduce batch size if opportunities have very long descriptions
    const avgDescriptionLength = opportunities.reduce((sum, opp) => 
      sum + (opp.description?.length || 0), 0) / opportunities.length;
    
    if (avgDescriptionLength > 1500) {
      batchSize = 3; // Longer descriptions = smaller batches
      console.log(`[AnalysisAgent] 📏 Reducing batch size to ${batchSize} due to long descriptions (avg: ${Math.round(avgDescriptionLength)} chars)`);
    } else if (avgDescriptionLength > 800) {
      batchSize = 4;
      console.log(`[AnalysisAgent] 📏 Using batch size ${batchSize} for medium descriptions (avg: ${Math.round(avgDescriptionLength)} chars)`);
    }
    const enhancedOpportunities = [];
    
    for (let i = 0; i < opportunities.length; i += batchSize) {
      const batch = opportunities.slice(i, i + batchSize);
      let enhancedBatch = await processBatch(batch, source, anthropic);
      
      // Check for truncation and retry with smaller batch if needed
      if (enhancedBatch.length < batch.length && batch.length > 1) {
        console.log(`[AnalysisAgent] ⚠️  Truncation detected (${enhancedBatch.length}/${batch.length}), retrying with smaller batches`);
        enhancedBatch = [];
        
        // Process truncated batch individually
        for (const singleOpp of batch) {
          const singleResult = await processBatch([singleOpp], source, anthropic);
          enhancedBatch.push(...singleResult);
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between individual calls
        }
      }
      
      enhancedOpportunities.push(...enhancedBatch);
      
      // Performance tracking and rate limiting
      const batchTime = Date.now() - startTime;
      console.log(`[AnalysisAgent] ⏱️  Batch ${Math.floor(i/batchSize) + 1} completed in ${batchTime}ms (${Math.round(batchTime/enhancedBatch.length)}ms per opportunity)`);
      
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
  console.log(`[AnalysisAgent] 🔄 Processing batch of ${opportunities.length} opportunities`);
  const prompt = `You are analyzing funding opportunities for an energy services business. Enhance the content and provide systematic scoring for each opportunity.

CRITICAL: You MUST provide enhanced description, actionable summary, and relevance reasoning for EVERY opportunity. Even with minimal data, use the title and available information to create meaningful analysis. Work with what you have - there is always enough information to provide valuable insights.

OUR BUSINESS CONTEXT:
- Energy services company with expertise in energy and infrastructure projects
- TARGET CLIENTS: ${TAXONOMIES.TARGET_CLIENT_TYPES.join(', ')}
- PREFERRED ACTIVITIES: ${TAXONOMIES.PREFERRED_ACTIVITIES.join(', ')}
- Strong preference for opportunities with clear infrastructure focus, particularly in the energy space
- Prefer grants with significant funding potential per applicant
- Target opportunities where our energy services expertise provides competitive advantage

CRITICAL: Analyze each opportunity INDEPENDENTLY using the business context above. Do not let details from one opportunity influence scoring of another.

OPPORTUNITIES TO ANALYZE:
${opportunities.map((opp, index) => `
OPPORTUNITY ${index + 1}:
Title: ${opp.title}
Description: ${opp.description || 'No description provided'}
Funding: $${opp.totalFundingAvailable?.toLocaleString() || 'Unknown'} total, $${opp.minimumAward?.toLocaleString() || 'Unknown'} - $${opp.maximumAward?.toLocaleString() || 'Unknown'} per award
Deadline: ${opp.closeDate || 'Unknown'}
Eligible Applicants: ${opp.eligibleApplicants?.join(', ') || 'Unknown'}
Eligible Activities: ${opp.eligibleActivities?.join(', ') || 'Unknown'}
Project Types: ${opp.eligibleProjectTypes?.join(', ') || 'Unknown'}
Locations: ${opp.eligibleLocations?.join(', ') || 'Unknown'}
Status: ${opp.status || 'Unknown'}
`).join('\n\n')}

For each opportunity, provide:

1. ENHANCED_DESCRIPTION: Write a detailed, strategic description of this funding opportunity. Extract insights from the title, description, and all available fields. If some details are unclear, make reasonable inferences based on the opportunity type and context. Summarize what it is, why it's important, who qualifies, and what kinds of projects are eligible. Then provide 2–3 short use case examples showing how WE could help our clients—such as cities, school districts, or state facilities—by executing projects FOR them. Focus on our role as the service provider executing work FOR clients, not clients doing work themselves. Focus on narrative clarity and practical insight, not boilerplate language.

2. ACTIONABLE_SUMMARY: Write an actionable summary of this funding opportunity for a sales team. Use all available information including title keywords, funding amounts, and eligible categories to create practical insights. Focus on what the opportunity is about, who can apply, what types of projects are eligible, and whether this is relevant to our company or client types. Emphasize our role as the service provider. Keep it concise, focused, and framed to help a sales rep quickly assess whether to pursue it.

3. SYSTEMATIC_SCORING: Rate each criterion based on the opportunity data above:

   - clientRelevance (0-3): Based on "Eligible Applicants" field
     • 3 = Eligible applicants substantially match our target client types (${TAXONOMIES.TARGET_CLIENT_TYPES.join(', ')}) OR include similar government entities like State Agencies, Public Agencies, Regional Authorities
     • 2 = Eligible applicants include government entities (state, local, municipal), large businesses, or public sector organizations  
     • 1 = Eligible applicants include small and medium businesses, nonprofits serving public sector
     • 0 = Eligible applicants are only individuals, homeowners, or very narrow/restricted applicant pools
   
   - projectRelevance (0-3): Based on "Eligible Activities" field (prioritize activities over broad project types)
     • 3 = Eligible activities substantially match our preferred activities (${TAXONOMIES.PREFERRED_ACTIVITIES.join(', ')})
     • 2 = Eligible activities involve infrastructure upgrades, construction, or building improvements that could incorporate energy components
     • 1 = Eligible activities relate to facility improvements, equipment installation, or infrastructure projects  
     • 0 = Activities are purely non-infrastructure (research, planning, training, social services, etc.)
   
   - fundingAttractiveness (0-3): Based on the "Funding:" line for each opportunity
     • 3 = Exceptional: Shows $50M+ total funding OR $5M+ maximum per award
     • 2 = Strong: Shows $25M+ total funding OR $2M+ maximum per award  
     • 1 = Moderate: Shows $10M+ total funding OR $1M+ maximum per award, OR unknown amounts
     • 0 = Low: Less than $10M total funding AND less than $1M maximum per award
   
   - fundingType (0-1): Based on funding mechanism
     • 1 = Grant (preferred)
     • 0 = Loan, tax credit, other mechanism, or unknown

4. relevanceReasoning: CRITICAL - Using the exact numerical scores you assigned in step 3 above, justify each score by referencing which scoring criteria tier from step 3 the opportunity falls into. Work with all available data - even if some fields are marked "Unknown", use the title, description, and other available information to make informed assessments. Format as a single string:

CLIENT RELEVANCE ({your clientRelevance score}/3): Quote: "{exact eligible applicants text}" → Criteria Analysis: {explain which tier (0, 1, 2, or 3) this falls into based on the clientRelevance criteria in step 3} → Score Justification: {confirm why your assigned score matches that tier}

PROJECT RELEVANCE ({your projectRelevance score}/3): Quote: "{exact eligible activities text}" → Criteria Analysis: {explain which tier (0, 1, 2, or 3) this falls into based on the projectRelevance criteria in step 3} → Score Justification: {confirm why your assigned score matches that tier}

FUNDING ATTRACTIVENESS ({your fundingAttractiveness score}/3): Quote: "{exact funding amounts text}" → Criteria Analysis: {explain which tier (0, 1, 2, or 3) this falls into based on the fundingAttractiveness criteria in step 3} → Score Justification: {confirm why your assigned score matches that tier}

FUNDING TYPE ({your fundingType score}/1): Quote: "{mechanism type}" → Criteria Analysis: {explain whether this is a grant (1) or other mechanism (0) based on the fundingType criteria in step 3} → Score Justification: {confirm why your assigned score matches that tier}

5. CONCERNS: Any red flags, unusual requirements, or limitations to note. Flag research-only opportunities that don't involve our service capabilities.

NOTE: Research-only opportunities (academic studies, planning grants without implementation) should receive low projectRelevance scores.

CRITICAL: You MUST analyze and return ALL ${opportunities.length} opportunities listed above. Do not skip any opportunities. Every opportunity has enough information for meaningful analysis - extract insights from titles, descriptions, funding amounts, and categories. Be creative and confident in your analysis. For each opportunity, return the COMPLETE opportunity object with all original data plus your analysis enhancements. Use the opportunityAnalysis schema format.`;

  // Calculate appropriate token limit based on batch size
  const tokensPerOpportunity = 1200; // Conservative estimate
  const baseTokens = 1000; // For prompt overhead
  const dynamicMaxTokens = Math.max(4000, (opportunities.length * tokensPerOpportunity) + baseTokens);
  console.log(`[AnalysisAgent] 🎯 Using ${dynamicMaxTokens} max tokens for batch of ${opportunities.length} (${tokensPerOpportunity} per opp + ${baseTokens} base)`);
  
  // Add JSON formatting instructions to reduce parsing errors
  const jsonSafePrompt = prompt + `

CRITICAL JSON FORMATTING RULES:
1. Ensure all string values are properly escaped (especially quotes and newlines)
2. Do not include any text before or after the JSON response
3. Complete the entire JSON structure - do not truncate
4. Use consistent indentation for readability
5. Double-check that all arrays and objects are properly closed`;

  // Use structured schema-based response
  const response = await anthropic.callWithSchema(
    jsonSafePrompt,
    schemas.opportunityAnalysis,
    {
      maxTokens: dynamicMaxTokens, // Dynamic based on batch size
      temperature: 0.1
    }
  );
  
  try {
    let analysisResults = response.data.opportunities;
    
    // Handle case where LLM returns stringified JSON instead of array
    if (typeof analysisResults === 'string') {
      console.log(`[AnalysisAgent] 🔧 LLM returned stringified JSON, parsing...`);
      try {
        // Clean up potential formatting issues in the JSON string
        let cleanedJson = analysisResults.trim();
        
        // Remove any trailing characters after the closing bracket
        const lastBracket = cleanedJson.lastIndexOf(']');
        if (lastBracket !== -1) {
          cleanedJson = cleanedJson.substring(0, lastBracket + 1);
        }
        
        analysisResults = JSON.parse(cleanedJson);
      } catch (parseError) {
        console.error(`[AnalysisAgent] JSON parsing failed at position ${parseError.message}`);
        console.error(`[AnalysisAgent] JSON snippet around error:`, analysisResults.substring(Math.max(0, 4530), 4550));
        throw new Error(`Failed to parse stringified JSON: ${parseError.message}`);
      }
    }
    
    if (!Array.isArray(analysisResults)) {
      throw new Error(`Response opportunities is not an array, got: ${typeof analysisResults}`);
    }
    
    // Debug: Check if we got the expected number of results
    console.log(`[AnalysisAgent] 📊 Batch input: ${opportunities.length} opportunities, LLM output: ${analysisResults.length} opportunities`);
    if (analysisResults.length !== opportunities.length) {
      console.warn(`[AnalysisAgent] ⚠️  Mismatch! Expected ${opportunities.length} opportunities, got ${analysisResults.length}`);
    }
    
    // Debug: Check for incomplete analysis within the batch
    const incompleteOps = analysisResults.filter(opp => {
      const hasDescription = opp.enhancedDescription && 
                            typeof opp.enhancedDescription === 'string' && 
                            opp.enhancedDescription !== 'No enhanced description available' &&
                            opp.enhancedDescription.length > 50; // Ensure substantial content
      const hasSummary = opp.actionableSummary && 
                        typeof opp.actionableSummary === 'string' && 
                        opp.actionableSummary !== 'No actionable summary available' &&
                        opp.actionableSummary.length > 30;
      const hasReasoning = opp.relevanceReasoning && 
                          typeof opp.relevanceReasoning === 'string' && 
                          opp.relevanceReasoning !== 'No explanation available' &&
                          opp.relevanceReasoning.length > 50;
      const hasScoring = opp.scoring && typeof opp.scoring.overallScore === 'number';
      
      return !hasDescription || !hasSummary || !hasReasoning || !hasScoring;
    });
    
          if (incompleteOps.length > 0) {
        console.warn(`[AnalysisAgent] ⚠️  Found ${incompleteOps.length} opportunities with incomplete analysis:`);
        incompleteOps.forEach(opp => {
          const descLen = typeof opp.enhancedDescription === 'string' ? opp.enhancedDescription.length : 0;
          const summLen = typeof opp.actionableSummary === 'string' ? opp.actionableSummary.length : 0;
          const reasLen = typeof opp.relevanceReasoning === 'string' ? opp.relevanceReasoning.length : 0;
          const scor = typeof opp.scoring?.overallScore === 'number' ? opp.scoring.overallScore : 'N/A';
          console.warn(`   - "${opp.title.substring(0, 30)}...": desc(${descLen}) summ(${summLen}) reas(${reasLen}) score=${scor}`);
        });
      }
    
    // LLM returns complete opportunity objects with proper scoring via schema
    // No need for additional processing since schema ensures correct format
    console.log(`[AnalysisAgent] ✅ Enhanced ${analysisResults.length} opportunities`);
    return analysisResults;
    
  } catch (schemaError) {
    console.error(`[AnalysisAgent] ❌ Failed to process structured AI response:`, schemaError);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Return original opportunities with complete default analysis if parsing fails
    return opportunities.map(opportunity => ({
      ...opportunity,
      // Add missing analysis fields with defaults to ensure complete structure
      enhancedDescription: opportunity.description || 'Description not available - analysis failed',
      actionableSummary: `${opportunity.title} - Analysis failed, requires manual review`,
      scoring: {
        clientRelevance: 0,
        projectRelevance: 0, 
        fundingAttractiveness: 0,
        fundingType: 0,
        overallScore: 0
      },
      relevanceReasoning: 'Analysis failed - manual review required',
      concerns: ['Analysis failed due to technical error']
    }));
  }
}

/**
 * Get default scoring when analysis fails
 */
function getDefaultScoring() {
  return {
    clientRelevance: 0,
    projectRelevance: 0,
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