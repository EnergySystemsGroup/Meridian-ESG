/**
 * StorageAgent V2 - Main Orchestrator
 * 
 * Coordinates the modular storage components to handle opportunity storage,
 * duplicate detection, and state eligibility processing.
 * 
 * Exports: storeOpportunities(opportunities, source, supabase)
 */

import { fundingSourceManager } from './fundingSourceManager.js';
import { duplicateDetector } from './duplicateDetector.js';
import { changeDetector } from './changeDetector.js';
import { stateEligibilityProcessor } from './stateEligibilityProcessor.js';
import { dataSanitizer } from './dataSanitizer.js';
import { createClient } from '@supabase/supabase-js';

/**
 * Stores filtered opportunities with comprehensive deduplication and processing
 * @param {Array} opportunities - Filtered opportunities from Filter Function
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
    console.log(`[StorageAgent] 📊 Results: ${metrics.newOpportunities} new, ${metrics.updatedOpportunities} updated, ${metrics.ignoredOpportunities} ignored`);
    
    return { results, metrics, executionTime };
    
  } catch (error) {
    console.error(`[StorageAgent] ❌ Error storing opportunities:`, error);
    throw error;
  }
}

/**
 * Creates empty result structure
 */
function createEmptyResult(startTime) {
  return {
    metrics: {
      totalProcessed: 0,
      newOpportunities: 0,
      updatedOpportunities: 0,
      ignoredOpportunities: 0,
      duplicatesFound: 0
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
 * Processes a single batch of opportunities
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
      
      // Step 2: Check for existing opportunity
      const existing = await duplicateDetector.findExisting(opportunity, source.id, client);
      
      if (existing) {
        // Step 3: Check for material changes
        const hasChanges = changeDetector.detectMaterialChanges(existing, opportunity);
        
        if (hasChanges) {
          const updated = await updateOpportunity(existing.id, opportunity, fundingSourceId, client);
          results.updatedOpportunities.push(updated);
          
          // Update state eligibility
          await stateEligibilityProcessor.updateEligibility(existing.id, opportunity, client);
        } else {
          results.ignoredOpportunities.push(existing);
        }
        
        results.duplicatesFound.push(existing);
      } else {
        // Step 4: Insert new opportunity
        const inserted = await insertOpportunity(opportunity, source.id, fundingSourceId, client);
        results.newOpportunities.push(inserted);
        
        // Process state eligibility
        await stateEligibilityProcessor.processEligibility(inserted.id, opportunity, client);
      }
    } catch (error) {
      console.error(`[StorageAgent] ❌ Error processing opportunity ${opportunity.id}:`, error);
      // Continue with other opportunities instead of failing entire batch
    }
  }
  
  return results;
}

/**
 * Updates an existing opportunity
 */
async function updateOpportunity(opportunityId, opportunity, fundingSourceId, client) {
  const updateData = dataSanitizer.prepareForUpdate(opportunity, fundingSourceId);
  
  const { data: updated, error } = await client
    .from('funding_opportunities')
    .update(updateData)
    .eq('id', opportunityId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update opportunity: ${error.message}`);
  }
  
  console.log(`[StorageAgent] 📝 Updated opportunity: ${opportunity.title}`);
  return updated;
}

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