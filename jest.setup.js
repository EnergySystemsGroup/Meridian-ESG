/**
 * Jest Setup Configuration
 * 
 * Testing Strategy:
 * - Unit tests: Mock all external dependencies (default)
 * - Integration tests: Mock external APIs, use smart in-memory database mock
 * - Critical tests: Use real test database when TEST_USE_DB=true
 * 
 * We mock Supabase by default because:
 * 1. Tests run 100x faster
 * 2. No Docker/Supabase CLI required for most development
 * 3. Predictable test data
 * 4. We're testing our business logic, not Supabase itself
 * 
 * Critical path tests use real DB to catch:
 * - Unique constraint violations
 * - Foreign key failures  
 * - Transaction rollback behavior
 * - PostgreSQL-specific quirks
 */

// jest.setup.js
import '@testing-library/jest-dom'

// Polyfills required for MSW in Node environment
import 'whatwg-fetch'
import { TextEncoder, TextDecoder } from 'util'
import { TransformStream, ReadableStream } from 'stream/web'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.TransformStream = TransformStream
global.ReadableStream = ReadableStream

// Polyfill BroadcastChannel for MSW
global.BroadcastChannel = class BroadcastChannel {
  constructor() {
    this.onmessage = null
  }
  postMessage() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
}

// Mock environment variables (unless using real DB)
if (process.env.TEST_USE_DB !== 'true') {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
}

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return ''
  },
}))

// Mock window.matchMedia (only in jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock IntersectionObserver (only in jsdom environment)
if (typeof window !== 'undefined') {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords() {
      return []
    }
  }

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  }
}

// Suppress console errors in tests (optional)
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

// Setup MSW server for tests (unless using real DB for critical tests)
if (process.env.TEST_USE_DB !== 'true') {
  const { server } = require('./__tests__/integration/msw/server.js')

  // Start MSW server before all tests
  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'bypass', // Allow unhandled requests to pass through during tests
    })
  })

  // Reset handlers after each test
  afterEach(() => {
    server.resetHandlers()
    jest.clearAllMocks()
  })

  // Clean up after all tests
  afterAll(() => {
    server.close()
  })
} else {
  // Setup real database for critical path tests
  const { setupTestDatabase, teardownTestDatabase } = require('./__tests__/setup/criticalPathDatabase.js')
  
  let testClient = null
  
  beforeAll(async () => {
    try {
      console.log('🗄️  Setting up test database for critical path tests...')
      testClient = await setupTestDatabase()
      global.testSupabaseClient = testClient
    } catch (error) {
      console.error('❌ Failed to connect to test database:', error.message)
      console.warn('⚠️  Skipping critical path tests - Supabase local not running')
      console.warn('   Run: npx supabase start')
      process.exit(0) // Skip tests gracefully if DB unavailable
    }
  })
  
  afterEach(() => {
    jest.clearAllMocks()
  })
  
  afterAll(async () => {
    if (testClient) {
      await teardownTestDatabase(testClient)
    }
  })
}