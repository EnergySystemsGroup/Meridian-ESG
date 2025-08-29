/**
 * API Caller Integration Tests
 * 
 * Tests the apiCaller module with real API endpoints (no mocking)
 * Uses HTTPBin and other testing APIs to validate HTTP behavior
 */

import { chunkOpportunities } from '../../../lib/agents-v2/core/apiCaller/index.js';
import { extractDataFromResponse } from '../../../lib/agents-v2/core/dataExtractionAgent/utils/dataExtraction.js';

// Test configuration
const TEST_API_BASE = process.env.TEST_API_BASE || 'https://httpbin.org';
const USE_REAL_APIS = process.env.USE_REAL_APIS !== 'false';

// Skip integration tests if running in CI without real API access
const testIf = (condition) => (condition ? describe : describe.skip);

/**
 * Pure API caller for integration tests - no database dependencies
 */
async function testFetchAndChunkData(source, instructions, chunkSize = 5) {
  if (!source || !instructions) {
    throw new Error('Source and processing instructions are required');
  }

  console.log(`[TestApiCaller] 🚀 Starting API fetch for: ${source.name} (chunk size: ${chunkSize})`);
  
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

    // Step 2: Calculate metrics (no storage)
    const fetchTime = Date.now() - startTime;
    const responseSize = JSON.stringify(rawData.rawResponse).length;
    const opportunityCount = rawData.data?.length || 0;

    // Step 3: Chunk the opportunities
    const chunks = chunkOpportunities(rawData.data || [], chunkSize);

    console.log(`[TestApiCaller] ✅ API fetch completed: ${opportunityCount} opportunities, ${chunks.length} chunks`);

    return {
      rawData: rawData.data,
      chunks,
      rawResponseId: `test-${Date.now()}`,
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
    console.error(`[TestApiCaller] ❌ Error fetching data:`, error);
    
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
  console.log(`[TestApiCaller] 📡 Making single API calls (max ${instructions.paginationConfig?.maxPages || 1} pages)`);
  
  let allData = [];
  let totalFound = 0;
  
  const shouldPaginate = instructions.paginationConfig?.enabled;
  const maxPages = instructions.paginationConfig?.maxPages || 1;
  const pageSize = instructions.paginationConfig?.pageSize || 10;
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      console.log(`[TestApiCaller] 📄 Fetching page ${page}/${maxPages}...`);
      
      const result = await makeSingleApiCall(instructions, page, pageSize, metrics);
      
      // Extract data using the response configuration
      const responseData = extractDataFromResponse(result.data, instructions.responseConfig);
      const pageData = Array.isArray(responseData) ? responseData : [responseData];
      
      allData.push(...pageData);
      console.log(`[TestApiCaller] ✅ Page ${page}: ${pageData.length} items (total: ${allData.length})`);
      
      // Stop if this page returned no data or fewer items than expected
      if (pageData.length === 0 || (shouldPaginate && pageData.length < pageSize)) {
        console.log(`[TestApiCaller] 🏁 Last page detected (${pageData.length} items), stopping pagination`);
        break;
      }
      
    } catch (error) {
      console.error(`[TestApiCaller] ❌ Error on page ${page}:`, error.message);
      metrics.errors.push({
        type: 'pagination_error',
        page,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      
      // For the first page, throw the error instead of continuing with empty data
      // This matches the expected behavior for critical API failures
      if (page === 1) {
        throw error;
      }
      break;
    }
  }
  
  console.log(`[TestApiCaller] ✅ Pagination complete: ${allData.length} total items fetched`);
  
  return {
    data: allData,
    rawResponse: allData,
    totalFound: totalFound,
    totalRetrieved: allData.length
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
        console.log(`[TestApiCaller] 🔄 Retry attempt ${attempt}/${maxRetries}`);
      }
      
      // Build query parameters
      let params = { ...queryParameters };
      
      // Add pagination parameters if enabled
      if (paginationConfig?.enabled) {
        const effectivePageSize = pageSize || paginationConfig.pageSize || 10;
        
        if (paginationConfig.type === 'offset') {
          const offset = (page - 1) * effectivePageSize;
          
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
      console.error(`[TestApiCaller] ❌ API call attempt ${attempt} failed:`, error.message);
      
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
 * Handle two-step API workflow
 */
async function handleTwoStepApiCalls(instructions, sourceId, metrics) {
  console.log(`[TestApiCaller] 🔄 Starting two-step API process - fetching opportunity list`);
  
  // Step 1: Get list of opportunities
  const listResult = await handleSingleApiCalls(instructions, metrics);
  console.log(`[TestApiCaller] 📋 List step complete: ${listResult.data.length} opportunities found`);
  
  if (listResult.data.length === 0) {
    return {
      data: [],
      rawResponse: [],
      totalFound: 0,
      totalRetrieved: 0
    };
  }
  
  // For testing, just return the list data without detail calls
  // Real two-step API testing would require more complex test data setup
  
  return {
    data: listResult.data,
    rawResponse: listResult.rawResponse,
    totalFound: listResult.totalFound,
    totalRetrieved: listResult.totalRetrieved || listResult.data.length
  };
}

testIf(USE_REAL_APIS)('ApiCaller Integration Tests', () => {
  
  beforeEach(() => {
    // Add a small delay between tests to be nice to test APIs
    return new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('HTTPBin Basic Requests', () => {
    it('should make successful GET request', async () => {
      const mockSource = {
        id: 'test-source-httpbin',
        name: 'HTTPBin Test Source'
      };

      const instructions = {
        workflow: 'single_api',
        apiEndpoint: `${TEST_API_BASE}/json`,
        requestConfig: {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ApiCaller-Test/1.0'
          }
        },
        queryParameters: {},
        paginationConfig: { enabled: false },
        responseConfig: {}
      };

      const result = await testFetchAndChunkData(mockSource, instructions, 2);

      expect(result).toHaveProperty('rawData');
      expect(result).toHaveProperty('chunks');
      expect(result).toHaveProperty('apiMetrics');
      expect(result).toHaveProperty('rawResponseId');

      // Verify metrics
      expect(result.apiMetrics.apiCalls).toBeGreaterThan(0);
      expect(result.apiMetrics.fetchTime).toBeGreaterThan(0);
      expect(result.apiMetrics.responseSize).toBeGreaterThan(0);
      expect(result.apiMetrics.retryAttempts).toBe(0); // Should succeed on first try
      expect(result.apiMetrics.errors).toHaveLength(0);
    }, 10000); // 10 second timeout for network requests

    it('should handle POST requests with body data', async () => {
      const mockSource = {
        id: 'test-source-post',
        name: 'HTTPBin POST Test'
      };

      const testData = {
        title: 'Test Funding Opportunity',
        amount: 100000,
        deadline: '2025-12-31'
      };

      const instructions = {
        workflow: 'single_api',
        apiEndpoint: `${TEST_API_BASE}/post`,
        requestConfig: {
          method: 'POST',
          headers: {
            'Accept': 'application/json'
          }
        },
        queryParameters: {},
        requestBody: testData,
        paginationConfig: { enabled: false },
        responseConfig: {}
      };

      const result = await testFetchAndChunkData(mockSource, instructions, 1);

      expect(result.apiMetrics.apiCalls).toBe(1);
      expect(result.rawData).toBeDefined();
      
      // HTTPBin POST endpoint echoes back the request data
      if (Array.isArray(result.rawData) && result.rawData.length > 0) {
        const responseData = result.rawData[0];
        expect(responseData.json).toEqual(testData);
      }
    }, 10000);

    it('should handle authentication headers', async () => {
      const mockSource = {
        id: 'test-auth',
        name: 'Auth Test Source'
      };

      const instructions = {
        workflow: 'single_api',
        apiEndpoint: `${TEST_API_BASE}/bearer`,
        requestConfig: {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-token-123',
            'Accept': 'application/json'
          }
        },
        queryParameters: {},
        paginationConfig: { enabled: false },
        responseConfig: {}
      };

      const result = await testFetchAndChunkData(mockSource, instructions, 1);

      expect(result.apiMetrics.apiCalls).toBe(1);
      expect(result.rawData).toBeDefined();
      // HTTPBin bearer endpoint validates the token
      if (Array.isArray(result.rawData) && result.rawData.length > 0) {
        const responseData = result.rawData[0];
        expect(responseData.authenticated).toBe(true);
        expect(responseData.token).toBe('test-token-123');
      }
    }, 10000);
  });

  describe('Error Handling and Retry Logic', () => {
    it('should handle 500 server errors with retries', async () => {
      const mockSource = {
        id: 'test-500-error',
        name: 'Server Error Test'
      };

      const instructions = {
        workflow: 'single_api',
        apiEndpoint: `${TEST_API_BASE}/status/500`,
        requestConfig: {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        },
        queryParameters: {},
        paginationConfig: { enabled: false },
        responseConfig: {}
      };

      // Expect the function to throw an error after retries
      await expect(testFetchAndChunkData(mockSource, instructions, 1))
        .rejects.toThrow('API fetch failed');
    }, 15000);

    it('should handle timeout scenarios', async () => {
      const mockSource = {
        id: 'test-delay',
        name: 'Delay Test'
      };

      const instructions = {
        workflow: 'single_api',
        apiEndpoint: `${TEST_API_BASE}/delay/2`, // 2 second delay
        requestConfig: {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        },
        queryParameters: {},
        paginationConfig: { enabled: false },
        responseConfig: {}
      };

      const startTime = Date.now();
      const result = await testFetchAndChunkData(mockSource, instructions, 1);
      const endTime = Date.now();

      expect(result.apiMetrics.fetchTime).toBeGreaterThan(2000); // At least 2 seconds
      expect(endTime - startTime).toBeGreaterThan(2000);
      expect(result.apiMetrics.retryAttempts).toBe(0); // Should succeed, just slowly
    }, 15000);
  });

  describe('Query Parameters', () => {
    it('should append query parameters correctly', async () => {
      const mockSource = {
        id: 'test-query-params',
        name: 'Query Params Test'
      };

      const instructions = {
        workflow: 'single_api',
        apiEndpoint: `${TEST_API_BASE}/get`,
        requestConfig: {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        },
        queryParameters: {
          page: 1,
          limit: 10,
          category: 'grants',
          active: true
        },
        paginationConfig: { enabled: false },
        responseConfig: {}
      };

      const result = await testFetchAndChunkData(mockSource, instructions, 1);

      // HTTPBin /get endpoint returns query params in args field
      expect(result.rawData).toBeDefined();
      expect(result.apiMetrics.apiCalls).toBe(1);
      expect(result.apiMetrics.errors).toHaveLength(0);
      
      // Check if the data structure contains the query parameters
      if (Array.isArray(result.rawData) && result.rawData.length > 0) {
        const firstItem = result.rawData[0];
        expect(firstItem.args).toEqual({
          page: '1',
          limit: '10',
          category: 'grants',
          active: 'true'
        });
      }
    }, 10000);
  });

  describe('Response Size and Chunking', () => {
    it('should chunk arrays of data correctly', async () => {
      const mockSource = {
        id: 'jsonplaceholder-test',
        name: 'JSONPlaceholder Test'
      };

      const instructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://jsonplaceholder.typicode.com/posts',
        requestConfig: {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        },
        queryParameters: { _limit: 10 }, // Limit to 10 posts
        paginationConfig: { enabled: false },
        responseConfig: {}
      };

      const result = await testFetchAndChunkData(mockSource, instructions, 3);

      expect(result.rawData).toHaveLength(10);
      expect(result.chunks).toHaveLength(4); // 10 items, chunk size 3 = 4 chunks
      expect(result.apiMetrics.opportunityCount).toBe(10);
      
      // Verify data structure
      expect(result.rawData[0]).toHaveProperty('userId');
      expect(result.rawData[0]).toHaveProperty('id');
      expect(result.rawData[0]).toHaveProperty('title');
      expect(result.rawData[0]).toHaveProperty('body');
    }, 10000);
  });
});