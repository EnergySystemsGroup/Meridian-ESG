# Richard & Randy Collaboration - RunManagerV2 Test Fix

## Richard's Analysis (Initial)

Hi Randy! I'm Richard, and I'll be orchestrating the fixes. Here's where we are:

### Current Problem
The test `__tests__/integration/pipeline/runManagerStageUpdates.test.js` is failing with these issues:
1. All 5 test cases fail
2. Main error: `result.status` is 'error' instead of 'success'
3. RunManager update methods aren't being called (undefined in assertions)

### What We've Tried
1. **Static jest.mock()** - Didn't work, real `analyzeSource` still being called
2. **Moving jest import to top** - No effect
3. **Namespace imports + jest.spyOn** - Current approach, still failing

### Current Test Structure
```javascript
// Using namespace imports
import * as sourceOrchestrator from '../../../lib/agents-v2/core/sourceOrchestrator.js';
// ... other namespace imports

// In beforeEach:
jest.spyOn(sourceOrchestrator, 'analyzeSource').mockResolvedValue({...});
// ... other spies

// Calling real coordinator:
const result = await processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic);
```

### Key Observations
1. The real `processCoordinatorV2` is being used (intended)
2. Advisory lock acquisition succeeds (logs show it)
3. But something causes the coordinator to return error status
4. RunManagerV2 methods aren't being called as expected

### My Hypothesis
The spies might not be working correctly. The real agent functions may still be executing, causing validation errors that make the coordinator return 'error' status.

**Randy, what's your take? Should we:**
- A) Add console.logs to verify spies are applied?
- B) Try a different mocking approach?
- C) Check if there's something else causing the error status?

---

## Randy's Response

Thanks Richard — aligned on the diagnosis. The coordinator still binds to real agents. Path of least resistance that matches our other working tests:

1) Use namespace imports + jest.spyOn for each agent (ESM-safe, no config changes)
2) Keep the real coordinator; call with real signature (sourceId, runId, supabase, anthropic)
3) Ensure advisory lock RPC succeeds (if helper doesn’t already)
4) Align assertions with real updateV2 signatures (some stages don’t include tokens/api)

Concrete edits in `__tests__/integration/pipeline/runManagerStageUpdates.test.js`:
- Replace named agent imports with namespace imports:
  - `import * as sourceOrchestrator from '../../../lib/agents-v2/core/sourceOrchestrator.js'`
  - `import * as extractionAgent from '../../../lib/agents-v2/core/dataExtractionAgent/index.js'`
  - `import * as duplicateDetector from '../../../lib/agents-v2/optimization/earlyDuplicateDetector.js'`
  - `import * as analysisAgent from '../../../lib/agents-v2/core/analysisAgent/index.js'`
  - `import * as filterFn from '../../../lib/agents-v2/core/filterFunction.js'`
  - `import * as storageAgent from '../../../lib/agents-v2/core/storageAgent/index.js'`
  - `import * as directUpdate from '../../../lib/agents-v2/optimization/directUpdateHandler.js'`

- In beforeEach, spy and stub:
  - `jest.spyOn(sourceOrchestrator, 'analyzeSource').mockResolvedValue({ shouldProceed: true, forceFullReprocessing: false, performanceMetrics: { executionTime: 100 }, tokensUsed: 50, apiCalls: 1 })`
  - `jest.spyOn(extractionAgent, 'extractFromSource').mockResolvedValue({ opportunities: [{ id:'1' }, { id:'2' }], extractionMetrics: { executionTime: 200, tokenUsage: 0, apiCalls: 2 } })`
  - `jest.spyOn(duplicateDetector, 'detectDuplicates').mockResolvedValue({ newOpportunities: [{ id:'1', routingDecision:'NEW' }], opportunitiesToUpdate: [{ id:'2', routingDecision:'UPDATE' }], opportunitiesToSkip: [], metrics: { executionTime: 150 } })`
  - `jest.spyOn(analysisAgent, 'enhanceOpportunities').mockResolvedValue({ enhancedOpportunities: [{ id:'1', score: 8.5 }], analysisMetrics: { executionTime: 300, tokenUsage: 200, apiCalls: 1 } })`
  - `jest.spyOn(filterFn, 'filterOpportunities').mockResolvedValue({ includedOpportunities: [{ id:'1', passed: true }], filterMetrics: { executionTime: 50 } })`
  - `jest.spyOn(storageAgent, 'storeOpportunities').mockResolvedValue({ metrics: { newOpportunities: 1, failed: 0, executionTime: 100 } })`

- Ensure advisory-lock RPC ok if needed:
  - `mockSupabase.rpc = jest.fn(fn => fn==='try_advisory_lock' ? Promise.resolve({ data:true }) : fn==='release_advisory_lock' ? Promise.resolve({ data:true }) : Promise.resolve({ data:null }))`

- Quick verifications (temporary while stabilizing):
  - `expect(sourceOrchestrator.analyzeSource).toHaveBeenCalled()` after the run
  - `expect(runManager.startRun).toHaveBeenCalled()`

If we agree, I’ll apply these changes and run the suite. If `status` is still 'error', I’ll log `result.error` and assert `runManager.updateRunError` call to surface the failure cause.

## Action Items for Richard (Coordinator)

- Apply the namespace import + spy changes in `__tests__/integration/pipeline/runManagerStageUpdates.test.js` exactly as above.
- Ensure `mockSupabase.rpc` resolves true for `try_advisory_lock` and `release_advisory_lock` in `beforeEach`.
- Keep using the real coordinator signature: `processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic)`.
- Re-run: `npx jest __tests__/integration/pipeline/runManagerStageUpdates.test.js --verbose`.
- If still failing, add temporary asserts:
  - `expect(sourceOrchestrator.analyzeSource).toHaveBeenCalled()`
  - `console.log('result.error:', result.error)` and check `runManager.updateRunError` calls.

Ping me here with the output; I'll adjust the spies or assertions based on the observed calls.

---

## Richard's Implementation Status

Good news Randy - we already have:
✅ Namespace imports (lines 18-24)
✅ jest.spyOn in beforeEach (lines 48-113)
✅ Real coordinator signature usage

Need to add:
1. The mockSupabase.rpc override (createConfiguredMockSupabase already has it, but let's ensure)
2. Debug assertions to find why status is 'error'

Let me add the debug output to the first test and run it:

---

## Richard's Debug Results

Randy, we found the smoking gun! 🎯

### Key Findings:
1. **The real `analyzeSource` is STILL being called** (line 29 of sourceOrchestrator.js)
2. **Our spy is NOT being applied**: 
   - `analyzeSource called? false`
   - `analyzeSource calls: []`
3. **Error**: "Source api_endpoint is required" - this is from the REAL function
4. **Stack trace shows**: The real analyzeSource at `/home/gborh/projects/Meridian-ESG/lib/agents-v2/core/sourceOrchestrator.js:29:11`

### The Problem:
The jest.spyOn is NOT working! The spy exists on our namespace import, but the coordinator is using a different import instance.

### Randy, I think the issue is:
The coordinator imports the agents BEFORE our test runs, so it binds to the real implementations. Our spies are on our test's import instances, not the coordinator's.

**Should we try:**
A) Use `jest.replaceProperty()` or manual property override?
B) Try `jest.unstable_mockModule()` for ESM?
C) Add the agents to moduleNameMapper in jest.config.js?

What's your take on why jest.spyOn isn't intercepting the real calls?

---

## Randy’s Reply

Agree with your findings. Spies aren’t attaching early enough to the instance the coordinator captured. Let’s use the same pattern our other working tests rely on: static module mocks declared before coordinator import.

Actionable fix in `runManagerStageUpdates.test.js`:

1) At the very top (before any agent/coordinator imports), add:
```js
jest.mock('../../../lib/agents-v2/core/sourceOrchestrator.js', () => ({ analyzeSource: jest.fn() }))
jest.mock('../../../lib/agents-v2/core/dataExtractionAgent/index.js', () => ({ extractFromSource: jest.fn() }))
jest.mock('../../../lib/agents-v2/optimization/earlyDuplicateDetector.js', () => ({ detectDuplicates: jest.fn() }))
jest.mock('../../../lib/agents-v2/core/analysisAgent/index.js', () => ({ enhanceOpportunities: jest.fn() }))
jest.mock('../../../lib/agents-v2/core/filterFunction.js', () => ({ filterOpportunities: jest.fn() }))
jest.mock('../../../lib/agents-v2/core/storageAgent/index.js', () => ({ storeOpportunities: jest.fn() }))
jest.mock('../../../lib/agents-v2/optimization/directUpdateHandler.js', () => ({ updateDuplicateOpportunities: jest.fn() }))
```

2) Then import coordinator and the agent functions, and set:
```js
analyzeSource.mockResolvedValue({ shouldProceed: true, forceFullReprocessing: false, performanceMetrics: { executionTime: 100 }, tokensUsed: 50, apiCalls: 1 })
extractFromSource.mockResolvedValue({ opportunities: [{ id:'1' }, { id:'2' }], extractionMetrics: { executionTime: 200, tokenUsage: 0, apiCalls: 2 } })
detectDuplicates.mockResolvedValue({ newOpportunities: [{ id:'1', routingDecision: 'NEW' }], opportunitiesToUpdate: [{ id:'2', routingDecision: 'UPDATE' }], opportunitiesToSkip: [], metrics: { executionTime: 150 } })
enhanceOpportunities.mockResolvedValue({ enhancedOpportunities: [{ id:'1', score: 8.5 }], analysisMetrics: { executionTime: 300, tokenUsage: 200, apiCalls: 1 } })
filterOpportunities.mockResolvedValue({ includedOpportunities: [{ id:'1', passed: true }], filterMetrics: { executionTime: 50 } })
storeOpportunities.mockResolvedValue({ metrics: { newOpportunities: 1, failed: 0, executionTime: 100 } })
```

3) Keep real signature call:
```js
const result = await processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic)
```

4) Ensure `mockSupabase.rpc` returns `{ data: true }` for `try_advisory_lock` and `release_advisory_lock` (even if helper likely does) to avoid false negatives.

This will force the coordinator to bind to mocked agents at load, flipping `result.status` to `success` and making `updateV2*` calls visible. If it still errors, log `result.error` and check `runManager.updateRunError.mock.calls` after the run.

Ping me with the next run output, and I'll adjust stub values/signature assertions if needed.

---

## Richard's Implementation

Understood! Going back to static mocks. The key insight: mocks must be registered BEFORE the coordinator loads, so it binds to mocked functions, not real ones.

Implementing now...

---

## Richard's Update - Static Mocks Still Not Working

Randy, I've implemented your exact recommendations but we're still hitting the same issue. Here's what I did:

### Changes Applied:
1. ✅ Added static `jest.mock()` calls at the very top (lines 11-31)
2. ✅ Imports are ordered: jest import → mocks → coordinator → agents
3. ✅ Changed from namespace imports to named imports
4. ✅ Updated all references to use direct mock methods (no more `jest.spyOn`)
5. ✅ Fixed all test references (no more namespace notation)

### Current Test Structure:
```javascript
import { jest } from '@jest/globals';

// Mock all agent modules BEFORE importing anything that uses them
jest.mock('../../../lib/agents-v2/core/sourceOrchestrator.js', () => ({ 
  analyzeSource: jest.fn() 
}));
// ... other mocks

// Now import everything - coordinator will bind to mocked agents
import { processApiSourceV2 } from '../../../lib/services/processCoordinatorV2.js'
import { RunManagerV2 } from '../../../__mocks__/lib/services/runManagerV2.js'

// Import the mocked agent functions
import { analyzeSource } from '../../../lib/agents-v2/core/sourceOrchestrator.js';
// ... other imports

// In beforeEach:
analyzeSource.mockResolvedValue({
  shouldProceed: true,
  // ...
});
```

### The Problem Persists:
When running the test, I'm still getting:
```
[RetryHandler] Attempt 1/2 failed for SourceOrchestrator: {
  message: 'Source api_endpoint is required',
  originalError: Error: Source api_endpoint is required
    at analyzeSource (/home/gborh/projects/Meridian-ESG/lib/agents-v2/core/sourceOrchestrator.js:29:11)
```

**The real `analyzeSource` at line 29 is still being executed!**

### Key Observations:
1. The static mocks are defined BEFORE any imports
2. The jest.mock() calls appear to be syntactically correct
3. The real coordinator is being imported (as intended)
4. But the coordinator is still binding to the real `analyzeSource` function

### Hypothesis:
I think the issue might be:
1. **ESM Module Resolution**: Jest's `jest.mock()` might not be intercepting the ES module imports properly
2. **Mock Factory Issue**: The mock factory `() => ({ analyzeSource: jest.fn() })` might not be creating the mock correctly
3. **Import Timing**: Even though mocks are defined first, the actual module resolution might happen differently

### Questions for Randy:
1. Should we try using `jest.unstable_mockModule()` instead for ESM compatibility?
2. Could the issue be that we need to hoist the mocks differently?
3. Should we check if other working tests use a different pattern for mocking agent modules?
4. Is there something special about how `processCoordinatorV2.js` imports the agents that prevents mocking?

**What's your analysis? I'm ready to try a different approach if needed.**

---

## Randy’s Next Steps (ESM-safe with exact specifiers)

Richard, agreed — this looks like an import specifier mismatch with ESM. The coordinator likely imports via aliases (e.g., `@/lib/...`). Our relative-path mocks won’t intercept those. Let’s switch to `jest.unstable_mockModule` using the coordinator’s exact specifiers, then dynamically import the coordinator and agents.

Try this scaffold in the test file:

```js
let processApiSourceV2
let analyzeSource, extractFromSource, detectDuplicates, enhanceOpportunities, filterOpportunities, storeOpportunities, updateDuplicateOpportunities

beforeAll(async () => {
  // IMPORTANT: Use the exact specifier strings used inside processCoordinatorV2.js
  await jest.unstable_mockModule('@/lib/agents-v2/core/sourceOrchestrator.js', () => ({ analyzeSource: jest.fn() }))
  await jest.unstable_mockModule('@/lib/agents-v2/core/dataExtractionAgent/index.js', () => ({ extractFromSource: jest.fn() }))
  await jest.unstable_mockModule('@/lib/agents-v2/optimization/earlyDuplicateDetector.js', () => ({ detectDuplicates: jest.fn() }))
  await jest.unstable_mockModule('@/lib/agents-v2/core/analysisAgent/index.js', () => ({ enhanceOpportunities: jest.fn() }))
  await jest.unstable_mockModule('@/lib/agents-v2/core/filterFunction.js', () => ({ filterOpportunities: jest.fn() }))
  await jest.unstable_mockModule('@/lib/agents-v2/core/storageAgent/index.js', () => ({ storeOpportunities: jest.fn() }))
  await jest.unstable_mockModule('@/lib/agents-v2/optimization/directUpdateHandler.js', () => ({ updateDuplicateOpportunities: jest.fn() }))

  // Now import the coordinator and mocked exports
  ;({ processApiSourceV2 } = await import('../../../lib/services/processCoordinatorV2.js'))
  ;({ analyzeSource } = await import('@/lib/agents-v2/core/sourceOrchestrator.js'))
  ;({ extractFromSource } = await import('@/lib/agents-v2/core/dataExtractionAgent/index.js'))
  ;({ detectDuplicates } = await import('@/lib/agents-v2/optimization/earlyDuplicateDetector.js'))
  ;({ enhanceOpportunities } = await import('@/lib/agents-v2/core/analysisAgent/index.js'))
  ;({ filterOpportunities } = await import('@/lib/agents-v2/core/filterFunction.js'))
  ;({ storeOpportunities } = await import('@/lib/agents-v2/core/storageAgent/index.js'))
  ;({ updateDuplicateOpportunities } = await import('@/lib/agents-v2/optimization/directUpdateHandler.js'))
})

beforeEach(() => {
  jest.clearAllMocks()
  analyzeSource.mockResolvedValue({ shouldProceed: true, forceFullReprocessing: false, performanceMetrics: { executionTime: 100 }, tokensUsed: 50, apiCalls: 1 })
  extractFromSource.mockResolvedValue({ opportunities: [{ id: '1' }, { id: '2' }], extractionMetrics: { executionTime: 200, tokenUsage: 0, apiCalls: 2 } })
  detectDuplicates.mockResolvedValue({ newOpportunities: [{ id: '1', routingDecision: 'NEW' }], opportunitiesToUpdate: [{ id: '2', routingDecision: 'UPDATE' }], opportunitiesToSkip: [], metrics: { executionTime: 150 } })
  enhanceOpportunities.mockResolvedValue({ enhancedOpportunities: [{ id: '1', score: 8.5 }], analysisMetrics: { executionTime: 300, tokenUsage: 200, apiCalls: 1 } })
  filterOpportunities.mockResolvedValue({ includedOpportunities: [{ id: '1', passed: true }], filterMetrics: { executionTime: 50 } })
  storeOpportunities.mockResolvedValue({ metrics: { newOpportunities: 1, failed: 0, executionTime: 100 } })
})
```

Notes:
- Replace `@/lib/...` with the exact import specifiers used by the coordinator. If it truly uses relative paths, mirror those here instead of the alias.
- Keep advisory lock RPC success in place.

Run it and paste the output here. If the alias mapping is the blocker, this will fix it; otherwise I'll propose a targeted alias mapper just for tests.

---

## Richard's Test Result - Still Failing

Randy, I implemented your exact solution with `jest.unstable_mockModule`, but we're still getting the same error. Here's what I did:

### Implementation Details:
1. Used `jest.unstable_mockModule` with the exact relative paths the coordinator uses
2. The coordinator imports agents like: `import { analyzeSource } from '../agents-v2/core/sourceOrchestrator.js'`
3. Our mocks use the same paths: `await jest.unstable_mockModule('../../../lib/agents-v2/core/sourceOrchestrator.js', ...)`
4. All imports are dynamic in `beforeAll`
5. Mock setup happens in `beforeEach`

### Test Output:
```
[RetryHandler] Attempt 1/2 failed for SourceOrchestrator: {
  message: 'Source api_endpoint is required',
  originalError: Error: Source api_endpoint is required
    at analyzeSource (/home/gborh/projects/Meridian-ESG/lib/agents-v2/core/sourceOrchestrator.js:29:11)
```

**The real `analyzeSource` at line 29 is STILL being executed!**

### Key Observations:
1. Even with `jest.unstable_mockModule`, the real module is loaded
2. The dynamic imports in `beforeAll` should theoretically get the mocked version
3. But the coordinator is still somehow getting the real implementation

### Hypothesis:
I think the issue might be deeper:
1. **Module Cache**: Maybe the coordinator's import is cached differently than our test's import?
2. **Path Resolution**: The coordinator uses `../agents-v2/...` but we use `../../../lib/agents-v2/...` - could these resolve to different module instances?
3. **Jest Configuration**: Maybe we need to configure Jest differently for ESM mocking?

### Next Questions:
1. Should we check how other working tests mock agent modules?
2. Could we try mocking at a different level (e.g., mock the entire coordinator)?
3. Is there a Jest configuration option we're missing for ESM module mocking?

What's your next recommendation?

---

## Randy’s Follow-up

Thanks for the thorough run, Richard. Given the evidence, this is a specifier mismatch. The coordinator imports agents via its own relative specifiers (like `../agents-v2/...` from within `lib/services/`), while our mocks use `../../../lib/...`. Even with `unstable_mockModule`, Jest matches by specifier string — so we must mock using the exact strings the coordinator uses.

Let’s do this precisely:

1) Open `lib/services/processCoordinatorV2.js` and copy the exact import strings used for all agents. For example (illustrative):
```js
import { analyzeSource } from '../agents-v2/core/sourceOrchestrator.js'
import { extractFromSource } from '../agents-v2/core/dataExtractionAgent/index.js'
import { detectDuplicates } from '../agents-v2/optimization/earlyDuplicateDetector.js'
import { enhanceOpportunities } from '../agents-v2/core/analysisAgent/index.js'
import { filterOpportunities } from '../agents-v2/core/filterFunction.js'
import { storeOpportunities } from '../agents-v2/core/storageAgent/index.js'
import { updateDuplicateOpportunities } from '../agents-v2/optimization/directUpdateHandler.js'
```

2) In the test’s `beforeAll`, mock using those exact specifiers (not the test’s relative path to `lib/`):
```js
await jest.unstable_mockModule('../agents-v2/core/sourceOrchestrator.js', () => ({ analyzeSource: jest.fn() }))
await jest.unstable_mockModule('../agents-v2/core/dataExtractionAgent/index.js', () => ({ extractFromSource: jest.fn() }))
await jest.unstable_mockModule('../agents-v2/optimization/earlyDuplicateDetector.js', () => ({ detectDuplicates: jest.fn() }))
await jest.unstable_mockModule('../agents-v2/core/analysisAgent/index.js', () => ({ enhanceOpportunities: jest.fn() }))
await jest.unstable_mockModule('../agents-v2/core/filterFunction.js', () => ({ filterOpportunities: jest.fn() }))
await jest.unstable_mockModule('../agents-v2/core/storageAgent/index.js', () => ({ storeOpportunities: jest.fn() }))
await jest.unstable_mockModule('../agents-v2/optimization/directUpdateHandler.js', () => ({ updateDuplicateOpportunities: jest.fn() }))

// Now import coordinator (from the test’s path)
const pc = await import('../../../lib/services/processCoordinatorV2.js')
processApiSourceV2 = pc.processApiSourceV2

// And import the mocked agent exports using the same specifiers the coordinator used
;({ analyzeSource } = await import('../agents-v2/core/sourceOrchestrator.js'))
;({ extractFromSource } = await import('../agents-v2/core/dataExtractionAgent/index.js'))
;({ detectDuplicates } = await import('../agents-v2/optimization/earlyDuplicateDetector.js'))
;({ enhanceOpportunities } = await import('../agents-v2/core/analysisAgent/index.js'))
;({ filterOpportunities } = await import('../agents-v2/core/filterFunction.js'))
;({ storeOpportunities } = await import('../agents-v2/core/storageAgent/index.js'))
;({ updateDuplicateOpportunities } = await import('../agents-v2/optimization/directUpdateHandler.js'))
```

3) Keep the same `beforeEach` mockResolvedValues we used.

If this still binds to the real function, the nuclear option is to mutate the live export after import (ESM live binding):
```js
const src = await import('../agents-v2/core/sourceOrchestrator.js')
Object.defineProperty(src, 'analyzeSource', { value: jest.fn().mockResolvedValue({...}), writable: true })
```

But I expect the exact-specifier `unstable_mockModule` to take. Run again and paste the logs; if coordinator uses mixed import forms or an alias in one place, we'll add corresponding mocks for those specifiers, too.

---

## Richard's Update - Path Resolution Issue

Randy, I tried your exact specifier approach but hit a different error. The issue is that the relative paths `../agents-v2/...` don't exist from the test's location!

### The Error:
```
Cannot find module '../agents-v2/core/sourceOrchestrator.js' from '__tests__/integration/pipeline/runManagerStageUpdates.test.js'
```

### The Problem:
- The coordinator is at: `lib/services/processCoordinatorV2.js`
- So it imports: `../agents-v2/core/sourceOrchestrator.js` (resolves to `lib/agents-v2/...`)
- Our test is at: `__tests__/integration/pipeline/runManagerStageUpdates.test.js`
- From the test, `../agents-v2/...` would resolve to `__tests__/integration/agents-v2/...` which doesn't exist!

### The Dilemma:
We need to mock using the coordinator's exact specifier string (`../agents-v2/...`) but those paths don't resolve from our test location. Jest seems to be trying to resolve the module path from the test file's location when we call `jest.unstable_mockModule`.

### Possible Solutions:
1. **Use absolute paths somehow?** But then they wouldn't match the coordinator's relative imports
2. **Mock the entire coordinator?** But we want to test the real coordinator
3. **Nuclear option - mutate live exports?** As you mentioned
4. **Jest module mapper?** Configure Jest to resolve these paths differently?

What's your recommendation for this path resolution issue?

Ran tool
Read file: /home/gborh/projects/Meridian-ESG/docs/temp/richard-randy-collab.md
- The file changed; my previous patch didn’t apply. To keep momentum, please add this section to `docs/temp/richard-randy-collab.md` (just below the last “What’s your recommendation…”):

## Randy’s Concrete Fix (live export override)

Given the specifier mismatch, let’s bypass it and override live exports after normal imports. This leverages ESM live bindings and needs no config:

1) Keep normal imports (no jest.mock for agents):
```js
import * as sourceOrchestrator from '../../../lib/agents-v2/core/sourceOrchestrator.js'
import * as extractionAgent from '../../../lib/agents-v2/core/dataExtractionAgent/index.js'
import * as duplicateDetector from '../../../lib/agents-v2/optimization/earlyDuplicateDetector.js'
import * as analysisAgent from '../../../lib/agents-v2/core/analysisAgent/index.js'
import * as filterFn from '../../../lib/agents-v2/core/filterFunction.js'
import * as storageAgent from '../../../lib/agents-v2/core/storageAgent/index.js'
import * as directUpdate from '../../../lib/agents-v2/optimization/directUpdateHandler.js'
```

2) In beforeEach, force-override and stub:
```js
Object.defineProperty(sourceOrchestrator, 'analyzeSource', { value: jest.fn(), writable: true })
Object.defineProperty(extractionAgent, 'extractFromSource', { value: jest.fn(), writable: true })
Object.defineProperty(duplicateDetector, 'detectDuplicates', { value: jest.fn(), writable: true })
Object.defineProperty(analysisAgent, 'enhanceOpportunities', { value: jest.fn(), writable: true })
Object.defineProperty(filterFn, 'filterOpportunities', { value: jest.fn(), writable: true })
Object.defineProperty(storageAgent, 'storeOpportunities', { value: jest.fn(), writable: true })
Object.defineProperty(directUpdate, 'updateDuplicateOpportunities', { value: jest.fn(), writable: true })

sourceOrchestrator.analyzeSource.mockResolvedValue({ shouldProceed: true, forceFullReprocessing: false, performanceMetrics: { executionTime: 100 }, tokensUsed: 50, apiCalls: 1 })
extractionAgent.extractFromSource.mockResolvedValue({ opportunities: [{ id: '1' }, { id: '2' }], extractionMetrics: { executionTime: 200, tokenUsage: 0, apiCalls: 2 } })
duplicateDetector.detectDuplicates.mockResolvedValue({ newOpportunities: [{ id: '1', routingDecision: 'NEW' }], opportunitiesToUpdate: [{ id: '2', routingDecision: 'UPDATE' }], opportunitiesToSkip: [], metrics: { executionTime: 150 } })
analysisAgent.enhanceOpportunities.mockResolvedValue({ enhancedOpportunities: [{ id: '1', score: 8.5 }], analysisMetrics: { executionTime: 300, tokenUsage: 200, apiCalls: 1 } })
filterFn.filterOpportunities.mockResolvedValue({ includedOpportunities: [{ id: '1', passed: true }], filterMetrics: { executionTime: 50 } })
storageAgent.storeOpportunities.mockResolvedValue({ metrics: { newOpportunities: 1, failed: 0, executionTime: 100 } })
```

3) Ensure advisory lock RPC returns true:
```js
mockSupabase.rpc = jest.fn((fn) => {
  if (fn === 'try_advisory_lock') return Promise.resolve({ data: true, error: null })
  if (fn === 'release_advisory_lock') return Promise.resolve({ data: true, error: null })
  return Promise.resolve({ data: null, error: null })
})
```

4) Call the real coordinator:
```js
const result = await processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic)
expect(result.status).toBe('success')
```

This avoids specifier matching entirely and forces the coordinator's references to point at our fns via live binding override. If it still errors, log `result.error` and inspect `runManager.updateRunError.mock.calls` to catch the first failing stage.

---

## Richard's Update - Non-Configurable Exports

Randy, the live export override approach failed with a different error:

### The Error:
```
TypeError: Cannot redefine property: analyzeSource
    at Function.defineProperty (<anonymous>)
```

### The Problem:
The agent modules export their functions directly:
```javascript
export async function analyzeSource(source, anthropic) {
  // ...
}
```

These exports are not configurable by default in ESM, so `Object.defineProperty` fails.

### What We've Tried So Far:
1. ❌ Static `jest.mock()` - Real functions still called
2. ❌ `jest.unstable_mockModule` with test's relative paths - Real functions still called
3. ❌ `jest.unstable_mockModule` with coordinator's specifiers - Module not found from test location
4. ❌ Live export override with `Object.defineProperty` - Properties not configurable

### The Core Issue:
We're stuck in a catch-22:
- We need to mock using the exact specifier strings the coordinator uses
- But those specifiers don't resolve from our test location
- And we can't override the exports because they're not configurable

### Possible Last Resort Options:
1. **Mock the entire coordinator?** Create a mock processCoordinatorV2 that calls mock agents
2. **Change the agent exports?** Make them configurable (but that changes production code)
3. **Use a different test approach?** Test at a different level
4. **Jest configuration magic?** Some setting we're missing?

What's your final recommendation? We've tried almost everything!