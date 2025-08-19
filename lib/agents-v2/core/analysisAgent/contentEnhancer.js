import { schemas } from '../../utils/anthropicClient.js';
import { TAXONOMIES } from '../../../constants/taxonomies.js';

/**
 * Content Enhancement Function - Parallel Processing Component
 * Focuses solely on generating enhanced descriptions and actionable summaries
 * Preserves exact business context and prompt quality from main analysis agent
 */
export async function enhanceOpportunityContent(opportunities, source, anthropic) {
  console.log(`[ContentEnhancer] 🎨 Enhancing content for ${opportunities.length} opportunities`);
  
  try {
    // Calculate appropriate token limit using model-aware configuration
    const avgDescriptionLength = opportunities.reduce((sum, opp) => 
      sum + (opp.description?.length || 0), 0) / opportunities.length;
    
    const batchConfig = anthropic.calculateOptimalBatchSize(avgDescriptionLength);
    const dynamicMaxTokens = batchConfig.maxTokens;
    
    console.log(`[ContentEnhancer] 🎯 Using ${dynamicMaxTokens} max tokens for batch of ${opportunities.length} (${batchConfig.modelName})`);

    const prompt = `You are enhancing content for funding opportunities for an energy services business. Focus on creating compelling, strategic descriptions and actionable summaries.

CRITICAL: You MUST provide enhanced description and actionable summary for EVERY opportunity. Even with minimal data, use the title and available information to create meaningful content. Work with what you have - there is always enough information to provide valuable insights.

OUR BUSINESS CONTEXT:
- Energy services company with expertise in energy and infrastructure projects
- TARGET CLIENTS: ${TAXONOMIES.TARGET_CLIENT_TYPES.join(', ')}
- PREFERRED ACTIVITIES: ${TAXONOMIES.PREFERRED_ACTIVITIES.join(', ')}
- Strong preference for opportunities with clear infrastructure focus, particularly in the energy space
- Prefer grants with significant funding potential per applicant
- Target opportunities where our energy services expertise provides competitive advantage

CRITICAL: Analyze each opportunity INDEPENDENTLY using the business context above. Do not let details from one opportunity influence analysis of another.

OPPORTUNITIES FOR CONTENT ENHANCEMENT:
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
`).join('\n\n')}

For each opportunity, provide:

1. ENHANCED_DESCRIPTION: Write a detailed, strategic description of this funding opportunity. Extract insights from the title, description, and all available fields. If some details are unclear, make reasonable inferences based on the opportunity type and context. Summarize what it is, why it's important, who qualifies, and what kinds of projects are eligible. Then provide 2–3 short use case examples showing how WE could help our clients—such as cities, school districts, or state facilities—by executing projects FOR them. Focus on our role as the service provider executing work FOR clients, not clients doing work themselves. Focus on narrative clarity and practical insight, not boilerplate language.

2. ACTIONABLE_SUMMARY: Write an actionable summary of this funding opportunity for a sales team. Use all available information including title keywords, funding amounts, and eligible categories to create practical insights. Focus on what the opportunity is about, who can apply, what types of projects are eligible, and whether this is relevant to our company or client types. Emphasize our role as the service provider. Keep it concise, focused, and framed to help a sales rep quickly assess whether to pursue it.

CRITICAL: You MUST analyze and return ALL ${opportunities.length} opportunities listed above. Do not skip any opportunities. Every opportunity has enough information for meaningful content enhancement - extract insights from titles, descriptions, funding amounts, and categories. Be creative and confident in your analysis.

CRITICAL JSON FORMATTING RULES:
1. Ensure all string values are properly escaped (especially quotes and newlines)
2. Do not include any text before or after the JSON response
3. Complete the entire JSON structure - do not truncate
4. Use consistent indentation for readability
5. Double-check that all arrays and objects are properly closed`;

    // Call LLM with content enhancement schema
    const response = await anthropic.callWithSchema(
      prompt,
      schemas.contentEnhancement,
      {
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