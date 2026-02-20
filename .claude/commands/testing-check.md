---
description: Mandatory pre-commit testing verification
---

Run the testing quality gate. This is **MANDATORY before every commit**.

Read and follow the testing skill at `.claude/skills/testing/SKILL.md` — it has the full step-by-step playbook.

## Steps

1. **Identify changes**: Run `git diff --cached --name-only` and `git diff --name-only` to get all modified files
2. **Apply decision gate**: For each changed file, determine required test tiers per the gate in CLAUDE.md (AI Agent Testing Workflow section)
3. **Check test coverage**: Verify tests exist for each requirement. Check inline functions match production logic (drift check).
4. **Check E2E matrix**: If new endpoints or pages were added, verify rows exist in `tests/E2E-MATRIX.md`
5. **Run tests**: Execute the appropriate `npm run test:*` commands based on the decision gate
6. **Report**: Output a structured verdict (PASS / NEEDS WORK / INCOMPLETE) with specific items

## Rules

- Every API route (`app/api/`) must have Critical + API tests at minimum
- New API routes must also have an API E2E test and an E2E-MATRIX.md row
- New pages must have a Browser E2E smoke test and an E2E-MATRIX.md row
- Inline test functions must match production logic — check for drift
- All relevant test suites must pass before verdict is PASS
- If e2e tests are needed but dev server isn't running, verdict is INCOMPLETE (not PASS)
- At minimum, always run: `npm run test:critical && npm run test:api`

## Output

If all checks pass, report PASS briefly with test counts. Otherwise, organize findings by:
1. Missing tests (what needs to be written)
2. Drift detected (inline functions that don't match production)
3. Matrix gaps (missing E2E-MATRIX.md rows)
4. Test failures (failing suites with error details)
