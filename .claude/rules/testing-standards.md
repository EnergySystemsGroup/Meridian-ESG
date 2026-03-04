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
| New API route (`app/api/`) | **YES** | Critical + API | `test:critical && test:api` |
| Modified API route (response shape changed) | **YES** | Critical + API | `test:critical && test:api` |
| Modified API route (internal logic only) | **YES** | Critical + API | `test:critical && test:api` |
| New page/route | Verify in browser | — | Interactive verification (global standard) |
| New/modified lib function (`lib/`) | **YES** | Pipeline or Critical | `test:critical` or `test:pipeline` |
| Bug fix in business logic | **YES** (regression) | Matches affected tier | Matches affected tier |
| Cross-cutting change (multiple routes/pages) | **YES** | Critical + API | `test:critical && test:api` + verify in browser |
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
3. If tests required: write them using the **inline-function pattern**
4. Run the commands from the **Run Command** column in the decision gate
5. Fix any failures before proceeding
6. **Run `/testing-check`** — this is **MANDATORY before every commit**. It verifies test coverage, runs suites, and outputs a verdict. See `.claude/skills/testing/SKILL.md` for the full playbook.
7. Report task as complete only after `/testing-check` passes

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

E2E tests require `npm run dev` running on localhost:3000. Auth is automatically bypassed in dev mode (`middleware.js` line 6).

**User flow verification follows the global standard**: interactive browser-based verification (Preview tools, Playwright MCP, or Claude in Chrome) rather than writing Playwright spec files. Acceptance criteria on GitHub issues are the tracking mechanism.

**Existing automated E2E coverage** is maintained but not expanded as default practice:
- API E2E: `tests/e2e/api/` — Vitest + native `fetch()` (`npm run test:e2e:api`)
- Browser E2E: `tests/e2e/browser/` — Playwright headless Chromium (`npm run test:e2e:browser`)
- Config: `tests/e2e/playwright.config.js` | Helpers: `tests/e2e/helpers/`

**When to write a Playwright spec file**: Only for critical paths where automated regression protection justifies the maintenance cost. This is a last resort, not the default.
