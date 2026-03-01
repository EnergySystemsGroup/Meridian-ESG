# CLAUDE.md

## CRITICAL: Git Commit Policy

**NEVER commit changes without explicit user permission.**

- Do NOT use `git commit` unless the user explicitly asks you to commit
- Do NOT use `git commit --amend` without permission
- Always ask before committing, even if changes seem ready
- Exception: User explicitly says "commit this" or "go ahead and commit"

If you accidentally commit without permission, immediately inform the user and offer to undo it with `git reset HEAD~1`.

## Project Overview

Meridian is a Policy & Funding Intelligence Platform (Next.js 15, Supabase, Anthropic Claude SDK) that helps organizations track funding opportunities, monitor legislation, and match clients to relevant funding sources.

## Project Board

```bash
gh project item-list 2 --owner gborh1       # View board
```

## Essential Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run lint             # Run ESLint
npm run test             # Run all tests (Vitest)
npm run test:critical    # Tier 1: user-facing logic
npm run test:api         # Tier 2: API contracts
npm run test:e2e         # Tier 5+6: E2E (requires dev server)
```

## CRITICAL: Geographic Filtering

**Use `coverage_areas` system, NOT legacy `eligible_states`.**

```javascript
// CORRECT
query.or(`is_national.eq.true,coverage_state_codes.cs.{${stateCode}}`);

// WRONG — deprecated, will return incorrect results
query.or(`is_national.eq.true,eligible_states.cs.{${stateCode}}`);
```

See `docs/architecture/ADR-001-geographic-filtering.md`.

## CRITICAL: Test Pattern — Inline Functions

Vitest cannot resolve Next.js path aliases. All tests use inline pure functions:

```javascript
// CORRECT — define function in test file
function isPromotionVisible(status) {
  return status === null || status === 'promoted';
}
test('excluded', () => expect(isPromotionVisible('pending_review')).toBe(false));

// WRONG — never import from app code
import { isPromotionVisible } from '@/app/api/counts/route'; // WILL FAIL
```

When you modify production logic, update the corresponding test inline function.

## Rules & Standards

Detailed guidelines in `.claude/rules/`:
- `architecture.md` — Tech stack, directories, agent-v2 system, database, pipeline
- `testing-standards.md` — 6-tier testing, decision gate, E2E matrix, test integrity
- `development-guidelines.md` — Environment setup, agent patterns, database workflow

## Sub-Agents

Use specialized agents proactively:
- `code-info-retriever` — Codebase analysis, locate code sections
- `database-architect-dba` — Schema work, migration planning
- `supabase-query-agent` — Data queries and verification
- Pipeline work: use `/pipeline-orchestrator` skill
