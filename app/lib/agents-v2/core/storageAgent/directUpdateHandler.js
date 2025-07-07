/**
 * DirectUpdateHandler V2
 * 
 * Handles direct database updates for duplicate opportunities with changes.
 * Updates only critical fields with null protection, bypassing Analysis/Filter stages.
 * 
 * Used by ProcessCoordinatorV2 to process "opportunitiesToUpdate" results from
 * EarlyDuplicateDetector without expensive LLM processing.
 * 
 * Key Features:
 * - Updates only the 6 critical fields (title, funding amounts, dates)
 * - Null protection (never overwrite existing data with null)
 * - Batch processing for efficiency
 * - Detailed logging and metrics
 * 
 * Exports: updateDuplicateOpportunities(updateBatch, supabase)
 */

/**
 * Updates duplicate opportunities with critical field changes
 * @param {Array} updateBatch - Array of {apiRecord, dbRecord, reason} objects
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Object>} - Update results and metrics
 */
export async function updateDuplicateOpportunities(updateBatch, supabase) {
  console.log(`[DirectUpdateHandler] 🔄 Processing ${updateBatch.length} duplicate updates`);
  
  const startTime = Date.now();
  const results = {
    successful: [],
    failed: [],
    skipped: []
  };
  
  if (updateBatch.length === 0) {
    console.log(`[DirectUpdateHandler] ℹ️ No updates to process`);
    return createEmptyUpdateResult();
  }
  
  try {
    for (const update of updateBatch) {
      const result = await updateSingleOpportunity(update, supabase);
      
      switch (result.status) {
        case 'success':
          results.successful.push(result);
          break;
        case 'failed':
          results.failed.push(result);
          break;
        case 'skipped':
          results.skipped.push(result);
          break;
      }
    }
    
    const executionTime = Date.now() - startTime;
    console.log(`[DirectUpdateHandler] ✅ Update completed in ${executionTime}ms`);
    console.log(`[DirectUpdateHandler] 📊 Results: ${results.successful.length} successful, ${results.failed.length} failed, ${results.skipped.length} skipped`);
    
    return {
      ...results,
      metrics: {
        totalProcessed: updateBatch.length,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        executionTime
      }
    };
    
  } catch (error) {
    console.error(`[DirectUpdateHandler] ❌ Critical error during batch update:`, error);
    throw error;
  }
}

/**
 * Updates a single opportunity with critical field changes
 * @param {Object} update - {apiRecord, dbRecord, reason} object
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Object>} - Update result
 */
async function updateSingleOpportunity(update, supabase) {
  const { apiRecord, dbRecord, reason } = update;
  
  try {
    // Prepare update data with only critical fields
    const updateData = prepareCriticalFieldUpdate(dbRecord, apiRecord);
    
    if (Object.keys(updateData).length === 0) {
      console.log(`[DirectUpdateHandler] ⏭️ No valid updates for: ${apiRecord.title || apiRecord.id}`);
      return {
        status: 'skipped',
        reason: 'no_valid_updates',
        originalReason: reason,
        opportunity: apiRecord,
        updateData: null
      };
    }
    
    // Add our tracking timestamps
    updateData.updated_at = new Date().toISOString();
    
    // Add API timestamp if available
    if (apiRecord.api_updated_at) {
      updateData.api_updated_at = apiRecord.api_updated_at;
    }
    
    console.log(`[DirectUpdateHandler] 🔄 Updating: ${apiRecord.title || apiRecord.id}`);
    console.log(`[DirectUpdateHandler] 📝 Fields: ${Object.keys(updateData).join(', ')}`);
    
    // Execute database update
    const { data, error } = await supabase
      .from('funding_opportunities')
      .update(updateData)
      .eq('id', dbRecord.id)
      .select();
    
    if (error) {
      console.error(`[DirectUpdateHandler] ❌ Database update failed:`, error);
      return {
        status: 'failed',
        error: error.message,
        originalReason: reason,
        opportunity: apiRecord,
        updateData
      };
    }
    
    console.log(`[DirectUpdateHandler] ✅ Successfully updated: ${apiRecord.title || apiRecord.id}`);
    
    return {
      status: 'success',
      originalReason: reason,
      opportunity: apiRecord,
      updateData,
      updatedRecord: data?.[0] || null
    };
    
  } catch (error) {
    console.error(`[DirectUpdateHandler] ❌ Error updating opportunity:`, error);
    return {
      status: 'failed',
      error: error.message,
      originalReason: reason,
      opportunity: apiRecord,
      updateData: null
    };
  }
}

/**
 * Prepares update data for critical fields with null protection
 * @param {Object} existingRecord - Current database record
 * @param {Object} apiRecord - New API data
 * @returns {Object} - Update data object (only non-null changes)
 */
function prepareCriticalFieldUpdate(existingRecord, apiRecord) {
  const criticalFields = [
    'title',
    'minimumAward',
    'maximumAward', 
    'totalFundingAvailable',
    'closeDate',
    'openDate'
  ];
  
  const updateData = {};
  
  for (const field of criticalFields) {
    const existingValue = existingRecord[field];
    const newValue = apiRecord[field];
    
    // Null protection: never overwrite existing data with null/undefined
    if (newValue == null || newValue === '') {
      continue;
    }
    
    // Skip if values are the same
    if (existingValue === newValue) {
      continue;
    }
    
    // Special handling for date fields
    if (field === 'closeDate' || field === 'openDate') {
      const existingDate = existingValue ? new Date(existingValue).getTime() : null;
      const newDate = new Date(newValue).getTime();
      
      if (existingDate === newDate) {
        continue;
      }
    }
    
    // Special handling for numeric fields
    if (field.includes('Award') || field === 'totalFundingAvailable') {
      const existingNum = parseFloat(existingValue) || 0;
      const newNum = parseFloat(newValue) || 0;
      
      if (existingNum === newNum) {
        continue;
      }
    }
    
    updateData[field] = newValue;
    console.log(`[DirectUpdateHandler] 📝 Field change: ${field} = "${existingValue}" → "${newValue}"`);
  }
  
  return updateData;
}

/**
 * Creates empty result structure
 * @returns {Object} - Empty update result
 */
function createEmptyUpdateResult() {
  return {
    successful: [],
    failed: [],
    skipped: [],
    metrics: {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      executionTime: 0
    }
  };
}

// Export individual functions for testing
export const directUpdateHandler = {
  updateDuplicateOpportunities,
  updateSingleOpportunity,
  prepareCriticalFieldUpdate
}; 