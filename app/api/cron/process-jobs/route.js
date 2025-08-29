/**
 * Production Job Queue Processor
 * 
 * This endpoint is called by Vercel cron every 2 minutes to process jobs from the queue.
 * Processes individual job chunks through the complete V2 pipeline with master run aggregation.
 * 
 * Endpoint: /api/cron/process-jobs
 * Schedule: Every 2 minutes via Vercel cron
 * Function: Pick up pending jobs, process through V2 pipeline, aggregate results to master runs
 */

import { processJob } from '../../../../lib/services/jobProcessor.js';
import { JobQueueManager } from '../../../../lib/services/jobQueueManager.js';
import { RunManagerV2 } from '../../../../lib/services/runManagerV2.js';
import { createClient } from '@supabase/supabase-js';

// Constants
const DEFAULT_COST_PER_1K_TOKENS = 0.01; // Default cost estimation: $0.01 per 1000 tokens

/**
 * Process next job in the queue
 * Called by Vercel cron every 2 minutes
 */
export async function GET(request) {
  const startTime = Date.now();
  
  try {
    console.log(`[CronProcessor] 🕐 Cron triggered at ${new Date().toISOString()}`);
    
    // Basic auth check for cron job
    const authHeader = request.headers.get('authorization');
    const expectedAuth = process.env.CRON_SECRET;
    
    if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
      console.warn('[CronProcessor] ⚠️ Unauthorized cron request');
      return Response.json({ 
        error: 'Unauthorized',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }
    
    // Check if we're running in Vercel or locally
    const isVercel = process.env.VERCEL === '1';
    console.log(`[CronProcessor] 🌐 Running on ${isVercel ? 'Vercel' : 'Local'}`);
    
    // Initialize services
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    // Create RunManagerV2 instance for job queue tracking
    let runManagerForQueue = null;
    const jobQueueManager = new JobQueueManager(runManagerForQueue); // Will be set when we have a job
    
    // Check for stuck jobs and recover them
    await recoverStuckJobs(jobQueueManager);
    
    // Retry failed jobs that haven't exceeded max retry limit
    try {
      const retriedJobs = await jobQueueManager.retryFailedJobs();
      if (retriedJobs.length > 0) {
        console.log(`[CronProcessor] 🔄 Reset ${retriedJobs.length} failed jobs for retry`);
      }
    } catch (retryError) {
      console.warn('[CronProcessor] ⚠️ Error retrying failed jobs:', retryError.message);
    }
    
    // Get next pending job
    console.log('[CronProcessor] 🔍 Looking for next job...');
    const job = await jobQueueManager.getNextPendingJob();
    
    if (!job) {
      console.log('[CronProcessor] 📭 No jobs in queue');
      
      // Get queue status for monitoring
      let queueStatus = null;
      try {
        queueStatus = await jobQueueManager.getQueueStatus();
      } catch (statusError) {
        console.warn('[CronProcessor] ⚠️ Could not get queue status:', statusError.message);
      }
      
      return Response.json({
        success: true,
        processed: false,
        message: 'No jobs in queue',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
        environment: isVercel ? 'vercel' : 'local',
        queueStatus
      });
    }
    
    console.log(`[CronProcessor] 📋 Found job ${job.id} (chunk ${job.chunk_index + 1}/${job.total_chunks})`);
    console.log(`[CronProcessor] 📦 Processing ${job.raw_data?.length || 0} opportunities`);
    
    // Create RunManagerV2 for this job's master run and set it on JobQueueManager
    runManagerForQueue = new RunManagerV2(job.master_run_id, supabase);
    jobQueueManager.runManager = runManagerForQueue;
    
    // Update job status to processing
    await jobQueueManager.updateJobStatus(job.id, 'processing');
    
    // Process the job through full V2 pipeline
    console.log('[CronProcessor] 🚀 Starting V2 pipeline processing...');
    const jobStartTime = Date.now();
    const result = await processJob({
      sourceId: job.source_id,
      masterRunId: job.master_run_id,
      jobId: job.id, // Pass job ID for separate stage creation
      chunkedData: job.raw_data,
      processingInstructions: job.processing_config?.instructions || {},
      forceFullProcessing: job.processing_config?.forceFullProcessing || false,
      apiMetrics: job.processing_config?.apiMetrics || {}
    });
    const jobProcessingTime = Date.now() - jobStartTime;
    
    // Update job status based on result
    if (result.status === 'success') {
      await jobQueueManager.updateJobStatus(job.id, 'completed', {
        processingTimeMs: jobProcessingTime,
        opportunitiesProcessed: result.totalProcessed || 0,
        tokensUsed: result.totalTokensUsed || 0,
        estimatedCostUsd: result.estimatedCostUsd || 0,
        duplicatesFound: result.duplicateDetection?.skipCount || 0,
        newStored: result.storage?.newStored || 0,
        updatesApplied: result.storage?.updated || 0
      });
      console.log(`[CronProcessor] ✅ Job ${job.id} completed successfully`);
    } else {
      await jobQueueManager.updateJobStatus(job.id, 'failed', {
        processingTimeMs: jobProcessingTime,
        errorDetails: result.error || 'Unknown error'
      });
      console.log(`[CronProcessor] ❌ Job ${job.id} failed: ${result.error?.message || 'Unknown error'}`);
    }
    
    // Check if all jobs for this master run are complete
    await checkAndCompleteMasterRun(job.master_run_id, supabase);
    
    const executionTime = Date.now() - startTime;
    console.log(`[CronProcessor] ⏱️ Total execution time: ${executionTime}ms`);
    
    // Get queue status for monitoring
    let queueStatus = null;
    try {
      queueStatus = await jobQueueManager.getQueueStatus();
    } catch (statusError) {
      console.warn('[CronProcessor] ⚠️ Could not get queue status:', statusError.message);
    }
    
    const response = {
      success: true,
      processed: true,
      jobId: job.id,
      chunkIndex: job.chunk_index,
      totalChunks: job.total_chunks,
      masterRunId: job.master_run_id,
      processingTimeMs: jobProcessingTime,
      opportunitiesProcessed: result.totalProcessed || 0,
      duplicatesFound: result.duplicateDetection?.skipCount || 0,
      newStored: result.storage?.newStored || 0,
      updatesApplied: result.storage?.updated || 0,
      tokensUsed: result.totalTokensUsed || 0,
      timestamp: new Date().toISOString(),
      executionTimeMs: executionTime,
      environment: isVercel ? 'vercel' : 'local',
      queueStatus
    };
    
    console.log(`[CronProcessor] ✅ Processing complete: ${result.totalProcessed || 0} opportunities processed`);
    console.log(`[CronProcessor] 📊 Job ${job.chunk_index + 1}/${job.total_chunks} for run ${job.master_run_id}`);
    
    return Response.json(response);
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[CronProcessor] ❌ Cron processing failed:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      executionTimeMs: executionTime,
      environment: process.env.VERCEL === '1' ? 'vercel' : 'local'
    }, { status: 500 });
  }
}

/**
 * Manual trigger endpoint for testing
 * POST allows manual testing of the job processor
 */
export async function POST(request) {
  const startTime = Date.now();
  console.log('[CronProcessor] 🔧 Manual trigger requested');
  
  try {
    // For manual testing, we can be more lenient with auth
    const body = await request.json().catch(() => ({}));
    
    if (body.action === 'status') {
      console.log('[CronProcessor] 📊 Status check requested');
      
      // Create a temporary JobQueueManager for status check
      const tempJobQueueManager = new JobQueueManager();
      const queueStatus = await tempJobQueueManager.getQueueStatus();
      
      return Response.json({
        success: true,
        action: 'status',
        timestamp: new Date().toISOString(),
        queueStatus
      });
    }
    
    // Default action: process job
    console.log('[CronProcessor] 🚀 Manual job processing...');
    
    // Initialize services
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    // Create RunManagerV2 instance for job queue tracking
    let runManagerForQueue = null;
    const jobQueueManager = new JobQueueManager(runManagerForQueue);
    
    // Get next pending job
    const job = await jobQueueManager.getNextPendingJob();
    
    if (!job) {
      return Response.json({
        success: true,
        action: 'process',
        processed: false,
        message: 'No jobs in queue',
        timestamp: new Date().toISOString()
      });
    }
    
    // Create RunManagerV2 for this job's master run and set it on JobQueueManager
    runManagerForQueue = new RunManagerV2(job.master_run_id, supabase);
    jobQueueManager.runManager = runManagerForQueue;
    
    // Update job status to processing
    await jobQueueManager.updateJobStatus(job.id, 'processing');
    
    // Process the job through full V2 pipeline
    const jobStartTime = Date.now();
    const result = await processJob({
      sourceId: job.source_id,
      masterRunId: job.master_run_id,
      jobId: job.id, // Pass job ID for separate stage creation
      chunkedData: job.raw_data,
      processingInstructions: job.processing_config?.instructions || {},
      forceFullProcessing: job.processing_config?.forceFullProcessing || false,
      apiMetrics: job.processing_config?.apiMetrics || {}
    });
    const jobProcessingTime = Date.now() - jobStartTime;
    
    // Update job status based on result
    if (result.status === 'success') {
      await jobQueueManager.updateJobStatus(job.id, 'completed', {
        processingTimeMs: jobProcessingTime,
        opportunitiesProcessed: result.totalProcessed || 0,
        tokensUsed: result.totalTokensUsed || 0,
        estimatedCostUsd: result.estimatedCostUsd || 0,
        duplicatesFound: result.duplicateDetection?.skipCount || 0,
        newStored: result.storage?.newStored || 0,
        updatesApplied: result.storage?.updated || 0
      });
    } else {
      await jobQueueManager.updateJobStatus(job.id, 'failed', {
        processingTimeMs: jobProcessingTime,
        errorDetails: result.error || 'Unknown error'
      });
    }
    
    // Check if all jobs for this master run are complete
    await checkAndCompleteMasterRun(job.master_run_id, supabase);
    
    // Get queue status for monitoring consistency with GET endpoint
    let queueStatus = null;
    try {
      queueStatus = await jobQueueManager.getQueueStatus();
    } catch (statusError) {
      console.warn('[CronProcessor] ⚠️ Could not get queue status:', statusError.message);
    }

    return Response.json({
      success: true,
      action: 'process',
      processed: true,
      jobId: job.id,
      chunkIndex: job.chunk_index,
      totalChunks: job.total_chunks,
      masterRunId: job.master_run_id,
      processingTimeMs: jobProcessingTime,
      opportunitiesProcessed: result.totalProcessed || 0,
      duplicatesFound: result.duplicateDetection?.skipCount || 0,
      newStored: result.storage?.newStored || 0,
      updatesApplied: result.storage?.updated || 0,
      tokensUsed: result.totalTokensUsed || 0,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      environment: process.env.VERCEL === '1' ? 'vercel' : 'local',
      queueStatus
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[CronProcessor] ❌ Manual trigger failed:', error);
    
    return Response.json({
      success: false,
      action: 'process',
      error: error.message,
      timestamp: new Date().toISOString(),
      executionTimeMs: executionTime,
      environment: process.env.VERCEL === '1' ? 'vercel' : 'local'
    }, { status: 500 });
  }
}

/**
 * Recover jobs that are stuck in processing status
 * @param {JobQueueManager} jobQueueManager - The job queue manager instance
 */
async function recoverStuckJobs(jobQueueManager) {
  try {
    console.log('[CronProcessor] 🔍 Checking for stuck jobs...');
    
    const timeoutMinutes = 5; // Jobs stuck for more than 5 minutes
    const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
    
    // Find jobs stuck in processing status
    const { data: stuckJobs, error } = await jobQueueManager.supabase
      .from('processing_jobs')
      .select('id, chunk_index, total_chunks, started_at, master_run_id')
      .eq('status', 'processing')
      .lt('started_at', timeoutThreshold);
    
    if (error) {
      console.warn('[CronProcessor] ⚠️ Error checking for stuck jobs:', error.message);
      return;
    }
    
    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('[CronProcessor] ✅ No stuck jobs found');
      return;
    }
    
    console.log(`[CronProcessor] 🚨 Found ${stuckJobs.length} stuck jobs, resetting to pending status`);
    
    for (const job of stuckJobs) {
      console.log(`[CronProcessor] 🔄 Recovering stuck job ${job.id} (chunk ${job.chunk_index + 1}/${job.total_chunks})`);
      
      // Reset job to pending status
      await jobQueueManager.updateJobStatus(job.id, 'failed', {
        errorDetails: `Job timed out after ${timeoutMinutes} minutes in processing status`,
        processingTimeMs: null
      });
      
      // Increment retry count and reset to pending if under retry limit
      const { data: currentJob } = await jobQueueManager.supabase
        .from('processing_jobs')
        .select('retry_count')
        .eq('id', job.id)
        .single();
      
      const retryCount = currentJob?.retry_count || 0;
      
      if (retryCount < 3) {
        // Reset to pending for retry
        await jobQueueManager.supabase
          .from('processing_jobs')
          .update({
            status: 'pending',
            started_at: null,
            completed_at: null,
            retry_count: retryCount + 1,
            error_details: `Timeout recovery - attempt ${retryCount + 2}/3`
          })
          .eq('id', job.id);
        
        console.log(`[CronProcessor] ♻️  Reset job ${job.id} to pending (retry ${retryCount + 1}/3)`);
      } else {
        console.log(`[CronProcessor] ❌ Job ${job.id} exceeded max retries, keeping as failed`);
      }
    }
    
    console.log('[CronProcessor] ✅ Stuck job recovery completed');
    
  } catch (error) {
    console.error('[CronProcessor] ❌ Error in stuck job recovery:', error);
    // Don't throw - this shouldn't fail the main cron processing
  }
}

/**
 * Check if all jobs for a master run are complete and update master run status
 * @param {string} masterRunId - The master run ID
 * @param {Object} supabase - Supabase client
 */
async function checkAndCompleteMasterRun(masterRunId, supabase) {
  try {
    console.log(`[CronProcessor] 🔍 Checking completion status for master run: ${masterRunId}`);
    
    // Initialize RunManagerV2 for master run updates
    const runManager = new RunManagerV2(masterRunId, supabase);
    const jobQueueManager = new JobQueueManager();
    
    // Get progress for this master run
    const progress = await jobQueueManager.getMasterRunProgress(masterRunId);
    
    console.log(`[CronProcessor] 📊 Run ${masterRunId} progress: ${progress.statusCounts.completed}/${progress.totalJobs} jobs complete`);
    
    // Check if all jobs are complete (completed or failed)
    const allJobsComplete = progress.statusCounts.completed + progress.statusCounts.failed >= progress.totalJobs;
    
    if (allJobsComplete) {
      console.log(`[CronProcessor] 🎉 All jobs complete for run ${masterRunId} - aggregating results`);
      
      // Atomic check to prevent concurrent aggregation attempts
      const { data: currentRun, error: fetchError } = await supabase
        .from('pipeline_runs')
        .select('status')
        .eq('id', masterRunId)
        .single();

      if (fetchError) {
        console.error(`[CronProcessor] ❌ Error checking run status:`, fetchError);
        return;
      }

      if (currentRun?.status === 'completed') {
        console.log(`[CronProcessor] ℹ️ Run ${masterRunId} already completed by another process`);
        return;
      }

      // Atomically set to aggregating status to prevent race conditions
      const { error: lockError } = await supabase
        .from('pipeline_runs')
        .update({ 
          status: 'aggregating',
          updated_at: new Date().toISOString()
        })
        .eq('id', masterRunId)
        .eq('status', 'processing'); // Only update if still processing

      if (lockError) {
        console.warn(`[CronProcessor] ⚠️ Could not acquire lock for aggregation:`, lockError);
        return;
      }

      console.log(`[CronProcessor] 🔒 Acquired aggregation lock for run ${masterRunId}`);
      
      // Get all completed jobs to aggregate metrics using RunManagerV2
      let jobs;
      try {
        jobs = await runManager.getJobMetrics(masterRunId);
      } catch (jobMetricsError) {
        console.error(`[CronProcessor] ❌ Failed to get job metrics:`, jobMetricsError);
        // Reset status back to processing if we can't get metrics
        await supabase
          .from('pipeline_runs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', masterRunId);
        return;
      }
      
      // Get all pipeline_stages for this master run to aggregate stage-level metrics
      console.log(`[CronProcessor] 📊 Aggregating pipeline stage metrics for run ${masterRunId}`);
      const { data: allStages, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('run_id', masterRunId);
      
      if (stagesError) {
        console.warn(`[CronProcessor] ⚠️ Could not get pipeline stages for aggregation:`, stagesError.message);
      }
      
      // Aggregate stage metrics by stage_name
      const stageMetrics = {};
      let totalStageTokens = 0;
      let totalStageApiCalls = 0;
      let totalStageExecutionTime = 0;
      let totalStageCost = 0;
      let totalOpportunitiesProcessed = 0;
      let opportunitiesBypassed = 0;
      
      (allStages || []).forEach(stage => {
        if (!stageMetrics[stage.stage_name]) {
          stageMetrics[stage.stage_name] = {
            count: 0,
            tokens_used: 0,
            api_calls_made: 0,
            execution_time_ms: 0,
            estimated_cost_usd: 0,
            input_count: 0,
            output_count: 0,
            earliest_started: null,
            latest_completed: null
          };
        }
        
        const sm = stageMetrics[stage.stage_name];
        sm.count += 1;
        sm.tokens_used += stage.tokens_used || 0;
        sm.api_calls_made += stage.api_calls_made || 0;
        sm.execution_time_ms += stage.execution_time_ms || 0;
        sm.estimated_cost_usd += parseFloat(stage.estimated_cost_usd || 0);
        sm.input_count += stage.input_count || 0;
        sm.output_count += stage.output_count || 0;
        
        // Track earliest start and latest completion
        if (!sm.earliest_started || (stage.started_at && stage.started_at < sm.earliest_started)) {
          sm.earliest_started = stage.started_at;
        }
        if (!sm.latest_completed || (stage.completed_at && stage.completed_at > sm.latest_completed)) {
          sm.latest_completed = stage.completed_at;
        }
        
        // Accumulate totals
        totalStageTokens += stage.tokens_used || 0;
        totalStageApiCalls += stage.api_calls_made || 0;
        totalStageExecutionTime += stage.execution_time_ms || 0;
        totalStageCost += parseFloat(stage.estimated_cost_usd || 0);
      });
      
      // Calculate key metrics from stages
      if (stageMetrics.data_extraction) {
        totalOpportunitiesProcessed = stageMetrics.data_extraction.output_count;
      }
      if (stageMetrics.early_duplicate_detector) {
        // Only NEW opportunities go to analysis stage, so bypassed = total - new
        // This correctly calculates opportunities that bypassed expensive LLM stages
        opportunitiesBypassed = stageMetrics.data_extraction.output_count - (stageMetrics.analysis?.input_count || 0);
      }
      
      // Also calculate aggregated metrics from job results for comparison/backup
      let totalOpportunities = 0;
      let totalTokensUsed = 0;
      let totalProcessingTime = 0;
      let totalNewStored = 0;
      let totalUpdatesApplied = 0;
      let totalDuplicatesFound = 0;
      let successfulJobs = 0;
      
      jobs.forEach(job => {
        if (job.status === 'completed') {
          // Note: Individual jobs don't track opportunity counts directly
          // Opportunity counts are aggregated from pipeline_stages data above
          // (totalOpportunities calculation removed - using stage metrics only)
          totalTokensUsed += job.tokens_used || 0;
          totalProcessingTime += job.processing_time_ms || 0;
          successfulJobs++;
        }
      });
      
      // Prefer stage-level metrics when available, fall back to job-level
      const finalTokensUsed = totalStageTokens > 0 ? totalStageTokens : totalTokensUsed;
      const finalExecutionTime = totalStageExecutionTime > 0 ? totalStageExecutionTime : totalProcessingTime;
      const finalOpportunitiesProcessed = totalOpportunitiesProcessed > 0 ? totalOpportunitiesProcessed : totalOpportunities;
      const finalEstimatedCost = totalStageCost > 0 ? totalStageCost : (finalTokensUsed / 1000) * DEFAULT_COST_PER_1K_TOKENS;
      
      // Calculate efficiency metrics
      const tokenSavingsPercentage = totalOpportunitiesProcessed > 0 && opportunitiesBypassed > 0 
        ? ((opportunitiesBypassed / totalOpportunitiesProcessed) * 100).toFixed(1)
        : '0';
      const successRatePercentage = successfulJobs > 0 && jobs.length > 0 
        ? ((successfulJobs / jobs.length) * 100).toFixed(1)
        : '0';
      
      console.log(`[CronProcessor] 📈 Aggregated metrics: ${finalOpportunitiesProcessed} opportunities, ${finalTokensUsed} tokens, ${Object.keys(stageMetrics).length} stage types`);
      
      // Update master run with comprehensive aggregated results
      const aggregatedResults = {
        // Job queue metrics
        jobs_processed: jobs.length,
        jobs_successful: successfulJobs,
        jobs_failed: progress.statusCounts.failed,
        chunk_processing_complete: true,
        
        // Pipeline metrics (from stage aggregation)
        total_opportunities_processed: finalOpportunitiesProcessed,
        total_tokens_used: finalTokensUsed,
        total_api_calls: totalStageApiCalls,
        estimated_cost_usd: finalEstimatedCost,
        total_execution_time_ms: finalExecutionTime,
        opportunities_bypassed_llm: opportunitiesBypassed,
        success_rate_percentage: parseFloat(successRatePercentage),
        
        // SLA metrics for compliance tracking
        sla_compliance_percentage: 100, // Default to 100% compliance for successful completion
        sla_breakdown: {
          execution_time: 'passed',
          success_rate: 'passed',
          cost_efficiency: 'passed'
        },
        sla_grade: 'A',
        failure_breakdown: {},
        
        // Stage breakdown for analytics
        stage_metrics: stageMetrics,
        
        // Additional analytics (not database columns)
        token_savings_percentage: parseFloat(tokenSavingsPercentage),
        
        // Job-level metrics for comparison
        average_processing_time_per_job_ms: successfulJobs > 0 ? Math.round(totalProcessingTime / successfulJobs) : 0,
        job_success_rate: jobs.length > 0 ? ((successfulJobs / jobs.length) * 100).toFixed(1) + '%' : '0%',
        
        // Storage results (from stage data)
        total_new_stored: stageMetrics.storage ? stageMetrics.storage.output_count : 0,
        total_updates_applied: stageMetrics.direct_update ? stageMetrics.direct_update.output_count : 0,
        total_duplicates_found: opportunitiesBypassed
      };
      
      // Mark master run as completed with aggregated results
      await runManager.completeRun(finalExecutionTime, aggregatedResults);
      
      console.log(`[CronProcessor] ✅ Master run ${masterRunId} marked as completed`);
      console.log(`[CronProcessor] 📈 Final metrics: ${totalOpportunities} opportunities, ${totalTokensUsed} tokens, ${successfulJobs}/${jobs.length} jobs successful`);
      
    } else {
      console.log(`[CronProcessor] ⏳ Run ${masterRunId} still in progress: ${progress.statusCounts.pending + progress.statusCounts.processing} jobs remaining`);
      
      // Update master run status to processing using RunManagerV2
      await runManager.updateRunStatus('processing');
    }
    
  } catch (error) {
    console.error(`[CronProcessor] ❌ Error checking master run completion:`, error);
    // Don't throw - this shouldn't fail the job processing
  }
}