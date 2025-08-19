# Integration Test Validation Checklist

## Integration Necessaries for the Flow

### Have
- `__tests__/integration/pipeline/completeFlow.test.js`: End-to-end NEW/UPDATE/SKIP routing, metrics, token savings, performance, error propagation, transaction ordering.
- `__tests__/integration/pipeline/mixedBatchProcessing.test.js`: Mixed routing and aggregation at scale.
- `__tests__/integration/pipeline/forceFullReprocessing.test.js`: Forced full-processing branch behavior.
- `__tests__/integration/pipeline/performanceOptimization.test.js` (and `.simple.test.js`): Performance/token assertions (keep one; consolidate if overlapping).
- `__tests__/integration/database/transactionRollback.mock.test.js`: Transaction boundaries and partial failure handling.
- `__tests__/integration/metrics/tokenOptimization.test.js`: Token accounting and optimization impact across stages.

### Need
- **Run manager stage updates**: stub `RunManagerV2` and assert stage status + metrics persisted per stage.
- **LLM retry/backoff integration**: analysis fails once then succeeds; assert retries and metrics (tokens/time/api calls).
- **Extraction pagination integration**: multi-page extraction; assert detector invoked once and DB call cadence/perf metrics.
- **Freshness matrix end-to-end**: seed DB timestamps to hit all 4 scenarios; assert path decisions and metrics.
- **Supabase advisory lock path**: simulate lock not acquired and acquired; assert metric flags and logging.

## Other Integration Tests

### Have
- `__tests__/integration/msw/mswSetup.test.js`: MSW harness.
- `__tests__/integration/msw/errorScenarios.test.js`: API error-paths at component/API boundary.
- `__tests__/integration/msw/componentApiFlow.test.js`: Component-to-API flow (UI-side).
- `__tests__/integration/msw/realtimeUpdates.test.js`: SSE/polling component behavior.

### Need
- **Edge function wrapper smoke**: `supabase/functions/process-source/index.js` (local-only) to validate handler wiring and client init.
- **API route integration**: `app/api/admin/funding-sources/[id]/process/routeV2.js` happy/failure paths (no real network).
- **Concurrency/lock contention**: run multiple `processApiSourceV2` concurrently; assert lock handling and non-overlapping effects.
- **Rate limiting/backoff at extraction with MSW timing controls** (optional).
- **DB persistence checks for run/stage records** (beyond stubbing): assert writes into metrics tables (optional if covered by unit/DB tests elsewhere).

## Notes
- Keep only one of `performanceOptimization.test.js` vs `.simple.test.js` to reduce redundancy.
- If scope is backend pipeline only, consider relocating `msw/componentApiFlow.test.js` and `msw/realtimeUpdates.test.js` to a UI integration bucket; they're not required for pipeline flow validation.

## Recommended Priority
I recommend validating the "necessaries" first by adding:
1. RunManagerV2 stage updates test.
2. LLM retry/backoff test.
3. Then proceed with pagination and freshness matrix integration.

## Plan: validate existing, then add missing, in order

### 1) Integration necessaries for the flow

- Validate existing (run and confirm assertions/coverage)
  1) `__tests__/integration/pipeline/completeFlow.test.js`
     - Verify: NEW/UPDATE/SKIP routing; stage call expectations; total tokens/API calls; opportunity paths; error propagation; transaction ordering; large-batch metrics.
     - Command: `npx jest __tests__/integration/pipeline/completeFlow.test.js --verbose`
  2) `__tests__/integration/pipeline/mixedBatchProcessing.test.js`
     - Verify: mixed routing and aggregation; cumulative metrics.
     - Command: `npx jest __tests__/integration/pipeline/mixedBatchProcessing.test.js --verbose`
  3) `__tests__/integration/pipeline/forceFullReprocessing.test.js`
     - Verify: full-processing branch toggles; bypass optimization.
     - Command: `npx jest __tests__/integration/pipeline/forceFullReprocessing.test.js --verbose`
  4) Performance tests (choose one; consolidate overlap)
     - Prefer: `__tests__/integration/pipeline/performanceOptimization.test.js`
     - Verify: token/time budgets at different batch sizes; bypass percentages in UPDATE/SKIP.
     - Command: `npx jest __tests__/integration/pipeline/performanceOptimization.test.js --verbose`
     - Optional: remove or skip `performanceOptimization.simple.test.js` if redundant.
  5) `__tests__/integration/database/transactionRollback.mock.test.js`
     - Verify: transactional ordering across stages; partial failure handling; no cross-stage leaks.
     - Command: `npx jest __tests__/integration/database/transactionRollback.mock.test.js --verbose`
  6) `__tests__/integration/metrics/tokenOptimization.test.js`
     - Verify: accurate token accounting at stage and total level; bypass counts; optimization percentages.
     - Command: `npx jest __tests__/integration/metrics/tokenOptimization.test.js --verbose`

- Add missing (create new tests)
  7) RunManagerV2 stage updates integration
     - File: `__tests__/integration/pipeline/runManagerStageUpdates.test.js`
     - Setup: jest.mock `lib/services/runManagerV2.js` to return a class stub that records calls:
       ```js
       jest.mock('../../../lib/services/runManagerV2.js', () => {
         return {
           RunManagerV2: class {
             constructor() { this.calls = [] }
             startRun = jest.fn()
             updateV2SourceOrchestrator = jest.fn()
             updateV2DataExtraction = jest.fn()
             updateV2EarlyDuplicateDetector = jest.fn()
             updateV2Analysis = jest.fn()
             updateV2Filter = jest.fn()
             updateV2Storage = jest.fn()
             updateV2DirectUpdate = jest.fn()
           }
         }
       })
       ```
     - Execute pipeline (e.g., NEW path) and assert each stage update called with:
       - status transitions: `processing` → `completed/failed`
       - payload shapes: results/performanceMetrics present; tokens/apiCalls where applicable
       - For duplicate detector: ensure "session record" method (if exported) called on completed
     - Command: `npx jest __tests__/integration/pipeline/runManagerStageUpdates.test.js --verbose`
  8) LLM retry/backoff integration (analysis fails once then succeeds)
     - File: `__tests__/integration/pipeline/analysisRetry.test.js`
     - Approach: mock `enhanceOpportunities` to `mockRejectedValueOnce(new Error('LLM error'))` then `mockResolvedValueOnce({...})`.
     - Assert:
       - pipeline returns success
       - stage metrics reflect one retry (e.g., `result.enhancedMetrics.stageMetrics.analysis.retryAttempts === 1` if tracked)
       - total tokens/time include both attempts
     - Command: `npx jest __tests__/integration/pipeline/analysisRetry.test.js --verbose`
  9) Extraction pagination integration (multi-page extraction)
     - File: `__tests__/integration/pipeline/extractionPagination.test.js`
     - Approach: make `extractFromSource` return a large multi-page dataset with `extractionMetrics.apiCalls/pages` indicating pagination; ensure detector called once with the full list; assert stage metrics copy extraction metrics correctly.
     - Assertions: detector call count; `result.enhancedMetrics.stageMetrics.dataExtraction.executionTime` and `apiCalls` reflect pagination.
  10) Freshness matrix end-to-end
      - File: `__tests__/integration/pipeline/freshnessMatrix.e2e.test.js`
      - Important: DO NOT mock `earlyDuplicateDetector`; do mock Supabase to return DB records with crafted `api_updated_at` and DB timestamps to hit all 4 scenarios:
        - newer → UPDATE; same/older → SKIP; no api timestamp + stale → UPDATE; no api timestamp + recent → SKIP
      - Assert routing counts, per-path metrics, and that LLM is only called for NEW items.
  11) Advisory lock behavior
      - File: `__tests__/integration/pipeline/advisoryLock.test.js`
      - Approach: mock the DB call or internal `acquireSourceLock` (via `jest.spyOn` on `processCoordinatorV2` module) to return `{ acquired:false }` and `{ acquired:true }`.
      - Assert: when not acquired, pipeline sets `metrics.concurrentProcessingDetected = true` and still proceeds; when acquired, logs lock ID.

### 2) Other integration tests

- Validate existing
  - `__tests__/integration/msw/mswSetup.test.js`:
    - Verify: MSW harness starts/stops and basic handler registration works.
  - `__tests__/integration/msw/errorScenarios.test.js`:
    - Verify: API routes/components handle network errors/timeouts gracefully.

- Optional relocation/trim
  - `__tests__/integration/msw/componentApiFlow.test.js`, `__tests__/integration/msw/realtimeUpdates.test.js`:
    - These are UI/API boundary tests; if you want pipeline-only in this folder, relocate them to a UI integration bucket (e.g., `__tests__/integration/ui/`) or keep with a clear tag.

- Add missing (optional, not required for pipeline validation)
  - Edge Function wrapper smoke
    - File: `__tests__/integration/edge/processSource.edge.test.js`
    - Approach: import `supabase/functions/process-source/index.js`, stub `createClient` and `Anthropic` to verify handler wiring; skip or run locally; not on CI.
  - API route integration
    - File: `__tests__/integration/api/processRouteV2.test.js`
    - Approach: test `app/api/admin/funding-sources/[id]/process/routeV2.js` using Next.js route handler with mocked clients; assert it forwards to `processApiSourceV2` and handles errors.

### Execution order

1) Run the necessaries you already have to establish baseline:
   - `completeFlow` → `mixedBatchProcessing` → `forceFullReprocessing` → `performanceOptimization` → `transactionRollback.mock` → `metrics/tokenOptimization`.
2) Add and run the two critical missing tests:
   - `runManagerStageUpdates.test.js`
   - `analysisRetry.test.js`
3) Add and run the two flow-depth tests:
   - `extractionPagination.test.js`
   - `freshnessMatrix.e2e.test.js`
4) Add and run the advisory lock test:
   - `advisoryLock.test.js`
5) Review MSW tests:
   - Keep `mswSetup.test.js` and `errorScenarios.test.js`
   - Relocate or tag `componentApiFlow.test.js` and `realtimeUpdates.test.js` if you want pipeline-only here
6) Optional: Edge function/API route smokes (local-only or tagged to skip CI)

### Suggested changes to current execution
- Consolidate `performanceOptimization.test.js` and `.simple.test.js` into one suite with parameterized sizes to reduce runtime and flakiness.
- Tag long-running suites with `it.concurrent` where safe; use deterministic timers in mocks.
- For coordinator retries, prefer stage-level mocks that increment a retry counter; assert `retryAttempts` in stage metrics if your coordinator exposes it.

- Commands summary:
  - Single file: `npx jest <path> --verbose`
  - Full necessaries (after adding new files): 
    - `npx jest __tests__/integration/pipeline/completeFlow.test.js`
    - `npx jest __tests__/integration/pipeline/mixedBatchProcessing.test.js`
    - `npx jest __tests__/integration/pipeline/forceFullReprocessing.test.js`
    - `npx jest __tests__/integration/pipeline/performanceOptimization.test.js`
    - `npx jest __tests__/integration/database/transactionRollback.mock.test.js`
    - `npx jest __tests__/integration/metrics/tokenOptimization.test.js`
    - `npx jest __tests__/integration/pipeline/runManagerStageUpdates.test.js`
    - `npx jest __tests__/integration/pipeline/analysisRetry.test.js`
    - `npx jest __tests__/integration/pipeline/extractionPagination.test.js`
    - `npx jest __tests__/integration/pipeline/freshnessMatrix.e2e.test.js`
    - `npx jest __tests__/integration/pipeline/advisoryLock.test.js`

- Keep an eye on coverage after step 2; the new tests should improve branch/line coverage for coordinator and RunManager V2 interactions.

- In short:
  - Validate your existing core suites now.
  - Add RunManagerV2 and LLM retry tests next.
  - Then add pagination, freshness, and advisory lock tests.
  - Trim/relocate MSW UI tests as needed.