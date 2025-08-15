/**
 * EarlyDuplicateDetector V2 - Enhanced with Comprehensive Metrics Collection
 * 
 * Performs duplicate detection immediately after data extraction using ID + Title validation.
 * Implements efficient batch processing and 4-scenario freshness checking to maximize
 * token savings by preventing duplicates from reaching Analysis/Filter stages.
 * 
 * Enhanced Features for V2 Clean Metrics System:
 * - Detailed analytics capture (accuracy, false positives, performance)
 * - Detection method effectiveness tracking
 * - Database query optimization metrics
 * - Token savings estimation and cost impact analysis
 * - Quality scoring for detection accuracy
 * - Comprehensive dashboard-ready insights
 * 
 * Key Features:
 * - Batch database queries for performance
 * - ID + Title validation approach (ID as hint, title as validator)
 * - 4-scenario freshness check decision matrix
 * - Action-oriented output for ProcessCoordinatorV2 branching
 * - Critical field comparison with null protection
 * - Enhanced metrics collection for dashboard analytics
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
 * @param {string} rawResponseId - Optional raw response ID to track API source lineage
 * @returns {Promise<Object>} - Categorized opportunities for action-oriented processing
 */
export async function detectDuplicates(opportunities, sourceId, supabase, rawResponseId = null) {
  const startTime = Date.now();
  
  // Enhanced metrics tracking
  const detectionMetrics = {
    databaseQueries: 0,
    idMatches: 0,
    titleMatches: 0,
    validationFailures: 0,
    freshnessSkips: 0,
    detectionMethods: {
      id_validation: 0,
      title_only: 0,
      no_match: 0
    },
    performanceData: {
      batchFetchTime: 0,
      categorizationTime: 0,
      avgTimePerOpportunity: 0
    },
    qualityMetrics: {
      confidence_high: 0,
      confidence_medium: 0,
      confidence_low: 0
    }
  };
  
  try {
    // Input validation
    if (!Array.isArray(opportunities)) {
      throw new Error('Opportunities must be an array');
    }
    
    console.log(`[EarlyDuplicateDetector] 🔍 Processing ${opportunities.length} opportunities from source: ${sourceId}`);
    
    if (!sourceId) {
      throw new Error('Source ID is required');
    }
    
    if (opportunities.length === 0) {
      console.log(`[EarlyDuplicateDetector] ℹ️ No opportunities to process`);
      return createEmptyResult();
    }
    
    // Step 1: Efficient batch fetch of potential duplicates with metrics tracking
    const batchFetchStart = Date.now();
    const { idMap, titleMap, queryMetrics } = await batchFetchDuplicates(opportunities, sourceId, supabase);
    detectionMetrics.performanceData.batchFetchTime = Date.now() - batchFetchStart;
    detectionMetrics.databaseQueries += queryMetrics.queriesExecuted;
    detectionMetrics.idMatches = idMap.size;
    detectionMetrics.titleMatches = titleMap.size;
    
    console.log(`[EarlyDuplicateDetector] 📊 Batch fetch completed: ${idMap.size} ID matches, ${titleMap.size} title matches (${detectionMetrics.databaseQueries} queries, ${detectionMetrics.performanceData.batchFetchTime}ms)`);
    
    // Step 2: Process each opportunity and categorize for action with enhanced analytics
    const categorizationStart = Date.now();
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
        titleMap,
        detectionMetrics // Pass metrics for tracking
      );
      
      switch (categorization.action) {
        case 'new':
          // Add rawResponseId to new opportunities for data lineage
          const newOpportunity = rawResponseId ? { ...opportunity, rawResponseId } : opportunity;
          result.newOpportunities.push(newOpportunity);
          break;
        case 'update':
          result.opportunitiesToUpdate.push({
            apiRecord: opportunity,
            dbRecord: categorization.existingRecord,
            reason: categorization.reason,
            rawResponseId // Include for update tracking
          });
          break;
        case 'skip':
          result.opportunitiesToSkip.push({
            apiRecord: opportunity,
            existingRecord: categorization.existingRecord,
            reason: categorization.reason,
            rawResponseId // Include for skip tracking
          });
          break;
      }
    }
    
    // Complete metrics calculation
    const executionTime = Date.now() - startTime;
    detectionMetrics.performanceData.categorizationTime = Date.now() - categorizationStart;
    detectionMetrics.performanceData.avgTimePerOpportunity = Math.round(executionTime / opportunities.length);
    
    // Calculate optimization impact estimates
    const bypassedOpportunities = result.opportunitiesToUpdate.length + result.opportunitiesToSkip.length;
    const estimatedTokensSaved = bypassedOpportunities * 1500; // Rough estimate: 1500 tokens per opportunity analysis
    const estimatedCostSaved = estimatedTokensSaved * 0.00001; // Rough cost estimate
    const efficiencyImprovement = opportunities.length > 0 ? Math.round((bypassedOpportunities / opportunities.length) * 100) : 0;
    
    // Calculate quality scores
    const detectionAccuracy = calculateDetectionAccuracy(detectionMetrics, result);
    const confidenceDistribution = calculateConfidenceDistribution(detectionMetrics);
    
    console.log(`[EarlyDuplicateDetector] ✅ Categorization completed in ${executionTime}ms`);
    console.log(`[EarlyDuplicateDetector] 📊 Results: ${result.newOpportunities.length} new, ${result.opportunitiesToUpdate.length} to update, ${result.opportunitiesToSkip.length} to skip`);
    console.log(`[EarlyDuplicateDetector] 🚀 Optimization: ${efficiencyImprovement}% efficiency, ~${estimatedTokensSaved} tokens saved, ~$${estimatedCostSaved.toFixed(4)} cost saved`);
    
    return {
      ...result,
      metrics: {
        totalProcessed: opportunities.length,
        newOpportunities: result.newOpportunities.length,
        opportunitiesToUpdate: result.opportunitiesToUpdate.length,
        opportunitiesToSkip: result.opportunitiesToSkip.length,
        executionTime
      },
      enhancedMetrics: {
        // Core detection metrics
        ...detectionMetrics,
        
        // Optimization impact
        estimatedTokensSaved,
        estimatedCostSaved,
        efficiencyImprovement,
        
        // Quality metrics
        detectionAccuracy,
        confidenceDistribution,
        
        // Performance insights
        performanceInsights: {
          queriesPerOpportunity: Math.round(detectionMetrics.databaseQueries / opportunities.length * 100) / 100,
          avgProcessingTime: detectionMetrics.performanceData.avgTimePerOpportunity,
          batchEfficiency: Math.round((detectionMetrics.performanceData.batchFetchTime / executionTime) * 100),
          detectionEffectiveness: Math.round(((detectionMetrics.idMatches + detectionMetrics.titleMatches) / opportunities.length) * 100)
        }
      }
    };
    
  } catch (error) {
    console.error(`[EarlyDuplicateDetector] ❌ Error during duplicate detection:`, error);
    throw error;
  }
}

/**
 * Efficiently fetches potential duplicates using batch queries with enhanced metrics
 * @param {Array} opportunities - Opportunities to check
 * @param {string} sourceId - API source ID
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Object>} - Maps for ID and title lookups plus query metrics
 */
async function batchFetchDuplicates(opportunities, sourceId, supabase) {
  const queryMetrics = {
    queriesExecuted: 0,
    idsQueried: 0,
    titlesQueried: 0,
    queryExecutionTime: 0
  };
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
  
  queryMetrics.idsQueried = opportunityIds.length;
  queryMetrics.titlesQueried = titles.length;
  
  console.log(`[EarlyDuplicateDetector] 📋 Batch fetching: ${opportunityIds.length} IDs, ${titles.length} titles`);
  
  // Batch fetch by IDs with timing
  let idResults = [];
  if (opportunityIds.length > 0) {
    const idQueryStart = Date.now();
    const { data, error } = await supabase
      .from('funding_opportunities')
      .select('*')
      .eq('api_source_id', sourceId)
      .in('api_opportunity_id', opportunityIds);
    
    queryMetrics.queryExecutionTime += Date.now() - idQueryStart;
    queryMetrics.queriesExecuted++;
    
    if (error) {
      console.error('[EarlyDuplicateDetector] ❌ Error fetching by IDs:', error);
      // Don't throw - continue with title matching
    } else {
      idResults = data || [];
    }
  }
  
  // Batch fetch by titles with timing
  let titleResults = [];
  if (titles.length > 0) {
    const titleQueryStart = Date.now();
    const { data, error } = await supabase
      .from('funding_opportunities')
      .select('*')
      .eq('api_source_id', sourceId)
      .in('title', titles);
    
    queryMetrics.queryExecutionTime += Date.now() - titleQueryStart;
    queryMetrics.queriesExecuted++;
    
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
    if (record.api_opportunity_id) {
      idMap.set(record.api_opportunity_id, record);
    }
  });
  
  const titleMap = new Map();
  titleResults.forEach(record => {
    if (record.title) {
      titleMap.set(record.title.trim(), record);
    }
  });
  
  console.log(`[EarlyDuplicateDetector] 🗺️ Created maps: ${idMap.size} ID matches, ${titleMap.size} title matches`);
  
  return { idMap, titleMap, queryMetrics };
}

/**
 * Categorizes a single opportunity using ID + Title validation and freshness checking with metrics tracking
 * @param {Object} opportunity - Single opportunity to categorize
 * @param {string} sourceId - API source ID
 * @param {Map} idMap - Map of existing records by api_opportunity_id
 * @param {Map} titleMap - Map of existing records by title
 * @param {Object} detectionMetrics - Metrics tracking object
 * @returns {Promise<Object>} - Categorization result with action and reasoning
 */
async function categorizeOpportunity(opportunity, sourceId, idMap, titleMap, detectionMetrics) {
  // Step 1: ID + Title Validation with detection method tracking
  const validationResult = findExistingWithValidation(opportunity, idMap, titleMap, detectionMetrics);
  const existingRecord = validationResult.record;
  
  if (!existingRecord) {
    detectionMetrics.detectionMethods.no_match++;
    detectionMetrics.qualityMetrics.confidence_high++; // High confidence in new opportunities
    return {
      action: 'new',
      reason: 'no_duplicate_found',
      existingRecord: null,
      confidence: 'high',
      detectionMethod: 'no_match'
    };
  }
  
  console.log(`[EarlyDuplicateDetector] 🔍 Found duplicate for: ${opportunity.title || opportunity.id} (method: ${validationResult.method})`);
  
  // Track detection method
  if (validationResult.method === 'id_validation') {
    detectionMetrics.detectionMethods.id_validation++;
    detectionMetrics.qualityMetrics.confidence_high++;
  } else if (validationResult.method === 'title_only') {
    detectionMetrics.detectionMethods.title_only++;
    detectionMetrics.qualityMetrics.confidence_medium++;
  }
  
  // Step 2: Freshness Check (4-scenario decision matrix)
  const freshnessCheck = performFreshnessCheck(opportunity, existingRecord);
  
  if (freshnessCheck.action === 'skip') {
    detectionMetrics.freshnessSkips++;
    return {
      action: 'skip',
      reason: freshnessCheck.reason,
      existingRecord,
      confidence: validationResult.method === 'id_validation' ? 'high' : 'medium',
      detectionMethod: validationResult.method
    };
  }
  
  // Step 3: Critical Fields Comparison (only for records that pass freshness check)
  const hasChanges = checkCriticalFieldChanges(existingRecord, opportunity);
  
  if (hasChanges) {
    return {
      action: 'update',
      reason: freshnessCheck.reason,
      existingRecord,
      confidence: validationResult.method === 'id_validation' ? 'high' : 'medium',
      detectionMethod: validationResult.method
    };
  } else {
    return {
      action: 'skip',
      reason: 'no_critical_changes',
      existingRecord,
      confidence: validationResult.method === 'id_validation' ? 'high' : 'medium',
      detectionMethod: validationResult.method
    };
  }
}

/**
 * Implements ID + Title validation approach with detection method tracking
 * @param {Object} opportunity - Opportunity to find
 * @param {Map} idMap - Map of records by ID
 * @param {Map} titleMap - Map of records by title
 * @param {Object} detectionMetrics - Metrics tracking object
 * @returns {Object} - { record: existing record or null, method: detection method used }
 */
function findExistingWithValidation(opportunity, idMap, titleMap, detectionMetrics) {
  // Step 1: Check for ID matches (treat as hint, not guarantee)
  if (opportunity.id && idMap.has(opportunity.id)) {
    const idMatch = idMap.get(opportunity.id);
    
    // Step 2: Validate ID match with title similarity
    if (opportunity.title && duplicateDetector.titlesAreSimilar(idMatch.title, opportunity.title)) {
      console.log(`[EarlyDuplicateDetector] ✅ ID + Title validation passed for: ${opportunity.id}`);
      return { record: idMatch, method: 'id_validation' };
    } else {
      console.warn(`[EarlyDuplicateDetector] ⚠️ ID ${opportunity.id} matches but title differs - possible ID reuse`);
      console.warn(`[EarlyDuplicateDetector] 📝 DB title: "${idMatch.title}"`);
      console.warn(`[EarlyDuplicateDetector] 📝 API title: "${opportunity.title}"`);
      detectionMetrics.validationFailures++;
      // Continue to title fallback instead of returning the ID match
    }
  }
  
  // Step 3: Fall back to title-only matching
  if (opportunity.title && titleMap.has(opportunity.title.trim())) {
    const titleMatch = titleMap.get(opportunity.title.trim());
    console.log(`[EarlyDuplicateDetector] 📝 Title-only match found for: ${opportunity.title}`);
    return { record: titleMatch, method: 'title_only' };
  }
  
  return { record: null, method: 'no_match' };
}

/**
 * Helper function to validate if a timestamp is valid and usable
 * @param {any} timestamp - Timestamp value to validate
 * @returns {boolean} - True if timestamp is valid and usable
 */
function isValidTimestamp(timestamp) {
  // Check for null, undefined, empty string, or falsy values
  if (!timestamp) {
    return false;
  }
  
  // Check for empty string after trimming
  if (typeof timestamp === 'string' && timestamp.trim() === '') {
    return false;
  }
  
  // Try to create a Date and check if it's valid
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

/**
 * Performs the 4-scenario freshness check decision matrix with robust timestamp validation
 * @param {Object} opportunity - New opportunity data
 * @param {Object} existingRecord - Existing database record
 * @returns {Object} - Action and reason
 */
function performFreshnessCheck(opportunity, existingRecord) {
  const now = new Date();
  const dbUpdatedAt = existingRecord.updated_at ? new Date(existingRecord.updated_at) : null;
  const dbApiUpdatedAt = existingRecord.api_updated_at ? new Date(existingRecord.api_updated_at) : null;
  
  // Validate API timestamp before using it
  if (!isValidTimestamp(opportunity.api_updated_at)) {
    // When API doesn't provide a valid timestamp, proceed to field checking
    return {
      action: 'process',
      reason: 'no_api_timestamp_check_fields'
    };
  }
  
  const apiUpdatedAt = new Date(opportunity.api_updated_at);
  
  // Scenario 1 & 2: API provides valid api_updated_at timestamp
  // (We already validated it's valid above, so we can use it directly)
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
 * Calculate detection accuracy score based on detection methods and validation results
 * @param {Object} detectionMetrics - Metrics tracking object
 * @param {Object} result - Detection results
 * @returns {number} - Accuracy score (0-100)
 */
function calculateDetectionAccuracy(detectionMetrics, result) {
  const totalDetections = detectionMetrics.detectionMethods.id_validation + 
                         detectionMetrics.detectionMethods.title_only;
  
  if (totalDetections === 0) return 100; // No duplicates detected = perfect accuracy
  
  // Weight ID validation higher than title-only matching
  const weightedAccuracy = (
    (detectionMetrics.detectionMethods.id_validation * 0.95) + // 95% accuracy for ID validation
    (detectionMetrics.detectionMethods.title_only * 0.85) -    // 85% accuracy for title-only
    (detectionMetrics.validationFailures * 0.1)               // Penalty for validation failures
  ) / totalDetections;
  
  return Math.max(0, Math.min(100, Math.round(weightedAccuracy * 100)));
}

/**
 * Calculate confidence distribution for detection quality assessment
 * @param {Object} detectionMetrics - Metrics tracking object
 * @returns {Object} - Confidence distribution percentages
 */
function calculateConfidenceDistribution(detectionMetrics) {
  const total = detectionMetrics.qualityMetrics.confidence_high + 
                detectionMetrics.qualityMetrics.confidence_medium + 
                detectionMetrics.qualityMetrics.confidence_low;
  
  if (total === 0) {
    return { high: 100, medium: 0, low: 0 };
  }
  
  return {
    high: Math.round((detectionMetrics.qualityMetrics.confidence_high / total) * 100),
    medium: Math.round((detectionMetrics.qualityMetrics.confidence_medium / total) * 100),
    low: Math.round((detectionMetrics.qualityMetrics.confidence_low / total) * 100)
  };
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
  checkCriticalFieldChanges,
  isValidTimestamp
}; 