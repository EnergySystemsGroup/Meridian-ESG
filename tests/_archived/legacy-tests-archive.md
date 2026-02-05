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

## Deletion Record

**Deleted on**: 2025-02-05
**Commit before deletion**: `8d7384a` (all new tests committed and passing)
**Commit with deletion**: See git log for next commit after `8d7384a`

### Files Deleted

- `__tests__/` directory (57 files) — legacy Jest test files
- `__mocks__/` directory (27 files) — legacy mock files
- `jest.config.js` — root Jest config
- `jest.config.ci.js` — CI Jest config
- `jest.config.unit.js` — unit test Jest config
- `jest.config.integration.js` — integration test Jest config
- `jest.config.node.js` — Node environment Jest config
- `jest.setup.js` — Jest setup file

### Package.json Cleanup

- Removed `test:legacy:unit`, `test:legacy:integration`, `test:legacy:run` scripts
- Removed `jest`, `jest-environment-jsdom`, `@testing-library/jest-dom` from devDependencies

### How to Access Deleted Files

If you need to reference any of these tests, use git:
```bash
git show 8d7384a:__tests__/path/to/file.test.js
```

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

## Final Test Counts

| Category | Old (Deleted) | New (Active) |
|----------|---------------|--------------|
| Legacy `__tests__/` | 57 files | Deleted |
| Legacy `__mocks__/` | 27 files | Deleted |
| Jest configs | 6 files | Deleted |
| `tests/critical/` | - | 30 files |
| `tests/api/` | - | 8 files |
| `tests/database/` | - | 7 files |
| `tests/pipeline/` | - | 15 files |
| `tests/integration/` | - | 3 files |
| `tests/fixtures/` | - | 6 files |
| `tests/helpers/` | - | 5 files |
| **Total test files** | **90 deleted** | **68 active** |
| **Total tests** | **Unknown** | **1,509 passing** |

---

*Legacy files have been permanently deleted. Use `git show 8d7384a:<path>` to access them.*
