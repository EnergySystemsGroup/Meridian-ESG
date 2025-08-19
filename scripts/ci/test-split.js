#!/usr/bin/env node

/**
 * Test Split Script for Parallel Execution
 * Intelligently splits tests across multiple workers for optimal performance
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const TEST_DIRECTORIES = {
  unit: '__tests__/unit',
  integration: '__tests__/integration',
  e2e: '__tests__/e2e',
};

const MAX_WORKERS = parseInt(process.env.MAX_WORKERS || '4');
const TIMING_DATA_FILE = '.test-timings.json';

/**
 * Get all test files matching patterns
 */
function getTestFiles(pattern) {
  return glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/coverage/**', '**/dist/**'],
  });
}

/**
 * Load historical timing data if available
 */
function loadTimingData() {
  try {
    if (fs.existsSync(TIMING_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(TIMING_DATA_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn('Could not load timing data:', error.message);
  }
  return {};
}

/**
 * Estimate test file execution time
 */
function estimateExecutionTime(file, timingData) {
  // Use historical data if available
  if (timingData[file]) {
    return timingData[file].averageTime || 1000;
  }

  // Estimate based on file size and type
  const stats = fs.statSync(file);
  const sizeInKB = stats.size / 1024;
  
  // Base time estimation (ms)
  let baseTime = 500;
  
  // Adjust based on file size
  baseTime += sizeInKB * 10;
  
  // Adjust based on test type
  if (file.includes('integration')) {
    baseTime *= 2;
  } else if (file.includes('e2e')) {
    baseTime *= 3;
  }
  
  // Adjust based on specific patterns
  if (file.includes('api')) {
    baseTime *= 1.5;
  }
  if (file.includes('component')) {
    baseTime *= 1.2;
  }
  
  return baseTime;
}

/**
 * Split tests into balanced groups
 */
function splitTests(testFiles, numWorkers, timingData) {
  // Create test items with estimated times
  const testItems = testFiles.map(file => ({
    file,
    estimatedTime: estimateExecutionTime(file, timingData),
  }));
  
  // Sort by estimated time (longest first)
  testItems.sort((a, b) => b.estimatedTime - a.estimatedTime);
  
  // Initialize workers
  const workers = Array.from({ length: numWorkers }, (_, i) => ({
    id: i + 1,
    files: [],
    totalTime: 0,
  }));
  
  // Distribute tests using bin packing algorithm
  for (const item of testItems) {
    // Find worker with least total time
    const worker = workers.reduce((min, current) =>
      current.totalTime < min.totalTime ? current : min
    );
    
    worker.files.push(item.file);
    worker.totalTime += item.estimatedTime;
  }
  
  return workers;
}

/**
 * Generate test matrix for GitHub Actions
 */
function generateMatrix(workers) {
  const matrix = workers.map(worker => ({
    name: `Worker ${worker.id}`,
    id: worker.id,
    shard: `${worker.id}/${workers.length}`,
    files: worker.files,
    estimatedTime: Math.round(worker.totalTime / 1000), // Convert to seconds
  }));
  
  return {
    include: matrix,
  };
}

/**
 * Analyze and report test distribution
 */
function analyzeDistribution(workers) {
  const times = workers.map(w => w.totalTime);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const imbalance = ((maxTime - minTime) / avgTime * 100).toFixed(2);
  
  console.log('\n📊 Test Distribution Analysis:');
  console.log('================================');
  workers.forEach(worker => {
    const timeInSeconds = (worker.totalTime / 1000).toFixed(1);
    const fileCount = worker.files.length;
    console.log(`Worker ${worker.id}: ${fileCount} files, ~${timeInSeconds}s`);
  });
  console.log('--------------------------------');
  console.log(`Average time: ${(avgTime / 1000).toFixed(1)}s`);
  console.log(`Imbalance: ${imbalance}%`);
  
  if (parseFloat(imbalance) > 20) {
    console.warn('⚠️  High imbalance detected. Consider adjusting distribution.');
  } else {
    console.log('✅ Good balance achieved!');
  }
}

/**
 * Save timing data from test results
 */
function saveTimingData(testResults) {
  const timingData = loadTimingData();
  
  for (const result of testResults) {
    const file = result.testFilePath;
    const duration = result.duration || 1000;
    
    if (!timingData[file]) {
      timingData[file] = {
        runs: [],
        averageTime: duration,
      };
    }
    
    timingData[file].runs.push(duration);
    
    // Keep only last 10 runs
    if (timingData[file].runs.length > 10) {
      timingData[file].runs.shift();
    }
    
    // Calculate new average
    timingData[file].averageTime = 
      timingData[file].runs.reduce((a, b) => a + b, 0) / 
      timingData[file].runs.length;
  }
  
  fs.writeFileSync(TIMING_DATA_FILE, JSON.stringify(timingData, null, 2));
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Discovering test files...');
  
  // Get all test files
  const allTestFiles = [];
  
  // Unit tests
  const unitTests = getTestFiles('__tests__/unit/**/*.test.{js,jsx,ts,tsx}');
  console.log(`Found ${unitTests.length} unit test files`);
  allTestFiles.push(...unitTests);
  
  // Integration tests
  const integrationTests = getTestFiles('__tests__/integration/**/*.test.{js,jsx,ts,tsx}');
  console.log(`Found ${integrationTests.length} integration test files`);
  allTestFiles.push(...integrationTests);
  
  // E2E tests (if they exist)
  const e2eTests = getTestFiles('__tests__/e2e/**/*.test.{js,jsx,ts,tsx}');
  if (e2eTests.length > 0) {
    console.log(`Found ${e2eTests.length} e2e test files`);
    allTestFiles.push(...e2eTests);
  }
  
  console.log(`\nTotal: ${allTestFiles.length} test files\n`);
  
  // Load timing data
  const timingData = loadTimingData();
  
  // Split tests
  console.log(`📦 Splitting tests across ${MAX_WORKERS} workers...`);
  const workers = splitTests(allTestFiles, MAX_WORKERS, timingData);
  
  // Analyze distribution
  analyzeDistribution(workers);
  
  // Generate matrix
  const matrix = generateMatrix(workers);
  
  // Save matrix for GitHub Actions
  fs.writeFileSync('test-matrix.json', JSON.stringify(matrix));
  console.log('\n✅ Test matrix saved to test-matrix.json');
  
  // Generate worker-specific test lists
  workers.forEach(worker => {
    const fileName = `test-list-worker-${worker.id}.txt`;
    fs.writeFileSync(fileName, worker.files.join('\n'));
    console.log(`📝 Worker ${worker.id} test list saved to ${fileName}`);
  });
  
  // Output for GitHub Actions
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::set-output name=matrix::${JSON.stringify(matrix)}`);
  }
}

// Handle test results input for timing updates
if (process.argv[2] === '--update-timings') {
  const resultsFile = process.argv[3];
  if (resultsFile && fs.existsSync(resultsFile)) {
    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    saveTimingData(results.testResults || []);
    console.log('✅ Timing data updated');
  } else {
    console.error('❌ Results file not found');
    process.exit(1);
  }
} else {
  // Run main splitting logic
  main();
}

module.exports = {
  getTestFiles,
  splitTests,
  loadTimingData,
  saveTimingData,
};