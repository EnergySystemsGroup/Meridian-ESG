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

**Business context**: Meridian is a GC/ESCO (general contractor / energy services
company). Our clients are commercial entities: municipalities, school districts,
hospitals, businesses, government agencies. We find funding that lets these clients
hire us for construction and installation projects.

### Model Selection Rule

**All spawned agents MUST use `model: "sonnet"` EXCEPT the analysis-agent.**

| Agent Type | Model | Why |
|---|---|---|
| source-registry-agent | **sonnet** | Web search + propose — doesn't need deep reasoning |
| program-discovery-agent | **sonnet** | URL crawl + extract — pattern matching, not analysis |
| opportunity-discovery-agent | **sonnet** | Status check + staging insert — straightforward |
| extraction-agent | **sonnet** | Field mapping from page content — structured work |
| **analysis-agent** | **opus** | Content enhancement + scoring adjustment needs deep reasoning |
| storage-agent | **sonnet** | Data sanitization + UPSERT — mechanical |

Include `model: "sonnet"` (or `model: "opus"` for analysis) in every `Agent()` or
`Task()` call. If omitted, the agent inherits the orchestrator's model (opus),
which wastes tokens on work that doesn't need it.

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
| 7 | Review & Publish | `promotion_status='pending_review'` | `promotion_status` flip | Read-only reporter → directs to `/admin/review` UI |

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

Extract state_code, type(s), or source name from the request:

**Clear scope** — proceed without asking:
- "Arizona utilities" → `state_code='AZ'`, `type='Utility'`
- "PG&E" → lookup `funding_sources` by name
- "California county grants" → `state_code='CA'`, `type='County'`
- "all delinquent sources" → `programs_last_searched_at IS NULL OR < 90 days`

**Broad scope — type not specified** — determine applicable types:
- "Find all sources in Nevada" → NV, all applicable funder types (see Section 3.5)
- "Everything in Clark County area" → NV, focus on County + Municipality
- "Sources relevant to energy and housing in Arizona" → AZ, all types that fund energy/housing

**Common natural language → type mapping** (use as guidance, not strict rules):
- "utilities", "electric companies", "power companies" → Utility
- "counties", "county government", "local government" → County
- "cities", "municipal", "local" → Municipality (or County + Municipality if ambiguous)
- "state agencies", "state programs" → State
- "foundations", "philanthropic" → Foundation
- "tribal", "tribal authorities" → Tribal
- "federal", "federal agencies" → Federal

**When type is not specified or is broad**, the orchestrator determines which
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
- You can reasonably infer type from context (e.g., "local and county" → County + Municipality)
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
-- Example for Arizona utilities (substitute actual state_code and type):
SELECT COUNT(*) as source_count
FROM funding_sources
WHERE state_code = 'AZ' AND type = 'Utility';

-- Check 2a: Catalog URLs exist for these sources? (Phase 2 prerequisite)
SELECT COUNT(*) as url_count,
  COUNT(DISTINCT spu.source_id) as sources_with_urls
FROM source_program_urls spu
JOIN funding_sources fs ON fs.id = spu.source_id
WHERE fs.state_code = 'AZ' AND fs.type = 'Utility';

-- Check 2b: Programs exist for these sources?
SELECT COUNT(*) as program_count
FROM funding_programs fp
JOIN funding_sources fs ON fs.id = fp.source_id
WHERE fs.state_code = 'AZ' AND fs.type = 'Utility';

-- Check 3: Programs due for checking? (smart schedule)
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

-- Check 5: Review queue
SELECT
  COUNT(*) FILTER (WHERE promotion_status = 'pending_review') as pending_review,
  COUNT(*) FILTER (WHERE promotion_status = 'promoted') as promoted,
  COUNT(*) FILTER (WHERE promotion_status = 'rejected') as rejected
FROM funding_opportunities
WHERE promotion_status IS NOT NULL;
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

### Concrete Tool Call Pattern — Single-Writer (Orchestrator Writes)

**CRITICAL: Teammates are PROPOSERS, not writers.** Teammates search the web and
propose entities via SendMessage to the orchestrator. The orchestrator validates,
deduplicates, and performs all database writes. This ensures zero bad data enters
the database.

Here is the EXACT sequence of tool calls for spawning a Phase 1 discovery team.
**Follow this pattern literally — do not improvise an alternative.**

```
STEP 1: Create ONE team for all funder types in this run
─────────────────────────
TeamCreate(
  team_name="source-discovery-FL",
  description="Phase 1: Discover FL County + State funding sources"
)

STEP 2: Spawn ALL teammates IN PARALLEL (one message, all Task calls together)
─────────────────────────
// IMPORTANT: model: "sonnet" for ALL Phase 1 teammates (not opus)
// County pair:
Task(
  subagent_type="source-registry-agent",
  model="sonnet",
  team_name="source-discovery-FL",
  name="county-direct",
  prompt="You are the COUNTY-DIRECT teammate. Execute strategies 1+5+7.
          State: FL

          ## SCOPE
          You are searching for type='County' sources ONLY.
          If you find an entity that should be a different type (Utility, Municipality,
          State, etc.), DO NOT propose it. Note it in your report as 'out-of-scope
          entity found: [name], suggested type: [X]' and the orchestrator will decide.
          Also search for regional Councils of Governments (COGs) that administer
          CDBG/HOME on behalf of small counties — propose these as type='Other'.

          Read SEARCH-REFERENCE.md for detailed instructions.

          ## CRITICAL: DO NOT WRITE TO THE DATABASE
          You are a PROPOSER, not a writer. Search, verify, and propose entities.
          Send your proposed entity list to team-lead via SendMessage.
          The orchestrator will validate and INSERT.

          When done, broadcast your entity list to the team for cross-checking.
          Cross-check with county-aggregator's findings."
)

Task(
  subagent_type="source-registry-agent",
  model="sonnet",
  team_name="source-discovery-FL",
  name="county-aggregator",
  prompt="You are the COUNTY-AGGREGATOR teammate. Execute strategy 4.
          State: FL

          ## SCOPE
          You are searching for type='County' sources ONLY.
          [same scope block as above]

          ## CRITICAL: DO NOT WRITE TO THE DATABASE
          [same no-write block as above]

          Cross-check with county-direct's findings."
)

// State pair (same pattern with type='State' in SCOPE block):
Task(
  subagent_type="source-registry-agent",
  model="sonnet",
  team_name="source-discovery-FL",
  name="state-direct",
  prompt="... [same pattern, SCOPE says type='State' ONLY] ..."
)

Task(
  subagent_type="source-registry-agent",
  model="sonnet",
  team_name="source-discovery-FL",
  name="state-aggregator",
  prompt="... [same pattern, SCOPE says type='State' ONLY] ..."
)

STEP 3: Wait for teammates to search and cross-check
─────────────────────────
Teammates will:
  a) Execute their assigned search strategies (the slow part — 10-15 min)
  b) Broadcast their proposed entity list to the team via SendMessage
  c) Cross-check other teammates' proposals (flag overlaps, stale entities, type issues)
  d) Send FINAL PROPOSED LIST to team-lead with confidence levels

Each proposed entity includes:
  - name (official name from the entity's own website)
  - website URL
  - type
  - description
  - proposed catalog URLs (for source_program_urls)
  - confidence (HIGH/MEDIUM/LOW)
  - name_source ("from footer", "from About Us page", "from breadcrumb", "from search result only")

STEP 4: Orchestrator validates and writes (the fast part — 3-5 min)
─────────────────────────
For each proposed entity, the orchestrator:

  a) DEDUP CHECK — by URL AND normalized name:
     SELECT id, name, website FROM funding_sources
     WHERE state_code = $1
       AND (website ILIKE '%' || $domain || '%'
            OR LOWER(name) ILIKE '%' || $normalized_name || '%')
       AND name NOT LIKE '[DEPRECATED-%';
     Also check source_program_urls for URL matches.

  b) TYPE VALIDATION — does the proposed type match the run scope? If a teammate
     proposed type='Utility' in a County-scoped run, the orchestrator flags it as
     out-of-scope (log it, don't insert).

  c) NAME SPOT-CHECK — for any entity where name_source is "from search result only"
     (not verified against official website), do a quick WebFetch of the website URL
     and check page title / breadcrumb / footer for the official name. Correct if needed.

  d) INSERT — if passes all checks:
     INSERT INTO funding_sources (name, website, type, sectors, state_code, pipeline, description)
     VALUES (..., 'manual', ...);
     INSERT INTO source_program_urls (source_id, url) VALUES (...);

  e) LOG — write to claude_change_log:
     INSERT INTO claude_change_log (table_name, operation, pipeline_phase, batch_id, record_count, change_reason)
     VALUES ('funding_sources', 'INSERT', 'source_registry', $batch_id, 1, 'Registered: [name]');

STEP 5: Clean up
─────────────────────────
- Send shutdown_request to all teammates
- TeamDelete to clean up
- Report: "Phase 1 complete: X sources registered, Y catalog URLs, Z out-of-scope flagged"
- Proceed to Phase 2
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
  → county-direct    (strategies 1+5+7, type=County)     ┐ County pair
  → county-aggregator (strategy 4, type=County)           ┘ cross-checks
  → state-direct     (strategies 5+7, type=State)        ┐ State pair
  → state-aggregator  (strategy 4, type=State)            ┘ cross-checks
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
- Each teammate gets `subagent_type="source-registry-agent"`, `model="sonnet"`
- Include strategy group name AND numbers in the prompt
- Include state_code and the SCOPE block (what type IS in scope) in every prompt
- **Teammates DO NOT write to DB** — they propose entities via SendMessage
- **Orchestrator validates and writes** — dedup by URL+name, type validation, name spot-check
- Include `## CRITICAL: DO NOT WRITE TO THE DATABASE` block in every teammate prompt

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
SELECT fs.id, fs.name, fs.type,
  (SELECT COUNT(*) FROM source_program_urls spu WHERE spu.source_id = fs.id) as url_count
FROM funding_sources fs
WHERE fs.state_code = 'FL' AND fs.type = 'County'
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
2. **Apply stale URL repairs to `source_program_urls`** (see below)
3. Dedup programs by URL (exact match) and by name+source (fuzzy match)
4. Count total unique programs
5. Plan extractor assignments: ~10 programs per extractor
6. Report to user: "Round 1 complete: X programs found across Y sources. Starting extraction. Stale URLs repaired: N."

##### Stale URL Repair (Step 2)

Each scout emits a `stale_urls` array in its output JSON (see program-discovery
skill § 5 for the schema). Collect these across all scouts and apply repairs
to `source_program_urls`:

**Step A — Collect and dedup stale_urls reports**:
```python
import json
stale_reports = []
for n in range(NUM_SCOUTS):
    d = json.load(open(f'/tmp/meridian-phase2/scout-{n}-results.json'))
    stale_reports.extend(d.get('stale_urls', []))

# Dedup by stale_url (multiple scouts may report the same stale URL)
seen = {}
for r in stale_reports:
    key = r['stale_url']
    if key not in seen or r.get('confidence') == 'high':
        seen[key] = r  # prefer high-confidence over lower
unique_reports = list(seen.values())
```

**Step B — Apply UUID validation** (per § 7.5). Every `source_id` in a stale
report must validate against `funding_sources` or be dropped.

**Step C — Validate the replacement URL** before applying:
For each report with a `replacement_url`:
1. Confirm the replacement URL is reachable (WebFetch or curl). If not, skip
   the repair — don't overwrite a stale URL with a broken one.
2. Confirm the replacement page is a catalog page for the SAME source (spot
   check content mentions the source name or matching grant topics). This
   prevents cross-source URL contamination.

**Step D — Apply the UPDATE**:
```sql
UPDATE source_program_urls
SET url = '<replacement_url>',
    last_crawled_at = NOW()
WHERE source_id = '<validated-source-uuid>'
  AND url = '<stale_url>';
```

**Step E — Handle no-replacement cases** (`replacement_url IS NULL`):
When a scout reports a stale URL but could not find a replacement, flag
it for review rather than updating. Options:
- Leave the row in place (next scout run may find a replacement)
- If the source has OTHER catalog URLs that are working, the next scout
  run will still function — the stale row just wastes one WebFetch per run
- Log the flag in `claude_change_log` so a human can review and manually remove

**Step F — Log to audit table**:
```sql
INSERT INTO claude_change_log
  (table_name, operation, pipeline_phase, batch_id, record_count, change_reason)
VALUES
  ('source_program_urls', 'UPDATE', 'stale_url_repair', '<batch_id>', <N>,
   'Repaired N stale catalog URLs based on scout discoveries');
```

**Step G — Report to user**:
Include in the Round 1 summary: `Stale URLs repaired: N (M unrepairable — flagged).`
For each repair, show before → after in the detailed report.

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

### Phase 3 — Opportunity Discovery Teams (Single-Writer Pattern)

**Checkers are REPORTERS, not writers.** They crawl URLs, assess status and funding,
and send structured reports to the orchestrator. The orchestrator validates, deduplicates,
and performs all database writes.

Team name: `opportunity-check-[SCOPE]` (e.g., `opportunity-check-AZ-utility`)

```
STEP 0: Pre-flight (orchestrator runs directly)
─────────────────────────
// Smart scheduling query — get eligible programs.
//
// The NOT EXISTS clause uses ONLY the clean FK match (fo.program_id = fp.id) — this
// catches manual-pipeline self-duplication efficiently (if our last run created an
// Open dated opportunity for this program, skip it now). The cross-pipeline dedup
// (vs API-ingested rows that have program_id IS NULL, or rows with naming variance)
// happens in STEP 0.5 below via LLM judgment, not here.
//
// Why not a fuzzy SQL fallback here?
//   Previous version had: OR (fo.funding_source_id = fp.source_id AND fo.title ILIKE
//   '%' || fp.name || '%'). It caught ~1 of 120 cross-pipeline duplicates in the CA
//   State run because (a) API rows have program_id IS NULL so the FK fires never,
//   (b) title variance breaks the substring match, (c) source_id often differs
//   across pipelines for the same agency. The LLM step replaces it.
mcp__postgres__query:
SELECT fp.id, fp.name, fp.description, fp.program_urls,
       fp.status as program_status, fp.source_id,
       fs.name as source_name, fs.state_code, fs.type
FROM funding_programs fp
JOIN funding_sources fs ON fs.id = fp.source_id
WHERE fp.status IN ('active', 'unknown')
  AND fp.next_check_at <= NOW()
  -- Scope filter (substitute actual values):
  AND fs.state_code = 'AZ' AND fs.type = 'Utility'
  AND NOT EXISTS (
    SELECT 1 FROM funding_opportunities fo
    WHERE fo.status = 'Open'
    AND fo.close_date IS NOT NULL
    AND fo.program_id = fp.id
  )
ORDER BY fp.source_id, fp.name;

// Report count and stop if zero eligible.

STEP 0.5: Cross-Pipeline LLM Dedup Pre-Check (REQUIRED)
─────────────────────────
For each due program returned by STEP 0, check whether an existing approved Open
opportunity (manual OR API-ingested) is already covering it. This catches the
case the SQL NOT EXISTS misses: the API pipeline doesn't populate program_id, so
its opportunities are FK-orphaned. Title variance and cross-source attribution
(e.g., SOMAH registered under CPUC by us, under PG&E by the API) also defeat
naive SQL matching.

Drop programs that match an existing approved Open opportunity BEFORE assigning
them to checkers. Saves Phase 3 crawl + Phase 4 extraction + Phase 5 analysis on
records that would just be rejected at Phase 6 storage anyway.

#### STEP 0.5a — Candidate Query (per program)

For each due program `fp`, pull plausible duplicate candidates from
funding_opportunities. Cast a wide net; the LLM filters precisely.

```sql
-- Run via mcp__postgres__query
-- Requires pg_trgm extension (CREATE EXTENSION IF NOT EXISTS pg_trgm)
-- similarity() returns 0.0–1.0; threshold 0.2 is intentionally loose
SELECT fo.id,
       fo.title,
       fo.url,
       fo.status,
       fo.close_date,
       fo.funding_source_id,
       fs.name AS source_name,
       similarity(fo.title, '<fp.name>') AS title_sim,
       CASE
         WHEN fo.promotion_status = 'promoted' THEN 'promoted'
         WHEN fo.promotion_status IS NULL AND fo.api_source_id IS NOT NULL THEN 'API-ingested'
         ELSE 'other'
       END AS approved_state
FROM funding_opportunities fo
LEFT JOIN funding_sources fs ON fs.id = fo.funding_source_id
WHERE fo.status = 'Open'
  AND (
    fo.promotion_status = 'promoted'
    OR (fo.promotion_status IS NULL AND fo.api_source_id IS NOT NULL)
  )
  AND (
    similarity(fo.title, '<fp.name>') > 0.2          -- primary signal: fuzzy title
    OR fo.funding_source_id = '<fp.source_id>'        -- bonus: same source
    OR (
      '<fp.program_urls>' IS NOT NULL                 -- bonus: same URL domain
      AND fo.url IS NOT NULL
      AND split_part(replace(replace(fo.url, 'https://', ''), 'http://', ''), '/', 1)
        = split_part(replace(replace('<fp.first_url>', 'https://', ''), 'http://', ''), '/', 1)
    )
  )
ORDER BY title_sim DESC
LIMIT 20;
```

Notes on the candidate query:
- **Title trigram similarity is the load-bearing signal.** It catches duplicates
  even when source_id differs (different agency attribution) and when URLs differ
  (different agency landing pages). All 8 confirmed cross-pipeline duplicates in
  the CA State run had recognizable title similarity above 0.2.
- The `funding_source_id` and URL-domain branches are bonus catches for edge
  cases (heavily abbreviated titles, programs known by acronym only).
- Threshold 0.2 is intentionally loose. Better to send the LLM a few extra
  candidates than to miss a real duplicate. The LLM filters precisely.
- If zero candidates → no dedup question to answer → proceed with the program.

#### STEP 0.5b — LLM Judgment Call (per program with candidates)

Send the LLM (Sonnet) this structured query:

```
You are evaluating whether a funding program is essentially the same as one of
several existing opportunities already in our database.

CANDIDATE PROGRAM (we're about to check for current openings):
  Name: <fp.name>
  Description: <fp.description>
  Source: <fp.source_name>
  Source type: <fp.type>
  URLs: <fp.program_urls>

EXISTING APPROVED OPEN OPPORTUNITIES (potential matches):
  1. id=<opp_id>, title=<title>, url=<url>, source=<source_name>,
     state=<approved_state>, title_similarity=<title_sim>
  2. ...
  (up to 20)

Determine: is the candidate program essentially the SAME funding mechanism as
any of these opportunities? Same = same underlying program, possibly different
rounds/years/regional variants/naming conventions. Different = distinct
programs even if titles or sources are similar.

Examples of what SHOULD match (same program, different wording):
  - "SOMAH" ↔ "Solar on Multifamily Affordable Housing (SOMAH) Program"
  - "Charter School Facilities Program (CSFP)" ↔ "Charter School Facility Grant Program – (SB740)"
  - "Modernization Funding for Schools" ↔ "School Facility Program (SFP) Modernization (Proposition 2)"
  - "SS4A" ↔ "Safe Streets and Roads for All Funding Opportunity"

Examples of what should NOT match (different programs at same source/URL):
  - "Cannabis Restoration Grant Program" vs "Cannabis Research and Innovation
    Funding Opportunity (RIFO)" — both CDFW cannabis, but one is habitat
    restoration, the other is research grants
  - "Wildfire Prevention Grant Program" vs "Forest Health Grants" — both CAL
    FIRE, but distinct programs
  - "Proposition 1 Watershed Restoration" vs "Proposition 68 Watershed
    Restoration" — different bond cycles, may be distinct programs

Return strict JSON:
{
  "is_duplicate": true | false,
  "matched_opp_id": "<uuid>" | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "<one sentence — what made you decide>"
}
```

#### STEP 0.5c — Decision Rule

| LLM response | Action |
|---|---|
| `is_duplicate=true, confidence=high` | **Skip the program.** Log to claude_change_log. Update program scheduling so we don't re-check soon. |
| `is_duplicate=true, confidence=medium` | **Skip the program.** Log + flag in user summary for spot-check. |
| `is_duplicate=true, confidence=low` | **Proceed with check.** Phase 6 storage UPSERT acts as backstop. Log the near-miss for monitoring. |
| `is_duplicate=false` | **Proceed with check.** Normal Phase 3 flow. |
| Zero candidates from STEP 0.5a | **Proceed with check.** No dedup question to answer. |

#### STEP 0.5d — Apply Skip Actions

For each program flagged as a duplicate (confidence ≥ medium), the orchestrator:

1. Updates `funding_programs.last_checked_at = NOW()` (we did check, via the LLM,
   even though we didn't crawl)
2. Updates `funding_programs.next_check_at` per the scheduling table in
   opportunity-discovery SKILL.md (treat as "Open, rolling" → NOW + 180 days,
   since we trust the existing approved opportunity covers it)
3. Logs to `claude_change_log`:
   ```sql
   INSERT INTO claude_change_log
     (table_name, operation, pipeline_phase, batch_id, record_count, change_reason)
   VALUES
     ('funding_programs', 'dedup_skip', 'phase3_preflight', '<batch_id>', 1,
      'Skipped Phase 3 check for program <fp.id> (<fp.name>): LLM matched to existing approved opportunity <opp_id> with <confidence> confidence. Reasoning: <reasoning>');
   ```
4. Removes the program from the checker assignment list

#### STEP 0.5e — Reporting Requirements

Before STEP 1 (team spawn), the orchestrator MUST report:
- Programs evaluated by LLM dedup: N
- Programs skipped (high confidence duplicate): N — list each with matched_opp_id
- Programs skipped (medium confidence duplicate): N — list each with matched_opp_id (flag for spot-check)
- Programs near-miss (low confidence, proceeding anyway): N — list for monitoring
- Programs proceeding to Phase 3 checkers: N

If skip count is unusually high (>30% of due programs), pause and surface to user
— could indicate LLM is too aggressive or the candidate query is misconfigured.

STEP 1: Create team + spawn checkers (model: "sonnet")
─────────────────────────
TeamCreate(team_name="opportunity-check-AZ-utility", ...)

// Group programs by source (~10-15 per checker)
Task(
  subagent_type="opportunity-discovery-agent",
  model="sonnet",
  team_name="opportunity-check-AZ-utility",
  name="checker-aps",
  prompt="You are an opportunity discovery REPORTER (not a writer).
          Read: .claude/skills/opportunity-discovery/SKILL.md

          ## CRITICAL: DO NOT WRITE TO THE DATABASE
          Report your findings via SendMessage. The orchestrator writes.

          Your assigned programs: [list with IDs, URLs]

          For each program, report ALL of these fields:
            status, window_type, open_date, close_date, application_url,
            funding_status, funding_note, has_details, guidelines_url,
            suggested_next_check, next_check_reason, new_urls_found, flags

          Send your complete report to team-lead when done."
)

STEP 2: Collect checker reports
─────────────────────────
Checkers will:
  a) Crawl each program's URLs
  b) Assess application status (Open / Upcoming / Nothing)
  c) Assess funding status (verified_active / presumed_active / limited_funding /
     oversubscribed / exhausted)
  d) Assess window type (dated / rolling / cycle_based)
  e) Report ALL findings to team lead via SendMessage (NO DB writes)

STEP 3: Orchestrator validates and writes (the critical step)
─────────────────────────
For each program in the checker reports, the orchestrator applies this logic:

  === RULE: Open + exhausted should NEVER coexist on a stored opportunity ===

  IF checker reports funding_status=exhausted:
    → Check: does an Open opportunity exist for this program_id?
    → IF YES: UPDATE it to status='Closed', funding_status='exhausted',
      funding_note=[evidence], funding_verified_at=NOW()
    → IF NO: do nothing (no staging record — money is gone)
    → Set next_check_at = NOW() + 30 days (short cycle to catch refunding)
    → Log: "Closed [title] due to funding exhaustion"
    → Do NOT compare hashes — the page changed (exhaustion language appeared),
      but we don't want to re-stage it, we want to close it.

  IF checker reports status=Open AND funding_status != exhausted:
    → Check: does an Open opportunity already exist for this program_id?
    → IF YES AND window_type=rolling: compare source_hash.
      - Hash UNCHANGED: just UPDATE funding_verified_at=NOW() and
        funding_status=[checker's assessment]. No new staging record.
      - Hash CHANGED: content was updated (new amounts, new eligibility, etc.)
        — create a new staging record to re-extract the updated content.
    → IF YES AND window_type=dated with different dates: new round — create staging record
    → IF NO existing opportunity: create new staging record with all fields
    → Set next_check_at per the scheduling table in opportunity-discovery SKILL.md

  IF checker reports status=Upcoming:
    → IF has_details=true: create staging record (capture the details early)
    → IF has_details=false: do NOT create staging record, just set
      next_check_at = NOW() + 30 days (check monthly until details appear)

  IF checker reports status=Nothing:
    → Do NOT create staging record
    → Set next_check_at per checker's suggestion

  For ALL programs: UPDATE funding_programs.last_checked_at = NOW()
  For ALL programs: UPDATE funding_programs.next_check_at = [from report]

STEP 4: Clean up and chain
─────────────────────────
- Shutdown all checkers, TeamDelete
- Report: "Phase 3 complete: X staged, Y closed-exhausted, Z unchanged, W nothing-found"
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

```sql
-- Count pending (via mcp__postgres__query)
SELECT COUNT(*) FROM manual_funding_opportunities_staging
WHERE analysis_status = 'complete' AND storage_status = 'pending';
```

- If count > 0: spawn storage agent (1 agent per batch of 20)
  ```
  Task(subagent_type="storage-agent",
       prompt="Store analyzed records to production.
               REQUIRED — read these V2 reference files first:
                 - lib/agents-v2/core/storageAgent/dataSanitizer.js
                 - lib/services/locationMatcher.js
                 - lib/agents-v2/core/storageAgent/utils/fieldMapping.js
               Query staging WHERE analysis_status='complete'
                 AND storage_status='pending' ORDER BY id LIMIT 20.
               For each record:
                 1. Sanitize fields per dataSanitizer functions
                 2. UPSERT to funding_opportunities with:
                    - promotion_status = 'pending_review'
                    - api_source_id = NULL
                    - api_opportunity_id = 'manual'
                    - program_id from staging.program_id
                    - funding_source_id from staging.source_id
                 3. Link coverage areas from eligible_locations
                 4. Update staging: storage_status='complete',
                    opportunity_id=<returned UUID>, stored_by='storage-agent'
               TEXT FIELDS MUST BE COPIED VERBATIM — no truncation.
               Dollar-quote with $STOR$...$STOR$.
               DB writes: source .env.local && psql \"$<ENV_VAR>\"")
  ```
  After each agent completes, re-check count. If more pending, spawn another.
  Report: "Stored X records (Y new, Z updated). Coverage areas linked: N."
- If count == 0: skip, report "No pending storage records"

---

## 7.5. Agent Output UUID Validation (REQUIRED)

Every UUID that comes back from an agent — in a report, a JSON file, or a
SendMessage payload — **MUST be validated against the database before it
becomes part of any INSERT/UPDATE**. This is non-negotiable and applies to
every phase that writes results from agent output (Phase 1 Source Registry,
Phase 2 Round 1 scouts → Round 2 extractors, Phase 3 opportunity checkers).

### Known Failure Mode

LLM agents (including Sonnet-class models used in this pipeline) reliably
hallucinate UUIDs when echoing them from input to output. Two patterns:

1. **Tail invention**: agent keeps the first 8 characters of a real UUID
   (the distinctive fingerprint it can "remember") and fabricates the
   remaining 28 characters. Example observed in `run-20260414-ca-state-full`:
   - Real: `50deced6-8b10-49ae-b8f8-de87faf29224`
   - Hallucinated: `50deced6-4b8f-4c3d-9b8a-8d6f89ab4df1`
2. **Semantic placeholders**: agent outputs strings like `calfire-source-id`,
   `csfa-source-id`, or `tbd-uuid` when it doesn't have a concrete identifier.

Both patterns caused data loss in the CA State run (5 programs in Phase 2,
9 findings in Phase 3) until the orchestrator added post-hoc validation.
Every future run MUST validate up front.

### Validation Procedure

Before any staging INSERT, program UPDATE, or FK-bearing write that uses an
agent-supplied UUID, run this five-step gate:

**Step 1 — Regex format check**:
```python
import re
UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
# Reject if no match — this catches placeholders like "calfire-source-id"
```

**Step 2 — DB existence check**:
```sql
-- Run via mcp__postgres__query (or env-appropriate MCP)
SELECT id FROM funding_sources WHERE id = '<uuid>';
SELECT id FROM funding_programs WHERE id = '<uuid>';
```
If regex passes but no row returned → hallucinated UUID (correct format,
wrong value). Proceed to recovery.

**Step 3 — Name-based recovery**:
If the agent supplied a name alongside the invalid UUID, look it up by
normalized name:
```sql
SELECT id FROM funding_sources
WHERE LOWER(REGEXP_REPLACE(name, '[^a-z0-9]', '', 'g'))
    = LOWER(REGEXP_REPLACE('<agent-supplied-name>', '[^a-z0-9]', '', 'g'))
  AND state_code = '<scope-state-code>'
  AND type = '<scope-type>';
```
If exactly one match → use that UUID. If zero or multiple → proceed to Step 4.

**Step 4 — Cross-reference via related IDs**:
If the agent supplied a valid program_id but invalid source_id, derive source_id:
```sql
SELECT source_id FROM funding_programs WHERE id = '<valid-program-id>';
```
Equivalent patterns exist for opportunity → program, coverage → opportunity.

**Step 5 — Fail loudly when unrecoverable**:
If no UUID AND no usable name, DO NOT invent a fallback and DO NOT silently
skip. Record the failure explicitly:
```sql
INSERT INTO claude_change_log
  (table_name, operation, pipeline_phase, batch_id, record_count, change_reason)
VALUES
  ('<target_table>', 'validation_failed', '<phase>', '<batch_id>', 1,
   'UUID validation failed: could not resolve agent-supplied identifier. Details: ...');
```
Then skip that record and surface the skip to the user in your phase report.

### Practical Implementation

The orchestrator should run validation once per batch of agent output, not
per individual record, to avoid chatty DB queries. Typical pattern:

1. Collect the full set of agent findings into one JSON file
2. Pull the trusted UUID set for the current scope from the DB (one query)
3. Build in-memory maps: `known_source_ids`, `known_program_ids`,
   `program_to_source`, `name_to_id`
4. Iterate findings, apply Steps 1-5 using the maps
5. Write only validated records; log every recovery and every skip

A reference implementation was used for `run-20260414-ca-state-full`:
see `/tmp/meridian-phase3/retry_bad_uuids.py` (Name-based recovery map) and
`/tmp/meridian-phase3/generate_sql.py` (Regex + DB existence + program_id →
source_id cross-ref). Both use `claude_writer`-compatible SQL.

### Reporting Requirements

At end of phase, every validation pass MUST report:
- Records with valid UUIDs (wrote directly): N
- Records recovered via name lookup: N — list each with before/after
- Records recovered via ID cross-reference: N
- Records skipped due to unrecoverable UUID: N — list each with reason

Silent drops are forbidden. If the orchestrator cannot reach 100% accounted-for,
that is a pipeline failure and must be surfaced to the user.

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

Auto-close is handled automatically by the `update_opportunity_statuses()` PostgreSQL
function, scheduled via `pg_cron` to run daily at 00:05 UTC. It performs three operations:

1. **Upcoming → Open**: when `open_date <= CURRENT_DATE`
2. **Open → Closed**: when `close_date < CURRENT_DATE`
3. **Closed → Open**: when status is 'Closed' but `close_date` is still in the future (fixes bad data)

The `funding_opportunities_with_geography` view also has a `calculated_status` column
that computes these transitions on-the-fly for display.

**No manual auto-close is needed in the pipeline.** The orchestrator relies on the
cron job and view for accurate status. If you need to force a status refresh, run:
```sql
SELECT update_opportunity_statuses();
```

**Database connection**: See Section 1 (Mission) for read/write connection details.
