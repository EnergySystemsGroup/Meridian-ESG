# Legacy Tests Archive

This document archives information about tests that existed before the testing strategy overhaul.

## Archive Date: 2025-01-08

## Reason for Archive

The project underwent a comprehensive testing strategy redesign to focus on:
1. **User-facing reliability** - Client matching, explorer, map, dashboard, timeline, clients
2. **API contract tests** - Ensuring consistent response shapes
3. **Single test location** - All tests now in `tests/` directory
4. **Vitest only** - Removed Jest dual-framework confusion

## Archived Test Locations

The following directories contain legacy tests that have been superseded:

### `__tests__/` Directory (41 test files)

#### Unit Tests (`__tests__/unit/`)
- `agents/` - Agent-specific unit tests
  - `materialChangeDetection.test.js`
  - `contentEnhancer.test.js`
  - `parallelCoordinator.test.js`
  - `apiCaller.test.js`
  - `anthropicClient.test.js`
  - `storageAgent.test.js`
  - `earlyDuplicateDetector.test.js`
  - `directUpdateHandler.test.js`
  - `analysisAgent.test.js`
  - `sourceOrchestrator.test.js`
  - `storageAgent/dataSanitizer.test.js`
  - `storageAgent/fieldMapping.test.js`
  - `storageAgent/stateEligibilityProcessor.test.js`
  - `storageAgent/fundingSourceManager.test.js`

- `components/` - React component tests
  - `RunDetails.test.js`
  - `Dashboard.test.js`
  - `FundingSourcesPage.test.js`

#### Integration Tests (`__tests__/integration/`)
- `pipeline/` - Pipeline flow tests
  - `performanceOptimization.test.js`
  - `completeFlow.test.js`
  - `forceFullReprocessing.test.js`
  - `mixedBatchProcessing.test.js`
  - `runManagerStageUpdates.test.js`

- `database/` - Database integration tests
  - `transactionRollback.mock.test.js`

- `metrics/` - Metrics tests
  - `tokenOptimization.test.js`

- `agents/` - Agent integration tests
  - `apiCaller.integration.test.js`

- `services/` - Service tests
  - `jobProcessor.integration.test.js`

- `msw/` - Mock Service Worker tests
  - `mswSetup.test.js`
  - `errorScenarios.test.js`
  - `realtimeUpdates.test.js`
  - `componentApiFlow.test.js`

### `lib/` Directory Tests
Some tests existed scattered within the lib directory.

### `__mocks__/` Directory (27 mock files)
Mock files mirroring source structure - replaced by single `tests/helpers/supabaseMock.js`.

## What Was Preserved

### Useful patterns extracted:
1. **Fixture data patterns** - Incorporated into `tests/fixtures/`
2. **MSW setup patterns** - Can be referenced for API mocking if needed
3. **Test scenarios** - Edge cases documented in new tests

### Not migrated (out of scope for current priorities):
1. React component tests - Lower priority per strategy
2. AI pipeline internals - Moved to Tier 4 (nightly/on-demand)
3. Implementation detail tests - Mocking internals

## Migration Status

| Old Location | New Location | Status |
|--------------|--------------|--------|
| `__tests__/unit/agents/` | `tests/pipeline/` (partial) | Tier 4 - Pending |
| `__tests__/unit/components/` | Not migrated | Out of scope |
| `__tests__/integration/pipeline/` | `tests/pipeline/` (partial) | Tier 4 - Pending |
| `__tests__/integration/database/` | `tests/database/` | Tier 3 - Pending |
| `__tests__/integration/msw/` | Not migrated | API mocking patterns preserved |

## How to Access Archived Tests

The original test files remain in their locations and are excluded from the test run via `vitest.config.js`:

```javascript
exclude: ['node_modules', 'dist', '.next', '__tests__', 'lib/**/*.test.js']
```

If you need to reference or restore any of these tests:
1. Files are still present in the codebase
2. Can be selectively included by modifying vitest config
3. May need Jest for some tests that relied on Jest-specific features

## Jest Configuration Files (Archived)

The following Jest config files existed and are no longer used:
- `jest.config.js` (root)
- `jest.setup.js`
- Various Jest configs in subdirectories

## New Test Structure

All new tests follow this structure:

```
tests/
├── critical/           # Tier 1: User-facing critical tests
│   ├── client-matching/
│   ├── explorer/
│   ├── map/
│   ├── dashboard/
│   ├── timeline/
│   ├── clients/
│   └── opportunityDetail/
├── api/               # Tier 2: API contract tests
├── database/          # Tier 3: Database integration (pending)
├── pipeline/          # Tier 4: AI pipeline (pending)
├── fixtures/          # Shared test data
├── helpers/           # Test utilities
└── _archived/         # This documentation
```

## Test Counts

| Category | Old Count | New Count |
|----------|-----------|-----------|
| Legacy `__tests__/` | 41 files | Archived |
| New `tests/critical/` | - | 20 files |
| New `tests/api/` | - | 3 files |
| Total passing tests | Unknown | 597+ |

---

*This archive is for documentation purposes. Original test files remain in place but are excluded from test runs.*
