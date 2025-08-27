/**
 * Dev Cron Worker
 * 
 * Automated job processing for development and staging environments.
 * Mimics Vercel cron behavior by making HTTP requests to the job processor endpoint.
 */

/**
 * DevCronWorker class for automated job processing in non-production environments
 */
export class DevCronWorker {
  constructor(options = {}) {
    // Configuration
    this.baseUrl = options.baseUrl || this.getDefaultBaseUrl();
    this.interval = options.interval || this.getDefaultInterval();
    this.maxEmptyChecks = options.maxEmptyChecks || 3;
    this.enableAutoStop = options.enableAutoStop !== false; // Default true
    
    // State
    this.running = false;
    this.timer = null;
    this.tickCount = 0;
    this.jobsProcessed = 0;
    this.consecutiveEmptyChecks = 0;
    this.startTime = null;
    
    // Logging prefix
    this.prefix = '[DevCron]';
  }
  
  /**
   * Get default base URL based on environment
   */
  getDefaultBaseUrl() {
    // Use API_URL for GitHub Actions, localhost for local dev
    return process.env.API_URL || 'http://localhost:3000';
  }
  
  /**
   * Get default interval based on environment
   */
  getDefaultInterval() {
    // Custom interval from env, or 10s for dev, 2min for staging/other
    if (process.env.CRON_INTERVAL) {
      return parseInt(process.env.CRON_INTERVAL);
    }
    
    // Local development: fast 10-second intervals
    if (!process.env.VERCEL && !process.env.CI) {
      return 10000; // 10 seconds
    }
    
    // Staging/CI: match production 2-minute intervals  
    return 120000; // 2 minutes
  }
  
  /**
   * Start the cron worker
   */
  async start() {
    if (this.running) {
      console.log(`${this.prefix} ⚠️ Worker already running`);
      return;
    }
    
    this.running = true;
    this.startTime = new Date();
    this.tickCount = 0;
    this.jobsProcessed = 0;
    this.consecutiveEmptyChecks = 0;
    
    const intervalMs = this.interval;
    const intervalDesc = intervalMs < 60000 
      ? `${intervalMs / 1000}s` 
      : `${intervalMs / 60000}m`;
    
    console.log(`${this.prefix} 🕐 Dev cron worker started`);
    console.log(`${this.prefix} ⏱️ Interval: ${intervalDesc}`);
    console.log(`${this.prefix} 🌐 Target: ${this.baseUrl}`);
    console.log(`${this.prefix} 🛑 Press Ctrl+C to stop\n`);
    
    // Initial status check
    await this.checkInitialStatus();
    
    // Start processing loop
    this.scheduleNext();
  }
  
  /**
   * Stop the cron worker
   */
  stop() {
    if (!this.running) return;
    
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    const duration = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    const durationDesc = duration > 0 ? `${Math.round(duration / 1000)}s` : 'unknown';
    
    console.log(`\n${this.prefix} 🛑 Worker stopped`);
    console.log(`${this.prefix} 📊 Session summary:`);
    console.log(`${this.prefix}    Duration: ${durationDesc}`);
    console.log(`${this.prefix}    Ticks: ${this.tickCount}`);
    console.log(`${this.prefix}    Jobs processed: ${this.jobsProcessed}`);
  }
  
  /**
   * Schedule the next processing tick
   */
  scheduleNext() {
    if (!this.running) return;
    
    this.timer = setTimeout(() => {
      this.processTick();
    }, this.interval);
  }
  
  /**
   * Process a single cron tick
   */
  async processTick() {
    if (!this.running) return;
    
    try {
      this.tickCount++;
      const now = new Date();
      const timeString = now.toLocaleTimeString();
      
      console.log(`\n${'='.repeat(50)}`);
      console.log(`${this.prefix} 🕐 Tick #${this.tickCount} at ${timeString}`);
      console.log(`${'='.repeat(50)}`);
      
      // Make HTTP request to job processor
      const startTime = Date.now();
      const result = await this.callJobProcessor();
      const executionTime = Date.now() - startTime;
      
      if (result.success && result.processed) {
        // Job was processed successfully
        this.jobsProcessed++;
        this.consecutiveEmptyChecks = 0;
        
        console.log(`${this.prefix} ✅ Job processed in ${executionTime}ms:`);
        console.log(`${this.prefix}    Job ID: ${result.jobId}`);
        console.log(`${this.prefix}    Chunk: ${result.chunkIndex + 1}/${result.totalChunks}`);
        console.log(`${this.prefix}    Master Run: ${result.masterRunId}`);
        console.log(`${this.prefix}    Opportunities: ${result.opportunitiesProcessed || 0}`);
        console.log(`${this.prefix}    Duplicates: ${result.duplicatesFound || 0}`);
        console.log(`${this.prefix}    Tokens: ${result.tokensUsed || 0}`);
        
      } else if (result.success && !result.processed) {
        // No jobs to process
        this.consecutiveEmptyChecks++;
        console.log(`${this.prefix} 📭 No jobs to process (${result.message || 'queue empty'})`);
        
        // Check for auto-stop condition
        if (this.enableAutoStop && this.consecutiveEmptyChecks >= this.maxEmptyChecks) {
          console.log(`${this.prefix} ⏸️ Queue empty for ${this.consecutiveEmptyChecks} checks`);
          
          // Verify queue is actually empty with status check
          const queueEmpty = await this.verifyQueueEmpty(result.queueStatus);
          if (queueEmpty) {
            console.log(`${this.prefix} ✅ Queue confirmed empty - auto-stopping`);
            console.log(`${this.prefix} 🎉 Total jobs processed: ${this.jobsProcessed}`);
            this.stop();
            return;
          } else {
            console.log(`${this.prefix} 🔄 Jobs still in queue - continuing`);
            this.consecutiveEmptyChecks = 0;
          }
        }
        
      } else {
        // Error occurred
        console.log(`${this.prefix} ❌ Error: ${result.error || 'Unknown error'}`);
        if (result.details) {
          console.log(`${this.prefix}    Details: ${result.details}`);
        }
      }
      
      // Show session progress
      console.log(`${this.prefix} 📈 Progress: ${this.tickCount} ticks, ${this.jobsProcessed} jobs, ${executionTime}ms last`);
      
      if (this.running) {
        const nextTick = new Date(Date.now() + this.interval);
        console.log(`${this.prefix} ⏳ Next tick: ${nextTick.toLocaleTimeString()}`);
        this.scheduleNext();
      }
      
    } catch (error) {
      console.error(`${this.prefix} ❌ Tick error:`, error.message);
      if (this.running) {
        console.log(`${this.prefix} 🔄 Continuing to next tick...`);
        this.scheduleNext();
      }
    }
  }
  
  /**
   * Make HTTP request to the job processor endpoint
   */
  async callJobProcessor() {
    const url = `${this.baseUrl}/api/cron/process-jobs`;
    
    try {
      // Prepare headers with optional authentication
      const headers = {
        'User-Agent': 'DevCronWorker/1.0',
        'Accept': 'application/json'
      };
      
      // Add authentication header if CRON_SECRET is configured
      if (process.env.CRON_SECRET) {
        headers['Authorization'] = `Bearer ${process.env.CRON_SECRET}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}`,
          details: response.statusText
        };
      }
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      return {
        success: false,
        error: 'Network error',
        details: error.message
      };
    }
  }
  
  /**
   * Check initial queue status
   */
  async checkInitialStatus() {
    try {
      console.log(`${this.prefix} 📊 Checking initial queue status...`);
      
      // Use POST with status action to get queue info
      const url = `${this.baseUrl}/api/cron/process-jobs`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ action: 'status' })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.queueStatus) {
          let totalJobs = 0;
          console.log(`${this.prefix} 📋 Initial queue status:`);
          data.queueStatus.forEach(status => {
            const count = parseInt(status.count) || 0;
            totalJobs += count;
            if (count > 0) {
              console.log(`${this.prefix}    ${status.status}: ${count} jobs`);
            }
          });
          
          if (totalJobs === 0) {
            console.log(`${this.prefix}    Queue is empty`);
          } else {
            console.log(`${this.prefix}    Total jobs: ${totalJobs}`);
          }
        }
      }
    } catch (error) {
      console.warn(`${this.prefix} ⚠️ Could not get initial status:`, error.message);
    }
    
    console.log(''); // Add spacing before main loop
  }
  
  /**
   * Verify the queue is actually empty
   */
  async verifyQueueEmpty(queueStatus) {
    if (!queueStatus || !Array.isArray(queueStatus)) {
      return true; // Assume empty if we can't check
    }
    
    // Check if any status has pending or processing jobs
    const hasActiveJobs = queueStatus.some(status => {
      const count = parseInt(status.count) || 0;
      return count > 0 && (status.status === 'pending' || status.status === 'processing');
    });
    
    return !hasActiveJobs;
  }
}

/**
 * Create and start a dev cron worker with default settings
 */
export async function startDevCronWorker(options = {}) {
  const worker = new DevCronWorker(options);
  await worker.start();
  return worker;
}

/**
 * Environment detection helper
 */
export function shouldRunDevCron() {
  // Don't run in production (Vercel handles it)
  if (process.env.VERCEL_ENV === 'production') {
    return false;
  }
  
  // Run in development, staging, or test environments
  return true;
}