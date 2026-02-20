# Testing Quality Gate Skill

Pre-commit quality gate for the Meridian ESG project. Verifies that all testing
requirements are met for the current changes, runs appropriate test suites, checks
E2E matrix tracking, and outputs a structured verdict.

**Invoked by**: `/testing-check` command (mandatory before every commit)

---

## Section 0: Reference Files

Read these before proceeding — they define the testing architecture:

| File | What it provides |
|------|-----------------|
| `CLAUDE.md` (AI Agent Testing Workflow) | Decision gate: which tiers are required for each change type |
| `tests/README.md` | Full testing guide: tier details, writing patterns, directory structure |
| `tests/E2E-MATRIX.md` | Living coverage tracker for API E2E and Browser E2E tests |
| `tests/vitest.config.js` | Vitest config (excludes e2e from main `npm run test`) |
| `tests/e2e/vitest.e2e.config.js` | Separate Vitest config for API E2E tests |
| `tests/e2e/playwright.config.js` | Playwright config for Browser E2E tests |

---

## Section 1: Identify Changes

Determine what files were modified and what tests are required.

### 1.1 Get Changed Files

Run both commands to capture staged and unstaged changes:
```bash
git diff --cached --name-only    # staged files
git diff --name-only             # unstaged files
```

Combine results into a single deduplicated list. Also check for new untracked files:
```bash
git status --porcelain | grep '^?' | awk '{print $2}'
```

### 1.2 Categorize by Decision Gate

For each changed file, apply the CLAUDE.md decision gate:

| File Pattern | Tests Required | Tier(s) |
|-------------|:-:|------|
| `app/api/**` (NEW file) | YES | Critical + API + API E2E |
| `app/api/**` (MODIFIED, response shape changed) | YES | Critical + API + API E2E |
| `app/api/**` (MODIFIED, internal logic only) | YES | Critical + API |
| `app/**/page.js`, `app/**/layout.js` (NEW) | YES | Browser E2E (smoke) |
| `lib/**` | YES | Pipeline or Critical |
| `components/**` (with business logic) | YES | Critical |
| `.claude/skills/**` | NO | — |
| `.claude/agents/**` | NO | — |
| `.claude/commands/**` | NO | — |
| `supabase/migrations/**` (new table/column/view/RPC) | YES | DB Integration (3b) + update Tier 3 simulated |
| `supabase/migrations/**` (index/constraint only) | NO | Verify via `supabase migration up` |
| `docs/**`, `*.md` (non-test) | NO | — |
| `tests/**` | NO | (these ARE the tests) |
| Config files (`*.config.*`, `package.json`) | NO | — |

### 1.3 Report

Output a summary:
```
Files changed: N
- app/api/widgets/route.js (NEW) -> Critical + API + API E2E
- lib/utils/widgetHelper.js (MODIFIED) -> Critical
- .claude/skills/testing/SKILL.md (MODIFIED) -> No tests required
```

---

## Section 2: Check Existing Test Coverage

For each file that requires tests, verify coverage exists.

### 2.1 Find Corresponding Tests

Search strategies (try in order):
1. **Name match**: `tests/critical/*/widgetName.test.js` or `tests/api/widgetName.api.test.js`
2. **Grep for route path**: `grep -r "/api/widgets" tests/` to find tests referencing this endpoint
3. **Grep for function name**: `grep -r "functionName" tests/` to find inline copies

### 2.2 Inline Function Drift Check

For each existing test file found:
1. Read the inline function in the test file
2. Read the corresponding production function
3. Compare the logic — if they have diverged, flag as **DRIFT DETECTED**

This is critical: inline functions that don't match production code produce false confidence.

### 2.3 Check for Missing Tests

Flag any file that requires tests but has none:
```
MISSING: tests/critical/widgets/ — no test file for app/api/widgets/route.js
MISSING: tests/e2e/api/widgets.e2e.test.js — new endpoint needs API E2E
```

### 2.4 Check E2E Matrix

Read `tests/E2E-MATRIX.md` and verify:
- **New API endpoints**: must have a row in the "Tier 5: API E2E Tests" section
- **New pages/routes**: must have a row in the "Tier 6: Browser E2E Tests" section
- **Written e2e tests**: Status column should be `covered`, not `needs-test`

---

## Section 3: Writing Patterns Quick Reference

If tests need to be written, use these patterns. For full examples, see `tests/README.md`.

### Tier 1 — Critical (Pure Business Logic)
- **File**: `tests/critical/{feature}/{name}.test.js`
- **Pattern**: Define function INLINE in test file. Import data from `tests/fixtures/`. No imports from `app/` or `lib/`.
- **Assert**: Exact values for pure functions

### Tier 2 — API (Response Shape)
- **File**: `tests/api/{resource}.api.test.js`
- **Pattern**: Define schema objects. Validate field presence, types, nullable fields.
- **Assert**: Structure, not data correctness

### Tier 3 — Database (Query Behavior, Simulated)
- **File**: `tests/database/{type}/{name}.test.js`
- **Pattern**: Simulated RPC logic in JS (real DB testing tracked as Task 28 in v2 tag)
- **Assert**: Sort order, NULL handling, filter combinations, pagination

### Tier 3b — DB Integration (Live Database)
- **File**: `tests/database/integration/{name}.integration.test.js`
- **Pattern**: Connect to local Supabase (`supabase start`). Run real SQL via `supabase.from()` or `supabase.rpc()`. Assert on column names and return shapes, not data values.
- **Prerequisites**: Docker running, `supabase start`, migrations applied
- **Infrastructure status**: PENDING (Task 28). When infrastructure is not available, update the corresponding Tier 3 simulated test's schema contract instead.
- **Assert**: Column presence, column types, RPC return shapes. Use `LIMIT 1` for speed.

### Tier 4 — Pipeline (AI Processing)
- **File**: `tests/pipeline/{phase}/{name}.test.js`
- **Pattern**: Mock `@anthropic-ai/sdk` with `vi.mock()`. Use `supabaseMock.js` for storage.
- **Assert**: Exact values for deterministic code. Schema compliance only for LLM output.

### Tier 5 — API E2E (Full HTTP Round-Trip)
- **File**: `tests/e2e/api/{resource}.e2e.test.js`
- **Pattern**: `import { apiUrl } from '../helpers/server.js'`. Use native `fetch()`. Requires dev server.
- **Assert**: HTTP status code + response shape. Not exact data values.

### Tier 6 — Browser E2E (User Workflows)
- **File**: `tests/e2e/browser/{flow}.spec.js`
- **Pattern**: `import { test, expect } from '@playwright/test'`. Use `page.goto('/')` with relative paths.
- **Assert**: User-visible outcomes. Elements visible, text present, navigation works.

---

## Section 4: Run Tests

Based on Section 1 findings, run the appropriate commands.

### Command Selection

| What changed | Run these |
|-------------|-----------|
| Any business logic (matching, filtering, scoring) | `npm run test:critical` |
| Any API route | `npm run test:api` |
| Pipeline processing code | `npm run test:pipeline` |
| New or modified API endpoint | `npm run test:e2e:api` (requires `npm run dev`) |
| New or modified page/route | `npm run test:e2e:browser` (requires `npm run dev`) |
| Database schema change (view/RPC/table/column) | `npm run test:db:integration` (requires `supabase start`) |

### Minimum Before Any Commit

Always run at minimum:
```bash
npm run test:critical && npm run test:api
```

### E2E Test Prerequisite

E2E tests (Tiers 5 and 6) require the dev server running on localhost:3000.

If e2e tests are required but the dev server is not running:
- **Warn**: "E2E tests require `npm run dev` on localhost:3000. Start the dev server and re-run `/testing-check`."
- **Set verdict to INCOMPLETE** (not PASS)

### DB Integration Test Prerequisite

DB integration tests (Tier 3b) require `supabase start` (Docker + local Postgres).

If DB integration tests are required but `supabase start` is not available:
- **Fallback**: Update the schema contract in the corresponding Tier 3 simulated test (e.g., the column list in the view test) as a manual stopgap.
- **Note**: Infrastructure pending as Task 28. When not available, set verdict to INCOMPLETE for the DB integration portion only.

### Handling Failures

If any test fails:
1. Read the failure output carefully
2. Determine if it's a test bug or a production bug
3. Fix the issue (either the test or the production code)
4. Re-run the failing suite
5. Do NOT proceed until all tests pass

---

## Section 5: E2E Matrix Maintenance

The file `tests/E2E-MATRIX.md` is a living tracking document. Check and update it.

### When to Add Rows

- **New API endpoint created** (`app/api/{name}/route.js`): Add a row to the Tier 5 table:
  ```
  | `/api/{name}` | GET/POST | Expected assertions | | needs-test |
  ```

- **New page/route created** (`app/{name}/page.js`): Add a row to the Tier 6 table:
  ```
  | {Page name} loads | Navigate to `/{name}` | Key elements visible | | needs-test | P1 |
  ```

### When to Update Status

- E2E test file written and passing: Change Status from `needs-test` to `covered`
- Fill in the Test File column with the actual filename

### Validation

Read `tests/E2E-MATRIX.md` and check:
- All rows with Status `covered` have a Test File listed
- No new endpoints/pages are missing from the matrix
- No rows still say `in-progress` for tests that are actually done

---

## Section 6: Verification Report

Output a structured report with a clear verdict.

### Report Format

```
## /testing-check Report

### Files Changed
- {file} ({NEW|MODIFIED}) -> {required tiers or "No tests required"}

### Test Coverage
- {status icon} {test file} ({status detail})

### E2E Matrix
- {status icon} {endpoint or page} {status}

### Test Results
- {status icon} {suite name} ({count} passed)

### Verdict: {PASS | NEEDS WORK | INCOMPLETE}
{If not PASS, list specific items that need attention}
```

### Status Icons

- PASS: All required tests exist, all tests pass, matrix is up to date
- NEEDS WORK: Missing tests, failing tests, or matrix gaps found
- INCOMPLETE: E2E tests required but dev server not running — re-run after starting server

### Verdict Rules

**PASS** requires ALL of:
- Every changed file that requires tests has corresponding test files
- No inline function drift detected
- All test suites pass
- E2E-MATRIX.md has rows for any new endpoints/pages
- E2E tests run (or none were required)

**NEEDS WORK** if any of:
- Missing test files for changed code
- Inline function drift detected
- Test failures
- Missing E2E-MATRIX.md rows

**INCOMPLETE** if:
- E2E tests are required but dev server is not running
- All other checks pass (or are flagged as NEEDS WORK separately)
