# Testing Strategy Analysis: Meridian ESG

## Executive Summary

After analyzing the codebase and understanding your priorities, I'm reframing this strategy entirely. **Your real concern isn't the AI pipeline—it's user-facing reliability.** Sales people hitting errors, wrong match results, incorrect map numbers, broken filtering.

The good news: **These are all deterministic, highly testable systems.** This is actually much easier than testing AI output.

---

## Complete User-Facing Module Inventory

### 1. CLIENT MATCHING (HIGHEST PRIORITY)
**Location**: `/app/api/client-matching/route.js`

Four mandatory criteria—ALL must match:
1. **Location**: Coverage area intersection (client's areas ∩ opportunity's areas)
2. **Applicant Type**: Synonym + hierarchy expansion (e.g., "City Government" → "Municipal Government")
3. **Project Needs**: Client needs found in opportunity's eligible_project_types
4. **Activities**: Must include "hot" activities (construction/implementation)

**Where bugs hide**:
- Synonym expansion not working → false negatives
- Array intersection logic wrong → missed matches
- Substring matching direction reversed → no matches

---

### 2. OPPORTUNITY EXPLORER (`/funding/opportunities/`)

**Features to test**:
- Full-text search (titles, descriptions, summaries)
- Status filter (Open, Upcoming, Closed)
- Project Types filter (multi-select)
- State filter (single-select)
- Coverage Type filter (National, State, Local)
- **"My Opportunities" tracked filter** (starred items)
- Sorting (Relevance, Deadline, Amount, Recently Added)
- Sort direction toggle (asc/desc)
- **Pagination** (9 per page, prev/next, boundary states)
- **Active filters display** with remove/clear all
- **URL state persistence** (shareable filter URLs)

**Where bugs hide**:
- NULL deadlines not sorted correctly
- Pagination counts mismatch total
- URL params not syncing with UI state
- Tracked opportunities not filtering correctly

---

### 3. OPPORTUNITY DETAIL PAGE (`/funding/opportunities/[id]/`)

**Features to test**:
- **Tabbed content**: Overview, Eligibility, Details, Contact
- Funding amount display (min/max/total)
- Deadline & days-left calculation
- Geographic coverage breakdown
- Eligible applicants list
- Project types with color coding
- Track/untrack button
- **Related opportunities** recommendations
- Back navigation

**Where bugs hide**:
- Tab content not loading
- Days-left calculation off
- Related opportunities algorithm wrong

---

### 4. MAP (`/map/`)

**Features to test**:
- **US choropleth map** (all states)
- **State detail view** (counties/utilities)
- State selection/deselection (click to drill down, click again to return)
- **Color by Amount vs Color by Count** toggle
- Scope breakdown panel (National, State-wide, County, Utility counts)
- Opportunities list in side panel (paginated, 10 per page)
- **View Details tooltips** on hover
- All filters (search, status, project types, coverage scope)
- Summary stats (total opps, funding, states with funding)

**Where bugs hide**:
- Opportunities counted multiple times (multiple coverage areas)
- RPC failures → silent fallback to **hardcoded mock data**
- National vs state-wide logic inverted
- State click/deselect not working correctly
- Tooltip data mismatch

---

### 5. DASHBOARD (`/`)

**Summary Cards**:
- Open Opportunities count
- Upcoming Deadlines (30-day window)
- Max Available Funding
- Client Matches (clients with matches / total)

**Detail Cards**:
- Recent Opportunities (latest 5)
- Top Client Matches (best matches)
- Upcoming Deadlines (5 soonest)

**Chart**:
- Funding by Project Type visualization

**Where bugs hide**:
- 5-minute cache serves stale data
- Deadline count calculation wrong
- Match counts recalculated on every request (slow)

---

### 6. TIMELINE (`/timeline/`)

**Features to test**:
- Vertical timeline display grouped by month
- Event cards with: title, source, deadline, days-left
- **Days-left color coding** (red≤3, orange≤7, yellow≤14, green>14)
- Relevance score badge
- Event type badges
- "View Details" navigation
- Loading states
- Fallback when API fails

**Where bugs hide**:
- Days-left calculation off by 1
- Color thresholds wrong
- Month grouping logic errors

---

### 7. CLIENTS MODULE (`/clients/`)

**List View Features**:
- Search (name, type, location, needs, description)
- Client Type filter (multi-select)
- State filter (multi-select)
- Match Status filter (All, Has Matches, No Matches)
- DAC Status filter
- Sort by: Match Count, Name, Location
- Load More pagination (12 per batch)
- Active filters with remove/clear
- Top 3 matches preview on each card

**Client CRUD**:
- **Create client** (form with validation, geocoding)
- **Edit client** (modal form)
- **Delete client** (with confirmation)
- Auto-detect coverage areas from address

**Where bugs hide**:
- Geocoding fails silently
- Coverage area detection misses utilities
- Form validation edge cases
- Delete doesn't cascade properly

---

### 8. CLIENT DETAIL PAGE (`/clients/[id]/matches/`)

**Features to test**:
- Client header (name, type, location, budget, match count)
- Project needs display
- Match breakdown tags
- **Matches tab** with opportunity cards + match scores
- **Hidden matches tab** with restore functionality
- **Hide match** button (with confirmation)
- **Restore hidden match**
- **Export to PDF** button

**Where bugs hide**:
- Hidden matches not persisting
- Restore not working
- PDF export missing data
- Match score display wrong

---

## Current Test Infrastructure State

### The Good
- **Mature mock infrastructure**: 27 mock files
- **MSW setup**: Working API mocking
- **Some coverage** of agent scoring and filtering

### The Problems
1. **Wrong focus**: Most tests are for AI pipeline, not user-facing APIs
2. **Fragmented locations**: `__tests__/`, `lib/agents-v2/tests/`, `lib/services/tests/`
3. **Dual framework**: Jest (6 configs!) + Vitest both present
4. **No API route tests**: The critical paths have minimal coverage

---

## Revised Strategy: Test What Matters

Instead of "unit/integration/e2e", organize by **test purpose and reliability tier**:

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: CRITICAL PATH TESTS (Run on every commit)         │
│  "Sales people can use the app without errors"              │
│                                                             │
│  • Client matching algorithm (all 4 criteria)               │
│  • Coverage area intersection logic                         │
│  • Synonym/hierarchy expansion                              │
│  • Opportunity filtering & pagination                       │
│  • Map aggregation calculations                             │
│  • Dashboard statistics                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TIER 2: API CONTRACT TESTS (Run on every commit)          │
│  "API responses have correct shape"                         │
│                                                             │
│  • All /api/ routes return expected structure               │
│  • Error responses follow consistent format                 │
│  • Required fields never null/undefined                     │
│  • Pagination metadata correct                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TIER 3: DATABASE INTEGRATION (Run on PR/deploy)           │
│  "Queries work with real Supabase"                          │
│                                                             │
│  • RPC functions return correct data                        │
│  • Views calculate coverage_state_codes correctly           │
│  • Constraints enforced (no duplicates, FK integrity)       │
│  • Geographic queries (coverage area detection)             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TIER 4: AI PIPELINE (Run nightly/on-demand)               │
│  "Data ingestion works"                                     │
│                                                             │
│  • Extraction produces valid schemas                        │
│  • Scoring stays in bounds                                  │
│  • Storage doesn't corrupt data                             │
└─────────────────────────────────────────────────────────────┘
```

---

## File Organization: One Location, Clear Purpose

### Proposed Structure

```
tests/
├── critical/                    # TIER 1: Sales-critical functionality
│   ├── client-matching/
│   │   ├── matchCriteria.test.js      # All 4 criteria logic
│   │   ├── synonymExpansion.test.js   # Type hierarchy/synonyms
│   │   ├── coverageIntersection.test.js # Area overlap detection
│   │   ├── scoring.test.js            # Match score calculation
│   │   └── hiddenMatches.test.js      # Hide/restore functionality
│   │
│   ├── explorer/
│   │   ├── filters.test.js            # All filter combinations
│   │   ├── sorting.test.js            # All sort options + NULL handling
│   │   ├── pagination.test.js         # Page counts, boundaries
│   │   ├── urlState.test.js           # URL persistence/sync
│   │   └── trackedOpportunities.test.js  # Star/unstar logic
│   │
│   ├── opportunityDetail/
│   │   ├── tabContent.test.js         # All tabs load correctly
│   │   ├── daysLeft.test.js           # Deadline calculations
│   │   └── relatedOpps.test.js        # Related recommendations
│   │
│   ├── map/
│   │   ├── scopeBreakdown.test.js     # Count calculations
│   │   ├── fundingByState.test.js     # Aggregation accuracy
│   │   ├── stateSelection.test.js     # Drill-down/back behavior
│   │   ├── colorToggle.test.js        # Amount vs Count coloring
│   │   └── tooltips.test.js           # Hover data accuracy
│   │
│   ├── dashboard/
│   │   ├── summaryCards.test.js       # All 4 summary stats
│   │   ├── deadlines.test.js          # Days-left + 30-day count
│   │   ├── topMatches.test.js         # Ranking accuracy
│   │   └── recentOpps.test.js         # Latest 5 logic
│   │
│   ├── timeline/
│   │   ├── monthGrouping.test.js      # Group by month logic
│   │   ├── daysLeftColors.test.js     # Color thresholds (3/7/14)
│   │   └── eventCards.test.js         # Card data accuracy
│   │
│   └── clients/
│       ├── search.test.js             # Multi-field search
│       ├── filters.test.js            # Type, state, match status, DAC
│       ├── crud.test.js               # Create, edit, delete
│       ├── geocoding.test.js          # Address → coverage areas
│       └── pdfExport.test.js          # Export functionality
│
├── api/                         # TIER 2: API contract tests
│   ├── funding.api.test.js            # GET/POST /api/funding
│   ├── client-matching.api.test.js    # All matching endpoints
│   ├── clients.api.test.js            # CRUD endpoints
│   ├── map.api.test.js                # All map endpoints
│   ├── deadlines.api.test.js          # Deadline endpoints
│   ├── counts.api.test.js             # Count endpoints
│   └── export.api.test.js             # PDF export endpoint
│
├── database/                    # TIER 3: Real DB integration
│   ├── rpc/
│   │   ├── getFundingDynamicSort.test.js
│   │   ├── findCoverageAreasForPoint.test.js
│   │   ├── getScopeBreakdown.test.js
│   │   └── getFundingByState.test.js
│   ├── views/
│   │   └── fundingOpportunitiesWithGeography.test.js
│   └── constraints/
│       ├── duplicatePrevention.test.js
│       └── cascadeDeletes.test.js
│
├── pipeline/                    # TIER 4: AI pipeline (run nightly/on-demand)
│   ├── extraction/
│   │   ├── schemaCompliance.test.js   # Output matches expected schema
│   │   ├── apiHandlers.test.js        # Single/two-step API handling
│   │   ├── pagination.test.js         # Cursor/offset pagination
│   │   └── errorRecovery.test.js      # Retry logic, rate limiting
│   │
│   ├── analysis/
│   │   ├── contentEnhancement.test.js # 6 enhanced fields generated
│   │   ├── scoring.test.js            # Tier/funding/activity scoring
│   │   ├── scoreInvariants.test.js    # Scores always 0-10, no nulls
│   │   └── batchProcessing.test.js    # Parallel processing, batching
│   │
│   ├── storage/
│   │   ├── dataSanitizer.test.js      # Cleanup/normalization
│   │   ├── upsertLogic.test.js        # Insert vs update behavior
│   │   ├── coverageLinking.test.js    # Link to coverage areas
│   │   └── duplicateDetection.test.js # Early duplicate prevention
│   │
│   └── orchestration/
│       ├── sourceOrchestrator.test.js # Full pipeline coordination
│       ├── runManager.test.js         # Run state management
│       └── performanceMetrics.test.js # Token usage, timing
│
├── fixtures/                    # Shared test data
│   ├── clients.js               # Sample client records
│   ├── opportunities.js         # Sample opportunities (various states)
│   ├── coverageAreas.js         # Utilities, counties, states
│   ├── matchScenarios.js        # Pre-defined matching edge cases
│   └── deadlines.js             # Various deadline scenarios
│
└── helpers/
    ├── supabaseMock.js          # In-memory DB mock
    ├── apiTestClient.js         # HTTP testing helper
    ├── factories.js             # Data generation
    └── dateHelpers.js           # Freeze time utilities
```

### Why This Structure?

1. **Priority-ordered**: `critical/` folder = what you test first and most thoroughly
2. **Single location**: No more hunting across multiple directories
3. **Clear ownership**: `critical/client-matching/` tells you exactly what's tested
4. **Fixtures are reusable**: One source of truth for test data
5. **Tiers are separated**: Easy to run different test groups

---

## My Opinion on Mocking

### The Problem with Current Mocking

You have 27 mock files mirroring your source structure. This creates:
- **Maintenance burden**: Every refactor requires mock updates
- **False confidence**: Mocks can drift from real behavior
- **Test brittleness**: Tests break when implementation changes, not behavior

### My Recommendation: Mock Strategically by Tier

**For Tier 1 & 2 (Critical + API tests):**
```
✅ Mock Supabase with in-memory store (control the data)
✅ Mock external APIs (Mapbox geocoding)
❌ DON'T mock your own business logic—let it run!
```

**For Tier 3 (Database tests):**
```
✅ Use real Supabase (local CLI or test project)
✅ Seed known data, assert against it
❌ No mocks—that defeats the purpose
```

**For Tier 4 (Pipeline tests):**
```
✅ Mock Anthropic with valid schema responses
✅ Mock Supabase for speed
✅ Test schema compliance, not exact content
```

### The One Mock You Need

A Supabase mock that **actually behaves like a database**:

```javascript
// tests/helpers/supabaseMock.js
export function createSupabaseMock(initialData = {}) {
  const tables = new Map(Object.entries(initialData));

  return {
    from: (table) => ({
      select: () => ({ data: tables.get(table) || [], error: null }),
      insert: (records) => {
        tables.set(table, [...(tables.get(table) || []), ...records]);
        return { data: records, error: null };
      },
      upsert: (records) => { /* merge logic */ },
      // ... full CRUD behavior
    }),
    rpc: (name, params) => mockRpcResponses[name]?.(params) || { data: null, error: null }
  };
}
```

This lets you test matching logic with controlled data. Then Tier 3 tests use real Supabase to catch actual query bugs.

### Delete the `__mocks__/` Structure

Those 27 files mirroring source code? **Delete them.** They:
- Create maintenance burden
- Give false confidence
- Test mocks, not code

Replace with the single smart Supabase mock + fixture data.

---

## Framework Decision: Pick One

You have Jest AND Vitest. This is cognitive overhead.

### My Recommendation: **Vitest**

| Criteria | Jest | Vitest |
|----------|------|--------|
| Speed | Slower | 10-20x faster |
| ESM Support | Requires transforms | Native |
| Watch Mode | Good | Better (HMR-based) |
| Config | Complex (you have 6 configs) | Simple |
| Mock API | `jest.fn()` | `vi.fn()` (same API) |
| Next.js | Needs config | Works with `@vitejs/plugin-react` |

**Action**: Migrate to Vitest, delete Jest configs.

---

## AI Pipeline Testing Strategy

The pipeline has **deterministic** and **non-deterministic** parts:

| Component | Determinism | Testing Approach |
|-----------|-------------|------------------|
| API handlers (fetch, pagination) | Deterministic | Mock HTTP responses, test all paths |
| Data extraction (LLM parsing) | **Non-deterministic** | Test schema compliance, not exact values |
| Content enhancement (LLM generation) | **Non-deterministic** | Test all 6 fields present, types correct |
| Scoring (tier, funding, activity) | **100% Deterministic** | Exhaustive testing, exact assertions |
| Data sanitization | Deterministic | All edge cases, malformed input |
| Storage (UPSERT, linking) | Deterministic | Test insert vs update behavior |
| Duplicate detection | Deterministic | Known duplicates caught |

### Testing Non-Deterministic LLM Output

**Don't test**: Exact content values
**Do test**:
1. **Schema compliance**: Output has all required fields with correct types
2. **Invariants**: Scores always 0-10, dates valid or null, no undefined values
3. **Behavioral properties**: Empty input → empty output, invalid JSON → graceful fallback

```javascript
// Example: Schema compliance test
test('extraction output has required fields', async () => {
  const result = await extractOpportunities(mockApiResponse);

  // Don't assert: result.opportunities[0].title === "Specific Title"
  // Do assert:
  expect(result.opportunities).toBeInstanceOf(Array);
  result.opportunities.forEach(opp => {
    expect(opp).toHaveProperty('title');
    expect(typeof opp.title).toBe('string');
    expect(opp).toHaveProperty('fundingAmount');
    // ... all required fields
  });
});
```

### Testing Deterministic Scoring

The scoring functions are pure and should have **100% test coverage**:

```javascript
// Example: Exact assertion tests
test.each([
  [['Commercial'], ['Energy Efficiency'], 7.5],
  [['Residential'], ['Solar'], 5.0],
  [[], [], 0],
])('calculateTierScore(%j, %j) = %d', (applicants, types, expected) => {
  expect(calculateTierScore(applicants, types)).toBe(expected);
});
```

---

## What to Test vs What NOT to Test

### DO Test (Priority Order)

**User-Facing (Tier 1-2):**
1. **Client matching criteria**: Coverage intersection, type synonyms, needs matching, activities
2. **Filtering logic**: Status, state, category filters work correctly
3. **Aggregation calculations**: Map counts, dashboard stats, deadline calculations
4. **API response contracts**: Required fields present, types correct, pagination works
5. **Database queries**: RPC functions return correct data, views calculate correctly
6. **Edge cases**: NULL deadlines, empty arrays, missing coverage areas

**AI Pipeline (Tier 4):**
7. **Scoring algorithms**: 100% coverage on tier/funding/activity scoring
8. **Schema compliance**: LLM output has all required fields
9. **Invariants**: Scores 0-10, dates valid, no undefined values
10. **Data sanitization**: All edge cases, malformed input handling
11. **Duplicate detection**: Known duplicates caught before processing

### DON'T Test (Or Test Minimally)
- **Exact LLM output content**: It varies. Test schema compliance only.
- **React components**: Lower priority—backend correctness matters more
- **Implementation details**: Don't assert "function X was called 3 times"
- **External APIs you don't control**: Mock Mapbox, don't test Mapbox

---

## Example: How Tests Would Look

### Client Matching Test (Tier 1 Critical)
```javascript
// tests/critical/client-matching/synonymExpansion.test.js
import { expandClientType } from '@/app/api/client-matching/utils';
import { TAXONOMIES } from '@/lib/taxonomies';

describe('Client Type Synonym Expansion', () => {
  test.each([
    ['City Government', ['City Government', 'Municipal Government', 'Local Governments']],
    ['Municipal Government', ['Municipal Government', 'City Government', 'Local Governments']],
    ['Utility', ['Utility', 'Electric Utilities', 'Gas Utilities']],
    ['Unknown Type', ['Unknown Type']], // No expansion
  ])('expandClientType("%s") includes %j', (input, expectedToContain) => {
    const expanded = expandClientType(input, TAXONOMIES);
    expectedToContain.forEach(type => {
      expect(expanded).toContain(type);
    });
  });
});
```

### Coverage Area Intersection Test (Tier 1 Critical)
```javascript
// tests/critical/client-matching/coverageIntersection.test.js
import { createSupabaseMock } from '../helpers/supabaseMock';
import { fixtures } from '../fixtures';

describe('Coverage Area Matching', () => {
  test('client matches opportunity when coverage areas overlap', async () => {
    const supabase = createSupabaseMock({
      clients: [fixtures.clients.pgeBayAreaClient], // coverage_area_ids: [1, 2]
      funding_opportunities: [fixtures.opportunities.californiaUtilityGrant], // areas: [1, 3]
    });

    const matches = await getClientMatches(supabase, 'client-1');

    expect(matches).toHaveLength(1);
    expect(matches[0].opportunity_id).toBe('ca-utility-grant');
  });

  test('client does NOT match when no coverage overlap', async () => {
    const supabase = createSupabaseMock({
      clients: [fixtures.clients.pgeBayAreaClient], // CA areas
      funding_opportunities: [fixtures.opportunities.texasOnlyGrant], // TX areas
    });

    const matches = await getClientMatches(supabase, 'client-1');

    expect(matches).toHaveLength(0);
  });

  test('national opportunities match all clients', async () => {
    const supabase = createSupabaseMock({
      clients: [fixtures.clients.pgeBayAreaClient],
      funding_opportunities: [fixtures.opportunities.nationalGrant], // is_national: true
    });

    const matches = await getClientMatches(supabase, 'client-1');

    expect(matches).toHaveLength(1);
  });
});
```

### Dashboard Days-Left Calculation (Tier 1 Critical)
```javascript
// tests/critical/dashboard/deadlines.test.js
import { calculateDaysLeft } from '@/app/api/deadlines/utils';

describe('Days Left Calculation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  test.each([
    ['2025-01-16T23:59:59Z', 1],  // Tomorrow
    ['2025-01-15T23:59:59Z', 0],  // Today
    ['2025-01-20T00:00:00Z', 5],  // 5 days
    ['2025-01-14T00:00:00Z', -1], // Yesterday (past)
  ])('deadline %s = %d days left', (deadline, expected) => {
    expect(calculateDaysLeft(deadline)).toBe(expected);
  });

  test('null deadline returns null', () => {
    expect(calculateDaysLeft(null)).toBeNull();
  });
});
```

### Property-Based Test (Invariants)
```javascript
// tests/critical/client-matching/scoring.invariant.test.js
import { fc } from 'fast-check';
import { calculateMatchScore } from '@/app/api/client-matching/utils';

test('match score is always 0-100 regardless of inputs', () => {
  fc.assert(
    fc.property(
      fc.array(fc.string(), { minLength: 0, maxLength: 20 }), // client needs
      fc.array(fc.string(), { minLength: 0, maxLength: 50 }), // opportunity types
      (clientNeeds, opportunityTypes) => {
        const score = calculateMatchScore(clientNeeds, opportunityTypes);
        return score >= 0 && score <= 100;
      }
    )
  );
});

test('empty client needs always produces 0 score', () => {
  fc.assert(
    fc.property(
      fc.array(fc.string(), { minLength: 0, maxLength: 50 }),
      (opportunityTypes) => {
        const score = calculateMatchScore([], opportunityTypes);
        return score === 0;
      }
    )
  );
});
```

---

## Migration Path

### Phase 1: Build New Structure
1. Create `tests/` directory with proposed structure
2. Create `tests/helpers/supabaseMock.js` (smart in-memory mock)
3. Create `tests/fixtures/` with realistic test data
4. Set up Vitest config (single file, clean)

### Phase 2: Write Critical Tests First (User-Facing)
1. Client matching (all 4 criteria) - **highest impact**
2. Coverage area intersection logic
3. Synonym expansion
4. Explorer filtering + sorting + pagination
5. Map aggregations + scope breakdown
6. Dashboard statistics
7. Days-left calculations
8. Timeline month grouping
9. Client CRUD + geocoding

### Phase 2b: Write Pipeline Tests
10. Scoring algorithms (100% coverage)
11. Schema compliance for LLM output
12. Score invariants (fast-check)
13. Data sanitization
14. Duplicate detection

### Phase 3: Add API Contract Tests
1. All `/api/` routes return correct structure
2. Error handling is consistent
3. Pagination works correctly

### Phase 4: Database Integration Tests
1. Test RPC functions with real Supabase
2. Verify views calculate correctly
3. Run on PR/deploy only

### Phase 5: Archive Old Tests
1. Review existing 55 test files
2. Extract any valuable fixtures/scenarios
3. Delete `__tests__/`, `__mocks__/`, and scattered test files
4. Delete 6 Jest config files

---

## Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Priority** | AI pipeline focused | User-facing first, then pipeline |
| **Organization** | 3+ scattered locations | Single `tests/` directory |
| **Categories** | unit/integration/e2e | critical/api/database/pipeline by tier |
| **Framework** | Jest + Vitest (confusing) | Vitest only |
| **Mocking** | 27 files mirroring source | 1 smart Supabase mock + fixtures |
| **User-facing coverage** | Minimal | 100% on matching, filtering, map, dashboard, timeline, clients |
| **Pipeline coverage** | Some | Schema compliance + scoring (100%) + invariants |
| **Run frequency** | All on commit | Tiered: critical→commit, DB→PR, pipeline→nightly |

### Test Count Breakdown

| Tier | Test Files | Focus |
|------|-----------|-------|
| **Tier 1: Critical** | ~30 files | Client matching, explorer, map, dashboard, timeline, clients |
| **Tier 2: API** | ~7 files | All API route contracts |
| **Tier 3: Database** | ~6 files | RPC functions, views, constraints |
| **Tier 4: Pipeline** | ~15 files | Extraction, analysis, storage, orchestration |
| **Total** | ~58 files | Complete coverage |

---

## The Vision

**Test what matters to your users.** Sales people don't care if the AI extraction works perfectly—they care if:
- Client matches are accurate
- Filtering finds the right opportunities
- Numbers on the dashboard are correct
- The app doesn't error out

Focus 80% of testing effort there. The AI pipeline? It's working, it runs periodically, and if it fails, you'll notice before users do.

This isn't the conventional pyramid. It's **testing shaped by risk**: the highest risk is user-facing bugs, so that's where the tests go.

---

## Identified Gaps (Added During Implementation Review)

The following gaps were identified after building the initial 38 test files. These represent areas not covered in the original strategy.

### Gap 1: Full Integration Tests

**Problem**: Each tier tests in isolation. Nothing verifies that API route → business logic → database query → response shape works end-to-end.

**Example failure this would catch**: A column rename in Supabase breaks the RPC function, but Tier 1 tests (which use fixtures, not real queries) still pass.

**Plan**: Add `tests/integration/` folder with 3 flow tests:
- `clientMatchingFlow.test.js` — API route → matching logic → mock DB → response shape
- `explorerFlow.test.js` — API route → filtering/sorting → mock DB → paginated response
- `dashboardFlow.test.js` — API route → stats calculation → mock DB → summary cards

These use the Supabase mock (not real DB) but wire together all layers.

### Gap 2: Pipeline Stage-to-Stage Handoff

**Problem**: Pipeline stages (extraction → analysis → storage) are tested individually, but nothing verifies that Stage 1's output is valid Stage 2 input.

**Example failure this would catch**: Extraction outputs `funding_amount` as a string, but analysis expects a number. Each stage's tests pass with their own fixtures.

**Plan**: Add `tests/pipeline/handoff/` with 2 tests:
- `extractionToAnalysis.test.js` — Stage 1 output schema is valid Stage 2 input
- `analysisToStorage.test.js` — Stage 2 output schema is valid Stage 3 input

### Gap 3: Error Boundary / Resilience Tests

**Problem**: No tests for what happens when things fail — API errors, malformed data, Supabase timeouts.

**Plan**: Add error-focused tests:
- `tests/api/errorResponses.api.test.js` — Validates error response format (status codes, error shapes)
- `tests/pipeline/extraction/supabaseDown.test.js` — Tests graceful degradation when Supabase is unreachable

### Gap 4: Manual Staging Pipeline Tests

**Problem**: The manual staging pipeline (`manual_funding_opportunities_staging` table) has state machine logic (pending → complete → failed) that's untested.

**Plan**: Add `tests/pipeline/staging/` with 2 tests:
- `stagingStateMachine.test.js` — Tests status transitions for extraction/analysis/storage phases
- `stagingImport.test.js` — Tests discovery file → staging table insertion logic

### Gap 5: Real Supabase for Tier 3 (Roadmap)

**Current state**: Tier 3 database tests simulate RPC behavior in JavaScript. This catches logic errors but misses actual PostgreSQL behavior (NULL sorting, array operators, index usage).

**Plan**: When Docker is available in CI:
1. Use `supabase start` to spin up local PostgreSQL
2. Seed with fixture data via `psql`
3. Run Tier 3 tests against real database
4. Add `npm run test:database:real` script

This is blocked on CI/CD environment setup and is lower priority than Gaps 1-4.

### Gap 6: Old Test Infrastructure Cleanup

**Problem**: 90 old files remain from the Jest era:
- `__tests__/` (57 files)
- `__mocks__/` (27 files)
- 6 Jest config files (`jest.config.js`, `jest.config.ci.js`, `jest.config.unit.js`, `jest.config.integration.js`, `jest.config.node.js`, `jest.setup.js`)

**Plan**: After ALL new tests pass:
1. Delete old directories and configs
2. Remove legacy npm scripts from `package.json`
3. Remove Jest from `devDependencies`
4. Document deletion in git commit message with archive reference
