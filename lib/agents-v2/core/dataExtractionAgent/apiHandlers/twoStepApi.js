/**
 * Two-Step API Handler
 * 
 * Handles the second step of two-step APIs: fetching detailed information
 * for each opportunity from the initial list
 */

import { extractDataFromResponse } from '../utils/dataExtraction.js';
import { storeRawResponse } from '../storage/index.js';

/**
 * Make detail calls for each opportunity in the list
 */
export async function makeTwoStepCalls(opportunities, processingInstructions, sourceId = null) {
  const { detailConfig } = processingInstructions;
  
  if (!detailConfig?.enabled) {
    throw new Error('Detail configuration is required for two-step API');
  }
  
  console.log(`[DataExtractionAgent] 🔍 Fetching details for ${opportunities.length} opportunities`);
  
  const detailData = [];
  const rawDetailResponses = []; // NEW: Store raw responses for debugging
  let detailCallsSuccessful = 0;
  let detailCallsFailed = 0;
  
  // Process each opportunity
  for (const opportunity of opportunities) {
    try {
      const opportunityId = opportunity[detailConfig.idField];
      if (!opportunityId) {
        console.error(`[DataExtractionAgent] ❌ No ID found for opportunity using field: ${detailConfig.idField}`);
        detailCallsFailed++;
        continue;
      }
      
      const startTime = Date.now();
      const { extractedData, rawData, requestDetails } = await fetchOpportunityDetail(opportunityId, detailConfig);
      const executionTime = Date.now() - startTime;
      
      detailData.push(extractedData);
      rawDetailResponses.push(rawData); // Store raw response
      
      // Store each detail API response individually
      if (sourceId) {
        try {
          const detailResponseId = await storeRawResponse(
            sourceId,
            rawData,
            requestDetails,
            {
              api_endpoint: detailConfig.endpoint,
              call_type: 'detail',
              execution_time_ms: executionTime,
              opportunity_count: 1
            }
          );
          console.log(`[DataExtractionAgent] 💾 Stored detail response for ${opportunityId}: ${detailResponseId}`);
        } catch (storageError) {
          console.error(`[DataExtractionAgent] ❌ Failed to store detail response for ${opportunityId}:`, storageError.message);
        }
      }
      
      detailCallsSuccessful++;
      
      console.log(`[DataExtractionAgent] ✅ Detail fetched for: ${opportunityId}`);
      
    } catch (error) {
      console.error(`[DataExtractionAgent] ❌ Failed to fetch detail for opportunity:`, error.message);
      detailCallsFailed++;
    }
  }
  
  console.log(`[DataExtractionAgent] ✅ Detail fetching complete: ${detailCallsSuccessful}/${opportunities.length} successful`);
  
  return {
    detailData,
    rawDetailResponses, // NEW: Include raw responses
    metrics: {
      detailCallsSuccessful,
      detailCallsFailed
    }
  };
}

/**
 * Fetch detailed information for a single opportunity
 */
async function fetchOpportunityDetail(opportunityId, detailConfig) {
  try {
    // Build request body or query parameters
    let requestBody = null;
    let queryParams = {};
    
    if (detailConfig.method === 'POST') {
      requestBody = {
        [detailConfig.idParam]: opportunityId
      };
    } else {
      queryParams[detailConfig.idParam] = opportunityId;
    }
    
    // Build URL
    const url = new URL(detailConfig.endpoint);
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value);
      }
    });
    
    // Build fetch options
    const fetchOptions = {
      method: detailConfig.method || 'GET',
      headers: detailConfig.headers || {}
    };
    
    if (requestBody && detailConfig.method === 'POST') {
      fetchOptions.body = JSON.stringify(requestBody);
    }
    
    // Make the request
    const response = await fetch(url.toString(), fetchOptions);
    
    if (!response.ok) {
      throw new Error(`Detail API call failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Build request details for storage
    const requestDetails = {
      url: url.toString(),
      method: detailConfig.method || 'GET',
      headers: detailConfig.headers || {},
      body: requestBody,
      opportunityId: opportunityId
    };
    
    // Extract data using detailResponseDataPath if configured
    if (detailConfig.detailResponseDataPath) {
      const extractedData = extractDataByPath(data, detailConfig.detailResponseDataPath);
      return {
        extractedData: extractedData || data,
        rawData: data,
        requestDetails: requestDetails
      };
    }
    
    return {
      extractedData: data,
      rawData: data,
      requestDetails: requestDetails
    };
    
  } catch (error) {
    console.error(`[DataExtractionAgent] ❌ Error fetching detail for ${opportunityId}:`, error);
    throw error;
  }
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