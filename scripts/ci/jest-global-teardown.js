/**
 * Jest Global Teardown for CI
 * Runs once after all test suites
 */

const fs = require('fs');
const path = require('path');

module.exports = async function globalTeardown() {
  console.log('\n🏁 Starting Jest Global Teardown...\n');

  // Stop MSW server if running
  if (global.__MSW_SERVER__) {
    console.log('🎭 Stopping MSW server...');
    global.__MSW_SERVER__.close();
  }

  // Clean up test database if in CI
  if (process.env.CI === 'true') {
    await cleanupDatabase();
  }

  // Generate final reports
  await generateReports();

  // Archive test artifacts
  archiveTestArtifacts();

  console.log('\n✅ Global teardown completed\n');
};

/**
 * Clean up test database
 */
async function cleanupDatabase() {
  console.log('🗑️  Cleaning up test database...');
  
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    
    await client.connect();
    
    // Drop all test data
    await client.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        -- Drop all tables in public schema
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    
    await client.end();
    console.log('✅ Database cleaned up');
  } catch (error) {
    console.warn('⚠️  Could not clean up database:', error.message);
  }
}

/**
 * Generate final test reports
 */
async function generateReports() {
  console.log('📊 Generating final reports...');
  
  // Merge coverage reports if they exist
  if (fs.existsSync('coverage')) {
    try {
      const { execSync } = require('child_process');
      
      // Generate coverage summary
      execSync('npx nyc report --reporter=text-summary', {
        stdio: 'inherit',
      });
      
      console.log('✅ Coverage reports generated');
    } catch (error) {
      console.warn('⚠️  Could not generate coverage reports:', error.message);
    }
  }

  // Generate test summary
  generateTestSummary();
}

/**
 * Generate test execution summary
 */
function generateTestSummary() {
  const summaryPath = 'test-summary.json';
  
  try {
    // Collect all test results
    const testResults = [];
    const resultsDir = 'test-results';
    
    if (fs.existsSync(resultsDir)) {
      const files = fs.readdirSync(resultsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = fs.readFileSync(path.join(resultsDir, file), 'utf8');
          const data = JSON.parse(content);
          testResults.push(data);
        }
      }
    }

    // Calculate summary statistics
    const summary = {
      timestamp: new Date().toISOString(),
      environment: process.env.CI ? 'CI' : 'Local',
      totalSuites: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0,
      testResults: [],
    };

    for (const result of testResults) {
      if (result.numTotalTestSuites) {
        summary.totalSuites += result.numTotalTestSuites;
        summary.totalTests += result.numTotalTests;
        summary.passedTests += result.numPassedTests;
        summary.failedTests += result.numFailedTests;
        summary.skippedTests += result.numPendingTests;
        summary.duration += result.startTime ? Date.now() - result.startTime : 0;
      }
    }

    // Save summary
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    // Print summary to console
    console.log('\n📈 Test Execution Summary:');
    console.log('================================');
    console.log(`Total Suites: ${summary.totalSuites}`);
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.passedTests}`);
    console.log(`❌ Failed: ${summary.failedTests}`);
    console.log(`⏭️  Skipped: ${summary.skippedTests}`);
    console.log(`⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    console.log('================================\n');
    
  } catch (error) {
    console.warn('⚠️  Could not generate test summary:', error.message);
  }
}

/**
 * Archive test artifacts for CI
 */
function archiveTestArtifacts() {
  if (process.env.CI !== 'true') {
    return;
  }

  console.log('📦 Archiving test artifacts...');
  
  const artifactsDir = 'test-artifacts';
  
  // Create artifacts directory
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Move important files to artifacts
  const filesToArchive = [
    'test-summary.json',
    'coverage/lcov.info',
    'coverage/coverage-summary.json',
    'test-results/junit.xml',
  ];

  for (const file of filesToArchive) {
    if (fs.existsSync(file)) {
      const fileName = path.basename(file);
      const destination = path.join(artifactsDir, fileName);
      
      try {
        fs.copyFileSync(file, destination);
        console.log(`  Archived ${fileName}`);
      } catch (error) {
        console.warn(`  Could not archive ${fileName}:`, error.message);
      }
    }
  }

  console.log('✅ Artifacts archived');
}