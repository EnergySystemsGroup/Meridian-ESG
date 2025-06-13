/**
 * DataExtractionAgent V2 - Modular Agent
 * 
 * Main orchestrator for API data collection, field mapping, and taxonomy standardization.
 * Replaces monolithic dataExtractionAgent with modular architecture.
 * 
 * Features:
 * - Two-stage filtering system (basic relevance -> detailed processing)
 * - Raw response storage with deduplication
 * - Comprehensive metrics tracking
 * - Parallel chunk processing with error isolation
 * - Second-stage detail API calls for two-step workflows
 * - Uses centralized anthropic client with proper schemas
 * 
 * Exports: extractFromSource(source, processingInstructions, anthropic)
 */

import { getAnthropicClient } from '../../utils/anthropicClient.js';
import { handleSingleApi, handleTwoStepApi } from './apiHandlers/index.js';
import { extractOpportunitiesWithSchema } from './extraction/index.js';
import { storeRawResponse } from './storage/index.js';

/**
 * Extracts and standardizes data from an API source
 * @param {Object} source - The source object with basic info (id, name, api_endpoint)
 * @param {Object} processingInstructions - Processing configuration from SourceOrchestrator with keys: workflow, apiEndpoint, requestConfig, queryParameters, requestBody, responseConfig, paginationConfig, detailConfig, responseMapping, authMethod, authDetails
 * @param {Object} anthropic - Anthropic client instance (optional, will use centralized client)
 * @returns {Promise<Object>} - Extracted and standardized opportunities with metrics and tracking data
 */
export async function extractFromSource(source, processingInstructions, anthropic = null) {
  // Input validation first - before accessing properties
  if (!source || !processingInstructions) {
    throw new Error('Source and processing instructions are required');
  }
  
  // Use centralized anthropic client if none provided
  const anthropicClient = anthropic || getAnthropicClient();
  
  console.log(`[DataExtractionAgent] 🔄 Starting extraction for: ${source.name}`)
  
  const startTime = Date.now()
  let rawApiResponse = null;
  let rawResponseId = null;
  
  try {
    // Step 1: Make API calls based on workflow type
    let rawData;
    if (processingInstructions.workflow === 'two_step_api') {
      rawData = await handleTwoStepApi(processingInstructions);
    } else {
      rawData = await handleSingleApi(processingInstructions);
    }
    
    // Step 2: Store raw API response
    rawApiResponse = rawData.rawResponse;
    rawResponseId = await storeRawResponse(source.id, rawApiResponse, {
      source: source,
      processingInstructions: processingInstructions,
      timestamp: new Date().toISOString()
    });
    
    // Step 3: Extract opportunities with schema-based processing
    const extractionResult = await extractOpportunitiesWithSchema(
      rawData, 
      source, 
      anthropicClient,
      processingInstructions
    );
    
    // Step 4: Add source tracking to opportunities
    const trackedOpportunities = extractionResult.opportunities.map(opportunity => ({
      ...opportunity,
      sourceId: source.id,
      sourceName: source.name,
      rawResponseId
    }));
    
    const executionTime = Math.max(1, Date.now() - startTime);
    console.log(`[DataExtractionAgent] ✅ Extraction completed in ${executionTime}ms`);
    
    return {
      opportunities: trackedOpportunities,
      extractionMetrics: {
        totalFound: rawData.totalFound || extractionResult.totalExtracted,
        successfullyExtracted: trackedOpportunities.length,
        workflow: processingInstructions.workflow,
        apiCalls: processingInstructions.workflow === 'two_step_api' ? 'multiple' : rawData.apiCallCount || 1,
        extractionProcessing: extractionResult.extractionMetrics,
        detailProcessing: rawData.detailMetrics || null
      },
      rawResponseId,
      executionTime,
      rawApiData: rawApiResponse // Add raw API data for testing/debugging
    };
    
  } catch (error) {
    console.error(`[DataExtractionAgent] ❌ Error extracting from source:`, error);
    throw error;
  }
} 