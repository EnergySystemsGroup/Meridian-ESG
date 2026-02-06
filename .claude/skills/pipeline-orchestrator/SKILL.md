---
name: pipeline-orchestrator
description: >
  Single entry point for all Meridian manual funding pipeline operations.
  Parses any pipeline request, assesses database state, determines where
  to start in the 7-phase pipeline, spawns Agent Teams for discovery
  (thoroughness via cross-checking) and Task tool agents for processing
  (deterministic batch work). Reports progress after each phase with
  anomaly warnings. Use for any pipeline-related command.
---

# Pipeline Orchestrator

## 1. Mission

Meridian is a Policy & Funding Intelligence Platform. This manual pipeline discovers
funding opportunities (grants, rebates, incentives, tax credits) from sources that
don't have APIs — utilities, county governments, state agencies, foundations.

**Goal**: Find EVERY relevant opportunity with complete specs. Thoroughness is
non-negotiable — a missed source means missed opportunities for our sales team.

**Three-tier data model**: Sources → Programs → Opportunities
- **Sources** = who funds things (utilities, agencies, foundations) → `funding_sources`
- **Programs** = what they fund (persistent entities with URLs) → `funding_programs`
- **Opportunities** = specific open/upcoming funding windows (temporal) → `funding_opportunities`

**Quality standard**: Match API pipeline rigor:
- Taxonomy-compliant field values (TAXONOMIES.CATEGORIES, etc.)
- Deterministic scoring via `scoringAnalyzer.js` (0-10 scale)
- 0% duplicate target (5-layer dedup stack)
- Complete data extraction (24 structured fields)

**Database**: All operations target production via `$PIPELINE_DB_URL`.
- Reads: `mcp__postgres__query` (read-only MCP tool)
- Writes: `psql "$PIPELINE_DB_URL"` via Bash tool
- Reference: `docs/prd/db-security/production-database-configuration.md`

---

## 2. Pipeline Map

| # | Phase | Reads | Writes | Execution |
|---|-------|-------|--------|-----------|
| 1 | Source Registry | Web search | `funding_sources` + `source_program_urls` | Agent Team (3 search teammates + cross-check) |
| 2 | Program Discovery | `source_program_urls` | `funding_programs` | Agent Team (N teammates, 1 per source) |
| 3 | Opportunity Discovery | `funding_programs` (smart schedule) | `manual_funding_opportunities_staging` | Agent Team (N teammates per source group) |
| 4 | Extraction | Staging `extraction_status='pending'` | Staging `extraction_data`, `raw_content` | Task tool: extraction-agent (batches of 20) |
| 5 | Analysis | Staging `analysis_status='pending'` | Staging `analysis_data` | Task tool: analysis-agent (batches of 20) |
| 6 | Storage | Staging `storage_status='pending'` | `funding_opportunities` (pending_review) + coverage areas | Task tool: storage-agent |
| 7 | Review & Publish | `promotion_status='pending_review'` | `promotion_status` flip | Interactive (orchestrator handles) |

**Dependencies**: Each phase depends on the previous. Chain them in order.
Phase 7 is NEVER auto-triggered — always requires explicit admin action.

---

## 3. Request Parsing

Parse the user's request to determine starting phase and auto-chain behavior:

| User Says | Start Phase | Auto-Chain |
|-----------|------------|------------|
| "Run pipeline for [STATE] [TYPE]" | 1 | 1→2→3→4→5→6 |
| "Register sources: [STATE] [TYPE]" | 1 | 1 only |
| "Discover programs for [X]" | 2 | 2 only (or 2→3→4→5→6 if "and process") |
| "Find opportunities for [X]" | 3 | 3→4→5→6 |
| "Process staging" / "Run staging" | 4 | 4→5→6 |
| "Extract pending" | 4 | 4 only |
| "Analyze pending" | 5 | 5 only |
| "Store pending" | 6 | 6 only |
| "Review pending" / "Publish approved" | 7 | 7 only |
| "Check staging status" / "Pipeline status for [X]" | — | Read-only report |

**Scope parsing** — extract state_code, funder_type, or source name:
- "Arizona utilities" → `state_code='AZ'`, `funder_type='Utility'`
- "PG&E" → lookup `funding_sources` by name
- "all delinquent sources" → `programs_last_searched_at IS NULL OR < 90 days`
- "California county grants" → `state_code='CA'`, `funder_type='County'`

---

## 4. Database State Assessment

Before executing any phase, run these prerequisite checks to understand the current state:

```sql
-- Check 1: Sources exist for this scope?
SELECT COUNT(*) as source_count
FROM funding_sources
WHERE state_code = :state AND funder_type = :type;

-- Check 2: Programs exist for these sources?
SELECT COUNT(*) as program_count
FROM funding_programs fp
JOIN funding_sources fs ON fs.id = fp.source_id
WHERE fs.state_code = :state AND fs.funder_type = :type;

-- Check 3: Programs due for checking? (smart schedule)
SELECT COUNT(*) as due_count
FROM funding_programs fp
JOIN funding_sources fs ON fs.id = fp.source_id
WHERE fs.state_code = :state
  AND fp.status = 'active'
  AND fp.next_check_at <= NOW()
  AND NOT EXISTS (
    SELECT 1 FROM funding_opportunities fo
    WHERE fo.status = 'Open'
    AND (fo.program_id = fp.id
      OR (fo.funding_source_id = fp.source_id
          AND fo.title ILIKE '%' || fp.name || '%'))
  );

-- Check 4: Staging pipeline counts
SELECT
  COUNT(*) FILTER (WHERE extraction_status = 'pending') as pending_extraction,
  COUNT(*) FILTER (WHERE extraction_status = 'complete' AND analysis_status = 'pending') as pending_analysis,
  COUNT(*) FILTER (WHERE analysis_status = 'complete' AND storage_status = 'pending') as pending_storage,
  COUNT(*) FILTER (WHERE storage_status = 'error') as errors
FROM manual_funding_opportunities_staging;

-- Check 5: Review queue
SELECT COUNT(*) as review_count
FROM funding_opportunities
WHERE promotion_status = 'pending_review';
```

Report all counts to the user before proceeding. Example:
"Found 8 sources, 34 programs, 12 due for checking → proceeding with Phase 3."

---

## 5. Prerequisite Logic

If a user requests Phase N but prerequisites are missing, handle intelligently:

**Phase 2 requested, no sources**:
> "No [TYPE] sources registered for [STATE]. Want me to register sources first? (Phase 1 → Phase 2)"

**Phase 3 requested, no sources**:
> "No [TYPE] sources registered for [STATE]. Want me to run the full pipeline? (register → discover programs → find opportunities → process)"

**Phase 3 requested, sources exist but no programs**:
> "Found X sources but no programs discovered yet. Want me to discover programs first, then find opportunities?"

**Phase 3 requested, programs exist but none due**:
> "Found X programs, but none are due for checking until [earliest next_check_at]. Force-check anyway?"

**Phase 4 requested, staging empty**:
> "No pending extraction records in staging. Want me to find opportunities first?"

**Always report what exists** before offering to chain:
> "Found 8 sources, 34 programs, 0 due for checking — all programs have open opportunities already."

---

## 6. Agent Team Spawning (Discovery Phases 1-3)

Use Agent Teams for discovery phases where thoroughness matters. Teammates search in parallel
and cross-check each other to ensure nothing is missed.

### Phase 1 — Source Registry Team (3 teammates)

```
Spawn Agent Team "source-discovery-[STATE]-[TYPE]":

  Teammate 1 (regulatory):
    - Search PUC filings and docket databases
    - Query EIA utility database for registered entities
    - Check state regulatory commission records

  Teammate 2 (aggregator):
    - Search DSIRE database for [STATE] incentive providers
    - Check EnergySage, industry databases
    - Search foundation databases (for foundation funder types)

  Teammate 3 (direct):
    - Search utility/agency websites directly
    - Query state energy office listings
    - Web search: "[STATE] [TYPE] list", "[STATE] electric utilities"

Cross-check protocol:
  After individual searches, teammates broadcast and compare:
  - "I found these entities: [list]. Anyone have entities I missed?"
  - Each teammate validates others' findings against their sources
  - Converge on master deduplicated list
  - Flag low-confidence entries for orchestrator review

Output: Validated entity list → orchestrator writes to funding_sources + source_program_urls
```

### Phase 2 — Program Discovery Team (N teammates)

```
Spawn Agent Team "program-discovery-[SCOPE]":

  One teammate per source (or per 2-3 small sources):
  - Crawl catalog URLs from source_program_urls table
  - Extract individual program name, URL, description, category
  - Supplementary web search for programs not on catalog page

Cross-check protocol:
  - "I found X programs for [source]. Cross-referencing with catalog..."
  - Teammates covering similar sectors compare: "Did you find [program type]?"
  - Flag unusually low counts: "Only 1 program for a major utility — seems low"

Output: Program list per source → orchestrator writes to funding_programs
```

### Phase 3 — Opportunity Discovery Team (N teammates)

```
Spawn Agent Team "opportunity-check-[SCOPE]":

  One teammate per source group:
  - Crawl program_urls for current open/upcoming status
  - Extract application dates, amounts, eligibility
  - Determine next_check_at scheduling for each program

Cross-check protocol:
  - "This program page says 'applications open' — can you confirm current?"
  - Validate date parsing: "Close date reads as August 2026 — agreed?"
  - Cross-reference with DSIRE or other sources for accuracy

Output: Staging records → orchestrator writes to manual_funding_opportunities_staging
```

### Fallback

If Agent Teams is unavailable or errors out, fall back to sequential Task tool calls:
```
Task(subagent_type="discovery-agent", prompt="Search for [TYPE] sources in [STATE]...")
```
Execute Skills 1-3 inline with sequential web searches instead.

---

## 7. Task Tool Spawning (Processing Phases 4-6)

Use the Task tool for deterministic processing phases. These don't need cross-checking —
just fetch, process, and write.

### Phase 4 — Extraction

```sql
-- Count pending
SELECT COUNT(*) FROM manual_funding_opportunities_staging
WHERE extraction_status = 'pending';
```

- If count > 20: spawn multiple extraction agents (1 per batch of 20)
  ```
  Task(subagent_type="extraction-agent",
       prompt="Extract batch [N]. Query staging WHERE extraction_status='pending'
               LIMIT 20 OFFSET [N*20]. Fetch each URL, extract structured data,
               update extraction_data and raw_content columns.")
  ```
- If count <= 20: spawn 1 extraction agent
- If count == 0: skip, report "No pending extraction records"

### Phase 5 — Analysis

Same batching pattern as extraction:
```
Task(subagent_type="analysis-agent",
     prompt="Analyze extracted records. Query staging WHERE extraction_status='complete'
             AND analysis_status='pending'. Run content enhancement (6 fields)
             and deterministic V2 scoring. Update analysis_data column.")
```

### Phase 6 — Storage

Usually 1 agent (all pending records), unless 100+ → batch:
```
Task(subagent_type="storage-agent",
     prompt="Store analyzed records to production. Query staging WHERE
             analysis_status='complete' AND storage_status='pending'.
             Apply dataSanitizer, UPSERT to funding_opportunities with
             promotion_status='pending_review', link coverage areas.")
```

---

## 8. Phase Reporting

After each phase completes, report to the user:

```
═══ PHASE [N] COMPLETE: [Phase Name] ═══
  Records processed: X (Y new, Z updated)
  Errors: N (details in staging table)
  Warnings: [list any flags]
  → Starting Phase [N+1]: [Next Phase Name]...
```

Track cumulative stats across all phases for the final summary.

---

## 9. Judgment Rules

Apply these rules throughout pipeline execution:

| Situation | Action |
|-----------|--------|
| Zero results from any phase | **STOP** — ask user before continuing |
| Unusually low count (1 program for major utility) | **WARN** — continue but flag in summary |
| URL failures > 30% for a source | **WARN** — flag source as potentially stale |
| All programs have open opportunities | **REPORT** — "all programs currently covered, nothing new to check" |
| Staging has errors from previous run | **WARN** — "X errors from previous run. Retry these?" |
| Large batch (100+ records entering a phase) | **CONFIRM** — "100+ records. Proceed?" |
| Agent Team timeout or error | **FALLBACK** — switch to sequential Task tool |
| Cross-check finds discrepancy between teammates | **FLAG** — include in summary for user review |
| Source returns significantly different count than last run | **WARN** — "PG&E had 15 programs last run, now 8. Some may have been discontinued." |

---

## 10. Final Summary

After all phases complete, present the full pipeline summary:

```
═══════════════════════════════════════════
PIPELINE COMPLETE: [Scope Description]
═══════════════════════════════════════════
Phase 1 — Sources:       X registered (Y new, Z enriched)
Phase 1 — Catalog URLs:  X discovered
Phase 2 — Programs:      X discovered (Y new, Z updated)
Phase 3 — Opportunities: X found (Y Open, Z Upcoming)
Phase 4 — Extracted:     X of Y (Z errors)
Phase 5 — Analyzed:      X of Y (avg score: N.N)
Phase 6 — Stored:        X of Y (promotion_status='pending_review')
Phase 6 — Coverage:      X areas linked

Flags:
- [any warnings accumulated during pipeline]

Next step: "Review pending" to approve for publication
═══════════════════════════════════════════
```

For single-phase runs, show only the relevant phase stats.

---

## 11. Maintenance & Auto-Close

Run auto-close at the start of every pipeline execution:

```sql
UPDATE funding_opportunities
SET status = 'Closed'
WHERE status = 'Open'
  AND close_date < NOW()
  AND close_date IS NOT NULL;
```

Report how many were auto-closed: "Auto-closed X expired opportunities."

**Database connection reference**:
- Reads: `mcp__postgres__query` (read-only MCP tool)
- Writes: `psql "$PIPELINE_DB_URL"` via Bash tool
- Config: `docs/prd/db-security/production-database-configuration.md`
- All pipeline operations run against production. `$PIPELINE_DB_URL` env var controls target.
