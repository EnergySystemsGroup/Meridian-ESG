/**
 * Two-Step API Handler
 * 
 * Handles the second step of two-step APIs: fetching detailed information
 * for each opportunity from the initial list
 */

/**
 * Make detail calls for each opportunity in the list
 */
export async function makeTwoStepCalls(opportunities, processingInstructions) {
  const { detailConfig } = processingInstructions;
  
  if (!detailConfig?.enabled) {
    throw new Error('Detail configuration is required for two-step API');
  }
  
  console.log(`[DataExtractionAgent] 🔍 Fetching details for ${opportunities.length} opportunities`);
  
  const detailData = [];
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
      
      const detail = await fetchOpportunityDetail(opportunityId, detailConfig);
      detailData.push(detail);
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
    return data;
    
  } catch (error) {
    console.error(`[DataExtractionAgent] ❌ Error fetching detail for ${opportunityId}:`, error);
    throw error;
  }
} 