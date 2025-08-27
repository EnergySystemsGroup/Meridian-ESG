/**
 * Job Processor for V2 Pipeline Queue System
 * 
 * Processes chunked raw API data through the complete V2 pipeline stages.
 * Includes LLM extraction, duplicate detection, analysis, filtering, and storage.
 * 
 * Features:
 * - Processes 5-opportunity chunks from job queue
 * - Maintains V2 metrics compatibility  
 * - Handles NEW/UPDATE/SKIP pipeline branching
 * - Integrates with existing RunManagerV2 tracking
 * - Supports retry logic and error handling
 */

import { detectDuplicates } from '../agents-v2/optimization/earlyDuplicateDetector.js';
import { enhanceOpportunities } from '../agents-v2/core/analysisAgent/index.js';
import { filterOpportunities } from '../agents-v2/core/filterFunction.js';
import { storeOpportunities } from '../agents-v2/core/storageAgent/index.js';
import { updateDuplicateOpportunities } from '../agents-v2/optimization/directUpdateHandler.js';
import { extractOpportunitiesWithSchema } from '../agents-v2/core/dataExtractionAgent/extraction/index.js';
import { RunManagerV2 } from './runManagerV2.js';
import { createClient } from '@supabase/supabase-js';
import { getAnthropicClient } from '../agents-v2/utils/anthropicClient.js';

/**
 * Check if force full processing is enabled for a source
 * @param {string} sourceId - Source ID to check
 * @param {Object} supabase - Supabase client
 * @returns {Promise<boolean>} - Whether force full processing is enabled
 */
async function shouldForceFullProcessing(sourceId, supabase) {
  try {
    // Call the database function that checks both flags
    const { data, error } = await supabase.rpc('should_force_full_reprocessing', {
      source_id: sourceId
    });
    
    if (error) {
      console.error('[JobProcessor] Error checking force reprocessing flags:', error);
      return false; // Default to normal processing on error
    }
    
    return data === true;
  } catch (error) {
    console.error('[JobProcessor] Failed to check force reprocessing flags:', error);
    return false; // Default to normal processing on error
  }
}

/**
 * Process a job chunk through the V2 pipeline stages
 * @param {Object} jobData - Job data from queue
 * @param {string} jobData.sourceId - Source ID
 * @param {Array} jobData.chunkedData - Array of 5 raw API response items to extract and process
 * @param {Object} jobData.processingInstructions - Instructions from SourceOrchestrator
 * @param {string} jobData.rawResponseId - Raw response tracking ID
 * @param {string} jobData.masterRunId - Master pipeline run ID for metrics rollup
 * @param {string} jobData.jobId - Job ID for creating separate pipeline stage records
 * @param {Object} [supabase] - Optional Supabase client (will create if not provided)
 * @param {Object} [anthropic] - Optional Anthropic client (will create if not provided)
 * @param {Object} [runManager] - Optional RunManagerV2 instance (will create if not provided)
 * @returns {Promise<Object>} Processing results and metrics with runManager reference
 */
export async function processJob(jobData, supabase = null, anthropic = null, runManager = null) {
  console.log(`[JobProcessor] 🚀 Starting job processing for source: ${jobData.sourceId} (${jobData.chunkedData?.length || 0} opportunities)`);
  
  const startTime = Date.now();
  let runManagerWasProvided = !!runManager;
  
  try {
    // Initialize clients if not provided
    if (!supabase) {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
    }
    if (!anthropic) {
      anthropic = getAnthropicClient();
    }
    
    // Check if force full processing is enabled
    const forceFullProcessing = await shouldForceFullProcessing(jobData.sourceId, supabase);
    if (forceFullProcessing) {
      console.log(`[JobProcessor] ⚠️ Force full reprocessing enabled - will bypass duplicate detection`);
    }
    
    // Initialize or use provided RunManager for this job chunk
    if (!runManager) {
      // Create new RunManager if not provided
      runManager = new RunManagerV2(jobData.masterRunId, supabase);
      
      if (!jobData.masterRunId) {
        // Create standalone run if no master run provided
        await runManager.startRun(jobData.sourceId, {
          pipeline_version: 'v2.0-job-queue',
          job_processing: true,
          chunk_size: jobData.chunkedData?.length || 0,
          source_type: jobData.processingInstructions?.workflow || 'unknown'
        });
      }
    } else {
      // Use existing RunManager with master run ID
      console.log(`[JobProcessor] 🔗 Using provided RunManager with run ID: ${runManager.runId}`);
    }
    
    // Validate job data
    if (!jobData.chunkedData || !Array.isArray(jobData.chunkedData)) {
      throw new Error('Invalid job data: chunkedData must be an array of opportunities');
    }
    
    if (!jobData.sourceId || !jobData.processingInstructions) {
      throw new Error('Invalid job data: sourceId and processingInstructions are required');
    }
    
    console.log(`[JobProcessor] 📊 Processing ${jobData.chunkedData.length} raw API items for source: ${jobData.sourceId}`);
    
    // === STAGE 0: LLM Data Extraction ===
    // Extract and standardize the raw API data into structured opportunities
    console.log(`[JobProcessor] 🔍 Stage 0: LLM Data Extraction (${jobData.chunkedData.length} raw items)`);
    await runManager.updateV2DataExtraction('processing', null, {}, 0, 0, jobData.chunkedData.length, 0, jobData.jobId);
    
    const extractionStartTime = Date.now();
    
    // Prepare raw data structure for extraction (mimicking DataExtractionAgent format)
    const rawDataForExtraction = {
      data: jobData.chunkedData,
      totalFound: jobData.chunkedData.length,
      totalRetrieved: jobData.chunkedData.length,
      apiCallCount: 1,
      rawResponse: jobData.chunkedData
    };
    
    const extractionResult = await extractOpportunitiesWithSchema(
      rawDataForExtraction,
      { id: jobData.sourceId, name: jobData.processingInstructions.sourceName || 'Unknown' },
      anthropic,
      jobData.processingInstructions
    );
    
    const extractionTime = Date.now() - extractionStartTime;
    const extractedOpportunities = extractionResult.opportunities || [];
    
    // Add source tracking to extracted opportunities
    const trackedOpportunities = extractedOpportunities.map(opportunity => ({
      ...opportunity,
      sourceId: jobData.sourceId,
      sourceName: jobData.processingInstructions.sourceName || 'Unknown',
      rawResponseId: jobData.rawResponseId
    }));
    
    await runManager.updateV2DataExtraction('completed', extractionResult, {
      execution_time_ms: extractionTime,
      opportunities_extracted: trackedOpportunities.length,
      extraction_efficiency: jobData.chunkedData.length > 0 ? (trackedOpportunities.length / jobData.chunkedData.length * 100).toFixed(1) : 0,
      total_tokens: extractionResult.extractionMetrics?.totalTokens || 0
    }, extractionResult.extractionMetrics?.totalTokens || 0, extractionResult.extractionMetrics?.totalApiCalls || 0, jobData.chunkedData.length, trackedOpportunities.length, jobData.jobId);
    
    console.log(`[JobProcessor] ✅ LLM extraction complete: ${trackedOpportunities.length} opportunities extracted from ${jobData.chunkedData.length} raw items (${extractionTime}ms)`);
    
    if (trackedOpportunities.length === 0) {
      console.log(`[JobProcessor] ⚠️ No opportunities extracted - ending job processing`);
      return {
        status: 'success',
        pipeline: 'v2-job-queue',
        sourceId: jobData.sourceId,
        jobExecutionTime: Date.now() - startTime,
        totalOpportunitiesProcessed: jobData.chunkedData.length,
        extractedOpportunities: 0,
        message: 'No opportunities extracted from raw data',
        runId: runManager.runId,
        runManager: runManagerWasProvided ? runManager : null
      };
    }
    
    // === STAGE 1: Early Duplicate Detection ===
    // Now process the extracted and standardized opportunities
    console.log(`[JobProcessor] 🔍 Stage 1: Early Duplicate Detection (${trackedOpportunities.length} extracted opportunities)`);
    await runManager.updateV2EarlyDuplicateDetector('processing', null, {}, trackedOpportunities.length, 0, jobData.jobId);
    
    const duplicateStartTime = Date.now();
    let duplicateResult;
    
    if (forceFullProcessing) {
      // Bypass duplicate detection - treat all as new opportunities
      console.log(`[JobProcessor] ⚠️ Bypassing duplicate detection due to force full processing`);
      duplicateResult = {
        newOpportunities: trackedOpportunities,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: [],
        metrics: {
          totalProcessed: trackedOpportunities.length,
          newOpportunities: trackedOpportunities.length,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 0,
          executionTime: 1  // Minimal execution time for bypassed detection
        },
        enhancedMetrics: {
          forceFullProcessingBypassed: true
        }
      };
    } else {
      duplicateResult = await detectDuplicates(
        trackedOpportunities,
        jobData.sourceId,
        supabase,
        jobData.rawResponseId
      );
    }
    
    const duplicateTime = Date.now() - duplicateStartTime;
    
    await runManager.updateV2EarlyDuplicateDetector('completed', duplicateResult, {
      execution_time_ms: duplicateTime,
      duplicates_found: duplicateResult.opportunitiesToSkip?.length || 0,
      updates_found: duplicateResult.opportunitiesToUpdate?.length || 0,
      new_opportunities: duplicateResult.newOpportunities?.length || 0,
      force_full_processing: forceFullProcessing
    }, trackedOpportunities.length, (duplicateResult.newOpportunities?.length || 0) + (duplicateResult.opportunitiesToUpdate?.length || 0), jobData.jobId);
    
    console.log(`[JobProcessor] ✅ Duplicate detection complete: ${duplicateResult.newOpportunities?.length || 0} NEW, ${duplicateResult.opportunitiesToUpdate?.length || 0} UPDATE, ${duplicateResult.opportunitiesToSkip?.length || 0} SKIP`);
    
    // === STAGE 2A: Analysis Agent (NEW opportunities only) ===
    let enhancedOpportunities = [];
    let analysisTokensUsed = 0;
    if (duplicateResult.newOpportunities && duplicateResult.newOpportunities.length > 0) {
      console.log(`[JobProcessor] 🧠 Stage 2A: Analysis Agent (${duplicateResult.newOpportunities.length} NEW opportunities)`);
      await runManager.updateV2Analysis('processing', null, {}, duplicateResult.newOpportunities.length, 0, jobData.jobId);
      
      const analysisStartTime = Date.now();
      const analysisResult = await enhanceOpportunities(
        duplicateResult.newOpportunities,
        { id: jobData.sourceId, name: jobData.processingInstructions.sourceName || 'Unknown' },
        anthropic
      );
      const analysisTime = Date.now() - analysisStartTime;
      
      enhancedOpportunities = analysisResult.opportunities || [];
      analysisTokensUsed = analysisResult.analysisMetrics?.totalTokens || 0;
      
      await runManager.updateV2Analysis('completed', analysisResult, {
        execution_time_ms: analysisTime,
        opportunities_enhanced: enhancedOpportunities.length,
        average_enhancement_score: analysisResult.analysisMetrics?.averageScore || 0
      }, analysisResult.analysisMetrics?.totalTokens || 0, analysisResult.analysisMetrics?.totalApiCalls || 0, duplicateResult.newOpportunities.length, enhancedOpportunities.length, jobData.jobId);
      
      console.log(`[JobProcessor] ✅ Analysis complete: ${enhancedOpportunities.length} opportunities enhanced (${analysisResult.analysisMetrics?.totalTokens || 0} tokens)`);
    } else {
      console.log(`[JobProcessor] ⚠️ No NEW opportunities for analysis stage`);
    }
    
    // === STAGE 3A: Filter Function (analyzed opportunities only) ===
    let filteredOpportunities = [];
    if (enhancedOpportunities.length > 0) {
      console.log(`[JobProcessor] 🔍 Stage 3A: Filter Function (${enhancedOpportunities.length} opportunities)`);
      await runManager.updateV2Filter('processing', null, {}, enhancedOpportunities.length, 0, jobData.jobId);
      
      const filterStartTime = Date.now();
      const filterResult = await filterOpportunities(enhancedOpportunities);
      const filterTime = Date.now() - filterStartTime;
      
      filteredOpportunities = filterResult.opportunities || [];
      const filterPassRate = enhancedOpportunities.length > 0 ? (filteredOpportunities.length / enhancedOpportunities.length * 100).toFixed(1) : 0;
      
      await runManager.updateV2Filter('completed', filterResult, {
        execution_time_ms: filterTime,
        filter_pass_rate: parseFloat(filterPassRate),
        opportunities_filtered_out: enhancedOpportunities.length - filteredOpportunities.length
      }, enhancedOpportunities.length, filteredOpportunities.length, jobData.jobId);
      
      console.log(`[JobProcessor] ✅ Filter complete: ${filteredOpportunities.length}/${enhancedOpportunities.length} opportunities passed (${filterPassRate}% pass rate)`);
    } else {
      console.log(`[JobProcessor] ⚠️ No enhanced opportunities for filtering stage`);
    }
    
    // === STAGE 4A: Storage Agent (filtered NEW opportunities) ===
    let storageResults = null;
    if (filteredOpportunities.length > 0) {
      console.log(`[JobProcessor] 💾 Stage 4A: Storage Agent (${filteredOpportunities.length} NEW opportunities)`);
      await runManager.updateV2Storage('processing', null, {}, filteredOpportunities.length, 0, jobData.jobId);
      
      const storageStartTime = Date.now();
      storageResults = await storeOpportunities(
        filteredOpportunities,
        { id: jobData.sourceId, name: jobData.processingInstructions.sourceName || 'Unknown' },
        supabase,
        forceFullProcessing // Pass through the force full processing flag
      );
      const storageTime = Date.now() - storageStartTime;
      
      const successRate = filteredOpportunities.length > 0 ? (storageResults.results?.filter(r => r.success).length / filteredOpportunities.length * 100).toFixed(1) : 0;
      
      await runManager.updateV2Storage('completed', storageResults, {
        execution_time_ms: storageTime,
        storage_success_rate: parseFloat(successRate),
        opportunities_stored: storageResults.results?.filter(r => r.success).length || 0,
        storage_errors: storageResults.results?.filter(r => !r.success).length || 0
      }, storageResults.metrics?.totalTokens || 0, filteredOpportunities.length, storageResults.results?.filter(r => r.success).length || 0, jobData.jobId);
      
      console.log(`[JobProcessor] ✅ Storage complete: ${storageResults.results?.filter(r => r.success).length || 0}/${filteredOpportunities.length} opportunities stored (${successRate}% success rate)`);
    } else {
      console.log(`[JobProcessor] ⚠️ No filtered opportunities for storage stage`);
    }
    
    // === STAGE 4B: Direct Update Handler (UPDATE opportunities) ===
    let updateResults = null;
    if (duplicateResult.opportunitiesToUpdate && duplicateResult.opportunitiesToUpdate.length > 0) {
      console.log(`[JobProcessor] 🔄 Stage 4B: Direct Update Handler (${duplicateResult.opportunitiesToUpdate.length} UPDATE opportunities)`);
      await runManager.updateV2DirectUpdate('processing', null, {}, duplicateResult.opportunitiesToUpdate.length, 0, jobData.jobId);
      
      const updateStartTime = Date.now();
      updateResults = await updateDuplicateOpportunities(
        duplicateResult.opportunitiesToUpdate,
        supabase
      );
      const updateTime = Date.now() - updateStartTime;
      
      const updateSuccessRate = duplicateResult.opportunitiesToUpdate.length > 0 ? (updateResults.successful.length / duplicateResult.opportunitiesToUpdate.length * 100).toFixed(1) : 0;
      
      await runManager.updateV2DirectUpdate('completed', updateResults, {
        execution_time_ms: updateTime,
        update_success_rate: parseFloat(updateSuccessRate),
        opportunities_updated: updateResults.successful.length || 0,
        update_errors: updateResults.failed.length || 0
      }, duplicateResult.opportunitiesToUpdate.length, updateResults.successful.length || 0, jobData.jobId);
      
      console.log(`[JobProcessor] ✅ Direct updates complete: ${updateResults.successful.length || 0}/${duplicateResult.opportunitiesToUpdate.length} opportunities updated (${updateSuccessRate}% success rate)`);
    } else {
      console.log(`[JobProcessor] ⚠️ No opportunities for direct update stage`);
    }
    
    // === Final Results ===
    const totalExecutionTime = Date.now() - startTime;
    
    const results = {
      status: 'success',
      pipeline: 'v2-job-queue',
      sourceId: jobData.sourceId,
      jobExecutionTime: totalExecutionTime,
      totalRawItemsProcessed: jobData.chunkedData.length,
      totalOpportunitiesExtracted: trackedOpportunities.length,
      
      // Stage results
      extraction: {
        rawItems: jobData.chunkedData.length,
        extractedOpportunities: trackedOpportunities.length,
        extractionEfficiency: jobData.chunkedData.length > 0 ? ((trackedOpportunities.length / jobData.chunkedData.length) * 100).toFixed(1) : 0,
        tokensUsed: extractionResult.extractionMetrics?.totalTokens || 0
      },
      
      duplicateDetection: {
        inputCount: trackedOpportunities.length,
        newCount: duplicateResult.newOpportunities?.length || 0,
        updateCount: duplicateResult.opportunitiesToUpdate?.length || 0,
        skipCount: duplicateResult.opportunitiesToSkip?.length || 0
      },
      
      analysis: {
        inputCount: duplicateResult.newOpportunities?.length || 0,
        outputCount: enhancedOpportunities.length,
        tokensUsed: analysisTokensUsed
      },
      
      filtering: {
        inputCount: enhancedOpportunities.length,
        outputCount: filteredOpportunities.length,
        passRate: enhancedOpportunities.length > 0 ? (filteredOpportunities.length / enhancedOpportunities.length * 100) : 0
      },
      
      storage: {
        newStored: storageResults?.results?.filter(r => r.success).length || 0,
        newErrors: storageResults?.results?.filter(r => !r.success).length || 0,
        updated: updateResults?.successful || 0,
        updateErrors: updateResults?.failed || 0
      },
      
      // Overall metrics
      totalProcessed: (storageResults?.results?.filter(r => r.success).length || 0) + (updateResults?.successful || 0),
      totalErrors: (storageResults?.results?.filter(r => !r.success).length || 0) + (updateResults?.failed || 0),
      totalTokensUsed: (extractionResult.extractionMetrics?.totalTokens || 0) + analysisTokensUsed,
      estimatedCostUsd: ((extractionResult.extractionMetrics?.totalTokens || 0) + analysisTokensUsed) / 1000 * 0.01,
      
      runId: runManager.runId,
      runManager: runManagerWasProvided ? runManager : null
    };
    
    console.log(`[JobProcessor] 🏁 Job processing complete: ${results.totalRawItemsProcessed} raw items → ${results.totalOpportunitiesExtracted} extracted → ${results.totalProcessed} final processed, ${results.totalErrors} errors (${totalExecutionTime}ms)`);
    console.log(`[JobProcessor] 📊 DEBUG Metrics: ${results.totalTokensUsed} tokens, $${results.estimatedCostUsd} cost, duplicates: ${results.duplicateDetection?.skipCount || 0}, stored: ${results.storage?.newStored || 0}`);
    
    return results;
    
  } catch (error) {
    console.error(`[JobProcessor] ❌ Job processing failed:`, error);
    
    // Update run manager with error and cleanup only if we created it
    if (runManager && !runManagerWasProvided) {
      try {
        await runManager.updateRunError(error, 'job_queue_processing');
      } catch (runError) {
        console.error(`[JobProcessor] ❌ Failed to update run error:`, runError);
      }
      
      // Cleanup RunManager resources only if we created it
      try {
        if (typeof runManager.cleanup === 'function') {
          await runManager.cleanup();
        }
      } catch (cleanupError) {
        console.error(`[JobProcessor] ❌ Failed to cleanup RunManager:`, cleanupError);
      }
    } else if (runManager && runManagerWasProvided) {
      // Just log the error to the provided runManager without cleanup
      try {
        await runManager.recordStageFailure('job_queue_processing', {
          message: error.message,
          type: error.constructor.name,
          timestamp: new Date().toISOString()
        });
      } catch (recordError) {
        console.error(`[JobProcessor] ❌ Failed to record stage failure:`, recordError);
      }
    }
    
    return {
      status: 'error',
      pipeline: 'v2-job-queue',
      sourceId: jobData.sourceId,
      error: {
        message: error.message,
        type: error.constructor.name,
        timestamp: new Date().toISOString()
      },
      jobExecutionTime: Date.now() - startTime,
      runManager: runManagerWasProvided ? runManager : null
    };
  }
}

/**
 * Validate job data structure before processing
 * @param {Object} jobData - Job data to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export function validateJobData(jobData) {
  const errors = [];
  
  if (!jobData) {
    errors.push('Job data is required');
    return { isValid: false, errors };
  }
  
  if (!jobData.sourceId || typeof jobData.sourceId !== 'string') {
    errors.push('sourceId is required and must be a string');
  }
  
  if (!jobData.chunkedData || !Array.isArray(jobData.chunkedData)) {
    errors.push('chunkedData is required and must be an array');
  } else if (jobData.chunkedData.length === 0) {
    errors.push('chunkedData cannot be empty');
  } else if (jobData.chunkedData.length > 5) {
    errors.push('chunkedData cannot contain more than 5 opportunities per job');
  }
  
  if (!jobData.processingInstructions || typeof jobData.processingInstructions !== 'object') {
    errors.push('processingInstructions is required and must be an object');
  }
  
  if (!jobData.rawResponseId || typeof jobData.rawResponseId !== 'string') {
    errors.push('rawResponseId is required and must be a string');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}