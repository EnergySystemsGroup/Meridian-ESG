import { schemas } from '../../utils/anthropicClient.js';
import { TAXONOMIES } from '../../../constants/taxonomies.js';

/**
 * Scoring Analysis Function - Parallel Processing Component
 * Focuses solely on systematic relevance scoring and reasoning
 * Preserves exact scoring criteria and methodology from main analysis agent
 */
export async function analyzeOpportunityScoring(opportunities, source, anthropic) {
  console.log(`[ScoringAnalyzer] 📊 Analyzing scoring for ${opportunities.length} opportunities`);
  
  try {
    // Calculate appropriate token limit using model-aware configuration
    const avgDescriptionLength = opportunities.reduce((sum, opp) => 
      sum + (opp.description?.length || 0), 0) / opportunities.length;
    
    const batchConfig = anthropic.calculateOptimalBatchSize(avgDescriptionLength, 600, 500); // Conservative tokens for scoring
    const dynamicMaxTokens = batchConfig.maxTokens;
    
    console.log(`[ScoringAnalyzer] 🎯 Using ${dynamicMaxTokens} max tokens for batch of ${opportunities.length} (${batchConfig.modelName})`);

    const prompt = `You are analyzing funding opportunities for systematic relevance scoring for an energy services business. Focus on precise, methodical scoring and clear reasoning.

CRITICAL: You MUST provide systematic scoring and relevance reasoning for EVERY opportunity. Even with minimal data, use the title and available information to make informed assessments. Work with what you have - there is always enough information for meaningful scoring.

OUR BUSINESS CONTEXT:
- Energy services company with expertise in energy and infrastructure projects
- TARGET CLIENTS: ${TAXONOMIES.TARGET_CLIENT_TYPES.join(', ')}
- PREFERRED ACTIVITIES: ${TAXONOMIES.PREFERRED_ACTIVITIES.join(', ')}
- Strong preference for opportunities with clear infrastructure focus, particularly in the energy space
- Prefer grants with significant funding potential per applicant
- Target opportunities where our energy services expertise provides competitive advantage

CRITICAL: Analyze each opportunity INDEPENDENTLY using the business context above. Do not let details from one opportunity influence scoring of another.

OPPORTUNITIES FOR SCORING ANALYSIS:
${opportunities.map((opp, index) => `
OPPORTUNITY ${index + 1}:
ID: ${opp.id}
Title: ${opp.title}
Description: ${opp.description || 'No description provided'}
Funding: $${opp.totalFundingAvailable?.toLocaleString() || 'Unknown'} total, $${opp.minimumAward?.toLocaleString() || 'Unknown'} - $${opp.maximumAward?.toLocaleString() || 'Unknown'} per award
Deadline: ${opp.closeDate || 'Unknown'}
Eligible Applicants: ${opp.eligibleApplicants?.join(', ') || 'Unknown'}
Eligible Activities: ${opp.eligibleActivities?.join(', ') || 'Unknown'}
Project Types: ${opp.eligibleProjectTypes?.join(', ') || 'Unknown'}
Locations: ${opp.eligibleLocations?.join(', ') || 'Unknown'}
Status: ${opp.status || 'Unknown'}
Funding Type: ${opp.fundingType || 'Unknown'}
`).join('\n\n')}

For each opportunity, provide SYSTEMATIC_SCORING using these exact criteria:

1. clientRelevance (0-3): Based on "Eligible Applicants" field
   • 3 = Eligible applicants substantially match our target client types (${TAXONOMIES.TARGET_CLIENT_TYPES.join(', ')}) OR include similar government entities like State Agencies, Public Agencies, Regional Authorities
   • 2 = Eligible applicants include government entities (state, local, municipal), large businesses, or public sector organizations  
   • 1 = Eligible applicants include small and medium businesses, nonprofits serving public sector
   • 0 = Eligible applicants are only individuals, homeowners, or very narrow/restricted applicant pools

2. projectRelevance (0-3): Based on "Eligible Activities" field (prioritize activities over broad project types)
   • 3 = Eligible activities substantially match our preferred activities (${TAXONOMIES.PREFERRED_ACTIVITIES.join(', ')})
   • 2 = Eligible activities involve infrastructure upgrades, construction, or building improvements that could incorporate energy components
   • 1 = Eligible activities relate to facility improvements, equipment installation, or infrastructure projects  
   • 0 = Activities are purely non-infrastructure (research, planning, training, social services, etc.)

3. fundingAttractiveness (0-3): Based on the "Funding:" line for each opportunity
   • 3 = Exceptional: Shows $50M+ total funding OR $5M+ maximum per award
   • 2 = Strong: Shows $25M+ total funding OR $2M+ maximum per award  
   • 1 = Moderate: Shows $10M+ total funding OR $1M+ maximum per award, OR unknown amounts
   • 0 = Low: Less than $10M total funding AND less than $1M maximum per award

4. fundingType (0-1): Based on funding mechanism
   • 1 = Grant (preferred)
   • 0 = Loan, tax credit, other mechanism, or unknown

CALCULATE TOTAL: overallScore = clientRelevance + projectRelevance + fundingAttractiveness + fundingType

PROVIDE RELEVANCE REASONING: Using the exact numerical scores you assigned above, justify each score by referencing which scoring criteria tier each opportunity falls into. Work with all available data - even if some fields are marked "Unknown", use the title, description, and other available information to make informed assessments. Format as a single string:

CLIENT RELEVANCE ({your clientRelevance score}/3): Quote: "{exact eligible applicants text}" → Criteria Analysis: {explain which tier (0, 1, 2, or 3) this falls into based on the clientRelevance criteria above} → Score Justification: {confirm why your assigned score matches that tier}

PROJECT RELEVANCE ({your projectRelevance score}/3): Quote: "{exact eligible activities text}" → Criteria Analysis: {explain which tier (0, 1, 2, or 3) this falls into based on the projectRelevance criteria above} → Score Justification: {confirm why your assigned score matches that tier}

FUNDING ATTRACTIVENESS ({your fundingAttractiveness score}/3): Quote: "{exact funding amounts text}" → Criteria Analysis: {explain which tier (0, 1, 2, or 3) this falls into based on the fundingAttractiveness criteria above} → Score Justification: {confirm why your assigned score matches that tier}

FUNDING TYPE ({your fundingType score}/1): Quote: "{mechanism type}" → Criteria Analysis: {explain whether this is a grant (1) or other mechanism (0) based on the fundingType criteria above} → Score Justification: {confirm why your assigned score matches that tier}

IDENTIFY CONCERNS: Any red flags, unusual requirements, or limitations to note. Flag research-only opportunities that don't involve our service capabilities.

NOTE: Research-only opportunities (academic studies, planning grants without implementation) should receive low projectRelevance scores.

CRITICAL: You MUST analyze and return ALL ${opportunities.length} opportunities listed above. Do not skip any opportunities. Every opportunity has enough information for meaningful scoring analysis - extract insights from titles, descriptions, funding amounts, and categories. Be creative and confident in your analysis.

CRITICAL JSON FORMATTING RULES:
1. Ensure all string values are properly escaped (especially quotes and newlines)
2. Do not include any text before or after the JSON response
3. Complete the entire JSON structure - do not truncate
4. Use consistent indentation for readability
5. Double-check that all arrays and objects are properly closed`;

    // Call LLM with scoring analysis schema
    const response = await anthropic.callWithSchema(
      prompt,
      schemas.scoringAnalysis,
      {
        maxTokens: dynamicMaxTokens,
        temperature: 0.1
      }
    );

    // Debug logging to understand response structure
    console.log(`[ScoringAnalyzer] 🔍 Response structure:`, {
      hasData: !!response.data,
      dataType: typeof response.data,
      hasAnalyses: !!response.data?.analyses,
      analysesType: typeof response.data?.analyses,
      analysesLength: Array.isArray(response.data?.analyses) ? response.data.analyses.length : 'not an array'
    });

    // Extract scoring results
    let scoringResults;
    if (response.data && response.data.analyses && Array.isArray(response.data.analyses)) {
      scoringResults = response.data.analyses;
    } else if (response.data && response.data.analyses && typeof response.data.analyses === 'string') {
      // Parse JSON string if LLM returned it as a string
      try {
        scoringResults = JSON.parse(response.data.analyses);
        console.log(`[ScoringAnalyzer] 🔧 Parsed JSON string response`);
      } catch (parseError) {
        console.error(`[ScoringAnalyzer] ❌ Failed to parse JSON string:`, parseError);
        throw new Error('Failed to parse LLM JSON string response');
      }
    } else if (response.data && Array.isArray(response.data)) {
      // Fallback if data is directly an array
      scoringResults = response.data;
    } else {
      console.error(`[ScoringAnalyzer] ❌ Unexpected response structure:`, response);
      throw new Error('Invalid response structure from LLM');
    }

    console.log(`[ScoringAnalyzer] ✅ Scoring analyzed for ${scoringResults.length}/${opportunities.length} opportunities`);

    // Validate results match input count
    if (scoringResults.length !== opportunities.length) {
      console.warn(`[ScoringAnalyzer] ⚠️  Result count mismatch: expected ${opportunities.length}, got ${scoringResults.length}`);
    }

    return scoringResults;

  } catch (error) {
    console.error(`[ScoringAnalyzer] ❌ Error analyzing scoring:`, error);
    
    // Fallback: return default scoring for each opportunity
    console.log(`[ScoringAnalyzer] 🔄 Using fallback scoring`);
    return opportunities.map(opportunity => ({
      id: opportunity.id,
      scoring: {
        clientRelevance: 0,
        projectRelevance: 0,
        fundingAttractiveness: 0,
        fundingType: 0,
        overallScore: 0
      },
      relevanceReasoning: `${opportunity.title} - Scoring analysis failed, requires manual assessment`,
      concerns: ["Analysis failed - manual review required"]
    }));
  }
} 