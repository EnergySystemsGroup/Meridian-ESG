// Test Environment Configuration
// Manages environment variables and configuration for tests

// Store original environment
const originalEnv = { ...process.env }

// Test environment defaults
const TEST_ENV_DEFAULTS = {
  // Database
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  
  // API Keys
  ANTHROPIC_API_KEY: 'test-anthropic-key',
  GRANTS_GOV_API_KEY: 'test-grants-gov-key',
  PERPLEXITY_API_KEY: 'test-perplexity-key',
  
  // Application Config
  NODE_ENV: 'test',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  
  // Feature Flags
  ENABLE_V2_PIPELINE: 'true',
  ENABLE_FORCE_FULL_REPROCESSING: 'true',
  ENABLE_DEBUG_LOGGING: 'false',
  
  // Rate Limits
  MAX_CONCURRENT_REQUESTS: '5',
  RATE_LIMIT_PER_MINUTE: '60',
  
  // Processing Config
  BATCH_SIZE: '10',
  PROCESSING_TIMEOUT_MS: '30000',
  MAX_RETRIES: '3',
  
  // Token Limits
  MAX_TOKENS_PER_REQUEST: '4000',
  MAX_TOKENS_PER_RUN: '100000'
}

// Setup test environment
const setupTestEnvironment = (customEnv = {}) => {
  // Apply test defaults
  Object.keys(TEST_ENV_DEFAULTS).forEach(key => {
    if (!(key in process.env)) {
      process.env[key] = TEST_ENV_DEFAULTS[key]
    }
  })
  
  // Apply custom environment variables
  Object.keys(customEnv).forEach(key => {
    process.env[key] = customEnv[key]
  })
  
  // Set test-specific configurations
  process.env.NODE_ENV = 'test'
  
  // Disable external API calls in tests
  process.env.DISABLE_EXTERNAL_APIS = 'true'
  
  // Use test database
  process.env.USE_TEST_DATABASE = 'true'
  
  return process.env
}

// Reset environment to original state
const resetTestEnvironment = () => {
  // Clear all environment variables
  Object.keys(process.env).forEach(key => {
    delete process.env[key]
  })
  
  // Restore original environment
  Object.keys(originalEnv).forEach(key => {
    process.env[key] = originalEnv[key]
  })
}

// Get environment variable with fallback
const getEnvVar = (key, fallback = null) => {
  return process.env[key] || TEST_ENV_DEFAULTS[key] || fallback
}

// Check if running in test environment
const isTestEnvironment = () => {
  return process.env.NODE_ENV === 'test'
}

// Check if feature is enabled
const isFeatureEnabled = (featureName) => {
  const envKey = `ENABLE_${featureName.toUpperCase().replace(/-/g, '_')}`
  const value = getEnvVar(envKey, 'false')
  return value === 'true' || value === '1'
}

// Get numeric environment variable
const getNumericEnvVar = (key, fallback = 0) => {
  const value = getEnvVar(key, fallback)
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? fallback : parsed
}

// Configure test timeouts
const configureTestTimeouts = () => {
  // Set Jest timeout
  if (global.jest) {
    jest.setTimeout(getNumericEnvVar('TEST_TIMEOUT_MS', 30000))
  }
  
  // Return timeout values for use in tests
  return {
    unit: getNumericEnvVar('UNIT_TEST_TIMEOUT', 5000),
    integration: getNumericEnvVar('INTEGRATION_TEST_TIMEOUT', 15000),
    e2e: getNumericEnvVar('E2E_TEST_TIMEOUT', 30000),
    api: getNumericEnvVar('API_TEST_TIMEOUT', 10000)
  }
}

// Mock environment for specific test scenarios
const mockEnvironmentScenario = (scenario) => {
  const scenarios = {
    'production': {
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://production.supabase.co',
      ENABLE_DEBUG_LOGGING: 'false',
      MAX_CONCURRENT_REQUESTS: '20'
    },
    'development': {
      NODE_ENV: 'development',
      ENABLE_DEBUG_LOGGING: 'true',
      MAX_CONCURRENT_REQUESTS: '5'
    },
    'ci': {
      NODE_ENV: 'test',
      CI: 'true',
      DISABLE_EXTERNAL_APIS: 'true',
      USE_TEST_DATABASE: 'true'
    },
    'rate-limited': {
      MAX_CONCURRENT_REQUESTS: '1',
      RATE_LIMIT_PER_MINUTE: '10'
    },
    'high-volume': {
      BATCH_SIZE: '100',
      MAX_CONCURRENT_REQUESTS: '50',
      MAX_TOKENS_PER_RUN: '1000000'
    }
  }
  
  const scenarioEnv = scenarios[scenario]
  if (!scenarioEnv) {
    throw new Error(`Unknown environment scenario: ${scenario}`)
  }
  
  return setupTestEnvironment(scenarioEnv)
}

// Environment validation
const validateTestEnvironment = () => {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.warn(`Missing required environment variables for tests: ${missing.join(', ')}`)
    console.warn('Using test defaults')
    setupTestEnvironment()
  }
  
  return missing.length === 0
}

// Export configuration for different test types
const getTestConfig = (testType = 'unit') => {
  const configs = {
    unit: {
      useRealDatabase: false,
      useRealAPIs: false,
      mockAllExternals: true,
      timeout: 5000
    },
    integration: {
      useRealDatabase: true,
      useRealAPIs: false,
      mockAllExternals: false,
      timeout: 15000
    },
    e2e: {
      useRealDatabase: true,
      useRealAPIs: true,
      mockAllExternals: false,
      timeout: 30000
    }
  }
  
  return configs[testType] || configs.unit
}

module.exports = {
  TEST_ENV_DEFAULTS,
  setupTestEnvironment,
  resetTestEnvironment,
  getEnvVar,
  isTestEnvironment,
  isFeatureEnabled,
  getNumericEnvVar,
  configureTestTimeouts,
  mockEnvironmentScenario,
  validateTestEnvironment,
  getTestConfig,
  originalEnv
}