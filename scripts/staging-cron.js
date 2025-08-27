#!/usr/bin/env node
/**
 * Staging Cron Worker
 * 
 * Runs DevCronWorker against staging environment to process job queue.
 * This mimics what Vercel cron does in production.
 * 
 * Usage:
 *   API_URL=https://your-staging-url.vercel.app node scripts/staging-cron.js
 *   API_URL=https://your-staging-url.vercel.app CRON_SECRET=secret node scripts/staging-cron.js
 *   node scripts/staging-cron.js --url=https://your-staging-url.vercel.app --interval=30
 * 
 * Environment Variables:
 *   API_URL - Staging server URL (required)
 *   CRON_SECRET - Optional authentication secret for staging
 *   CRON_INTERVAL - Custom interval in milliseconds
 */

import { DevCronWorker } from '../lib/services/devCronWorker.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env files
config({ path: join(__dirname, '../.env.local') });
config({ path: join(__dirname, '../.env') });

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    interval: null,
    maxEmpty: null,
    autoStop: true,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    } else if (arg.startsWith('--interval=')) {
      options.interval = parseInt(arg.split('=')[1]) * 1000; // Convert seconds to milliseconds
    } else if (arg.startsWith('--max-empty=')) {
      options.maxEmpty = parseInt(arg.split('=')[1]);
    } else if (arg === '--no-auto-stop') {
      options.autoStop = false;
    }
  }

  return options;
}

// Show usage information
function showHelp() {
  console.log(`
Staging Cron Worker - Process staging job queue from local machine

Usage:
  node scripts/staging-cron.js [options]

Environment Variables:
  API_URL          Staging server URL (optional, defaults to known staging URL)
  CRON_SECRET      Optional authentication secret
  CRON_INTERVAL    Custom interval in milliseconds

Options:
  --url=URL        Override staging URL
  --interval=N     Set interval in seconds (default: 120 for staging)
  --max-empty=N    Stop after N consecutive empty checks (default: 5)
  --no-auto-stop   Disable auto-stop when queue is empty
  --help, -h       Show this help

Examples:
  # Basic usage (uses default staging URL)
  node scripts/staging-cron.js

  # With authentication
  CRON_SECRET=secret123 node scripts/staging-cron.js

  # Custom staging URL
  API_URL=https://your-staging-url.vercel.app node scripts/staging-cron.js

  # Custom interval (30 seconds for faster testing)
  node scripts/staging-cron.js --interval=30

  # Process queue once and stop
  node scripts/staging-cron.js --max-empty=1
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Determine staging URL with hardcoded default
  const defaultStagingUrl = 'https://meridian-esg-env-staging-development-bf4f2e8a.vercel.app';
  const stagingUrl = options.url || process.env.API_URL || defaultStagingUrl;

  // Validate URL
  try {
    new URL(stagingUrl);
  } catch (error) {
    console.error(`❌ Invalid URL: ${stagingUrl}`);
    process.exit(1);
  }

  // Check if this looks like a staging URL
  if (stagingUrl.includes('localhost') || stagingUrl.includes('127.0.0.1')) {
    console.warn('⚠️  Warning: URL looks like local development, not staging');
    console.warn(`   ${stagingUrl}`);
  }

  console.log('🚀 Starting Staging Cron Worker');
  console.log(`📡 Target: ${stagingUrl}`);
  
  if (stagingUrl === defaultStagingUrl) {
    console.log('🎯 Using default staging URL (override with API_URL or --url)');
  }
  
  if (process.env.CRON_SECRET) {
    console.log('🔐 Authentication: Enabled (CRON_SECRET found)');
  } else {
    console.log('🔓 Authentication: Disabled (no CRON_SECRET)');
  }

  // Create DevCronWorker configuration
  const workerOptions = {
    baseUrl: stagingUrl,
    enableAutoStop: options.autoStop,
    maxEmptyChecks: options.maxEmpty || 5,
    intervalMs: options.interval || (process.env.CRON_INTERVAL ? parseInt(process.env.CRON_INTERVAL) : 120000), // 2 minutes default for staging
    prefix: '[StagingCron]'
  };

  console.log(`⏰ Interval: ${workerOptions.intervalMs / 1000} seconds`);
  console.log(`🛑 Auto-stop: ${workerOptions.enableAutoStop ? 'Yes' : 'No'} (after ${workerOptions.maxEmptyChecks} empty checks)`);
  console.log('');

  // Create and start the worker
  try {
    const worker = new DevCronWorker(workerOptions);
    
    // Set up graceful shutdown handlers
    const shutdown = () => {
      console.log('\n🛑 Graceful shutdown requested...');
      worker.stop();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGHUP', shutdown);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught exception:', error);
      worker.stop();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
      worker.stop();
      process.exit(1);
    });

    // Start processing
    await worker.start();
    
  } catch (error) {
    console.error('❌ Failed to start staging cron worker:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});