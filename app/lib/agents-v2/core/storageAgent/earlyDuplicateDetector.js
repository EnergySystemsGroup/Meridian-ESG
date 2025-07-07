/**
 * EarlyDuplicateDetector V2
 * 
 * Performs duplicate detection immediately after data extraction using ID + Title validation.
 * Implements efficient batch processing and 4-scenario freshness checking to maximize
 * token savings by preventing duplicates from reaching Analysis/Filter stages.
 * 
 * Key Features:
 * - Batch database queries for performance
 * - ID + Title validation approach (ID as hint, title as validator)
 * - 4-scenario freshness check decision matrix
 * - Action-oriented output for ProcessCoordinatorV2 branching
 * - Critical field comparison with null protection
 * 
 * Exports: detectDuplicates(opportunities, sourceId, supabase)
 */

import { duplicateDetector } from './duplicateDetector.js';
import { changeDetector } from './changeDetector.js';

/**
 * Main function to detect duplicates and categorize opportunities for processing
 * @param {Array} opportunities - Array of opportunities from DataExtractionAgent
 * @param {string} sourceId - API source ID
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Object>} - Categorized opportunities for action-oriented processing
 */
export async function detectDuplicates(opportunities, sourceId, supabase) {
  console.log(`[EarlyDuplicateDetector] 🔍 Processing ${opportunities.length} opportunities from source: ${sourceId}`);
  
  const startTime = Date.now();
  
  try {
    // Input validation
    if (!Array.isArray(opportunities)) {
      throw new Error('Opportunities must be an array');
    }
    
    if (!sourceId) {
      throw new Error('Source ID is required');
    }
    
    if (opportunities.length === 0) {
      console.log(`[EarlyDuplicateDetector] ℹ️ No opportunities to process`);
      return createEmptyResult();
    }
    
    // Step 1: Efficient batch fetch of potential duplicates
    const { idMap, titleMap } = await batchFetchDuplicates(opportunities, sourceId, supabase);
    
    // Step 2: Process each opportunity and categorize for action
    const result = {
      newOpportunities: [],
      opportunitiesToUpdate: [],
      opportunitiesToSkip: []
    };
    
    for (const opportunity of opportunities) {
      const categorization = await categorizeOpportunity(
        opportunity, 
        sourceId, 
        idMap, 
        titleMap
      );
      
      switch (categorization.action) {
        case 'new':
          result.newOpportunities.push(opportunity);
          break;
        case 'update':
          result.opportunitiesToUpdate.push({
            apiRecord: opportunity,
            dbRecord: categorization.existingRecord,
            reason: categorization.reason
          });
          break;
        case 'skip':
          result.opportunitiesToSkip.push({
            apiRecord: opportunity,
            existingRecord: categorization.existingRecord,
            reason: categorization.reason
          });
          break;
      }
    }
    
    const executionTime = Date.now() - startTime;
    console.log(`[EarlyDuplicateDetector] ✅ Categorization completed in ${executionTime}ms`);
    console.log(`[EarlyDuplicateDetector] 📊 Results: ${result.newOpportunities.length} new, ${result.opportunitiesToUpdate.length} to update, ${result.opportunitiesToSkip.length} to skip`);
    
    return {
      ...result,
      metrics: {
        totalProcessed: opportunities.length,
        newOpportunities: result.newOpportunities.length,
        opportunitiesToUpdate: result.opportunitiesToUpdate.length,
        opportunitiesToSkip: result.opportunitiesToSkip.length,
        executionTime
      }
    };
    
  } catch (error) {
    console.error(`[EarlyDuplicateDetector] ❌ Error during duplicate detection:`, error);
    throw error;
  }
}

/**
 * Efficiently fetches potential duplicates using batch queries
 * @param {Array} opportunities - Opportunities to check
 * @param {string} sourceId - API source ID
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Object>} - Maps for ID and title lookups
 */
async function batchFetchDuplicates(opportunities, sourceId, supabase) {
  // Collect all unique IDs and titles for batch queries
  const opportunityIds = [...new Set(
    opportunities
      .map(opp => opp.id)
      .filter(id => id && id.trim().length > 0)
  )];
  
  const titles = [...new Set(
    opportunities
      .map(opp => opp.title)
      .filter(title => title && title.trim().length >= 10) // Skip very short titles
  )];
  
  console.log(`[EarlyDuplicateDetector] 📋 Batch fetching: ${opportunityIds.length} IDs, ${titles.length} titles`);
  
  // Batch fetch by IDs
  let idResults = [];
  if (opportunityIds.length > 0) {
    const { data, error } = await supabase
      .from('funding_opportunities')
      .select('*')
      .eq('api_source_id', sourceId)
      .in('opportunity_id', opportunityIds);
    
    if (error) {
      console.error('[EarlyDuplicateDetector] ❌ Error fetching by IDs:', error);
      // Don't throw - continue with title matching
    } else {
      idResults = data || [];
    }
  }
  
  // Batch fetch by titles
  let titleResults = [];
  if (titles.length > 0) {
    const { data, error } = await supabase
      .from('funding_opportunities')
      .select('*')
      .eq('api_source_id', sourceId)
      .in('title', titles);
    
    if (error) {
      console.error('[EarlyDuplicateDetector] ❌ Error fetching by titles:', error);
      // Don't throw - continue with available data
    } else {
      titleResults = data || [];
    }
  }
  
  // Create lookup maps for instant access
  const idMap = new Map();
  idResults.forEach(record => {
    if (record.opportunity_id) {
      idMap.set(record.opportunity_id, record);
    }
  });
  
  const titleMap = new Map();
  titleResults.forEach(record => {
    if (record.title) {
      titleMap.set(record.title.trim(), record);
    }
  });
  
  console.log(`[EarlyDuplicateDetector] 🗺️ Created maps: ${idMap.size} ID matches, ${titleMap.size} title matches`);
  
  return { idMap, titleMap };
}

/**
 * Categorizes a single opportunity using ID + Title validation and freshness checking
 * @param {Object} opportunity - Single opportunity to categorize
 * @param {string} sourceId - API source ID
 * @param {Map} idMap - Map of existing records by opportunity_id
 * @param {Map} titleMap - Map of existing records by title
 * @returns {Promise<Object>} - Categorization result with action and reasoning
 */
async function categorizeOpportunity(opportunity, sourceId, idMap, titleMap) {
  // Step 1: ID + Title Validation
  const existingRecord = findExistingWithValidation(opportunity, idMap, titleMap);
  
  if (!existingRecord) {
    return {
      action: 'new',
      reason: 'no_duplicate_found',
      existingRecord: null
    };
  }
  
  console.log(`[EarlyDuplicateDetector] 🔍 Found duplicate for: ${opportunity.title || opportunity.id}`);
  
  // Step 2: Freshness Check (4-scenario decision matrix)
  const freshnessCheck = performFreshnessCheck(opportunity, existingRecord);
  
  if (freshnessCheck.action === 'skip') {
    return {
      action: 'skip',
      reason: freshnessCheck.reason,
      existingRecord
    };
  }
  
  // Step 3: Critical Fields Comparison (only for records that pass freshness check)
  const hasChanges = checkCriticalFieldChanges(existingRecord, opportunity);
  
  if (hasChanges) {
    return {
      action: 'update',
      reason: freshnessCheck.reason,
      existingRecord
    };
  } else {
    return {
      action: 'skip',
      reason: 'no_critical_changes',
      existingRecord
    };
  }
}

/**
 * Implements ID + Title validation approach
 * @param {Object} opportunity - Opportunity to find
 * @param {Map} idMap - Map of records by ID
 * @param {Map} titleMap - Map of records by title
 * @returns {Object|null} - Existing record or null
 */
function findExistingWithValidation(opportunity, idMap, titleMap) {
  // Step 1: Check for ID matches (treat as hint, not guarantee)
  if (opportunity.id && idMap.has(opportunity.id)) {
    const idMatch = idMap.get(opportunity.id);
    
    // Step 2: Validate ID match with title similarity
    if (opportunity.title && duplicateDetector.titlesAreSimilar(idMatch.title, opportunity.title)) {
      console.log(`[EarlyDuplicateDetector] ✅ ID + Title validation passed for: ${opportunity.id}`);
      return idMatch;
    } else {
      console.warn(`[EarlyDuplicateDetector] ⚠️ ID ${opportunity.id} matches but title differs - possible ID reuse`);
      console.warn(`[EarlyDuplicateDetector] 📝 DB title: "${idMatch.title}"`);
      console.warn(`[EarlyDuplicateDetector] 📝 API title: "${opportunity.title}"`);
      // Continue to title fallback instead of returning the ID match
    }
  }
  
  // Step 3: Fall back to title-only matching
  if (opportunity.title && titleMap.has(opportunity.title.trim())) {
    const titleMatch = titleMap.get(opportunity.title.trim());
    console.log(`[EarlyDuplicateDetector] 📝 Title-only match found for: ${opportunity.title}`);
    return titleMatch;
  }
  
  return null;
}

/**
 * Performs the 4-scenario freshness check decision matrix
 * @param {Object} opportunity - New opportunity data
 * @param {Object} existingRecord - Existing database record
 * @returns {Object} - Action and reason
 */
function performFreshnessCheck(opportunity, existingRecord) {
  const now = new Date();
  const dbUpdatedAt = existingRecord.updated_at ? new Date(existingRecord.updated_at) : null;
  const dbApiUpdatedAt = existingRecord.api_updated_at ? new Date(existingRecord.api_updated_at) : null;
  const apiUpdatedAt = opportunity.api_updated_at ? new Date(opportunity.api_updated_at) : null;
  
  // Scenario 1 & 2: API provides api_updated_at timestamp
  if (apiUpdatedAt) {
    if (dbApiUpdatedAt && apiUpdatedAt <= dbApiUpdatedAt) {
      return {
        action: 'skip',
        reason: 'api_timestamp_not_newer'
      };
    } else {
      return {
        action: 'process',
        reason: 'api_timestamp_newer'
      };
    }
  }
  
  // Scenario 3 & 4: API provides NO api_updated_at (90-day stale review logic)
  if (!dbUpdatedAt) {
    // If no updated_at timestamp, process it (shouldn't happen but be safe)
    return {
      action: 'process',
      reason: 'stale_review_no_timestamp'
    };
  }
  
  const daysSinceUpdate = (now - dbUpdatedAt) / (1000 * 60 * 60 * 24);
  
  if (daysSinceUpdate > 90) {
    return {
      action: 'process',
      reason: 'stale_review_90_days'
    };
  } else {
    return {
      action: 'skip',
      reason: 'recently_reviewed'
    };
  }
}

/**
 * Checks if critical fields have changed using existing changeDetector logic
 * @param {Object} existingRecord - Existing database record
 * @param {Object} opportunity - New opportunity data
 * @returns {boolean} - Whether critical fields have changed
 */
function checkCriticalFieldChanges(existingRecord, opportunity) {
  // Use existing changeDetector logic but focus on our 6 critical fields
  const criticalFields = [
    'title',
    'minimumAward',
    'maximumAward', 
    'totalFundingAvailable',
    'closeDate',
    'openDate'
  ];
  
  for (const field of criticalFields) {
    if (changeDetector.hasFieldChanged(existingRecord, opportunity, field)) {
      console.log(`[EarlyDuplicateDetector] 📝 Critical field change detected: ${field}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Creates empty result structure for when no opportunities are provided
 * @returns {Object} - Empty categorization result
 */
function createEmptyResult() {
  return {
    newOpportunities: [],
    opportunitiesToUpdate: [],
    opportunitiesToSkip: [],
    metrics: {
      totalProcessed: 0,
      newOpportunities: 0,
      opportunitiesToUpdate: 0,
      opportunitiesToSkip: 0,
      executionTime: 0
    }
  };
}

// Export individual functions for testing
export const earlyDuplicateDetector = {
  detectDuplicates,
  batchFetchDuplicates,
  categorizeOpportunity,
  findExistingWithValidation,
  performFreshnessCheck,
  checkCriticalFieldChanges
}; 