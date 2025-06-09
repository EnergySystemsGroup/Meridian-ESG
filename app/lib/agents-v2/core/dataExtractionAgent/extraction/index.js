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
  const processFunction = (chunk, index) => processExtractionChunk(chunk, source, anthropic, index, chunks.length);
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
async function processExtractionChunk(chunk, source, anthropic, chunkIndex, totalChunks) {
  console.log(`[DataExtractionAgent] 📄 Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} opportunities)`);
  
  try {
    const chunkText = JSON.stringify(chunk, null, 2);
    console.log(`[DataExtractionAgent] 🔍 DEBUG - Chunk size: ${chunkText.length} characters`);
    
    // Build the extraction prompt
    const systemPrompt = buildExtractionPrompt(source);
    console.log(`[DataExtractionAgent] 🔍 DEBUG - Prompt length: ${systemPrompt.length} characters`);
    
    const userPrompt = `Extract and standardize the following opportunities data:\n\n${chunkText}`;
    
    console.log(`[DataExtractionAgent] 🚀 Starting LLM call...`);
    const startTime = Date.now();
    
    // Make LLM call with proper schema using our AnthropicClient wrapper
    const extractionResult = await anthropic.callWithSchema(
      `${systemPrompt}\n\n${userPrompt}`,
      schemas.dataExtraction,
      {
        model: "claude-3-5-sonnet-20241022",
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
 * Build the extraction prompt with taxonomies
 */
function buildExtractionPrompt(source) {
  const taxonomyInstructions = generateTaxonomyInstruction();
  const locationInstructions = generateLocationEligibilityInstruction();
  
  return `You are an expert data extraction agent. Extract funding opportunities from API response data and standardize them according to our schema.

KEY REQUIREMENTS:
- Extract ALL opportunities from the provided data
- Use ONLY the structured funding fields (EstAvailFunds, EstAwards, EstAmounts for California; EstimatedTotalProgramFunding, Award.Min, Award.Max for federal sources)  
- DO NOT extract funding amounts from description text - only from dedicated funding fields
- If funding fields contain "N/A", "none", or are empty, return null for those funding values
- Ensure all required fields are present and properly formatted
- Apply proper taxonomies for consistent categorization

SOURCE INFORMATION:
- Source: ${source.name}
- Type: ${source.type}
- Organization: ${source.organization}

${taxonomyInstructions}

${locationInstructions}

CRITICAL FUNDING EXTRACTION RULES:
1. For California sources: Only use EstAvailFunds, EstAwards, EstAmounts fields
2. For Federal sources: Only use EstimatedTotalProgramFunding, Award.Min, Award.Max fields  
3. If these structured fields contain "N/A", "none", or are missing, set funding amounts to null
4. DO NOT extract dollar amounts from narrative descriptions or program summaries
5. DO NOT infer funding amounts from context or historical data

Return all extracted opportunities using the dataExtraction tool.`;
} 