/**
 * JobQueueManager - Manages job queue operations for V2 pipeline chunk processing
 * 
 * This class handles creation, retrieval, and status management of processing jobs
 * that contain chunks of raw API data (~5 opportunities each) to be processed
 * through the V2 pipeline within Vercel's 60-second timeout limits.
 * 
 * Features:
 * - FIFO job queue processing (oldest first)
 * - Job status lifecycle management (pending → processing → completed/failed)
 * - Retry mechanism for failed jobs (max 3 attempts)
 * - Progress tracking integration with pipeline_runs table
 * - Performance metrics collection (processing time, tokens, cost)
 */

import { createSupabaseClient } from '../supabase.js';

export class JobQueueManager {
  constructor() {
    this.supabase = createSupabaseClient();
  }

  /**
   * Create a new processing job with raw data chunk
   * @param {string} sourceId - UUID of the API source
   * @param {string} masterRunId - UUID of the master pipeline run
   * @param {number} chunkIndex - Zero-based index of this chunk
   * @param {number} totalChunks - Total number of chunks for this run
   * @param {Object} rawDataChunk - Array of ~5 raw opportunities from API
   * @param {Object} processingConfig - Source configuration and processing instructions
   * @returns {Promise<Object>} Created job with ID
   */
  async createJob(sourceId, masterRunId, chunkIndex, totalChunks, rawDataChunk, processingConfig) {
    try {
      const { data, error } = await this.supabase
        .from('processing_jobs')
        .insert({
          source_id: sourceId,
          master_run_id: masterRunId,
          chunk_index: chunkIndex,
          total_chunks: totalChunks,
          raw_data: rawDataChunk,
          processing_config: processingConfig,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create job: ${error.message}`);
      }

      console.log(`[JobQueueManager] ✅ Created job ${data.id} for chunk ${chunkIndex + 1}/${totalChunks} (${rawDataChunk.length} opportunities)`);
      return data;
    } catch (error) {
      console.error(`[JobQueueManager] ❌ Error creating job:`, error);
      throw error;
    }
  }

  /**
   * Get the next pending job for processing (FIFO - oldest first)
   * @returns {Promise<Object|null>} Next job to process or null if queue is empty
   */
  async getNextPendingJob() {
    try {
      const { data, error } = await this.supabase
        .from('processing_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get next pending job: ${error.message}`);
      }

      if (data) {
        console.log(`[JobQueueManager] 📋 Retrieved job ${data.id} for processing (chunk ${data.chunk_index + 1}/${data.total_chunks})`);
      } else {
        console.log(`[JobQueueManager] 📭 No pending jobs in queue`);
      }

      return data;
    } catch (error) {
      console.error(`[JobQueueManager] ❌ Error getting next pending job:`, error);
      throw error;
    }
  }

  /**
   * Update job status with proper timestamp tracking and metrics
   * @param {string} jobId - UUID of the job to update
   * @param {string} status - New status (pending, processing, completed, failed, retrying)
   * @param {Object} options - Additional update options
   * @param {Object} options.errorDetails - Error details if status is 'failed'
   * @param {number} options.processingTimeMs - Processing time in milliseconds
   * @param {number} options.tokensUsed - Number of tokens consumed
   * @param {number} options.estimatedCostUsd - Estimated cost in USD
   * @returns {Promise<Object>} Updated job
   */
  async updateJobStatus(jobId, status, options = {}) {
    try {
      const updateData = { status };

      // Set timestamps based on status
      if (status === 'processing') {
        updateData.started_at = new Date().toISOString();
      } else if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString();
      }

      // Add optional metrics
      if (options.errorDetails) {
        updateData.error_details = options.errorDetails;
      }
      if (options.processingTimeMs !== undefined) {
        updateData.processing_time_ms = options.processingTimeMs;
      }
      if (options.tokensUsed !== undefined) {
        updateData.tokens_used = options.tokensUsed;
      }
      if (options.estimatedCostUsd !== undefined) {
        updateData.estimated_cost_usd = options.estimatedCostUsd;
      }

      // Handle retry count increment
      if (status === 'retrying') {
        const { data: currentJob } = await this.supabase
          .from('processing_jobs')
          .select('retry_count')
          .eq('id', jobId)
          .single();
        
        updateData.retry_count = (currentJob?.retry_count || 0) + 1;
        updateData.status = 'pending'; // Reset to pending for retry
      }

      const { data, error } = await this.supabase
        .from('processing_jobs')
        .update(updateData)
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update job status: ${error.message}`);
      }

      const statusEmoji = {
        'pending': '⏳',
        'processing': '🔄',
        'completed': '✅',
        'failed': '❌',
        'retrying': '🔄'
      };

      console.log(`[JobQueueManager] ${statusEmoji[status]} Job ${jobId} status updated to: ${status}`);
      return data;
    } catch (error) {
      console.error(`[JobQueueManager] ❌ Error updating job status:`, error);
      throw error;
    }
  }

  /**
   * Get all jobs for a master run (for progress tracking)
   * @param {string} masterRunId - UUID of the master pipeline run
   * @returns {Promise<Array>} Array of jobs for the master run
   */
  async getJobsByMasterRun(masterRunId) {
    try {
      const { data, error } = await this.supabase
        .from('processing_jobs')
        .select('*')
        .eq('master_run_id', masterRunId)
        .order('chunk_index', { ascending: true });

      if (error) {
        throw new Error(`Failed to get jobs for master run: ${error.message}`);
      }

      console.log(`[JobQueueManager] 📊 Retrieved ${data.length} jobs for master run ${masterRunId}`);
      return data;
    } catch (error) {
      console.error(`[JobQueueManager] ❌ Error getting jobs for master run:`, error);
      throw error;
    }
  }

  /**
   * Get progress summary for a master run
   * @param {string} masterRunId - UUID of the master pipeline run
   * @returns {Promise<Object>} Progress summary with counts and percentages
   */
  async getMasterRunProgress(masterRunId) {
    try {
      const { data, error } = await this.supabase
        .from('processing_jobs')
        .select('status, chunk_index, total_chunks, processing_time_ms, tokens_used, estimated_cost_usd')
        .eq('master_run_id', masterRunId);

      if (error) {
        throw new Error(`Failed to get master run progress: ${error.message}`);
      }

      const totalJobs = data.length;
      const statusCounts = data.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {});

      const completedJobs = statusCounts.completed || 0;
      const failedJobs = statusCounts.failed || 0;
      const processingJobs = statusCounts.processing || 0;
      const pendingJobs = statusCounts.pending || 0;
      const retryingJobs = statusCounts.retrying || 0;

      const completionPercentage = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
      const totalProcessingTime = data.reduce((sum, job) => sum + (job.processing_time_ms || 0), 0);
      const totalTokens = data.reduce((sum, job) => sum + (job.tokens_used || 0), 0);
      const totalCost = data.reduce((sum, job) => sum + (parseFloat(job.estimated_cost_usd) || 0), 0);

      return {
        masterRunId,
        totalJobs,
        statusCounts: {
          pending: pendingJobs,
          processing: processingJobs,
          completed: completedJobs,
          failed: failedJobs,
          retrying: retryingJobs
        },
        completionPercentage,
        isComplete: completedJobs === totalJobs,
        hasFailures: failedJobs > 0,
        metrics: {
          totalProcessingTimeMs: totalProcessingTime,
          totalTokensUsed: totalTokens,
          totalEstimatedCostUsd: totalCost.toFixed(4)
        }
      };
    } catch (error) {
      console.error(`[JobQueueManager] ❌ Error getting master run progress:`, error);
      throw error;
    }
  }

  /**
   * Retry failed jobs that haven't exceeded max retry limit
   * @param {number} maxRetries - Maximum retry attempts (default: 3)
   * @returns {Promise<Array>} Array of jobs reset for retry
   */
  async retryFailedJobs(maxRetries = 3) {
    try {
      // Find failed jobs that can be retried
      const { data: failedJobs, error: selectError } = await this.supabase
        .from('processing_jobs')
        .select('id, retry_count, chunk_index, total_chunks')
        .eq('status', 'failed')
        .lt('retry_count', maxRetries);

      if (selectError) {
        throw new Error(`Failed to select failed jobs: ${selectError.message}`);
      }

      if (failedJobs.length === 0) {
        console.log(`[JobQueueManager] 🔄 No failed jobs eligible for retry`);
        return [];
      }

      // Reset failed jobs to pending status for retry
      const jobIds = failedJobs.map(job => job.id);
      const { data, error } = await this.supabase
        .from('processing_jobs')
        .update({
          status: 'pending',
          error_details: null,
          started_at: null,
          completed_at: null
        })
        .in('id', jobIds)
        .select();

      if (error) {
        throw new Error(`Failed to retry failed jobs: ${error.message}`);
      }

      console.log(`[JobQueueManager] 🔄 Reset ${data.length} failed jobs for retry`);
      return data;
    } catch (error) {
      console.error(`[JobQueueManager] ❌ Error retrying failed jobs:`, error);
      throw error;
    }
  }

  /**
   * Get job queue status summary
   * @returns {Promise<Object>} Queue status with counts and oldest job info
   */
  async getQueueStatus() {
    try {
      const { data, error } = await this.supabase.rpc('get_job_queue_status');

      if (error) {
        throw new Error(`Failed to get queue status: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error(`[JobQueueManager] ❌ Error getting queue status:`, error);
      throw error;
    }
  }

  /**
   * Clean up old completed jobs to prevent table bloat
   * @param {number} daysOld - Delete jobs older than this many days (default: 30)
   * @returns {Promise<number>} Number of jobs deleted
   */
  async cleanupOldJobs(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await this.supabase
        .from('processing_jobs')
        .delete()
        .eq('status', 'completed')
        .lt('completed_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to cleanup old jobs: ${error.message}`);
      }

      const deletedCount = data?.length || 0;
      console.log(`[JobQueueManager] 🧹 Cleaned up ${deletedCount} old completed jobs (older than ${daysOld} days)`);
      return deletedCount;
    } catch (error) {
      console.error(`[JobQueueManager] ❌ Error cleaning up old jobs:`, error);
      throw error;
    }
  }
}