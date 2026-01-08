---
  description: Review uncommitted files for quality issues
  ---

  Review ALL uncommitted files (use `git diff` and `git status` to identify them).

  ## Priority Categories

  **Critical (fix before committing):**
  - Dead/unused code
  - Code duplication (DRY violations)
  - Redundant or superfluous logic
  - File misplacement - code in the wrong location
  - Obvious bugs or logic errors

  **Important (should address):**
  - Sloppy implementations that will cause maintenance pain
  - Inconsistency with established project patterns
  - Poor naming that hurts readability
  - Refactors that meaningfully improve code quality

  **Minor (your call):**
  - Small cleanups
  - Consolidation opportunities

  ## Rules

  - No changes for the sake of change - every suggestion must be meaningful
  - Think through whether a suggestion genuinely improves quality or maintainability before including it
  - Skip minor issues entirely if there's nothing meaningful

  ## Output

  If code is clean, say so briefly. Otherwise, organize findings by priority category. Be concise.
