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

**Database**: **NO DEFAULT ENVIRONMENT.** The user MUST specify which environment to use.
- **STOP and ask** if the user does not specify: "Which environment? dev, staging, or production?"
- Reads: `mcp__postgres__query` (read-only MCP tool — connected to whichever DB is configured)
- Writes require explicit environment selection:
  - `"use dev"` → `source .env.local && psql "$DEV_CLAUDE_URL"`
  - `"use staging"` → `source .env.local && psql "$STAGING_CLAUDE_URL"`
  - `"use prod"` / `"use production"` → `source .env.local && psql "$PROD_CLAUDE_URL"`
- **NEVER assume production.** If environment is not specified, DO NOT PROCEED with any writes.
- Pass the selected env var name to all spawned agents so they write to the correct database.
- Reference: `docs/prd/db-security/production-database-configuration.md`

---

## 2. Pipeline Map

| # | Phase | Reads | Writes | Execution |
|---|-------|-------|--------|-----------|
| 1 | Source Registry | Web search | `funding_sources` + `source_program_urls` | Agent Team (3 search teammates + cross-check) |
| 2 | Program Discovery | `source_program_urls` | `funding_programs` | Two rounds: Scout Team (find URLs) → Extractor Team (extract + store) |
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
| "Find all sources in [STATE]" | 1 | 1 only (multi-type — see Section 3.5) |
| "Discover programs for [X]" | 2 | 2 only (or 2→3→4→5→6 if "and process") |
| "Find opportunities for [X]" | 3 | 3→4→5→6 |
| "Process staging" / "Run staging" | 4 | 4→5→6 |
| "Extract pending" | 4 | 4 only |
| "Analyze pending" | 5 | 5 only |
| "Store pending" | 6 | 6 only |
| "Review pending" / "Publish approved" | 7 | 7 only |
| "Check staging status" / "Pipeline status for [X]" | — | Read-only report |

### Scope Parsing

Extract state_code, funder_type(s), or source name from the request:

**Clear scope** — proceed without asking:
- "Arizona utilities" → `state_code='AZ'`, `funder_type='Utility'`
- "PG&E" → lookup `funding_sources` by name
- "California county grants" → `state_code='CA'`, `funder_type='County'`
- "all delinquent sources" → `programs_last_searched_at IS NULL OR < 90 days`

**Broad scope — funder_type not specified** — determine applicable types:
- "Find all sources in Nevada" → NV, all applicable funder types (see Section 3.5)
- "Everything in Clark County area" → NV, focus on County + Municipality
- "Sources relevant to energy and housing in Arizona" → AZ, all types that fund energy/housing

**Common natural language → funder_type mapping** (use as guidance, not strict rules):
- "utilities", "electric companies", "power companies" → Utility
- "counties", "county government", "local government" → County
- "cities", "municipal", "local" → Municipality (or County + Municipality if ambiguous)
- "state agencies", "state programs" → State
- "foundations", "philanthropic" → Foundation
- "tribal", "tribal authorities" → Tribal
- "federal", "federal agencies" → Federal

**When funder_type is not specified or is broad**, the orchestrator determines which
types are relevant and spawns one team per type (see Section 3.5 and Section 6).

### Ask When Uncertain

**If you can reasonably interpret the request, proceed.** Do NOT ask for confirmation
on every request — only when there is genuine ambiguity that could lead to wasted work.

**ASK the user when:**
- The geographic scope is unclear: "sources in the Southwest" — which states?
- The request mixes scopes that don't make sense together
- A key term is genuinely ambiguous and the two interpretations would produce very different results
- The user references something that doesn't exist in the database and you're unsure what they mean

**DO NOT ask when:**
- You can reasonably infer funder_type from context (e.g., "local and county" → County + Municipality)
- The scope is broad but actionable (e.g., "all sources in Nevada" → spawn agents for each type)
- Minor ambiguity that won't affect results (e.g., "utilities" clearly means electric/gas utilities)

**Format for clarification** — ask ONE focused question, not a menu of options:
> "You said 'sources in the Southwest.' Which states should I cover? (e.g., AZ, NV, NM, UT, CO)"

---

## 3.5. Multi-Type Scope Resolution

When the user's request covers multiple funder types (or doesn't specify one), the
orchestrator determines which types are applicable and spawns **one team per type**
in parallel. Each team gets its own clean context focused on a single funder type.

### Determining Applicable Funder Types

Not every funder type applies to every state or request. Use this logic:

| Funder Type | When to Include |
|-------------|----------------|
| Utility | Almost always — every state has utilities with rebate programs |
| County | When scope includes local government or specific counties |
| Municipality | When scope includes cities/local or specific metro areas |
| State | When scope is broad ("all sources") or user mentions state agencies |
| Foundation | When scope is broad or user mentions grants/philanthropy |
| Tribal | Only if the state has tribal lands/tribal utilities |
| Federal | Only if user specifically mentions federal or scope is national |

### Multi-Type Spawning Pattern

Create **one team** with **paired teammates** for each funder type. All teammates
run in parallel within the single team. Cross-checking happens between pair partners
of the same funder type. (TeamCreate only allows one team per leader.)

```
User: "Find all sources in Nevada"

TeamCreate(team_name="source-discovery-NV", ...)

Spawn all teammates in parallel:
  → utility-regulatory  (strategies 2+3)   ┐
  → utility-aggregator  (strategies 4+6)   ├ Utility trio
  → utility-direct      (strategies 1+5)   ┘
  → county-direct       (strategies 1+5+7) ┐ County pair
  → county-aggregator   (strategy 4)       ┘
  → muni-direct         (strategies 1+5+7) ┐ Municipality pair
  → muni-aggregator     (strategy 4)       ┘
  → state-direct        (strategies 5+7)   ┐ State pair
  → state-aggregator    (strategy 4)       ┘
  → foundation-aggregator (strategies 4+6) ┐ Foundation pair
  → foundation-direct   (strategy 1+7)     ┘
  = 11 teammates in one team, all searching in parallel
```

Each pair cross-checks within its funder type. Teammates from different types
do NOT need to cross-check each other.

### Combining Results

After all teams complete, the orchestrator:
1. Collects all team reports
2. Checks for cross-type duplicates (e.g., a city utility registered as both Utility and Municipality)
3. Presents a unified summary grouped by funder type
4. Writes a single audit log entry covering all types

---

## 4. Database State Assessment

Before executing any phase, run these prerequisite checks. Use `mcp__postgres__query`
with raw SQL — substitute actual values (no bind variables).

```sql
-- Check 1: Sources exist for this scope?
-- Example for Arizona utilities (substitute actual state_code and funder_type):
SELECT COUNT(*) as source_count
FROM funding_sources
WHERE state_code = 'AZ' AND funder_type = 'Utility';

-- Check 2a: Catalog URLs exist for these sources? (Phase 2 prerequisite)
SELECT COUNT(*) as url_count,
  COUNT(DISTINCT spu.source_id) as sources_with_urls
FROM source_program_urls spu
JOIN funding_sources fs ON fs.id = spu.source_id
WHERE fs.state_code = 'AZ' AND fs.funder_type = 'Utility';

-- Check 2b: Programs exist for these sources?
SELECT COUNT(*) as program_count
FROM funding_programs fp
JOIN funding_sources fs ON fs.id = fp.source_id
WHERE fs.state_code = 'AZ' AND fs.funder_type = 'Utility';

-- Check 3: Programs due for checking? (smart schedule)
-- Note: fo.promotion_status column will be added in a future migration.
-- Skip check 5 if that column doesn't exist yet (Phase 7 prerequisite).
SELECT COUNT(*) as due_count
FROM funding_programs fp
JOIN funding_sources fs ON fs.id = fp.source_id
WHERE fs.state_code = 'AZ'
  AND fp.status IN ('active', 'unknown')
  AND fp.next_check_at <= NOW()
  AND NOT EXISTS (
    SELECT 1 FROM funding_opportunities fo
    WHERE fo.status = 'Open'
    AND fo.close_date IS NOT NULL
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

-- Check 5: Review queue (requires promotion_status column — future migration)
SELECT COUNT(*) as review_count
FROM funding_opportunities
WHERE promotion_status = 'pending_review';
```

**Not all checks apply to every phase.** Run only relevant checks:
- Phase 1: Check 1 only (sources)
- Phase 2: Checks 1-2 (sources + catalog URLs)
- Phase 3: Checks 1-3 (sources + programs + due schedule)
- Phase 4-6: Check 4 (staging counts)
- Phase 7: Check 5 (review queue)

Report counts to the user before proceeding. Example:
"Found 8 sources, 34 programs, 12 due for checking → proceeding with Phase 3."

---

## 5. Prerequisite Logic

If a user requests Phase N but prerequisites are missing, handle intelligently:

**Phase 2 requested, no sources**:
> "No [TYPE] sources registered for [STATE]. Want me to register sources first? (Phase 1 → Phase 2)"

**Phase 2 requested, sources exist but no catalog URLs**:
> "Found X sources but no catalog URLs in source_program_urls. Want me to re-run Phase 1 to discover catalog URLs first?"

**Phase 2 requested, sources exist with catalog URLs**:
> "Found X sources with Y catalog URLs. Proceeding with program discovery."

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

### CRITICAL: ALWAYS Use TeamCreate for Discovery Phases

**Discovery phases (1-3) MUST use the `TeamCreate` tool to create Agent Teams.**
This is NOT optional. The ONLY exceptions are:
- The user explicitly says "quick", "test", or "standalone"
- `TeamCreate` returns an error (then fall back to standalone — see Fallback below)

**WHY**: Standalone `Task()` calls produce a single agent that runs all strategies
sequentially with no cross-checking. Teams produce multiple agents that search in
parallel and validate each other's findings — this is how we ensure thoroughness.

**SELF-CHECK before every discovery phase spawn:**
> "Am I about to call `TeamCreate`? If not, STOP. I must use TeamCreate."
> If I'm about to call `Task(subagent_type=...)` without a `team_name`, I am doing it wrong.

### Concrete Tool Call Pattern

Here is the EXACT sequence of tool calls for spawning a discovery team.
**Follow this pattern literally — do not improvise an alternative.**

```
STEP 1: Create ONE team for all funder types in this run
─────────────────────────
TeamCreate(
  team_name="source-discovery-FL",
  description="Phase 1: Discover FL County + State funding sources"
)

STEP 2: Create shared tasks for the team
─────────────────────────
TaskCreate(subject="Search via regulatory strategies (2+3)", ...)
TaskCreate(subject="Search via aggregator strategies (4+6)", ...)
TaskCreate(subject="Search via direct strategies (1+5)", ...)
TaskCreate(subject="Cross-check and deduplicate findings", ...)

STEP 3: Spawn ALL teammates IN PARALLEL (one message, all Task calls together)
─────────────────────────
// County pair:
Task(
  subagent_type="source-registry-agent",
  team_name="source-discovery-FL",
  name="county-direct",
  prompt="You are the COUNTY-DIRECT teammate. Execute strategies 1+5+7.
          State: FL, Funder type: County.
          Read SEARCH-REFERENCE.md for detailed instructions.
          DB writes: source .env.local && psql \"$DEV_CLAUDE_URL\"
          When done, broadcast your entity list to the team.
          Cross-check with county-aggregator's findings."
)

Task(
  subagent_type="source-registry-agent",
  team_name="source-discovery-FL",
  name="county-aggregator",
  prompt="You are the COUNTY-AGGREGATOR teammate. Execute strategy 4.
          State: FL, Funder type: County.
          Read SEARCH-REFERENCE.md for detailed instructions.
          DB writes: source .env.local && psql \"$DEV_CLAUDE_URL\"
          When done, broadcast your entity list to the team.
          Cross-check with county-direct's findings."
)

// State pair:
Task(
  subagent_type="source-registry-agent",
  team_name="source-discovery-FL",
  name="state-direct",
  prompt="You are the STATE-DIRECT teammate. Execute strategies 5+7.
          State: FL, Funder type: State.
          Read SEARCH-REFERENCE.md for detailed instructions.
          DB writes: source .env.local && psql \"$DEV_CLAUDE_URL\"
          When done, broadcast your entity list to the team.
          Cross-check with state-aggregator's findings."
)

Task(
  subagent_type="source-registry-agent",
  team_name="source-discovery-FL",
  name="state-aggregator",
  prompt="You are the STATE-AGGREGATOR teammate. Execute strategy 4.
          State: FL, Funder type: State.
          Read SEARCH-REFERENCE.md for detailed instructions.
          DB writes: source .env.local && psql \"$DEV_CLAUDE_URL\"
          When done, broadcast your entity list to the team.
          Cross-check with state-direct's findings."
)

STEP 4: Wait for teammates to complete and cross-check
─────────────────────────
Teammates will:
  a) Execute their assigned strategies
  b) Broadcast their entity list to the team via SendMessage
  c) Cross-check other teammates' lists
  d) Converge on a master deduplicated list

STEP 5: Collect results and clean up
─────────────────────────
- Orchestrator collects the final validated entity list
- Sends shutdown_request to all teammates
- TeamDelete to clean up
- Proceeds to next phase or reports summary
```

### Team Sizing Per Funder Type

| Funder Type | Team Size | Teammates & Strategy Groups |
|-------------|-----------|---------------------------|
| Utility | 3 | `regulatory` (strategies 2+3), `aggregator` (strategies 4+6), `direct` (strategies 1+5) |
| Tribal | 3 | `regulatory` (strategy 3/EIA), `aggregator` (strategy 4), `direct` (strategies 1+5) |
| County | 2 | `direct` (strategies 1+5+7), `aggregator` (strategy 4) |
| Municipality | 2 | `direct` (strategies 1+5+7), `aggregator` (strategy 4) |
| State | 2 | `direct` (strategy 5+7), `aggregator` (strategy 4) |
| Foundation | 2 | `aggregator` (strategies 4+6), `direct` (strategy 1+7) |
| Federal | 2 | `direct` (strategy 5), `aggregator` (strategy 4) |

### Multi-Type Spawning — Single Team with Paired Teammates

**LIMITATION**: `TeamCreate` allows only ONE team per leader. You CANNOT create
multiple parallel teams. Instead, create **one team** containing ALL teammates,
organized into **pairs by funder type**.

Each pair cross-checks within its funder type. Teammates from different types
do NOT cross-check each other (a county teammate doesn't validate state findings).

```
User: "Find county and state sources in Florida"

TeamCreate(team_name="source-discovery-FL", description="Phase 1: FL County + State sources")

Spawn all teammates in parallel (one message):
  → county-direct    (strategies 1+5+7, funder_type=County)     ┐ County pair
  → county-aggregator (strategy 4, funder_type=County)           ┘ cross-checks
  → state-direct     (strategies 5+7, funder_type=State)        ┐ State pair
  → state-aggregator  (strategy 4, funder_type=State)            ┘ cross-checks
  = 4 teammates, all searching in parallel
```

**Naming convention for multi-type teammates**: Prefix with funder type to keep
pairs clear: `county-direct`, `county-aggregator`, `state-direct`, `state-aggregator`,
`utility-regulatory`, `utility-aggregator`, `utility-direct`, etc.

**Broader example:**
```
User: "Find all sources in Georgia"

TeamCreate(team_name="source-discovery-GA", description="Phase 1: All GA sources")

Spawn all teammates in parallel:
  → utility-regulatory  (strategies 2+3)   ┐
  → utility-aggregator  (strategies 4+6)   ├ Utility trio
  → utility-direct      (strategies 1+5)   ┘
  → county-direct       (strategies 1+5+7) ┐ County pair
  → county-aggregator   (strategy 4)       ┘
  → state-direct        (strategies 5+7)   ┐ State pair
  → state-aggregator    (strategy 4)       ┘
  = 7 teammates total in one team
```

### Cross-Check Protocol

Teammates cross-check **within their funder-type pair only**:
1. Each teammate **broadcasts** their entity list to the team via `SendMessage(type="broadcast")`
2. Their **pair partner** validates the findings against their own sources
3. Teammates from other pairs may optionally confirm cross-type overlaps
4. Each pair **converges** on a deduplicated list for their funder type
5. **Flag** low-confidence entries or discrepancies for orchestrator review

**If a teammate's pair partner shuts down early**, other teammates can still
cross-check those findings (as happened in FL test: state-direct validated
county-aggregator's findings when county-direct had already shut down).

### Strategy Group → Strategy Mapping

| Group Name | Strategy Numbers | Focus |
|------------|-----------------|-------|
| `regulatory` | Strategies 2 + 3 | PUC databases, EIA federal data |
| `aggregator` | Strategies 4 + 6 | DSIRE, EnergySage, ACEEE, foundation databases |
| `direct` | Strategies 1 + 5 + 7 | Direct listing search, agency search, taxonomy-driven search |

### Phase 1 — Source Registry Teams

Follow the Concrete Tool Call Pattern above. Key points:
- Each teammate gets `subagent_type="source-registry-agent"` (loads the source-registry skill)
- Include strategy group name AND numbers in the prompt
- Include state_code, funder_type, database env var, and batch_id in the prompt
- Teammates write to DB independently, then cross-check for completeness

### Phase 2 — Program Discovery Teams (Two-Round Pattern)

Phase 2 uses a **two-round approach** to manage context size:
- **Round 1 (Scouts)**: Lightweight agents crawl catalog URLs to find program links
- **Between rounds**: Orchestrator collects, deduplicates, and plans extraction
- **Round 2 (Extractors)**: Heavy agents visit program URLs, extract data, write to DB

This split prevents context bloat — scouts stay lightweight (browse + identify), while
extractors handle the heavy extraction work with focused assignments.

#### Batch Sizing Rules

| Parameter | Rule |
|-----------|------|
| Sources per batch | 3 at a time (group by funder type within batches) |
| Scouts per batch | 1 scout per 2-3 catalog URLs + 1 searcher per source |
| Max teammates | Target 6-12 per team (3 sources × ~3-4 teammates each) |
| Extractors | 1 per ~10 programs (sized after Round 1 results) |
| Source ordering | Within funder type, order by DB entry time (`created_at`) |

#### Round 1 — Scout Team (Find Program URLs)

```
STEP 0: Query sources + catalog URL counts for the scope
─────────────────────────
SELECT fs.id, fs.name, fs.funder_type,
  (SELECT COUNT(*) FROM source_program_urls spu WHERE spu.source_id = fs.id) as url_count
FROM funding_sources fs
WHERE fs.state_code = 'FL' AND fs.funder_type = 'County'
AND (fs.programs_last_searched_at IS NULL
     OR fs.programs_last_searched_at < NOW() - INTERVAL '90 days')
ORDER BY fs.created_at;

→ Plan batches: 3 sources at a time

STEP 1: Create scout team for batch
─────────────────────────
TeamCreate(
  team_name="program-discovery-FL-county-batch-1",
  description="Phase 2 Round 1: Find programs for FL County sources (batch 1)"
)

STEP 2: Create shared tasks
─────────────────────────
TaskCreate(subject="Scout catalog URLs for programs", ...)
TaskCreate(subject="Supplementary web search for missed programs", ...)
TaskCreate(subject="Cross-check and deduplicate program lists", ...)

STEP 3: Spawn ALL scout teammates IN PARALLEL
─────────────────────────
// For each source in batch, spawn scouts for its catalog URLs:
// Source 1: Alachua County (3 catalog URLs → 1 scout + 1 searcher)
Task(
  subagent_type="program-discovery-agent",
  team_name="program-discovery-FL-county-batch-1",
  name="alachua-scout",
  prompt="mode: scout
          Source: Alachua County Office of Sustainability (source_id: abc-123)
          Catalog URLs to crawl:
            1. https://sustainability.alachuacounty.us/programs
            2. https://sustainability.alachuacounty.us/grants
            3. https://dsire.org/alachua-county
          Crawl each URL, follow links 1 level deep, identify funding programs.
          DB reads: mcp__postgres__query
          Report your program list to the team when done.
          Cross-check with alachua-searcher's findings."
)

Task(
  subagent_type="program-discovery-agent",
  team_name="program-discovery-FL-county-batch-1",
  name="alachua-searcher",
  prompt="mode: scout, role: searcher
          Source: Alachua County Office of Sustainability (source_id: abc-123)
          Do supplementary web search for programs NOT on the catalog pages.
          Search queries:
            - 'Alachua County sustainability rebate programs'
            - 'Alachua County energy efficiency incentives 2026'
            - 'Alachua County grants environment'
          DB reads: mcp__postgres__query
          Report your program list to the team when done.
          Cross-check with alachua-scout's findings."
)

// Source 2: Broward County (2 catalog URLs → 1 scout + 1 searcher)
Task(
  subagent_type="program-discovery-agent",
  team_name="program-discovery-FL-county-batch-1",
  name="broward-scout",
  prompt="mode: scout
          Source: Broward County ... (source_id: def-456)
          Catalog URLs: [...]
          ..."
)

Task(
  subagent_type="program-discovery-agent",
  team_name="program-discovery-FL-county-batch-1",
  name="broward-searcher",
  prompt="mode: scout, role: searcher
          Source: Broward County ... (source_id: def-456)
          ..."
)

// Source 3: similar pattern
// = 6 teammates for 3 sources (2 per source: 1 scout + 1 searcher)

STEP 4: Wait for scouts to complete and cross-check
─────────────────────────
Scouts will:
  a) Crawl their assigned URLs / run web searches
  b) Report program lists to the team
  c) Cross-check with their pair partner (scout ↔ searcher per source)
  d) Converge on a merged program list per source

STEP 5: Collect scout results and clean up
─────────────────────────
- Orchestrator collects all program lists from scouts
- Deduplicates across sources (same program might appear under multiple sources)
- Sends shutdown_request to all teammates
- TeamDelete to clean up
- Repeat for next batch until all sources processed
```

**Source_id MUST travel through the entire handoff chain.** Every program reported by
scouts must include its source_id. The orchestrator passes source_id to extractors.
Extractors write source_id as the FK on `funding_programs`.

#### Between Rounds — Orchestrator Deduplication

After all scout batches complete:
1. Merge program lists from all batches
2. Dedup by URL (exact match) and by name+source (fuzzy match)
3. Count total unique programs
4. Plan extractor assignments: ~10 programs per extractor
5. Report to user: "Round 1 complete: X programs found across Y sources. Starting extraction."

#### Round 2 — Extractor Team (Extract + Store)

```
STEP 1: Create extractor team
─────────────────────────
TeamCreate(
  team_name="program-extraction-FL-county",
  description="Phase 2 Round 2: Extract and store FL County programs"
)

STEP 2: Spawn extractor teammates with explicit assignments
─────────────────────────
// Divide programs among extractors (~10 programs each)
Task(
  subagent_type="program-discovery-agent",
  team_name="program-extraction-FL-county",
  name="extractor-1",
  prompt="mode: extractor
          DB writes: source .env.local && psql \"$DEV_CLAUDE_URL\"
          DB reads: mcp__postgres__query

          Extract and store these programs:
          1. Green Business Program — https://sustainability.alachuacounty.us/programs/green-business
             source_id: abc-123, source_name: Alachua County Office of Sustainability
          2. Energy Audit Program — https://sustainability.alachuacounty.us/programs/energy-audit
             source_id: abc-123, source_name: Alachua County Office of Sustainability
          3. Tree Planting Grants — https://sustainability.alachuacounty.us/programs/tree-grants
             source_id: abc-123, source_name: Alachua County Office of Sustainability
             PDFs: [https://sustainability.alachuacounty.us/docs/tree-grant-app.pdf]
          ... (up to ~10 programs)

          For each: visit URL, extract structured fields, dedup check, INSERT/UPDATE
          funding_programs. Set status='active', next_check_at=NOW(), pipeline='manual'.
          Update programs_last_searched_at on each source when all its programs are done."
)

Task(
  subagent_type="program-discovery-agent",
  team_name="program-extraction-FL-county",
  name="extractor-2",
  prompt="mode: extractor
          ... (next batch of ~10 programs)"
)

// = 1 extractor per ~10 programs

STEP 3: Wait for extractors to complete
─────────────────────────
Extractors will:
  a) Visit each program URL
  b) Extract structured data (7+ fields)
  c) Dedup against existing funding_programs
  d) INSERT/UPDATE funding_programs
  e) Report results to team lead

STEP 4: Collect results and clean up
─────────────────────────
- Orchestrator collects extraction reports
- Sends shutdown_request to all extractors
- TeamDelete to clean up
- Reports: "Phase 2 complete: X programs (Y new, Z updated) across N sources"
```

#### Fallback (ONLY if TeamCreate fails)

For Round 1 (scouts), fall back to standalone Task tool:
```
Task(subagent_type="program-discovery-agent",
     prompt="mode: scout. Run standalone for [source]. Crawl all catalog URLs AND do web search...")
```

For Round 2 (extractors), Task tool is an acceptable primary alternative:
```
Task(subagent_type="program-discovery-agent",
     prompt="mode: extractor. Extract these programs: [list]. DB writes: ...")
```
Extractors are deterministic — they don't need cross-checking, so standalone mode is fine.

### Phase 3 — Opportunity Discovery Teams

Team name: `opportunity-check-[SCOPE]` (e.g., `opportunity-check-AZ-utility`)

```
STEP 0: Pre-flight (orchestrator runs directly — NOT delegated to teammates)
─────────────────────────
// Auto-close expired opportunities
psql "$DEV_CLAUDE_URL" -c "
  UPDATE funding_opportunities
  SET status = 'Closed'
  WHERE status = 'Open'
    AND close_date < NOW()
    AND close_date IS NOT NULL;
"

// Smart scheduling query — get eligible programs
mcp__postgres__query:
SELECT fp.id, fp.name, fp.description, fp.program_urls,
       fp.status as program_status, fp.source_id,
       fs.name as source_name, fs.state_code, fs.funder_type
FROM funding_programs fp
JOIN funding_sources fs ON fs.id = fp.source_id
WHERE fp.status IN ('active', 'unknown')
  AND fp.next_check_at <= NOW()
  -- Scope filter (substitute actual values):
  AND fs.state_code = 'AZ' AND fs.funder_type = 'Utility'
  AND NOT EXISTS (
    SELECT 1 FROM funding_opportunities fo
    WHERE fo.status = 'Open'
    AND fo.close_date IS NOT NULL
    AND (fo.program_id = fp.id
      OR (fo.funding_source_id = fp.source_id
          AND fo.title ILIKE '%' || fp.name || '%'))
  )
ORDER BY fp.source_id, fp.name;

// Report: "Pre-flight: auto-closed X opportunities. Y programs eligible for checking."
// If zero eligible, report and stop.

STEP 1: Create team
─────────────────────────
TeamCreate(
  team_name="opportunity-check-AZ-utility",
  description="Phase 3: Check AZ utility programs for open/upcoming opportunities"
)

STEP 2: Spawn opportunity-discovery-agent teammates
─────────────────────────
// Group programs by source (~10-15 programs per teammate)
// Each teammate gets all programs from one or more sources

Task(
  subagent_type="opportunity-discovery-agent",
  team_name="opportunity-check-AZ-utility",
  name="checker-aps",
  prompt="You are an opportunity discovery teammate.
          Read your skill file: .claude/skills/opportunity-discovery/SKILL.md

          Your assigned programs (APS — Arizona Public Service):
          1. Program Name (id: UUID, urls: [...])
          2. Program Name (id: UUID, urls: [...])
          ... (all APS programs from the query)

          For each program:
          - Crawl program_urls per Content Retrieval Standard
          - Follow application links 1-2 levels deep
          - Apply Decision Tree (Skill Section 4)
          - INSERT staging records for Open/Upcoming findings
          - UPDATE last_checked_at and next_check_at on each program

          Database writes: psql \"$DEV_CLAUDE_URL\" -c \"...\"
          Report results when done."
)

Task(
  subagent_type="opportunity-discovery-agent",
  team_name="opportunity-check-AZ-utility",
  name="checker-tep",
  prompt="... (same pattern, TEP programs)"
)

// = 1 teammate per source (or per ~10-15 programs if source is very large)

STEP 3: Collect results
─────────────────────────
Teammates will:
  a) Crawl each program's URLs
  b) Determine Open/Upcoming/Nothing status
  c) INSERT staging records for Open/Upcoming findings
  d) UPDATE program scheduling (last_checked_at, next_check_at)
  e) Report results to team lead

STEP 4: Clean up and chain
─────────────────────────
- Collect all teammate reports
- Send shutdown_request to all teammates
- TeamDelete to clean up
- Report: "Phase 3 complete: X open, Y upcoming, Z skipped across N programs"
- If auto-chaining to Phase 4: check staging counts and proceed
```

### Phase 3 Fallback (ONLY if TeamCreate fails)

Fall back to standalone Task tool:
```
Task(subagent_type="opportunity-discovery-agent",
     prompt="Standalone mode. Check all programs matching [SCOPE] for open/upcoming
             opportunities. Run pre-flight yourself, then process all eligible programs.
             DB writes: psql \"$DEV_CLAUDE_URL\" -c \"...\"")
```
Log a warning: "**TeamCreate failed — falling back to standalone mode.**"

### General Fallback (ONLY if TeamCreate fails)

If `TeamCreate` returns an error for any discovery phase, fall back to standalone Task tool.
Log a warning: "**TeamCreate failed — falling back to standalone mode. Cross-checking skipped.**"
This is the ONLY acceptable reason to use standalone mode for discovery phases.

---

## 7. Task Tool Spawning (Processing Phases 4-6)

Use the Task tool for deterministic processing phases. These don't need cross-checking —
just fetch, process, and write.

### Batch Processing Pattern

Phases 4-6 use a **claim-then-process** pattern to avoid race conditions when
multiple agents run in parallel. Each agent claims a batch by querying pending
records sorted by `id`, processing them sequentially, and updating status on
each record before moving to the next. Do NOT use `LIMIT/OFFSET` for parallel
batching — it causes missed or double-processed records if the dataset changes.

**Sequential batching** (safe): Spawn one agent at a time. Each agent queries
`WHERE status='pending' ORDER BY id LIMIT 20`, processes the batch, updates
status to `'complete'` or `'error'`, then the orchestrator spawns the next agent
for the remaining pending records.

### Phase 4 — Extraction

The extraction-agent loads the `extraction` skill (`.claude/skills/extraction/SKILL.md`).
It fetches content from staging record URLs, extracts 24 structured fields into
`extraction_data` JSONB, stores `raw_content` (50KB cap), and computes `source_hash`.

```sql
-- Count pending (via mcp__postgres__query)
SELECT COUNT(*) FROM manual_funding_opportunities_staging
WHERE extraction_status = 'pending';
```

- If count > 0: spawn extraction agents sequentially (1 per batch of 20)
  ```
  Task(subagent_type="extraction-agent",
       prompt="Phase 4: Extract pending staging records.

               Skill file: .claude/skills/extraction/SKILL.md
               Taxonomy file: lib/constants/taxonomies.js (MUST read before extraction)

               Process:
               1. Read taxonomies
               2. Query staging WHERE extraction_status='pending' ORDER BY id LIMIT 20
               3. For each record: claim → fetch URLs → compute source_hash → extract → update
               4. Output batch report

               Database reads: mcp__postgres__query
               Database writes: source .env.local && psql \"$DEV_CLAUDE_URL\"")
  ```
  After each agent completes, re-check pending count. If more remain, spawn another.
  Expected report format: complete/skipped/error counts per record.
- If count == 0: skip, report "No pending extraction records"

### Phase 5 — Analysis

The analysis-agent loads the `analysis` skill (`.claude/skills/analysis/SKILL.md`).
It reads V2 analysis reference files, performs LLM content enhancement (6 fields)
and deterministic scoring (5 components from scoringAnalyzer.js), and merges results
into `analysis_data` JSONB. Filtering is handled by the orchestrator post-batch.

```sql
-- Count pending (via mcp__postgres__query)
SELECT COUNT(*) FROM manual_funding_opportunities_staging
WHERE extraction_status = 'complete' AND analysis_status = 'pending';
```

- If count > 0: spawn analysis agents sequentially (1 per batch of 20)
  ```
  Task(subagent_type="analysis-agent",
       prompt="Phase 5: Analyze extracted staging records.

               Skill file: .claude/skills/analysis/SKILL.md
               V2 reference files (MUST read before analysis):
                 - lib/agents-v2/core/analysisAgent/contentEnhancer.js
                 - lib/agents-v2/core/analysisAgent/scoringAnalyzer.js
                 - lib/agents-v2/core/analysisAgent/parallelCoordinator.js
               Taxonomy file: lib/constants/taxonomies.js (MUST read before analysis)

               Process:
               1. Read taxonomies + V2 analysis files
               2. Query staging WHERE extraction_status='complete'
                  AND analysis_status='pending' ORDER BY id LIMIT 20
               3. For each record: claim → content enhancement (6 fields)
                  → deterministic scoring → merge → update as 'complete'
               4. Output batch report with score distribution

               Note: actionableSummary uses the 'How to Win' prompt from Skill Section 3b.
               Note: Filtering is NOT the agent's job — orchestrator handles it post-batch.

               Database reads: mcp__postgres__query
               Database writes: source .env.local && psql \"$DEV_CLAUDE_URL\"")
  ```
  After each agent completes, re-check pending count. If more remain, spawn another.
  Expected report format: complete/error counts per record + score distribution.

- After ALL analysis agents complete, run the **filter SQL**:
  ```sql
  -- Orchestrator runs this via psql (NOT the analysis agent)
  UPDATE manual_funding_opportunities_staging
  SET analysis_status = 'filtered',
      analysis_error = 'Filtered: finalScore ' ||
        (analysis_data->'scoring'->>'finalScore') || ' below threshold 2'
  WHERE analysis_status = 'complete'
    AND (analysis_data->'scoring'->>'finalScore')::numeric < 2;
  ```
  Report: "Filtered X of Y records (finalScore < 2)"

- If count == 0: skip, report "No pending analysis records"

### Phase 6 — Storage

Usually 1 agent handles all pending records:
```
Task(subagent_type="storage-agent",
     prompt="Store analyzed records to production. Query staging WHERE
             analysis_status='complete' AND storage_status='pending' ORDER BY id.
             Apply dataSanitizer, UPSERT to funding_opportunities with
             promotion_status='pending_review', link coverage areas.
             Set storage_status='complete' per record.")
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
| Scope is genuinely ambiguous | **ASK** — one focused clarification question, then proceed (see Section 3) |
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

## 11. Audit Logging

The orchestrator handles all audit logging — individual agents have zero audit overhead.

**At pipeline start**, generate a batch_id:
```
batch_id = "run-YYYYMMDD-HHMM"  (e.g., "run-20260206-1430")
```

**After each phase completes**, log a summary row per table affected:

```sql
INSERT INTO claude_change_log
  (table_name, operation, pipeline_phase, batch_id, record_count, change_reason)
VALUES
  ('funding_sources', 'INSERT', 'source_registry', 'run-20260206-1430', 8,
   'Registered 8 utility sources for Arizona (5 new, 3 enriched)');
```

**After pipeline completes**, the final summary can also query the audit log:
```sql
SELECT pipeline_phase, table_name, operation, record_count, change_reason
FROM claude_change_log
WHERE batch_id = 'run-20260206-1430'
ORDER BY executed_at;
```

This provides full traceability without burdening individual agents. For record-level
detail, query the actual tables by `created_at` within the pipeline run timeframe.

---

## 12. Maintenance & Auto-Close

Run auto-close at the start of every pipeline execution:

```sql
UPDATE funding_opportunities
SET status = 'Closed'
WHERE status = 'Open'
  AND close_date < NOW()
  AND close_date IS NOT NULL;
```

Report how many were auto-closed: "Auto-closed X expired opportunities."

**Database connection**: See Section 1 (Mission) for read/write connection details.
