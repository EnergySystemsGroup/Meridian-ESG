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
import { createSupabaseClient, logAgentExecution } from '../../../supabase.js';

/**
 * Stores NEW opportunities (no duplicate detection needed - handled upstream)
 * @param {Array} opportunities - NEW opportunities from upstream pipeline processing
 * @param {Object} source - The source object for context
 * @param {Object} supabase - Supabase client instance (optional, will create if not provided)
 * @returns {Promise<Object>} - Storage results with metrics
 */
export async function storeOpportunities(opportunities, source, supabase = null) {
  console.log(`[StorageAgent] 💾 Storing ${opportunities.length} opportunities from: ${source.name}`);
  
  const startTime = Date.now();
  
  try {
    // Input validation
    if (!Array.isArray(opportunities)) {
      throw new Error('Opportunities must be an array');
    }
    
    if (!source || !source.id) {
      throw new Error('Source must have an id');
    }
    
    // Initialize Supabase client if not provided
    const client = supabase || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    if (opportunities.length === 0) {
      console.log(`[StorageAgent] ℹ️ No opportunities to store`);
      return createEmptyResult(startTime);
    }
    
    console.log(`[StorageAgent] 🔍 Processing ${opportunities.length} opportunities for storage`);
    
    // Process opportunities in batches
    const results = await processOpportunityBatches(opportunities, source, client);
    
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
    console.error(`[StorageAgent] ❌ Error storing opportunities:`, error);
    
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
    
    throw error;
  }
}

/**
 * Creates empty result structure for new-only opportunities
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
 * Processes opportunities in batches
 */
async function processOpportunityBatches(opportunities, source, client) {
  const batchSize = 10;
  const results = {
    newOpportunities: [],
    updatedOpportunities: [],
    ignoredOpportunities: [],
    duplicatesFound: []
  };
  
  for (let i = 0; i < opportunities.length; i += batchSize) {
    const batch = opportunities.slice(i, i + batchSize);
    console.log(`[StorageAgent] 📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(opportunities.length/batchSize)}`);
    
    const batchResults = await processBatch(batch, source, client);
    
    // Merge batch results
    results.newOpportunities.push(...batchResults.newOpportunities);
    results.updatedOpportunities.push(...batchResults.updatedOpportunities);
    results.ignoredOpportunities.push(...batchResults.ignoredOpportunities);
    results.duplicatesFound.push(...batchResults.duplicatesFound);
  }
  
  return results;
}

/**
 * Processes a single batch of NEW opportunities (no duplicate checking needed)
 */
async function processBatch(batch, source, client) {
  const results = {
    newOpportunities: [],
    updatedOpportunities: [],
    ignoredOpportunities: [],
    duplicatesFound: []
  };
  
  for (const opportunity of batch) {
    try {
      // Step 1: Handle funding source
      const fundingSourceId = await fundingSourceManager.getOrCreate(opportunity, source, client);
      
      // Step 2: Insert new opportunity (no duplicate checking - handled upstream)
      const inserted = await insertOpportunity(opportunity, source.id, fundingSourceId, client);
      results.newOpportunities.push(inserted);
      
      // Step 3: Process state eligibility
      await stateEligibilityProcessor.processEligibility(inserted.id, opportunity, client);
      
    } catch (error) {
      console.error(`[StorageAgent] ❌ Error processing opportunity ${opportunity.id}:`, error);
      // Continue with other opportunities instead of failing entire batch
    }
  }
  
  return results;
}

// updateOpportunity function removed - no longer needed for new-only opportunities

/**
 * Inserts a new opportunity
 */
async function insertOpportunity(opportunity, sourceId, fundingSourceId, client) {
  const insertData = dataSanitizer.prepareForInsert(opportunity, sourceId, fundingSourceId);
  
  const { data: inserted, error } = await client
    .from('funding_opportunities')
    .insert(insertData)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to insert opportunity: ${error.message}`);
  }
  
  console.log(`[StorageAgent] ✨ Created new opportunity: ${opportunity.title}`);
  return inserted;
}

/**
 * Calculates final metrics
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