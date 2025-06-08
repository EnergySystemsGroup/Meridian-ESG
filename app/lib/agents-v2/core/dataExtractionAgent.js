/**
 * DataExtractionAgent V2 - Modular Agent
 * 
 * Handles API data collection, field mapping, and taxonomy standardization.
 * Replaces apiHandlerAgent with direct processing and better error handling.
 * 
 * Features include:
 * - Two-stage filtering system (basic relevance -> detailed processing)
 * - Raw response storage with deduplication
 * - Comprehensive metrics tracking
 * - Parallel chunk processing with error isolation
 * - Second-stage detail API calls for two-step workflows
 * - Uses centralized anthropic client with proper schemas
 * 
 * Exports: extractFromSource(source, processingInstructions, anthropic)
 */

import { getAnthropicClient, schemas } from '../utils/anthropicClient.js';
import { 
  generateTaxonomyInstruction,
  generateLocationEligibilityInstruction 
} from '../../constants/taxonomies.js';
import { createSupabaseClient } from '../../supabase.js';
import crypto from 'crypto';

/**
 * Extracts and standardizes data from an API source
 * @param {Object} source - The source object
 * @param {Object} processingInstructions - Instructions from SourceOrchestrator
 * @param {Object} anthropic - Anthropic client instance (optional, will use centralized client)
 * @returns {Promise<Object>} - Extracted and standardized opportunities
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
    
    // Step 1: Make API calls and store raw response
    let rawData;
    if (processingInstructions.workflow === 'two_step_api') {
      rawData = await handleTwoStepApi(processingInstructions);
    } else {
      rawData = await handleSingleApi(processingInstructions);
    }
    
    // Store raw API response
    rawApiResponse = rawData.rawResponse;
    rawResponseId = await storeRawResponse(source.id, rawApiResponse, {
      source: source,
      processingInstructions: processingInstructions,
      timestamp: new Date().toISOString()
    });
    
    // Step 2: Extract opportunities with schema-based processing
    const extractionResult = await extractOpportunitiesWithSchema(
      rawData, 
      source, 
      anthropicClient,
      processingInstructions
    );
    
    // For two-step APIs, detailed data is already fetched in handleTwoStepApi
    // For single APIs, no detail fetching is needed
    let finalOpportunities = extractionResult.opportunities;
    let detailMetrics = rawData.detailMetrics || null;
    
    // Step 4: Add source tracking to opportunities
    const trackedOpportunities = finalOpportunities.map(opportunity => ({
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
        detailProcessing: detailMetrics
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

/**
 * Stores raw API response in database with deduplication
 */
async function storeRawResponse(sourceId, rawResponse, requestDetails) {
  const supabase = createSupabaseClient();
  
  try {
    // Generate content hash for deduplication
    let contentHash;
    if (typeof rawResponse === 'object') {
      const normalizedContent = JSON.stringify(
        rawResponse,
        Object.keys(rawResponse).sort()
      );
      contentHash = crypto
        .createHash('sha256')
        .update(normalizedContent)
        .digest('hex');
    } else {
      contentHash = crypto
        .createHash('sha256')
        .update(String(rawResponse))
        .digest('hex');
    }
    
    // Check for existing response with same hash
    const { data: existingResponse } = await supabase
      .from('api_raw_responses')
      .select('id')
      .eq('source_id', sourceId)
      .eq('content_hash', contentHash)
      .limit(1);
    
    if (existingResponse && existingResponse.length > 0) {
      console.log(`[DataExtractionAgent] 📄 Reusing existing raw response: ${existingResponse[0].id}`);
      return existingResponse[0].id;
    }
    
    // Create new raw response record
    const rawResponseId = crypto.randomUUID ? crypto.randomUUID() : 'test-' + Math.random().toString(36).substring(2, 15);
    
    const { error } = await supabase.from('api_raw_responses').insert({
      id: rawResponseId,
      source_id: sourceId,
      content: rawResponse,
      content_hash: contentHash,
      request_details: requestDetails,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    
    if (error) {
      console.error('[DataExtractionAgent] ❌ Error storing raw response:', error);
    } else {
      console.log(`[DataExtractionAgent] 💾 Stored raw response: ${rawResponseId}`);
    }
    
    return rawResponseId;
  } catch (error) {
    console.error('[DataExtractionAgent] ❌ Error in storeRawResponse:', error);
    // Return fallback ID even on error
    return crypto.randomUUID ? crypto.randomUUID() : 'test-' + Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Extract opportunities using the proper dataExtraction schema
 */
async function extractOpportunitiesWithSchema(rawData, source, anthropic, processingInstructions) {
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
  const chunkResults = await processChunksInParallel(chunks, async (chunk, chunkIndex) => {
    return await processExtractionChunk(chunk, source, anthropic, chunkIndex, chunks.length);
  }, 3); // Max 3 concurrent chunks
  
  // Combine results
  const allOpportunities = [];
  let totalProcessingTime = 0;
  
  for (const result of chunkResults) {
    if (result.opportunities) {
      allOpportunities.push(...result.opportunities);
    }
    totalProcessingTime += result.processingTime || 0;
  }
  
  console.log(`[DataExtractionAgent] ✅ Schema-based extraction complete: ${allOpportunities.length} opportunities extracted`);
  
  return {
    opportunities: allOpportunities,
    extractionMetrics: {
      totalFound: opportunities.length,
      successfullyExtracted: allOpportunities.length,
      challenges: [],
      processingTime: totalProcessingTime
    },
    totalExtracted: opportunities.length
  };
}

/**
 * Process a single chunk using the dataExtraction schema
 */
async function processExtractionChunk(chunk, source, anthropic, chunkIndex, totalChunks) {
  const chunkStartTime = Date.now();
  
  console.log(`[DataExtractionAgent] 📄 Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} opportunities)`);
  console.log(`[DataExtractionAgent] 🔍 DEBUG - Chunk size: ${JSON.stringify(chunk).length} characters`);
  
  // Build prompt for data extraction
  const taxonomyInstructions = [
    generateTaxonomyInstruction('FUNDING_TYPES', 'funding types'),
    generateTaxonomyInstruction('ELIGIBLE_APPLICANTS', 'eligible applicants'),
    generateTaxonomyInstruction('CATEGORIES', 'categories'),
    generateLocationEligibilityInstruction()
  ].join('\n\n');
  
  const prompt = `You are extracting and standardizing funding opportunities from API response data.

TAXONOMY INSTRUCTIONS:
${taxonomyInstructions}

SOURCE INFORMATION:
${JSON.stringify(source, null, 2)}

API RESPONSE DATA TO EXTRACT:
${JSON.stringify(chunk, null, 2)}

EXTRACTION REQUIREMENTS:
1. Extract each funding opportunity with accurate field mapping
2. Standardize all fields using the provided taxonomies
3. Create funding_source object with complete organization details
4. Generate relevant tags (1-3 words each) for key characteristics
5. Ensure all required fields are present and properly formatted
6. Use standardized date formats (YYYY-MM-DD)
7. Convert funding amounts to numbers
8. Map eligibility and project types to standardized taxonomies

For funding_source object, extract:
- name: Precise organization/agency name
- type: federal, state, local, utility, foundation, or other
- website: Organization website if available
- contact_email: Contact email if available  
- contact_phone: Contact phone if available
- description: Additional notes about the organization

For tags, include concise keywords like:
- Funding characteristics: "grant", "rebate", "loan"
- Focus areas: "solar", "hvac", "efficiency" 
- Target sectors: "schools", "municipalities"
- Special features: "no-match", "rural-only"

Extract all opportunities found in the data, maintaining data integrity and accuracy.`;

  console.log(`[DataExtractionAgent] 🔍 DEBUG - Prompt length: ${prompt.length} characters`);
  console.log(`[DataExtractionAgent] 🚀 Starting LLM call...`);

  try {
    // Add timeout wrapper to catch hanging calls
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('LLM call timeout after 30 seconds')), 30000);
    });
    
    const llmPromise = anthropic.callWithSchema(prompt, schemas.dataExtraction, {
      maxTokens: 4000
    });
    
    const response = await Promise.race([llmPromise, timeoutPromise]);
    
    console.log(`[DataExtractionAgent] ✅ LLM call completed successfully`);
    
    const chunkProcessingTime = Date.now() - chunkStartTime;
    const extractedCount = response.data.opportunities?.length || 0;
    const inputCount = chunk.length;
    
    console.log(`[DataExtractionAgent] ✅ Chunk ${chunkIndex + 1}: ${extractedCount}/${inputCount} opportunities extracted (${chunkProcessingTime}ms)`);
    
    // Log any reduction in opportunity count for debugging
    if (extractedCount < inputCount) {
      console.log(`[DataExtractionAgent] ⚠️ DEBUG - Reduction detected: ${inputCount} → ${extractedCount} opportunities`);
    }
    
    return {
      opportunities: response.data.opportunities || [],
      extractionMetrics: response.data.extractionMetrics || {},
      processingTime: chunkProcessingTime,
      performance: response.performance
    };
    
  } catch (error) {
    console.error(`[DataExtractionAgent] ❌ Error processing chunk ${chunkIndex + 1}:`, error);
    console.error(`[DataExtractionAgent] 📊 Error details:`, {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      chunkSize: chunk.length,
      promptLength: prompt.length
    });
    
    // Return empty result on error to avoid stopping other chunks
    return {
      opportunities: [],
      extractionMetrics: {
        totalFound: 0,
        successfullyExtracted: 0,
        challenges: [`Chunk processing error: ${error.message}`]
      },
      processingTime: Date.now() - chunkStartTime,
      error: error.message
    };
  }
}

/**
 * Fetches detailed information for filtered opportunities (two-step API)
 */
async function fetchDetailedInformation(filteredOpportunities, source, processingInstructions, anthropic) {
  const startTime = Date.now();
  const detailConfig = processingInstructions.detailConfig;
  
  if (!detailConfig?.enabled) {
    return {
      opportunities: filteredOpportunities,
      metrics: { enabled: false }
    };
  }
  
  console.log(`[DataExtractionAgent] 🔍 Fetching details for ${filteredOpportunities.length} opportunities`);
  
  const detailedOpportunities = [];
  const detailMetrics = {
    totalRequested: filteredOpportunities.length,
    successfulCalls: 0,
    failedCalls: 0,
    errors: [],
    averageResponseTime: 0,
    totalResponseTime: 0
  };
  
  const responseTimes = [];
  
  for (const opportunity of filteredOpportunities) {
    if (!opportunity.id) {
      console.warn(`[DataExtractionAgent] ⚠️ Skipping opportunity without ID: ${opportunity.title}`);
      detailMetrics.failedCalls++;
      continue;
    }
    
    try {
      const detailStartTime = Date.now();
      
      // Build detail request with proper endpoint
      const detailInstructions = {
        ...processingInstructions,
        apiEndpoint: detailConfig.endpoint,
        requestConfig: {
          ...processingInstructions.requestConfig,
          method: detailConfig.method || 'GET'
        },
        queryParameters: {},
        requestBody: {}
      };
      
      // Add ID parameter
      if (detailConfig.method === 'POST') {
        detailInstructions.requestBody[detailConfig.idParam] = opportunity.id;
      } else {
        detailInstructions.queryParameters[detailConfig.idParam] = opportunity.id;
      }
      
      // Make detail API call
      const detailResponse = await makeSingleCall(detailInstructions);
      
      const responseTime = Date.now() - detailStartTime;
      responseTimes.push(responseTime);
      
      // Extract detail data
      let detailData = detailResponse.data;
      if (detailConfig.responseDataPath) {
        detailData = extractDataByPath(detailData, detailConfig.responseDataPath);
      }
      
      // Process detail data with LLM using proper schema
      const detailedOpportunity = await processDetailDataWithSchema(detailData, opportunity, source, anthropic);
      detailedOpportunities.push(detailedOpportunity);
      
      detailMetrics.successfulCalls++;
      console.log(`[DataExtractionAgent] ✅ Detail fetched for: ${opportunity.id} (${responseTime}ms)`);
      
    } catch (error) {
      console.error(`[DataExtractionAgent] ❌ Error fetching detail for ${opportunity.id}:`, error);
      detailMetrics.failedCalls++;
      detailMetrics.errors.push(`${opportunity.id}: ${error.message}`);
      
      // Include original opportunity even if detail fetch failed
      detailedOpportunities.push(opportunity);
    }
  }
  
  // Calculate metrics
  if (responseTimes.length > 0) {
    detailMetrics.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    detailMetrics.totalResponseTime = responseTimes.reduce((sum, time) => sum + time, 0);
  }
  
  detailMetrics.processingTime = Date.now() - startTime;
  
  console.log(`[DataExtractionAgent] ✅ Detail processing complete: ${detailMetrics.successfulCalls}/${detailMetrics.totalRequested} successful`);
  
  return {
    opportunities: detailedOpportunities,
    metrics: detailMetrics
  };
}

/**
 * Process detail data with LLM using dataExtraction schema
 */
async function processDetailDataWithSchema(detailData, baseOpportunity, source, anthropic) {
  const taxonomyInstructions = [
    generateTaxonomyInstruction('FUNDING_TYPES', 'funding types'),
    generateTaxonomyInstruction('ELIGIBLE_APPLICANTS', 'eligible applicants'), 
    generateTaxonomyInstruction('CATEGORIES', 'categories'),
    generateLocationEligibilityInstruction()
  ].join('\n\n');
  
  const prompt = `You are extracting comprehensive information from detailed funding opportunity data.

TAXONOMY INSTRUCTIONS:
${taxonomyInstructions}

BASE OPPORTUNITY (from first stage):
${JSON.stringify(baseOpportunity, null, 2)}

DETAILED API DATA:
${JSON.stringify(detailData, null, 2)}

EXTRACTION REQUIREMENTS:
Extract comprehensive information and merge with the base opportunity data. Provide:
1. Complete detailed description from the API data
2. All funding amounts (total, minimum, maximum) as numbers
3. Important dates (open, close) in YYYY-MM-DD format
4. Comprehensive eligibility criteria using standardized taxonomies
5. Complete funding_source object with all available organization details
6. Relevant tags for key characteristics (1-3 words each)
7. Standardized categories and project types using the taxonomies
8. All other available fields from the API response

Merge the detailed data with the base opportunity, prioritizing the detailed data where available but preserving any useful information from the base opportunity.`;

  try {
    const response = await anthropic.callWithSchema(prompt, schemas.dataExtraction, {
      maxTokens: 3000
    });
    
    // Return the first (and should be only) opportunity from the extraction
    if (response.data.opportunities && response.data.opportunities.length > 0) {
      return response.data.opportunities[0];
    } else {
      console.warn(`[DataExtractionAgent] ⚠️ No opportunities returned from detail processing, using base opportunity`);
      return baseOpportunity;
    }
    
  } catch (error) {
    console.error(`[DataExtractionAgent] ❌ Error processing detail data:`, error);
    // Return base opportunity on error
    return baseOpportunity;
  }
}

/**
 * Process chunks in parallel with controlled concurrency
 */
async function processChunksInParallel(chunks, processFunction, maxConcurrency = 1) {
  const results = [];
  const executing = [];
  
  for (const [index, chunk] of chunks.entries()) {
    const promise = processFunction(chunk, index).then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

/**
 * Handles single API call workflow
 */
export async function handleSingleApi(processingInstructions) {
  const paginationConfig = processingInstructions.paginationConfig;
  const shouldPaginate = paginationConfig?.enabled;
  
  if (!shouldPaginate) {
    console.log(`[DataExtractionAgent] 📡 Making single API call to: ${processingInstructions.apiEndpoint}`);
    return await makeSingleCall(processingInstructions);
  }
  
  // Handle pagination
  console.log(`[DataExtractionAgent] 📡 Making paginated API calls (max ${paginationConfig.maxPages} pages)`);
  
  // Check if original query has a total limit that should be respected
  const originalTotalLimit = processingInstructions.queryParameters?.[paginationConfig.limitParam];
  const totalLimit = originalTotalLimit ? parseInt(originalTotalLimit) : null;
  if (totalLimit) {
    console.log(`[DataExtractionAgent] 🔍 DEBUG - Total limit detected: ${totalLimit}, will stop when reached`);
  }
  
  const allData = [];
  const allRawResponses = [];
  let totalCount = 0;
  let currentPage = 0;
  let hasMorePages = true;
  let offset = 0;
  let cursor = null;
  const pageSize = paginationConfig.pageSize || 100;
  
  // Determine if pagination goes in body vs query parameters
  const paginationInBody = (paginationConfig.inBody === true || paginationConfig.paginationInBody === true);
  
  while (hasMorePages && currentPage < paginationConfig.maxPages) {
    const pageInstructions = { ...processingInstructions };
    
    // Calculate how many items we can still fetch
    const itemsFetchedSoFar = allData.length;
    const remainingItems = totalLimit ? totalLimit - itemsFetchedSoFar : null;
    
    // If we have a total limit and no remaining items, stop
    if (totalLimit && remainingItems <= 0) {
      console.log(`[DataExtractionAgent] 🛑 Total limit of ${totalLimit} reached, stopping pagination`);
      break;
    }
    
    // Calculate the limit for this page
    let currentPageLimit = pageSize;
    if (totalLimit && remainingItems < pageSize) {
      currentPageLimit = remainingItems;
      console.log(`[DataExtractionAgent] 📄 Final page: requesting ${currentPageLimit} items to reach total limit`);
    }
    
    // Calculate pagination parameters
    if (paginationConfig.type === 'offset') {
      if (paginationInBody && pageInstructions.requestBody) {
        pageInstructions.requestBody = {
          ...pageInstructions.requestBody,
          [paginationConfig.offsetParam]: offset,
          [paginationConfig.limitParam]: currentPageLimit
        };
      } else {
        pageInstructions.queryParameters = {
          ...pageInstructions.queryParameters,
          [paginationConfig.offsetParam]: offset.toString(),
          [paginationConfig.limitParam]: currentPageLimit.toString()
        };
      }
    } else if (paginationConfig.type === 'page') {
      const pageNum = currentPage + 1; // Most APIs use 1-based page numbering
      
      if (paginationInBody && pageInstructions.requestBody) {
        pageInstructions.requestBody = {
          ...pageInstructions.requestBody,
          [paginationConfig.pageParam]: pageNum,
          [paginationConfig.limitParam]: currentPageLimit
        };
      } else {
        pageInstructions.queryParameters = {
          ...pageInstructions.queryParameters,
          [paginationConfig.pageParam]: pageNum.toString(),
          [paginationConfig.limitParam]: currentPageLimit.toString()
        };
      }
    } else if (paginationConfig.type === 'cursor') {
      // For cursor-based pagination
      if (cursor) {
        if (paginationInBody && pageInstructions.requestBody) {
          pageInstructions.requestBody = {
            ...pageInstructions.requestBody,
            [paginationConfig.limitParam]: currentPageLimit,
            [paginationConfig.cursorParam]: cursor
          };
        } else {
          pageInstructions.queryParameters = {
            ...pageInstructions.queryParameters,
            [paginationConfig.cursorParam]: cursor,
            [paginationConfig.limitParam]: currentPageLimit.toString()
          };
        }
      } else {
        // First page of cursor-based pagination
        if (paginationInBody && pageInstructions.requestBody) {
          pageInstructions.requestBody = {
            ...pageInstructions.requestBody,
            [paginationConfig.limitParam]: currentPageLimit
          };
        } else {
          pageInstructions.queryParameters = {
            ...pageInstructions.queryParameters,
            [paginationConfig.limitParam]: currentPageLimit.toString()
          };
        }
      }
    }
    
    try {
      console.log(`[DataExtractionAgent] 📄 Fetching page ${currentPage + 1}/${paginationConfig.maxPages}...`);
      const pageResult = await makeSingleCall(pageInstructions);
      
      // Store raw response
      allRawResponses.push(pageResult.rawResponse);
      
      // Extract data from response
      const pageData = extractDataFromResponse(pageResult.data, processingInstructions.responseConfig);
      
      // Extract total count from first page if available
      if (currentPage === 0 && processingInstructions.responseConfig?.totalCountPath) {
        const extractedTotalCount = extractDataByPath(pageResult.data, processingInstructions.responseConfig.totalCountPath);
        if (extractedTotalCount !== undefined && extractedTotalCount !== null) {
          totalCount = extractedTotalCount;
          console.log(`[DataExtractionAgent] 📊 Total count from API: ${totalCount}`);
        }
      }
      
      if (Array.isArray(pageData) && pageData.length > 0) {
        allData.push(...pageData);
        console.log(`[DataExtractionAgent] ✅ Page ${currentPage + 1}: ${pageData.length} items (total: ${allData.length})`);
        
        // Check if we've reached the total limit
        if (totalLimit && allData.length >= totalLimit) {
          console.log(`[DataExtractionAgent] 🛑 Total limit of ${totalLimit} reached, stopping pagination`);
          break;
        }
      } else {
        console.log(`[DataExtractionAgent] 📄 Page ${currentPage + 1}: No more items, stopping pagination`);
        break; // No more data, stop pagination early
      }
      
      // Update pagination variables for next iteration
      currentPage++;
      
      if (paginationConfig.type === 'offset') {
        offset += pageData.length; // Use actual items received, not pageSize
        hasMorePages = pageData.length > 0 && (totalCount === 0 || offset < totalCount);
      } else if (paginationConfig.type === 'page') {
        hasMorePages = pageData.length > 0 && (totalCount === 0 || allData.length < totalCount);
      } else if (paginationConfig.type === 'cursor') {
        // Extract next cursor for cursor-based pagination
        if (paginationConfig.nextCursorPath) {
          cursor = extractDataByPath(pageResult.data, paginationConfig.nextCursorPath);
        } else {
          // Try common cursor property names
          cursor = pageResult.data.nextCursor || pageResult.data.next_cursor || pageResult.data.cursor;
        }
        hasMorePages = !!cursor && pageData.length > 0;
      }
      
      // Additional check: if we have a total limit, don't continue beyond it
      if (totalLimit && allData.length >= totalLimit) {
        hasMorePages = false;
      }
      
    } catch (error) {
      console.warn(`[DataExtractionAgent] ⚠️ Failed to fetch page ${currentPage + 1}:`, error.message);
      break; // Stop on error
    }
  }
  
  console.log(`[DataExtractionAgent] ✅ Pagination complete: ${allData.length} total items`);
  
  return { 
    data: allData, 
    totalFound: allData.length,
    rawResponse: allRawResponses.length === 1 ? allRawResponses[0] : allRawResponses,
    apiCallCount: allRawResponses.length,
    pagesFetched: allRawResponses.length
  };
}

async function makeSingleCall(processingInstructions) {
  const requestConfig = {
    method: processingInstructions.requestConfig.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...processingInstructions.requestConfig.headers
    }
  };
  
  // Add authentication if required
  if (processingInstructions.authMethod === 'bearer' && processingInstructions.authDetails.token) {
    requestConfig.headers.Authorization = `Bearer ${processingInstructions.authDetails.token}`;
  } else if (processingInstructions.authMethod === 'apikey' && processingInstructions.authDetails.apiKey) {
    const keyHeader = processingInstructions.authDetails.keyHeader || 'X-API-Key';
    requestConfig.headers[keyHeader] = processingInstructions.authDetails.apiKey;
  }
  
  // Add request body for POST/PUT requests
  if (processingInstructions.requestBody && ['POST', 'PUT'].includes(requestConfig.method)) {
    requestConfig.body = JSON.stringify(processingInstructions.requestBody);
  }
  
  // Build URL with query parameters
  const url = new URL(processingInstructions.apiEndpoint);
  if (processingInstructions.queryParameters) {
    Object.entries(processingInstructions.queryParameters).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  const response = await fetch(url.toString(), requestConfig);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  return { 
    data, 
    totalFound: 1,
    rawResponse: data, // Store raw response for storage
    apiCallCount: 1
  };
}

function extractDataFromResponse(data, responseConfig) {
  if (!responseConfig?.responseDataPath) {
    return Array.isArray(data) ? data : [data];
  }
  
  return extractDataByPath(data, responseConfig.responseDataPath);
}

function extractDataByPath(data, path) {
  if (!path) {
    return Array.isArray(data) ? data : [data];
  }
  
  // Navigate to the specified path (e.g., "result.records")
  const pathParts = path.split('.');
  let extractedData = data;
  
  for (const part of pathParts) {
    if (extractedData && extractedData[part] !== undefined) {
      extractedData = extractedData[part];
    } else {
      return [];
    }
  }
  
  return Array.isArray(extractedData) ? extractedData : [extractedData];
}

/**
 * Handles two-step API workflow (list then details)
 * Step 1: Gets list of opportunities with basic info and IDs
 * Step 2: Fetches detailed information for ALL opportunities immediately
 */
async function handleTwoStepApi(processingInstructions) {
  console.log(`[DataExtractionAgent] 🔄 Starting two-step API process - fetching opportunity list`);
  
  // Step 1: Get list of opportunities with IDs from the main endpoint
  const listData = await handleSingleApi({
    ...processingInstructions,
    apiEndpoint: processingInstructions.apiEndpoint // Main list endpoint
  });
  
  // For two-step APIs, extract from the raw response, not the processed data
  // Use listData.rawResponse instead of listData.data to get the original API response structure
  const rawResponse = listData.rawResponse || listData.data;
  const extractedListData = extractDataFromResponse(rawResponse, processingInstructions.responseConfig);
  console.log(`[DataExtractionAgent] 📋 List step complete: ${extractedListData?.length || 0} opportunities found`);
  
  // Step 2: Immediately fetch detailed information for ALL opportunities
  const detailConfig = processingInstructions.detailConfig;
  if (!detailConfig?.enabled) {
    console.log(`[DataExtractionAgent] ⚠️ Detail config not enabled for two-step API`);
    return {
      ...listData,
      data: extractedListData
    };
  }
  
  if (!Array.isArray(extractedListData) || extractedListData.length === 0) {
    console.log(`[DataExtractionAgent] ⚠️ No opportunities found in list data to fetch details for`);
    return {
      ...listData,
      data: extractedListData || [],
      totalFound: 0
    };
  }
  
  console.log(`[DataExtractionAgent] 🔍 Fetching details for ${extractedListData.length} opportunities`);
  
  const detailedOpportunities = [];
  const detailMetrics = {
    totalRequested: extractedListData.length,
    successfulCalls: 0,
    failedCalls: 0,
    errors: []
  };
  
  // Process each opportunity to get detailed information
  for (const opportunity of extractedListData) {
    // Extract the ID from the opportunity using the configured field
    const opportunityId = opportunity[detailConfig.idField || 'id'];
    
    if (!opportunityId) {
      console.warn(`[DataExtractionAgent] ⚠️ Skipping opportunity without ID: ${opportunity.title || 'Unknown'}`);
      detailMetrics.failedCalls++;
      continue;
    }
    
    try {
      // Build detail request
      const detailInstructions = {
        ...processingInstructions,
        apiEndpoint: detailConfig.endpoint,
        requestConfig: {
          ...processingInstructions.requestConfig,
          method: detailConfig.method || 'POST'
        },
        queryParameters: {},
        requestBody: {
          [detailConfig.idParam]: opportunityId
        }
      };
      
      // Make detail API call
      const detailResponse = await makeSingleCall(detailInstructions);
      
      // Extract detail data from response
      let detailData = detailResponse.data;
      if (detailConfig.responseDataPath) {
        detailData = extractDataByPath(detailData, detailConfig.responseDataPath);
      }
      
      detailedOpportunities.push(detailData);
      detailMetrics.successfulCalls++;
      console.log(`[DataExtractionAgent] ✅ Detail fetched for: ${opportunityId}`);
      
    } catch (error) {
      console.error(`[DataExtractionAgent] ❌ Error fetching detail for ${opportunityId}:`, error);
      detailMetrics.failedCalls++;
      detailMetrics.errors.push(`${opportunityId}: ${error.message}`);
    }
  }
  
  console.log(`[DataExtractionAgent] ✅ Detail fetching complete: ${detailMetrics.successfulCalls}/${detailMetrics.totalRequested} successful`);
  
  return {
    data: detailedOpportunities, // Return the detailed data, not the list data
    totalFound: detailedOpportunities.length,
    rawResponse: detailedOpportunities,
    apiCallCount: (listData.apiCallCount || 1) + detailMetrics.successfulCalls,
    detailMetrics
  };
}

/**
 * Splits opportunities into chunks based on token size for LLM processing
 */
function splitDataIntoChunks(data, tokenThreshold = 30000) {
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  const dataArray = Array.isArray(data) ? data : [data];

  for (const item of dataArray) {
    const itemSize = JSON.stringify(item).length;

    // If this single item exceeds threshold, it gets its own chunk
    if (itemSize > tokenThreshold) {
      // Save current chunk if it has items
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentSize = 0;
      }
      // Add oversized item as its own chunk
      chunks.push([item]);
      continue;
    }

    // If adding this item would exceed threshold, start new chunk
    if (currentSize + itemSize > tokenThreshold && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(item);
    currentSize += itemSize;
  }

  // Add final chunk if it has items
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

 