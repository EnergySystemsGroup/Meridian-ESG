/**
 * Local Cron Simulation Script
 * 
 * Simulates the Vercel cron job locally for testing the job queue processor.
 * Processes jobs every 10 seconds (faster than the real 2-minute interval for testing).
 */

import { processNextJob, getQueueStatus } from '../lib/services/simpleJobProcessor.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Simulate cron job processing
 */
async function simulateCron() {
  let tickCount = 0;
  let totalJobsProcessed = 0;
  let consecutiveEmptyTicks = 0;
  
  console.log('🕐 Starting local cron simulation...');
  console.log('⏱️  Processing interval: 10 seconds');
  console.log('🛑 Press Ctrl+C to stop\n');
  
  // Initial queue status
  try {
    console.log('📊 Initial queue status:');
    const initialStatus = await getQueueStatus();
    initialStatus.forEach(status => {
      console.log(`   ${status.status}: ${status.count} jobs`);
    });
    console.log('');
  } catch (error) {
    console.warn('⚠️ Could not get initial queue status:', error.message);
  }
  
  // Main processing loop
  while (true) {
    try {
      tickCount++;
      const now = new Date();
      const timestamp = now.toISOString();
      const timeString = now.toLocaleTimeString();
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🕐 Cron tick #${tickCount} at ${timeString}`);
      console.log(`${'='.repeat(60)}`);
      
      // Process next job
      const startTime = Date.now();
      const result = await processNextJob();
      const executionTime = Date.now() - startTime;
      
      if (result.processed) {
        totalJobsProcessed++;
        consecutiveEmptyTicks = 0;
        
        console.log(`\n✅ Job processed successfully in ${executionTime}ms:`);
        console.log(`   Job ID: ${result.jobId}`);
        console.log(`   Chunk: ${result.chunkIndex + 1}/${result.totalChunks}`);
        console.log(`   Items: ${result.itemsProcessed}`);
        console.log(`   Processing time: ${result.processingTimeMs}ms`);
        
      } else {
        consecutiveEmptyTicks++;
        console.log(`\n📭 No jobs to process (${result.message})`);
        
        if (consecutiveEmptyTicks >= 3) {
          console.log(`\n⏸️  Queue appears empty after ${consecutiveEmptyTicks} consecutive checks.`);
          console.log('📊 Getting final queue status...');
          
          try {
            const finalStatus = await getQueueStatus();
            const hasJobs = finalStatus.some(status => parseInt(status.count) > 0);
            
            if (!hasJobs) {
              console.log('✅ Queue is completely empty!');
              console.log(`🎉 Total jobs processed: ${totalJobsProcessed}`);
              console.log('🛑 Stopping simulation. Run createTestJobs.js to add more jobs.');
              break;
            } else {
              console.log('📋 Jobs still in queue:');
              finalStatus.forEach(status => {
                if (parseInt(status.count) > 0) {
                  console.log(`   ${status.status}: ${status.count} jobs`);
                }
              });
              consecutiveEmptyTicks = 0; // Reset counter
            }
          } catch (statusError) {
            console.warn('⚠️ Could not get queue status:', statusError.message);
          }
        }
      }
      
      // Show summary stats
      console.log(`\n📈 Session summary:`);
      console.log(`   Ticks completed: ${tickCount}`);
      console.log(`   Jobs processed: ${totalJobsProcessed}`);
      console.log(`   Last execution: ${executionTime}ms`);
      
      // Wait before next tick (10 seconds)
      console.log(`\n⏳ Waiting 10 seconds for next tick...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
    } catch (error) {
      console.error(`\n❌ Error in cron tick #${tickCount}:`, error);
      console.log('🔄 Continuing to next tick...');
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Show current queue status and exit
 */
async function showQueueStatus() {
  try {
    console.log('📊 Current queue status:');
    const status = await getQueueStatus();
    
    let totalJobs = 0;
    status.forEach(stat => {
      const count = parseInt(stat.count);
      totalJobs += count;
      console.log(`   ${stat.status}: ${count} jobs`);
    });
    
    console.log(`\n📋 Total jobs in queue: ${totalJobs}`);
    
    if (totalJobs === 0) {
      console.log('\n💡 To add test jobs, run: node scripts/createTestJobs.js');
    }
    
  } catch (error) {
    console.error('❌ Error getting queue status:', error);
  }
}

/**
 * Process a single job manually
 */
async function processSingleJob() {
  try {
    console.log('🔄 Processing single job...\n');
    
    const result = await processNextJob();
    
    if (result.processed) {
      console.log('✅ Job processed successfully:');
      console.log(`   Job ID: ${result.jobId}`);
      console.log(`   Chunk: ${result.chunkIndex + 1}/${result.totalChunks}`);
      console.log(`   Items: ${result.itemsProcessed}`);
      console.log(`   Processing time: ${result.processingTimeMs}ms`);
    } else {
      console.log(`📭 ${result.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error processing job:', error);
  }
}

/**
 * Show help information
 */
function showHelp() {
  console.log('Local Cron Simulation for Job Queue Testing');
  console.log('');
  console.log('Usage: node scripts/testCronLocal.js [command]');
  console.log('');
  console.log('Commands:');
  console.log('  (no args)   Start continuous cron simulation (10 second intervals)');
  console.log('  status      Show current queue status');
  console.log('  once        Process a single job and exit');
  console.log('  help        Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/testCronLocal.js          # Start simulation');
  console.log('  node scripts/testCronLocal.js status   # Check queue');
  console.log('  node scripts/testCronLocal.js once     # Process one job');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'simulate';
  
  switch (command) {
    case 'status':
      await showQueueStatus();
      break;
      
    case 'once':
      await processSingleJob();
      break;
      
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
      
    case 'simulate':
    default:
      // Set up graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n\n🛑 Received interrupt signal');
        console.log('🔄 Stopping cron simulation...');
        console.log('👋 Goodbye!');
        process.exit(0);
      });
      
      await simulateCron();
      break;
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}