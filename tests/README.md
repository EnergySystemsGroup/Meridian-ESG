# Testing Guide — Meridian ESG

## Quick Reference

```bash
npm run test              # All unit/integration tests (Tiers 1-4)
npm run test:critical     # Tier 1: user-facing logic
npm run test:api          # Tier 2: API response contracts
npm run test:database     # Tier 3: database behavior
npm run test:pipeline     # Tier 4: AI pipeline
npm run test:e2e          # Tier 5+6: All E2E (requires dev server running)
npm run test:e2e:api      # Tier 5: API E2E (Vitest + fetch against localhost)
npm run test:e2e:browser  # Tier 6: Browser E2E (Playwright)
npm run test:coverage     # Coverage report
npm run test:ci           # CI mode (verbose)
```

Run a single file: `npm run test -- tests/critical/client-matching/matchCriteria.test.js`

---

## AI Agent Workflow

If you are an AI agent building features in this codebase:
1. **Check the decision gate** in CLAUDE.md for every file you modified — API routes and lib functions require tests; skill/agent/migration files do not
2. **Follow the inline-function pattern** — define functions in the test file, never import from `app/` or `lib/` (Next.js module resolution breaks in Vitest)
3. **Use fixtures** — import from `tests/fixtures/`, never hardcode test data inline
4. **Run before commit** — at minimum `npm run test:critical && npm run test:api`
5. **Pipeline changes** — if you modified scoring, sanitization, or extraction logic, also run `npm run test:pipeline`
6. **Update inline functions** — if you changed logic in production code that has a corresponding test, update the test's inline function to match
7. **Run `/testing-check`** — mandatory before every commit. This verifies test coverage, runs suites, and checks E2E matrix. See `.claude/skills/testing/SKILL.md` for the full playbook.

---

## Where Does My Test Go?

**One question determines the tier:**

```
Does a sales person or client see the result of this code?
  |
  +-- YES, directly (matching, filtering, map numbers, dashboard stats)
  |     -> tests/critical/
  |
  +-- SORT OF (they see the API response shape)
  |     -> tests/api/
  |
  +-- NO, it's internal infrastructure
        |
        +-- Database query or RPC function?
        |     |
        |     +-- Testing query logic (sort, filter, NULL)?
        |     |     -> tests/database/              (Tier 3: simulated)
        |     |
        |     +-- Verifying schema/view/RPC matches app code?
        |           -> tests/database/integration/  (Tier 3b: live DB)
        |
        +-- AI pipeline processing?
              -> tests/pipeline/

Does it test a full HTTP round-trip against a running server?
  |
  +-- YES, API endpoint (request -> route -> DB -> response)
  |     -> tests/e2e/api/
  |
  +-- YES, user workflow in a real browser (navigation, clicks, forms)
        -> tests/e2e/browser/
```

### Tier Details

| Tier | Folder | Tests What | Mocking Strategy | Runs When |
|------|--------|-----------|-----------------|-----------|
| **1: Critical** | `tests/critical/` | Business logic — matching algorithm, scoring, filtering, pagination, aggregations, deadline calculations | None. Pure functions fed fixture data. | Every commit |
| **2: API** | `tests/api/` | Response shapes — required fields present, correct types, error format, pagination metadata | None. Schema validation on test objects. | Every commit |
| **3: Database** | `tests/database/` | RPC functions, views, constraints — sort behavior, NULL handling, filter combinations | Simulated RPC logic (goal: real local Supabase) | PR / deploy |
| **3b: DB Integration** | `tests/database/integration/` | Schema contracts — view columns match app expectations, RPC return shapes, migration correctness | None. Real queries against local Supabase (`supabase start`) | PR / deploy (when infra ready) |
| **4: Pipeline** | `tests/pipeline/` | Scoring algorithms, data sanitization, duplicate detection, LLM schema compliance | Anthropic SDK mock + Supabase in-memory mock | Nightly / on-demand |
| **5: API E2E** | `tests/e2e/api/` | Full HTTP round-trips — request to running server, real DB, real response | None. Real `fetch()` against `localhost:3000` | Pre-deploy / manual |
| **6: Browser E2E** | `tests/e2e/browser/` | User workflows — page loads, navigation, form interactions, visual assertions | None. Real Playwright browser against `localhost:3000` | Pre-deploy / manual |

---

## Directory Structure

```
tests/
├── critical/                    # TIER 1: User-facing business logic
│   ├── client-matching/         # All 4 matching criteria, scoring, synonyms
│   ├── explorer/                # Filters, sorting, pagination
│   ├── map/                     # Scope breakdown, funding by state
│   ├── dashboard/               # Summary cards, deadlines, top matches
│   ├── timeline/                # Month grouping, days-left colors
│   ├── clients/                 # Search, filters
│   └── opportunityDetail/       # Tab content, days-left
│
├── api/                         # TIER 2: API response contracts
│   ├── funding.api.test.js
│   ├── client-matching.api.test.js
│   └── clients.api.test.js
│
├── database/                    # TIER 3: Database behavior
│   ├── rpc/                     # RPC function tests
│   ├── views/                   # View calculation tests
│   ├── constraints/             # Duplicate prevention, cascade deletes
│   └── integration/             # TIER 3b: Live DB tests (pending Task 28)
│
├── pipeline/                    # TIER 4: AI pipeline processing
│   ├── analysis/                # Scoring, score invariants
│   ├── extraction/              # Schema compliance, error recovery
│   ├── orchestration/           # Run management
│   └── storage/                 # Sanitizer, upsert, dedup
│
├── fixtures/                    # Shared test data (all tiers)
│   ├── clients.js
│   ├── opportunities.js
│   ├── coverageAreas.js
│   ├── matchScenarios.js
│   ├── deadlines.js
│   └── index.js                 # Central export with helper functions
│
├── e2e/                         # TIER 5+6: End-to-end tests
│   ├── api/                     # TIER 5: API E2E (Vitest + fetch)
│   │   └── *.e2e.test.js
│   ├── browser/                 # TIER 6: Browser E2E (Playwright)
│   │   └── *.spec.js
│   ├── helpers/
│   │   ├── server.js            # Base URL config, apiUrl() helper
│   │   └── auth.js              # Auth bypass documentation
│   ├── vitest.e2e.config.js     # Vitest config for API E2E tests
│   └── playwright.config.js     # Playwright config (browser/ subdir only)
│
├── helpers/                     # Test utilities
│   ├── setup.js                 # Global setup (env vars, time utils, cleanup)
│   └── supabaseMock.js          # In-memory Supabase with CRUD support
│
├── E2E-MATRIX.md                # Living E2E coverage tracking document
└── vitest.config.js             # Vitest configuration (excludes e2e/)
```

---

## Writing Tests

### Critical Tests (Tier 1)

Critical tests verify **pure business logic** — no HTTP, no database, no React.

```javascript
// tests/critical/client-matching/matchCriteria.test.js
import { clients } from '../../fixtures/clients.js';
import { opportunities } from '../../fixtures/opportunities.js';

test('returns match when ALL 4 criteria pass', () => {
  const result = evaluateMatch(clients.pgeBayAreaClient, opportunities.nationalGrant);

  expect(result.isMatch).toBe(true);
  expect(result.score).toBe(100);
});
```

**Rules:**
- Import data from `fixtures/` — never hardcode test data inline
- Test the function directly, not through an API call
- No mocks unless absolutely necessary
- Cover edge cases: null inputs, empty arrays, boundary values

### API Tests (Tier 2)

API tests validate **response structure**, not correctness of data.

```javascript
// tests/api/client-matching.api.test.js
const matchSchema = {
  opportunity_id: 'string',
  score: 'number',
  matching_criteria: 'object',
  close_date: 'string|null',
};

test('validates complete match object', () => {
  const errors = validateSchema(matchObject, matchSchema);
  expect(errors).toHaveLength(0);
});
```

**Rules:**
- Define schemas for every API response
- Test required fields, optional nullable fields, error responses
- Do NOT test if the data values are correct — that's Tier 1's job

### Database Tests (Tier 3)

Database tests validate **query behavior** — sorting, filtering, NULL handling, pagination.

```javascript
// tests/database/rpc/getFundingDynamicSort.test.js
test('NULL deadlines go to end regardless of sort direction', () => {
  const result = simulateGetFundingDynamicSort(testData, {
    sort_by: 'deadline',
    sort_dir: 'asc',
  });

  const nullIdx = result.data.findIndex(o => o.close_date === null);
  expect(nullIdx).toBeGreaterThan(0);
});
```

**Rules:**
- Currently uses simulated RPC logic in JavaScript (**not real DB** — see Known Gaps below)
- Test sort directions, NULL placement, filter combinations, pagination math
- Goal: migrate to real local Supabase via `supabase start`

### Database Integration Tests (Tier 3b)

Database integration tests verify that the **real database schema matches what application code expects**. Unlike Tier 3 (which simulates queries in JS), these connect to a real local Supabase instance and run real SQL.

**Infrastructure status**: **Pending** — the methodology is documented here; the `supabase start` infrastructure is not yet set up.

**Prerequisites:**
- Docker running
- `supabase start` (spins up local Postgres)
- All migrations applied (`supabase migration up`)

**What they test:**
1. **View columns** — does the view expose all columns that API routes depend on?
2. **RPC return shapes** — does the RPC return the structure that app code expects?
3. **Migration correctness** — after applying migrations, does the schema match expectations?

```javascript
// tests/database/integration/views.integration.test.js
// REQUIRES: supabase start (local Postgres in Docker)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_ANON_KEY || 'your-local-anon-key'
);

describe('funding_opportunities_with_geography view', () => {
  test('exposes all columns that API routes depend on', async () => {
    const { data, error } = await supabase
      .from('funding_opportunities_with_geography')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    const columns = Object.keys(data[0]);

    // These columns are used by app/api/funding/route.js
    expect(columns).toContain('id');
    expect(columns).toContain('title');
    expect(columns).toContain('status');
    expect(columns).toContain('program_id');
    expect(columns).toContain('coverage_state_codes');
    expect(columns).toContain('promotion_status');
  });
});
```

```javascript
// tests/database/integration/rpc.integration.test.js
describe('get_funding_dynamic_sort RPC', () => {
  test('returns expected shape', async () => {
    const { data, error } = await supabase.rpc('get_funding_dynamic_sort', {
      sort_by: 'title',
      sort_dir: 'asc',
      page_size: 1,
      page_offset: 0,
    });

    expect(error).toBeNull();
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total_count');
    expect(Array.isArray(data.data)).toBe(true);
  });
});
```

**Rules:**
- Assert on column names and types, not data values
- One test file per view or RPC
- Use `LIMIT 1` queries for speed — these tests verify schema, not data
- File naming: `*.integration.test.js`
- **Fallback (while Task 28 is pending)**: Update the schema contract in the corresponding Tier 3 simulated test (e.g., the column list in `fundingOpportunitiesWithGeography.test.js`) as a manual stopgap

### Pipeline Tests (Tier 4)

Pipeline tests split into **deterministic** (exact assertions) and **non-deterministic** (schema only).

```javascript
// Deterministic: exact values
test('municipal government gets highest tier score', () => {
  expect(calculateTierScore(['Municipal Government'])).toBe(10);
});

// Non-deterministic: schema compliance only
test('extraction output has required fields', () => {
  result.opportunities.forEach(opp => {
    expect(opp).toHaveProperty('title');
    expect(typeof opp.title).toBe('string');
  });
});
```

**Rules:**
- Mock Anthropic SDK with `vi.mock('@anthropic-ai/sdk')` returning valid JSON
- Use `supabaseMock.js` for storage/upsert tests
- Scoring functions: test every input bracket with exact expected values
- LLM output: test schema compliance and invariants (0-10 range), never exact content

### E2E Tests (Tier 5 + Tier 6)

E2E tests validate the **full running application** — no mocks, no simulations.

**Prerequisites:**
- Dev server must be running: `npm run dev`
- Auth is automatically bypassed in development mode (`middleware.js` line 6)
- First-time setup: `npx playwright install chromium` (browser e2e only)

#### API E2E Tests (Tier 5)

Use Vitest with native `fetch()` against `http://localhost:3000`. Files named `*.e2e.test.js`.

```javascript
// tests/e2e/api/funding.e2e.test.js
import { apiUrl } from '../helpers/server.js';

describe('GET /api/funding', () => {
  test('returns paginated results with correct shape', async () => {
    const res = await fetch(apiUrl('/api/funding'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('status filter narrows results', async () => {
    const res = await fetch(apiUrl('/api/funding?status=Open'));
    const body = await res.json();
    body.data.forEach(opp => {
      expect(opp.status).toBe('Open');
    });
  });
});
```

**Rules:**
- Use `apiUrl()` from `tests/e2e/helpers/server.js` for all URLs
- Assert HTTP status codes and response shape, not exact data values
- Each test file covers one resource or flow (e.g., `clients.e2e.test.js`, `admin-review.e2e.test.js`)

#### Browser E2E Tests (Tier 6)

Use Playwright with headless Chromium. Files named `*.spec.js`.

```javascript
// tests/e2e/browser/dashboard.spec.js
import { test, expect } from '@playwright/test';

test('dashboard loads and shows summary cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Open Opportunities')).toBeVisible();
  await expect(page.getByText('Upcoming Deadlines')).toBeVisible();
});
```

**Rules:**
- Use Playwright's `test` and `expect` imports (NOT Vitest's)
- Keep tests focused on user-visible outcomes, not implementation details
- Use `page.goto('/')` with relative paths — `baseURL` is configured in `playwright.config.js`

#### When to Write E2E Tests

- Cross-cutting changes affecting multiple API routes or user flows
- Regression tests for bugs that unit tests could not catch
- Smoke tests for critical paths before deploy
- New API endpoints or pages

For the prioritized list of endpoints and flows to cover, see [`E2E-MATRIX.md`](./E2E-MATRIX.md).

---

## Fixtures

All test data lives in `tests/fixtures/`. Import what you need:

```javascript
import { clients } from '../../fixtures/clients.js';
import { opportunities } from '../../fixtures/opportunities.js';
import { coverageAreas } from '../../fixtures/coverageAreas.js';
import { matchScenarios } from '../../fixtures/matchScenarios.js';
import { deadlines } from '../../fixtures/deadlines.js';
```

Or use the central index with helpers:

```javascript
import { getAllClients, getOpenOpportunities, createTestDatabase } from '../../fixtures/index.js';
```

**When adding new fixtures**: Add to the appropriate fixture file and export from `index.js`. Fixtures serve as living documentation of your data contracts.

---

## Helpers

### Time Freezing

For deadline and days-left tests:

```javascript
beforeEach(() => {
  testUtils.freezeTime('2025-01-15T12:00:00Z');
});

afterEach(() => {
  testUtils.restoreTime();
});

test('5 days until deadline', () => {
  expect(calculateDaysLeft('2025-01-20T00:00:00Z')).toBe(5);
});
```

### Supabase Mock

For pipeline tests that need database operations:

```javascript
import { createSupabaseMock } from '../../helpers/supabaseMock.js';

const supabase = createSupabaseMock({
  funding_opportunities: [testOpp1, testOpp2],
  coverage_areas: [area1, area2],
});

// Supports: .select(), .eq(), .filter(), .insert(), .upsert(), .order(), .range(), .rpc()
```

---

## Naming Conventions

- Test files: `descriptiveName.test.js` (camelCase)
- API contract test files: `resourceName.api.test.js`
- API E2E test files: `resourceName.e2e.test.js`
- DB integration test files: `name.integration.test.js`
- Browser E2E test files: `flowName.spec.js`
- Describe blocks: feature area, then specific behavior
- Test names: plain English describing expected outcome

```javascript
describe('Client-Opportunity Matching: Match Criteria', () => {
  describe('Location Matching', () => {
    test('national opportunities match all clients', () => { ... });
    test('no coverage area intersection means no location match', () => { ... });
  });
});
```

---

## Known Gaps

| Gap | Priority | Notes |
|-----|----------|-------|
| UI component tests | Low | Backend correctness matters more; UI bugs are visually obvious |
| Full integration tests (API -> DB -> response) | Medium | Would catch column renames breaking RPCs |
| Real Supabase for Tier 3b | Medium | Methodology documented (see Tier 3b section above). Infrastructure pending: needs `supabase start` in Docker |
| Stage-to-stage pipeline handoff | Low | Tested in isolation; pipeline failures visible in staging table |
| E2E test coverage | Medium | Infrastructure ready; test cases tracked in [`E2E-MATRIX.md`](./E2E-MATRIX.md) |

### TODO: Tier 3 Database Tests Do Not Test the Database

**Problem**: Every test in `tests/database/` (views, RPCs, constraints) uses inline JS functions that *simulate* expected behavior against fixture data. None of them connect to a real database. This means:

1. **Schema drift is invisible.** If a SQL view is missing a column that an API route depends on, no test fails. The JS simulation just spreads the input object, so any column you put in test data appears in the output — regardless of whether the real view exposes it. (This caused a production bug: `program_id` was added to `funding_opportunities` but never to the view. The admin review page broke at runtime, and no test caught it.)

2. **SQL logic is untested.** The CASE expression for `status`, the ARRAY_AGG for `coverage_state_codes`, the GROUP BY behavior, NULL handling in aggregates — all of this is reimplemented in JS rather than tested against the real SQL. If the SQL and JS drift apart, the tests still pass.

3. **Migration correctness is assumed.** After running `supabase migration up`, we have no automated verification that the resulting schema matches what the application code expects.

**Scope of the problem**: 7 test files across `tests/database/` (views, RPCs, constraints) all share this pattern. The `tests/integration/` tier also uses fixture-only simulation.

**Stopgap in place**: `fundingOpportunitiesWithGeography.test.js` now has a "View Schema Contract" describe block with a manually-maintained column list. This catches consumer-vs-view mismatches but still doesn't verify against the actual database.

**What a fix looks like**: A small set of tests that connect to the local Supabase instance (`supabase start`) and run real queries — e.g., `SELECT * FROM funding_opportunities_with_geography LIMIT 1` to assert on actual columns, or call an RPC and verify the return shape. These would live in a new tier or sub-tier that requires Docker/Supabase to be running.

---

## Historical Reference

The original testing strategy documents that led to this system are archived in `docs/_archived/testing/` for historical reference. This README is the single source of truth for all testing guidance.
