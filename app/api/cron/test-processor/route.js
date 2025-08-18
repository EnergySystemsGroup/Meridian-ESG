/**
 * Test Job Processor Cron API Route
 * 
 * This endpoint is called by Vercel cron every 2 minutes to process jobs from the queue.
 * Proof of concept for job queue processing system.
 */

import { processNextJob, getQueueStatus } from '../../../../lib/services/simpleJobProcessor.js';

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
    
    // Process one job
    console.log('[CronProcessor] 🚀 Starting job processing...');
    const result = await processNextJob();
    
    const executionTime = Date.now() - startTime;
    console.log(`[CronProcessor] ⏱️ Total execution time: ${executionTime}ms`);
    
    // Get queue status for monitoring
    let queueStatus = null;
    try {
      queueStatus = await getQueueStatus();
    } catch (statusError) {
      console.warn('[CronProcessor] ⚠️ Could not get queue status:', statusError.message);
    }
    
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      executionTimeMs: executionTime,
      environment: isVercel ? 'vercel' : 'local',
      result,
      queueStatus
    };
    
    if (result.processed) {
      console.log(`[CronProcessor] ✅ Job processed successfully: ${result.jobId}`);
    } else {
      console.log(`[CronProcessor] 📭 ${result.message}`);
    }
    
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
  console.log('[CronProcessor] 🔧 Manual trigger requested');
  
  try {
    // For manual testing, we can be more lenient with auth
    const body = await request.json().catch(() => ({}));
    
    if (body.action === 'status') {
      console.log('[CronProcessor] 📊 Status check requested');
      const queueStatus = await getQueueStatus();
      
      return Response.json({
        success: true,
        action: 'status',
        timestamp: new Date().toISOString(),
        queueStatus
      });
    }
    
    // Default action: process job
    console.log('[CronProcessor] 🚀 Manual job processing...');
    const result = await processNextJob();
    
    return Response.json({
      success: true,
      action: 'process',
      timestamp: new Date().toISOString(),
      result
    });
    
  } catch (error) {
    console.error('[CronProcessor] ❌ Manual trigger failed:', error);
    
    return Response.json({
      success: false,
      action: 'process',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}