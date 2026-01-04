/**
 * API Caller Module
 * 
 * Pure API calling functionality extracted from DataExtractionAgent.
 * Handles data fetching, chunking, and metrics collection without LLM processing.
 * 
 * Features:
 * - Single-step and two-step API workflows
 * - Pagination support (offset, page-based, body/query params)
 * - Raw response storage with deduplication
 * - Comprehensive metrics collection
 * - Configurable chunking for job queue processing
 * - Error handling and retry logic
 */

import { storeRawResponse } from '../dataExtractionAgent/storage/index.js';
import { extractDataFromResponse } from '../dataExtractionAgent/utils/dataExtraction.js';

/**
 * Fetch data from API and chunk it for job queue processing
 * @param {Object} source - The source object with basic info (id, name, api_endpoint)
 * @param {Object} instructions - Processing configuration from SourceOrchestrator
 * @param {number} chunkSize - Number of opportunities per chunk (default: 5)
 * @returns {Promise<Object>} - Raw data, chunks, and comprehensive metrics
 */
export async function fetchAndChunkData(source, instructions, chunkSize = 5) {
  if (!source || !instructions) {
    throw new Error('Source and processing instructions are required');
  }

  console.log(`[ApiCaller] 🚀 Starting API fetch for: ${source.name} (chunk size: ${chunkSize})`);
  
  const startTime = Date.now();
  const metrics = {
    apiCalls: 0,
    retryAttempts: 0,
    errors: []
  };

  try {
    // Step 1: Make API calls based on workflow type
    let rawData;
    if (instructions.workflow === 'two_step_api') {
      rawData = await handleTwoStepApiCalls(instructions, source.id, metrics);
    } else {
      rawData = await handleSingleApiCalls(instructions, metrics);
    }

    // Step 2: Store raw API response with metadata (optional for testing)
    const fetchTime = Date.now() - startTime;
    const responseSize = JSON.stringify(rawData.rawResponse).length;
    const opportunityCount = rawData.data?.length || 0;

    let rawResponseId = null;
    try {
      rawResponseId = await storeRawResponse(source.id, rawData.rawResponse, {
        source: source,
        processingInstructions: instructions
      }, {
        api_endpoint: instructions.apiEndpoint,
        call_type: instructions.workflow === 'two_step_api' ? 'list' : 'single',
        execution_time_ms: fetchTime,
        opportunity_count: opportunityCount
      });
    } catch (error) {
      console.warn(`[ApiCaller] ⚠️ Storage unavailable (likely in test environment): ${error.message}`);
      rawResponseId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // Step 3: Chunk the opportunities
    const chunks = chunkOpportunities(rawData.data || [], chunkSize);

    console.log(`[ApiCaller] ✅ API fetch completed: ${opportunityCount} opportunities, ${chunks.length} chunks`);

    return {
      rawData: rawData.data,
      chunks,
      rawResponseId,
      apiMetrics: {
        fetchTime,
        apiCalls: metrics.apiCalls,
        responseSize,
        opportunityCount,
        retryAttempts: metrics.retryAttempts,
        errors: metrics.errors,
        totalFound: rawData.totalFound || 0,
        totalRetrieved: rawData.totalRetrieved || opportunityCount
      }
    };

  } catch (error) {
    console.error(`[ApiCaller] ❌ Error fetching data:`, error);
    
    // Add error to metrics
    metrics.errors.push({
      type: 'fetch_error',
      message: error.message,
      timestamp: new Date().toISOString()
    });

    throw new Error(`API fetch failed: ${error.message}`);
  }
}

/**
 * Handle single API workflow with pagination
 */
async function handleSingleApiCalls(instructions, metrics) {
  console.log(`[ApiCaller] 📡 Making single API calls (max ${instructions.paginationConfig?.maxPages || 1} pages)`);
  
  let allData = [];
  let totalFound = 0;
  
  const shouldPaginate = instructions.paginationConfig?.enabled;
  const maxPages = instructions.paginationConfig?.maxPages || 1;
  const pageSize = instructions.paginationConfig?.pageSize || 10;
  
  // Calculate total limit if we have both maxPages and pageSize
  const totalLimit = shouldPaginate ? maxPages * pageSize : null;
  if (totalLimit && process.env.NODE_ENV === 'development') {
    console.log(`[ApiCaller] 🔍 DEBUG - Total limit detected: ${totalLimit}, will stop when reached`);
  }

  for (let page = 1; page <= maxPages; page++) {
    try {
      // For the final page, adjust the limit if we're close to the total limit
      let currentPageSize = pageSize;
      if (totalLimit && allData.length + pageSize > totalLimit) {
        currentPageSize = totalLimit - allData.length;
        console.log(`[ApiCaller] 📄 Final page: requesting ${currentPageSize} items to reach total limit`);
      }

      console.log(`[ApiCaller] 📄 Fetching page ${page}/${maxPages}...`);
      
      const result = await makeSingleApiCall(instructions, page, currentPageSize, metrics);
      
      // Extract data using the response configuration
      const responseData = extractDataFromResponse(result.data, instructions.responseConfig);
      const pageData = Array.isArray(responseData) ? responseData : [responseData];
      
      // Get total count on first page
      if (page === 1) {
        const totalCountPath = instructions.responseConfig?.totalCountPath;
        if (totalCountPath && totalCountPath.trim() !== '') {
          totalFound = extractDataByPath(result.data, totalCountPath);
          console.log(`[ApiCaller] 📊 Total count from API: ${totalFound} (path: ${totalCountPath})`);
        }
      }
      
      allData.push(...pageData);
      console.log(`[ApiCaller] ✅ Page ${page}: ${pageData.length} items (total: ${allData.length})`);
      
      // Stop if we've reached our total limit
      if (totalLimit && allData.length >= totalLimit) {
        console.log(`[ApiCaller] 🛑 Total limit of ${totalLimit} reached, stopping pagination`);
        break;
      }
      
      // Stop if this page returned no data or fewer items than expected
      if (pageData.length === 0 || (shouldPaginate && pageData.length < pageSize)) {
        console.log(`[ApiCaller] 🏁 Last page detected (${pageData.length} items), stopping pagination`);
        break;
      }
      
    } catch (error) {
      console.error(`[ApiCaller] ❌ Error on page ${page}:`, error.message);
      metrics.errors.push({
        type: 'pagination_error',
        page,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      break;
    }
  }
  
  console.log(`[ApiCaller] ✅ Pagination complete: ${allData.length} total items fetched, ${totalFound || 'unknown'} total available`);
  
  return {
    data: allData,
    rawResponse: allData,
    totalFound: totalFound,
    totalRetrieved: allData.length
  };
}

/**
 * Handle two-step API workflow
 */
async function handleTwoStepApiCalls(instructions, sourceId, metrics) {
  console.log(`[ApiCaller] 🔄 Starting two-step API process - fetching opportunity list`);
  
  // Step 1: Get list of opportunities
  const listResult = await handleSingleApiCalls(instructions, metrics);
  console.log(`[ApiCaller] 📋 List step complete: ${listResult.data.length} opportunities found`);
  
  if (listResult.data.length === 0) {
    return {
      data: [],
      rawResponse: [],
      totalFound: 0,
      totalRetrieved: 0
    };
  }
  
  // Step 2: Fetch detailed information
  const detailResult = await makeTwoStepDetailCalls(listResult.data, instructions, sourceId, metrics);
  
  return {
    data: detailResult.detailData,
    rawResponse: listResult.rawResponse, // Preserve original list response for storage
    totalFound: listResult.totalFound,
    totalRetrieved: listResult.totalRetrieved || listResult.data.length
  };
}

/**
 * Make a single API call with pagination support
 */
async function makeSingleApiCall(instructions, page = 1, pageSize = null, metrics) {
  const { 
    apiEndpoint, 
    requestConfig, 
    queryParameters, 
    requestBody, 
    paginationConfig 
  } = instructions;
  
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Track API call
      metrics.apiCalls++;
      if (attempt > 1) {
        metrics.retryAttempts++;
        console.log(`[ApiCaller] 🔄 Retry attempt ${attempt}/${maxRetries}`);
      }
      
      // Build query parameters
      let params = { ...queryParameters };
      
      // Add pagination parameters if enabled
      if (paginationConfig?.enabled) {
        const effectivePageSize = pageSize || paginationConfig.pageSize || 10;
        
        if (paginationConfig.type === 'offset') {
          // Support startOffset to allow starting from a specific record number
          const baseOffset = paginationConfig.startOffset || 0;
          const offset = baseOffset + (page - 1) * effectivePageSize;

          if (!paginationConfig.inBody) {
            if (paginationConfig.limitParam) {
              params[paginationConfig.limitParam] = effectivePageSize;
            }
            if (paginationConfig.offsetParam) {
              params[paginationConfig.offsetParam] = offset;
            }
          }
        } else if (paginationConfig.type === 'page') {
          if (!paginationConfig.inBody) {
            if (paginationConfig.pageParam) {
              params[paginationConfig.pageParam] = page;
            }
            if (paginationConfig.limitParam) {
              params[paginationConfig.limitParam] = effectivePageSize;
            }
          }
        }
      }
      
      // Build request body
      let body = requestBody ? { ...requestBody } : null;
      
      // Add pagination to body if configured
      if (paginationConfig?.enabled && paginationConfig.inBody) {
        const effectivePageSize = pageSize || paginationConfig.pageSize || 10;
        
        if (paginationConfig.type === 'offset') {
          // Support startOffset to allow starting from a specific record number
          const baseOffset = paginationConfig.startOffset || 0;
          const offset = baseOffset + (page - 1) * effectivePageSize;
          if (paginationConfig.limitParam) {
            body[paginationConfig.limitParam] = effectivePageSize;
          }
          if (paginationConfig.offsetParam) {
            body[paginationConfig.offsetParam] = offset;
          }
        } else if (paginationConfig.type === 'page') {
          if (paginationConfig.pageParam) {
            body[paginationConfig.pageParam] = page;
          }
          if (paginationConfig.limitParam) {
            body[paginationConfig.limitParam] = effectivePageSize;
          }
        }
      }
      
      // Build URL with query parameters
      const url = new URL(apiEndpoint);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          url.searchParams.append(key, value);
        }
      });
      
      // Make the request
      const fetchOptions = {
        method: requestConfig.method || 'GET',
        headers: { ...requestConfig.headers || {} }
      };
      
      if (body && (requestConfig.method === 'POST' || requestConfig.method === 'PUT')) {
        fetchOptions.headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(body);
      }
      
      const response = await fetch(url.toString(), fetchOptions);
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return { data, response };
      
    } catch (error) {
      lastError = error;
      console.error(`[ApiCaller] ❌ API call attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Record final error
        metrics.errors.push({
          type: 'api_call_error',
          attempts: maxRetries,
          message: error.message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Make two-step detail API calls with proper concurrency control
 */
async function makeTwoStepDetailCalls(listData, instructions, sourceId, metrics) {
  const detailConfig = instructions.detailConfig;
  if (!detailConfig || !detailConfig.enabled) {
    console.log(`[ApiCaller] ⚠️ Detail configuration not enabled for two-step API`);
    return { detailData: listData, metrics: { detailCallsSuccessful: 0, detailCallsFailed: 0 } };
  }
  
  console.log(`[ApiCaller] 🔗 Making detail calls for ${listData.length} opportunities`);
  
  let successfulCalls = 0;
  let failedCalls = 0;
  const detailData = [];
  
  // Limit concurrent detail calls to prevent rate limiting (same as original)
  const maxConcurrentDetailCalls = 6;
  
  // Process in batches to control concurrency
  for (let i = 0; i < listData.length; i += maxConcurrentDetailCalls) {
    const batch = listData.slice(i, i + maxConcurrentDetailCalls);
    
    const batchPromises = batch.map(async (opportunity) => {
      try {
        // Get opportunity ID using configured field
        const opportunityId = opportunity[detailConfig.idField];
        if (!opportunityId) {
          throw new Error(`No ID found for opportunity using field: ${detailConfig.idField}`);
        }
        
        const startTime = Date.now();
        const { extractedData, rawData } = await fetchOpportunityDetail(opportunityId, detailConfig, metrics);
        const executionTime = Date.now() - startTime;
        
        // Store individual detail response if sourceId provided
        if (sourceId && rawData) {
          await storeRawResponse(sourceId, rawData, {
            opportunity: opportunity,
            detailConfig: detailConfig
          }, {
            api_endpoint: detailConfig.endpoint,
            call_type: 'detail',
            execution_time_ms: executionTime,
            opportunity_count: 1
          });
        }
        
        // Merge original opportunity with detail data
        const mergedOpportunity = {
          ...opportunity,
          ...extractedData,
          detailResponseId: rawData ? 'stored' : null
        };
        
        successfulCalls++;
        return { success: true, data: mergedOpportunity };
        
      } catch (error) {
        console.error(`[ApiCaller] ❌ Detail call failed for opportunity:`, error.message);
        failedCalls++;
        
        metrics.errors.push({
          type: 'detail_call_error',
          message: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Return original opportunity if detail call fails
        return { success: false, data: opportunity, error: error.message };
      }
    });
    
    // Wait for batch to complete
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Process batch results
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        detailData.push(result.value.data);
      }
    });
    
    // Add small delay between batches to be nice to APIs
    if (i + maxConcurrentDetailCalls < listData.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`[ApiCaller] ✅ Detail calls complete: ${successfulCalls}/${listData.length} successful`);
  
  return {
    detailData,
    metrics: {
      detailCallsSuccessful: successfulCalls,
      detailCallsFailed: failedCalls
    }
  };
}

/**
 * Fetch detailed information for a single opportunity (extracted from original)
 */
async function fetchOpportunityDetail(opportunityId, detailConfig, metrics) {
  try {
    // Build request body or query parameters based on method
    let requestBody = null;
    let queryParams = {};
    
    if (detailConfig.method === 'POST') {
      // For POST requests, put ID in request body
      requestBody = {
        [detailConfig.idParam || 'id']: opportunityId
      };
    } else {
      // For GET requests, put ID in query params or URL path
      if (detailConfig.endpoint.includes('{id}')) {
        // URL path replacement (e.g., /api/opportunities/{id})
        // Will be handled in URL building below
      } else {
        // Query parameter (e.g., /api/opportunity?id=123)
        queryParams[detailConfig.idParam || 'id'] = opportunityId;
      }
    }
    
    // Build URL with ID replacement or query parameters
    let url;
    if (detailConfig.endpoint.includes('{id}')) {
      url = new URL(detailConfig.endpoint.replace('{id}', opportunityId));
    } else {
      url = new URL(detailConfig.endpoint);
    }
    
    // Add query parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value);
      }
    });
    
    // Build fetch options
    const fetchOptions = {
      method: detailConfig.method || 'GET',
      headers: { ...detailConfig.headers || {} }
    };
    
    // Add request body for POST requests
    if (requestBody && detailConfig.method === 'POST') {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(requestBody);
    }
    
    // Track API call
    metrics.apiCalls++;
    
    // Make the request
    const response = await fetch(url.toString(), fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Detail API call failed: ${response.status} ${response.statusText}`);
    }
    
    const rawData = await response.json();
    
    // Extract data using response configuration
    const extractedData = extractDataFromResponse(rawData, detailConfig.responseConfig);
    
    return {
      extractedData,
      rawData,
      requestDetails: {
        url: url.toString(),
        method: fetchOptions.method,
        opportunityId
      }
    };
    
  } catch (error) {
    console.error(`[ApiCaller] ❌ Error fetching opportunity detail:`, error);
    throw error;
  }
}

/**
 * Chunk opportunities into smaller arrays for job processing
 * @param {Array} opportunities - Array of opportunity objects
 * @param {number} chunkSize - Number of opportunities per chunk
 * @returns {Array<Array>} - Array of chunked opportunity arrays
 */
export function chunkOpportunities(opportunities, chunkSize = 5) {
  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return [];
  }
  
  const chunks = [];
  for (let i = 0; i < opportunities.length; i += chunkSize) {
    chunks.push(opportunities.slice(i, i + chunkSize));
  }
  
  console.log(`[ApiCaller] 📦 Chunked ${opportunities.length} opportunities into ${chunks.length} chunks of ${chunkSize}`);
  
  return chunks;
}

/**
 * Helper function to extract data by path
 */
function extractDataByPath(data, path) {
  if (!path || !data) return data;
  
  const keys = path.split('.');
  let result = data;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return null;
    }
  }
  
  return result;
}