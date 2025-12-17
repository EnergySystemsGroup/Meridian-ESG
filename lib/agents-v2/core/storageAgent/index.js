/**
 * StorageAgent V2 - Main Orchestrator
 * 
 * Coordinates the modular storage components to handle NEW opportunity storage
 * and state eligibility processing. Optimized for Approach A architecture where
 * duplicate detection is handled upstream in the pipeline.
 * 
 * Exports: storeOpportunities(opportunities, source, supabase)
 */

import { fundingSourceManager } from './fundingSourceManager.js';
import { stateEligibilityProcessor } from './stateEligibilityProcessor.js';
import { dataSanitizer } from './dataSanitizer.js';
import { createClient } from '@supabase/supabase-js';
import { StorageConfig } from '../../config/storage.config.js';
import { linkOpportunityToCoverageAreas } from '../../../services/locationMatcher.js';

// Shared client for connection pooling
let sharedClient = null;

/**
 * Get or create shared Supabase client for connection pooling
 * @private
 * @returns {Object} Supabase client instance
 */
function getSharedClient() {
  if (!sharedClient) {
    sharedClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        db: {
          schema: 'public',
        },
        global: {
          headers: { 'x-storage-agent': 'v2' },
        },
        auth: {
          persistSession: StorageConfig.PERSIST_SESSION,
          autoRefreshToken: StorageConfig.AUTO_REFRESH_TOKEN,
        }
      }
    );
  }
  return sharedClient;
}

/**
 * Stores NEW opportunities (no duplicate detection needed - handled upstream)
 * @param {Array} opportunities - NEW opportunities from upstream pipeline processing
 * @param {Object} source - The source object for context
 * @param {Object} supabase - Supabase client instance (optional, will create if not provided)
 * @param {boolean} forceFullProcessing - When true, use upsert to overwrite existing records
 * @returns {Promise<Object>} - Storage results with metrics
 */
export async function storeOpportunities(opportunities, source, supabase = null, forceFullProcessing = false) {
  const startTime = Date.now();
  
  try {
    // Input validation
    if (!Array.isArray(opportunities)) {
      throw new Error('Opportunities must be an array');
    }
    
    if (!source || !source.id) {
      throw new Error('Source must have an id');
    }
    
    console.log(`[StorageAgent] 💾 Storing ${opportunities.length} opportunities from: ${source.name}${forceFullProcessing ? ' (FORCE FULL PROCESSING MODE)' : ''}`);
    
    // Use provided client or shared client for connection pooling
    const client = supabase || getSharedClient();
    
    if (opportunities.length === 0) {
      console.log(`[StorageAgent] ℹ️ No opportunities to store`);
      return createEmptyResult(startTime);
    }
    
    console.log(`[StorageAgent] 🔍 Processing ${opportunities.length} opportunities for storage`);
    
    // Process opportunities in batches
    const results = await processOpportunityBatches(opportunities, source, client, forceFullProcessing);
    
    const metrics = calculateMetrics(opportunities.length, results);
    const executionTime = Math.max(1, Date.now() - startTime);
    
    console.log(`[StorageAgent] ✅ Storage completed in ${executionTime}ms`);
    console.log(`[StorageAgent] 📊 Results: ${metrics.newOpportunities} new opportunities stored, ${metrics.failedOpportunities} failed`);

    // Log detailed failure info if any
    if (metrics.failedOpportunities > 0) {
      console.error(`[StorageAgent] ❌ ${metrics.failedOpportunities} opportunities failed to store:`);
      for (const failed of results.failedOpportunities) {
        console.error(`[StorageAgent]   - "${failed.title}": ${failed.error}`);
      }
    }
    
    const result = { results, metrics, executionTime };
    
    // Agent execution is already tracked by RunManagerV2 in pipeline_stages table
    
    return result;
    
  } catch (error) {
    const errorMessage = `[StorageAgent] ❌ Error storing opportunities: ${error.message}`;
    console.error(errorMessage, error);
    
    // Error execution is already tracked by RunManagerV2 in pipeline_stages table
    
    // Return error result instead of throwing to maintain consistent error handling
    return {
      results: {
        newOpportunities: [],
        updatedOpportunities: [],
        ignoredOpportunities: [],
        duplicatesFound: [],
        failedOpportunities: []
      },
      metrics: {
        totalProcessed: 0,
        newOpportunities: 0,
        updatedOpportunities: 0,
        ignoredOpportunities: 0,
        duplicatesFound: 0,
        failedOpportunities: 0,
        error: true,
        errorMessage: error.message
      },
      executionTime: Math.max(1, Date.now() - startTime)
    };
  }
}

/**
 * Creates empty result structure for new-only opportunities
 * @private
 * @param {number} startTime - The start time of the operation
 * @returns {Object} Empty result structure
 */
function createEmptyResult(startTime) {
  return {
    results: {
      newOpportunities: [],
      updatedOpportunities: [], // Always empty in new-only mode
      ignoredOpportunities: [], // Always empty in new-only mode
      duplicatesFound: [], // Always empty in new-only mode
      failedOpportunities: []
    },
    metrics: {
      totalProcessed: 0,
      newOpportunities: 0,
      updatedOpportunities: 0, // Always 0 in new-only mode
      ignoredOpportunities: 0, // Always 0 in new-only mode
      duplicatesFound: 0, // Always 0 in new-only mode
      failedOpportunities: 0
    },
    executionTime: Math.max(1, Date.now() - startTime)
  };
}

/**
 * Processes opportunities in batches with thread-safe result aggregation
 * @private
 * @param {Array} opportunities - Array of opportunities to process
 * @param {Object} source - The source object for context
 * @param {Object} client - Supabase client instance
 * @param {boolean} forceFullProcessing - Whether to force full processing (bypass duplicate detection)
 * @returns {Promise<Object>} Processing results
 */
async function processOpportunityBatches(opportunities, source, client, forceFullProcessing = false) {
  const batchSize = StorageConfig.BATCH_SIZE;
  const results = {
    newOpportunities: [],
    updatedOpportunities: [],
    ignoredOpportunities: [],
    duplicatesFound: [],
    failedOpportunities: []
  };

  // Process batches sequentially to avoid race conditions
  for (let i = 0; i < opportunities.length; i += batchSize) {
    const batch = opportunities.slice(i, i + batchSize);
    console.log(`[StorageAgent] 📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(opportunities.length/batchSize)}`);
    
    const batchResults = await processBatch(batch, source, client, forceFullProcessing);
    
    // Atomic result aggregation - use Object.freeze to prevent concurrent modification
    const frozenBatchResults = Object.freeze(batchResults);
    
    // Thread-safe merge using spread operator (creates new arrays)
    results.newOpportunities = [...results.newOpportunities, ...frozenBatchResults.newOpportunities];
    results.updatedOpportunities = [...results.updatedOpportunities, ...frozenBatchResults.updatedOpportunities];
    results.ignoredOpportunities = [...results.ignoredOpportunities, ...frozenBatchResults.ignoredOpportunities];
    results.duplicatesFound = [...results.duplicatesFound, ...frozenBatchResults.duplicatesFound];
    results.failedOpportunities = [...results.failedOpportunities, ...(frozenBatchResults.failedOpportunities || [])];
  }
  
  return Object.freeze(results); // Prevent modification after processing
}

/**
 * Processes a single batch of NEW opportunities (no duplicate checking needed)
 * Optimized with parallel processing for independent operations
 * @param {Array} batch - Batch of opportunities to process
 * @param {Object} source - The source object
 * @param {Object} client - Supabase client
 * @param {boolean} forceFullProcessing - When true, use upsert mode
 */
async function processBatch(batch, source, client, forceFullProcessing = false) {
  const results = {
    newOpportunities: [],
    updatedOpportunities: [],
    ignoredOpportunities: [],
    duplicatesFound: [],
    failedOpportunities: []
  };
  
  // Process opportunities in parallel for better performance
  const processingPromises = batch.map(async (opportunity) => {
    try {
      // Step 1: Handle funding source
      const fundingSourceId = await fundingSourceManager.getOrCreate(opportunity, source, client);
      
      // Step 2: Insert new opportunity (no duplicate checking - handled upstream)
      const inserted = await insertOpportunity(opportunity, source.id, fundingSourceId, client, forceFullProcessing);

      // Step 3: Process state eligibility (can be done async)
      const eligibilityPromise = stateEligibilityProcessor.processEligibility(inserted.id, opportunity, client)
        .catch(err => console.error(`[StorageAgent] ⚠️ State eligibility processing failed for ${opportunity.id}:`, err));

      // Step 4: Link to coverage areas based on eligible_locations (can be done async)
      // Note: opportunity object uses camelCase before dataSanitizer converts to snake_case
      let locationTexts = opportunity.eligibleLocations || [];

      // If isNational is true but no eligibleLocations, add "National" for coverage area linking
      if (opportunity.isNational && locationTexts.length === 0) {
        locationTexts = ['National'];
      }

      if (locationTexts.length > 0) {
        const coverageAreasPromise = linkOpportunityToCoverageAreas(inserted.id, locationTexts)
          .then(result => {
            if (result.success) {
              console.log(`[StorageAgent] 📍 Linked ${result.linked_count} coverage areas for ${opportunity.title}`);
            } else {
              console.error(`[StorageAgent] ⚠️ Coverage area linking failed for ${opportunity.id}:`, result.error);
            }
          })
          .catch(err => console.error(`[StorageAgent] ⚠️ Coverage area linking failed for ${opportunity.id}:`, err));

        // Wait for coverage areas to complete
        await coverageAreasPromise;
      }

      // Wait for eligibility to complete
      await eligibilityPromise;

      return { type: 'new', data: inserted };
    } catch (error) {
      console.error(`[StorageAgent] ❌ Error processing opportunity ${opportunity.id}:`, error);
      return { type: 'error', data: opportunity, error };
    }
  });
  
  // Wait for all operations to complete
  const processedResults = await Promise.all(processingPromises);
  
  // Aggregate results
  for (const result of processedResults) {
    if (result.type === 'new') {
      results.newOpportunities.push(result.data);
    } else if (result.type === 'error') {
      // Capture failed opportunities with error details
      results.failedOpportunities.push({
        title: result.data?.title || result.data?.id || 'Unknown',
        opportunityId: result.data?.id,
        error: result.error?.message || 'Unknown error'
      });
      console.error(`[StorageAgent] ⚠️ Failed to store opportunity: "${result.data?.title}" - ${result.error?.message}`);
    }
  }

  return results;
}

// updateOpportunity function removed - no longer needed for new-only opportunities

/**
 * Inserts a new opportunity or upserts if force full processing is enabled
 * @private
 * @param {Object} opportunity - The opportunity to insert
 * @param {string} sourceId - The source ID
 * @param {string} fundingSourceId - The funding source ID
 * @param {Object} client - Supabase client instance
 * @param {boolean} forceFullProcessing - When true, use upsert to overwrite existing records
 * @returns {Promise<Object>} The inserted/upserted opportunity
 */
async function insertOpportunity(opportunity, sourceId, fundingSourceId, client, forceFullProcessing = false) {
  const insertData = dataSanitizer.prepareForInsert(opportunity, sourceId, fundingSourceId);
  
  let result;
  
  if (forceFullProcessing) {
    // Use upsert to overwrite existing records based on unique constraint
    console.log(`[StorageAgent] 🔄 UPSERT MODE: Overwriting if exists - ${opportunity.title}`);
    
    result = await client
      .from('funding_opportunities')
      .upsert(insertData, {
        onConflict: 'title,api_source_id',
        ignoreDuplicates: false // Ensure we overwrite existing records
      })
      .select()
      .single();
  } else {
    // Normal insert for new opportunities
    result = await client
      .from('funding_opportunities')
      .insert(insertData)
      .select()
      .single();
  }
  
  const { data: inserted, error } = result;
  
  if (error) {
    throw new Error(`Failed to ${forceFullProcessing ? 'upsert' : 'insert'} opportunity: ${error.message}`);
  }
  
  console.log(`[StorageAgent] ✨ ${forceFullProcessing ? 'Upserted' : 'Created new'} opportunity: ${opportunity.title}`);
  return inserted;
}

/**
 * Calculates final metrics
 * @private
 * @param {number} totalProcessed - Total number of opportunities processed
 * @param {Object} results - Processing results
 * @returns {Object} Calculated metrics
 */
function calculateMetrics(totalProcessed, results) {
  return {
    totalProcessed,
    newOpportunities: results.newOpportunities.length,
    updatedOpportunities: results.updatedOpportunities.length,
    ignoredOpportunities: results.ignoredOpportunities.length,
    duplicatesFound: results.duplicatesFound.length,
    failedOpportunities: results.failedOpportunities?.length || 0
  };
} 