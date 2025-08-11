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
import { createSupabaseClient, logAgentExecution } from '../../../../utils/supabase.js';
import { StorageConfig } from '../../config/storage.config.js';
import { BatchProcessor } from '../../utils/performanceOptimizer.js';

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
    console.log(`[StorageAgent] 📊 Results: ${metrics.newOpportunities} new opportunities stored`);
    
    const result = { results, metrics, executionTime };
    
    // Log agent execution for tracking
    try {
      const supabaseClient = createSupabaseClient();
      await logAgentExecution(
        supabaseClient,
        'storage_v2',
        { 
          source: { id: source.id, name: source.name },
          opportunityCount: opportunities.length
        },
        result,
        executionTime,
        null // No token usage for storage operations
      );
    } catch (logError) {
      console.error('[StorageAgent] ❌ Failed to log execution:', logError);
      // Don't throw - logging failure shouldn't break the pipeline
    }
    
    return result;
    
  } catch (error) {
    const errorMessage = `[StorageAgent] ❌ Error storing opportunities: ${error.message}`;
    console.error(errorMessage, error);
    
    // Log failed execution
    try {
      const supabaseClient = createSupabaseClient();
      const executionTime = Math.max(1, Date.now() - startTime);
      await logAgentExecution(
        supabaseClient,
        'storage_v2',
        { 
          source: { id: source.id, name: source.name },
          opportunityCount: opportunities.length
        },
        null,
        executionTime,
        null,
        error
      );
    } catch (logError) {
      console.error('[StorageAgent] ❌ Failed to log error execution:', logError);
    }
    
    // Return error result instead of throwing to maintain consistent error handling
    return {
      results: {
        newOpportunities: [],
        updatedOpportunities: [],
        ignoredOpportunities: [],
        duplicatesFound: []
      },
      metrics: {
        totalProcessed: 0,
        newOpportunities: 0,
        updatedOpportunities: 0,
        ignoredOpportunities: 0,
        duplicatesFound: 0,
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
      duplicatesFound: [] // Always empty in new-only mode
    },
    metrics: {
      totalProcessed: 0,
      newOpportunities: 0,
      updatedOpportunities: 0, // Always 0 in new-only mode
      ignoredOpportunities: 0, // Always 0 in new-only mode
      duplicatesFound: 0 // Always 0 in new-only mode
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
    duplicatesFound: []
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
    duplicatesFound: []
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
      
      // Don't wait for eligibility, but ensure it completes
      eligibilityPromise.then(() => {});
      
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
    }
    // Handle other types if needed in future
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
        onConflict: 'api_opportunity_id,api_source_id',
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
    duplicatesFound: results.duplicatesFound.length
  };
} 