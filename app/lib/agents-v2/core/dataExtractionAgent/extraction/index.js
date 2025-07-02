/**
 * Extraction Module
 * 
 * Handles LLM-based data extraction and schema processing
 */

import { schemas } from '../../../utils/anthropicClient.js';
import { 
  generateTaxonomyInstruction,
  generateLocationEligibilityInstruction 
} from '../../../../constants/taxonomies.js';
import { splitDataIntoChunks, processChunksInParallel } from '../utils/index.js';

/**
 * Extract opportunities using the proper dataExtraction schema
 */
export async function extractOpportunitiesWithSchema(rawData, source, anthropic, processingInstructions) {
  const opportunities = Array.isArray(rawData.data) ? rawData.data : [rawData.data];
  
  if (opportunities.length === 0) {
    return {
      opportunities: [],
      extractionMetrics: {
        totalFound: 0,
        successfullyExtracted: 0,
        challenges: []
      },
      totalExtracted: 0
    };
  }
  
  console.log(`[DataExtractionAgent] 🔍 Starting schema-based extraction for ${opportunities.length} opportunities`);
  
  // Split into chunks for processing
  const chunks = splitDataIntoChunks(opportunities, 15000);
  console.log(`[DataExtractionAgent] 📦 Split into ${chunks.length} chunks`);
  
  // Process chunks with controlled concurrency
  const processFunction = (chunk, index) => processExtractionChunk(chunk, source, anthropic, index, chunks.length, processingInstructions);
  const chunkResults = await processChunksInParallel(chunks, processFunction, 1);
  
  // Combine results
  const allOpportunities = [];
  const allChallenges = [];
  let totalExtracted = 0;
  
  for (const result of chunkResults) {
    if (result.success) {
      allOpportunities.push(...result.data.opportunities);
      allChallenges.push(...(result.data.challenges || []));
      totalExtracted += result.data.opportunities.length;
    }
  }
  
  console.log(`[DataExtractionAgent] ✅ Schema-based extraction complete: ${totalExtracted} opportunities extracted`);
  
  return {
    opportunities: allOpportunities,
    extractionMetrics: {
      totalFound: opportunities.length,
      successfullyExtracted: totalExtracted,
      challenges: allChallenges
    },
    totalExtracted
  };
}

/**
 * Process a single chunk of opportunities for extraction
 */
async function processExtractionChunk(chunk, source, anthropic, chunkIndex, totalChunks, processingInstructions) {
  console.log(`[DataExtractionAgent] 📄 Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} opportunities)`);
  
  try {
    const chunkText = JSON.stringify(chunk, null, 2);
    console.log(`[DataExtractionAgent] 🔍 DEBUG - Chunk size: ${chunkText.length} characters`);
    
    // Build the extraction prompt
    const systemPrompt = buildExtractionPrompt(source, processingInstructions);
    console.log(`[DataExtractionAgent] 🔍 DEBUG - Prompt length: ${systemPrompt.length} characters`);
    
    const userPrompt = `Extract and standardize the following opportunities data:\n\n${chunkText}`;
    
    console.log(`[DataExtractionAgent] 🚀 Starting LLM call...`);
    const startTime = Date.now();
    
    // Make LLM call with proper schema using our AnthropicClient wrapper
    const extractionResult = await anthropic.callWithSchema(
      `${systemPrompt}\n\n${userPrompt}`,
      schemas.dataExtraction,
      {
        maxTokens: 8000,
        temperature: 0.1
      }
    );
    
    console.log(`[DataExtractionAgent] ✅ LLM call completed successfully`);
    
    // Extract the result from our wrapper response
    let extractedData = { opportunities: [], challenges: [] };
    
    if (extractionResult.data) {
      extractedData = extractionResult.data;
    }
    
    const executionTime = Date.now() - startTime;
    console.log(`[DataExtractionAgent] ✅ Chunk ${chunkIndex + 1}: ${extractedData.opportunities?.length || 0}/${chunk.length} opportunities extracted (${executionTime}ms)`);
    
    return {
      success: true,
      data: extractedData
    };
    
  } catch (error) {
    console.error(`[DataExtractionAgent] ❌ Error processing chunk ${chunkIndex + 1}:`, error);
    return {
      success: false,
      error: error.message,
      data: { opportunities: [], challenges: [] }
    };
  }
}

/**
 * Build the extraction prompt with taxonomies and response mapping
 */
function buildExtractionPrompt(source, processingInstructions) {
  // Generate taxonomy instructions for each field
  const projectTypesInstruction = generateTaxonomyInstruction('ELIGIBLE_PROJECT_TYPES', 'eligible project types');
  const applicantsInstruction = generateTaxonomyInstruction('ELIGIBLE_APPLICANTS', 'eligible applicants');
  const categoriesInstruction = generateTaxonomyInstruction('CATEGORIES', 'funding categories');
  const fundingTypesInstruction = generateTaxonomyInstruction('FUNDING_TYPES', 'funding types');
  const locationInstructions = generateLocationEligibilityInstruction();
  
  // Build response mapping guidance if available
  let responseMappingGuidance = '';
  if (processingInstructions?.responseMapping && Object.keys(processingInstructions.responseMapping).length > 0) {
    const mappings = Object.entries(processingInstructions.responseMapping)
      .filter(([key, value]) => value && value.trim())
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
    
    if (mappings) {
      responseMappingGuidance = `
RESPONSE MAPPING GUIDANCE:
The following field mappings have been configured for this source:
${mappings}

Use these mappings as guidance for where to find specific information in the API response data.`;
    }
  }
  
  return `You are an expert data extraction agent. Extract funding opportunities from API response data and standardize them according to our schema.

KEY REQUIREMENTS:
- Extract ALL opportunities from the provided data
- Use intelligent field extraction from ANY available fields including structured fields, descriptions, summaries, and narrative text
- Extract funding amounts from wherever they appear - dedicated funding fields, descriptions, or program summaries
- If funding amounts are mentioned in text, parse and extract them intelligently
- Ensure all required fields are present and properly formatted
- Apply proper taxonomies for consistent categorization

SOURCE INFORMATION:
- Source: ${source.name}
- Type: ${source.type || 'Unknown'}
- Organization: ${source.organization || 'Unknown'}

${responseMappingGuidance}

COMPREHENSIVE DESCRIPTION EXTRACTION STRATEGY:
For the 'description' field, provide the most complete and comprehensive description possible by:

1. SCAN FOR ALL DESCRIPTIVE FIELDS throughout the entire API response including (but not limited to):
   description, summary, abstract, overview, programSummary, synopsis, details, backgroundInfo, programDescription, opportunityDescription, fundingDescription, projectDescription, notes, additionalInfo, remarks, commentary, guidance, applicationProcess, eligibilityCriteria, evaluationCriteria, programGoals, objectives, purpose, background, and any other fields containing narrative or descriptive content

2. CRITICAL: SCAN FOR MULTIPLE INSTANCES OF SAME FIELD NAMES:
   - The same field name may appear MULTIPLE times (e.g., description, description, synopsis, synopsis)
   - Capture EVERY occurrence, even if the field name is repeated
   - Do not assume field names are unique - each instance may contain different content
   - When you find "description" in one place, keep looking for more "description" fields elsewhere
   - When you find "synopsis" in one place, keep looking for more "synopsis" fields elsewhere
   - Scan the ENTIRE response structure, including nested objects and arrays

3. NATURAL MELDING APPROACH:
   - Combine all unique descriptive content into one flowing, natural narrative
   - Preserve ALL content verbatim - do not modify, enhance, or interpret the original text
   - Intelligently remove duplicate sentences/phrases that appear across different field instances
   - Organize content logically but let it flow naturally without forced section breaks or labels
   - Prioritize completeness - include every unique piece of descriptive information found
   - Create a coherent, comprehensive description that reads naturally

FUNDING EXTRACTION APPROACH:
1. Look for structured funding fields first (totalFunding, estimatedFunding, award amounts, etc.). Use the response mapping rules, if available.
2. If structured fields are missing or contain "N/A"/"none", extract from description text
3. Parse dollar amounts from any text that mentions funding levels, award ranges, or budget information
4. Use context clues to determine minimum, maximum, and total funding amounts
5. If no funding information is available anywhere, set funding amounts to null

TAXONOMY GUIDELINES:

${projectTypesInstruction}

${applicantsInstruction}

${categoriesInstruction}

${fundingTypesInstruction}

${locationInstructions}

Return all extracted opportunities using the dataExtraction tool.`;
} 