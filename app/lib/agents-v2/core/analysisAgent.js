/**
 * AnalysisAgent V2 - Modular Agent
 * 
 * Handles content enhancement and systematic scoring of opportunities.
 * Replaces detailProcessorAgent with focused, objective scoring approach.
 * 
 * Exports: enhanceOpportunities(opportunities, source, anthropic)
 */

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
    
    return {
      opportunities: enhancedOpportunities,
      analysisMetrics,
      executionTime
    };
    
  } catch (error) {
    console.error(`[AnalysisAgent] ❌ Error enhancing opportunities:`, error);
    throw error;
  }
}

/**
 * Processes a batch of opportunities for content enhancement and scoring
 */
async function processBatch(opportunities, source, anthropic) {
  const prompt = `You are analyzing funding opportunities for an energy services business. Enhance the content and provide systematic scoring for each opportunity.

OUR BUSINESS CONTEXT:
- Energy services company serving K-12 schools, municipal/county government, state facilities
- Focus on HVAC, lighting, solar, building envelope, energy efficiency projects
- Prefer grants with $1M+ funding potential per applicant
- Target opportunities with clear energy/infrastructure focus

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

3. SYSTEMATIC_SCORING: Rate each criterion 0-10:
   - projectTypeMatch (0-3): How well project types align with energy/infrastructure
   - clientTypeMatch (0-3): How well our typical clients can apply
   - categoryMatch (0-2): Alignment with energy/infrastructure categories  
   - fundingThreshold (0-1): Does max award meet $1M+ threshold? (1=yes, 0=no)
   - fundingType (0-1): Grant preferred over loan/tax credit (1=grant, 0=other)

4. SCORING_EXPLANATION: Brief explanation of the scoring rationale

5. CONCERNS: Any red flags, unusual requirements, or limitations to note

Return as JSON array with this exact structure:
[
  {
    "opportunityIndex": 0,
    "enhancedDescription": "...",
    "actionableSummary": "...",
    "scoring": {
      "projectTypeMatch": 3,
      "clientTypeMatch": 3, 
      "categoryMatch": 2,
      "fundingThreshold": 1,
      "fundingType": 1,
      "overallScore": 10
    },
    "scoringExplanation": "...",
    "concerns": ["concern1", "concern2"],
    "fundingPerApplicant": 1000000
  }
]`;

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }]
  });
  
  const responseText = response.content[0].text;
  
  try {
    // Parse JSON response
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const analysisResults = JSON.parse(cleanedResponse);
    
    if (!Array.isArray(analysisResults)) {
      throw new Error('Response is not an array');
    }
    
    // Merge analysis results with original opportunities
    const enhancedOpportunities = opportunities.map((opportunity, index) => {
      const analysis = analysisResults.find(result => result.opportunityIndex === index);
      
      if (!analysis) {
        console.warn(`[AnalysisAgent] ⚠️ No analysis found for opportunity ${index}`);
        return {
          ...opportunity,
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
        projectTypeMatch: Math.min(3, Math.max(0, analysis.scoring?.projectTypeMatch || 0)),
        clientTypeMatch: Math.min(3, Math.max(0, analysis.scoring?.clientTypeMatch || 0)),
        categoryMatch: Math.min(2, Math.max(0, analysis.scoring?.categoryMatch || 0)),
        fundingThreshold: Math.min(1, Math.max(0, analysis.scoring?.fundingThreshold || 0)),
        fundingType: Math.min(1, Math.max(0, analysis.scoring?.fundingType || 0))
      };
      
      return {
        ...opportunity,
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
    
  } catch (parseError) {
    console.error(`[AnalysisAgent] ❌ Failed to parse AI response:`, parseError);
    console.log('Raw response:', responseText);
    
    // Return opportunities with default analysis if parsing fails
    return opportunities.map(opportunity => ({
      ...opportunity,
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
 * Calculate overall score from individual scoring components
 */
function calculateOverallScore(scoring) {
  if (!scoring) return 0;
  
  const total = (scoring.projectTypeMatch || 0) + 
                (scoring.clientTypeMatch || 0) + 
                (scoring.categoryMatch || 0) + 
                (scoring.fundingThreshold || 0) + 
                (scoring.fundingType || 0);
                
  return Math.min(10, Math.max(0, Math.round(total)));
}

/**
 * Get default scoring when analysis fails
 */
function getDefaultScoring() {
  return {
    projectTypeMatch: 0,
    clientTypeMatch: 0,
    categoryMatch: 0,
    fundingThreshold: 0,
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
    opp.scoring?.fundingThreshold === 1
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