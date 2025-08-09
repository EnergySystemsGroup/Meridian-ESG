// Test Database Setup and Teardown Utilities
// Provides utilities for managing test database state

const { createClient } = require('@supabase/supabase-js')

// Test database configuration
const TEST_DB_CONFIG = {
  url: process.env.TEST_SUPABASE_URL || 'http://localhost:54321',
  anonKey: process.env.TEST_SUPABASE_ANON_KEY || 'test-anon-key',
  serviceKey: process.env.TEST_SUPABASE_SERVICE_KEY || 'test-service-key'
}

// Create test database client
const createTestClient = (useServiceKey = false) => {
  const key = useServiceKey ? TEST_DB_CONFIG.serviceKey : TEST_DB_CONFIG.anonKey
  return createClient(TEST_DB_CONFIG.url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Database setup function - run before tests
const setupTestDatabase = async () => {
  const client = createTestClient(true)
  
  try {
    // Clear test data from relevant tables
    // Order matters due to foreign key constraints
    await client.from('runs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await client.from('funding_opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await client.from('api_sources').delete().neq('id', 'test-source')
    
    // Insert base test data
    await insertBaseTestData(client)
    
    return client
  } catch (error) {
    console.error('Failed to setup test database:', error)
    throw error
  }
}

// Database teardown function - run after tests
const teardownTestDatabase = async (client) => {
  if (!client) return
  
  try {
    // Clear all test data
    await client.from('runs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await client.from('funding_opportunities').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await client.from('api_sources').delete().neq('id', 'test-source')
  } catch (error) {
    console.error('Failed to teardown test database:', error)
  }
}

// Insert base test data
const insertBaseTestData = async (client) => {
  // Insert test API source
  const { error: sourceError } = await client
    .from('api_sources')
    .insert({
      id: 'test-grants-gov',
      name: 'Test Grants.gov',
      type: 'grants_gov',
      enabled: true,
      force_full_reprocessing: false,
      config: {
        api_key: 'test-key',
        base_url: 'https://api.grants.gov',
        rate_limit: 100
      }
    })
    .select()
    .single()

  if (sourceError && !sourceError.message.includes('duplicate')) {
    console.error('Failed to insert test source:', sourceError)
  }

  // Insert test funding opportunities
  const testOpportunities = [
    {
      api_opportunity_id: 'TEST-OPP-001',
      title: 'Test Research Grant',
      description: 'Test grant for research projects',
      source_id: 'test-grants-gov',
      close_date: '2024-12-31',
      open_date: '2024-01-01',
      posted_date: '2024-01-01',
      maximum_award: 500000,
      minimum_award: 50000,
      estimated_total_funding: 5000000,
      agency_name: 'Test Agency',
      status: 'posted',
      eligibility_score: 85
    },
    {
      api_opportunity_id: 'TEST-OPP-002',
      title: 'Test Innovation Grant',
      description: 'Test grant for innovation',
      source_id: 'test-grants-gov',
      close_date: '2024-11-30',
      open_date: '2024-01-15',
      posted_date: '2024-01-15',
      maximum_award: 1000000,
      minimum_award: 100000,
      estimated_total_funding: 10000000,
      agency_name: 'Test Agency',
      status: 'posted',
      eligibility_score: 75
    }
  ]

  const { error: oppError } = await client
    .from('funding_opportunities')
    .insert(testOpportunities)

  if (oppError && !oppError.message.includes('duplicate')) {
    console.error('Failed to insert test opportunities:', oppError)
  }
}

// Transaction wrapper for tests
const withTestTransaction = async (testFn) => {
  const client = createTestClient(true)
  
  try {
    // Start transaction (Supabase doesn't have native transactions in JS client)
    // So we use setup/teardown pattern instead
    await setupTestDatabase()
    
    // Run the test function
    const result = await testFn(client)
    
    return result
  } finally {
    // Always cleanup
    await teardownTestDatabase(client)
  }
}

// Helper to reset specific tables
const resetTable = async (tableName, client = null) => {
  const dbClient = client || createTestClient(true)
  
  try {
    await dbClient
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
  } catch (error) {
    console.error(`Failed to reset table ${tableName}:`, error)
    throw error
  }
}

// Helper to insert test data
const insertTestData = async (tableName, data, client = null) => {
  const dbClient = client || createTestClient(true)
  
  try {
    const { data: inserted, error } = await dbClient
      .from(tableName)
      .insert(data)
      .select()

    if (error) throw error
    return inserted
  } catch (error) {
    console.error(`Failed to insert test data into ${tableName}:`, error)
    throw error
  }
}

// Helper to get row count
const getRowCount = async (tableName, client = null) => {
  const dbClient = client || createTestClient(true)
  
  try {
    const { count, error } = await dbClient
      .from(tableName)
      .select('*', { count: 'exact', head: true })

    if (error) throw error
    return count
  } catch (error) {
    console.error(`Failed to get row count for ${tableName}:`, error)
    throw error
  }
}

module.exports = {
  TEST_DB_CONFIG,
  createTestClient,
  setupTestDatabase,
  teardownTestDatabase,
  withTestTransaction,
  resetTable,
  insertTestData,
  getRowCount,
  insertBaseTestData
}