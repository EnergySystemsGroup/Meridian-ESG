import { schemas } from '../../utils/anthropicClient.js';
import { PIPELINE_MODELS } from '../../utils/modelConfigs.js';
import { TAXONOMIES } from '../../../constants/taxonomies.js';

/**
 * Content Enhancement Function - Parallel Processing Component
 * Focuses solely on generating enhanced descriptions and actionable summaries
 * Preserves exact business context and prompt quality from main analysis agent
 */
export async function enhanceOpportunityContent(opportunities, source, anthropic, scoringResults = []) {
  console.log(`[ContentEnhancer] 🎨 Enhancing content for ${opportunities.length} opportunities`);
  
  try {
    // Calculate appropriate token limit using model-aware configuration
    const avgDescriptionLength = opportunities.reduce((sum, opp) => 
      sum + (opp.description?.length || 0), 0) / opportunities.length;
    
    const batchConfig = anthropic.calculateOptimalBatchSize(avgDescriptionLength);
    const dynamicMaxTokens = batchConfig.maxTokens;
    
    console.log(`[ContentEnhancer] 🎯 Using ${dynamicMaxTokens} max tokens for batch of ${opportunities.length} (${batchConfig.modelName})`);

    // Build scoring lookup for injecting deterministic context into prompt
    const scoringMap = new Map(scoringResults.map(s => [s.id, s]));
    const hasScoringContext = scoringResults.length > 0;

    const prompt = `You are enhancing content for funding opportunities for an energy services business. Focus on creating compelling, strategic descriptions and actionable summaries.

CRITICAL: You MUST provide enhanced description and actionable summary for EVERY opportunity. Even with minimal data, use the title and available information to create meaningful content. Work with what you have - there is always enough information to provide valuable insights.

OUR BUSINESS CONTEXT:
- Energy services general contractor (ESCO/GC) specializing in building systems and energy infrastructure
- We execute projects FOR clients across public and private sectors
- Client relevance is already weighted by the deterministic scoring algorithm via taxonomy tiers — do NOT re-penalize based on client type
- CORE EXPERTISE: ${TAXONOMIES.ELIGIBLE_PROJECT_TYPES.hot.slice(0, 12).join(', ')}, etc.
- FOCUS ACTIVITIES: ${TAXONOMIES.ELIGIBLE_ACTIVITIES.hot.slice(0, 8).join(', ')}, etc.
- Strong preference for implementation opportunities where we execute work FOR clients

CRITICAL: Analyze each opportunity INDEPENDENTLY using the business context above. Do not let details from one opportunity influence analysis of another.

OPPORTUNITIES FOR CONTENT ENHANCEMENT:
${opportunities.map((opp, index) => {
  const scoring = scoringMap.get(opp.id)?.scoring;
  const scoringBlock = scoring ? `
DETERMINISTIC SCORING:
- Score: ${scoring.finalScore}/10 (base: ${scoring.baseScore} x multiplier: ${scoring.activityMultiplier}x)
- Client Relevance: ${scoring.clientRelevance}/3 (${opp.eligibleApplicants?.join(', ') || 'Unknown'})
- Project Type: ${scoring.projectTypeRelevance}/3 (${opp.eligibleProjectTypes?.join(', ') || 'Unknown'})
- Funding: ${scoring.fundingAttractiveness}/3 ($${opp.totalFundingAvailable?.toLocaleString() || 'Unknown'} total, $${opp.maximumAward?.toLocaleString() || 'Unknown'} max)
- Funding Type: ${scoring.fundingType}/1 (${opp.fundingType || 'Unknown'})
- Activity Multiplier: ${scoring.activityMultiplier}x (${opp.eligibleActivities?.join(', ') || 'Unknown'})` : '';
  return `
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
Status: ${opp.status || 'Unknown'}${scoringBlock}`;
}).join('\n\n')}

For each opportunity, provide:

1. ENHANCED_DESCRIPTION: Write a detailed, strategic description of this funding opportunity. Extract insights from the title, description, and all available fields. If some details are unclear, make reasonable inferences based on the opportunity type and context. Summarize what it is, why it's important, who qualifies, and what kinds of projects are eligible. Then provide 2–3 short use case examples showing how WE could help our clients—such as cities, school districts, or state facilities—by executing projects FOR them. Focus on our role as the service provider executing work FOR clients, not clients doing work themselves. Focus on narrative clarity and practical insight, not boilerplate language.

2. ACTIONABLE_SUMMARY: Answer "What do I need to do to get this money?" using these labeled sections. Keep each to 1-2 lines max.

VERDICT: [adjusted score]/10 — [one-line: what this funds, amounts, who applies]
WHO: [eligible applicant types]
WHAT: [prevailing project types and activities — e.g. "retrofits and new construction of HVAC, lighting, building envelope." Name the action + system, not just categories]
MONEY: [expected award per applicant + funding structure quirks — loan vs grant, reimbursement, match required, etc.]
PROCESS: [competitive vs first-come, rolling vs deadline, turnaround time, application mechanics]
CRITERIA: [the specific make-or-break qualifying criteria — geographic, programmatic, technical thresholds. What tells you in 10 seconds whether to pursue or pass]
FLAGS: [gotchas, restrictions, red flags, or important reminders. Always include at least one flag — there is always something worth noting]

3. PROGRAM_OVERVIEW: Write a 2-3 sentence program overview that serves as an elevator pitch. First sentence: State what it funds, the award amount range, and who can apply. Second sentence: Highlight the unique strategic value and most compelling benefit (e.g., no match required, fast turnaround, etc.). Keep it under 75 words total. Focus on what makes this worth pursuing, not general description.

Example format: "California's rubberized pavement grant provides $375K-$750K to cities, counties, and state agencies for road resurfacing projects using recycled tire rubber. Aligns perfectly with sustainable infrastructure goals while addressing routine road maintenance needs—no cost share required."

4. PROGRAM_USE_CASES: List 3-4 specific, concrete use cases where clients would be strong candidates for this funding. Focus on real scenarios our clients face. For each use case, write one sentence that includes: the client type/situation, the specific problem they're solving, how this funding addresses it. Format as a bulleted list. Be specific—avoid generic statements.

Example:
- A school district with deteriorating asphalt playgrounds can replace them with permeable surfaces while adding green space
- A city public works department facing deferred maintenance on parking lots can modernize with sustainable materials
- A community college needing to meet MS4 permit requirements can retrofit large parking areas with drainage systems

5. APPLICATION_SUMMARY: Provide a bulleted list summary of the application process and key strategic considerations. Include as separate bullets: • Basic process steps, • Timeline from start to award, • Most important requirement or scoring factor, • Important submissions that clients must provide in their application, • One key tip for success. Keep to 4-5 bullet points. Focus on what applicants need to know to decide if they should pursue this. Avoid generic advice. Be specific to THIS program's requirements and evaluation criteria.

6. PROGRAM_INSIGHTS: Identify 2-3 important details about this program that aren't obvious from the basic requirements but could impact an applicant's decision or strategy. These might include: Important restrictions or requirements, Significant guidelines, Historical funding patterns or success factors, Technical assistance availability, Specific documentation challenges. Write as 2-3 bullet points, one sentence each. Only include genuinely useful insights, not standard requirements.

Example:
- Projects in disadvantaged communities receive automatic 10% scoring bonus and priority review
- Technical assistance includes free feasibility studies worth up to $50K through separate program
- Agencies can submit multiple applications but each requires separate community support letters

${hasScoringContext ? `7. SCORE_ADJUSTMENT (integer, -3 to +3): A deterministic algorithm already scored this opportunity by taxonomy matching, including client type weighting. Do NOT adjust for client type — that is already handled. Apply your business judgment only for things taxonomy can't capture: money not flowing through our scope, generic labels hiding non-construction work, funding dispersed too thin, niche qualifiers, opaque incentive structures, or program status issues. Use 0 if the deterministic score is already right.

8. ADJUSTMENT_REASONING (string): 3-5 sentences from ESCO/GC perspective, include final adjusted score. Example: "Scores 6.0 (det. 9.0, adj. -3). HVAC in residential housing = window units, not commercial chillers. $3M across 500 units = $6K each."` : ''}

CRITICAL: You MUST analyze and return ALL ${opportunities.length} opportunities listed above. Do not skip any opportunities. Every opportunity has enough information for meaningful content enhancement - extract insights from titles, descriptions, funding amounts, and categories. Be creative and confident in your analysis.

CRITICAL JSON FORMATTING RULES:
1. Ensure all string values are properly escaped (especially quotes and newlines)
2. Do not include any text before or after the JSON response
3. Complete the entire JSON structure - do not truncate
4. Use consistent indentation for readability
5. Double-check that all arrays and objects are properly closed`;

    // Call LLM with content enhancement schema using Sonnet for higher quality analysis
    const response = await anthropic.callWithSchema(
      prompt,
      schemas.contentEnhancement,
      {
        model: PIPELINE_MODELS.analysis,
        maxTokens: dynamicMaxTokens,
        temperature: 0.1
      }
    );

    // Debug logging to understand response structure
    console.log(`[ContentEnhancer] 🔍 Response structure:`, {
      hasData: !!response.data,
      dataType: typeof response.data,
      hasAnalyses: !!response.data?.analyses,
      analysesType: typeof response.data?.analyses,
      analysesLength: Array.isArray(response.data?.analyses) ? response.data.analyses.length : 'not an array'
    });

    // Extract content results with improved error handling
    let contentResults;
    if (response.data && response.data.analyses && Array.isArray(response.data.analyses)) {
      contentResults = response.data.analyses;
    } else if (response.data && response.data.analyses && typeof response.data.analyses === 'string') {
      // Improved JSON string parsing with cleaning
      try {
        // Clean the JSON string of common issues
        let jsonString = response.data.analyses.trim();
        
        // Remove any text before the first { or [
        const firstBracket = Math.min(
          jsonString.indexOf('{') !== -1 ? jsonString.indexOf('{') : Infinity,
          jsonString.indexOf('[') !== -1 ? jsonString.indexOf('[') : Infinity
        );
        if (firstBracket !== Infinity && firstBracket > 0) {
          jsonString = jsonString.substring(firstBracket);
        }
        
        // Advanced JSON repair for truncated responses
        if (jsonString.startsWith('[')) {
          // For array responses, try to fix incomplete structure
          if (!jsonString.endsWith(']')) {
            // Find the last complete object by looking for complete '}' followed by optional whitespace and comma
            let lastCompleteObject = -1;
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            
            for (let i = 0; i < jsonString.length; i++) {
              const char = jsonString[i];
              
              if (escapeNext) {
                escapeNext = false;
                continue;
              }
              
              if (char === '\\') {
                escapeNext = true;
                continue;
              }
              
              if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
              }
              
              if (!inString) {
                if (char === '{') {
                  braceCount++;
                } else if (char === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    // Found a complete object - check if next non-whitespace is comma or end
                    let nextPos = i + 1;
                    while (nextPos < jsonString.length && /\s/.test(jsonString[nextPos])) {
                      nextPos++;
                    }
                    if (nextPos >= jsonString.length || jsonString[nextPos] === ',' || jsonString[nextPos] === ']') {
                      lastCompleteObject = i;
                    }
                  }
                }
              }
            }
            
            if (lastCompleteObject !== -1) {
              // Truncate at last complete object and close array properly
              jsonString = jsonString.substring(0, lastCompleteObject + 1).trim() + '\n]';
              console.log(`[ContentEnhancer] 🔧 Repaired truncated JSON array at position ${lastCompleteObject}`);
            } else {
              // If no complete objects, this is too damaged
              throw new Error('JSON array too truncated to repair');
            }
          }
        } else if (jsonString.startsWith('{')) {
          // For object responses, ensure it ends properly
          if (!jsonString.endsWith('}')) {
            let lastCompleteField = jsonString.lastIndexOf(',');
            if (lastCompleteField !== -1) {
              // Remove incomplete field and close object
              jsonString = jsonString.substring(0, lastCompleteField).trim() + '\n}';
              console.log(`[ContentEnhancer] 🔧 Repaired truncated JSON object`);
            }
          }
        }
        
        contentResults = JSON.parse(jsonString);
        console.log(`[ContentEnhancer] 🔧 Successfully parsed cleaned JSON string`);
        
        // Additional validation for repaired JSON
        if (Array.isArray(contentResults) && contentResults.length < opportunities.length) {
          console.warn(`[ContentEnhancer] ⚠️  Repaired JSON has fewer results (${contentResults.length}) than expected (${opportunities.length}) - likely due to truncation`);
          throw new Error(`Repaired JSON missing results: got ${contentResults.length}, expected ${opportunities.length}`);
        }
        
      } catch (parseError) {
        console.error(`[ContentEnhancer] ❌ Failed to parse JSON string after cleaning and repair:`, parseError);
        console.error(`[ContentEnhancer] 📄 Raw response data:`, JSON.stringify(response.data.analyses).substring(0, 1000) + '...');
        console.error(`[ContentEnhancer] 📏 Response length: ${response.data.analyses.length} characters`);
        throw new Error(`Failed to parse LLM JSON response after repair: ${parseError.message}`);
      }
    } else if (response.data && Array.isArray(response.data)) {
      // Fallback if data is directly an array
      contentResults = response.data;
    } else {
      // Log unexpected structure and fail
      console.error(`[ContentEnhancer] ❌ Unexpected response structure:`, {
        hasData: !!response.data,
        dataType: typeof response.data,
        hasAnalyses: !!response.data?.analyses,
        analysesType: typeof response.data?.analyses,
        keys: response.data ? Object.keys(response.data) : 'no data'
      });
      throw new Error(`Invalid response structure from LLM: Expected analyses array or string, got ${typeof response.data?.analyses}`);
    }

    // Validate results match input count
    if (!Array.isArray(contentResults)) {
      throw new Error(`Expected array of content results, got ${typeof contentResults}`);
    }
    
    if (contentResults.length !== opportunities.length) {
      throw new Error(`Content result count mismatch: expected ${opportunities.length}, got ${contentResults.length}`);
    }

    // Validate each result has required fields
    const missingFields = contentResults.find((result, index) => 
      !result.id || !result.enhancedDescription || !result.actionableSummary
    );
    if (missingFields) {
      throw new Error(`Content result missing required fields: ${JSON.stringify(missingFields)}`);
    }

    console.log(`[ContentEnhancer] ✅ Content enhanced for ${contentResults.length}/${opportunities.length} opportunities`);
    return contentResults;

  } catch (error) {
    console.error(`[ContentEnhancer] ❌ Content enhancement failed:`, error);
    // DO NOT use fallback - let the error propagate to fail properly
    throw error;
  }
} 