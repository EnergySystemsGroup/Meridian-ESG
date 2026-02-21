# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL: Git Commit Policy

**NEVER commit changes without explicit user permission.**

- Do NOT use `git commit` unless the user explicitly asks you to commit
- Do NOT use `git commit --amend` without permission
- Always ask before committing, even if changes seem ready
- Exception: User explicitly says "commit this" or "go ahead and commit"

If you accidentally commit without permission, immediately inform the user and offer to undo it with `git reset HEAD~1`.

## Project Overview

Meridian is a Policy & Funding Intelligence Platform built with Next.js that helps organizations track funding opportunities, monitor legislation, and match clients to relevant funding sources. The platform features a comprehensive dashboard, geographic mapping, and advanced agent-based data processing.

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests with Vitest
npm run test:run     # Run tests once
```

### Task Management
```bash
task-master          # Run task-master CLI (globally installed)
```

## Claude Code Task Management Guidelines

- Use the `task-master` CLI to manage all project tasks.
- Regularly run `task-master next` to fetch the current task, and `task-master complete <id>` when finished.
- Keep the task list accurate: update task content if new information emerges or implementation details change.
- If a task appears vague, incomplete, or inconsistent with project goals, pause and raise a concern before proceeding.
- Maintain alignment between project requirements and task execution—act as a second set of eyes.
- Log your progress explicitly within the task system; do not assume implicit understanding.
- **Use specialized sub-agents proactively when tasks warrant their expertise** (e.g., code-info-retriever for codebase analysis, database-architect-dba for schema work, supabase-query-agent for data queries).
- **For codebase research**: Always use the code-info-retriever agent when you need to understand existing functionality, locate code sections, or analyze how features are implemented.


### Data Processing Scripts
```bash
npm run add-grants-gov-source    # Add Grants.gov as a funding source
npm run test-config             # Test configuration system
```

## Architecture Overview

### Core Technology Stack
- **Frontend**: Next.js 15 with App Router, React 18, TailwindCSS
- **UI Components**: Radix UI primitives with shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **AI/ML**: Anthropic Claude SDK for agent processing
- **Testing**: Vitest
- **Deployment**: Vercel

### Key Directories Structure

```
app/
├── api/                    # Next.js API routes
├── components/            # Reusable UI components
├── lib/                   # Core business logic
│   ├── agents-v2/         # Optimized agent architecture
│   ├── services/          # Service layer coordinators
│   └── utils/             # Utility functions
├── (routes)/              # App router pages
└── globals.css           # Global styles

supabase/
├── migrations/           # Database schema changes
└── functions/           # Edge functions
```

### Agent Architecture (V2)

The application uses a sophisticated agent-based system for processing funding opportunities:

**Core Agents:**
- **Storage Agent**: Handles data persistence, duplicate detection, and state management
- **Data Extraction Agent**: Processes API responses and extracts structured data
- **Analysis Agent**: Performs content enhancement and scoring
- **Source Orchestrator**: Coordinates processing workflows

**Key Features:**
- Direct Anthropic SDK integration (no LangChain overhead)
- Native JSON Schema support
- Built-in performance tracking and retry logic
- Batch processing with concurrency controls
- Early duplicate detection to prevent redundant processing

### Database Architecture

The system uses Supabase PostgreSQL with:
- **funding_opportunities**: Core opportunity data
- **funding_sources**: API source configurations
- **runs**: Processing execution tracking
- **coverage_areas**: Geographic entities with PostGIS polygons

Key views and functions handle complex queries for the dashboard and mapping features.

### Geographic Filtering (IMPORTANT)

**Use `coverage_areas` system, NOT legacy `eligible_states`.**

| Current System | Deprecated |
|----------------|------------|
| `opportunity_coverage_areas` table | `opportunity_state_eligibility` table |
| `coverage_state_codes` view column | `eligible_states` view column |

```javascript
// Correct: filter by coverage areas
query.or(`is_national.eq.true,coverage_state_codes.cs.{${stateCode}}`);

// WRONG: don't use eligible_states
query.or(`is_national.eq.true,eligible_states.cs.{${stateCode}}`);
```

See `docs/architecture/ADR-001-geographic-filtering.md` for details.

## Development Guidelines

### Environment Setup
Required environment variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### Testing

**Framework**: Vitest only. All tests live in `tests/`. See [`tests/README.md`](tests/README.md) for the full testing guide.

**Commands**:
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

**When to write tests**: Every new feature or bug fix that touches business logic, API routes, or database queries must include tests. Use this decision tree for placement:

| Question | Tier | Folder |
|----------|------|--------|
| Does a user see this result? (matching, filtering, dashboard stats) | Critical | `tests/critical/` |
| Is this about API response shape? (field types, error format) | API | `tests/api/` |
| Is this a database query or RPC? | Database | `tests/database/` |
| Is this AI pipeline processing? | Pipeline | `tests/pipeline/` |
| Full HTTP round-trip against running server? | API E2E | `tests/e2e/api/` |
| User workflow in a real browser? | Browser E2E | `tests/e2e/browser/` |

**Conventions**:
- Import test data from `tests/fixtures/` — never hardcode data inline
- Use `tests/helpers/supabaseMock.js` for DB-dependent pipeline tests
- Critical tests should test **pure functions** with no mocks when possible
- Pipeline tests: exact assertions for deterministic code, schema-only for LLM output

### AI Agent Testing Workflow

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

**Workflow** (test-after — write tests once implementation is stable):
1. Implement the change
2. **Check the decision gate above** for every file you touched
3. If tests required: write them using the **inline-function pattern** (Tiers 1-4) or e2e patterns (Tiers 5-6)
4. **Update tracking**: If you created a NEW API endpoint, add a row to `tests/E2E-MATRIX.md` (Tier 5 table). If you created a NEW page/route, add a row to the Tier 6 table. If you wrote an e2e test, update its Status to `covered`.
5. Run the commands from the **Run Command** column in the decision gate
6. Fix any failures before proceeding
7. **Run `/testing-check`** — this is **MANDATORY before every commit**. It verifies test coverage, runs suites, and checks the E2E matrix. See `.claude/skills/testing/SKILL.md` for the full playbook.
8. Report task as complete only after `/testing-check` passes

**Inline-function pattern** — This project's test architecture requires it:

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

### Test Integrity: Never Paper Over Bugs

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

### E2E Testing

E2E tests live in `tests/e2e/` and require `npm run dev` running on localhost:3000. Auth is automatically bypassed in dev mode (`middleware.js` line 6). API E2E uses Vitest + native `fetch()` (`*.e2e.test.js`); Browser E2E uses Playwright + headless Chromium (`*.spec.js`). See [`tests/README.md`](tests/README.md) and [`tests/E2E-MATRIX.md`](tests/E2E-MATRIX.md) for full details and coverage tracking.

### Agent Development
When working with agents:
- Use `app/lib/agents-v2/utils/anthropicClient.js` for AI calls
- Follow the established schemas in the client
- Include performance tracking in agent operations
- Implement proper error handling and retries

### Database Changes
- Use Supabase migrations in `supabase/migrations/`
- Test locally with `supabase start`
- Migration naming: `YYYYMMDD_description.sql`
- **CRITICAL: Migration Workflow**:
  - **Local dev**: Always use `supabase migration up` to apply migrations. This runs the SQL AND records it in the tracking table.
  - **NEVER use `psql -f migration.sql`** — this applies schema changes but skips tracking, causing `supabase migration list` to show migrations as unapplied.
  - **Staging/Production**: Automatic via GitHub Actions (`supabase db push`) when the branch merges.
  - **NEVER do database resets** during migrations — use `supabase migration up` only.

### API Routes
- Follow Next.js 15 async API patterns
- Use proper error handling and status codes
- Include performance monitoring for agent operations

## Key Features to Understand

### Map Integration
- Geographic funding visualization using react-simple-maps
- State-based filtering and opportunity aggregation
- Real-time data updates

### Agent Processing Pipeline
- Multi-stage processing with Storage → Analysis → Filtering
- Optimized for performance with 60-80% faster execution
- Built-in duplicate detection and data sanitization

### Real-time Updates
- Supabase real-time subscriptions for run status
- Live dashboard updates during processing

## Performance Considerations

- Agent v2 architecture provides 60-80% faster execution vs v1
- Use batch processing for multiple operations
- Implement proper caching strategies
- Monitor token usage and API limits

## Debugging

### Agent Debugging
- Use debug API routes: `/api/debug/anthropic-client`
- Check agent test files for validation patterns
- Monitor performance metrics built into the client

### Database Debugging
- Use `/api/debug/funding-values` for data validation
- Check Supabase logs for query performance
- Verify RLS policies for data access issues

## Manual Funding Opportunities Pipeline

For funding sources without APIs (utilities, county grants, foundation programs), use the **pipeline orchestrator skill**.

**Entry point**: `/pipeline-orchestrator` or any natural language pipeline request.

The orchestrator parses your request, checks database state, determines the correct starting phase, and chains agents automatically. It uses Agent Teams for discovery (cross-checking for thoroughness) and Task tool agents for processing (deterministic batch work).

### Pipeline Commands

| Command | What Happens |
|---------|-------------|
| "Run pipeline for [STATE] [TYPE]" | Full pipeline: sources → programs → opportunities → extract → analyze → store |
| "Register sources: [STATE] [TYPE]" | Phase 1 only: find and register funding sources |
| "Discover programs for [X]" | Phase 2: crawl source catalogs for programs |
| "Find opportunities for [X]" | Phase 3→6: discover opportunities, then process through staging |
| "Process staging" / "Run staging" | Phase 4→6: extraction → analysis → storage |
| "Extract pending" | Phase 4 only |
| "Analyze pending" | Phase 5 only |
| "Store pending" | Phase 6 only |
| "Review pending" / "Publish approved" | Phase 7: reports counts, directs to `/admin/review` UI |
| "Check staging status" | Read-only report of pipeline counts |

**Intelligent prerequisites**: If you request Phase 3 but no sources exist, the orchestrator reports what's missing and offers to chain from the right starting point.

### Admin Review UI

- **Review queue**: `/admin/review` — filter, sort, bulk approve/reject pending_review records
- **Detail page admin tab**: `/funding/opportunities/[id]` → Admin tab — approve, reject, or downgrade individual records
- **API routes**: `GET /api/admin/review`, `POST /api/admin/review/approve`, `POST /api/admin/review/reject`, `POST /api/admin/review/demote`

### Key Rules

- **All pipeline work** goes through the orchestrator skill — no inline processing
- **Agent Teams** for discovery phases (1-3): parallel search with cross-checking
- **Task tool** for processing phases (4-6): deterministic batch work via extraction-agent, analysis-agent, storage-agent
- **Phase 7** (Review & Publish) is NEVER auto-triggered — requires explicit admin action via `/admin/review`
- **Database reads**: `mcp__postgres__query` (read-only MCP)
- **Database writes**: `psql "$PROD_CLAUDE_URL"` via Bash tool (or `$STAGING_CLAUDE_URL` / `$DEV_CLAUDE_URL`)
- **Content retrieval**: Each skill file contains inline content retrieval instructions. HTML → WebFetch (fallback: Playwright). PDFs → `curl | python3 PyMuPDF` (never WebFetch). Login-gated → skip and flag. See Section 0a in each skill's SKILL.md.

### Full Documentation

- **Orchestrator skill**: `.claude/skills/pipeline-orchestrator/SKILL.md`
- **Architecture proposal**: `docs/prd/opp_staging/manual-claude-code-pipeline-architecture-proposal.md`
- **DB security**: `docs/prd/db-security/production-database-configuration.md`

---

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
