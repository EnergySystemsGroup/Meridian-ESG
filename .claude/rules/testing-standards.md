# Testing Standards

## Framework & Commands

**Framework**: Vitest only. All tests live in `tests/`. See [`tests/README.md`](tests/README.md) for the full testing guide.

```bash
npm run test              # Run all tests
npm run test:critical     # Tier 1: user-facing logic (every commit)
npm run test:api          # Tier 2: API contracts (every commit)
npm run test:database     # Tier 3: DB behavior (PR/deploy)
npm run test:pipeline     # Tier 4: AI pipeline (nightly)
npm run test:e2e          # Tier 5+6: All E2E (requires dev server running)
npm run test:e2e:api      # Tier 5: API E2E (Vitest + fetch against localhost)
npm run test:e2e:browser  # Tier 6: Browser E2E (Playwright)
```

## When to Write Tests

Every new feature or bug fix that touches business logic, API routes, or database queries must include tests. Use this decision tree for placement:

| Question | Tier | Folder |
|----------|------|--------|
| Does a user see this result? (matching, filtering, dashboard stats) | Critical | `tests/critical/` |
| Is this about API response shape? (field types, error format) | API | `tests/api/` |
| Is this a database query or RPC? | Database | `tests/database/` |
| Is this AI pipeline processing? | Pipeline | `tests/pipeline/` |
| Full HTTP round-trip against running server? | API E2E | `tests/e2e/api/` |
| User workflow in a real browser? | Browser E2E | `tests/e2e/browser/` |

## Conventions

- Import test data from `tests/fixtures/` — never hardcode data inline
- Use `tests/helpers/supabaseMock.js` for DB-dependent pipeline tests
- Critical tests should test **pure functions** with no mocks when possible
- Pipeline tests: exact assertions for deterministic code, schema-only for LLM output

## Decision Gate

**STOP and check this gate before reporting any task as complete.** For every file you modified, ask:

| Change Type | Tests Required? | Tier(s) | Run Command |
|-------------|:-:|------|------|
| New API route (`app/api/`) | **YES** | Critical + API + **API E2E** | `test:critical && test:api` + `test:e2e:api` |
| Modified API route (response shape changed) | **YES** | Critical + API + **API E2E** | `test:critical && test:api` + `test:e2e:api` |
| Modified API route (internal logic only) | **YES** | Critical + API | `test:critical && test:api` |
| New page/route | **YES** | **Browser E2E** (smoke) | `test:e2e:browser` |
| New/modified lib function (`lib/`) | **YES** | Pipeline or Critical | `test:critical` or `test:pipeline` |
| Bug fix in business logic | **YES** (regression) | Matches affected tier | Matches affected tier |
| Cross-cutting change (multiple routes/pages) | **YES** | Unit tiers + **E2E** (both) | `test:critical && test:api && test:e2e` |
| Skill file (`.claude/skills/`) | NO | — | — |
| Agent file (`.claude/agents/`) | NO | — | — |
| Database migration — new table/column/view/RPC | **YES** | **DB Integration** (3b) + update Tier 3 simulated | `test:database` + `test:db:integration` (when infra ready) |
| Database migration — index/constraint only | NO | Verify via `supabase migration up` | — |
| Modified SQL view or RPC function | **YES** | **DB Integration** (3b) + update Tier 3 simulated | `test:database` + `test:db:integration` (when infra ready) |
| Documentation / config | NO | — | — |
| UI components only | NO | — | — |

## Workflow

Test-after — write tests once implementation is stable:

1. Implement the change
2. **Check the decision gate above** for every file you touched
3. If tests required: write them using the **inline-function pattern** (Tiers 1-4) or e2e patterns (Tiers 5-6)
4. **Update tracking**: If you created a NEW API endpoint, add a row to `tests/E2E-MATRIX.md` (Tier 5 table). If you created a NEW page/route, add a row to the Tier 6 table. If you wrote an e2e test, update its Status to `covered`.
5. Run the commands from the **Run Command** column in the decision gate
6. Fix any failures before proceeding
7. **Run `/testing-check`** — this is **MANDATORY before every commit**. It verifies test coverage, runs suites, and checks the E2E matrix. See `.claude/skills/testing/SKILL.md` for the full playbook.
8. Report task as complete only after `/testing-check` passes

## Inline-Function Pattern

This project's test architecture requires it:

```javascript
// CORRECT: Define the function inline in the test file
function isPromotionVisible(promotionStatus) {
  return promotionStatus === null || promotionStatus === 'promoted';
}

test('pending_review records are excluded', () => {
  expect(isPromotionVisible('pending_review')).toBe(false);
});
```

```javascript
// WRONG: Never import from app code — Next.js module resolution breaks in Vitest
import { isPromotionVisible } from '@/app/api/counts/route';  // WILL FAIL
```

**Why**: Vitest cannot resolve Next.js path aliases (`@/`) or server-only modules. All 68+ test files in this repo use inline pure functions that replicate the production logic.

**Inline function drift**: When you modify logic in an API route or lib function, you MUST also update the corresponding inline function in the test file. The test function must mirror the production logic — if they drift apart, the tests become meaningless.

**"But my change is just one line"**: One-line changes to query filters, scoring logic, or matching criteria are business logic changes. They determine what users see. If the decision gate says YES, write the test. No exceptions for "trivial" changes.

## Test Integrity: Never Paper Over Bugs

**When a test fails, the first question is always: "Is the test wrong, or is the code wrong?"**

- If the CODE is wrong: **fix the code**, then confirm the test passes.
- If the TEST is wrong (wrong assertion, wrong selector, wrong assumption): fix the test.
- **NEVER** make a test tolerate a known failure. If a route returns 500, don't write `if (res.status === 200)` to skip the check — fix the route.

**Banned patterns:**
- `if (res.status === 200) { /* only then check headers */ }` — asserts nothing on failure
- `expect(res.ok).toBe(true)` when a specific status code is expected — too loose
- Comments like "known issue", "server bug" followed by weakened assertions
- Filtering out real errors (e.g., hydration) instead of tracking/fixing them

**If a bug can't be fixed immediately:** mark the test as `test.skip()` or `test.todo()` with a comment linking to the issue. A skipped test is honest; a passing test that ignores failures is dangerous.

## E2E Testing

E2E tests live in `tests/e2e/` and require `npm run dev` running on localhost:3000. Auth is automatically bypassed in dev mode (`middleware.js` line 6). API E2E uses Vitest + native `fetch()` (`*.e2e.test.js`); Browser E2E uses Playwright + headless Chromium (`*.spec.js`). See [`tests/README.md`](tests/README.md) and [`tests/E2E-MATRIX.md`](tests/E2E-MATRIX.md) for full details and coverage tracking.

## Batch E2E Test Runs

Batch E2E test runs use `Work Type = Test` on the project board. They follow a different lifecycle than feature/bug/chore issues.

### When to Create Test Issues

- After a spec is written and a test matrix is produced
- After a batch of related features lands on staging and needs verification
- For periodic regression test runs

### Workflow

1. **Spec written** → test matrix produced (or updated in `tests/E2E-MATRIX.md`)
2. **Create a Test issue** on the project board using the `test` template
3. **Pick up the issue** — create a `test/<short-description>` branch off staging
4. **Write the test files** (Playwright specs, Vitest tests, etc.)
5. **Execute the tests** and record results
6. **Check off each assertion** as PASS in the issue body
7. **If failures** — create a Bug issue for each failure, linked back to the test issue in Context
8. **Close the test issue** with a results summary note
9. **Update the test matrix** document with execution results

### Test Issue Structure

Test issues use the `test.yml` template with fields different from feature/bug/chore:
- **Test Scope** — what spec or feature area is being tested, with test matrix reference
- **Assertions** — pass/fail checkboxes per test case or requirement group (e.g., `- [ ] TX-014: Task CRUD (REQ-214-225) — PASS`)
- **Test Type** — E2E (Playwright), Component (Vitest/RTL), Integration, or Performance
- **Context** — links to test matrix doc, related feature issues

### After Running Tests

- **All pass** — check off all assertions, close the issue
- **Failures** — create a Bug issue for each failure (link to the test issue in Context), then close the test issue with a summary note
