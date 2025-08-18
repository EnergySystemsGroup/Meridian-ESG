/**
 * Simple Job Processor - Proof of Concept
 * 
 * Minimal implementation to test job queue processing concept.
 * Picks up jobs, simulates work, and marks them complete.
 */

import { JobQueueManager } from './jobQueueManager.js';

/**
 * Process the next available job from the queue
 * @returns {Promise<Object>} Processing result
 */
export async function processNextJob() {
  const jobQueueManager = new JobQueueManager();
  
  try {
    console.log('[SimpleJobProcessor] 🔍 Looking for next job...');
    
    // Get next pending job
    const job = await jobQueueManager.getNextPendingJob();
    if (!job) {
      console.log('[SimpleJobProcessor] 📭 No jobs in queue');
      return { 
        processed: false, 
        message: 'No jobs in queue',
        timestamp: new Date().toISOString()
      };
    }
    
    console.log(`[SimpleJobProcessor] 📋 Found job ${job.id}`);
    console.log(`[SimpleJobProcessor] 📊 Chunk ${job.chunk_index + 1}/${job.total_chunks}`);
    console.log(`[SimpleJobProcessor] 📦 Raw data items: ${job.raw_data?.length || 0}`);
    
    // Mark as processing
    const startTime = Date.now();
    await jobQueueManager.updateJobStatus(job.id, 'processing');
    console.log(`[SimpleJobProcessor] 🔄 Started processing job ${job.id}`);
    
    // Simulate processing work
    console.log('[SimpleJobProcessor] ⚙️ Processing data...');
    
    // Log each item in the chunk for visibility
    if (job.raw_data && Array.isArray(job.raw_data)) {
      job.raw_data.forEach((item, index) => {
        console.log(`[SimpleJobProcessor]   Item ${index + 1}: ${item.id || item.name || JSON.stringify(item).substring(0, 50)}`);
      });
    }
    
    // Simulate processing time (2-5 seconds)
    const processingTime = 2000 + Math.random() * 3000;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Calculate actual processing time
    const actualProcessingTime = Date.now() - startTime;
    
    // Mark as completed with metrics
    await jobQueueManager.updateJobStatus(job.id, 'completed', {
      processingTimeMs: actualProcessingTime,
      tokensUsed: Math.floor(Math.random() * 500) + 100, // Simulated token usage
      estimatedCostUsd: (Math.random() * 0.05 + 0.01).toFixed(4) // Simulated cost
    });
    
    console.log(`[SimpleJobProcessor] ✅ Completed job ${job.id} in ${actualProcessingTime}ms`);
    
    return {
      processed: true,
      jobId: job.id,
      chunkIndex: job.chunk_index,
      totalChunks: job.total_chunks,
      processingTimeMs: actualProcessingTime,
      itemsProcessed: job.raw_data?.length || 0,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('[SimpleJobProcessor] ❌ Error processing job:', error);
    
    // If we have a job ID, mark it as failed
    if (error.jobId) {
      try {
        await jobQueueManager.updateJobStatus(error.jobId, 'failed', {
          errorDetails: {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          }
        });
      } catch (updateError) {
        console.error('[SimpleJobProcessor] ❌ Failed to update job status:', updateError);
      }
    }
    
    return {
      processed: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get queue status for monitoring
 * @returns {Promise<Object>} Queue status
 */
export async function getQueueStatus() {
  const jobQueueManager = new JobQueueManager();
  
  try {
    const status = await jobQueueManager.getQueueStatus();
    console.log('[SimpleJobProcessor] 📊 Queue status:', status);
    return status;
  } catch (error) {
    console.error('[SimpleJobProcessor] ❌ Error getting queue status:', error);
    throw error;
  }
}