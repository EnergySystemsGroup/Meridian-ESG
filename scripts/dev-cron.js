#!/usr/bin/env node

/**
 * Dev Cron Script
 * 
 * Standalone script to run the DevCronWorker for automated job processing
 * in development and staging environments.
 * 
 * Usage:
 *   node scripts/dev-cron.js              # Start worker with defaults
 *   node scripts/dev-cron.js --interval=5 # Custom interval (seconds)
 *   node scripts/dev-cron.js --help       # Show help
 */

import { DevCronWorker, shouldRunDevCron } from '../lib/services/devCronWorker.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Try to load .env.local first, then .env
try {
  dotenv.config({ path: join(projectRoot, '.env.local') });
} catch (e) {
  // Fallback to .env
  dotenv.config({ path: join(projectRoot, '.env') });
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    interval: null,
    baseUrl: null,
    maxEmptyChecks: null,
    enableAutoStop: true,
    help: false
  };
  
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--interval=')) {
      const seconds = parseInt(arg.split('=')[1]);
      if (seconds > 0) {
        options.interval = seconds * 1000; // Convert to milliseconds
      }
    } else if (arg.startsWith('--url=')) {
      options.baseUrl = arg.split('=')[1];
    } else if (arg.startsWith('--max-empty=')) {
      const checks = parseInt(arg.split('=')[1]);
      if (checks > 0) {
        options.maxEmptyChecks = checks;
      }
    } else if (arg === '--no-auto-stop') {
      options.enableAutoStop = false;
    }
  }
  
  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log('Dev Cron Worker - Automated Job Processing');
  console.log('');
  console.log('Usage: node scripts/dev-cron.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --interval=N      Processing interval in seconds (default: 10 for dev, 120 for staging)');
  console.log('  --url=URL         Base URL for API calls (default: http://localhost:3000)');
  console.log('  --max-empty=N     Max consecutive empty checks before auto-stop (default: 3)');
  console.log('  --no-auto-stop    Disable auto-stop when queue is empty');
  console.log('  --help, -h        Show this help message');
  console.log('');
  console.log('Environment Variables:');
  console.log('  CRON_INTERVAL     Custom interval in milliseconds');
  console.log('  API_URL           Base URL for API calls (used by GitHub Actions)');
  console.log('  VERCEL_ENV        Environment detection (production/preview/development)');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/dev-cron.js                    # Default settings');
  console.log('  node scripts/dev-cron.js --interval=5       # 5-second intervals');
  console.log('  node scripts/dev-cron.js --no-auto-stop     # Keep running even when empty');
  console.log('');
  console.log('The worker will automatically detect your environment and use appropriate');
  console.log('defaults: 10 seconds for local development, 2 minutes for staging.');
}

/**
 * Check environment compatibility
 */
function checkEnvironment() {
  if (!shouldRunDevCron()) {
    console.log('🚫 Dev cron worker not needed in production environment');
    console.log('💡 Production uses Vercel cron for job processing');
    process.exit(0);
  }
  
  // Environment info
  const env = process.env.NODE_ENV || 'development';
  const vercelEnv = process.env.VERCEL_ENV || 'none';
  const isCI = process.env.CI === 'true';
  
  console.log('🌍 Environment Info:');
  console.log(`   NODE_ENV: ${env}`);
  console.log(`   VERCEL_ENV: ${vercelEnv}`);
  console.log(`   CI: ${isCI ? 'yes' : 'no'}`);
  
  // Warn if Next.js might not be running
  if (!process.env.API_URL && !isCI) {
    console.log('\n💡 Make sure Next.js is running on http://localhost:3000');
    console.log('   Run "npm run dev" in another terminal or use "npm run dev:with-cron"');
  }
  
  console.log('');
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    return;
  }
  
  console.log('🤖 Dev Cron Worker Starting...\n');
  
  // Check environment
  checkEnvironment();
  
  // Create worker with parsed options
  const workerOptions = {};
  if (options.interval !== null) workerOptions.interval = options.interval;
  if (options.baseUrl !== null) workerOptions.baseUrl = options.baseUrl;
  if (options.maxEmptyChecks !== null) workerOptions.maxEmptyChecks = options.maxEmptyChecks;
  workerOptions.enableAutoStop = options.enableAutoStop;
  
  const worker = new DevCronWorker(workerOptions);
  
  // Set up graceful shutdown
  let shuttingDown = false;
  const gracefulShutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    
    console.log(`\n\n🛑 Received ${signal} - shutting down gracefully...`);
    worker.stop();
    
    // Give it a moment to finish current operations
    setTimeout(() => {
      console.log('👋 Dev cron worker stopped');
      process.exit(0);
    }, 1000);
  };
  
  // Handle various shutdown signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    if (!shuttingDown) {
      worker.stop();
      process.exit(1);
    }
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled rejection at:', promise, 'reason:', reason);
    if (!shuttingDown) {
      worker.stop();
      process.exit(1);
    }
  });
  
  // Start the worker
  try {
    await worker.start();
  } catch (error) {
    console.error('❌ Failed to start dev cron worker:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error in dev cron script:', error);
    process.exit(1);
  });
}