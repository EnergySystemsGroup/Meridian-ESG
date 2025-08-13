/**
 * Jest Global Setup for CI
 * Runs once before all test suites
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
  console.log('\n🚀 Starting Jest Global Setup for CI...\n');

  // Set environment variables
  process.env.NODE_ENV = 'test';
  process.env.CI = 'true';
  
  // Create test database URL if not exists
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/test_db';
  }

  // Check if we're in CI environment
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS;
  
  if (isCI) {
    console.log('📦 Running in CI environment');
    
    // Wait for services to be ready (PostgreSQL, etc.)
    await waitForServices();
    
    // Run database migrations
    await runDatabaseSetup();
    
    // Seed test data if needed
    await seedTestData();
  } else {
    console.log('💻 Running in local environment');
  }

  // Clear any previous test artifacts
  clearTestArtifacts();

  // Initialize MSW if needed
  await initializeMSW();

  console.log('\n✅ Global setup completed\n');
};

/**
 * Wait for external services to be ready
 */
async function waitForServices() {
  console.log('⏳ Waiting for services...');
  
  // Wait for PostgreSQL
  const maxAttempts = 30;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      // Try to connect to PostgreSQL
      const { Client } = require('pg');
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
      });
      
      await client.connect();
      await client.end();
      
      console.log('✅ PostgreSQL is ready');
      return;
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Failed to connect to PostgreSQL');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Run database setup and migrations
 */
async function runDatabaseSetup() {
  console.log('🗄️  Setting up test database...');
  
  return new Promise((resolve, reject) => {
    const migrate = spawn('npx', ['supabase', 'db', 'reset', '--db-url', process.env.DATABASE_URL], {
      stdio: 'inherit',
      env: { ...process.env },
    });

    migrate.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Database setup failed with code ${code}`));
      } else {
        console.log('✅ Database setup completed');
        resolve();
      }
    });
  });
}

/**
 * Seed test data
 */
async function seedTestData() {
  console.log('🌱 Seeding test data...');
  
  const seedFile = path.join(__dirname, '..', '..', 'supabase', 'seed.sql');
  
  if (fs.existsSync(seedFile)) {
    return new Promise((resolve, reject) => {
      const seed = spawn('psql', [process.env.DATABASE_URL, '-f', seedFile], {
        stdio: 'inherit',
        env: { ...process.env },
      });

      seed.on('close', (code) => {
        if (code !== 0) {
          console.warn('⚠️  Seed data failed to load');
        } else {
          console.log('✅ Test data seeded');
        }
        resolve(); // Don't fail tests if seeding fails
      });
    });
  } else {
    console.log('ℹ️  No seed file found, skipping');
  }
}

/**
 * Clear previous test artifacts
 */
function clearTestArtifacts() {
  console.log('🧹 Clearing test artifacts...');
  
  const artifactDirs = [
    'coverage',
    'coverage-ci',
    'test-results',
    'test-report',
    '.nyc_output',
  ];
  
  for (const dir of artifactDirs) {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`  Removed ${dir}/`);
    }
  }
}

/**
 * Initialize MSW for API mocking
 */
async function initializeMSW() {
  console.log('🎭 Initializing MSW...');
  
  try {
    const { server } = require('../../__tests__/integration/msw/server');
    
    // Start the server
    server.listen({
      onUnhandledRequest: 'warn',
    });
    
    // Store server reference globally for teardown
    global.__MSW_SERVER__ = server;
    
    console.log('✅ MSW server started');
  } catch (error) {
    console.warn('⚠️  Could not initialize MSW:', error.message);
  }
}