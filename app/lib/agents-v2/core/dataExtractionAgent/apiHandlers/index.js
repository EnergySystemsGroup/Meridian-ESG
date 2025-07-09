/**
 * API Handlers Module
 * 
 * Handles different API workflow types:
 * - Single API: Direct data extraction from one endpoint
 * - Two-step API: List endpoint + detail endpoint workflow
 */

import { makeSingleCall } from './singleApi.js';
import { makeTwoStepCalls } from './twoStepApi.js';
import { extractDataFromResponse } from '../utils/dataExtraction.js';

/**
 * Handle single API workflow
 */
export async function handleSingleApi(processingInstructions) {
  console.log(`[DataExtractionAgent] 📡 Making paginated API calls (max ${processingInstructions.paginationConfig?.maxPages || 1} pages)`);
  
  let allData = [];
  let totalFound = 0;
  let apiCallCount = 0;
  
  const shouldPaginate = processingInstructions.paginationConfig?.enabled;
  const maxPages = processingInstructions.paginationConfig?.maxPages || 1;
  const pageSize = processingInstructions.paginationConfig?.pageSize || 10;
  
  // Calculate total limit if we have both maxPages and pageSize
  const totalLimit = shouldPaginate ? maxPages * pageSize : null;
  if (totalLimit) {
    console.log(`[DataExtractionAgent] 🔍 DEBUG - Total limit detected: ${totalLimit}, will stop when reached`);
  }

  for (let page = 1; page <= maxPages; page++) {
    try {
      // For the final page, adjust the limit if we're close to the total limit
      let currentPageSize = pageSize;
      if (totalLimit && allData.length + pageSize > totalLimit) {
        currentPageSize = totalLimit - allData.length;
        console.log(`[DataExtractionAgent] 📄 Final page: requesting ${currentPageSize} items to reach total limit`);
      }

      console.log(`[DataExtractionAgent] 📄 Fetching page ${page}/${maxPages}...`);
      
      const result = await makeSingleCall(processingInstructions, page, currentPageSize);
      apiCallCount++;
      
      // Extract data using the response configuration
      const responseData = extractDataFromResponse(result.data, processingInstructions.responseConfig);
      const pageData = Array.isArray(responseData) ? responseData : [responseData];
      
      // Get total count on first page
      if (page === 1 && processingInstructions.responseConfig?.totalCountPath) {
        totalFound = extractDataByPath(result.data, processingInstructions.responseConfig.totalCountPath) || 0;
        console.log(`[DataExtractionAgent] 📊 Total count from API: ${totalFound}`);
      }
      
      allData.push(...pageData);
      console.log(`[DataExtractionAgent] ✅ Page ${page}: ${pageData.length} items (total: ${allData.length})`);
      
      // Stop if we've reached our total limit
      if (totalLimit && allData.length >= totalLimit) {
        console.log(`[DataExtractionAgent] 🛑 Total limit of ${totalLimit} reached, stopping pagination`);
        break;
      }
      
      // Stop if this page returned no data or fewer items than expected
      if (pageData.length === 0 || (shouldPaginate && pageData.length < pageSize)) {
        console.log(`[DataExtractionAgent] 🏁 Last page detected (${pageData.length} items), stopping pagination`);
        break;
      }
      
    } catch (error) {
      console.error(`[DataExtractionAgent] ❌ Error on page ${page}:`, error.message);
      break;
    }
  }
  
  console.log(`[DataExtractionAgent] ✅ Pagination complete: ${allData.length} total items`);
  
  return {
    data: allData,
    rawResponse: allData, // For single API, the processed data is our raw response
    totalFound: totalFound || allData.length,
    apiCallCount
  };
}

/**
 * Handle two-step API workflow
 */
export async function handleTwoStepApi(processingInstructions, sourceId = null) {
  console.log(`[DataExtractionAgent] 🔄 Starting two-step API process - fetching opportunity list`);
  
  // Step 1: Get list of opportunities
  const listResult = await handleSingleApi(processingInstructions);
  console.log(`[DataExtractionAgent] 📋 List step complete: ${listResult.data.length} opportunities found`);
  
  if (listResult.data.length === 0) {
    return {
      data: [],
      rawResponse: [],
      totalFound: 0,
      detailMetrics: { detailCallsSuccessful: 0, detailCallsFailed: 0 }
    };
  }
  
  // Step 2: Fetch detailed information
  const detailResult = await makeTwoStepCalls(listResult.data, processingInstructions, sourceId);
  
  return {
    data: detailResult.detailData,
    rawResponse: detailResult.rawDetailResponses, // Use raw detail responses for debugging
    totalFound: listResult.totalFound,
    detailMetrics: detailResult.metrics
  };
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