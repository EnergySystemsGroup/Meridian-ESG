# Test Scripts Guide

## Testing Strategy

We use a **three-tier hybrid testing approach**:

1. **Unit Tests** (200+ tests, ~5 seconds)
   - Pure mocks, no external dependencies
   - Test business logic in isolation
   
2. **Integration Tests** (50+ tests, ~10 seconds) 
   - Smart mocks with constraint simulation
   - Test component interactions
   
3. **Critical Path Tests** (10 tests, ~30 seconds)
   - Real PostgreSQL test database
   - Verify database-specific behavior

## Available Test Commands

### Basic Testing
- `npm test` - Run unit + integration tests (fast, no DB required)
- `npm run test:unit` - Run all unit tests
- `npm run test:integration` - Run all integration tests
- `npm run test:critical` - Run critical path tests (requires Supabase local)
- `npm run test:all` - Run all three test suites
- `npm run test:run` - Run tests sequentially (single worker)

### Specific Test Suites
- `npm run test:agents` - Test V2 pipeline agents
- `npm run test:pipeline` - Test complete pipeline flows
- `npm run test:api` - Test API routes (Node environment)
- `npm run test:components` - Test React components

### Development Tools
- `npm run test:watch` - Watch mode for TDD
- `npm run test:coverage` - Generate coverage report
- `npm run test:debug` - Debug tests with Chrome DevTools
- `npm run test:changed` - Test only changed files (since last commit)

### CI/CD Commands
- `npm run test:ci` - Full CI test suite with coverage
- `npm run test:ci:unit` - CI unit tests only
- `npm run test:ci:integration` - CI integration tests only
- `npm run test:ci:critical` - CI critical path tests (optional, can fail)
- `npm run test:ci:split` - Sharded test execution for parallel CI

### Future (Placeholder)
- `npm run test:e2e` - Playwright E2E tests (Task 47)

## Quick Examples

```bash
# Run specific agent tests
npm run test:agents

# Debug a failing test
npm run test:debug -- __tests__/unit/agents/analysisAgent.test.js

# Test only what changed
npm run test:changed

# Get coverage for pipeline tests
npm run test:coverage -- __tests__/integration/pipeline
```

## Performance Notes

- Default: Uses 75% of CPU cores for parallel execution
- `test:run`: Single worker for debugging race conditions
- CI mode: Uses 50% of cores to leave resources for other CI tasks
- Integration tests: Limited to 2 workers to avoid database conflicts

## Jest Mocking Error Fix Pattern

### Common Issue: Module Resolution with Relative Imports
The main issue we encounter is Jest can't match relative import paths with our mocks. For example:
- Code imports: `../../supabase.js`
- Mock location: `__mocks__/lib/supabase.js`
- Jest can't connect them

### The Solution: moduleNameMapper in jest.config.js
Add patterns to redirect relative imports to the mock locations:

```javascript
moduleNameMapper: {
  // Map relative imports of supabase.js to the mock
  '^\\.\\./\\.\\./supabase\\.js$': '<rootDir>/__mocks__/lib/supabase.js',
  '^\\.\\./\\.\\./\\.\\./\\.\\./utils/supabase\\.js$': '<rootDir>/__mocks__/lib/supabase.js',
  
  // Map relative imports of anthropicClient to the mock
  '^\\.\\./\\.\\./utils/anthropicClient\\.js$': '<rootDir>/__mocks__/lib/agents-v2/utils/anthropicClient.js',
  
  // Map dataExtractionAgent submodule imports to mocks
  '^\\./(apiHandlers|extraction|storage)/index\\.js$': '<rootDir>/__mocks__/lib/agents-v2/core/dataExtractionAgent/$1/index.js',
}
```

### Mock File Structure
- Consolidate mocks to the root `__mocks__` directory following Jest convention
- Mock path mirrors the actual module path
- Example: `lib/supabase.js` → `__mocks__/lib/supabase.js`

### The Pattern to Follow:
1. **Identify the import path** in the source file that's failing
2. **Add a moduleNameMapper pattern** to redirect that path to the mock
3. **Ensure the mock file exists** in the correct `__mocks__` directory structure
4. **Clear and consistent approach** - don't create duplicate mocks in different locations

### Successfully Applied To:
- sourceOrchestrator tests ✅
- dataExtractionAgent tests ✅
- earlyDuplicateDetector tests ✅ (handled inline due to ES modules)