/**
 * Single API Handler
 * 
 * Handles making individual API calls with proper pagination and parameter handling
 */

/**
 * Make a single API call with pagination support
 */
export async function makeSingleCall(processingInstructions, page = 1, pageSize = null) {
  const { 
    apiEndpoint, 
    requestConfig, 
    queryParameters, 
    requestBody, 
    paginationConfig 
  } = processingInstructions;
  
  try {
    // Build query parameters
    let params = { ...queryParameters };
    
    // Add pagination parameters if enabled
    if (paginationConfig?.enabled) {
      const effectivePageSize = pageSize || paginationConfig.pageSize || 10;
      
      if (paginationConfig.type === 'offset') {
        const offset = (page - 1) * effectivePageSize;
        
        if (!paginationConfig.inBody) {
          // Add pagination to query parameters
          if (paginationConfig.limitParam) {
            params[paginationConfig.limitParam] = effectivePageSize;
          }
          if (paginationConfig.offsetParam) {
            params[paginationConfig.offsetParam] = offset;
          }
        }
      } else if (paginationConfig.type === 'page') {
        if (!paginationConfig.inBody) {
          // Add page-based pagination to query parameters
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
        const offset = (page - 1) * effectivePageSize;
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
      headers: requestConfig.headers || {}
    };
    
    if (body && (requestConfig.method === 'POST' || requestConfig.method === 'PUT')) {
      fetchOptions.body = JSON.stringify(body);
    }
    
    const response = await fetch(url.toString(), fetchOptions);
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return { data, response };
    
  } catch (error) {
    console.error('[DataExtractionAgent] ❌ API call failed:', error);
    throw error;
  }
} 