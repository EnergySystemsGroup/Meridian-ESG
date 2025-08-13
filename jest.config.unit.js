import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  // Handle ESM packages like MSW v2
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/supabase/',
  ],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/vendor/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  transform: {
    // Use babel-jest to transpile tests with the babel preset
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|@bundled-es-modules)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you soon)
    '^@/(.*)$': '<rootDir>/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
    // Map relative imports of supabase.js to the mock
    '^\\.\\./\\.\\./supabase\\.js$': '<rootDir>/__mocks__/lib/supabase.js',
    '^\\.\\./\\.\\./\\.\\./supabase\\.js$': '<rootDir>/__mocks__/lib/supabase.js',
    '^\\.\\./\\.\\./\\.\\./utils/supabase\\.js$': '<rootDir>/__mocks__/utils/supabase.js',
    '^\\.\\./\\.\\./\\.\\./\\.\\./utils/supabase\\.js$': '<rootDir>/__mocks__/utils/supabase.js',
    // Map relative imports of anthropicClient to the mock
    '^\\.\\./\\.\\./utils/anthropicClient\\.js$': '<rootDir>/__mocks__/lib/agents-v2/utils/anthropicClient.js',
    // Map dataExtractionAgent submodule imports to mocks
    '^\\./(apiHandlers|extraction|storage)/index\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/dataExtractionAgent/$1/index.js',
    // Map relative imports within parallelCoordinator to mocks
    '^\\./(contentEnhancer|scoringAnalyzer)\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/analysisAgent/$1.js',
    // Map parallelCoordinator import from index.js to mock
    '^\\./parallelCoordinator\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/analysisAgent/parallelCoordinator.js',
    // Map storageAgent submodule imports to mocks
    '^\\./fundingSourceManager\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/storageAgent/fundingSourceManager.js',
    '^\\./dataSanitizer\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/storageAgent/dataSanitizer.js',
    '^\\./stateEligibilityProcessor\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/storageAgent/stateEligibilityProcessor.js',
    // Map absolute imports from tests
    '^\\.\\./\\.\\./\\.\\./lib/agents-v2/core/storageAgent/fundingSourceManager\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/storageAgent/fundingSourceManager.js',
    '^\\.\\./\\.\\./\\.\\./lib/agents-v2/core/storageAgent/dataSanitizer\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/storageAgent/dataSanitizer.js',
    '^\\./utils/fieldMapping\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/storageAgent/utils/fieldMapping.js',
    // Map locationParsing module to mock
    '^\\.\\./\\.\\./\\.\\./\\.\\./lib/agents-v2/core/storageAgent/utils/locationParsing\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/storageAgent/utils/locationParsing.js',
    '^\\./utils/locationParsing\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/storageAgent/utils/locationParsing.js',
  },
  // Speed up tests by using workers
  maxWorkers: '50%',
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig)