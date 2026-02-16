# Testing Guide — Meridian ESG

## Quick Reference

```bash
npm run test              # All tests
npm run test:critical     # Tier 1: user-facing logic
npm run test:api          # Tier 2: API response contracts
npm run test:database     # Tier 3: database behavior
npm run test:pipeline     # Tier 4: AI pipeline
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
        |     -> tests/database/
        |
        +-- AI pipeline processing?
              -> tests/pipeline/
```

### Tier Details

| Tier | Folder | Tests What | Mocking Strategy | Runs When |
|------|--------|-----------|-----------------|-----------|
| **1: Critical** | `tests/critical/` | Business logic — matching algorithm, scoring, filtering, pagination, aggregations, deadline calculations | None. Pure functions fed fixture data. | Every commit |
| **2: API** | `tests/api/` | Response shapes — required fields present, correct types, error format, pagination metadata | None. Schema validation on test objects. | Every commit |
| **3: Database** | `tests/database/` | RPC functions, views, constraints — sort behavior, NULL handling, filter combinations | Simulated RPC logic (goal: real local Supabase) | PR / deploy |
| **4: Pipeline** | `tests/pipeline/` | Scoring algorithms, data sanitization, duplicate detection, LLM schema compliance | Anthropic SDK mock + Supabase in-memory mock | Nightly / on-demand |

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
│   └── constraints/             # Duplicate prevention, cascade deletes
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
├── helpers/                     # Test utilities
│   ├── setup.js                 # Global setup (env vars, time utils, cleanup)
│   └── supabaseMock.js          # In-memory Supabase with CRUD support
│
└── vitest.config.js             # Single Vitest configuration
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
- Currently uses simulated RPC logic in JavaScript
- Test sort directions, NULL placement, filter combinations, pagination math
- Goal: migrate to real local Supabase via `supabase start`

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
- API test files: `resourceName.api.test.js`
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
| Real Supabase for Tier 3 | Medium | Currently simulated; needs `supabase start` in Docker |
| Stage-to-stage pipeline handoff | Low | Tested in isolation; pipeline failures visible in staging table |

---

## Full Strategy Document

For the complete rationale, migration plan, and architectural decisions behind this testing approach, see [`docs/testing-strategy.md`](../docs/testing-strategy.md).
