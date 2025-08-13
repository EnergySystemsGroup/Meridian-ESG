import baseConfig from './jest.config.js'

// CI-specific Jest configuration
const ciConfig = {
  ...baseConfig,
  
  // CI-specific settings
  bail: 1, // Stop after first test failure
  ci: true, // Run in CI mode
  collectCoverage: true, // Always collect coverage in CI
  coverageDirectory: 'coverage-ci',
  
  // Strict coverage thresholds for CI
  coverageThresholds: {
    global: {
      branches: process.env.COVERAGE_THRESHOLD_BRANCHES || 50,
      functions: process.env.COVERAGE_THRESHOLD_FUNCTIONS || 50,
      lines: process.env.COVERAGE_THRESHOLD_LINES || 50,
      statements: process.env.COVERAGE_THRESHOLD_STATEMENTS || 50,
    },
    // Per-file thresholds for critical files
    './app/lib/agents-v2/**/*.{js,jsx}': {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    './app/api/**/*.{js,jsx}': {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  
  // Additional coverage reporters for CI
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'text-summary',
    'html',
    'cobertura', // For CI tools integration
    'json-summary', // For badge generation
  ],
  
  // Test reporter configuration for CI
  reporters: process.env.CI ? [
    'default',
    // Add jest-junit reporter when package is installed
    // ['jest-junit', { outputDirectory: './test-results', outputName: 'junit.xml' }],
    // Add jest-html-reporters when package is installed
    // ['jest-html-reporters', { publicPath: './test-report', filename: 'index.html' }],
  ] : ['default'],
  
  // Optimize for CI performance
  maxWorkers: process.env.CI ? '50%' : '75%',
  maxConcurrency: 5,
  
  // Cache configuration for CI
  cache: process.env.CI ? false : true, // Disable cache in CI for clean runs
  
  // Timeout configuration for CI
  testTimeout: 30000, // 30 seconds per test
  
  // Error handling
  errorOnDeprecated: true, // Fail on deprecated API usage
  
  // Verbose output in CI
  verbose: process.env.CI ? true : false,
  
  // Test environment variables
  testEnvironmentOptions: {
    ...baseConfig.testEnvironmentOptions,
    url: process.env.TEST_URL || 'http://localhost:3000',
  },
  
  // Global setup for CI
  globalSetup: './scripts/ci/jest-global-setup.js',
  globalTeardown: './scripts/ci/jest-global-teardown.js',
  
  // Watch mode plugins (disabled in CI)
  watchPlugins: process.env.CI ? [] : baseConfig.watchPlugins,
  
  // Notification configuration
  notify: false, // Disable desktop notifications in CI
  notifyMode: 'failure-change',
  
  // Test sequencer for optimized test order
  testSequencer: './scripts/ci/jest-test-sequencer.js',
  
  // Snapshot configuration for CI
  snapshotResolver: './scripts/ci/jest-snapshot-resolver.js',
  
  // Module paths for CI
  modulePaths: [
    '<rootDir>',
    '<rootDir>/node_modules',
  ],
  
  // Transform ignore patterns for CI
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@testing-library)/)',
  ],
  
  // Coverage path ignore patterns
  coveragePathIgnorePatterns: [
    ...baseConfig.coveragePathIgnorePatterns || [],
    '<rootDir>/scripts/',
    '<rootDir>/.github/',
    '<rootDir>/test-results/',
    '<rootDir>/coverage/',
  ],
  
  // Test match patterns with sharding support
  testMatch: process.env.TEST_PATTERN 
    ? [process.env.TEST_PATTERN]
    : baseConfig.testMatch,
  
  // Shard configuration for parallel execution
  shard: process.env.JEST_SHARD || undefined,
  
  // Silent mode for cleaner CI logs
  silent: process.env.CI && !process.env.DEBUG,
  
  // Update inline snapshots in CI (usually disabled)
  updateSnapshot: process.env.UPDATE_SNAPSHOTS === 'true',
}

export default ciConfig