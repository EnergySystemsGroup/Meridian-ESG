---
name: client-scout
description: >
  Client Opportunity Scout — proactively searches for funding opportunities
  matching a specific client's profile. Orchestrates search waves by source
  type, presents a consolidated report, and reverse-engineers approved
  findings into the pipeline. Invoked as /client-scout.
---

# Client Opportunity Scout

## 1. Mission

Given a client, search broadly for funding opportunities matching their profile
that aren't already in Meridian. Present findings for approval. Ingest approved
findings through the existing pipeline (backfill source → program → staging →
extraction → analysis → storage).

**Key difference from pipeline orchestrator**: The pipeline is source-centric
(find ALL programs from a source). This skill is client-centric (find programs
matching THIS client, from any source).

---

## 2. Database Configuration

**NO DEFAULT ENVIRONMENT.** The user MUST specify which environment to use.
- **STOP and ask** if not specified: "Which environment? dev, staging, or production?"
- Reads: `mcp__postgres__query` (read-only MCP tool)
- Writes (Phase 4 ingestion only):
  - `"use dev"` → `source .env.local && psql "$DEV_CLAUDE_URL"`
  - `"use staging"` → `source .env.local && psql "$STAGING_CLAUDE_URL"`
  - `"use prod"` / `"use production"` → `source .env.local && psql "$PROD_CLAUDE_URL"`
- Pass the selected env var name to all spawned agents for writes.

---

## 3. Phase 1 — Profile Analysis

Run directly in the orchestrator (no agents). Query the database and prepare
the search plan.

### 3.1 Load Client

```sql
SELECT c.id, c.name, c.type, c.state_code, c.county_name, c.city,
       c.coverage_area_ids, c.project_needs, c.dac, c.description
FROM clients c
WHERE c.name ILIKE '%[client_name]%'
   OR c.id = '[client_id]'::uuid;
```

If multiple matches, present them and ask the user to pick one.

### 3.2 Resolve Client's Utilities

```sql
SELECT ca.id, ca.name, ca.kind, ca.state_code
FROM coverage_areas ca
WHERE ca.id = ANY('{...}'::uuid[])  -- client's coverage_area_ids
  AND ca.kind = 'utility';
```

These are the specific utilities serving this client (used in Wave 1).

### 3.3 Expand Client Type

Read `lib/constants/taxonomies.js` to apply type expansion:
- **Synonyms**: e.g., "K-12 School Districts" ↔ "K-12 Schools"
- **Hierarchy parents**: e.g., "K-12 School Districts" → also "Local Governments"
- **Cross-categories**: e.g., "K-12 School Districts" → also "Nonprofit Organizations 501(c)(3)"

This expanded list helps search agents use the right keywords.

### 3.4 Load Existing Matches (for dedup awareness)

```sql
SELECT fo.id, fo.title, fo.url
FROM client_matches cm
JOIN funding_opportunities fo ON fo.id = cm.opportunity_id
WHERE cm.client_id = '[client_id]'
  AND cm.is_stale = false;
```

### 3.5 Load All Opportunities (for global dedup)

```sql
SELECT id, title, url FROM funding_opportunities
WHERE status != 'closed'
  AND (promotion_status IS NULL OR promotion_status NOT IN ('rejected'));
```

### 3.6 Plan Waves and Chunks

Determine which waves apply and how to chunk project needs:

**Wave applicability**:
| Wave | Always? | Condition |
|------|---------|-----------|
| Utility | If client has utilities | coverage_area_ids includes kind='utility' |
| County/City | If client has county/city | county_name or city is not null |
| State | Always | Every client has a state |
| Federal | Always | Federal programs apply to all |
| Foundation | Always | Foundations apply to all types |

**Chunking**: Divide `project_needs` into groups of 3-5. Each chunk becomes
one search agent per wave.

Example: 23 project needs → 6 chunks of ~4 needs each → 6 agents per wave.

### 3.7 Report to User

Present a summary before proceeding:

```
CLIENT SCOUT — Profile Summary
═══════════════════════════════
Client: Environmental Charter Schools
Type: K-12 School Districts (expanded: K-12 Schools, Local Governments, Nonprofit 501(c)(3))
Location: Redondo Beach, Los Angeles County, CA
DAC: Yes
Utilities: Southern California Edison, Southern California Gas Company, [water utilities...]
Project Needs: 23 total

Search Plan:
  Wave 1 (Utility): 6 agents searching SCE + SoCalGas
  Wave 2 (County/City): 6 agents searching LA County + Redondo Beach
  Wave 3 (State): 6 agents searching California programs
  Wave 4 (Federal): 6 agents searching DOE/EPA/USDA
  Wave 5 (Foundation): 6 agents searching education/green foundations

Total: ~30 search agents across 5 sequential waves
Proceed?
```

---

## 4. Phase 2 — Search Waves

Waves run **sequentially** (1→2→3→4→5). Within each wave, agents run
**in parallel via Task tool**.

### 4.1 Wave Execution Pattern

For each wave:

**Step 1**: Spawn all chunk agents in parallel (single message, multiple Task calls):

```
Task(
  subagent_type="client-scout-search-agent",
  name="utility-chunk-1",
  prompt="WAVE: utility
          SOURCES: Southern California Edison, Southern California Gas Company
          NEEDS CHUNK: ['HVAC Systems', 'Lighting Systems', 'Solar Panels']

          CLIENT PROFILE:
          - Name: Environmental Charter Schools
          - Type: K-12 School Districts
          - Expanded types: K-12 Schools, Local Governments, Nonprofit 501(c)(3)
          - State: CA, County: Los Angeles County, City: Redondo Beach
          - DAC: true

          DEDUP — existing opportunity titles:
          [list of known titles]

          DEDUP — existing opportunity URLs:
          [list of known URLs]

          DEDUP — findings from prior waves:
          [list of titles/URLs found in earlier waves, if any]

          DB reads: mcp__postgres__query
          DO NOT write to any database. Report findings only."
)

Task(
  subagent_type="client-scout-search-agent",
  name="utility-chunk-2",
  prompt="WAVE: utility
          SOURCES: Southern California Edison, Southern California Gas Company
          NEEDS CHUNK: ['Battery Storage', 'EV Charging', 'Energy Management']
          ... [same client profile and dedup lists]"
)

// ... additional chunk agents
```

**Step 2**: Wait for all agents in the wave to complete.

**Step 3**: Collect findings from all agents. Add new titles/URLs to the running
dedup list for subsequent waves.

**Step 4**: Report wave summary to user:
```
Wave 1 (Utility) complete: 8 new findings, 3 already in DB, 1 bonus find
Starting Wave 2 (County/City)...
```

### 4.2 Between Waves

After each wave completes:
1. Parse each agent's output for findings
2. Deduplicate findings within the wave (same URL found by multiple chunk agents)
3. Append new finding titles/URLs to the dedup list
4. Proceed to next wave

---

## 5. Phase 2.5 — Dedup + Source Backfill

After search waves complete, prepare findings for Phase 2 extractor processing.

**Do NOT apply three-gate filters manually here.** The Phase 2 program-discovery
extractor agents visit actual program URLs and apply the gates with real page
content — far more accurate than classifying from search summaries. Let them
handle the filtering.

### 5.1 Cross-Wave Deduplication

Multiple waves may find the same program. Deduplicate by URL first, then by
similar titles (allow for naming variations).

### 5.2 Dedup Against Existing Programs

For each finding, check against `funding_programs` and `funding_opportunities`:

```sql
SELECT id, name, source_id FROM funding_programs
WHERE name ILIKE '%[program_name]%'
   OR name ILIKE '%[alternate_name]%';

SELECT id, title FROM funding_opportunities
WHERE title ILIKE '%[program_name]%'
  AND (promotion_status IS NULL OR promotion_status != 'rejected');
```

If a match is found, move to "Already in DB" category. If in DB but not matching
the client, flag as a matching anomaly.

### 5.3 Source Backfill

For each unique source in the surviving findings, check `funding_sources`:

```sql
SELECT id, name FROM funding_sources WHERE name ILIKE '%[source_name]%';
```

Create missing sources via psql (batch INSERT with `ON CONFLICT DO NOTHING`).
This ensures Phase 2 extractors can look up `source_id` for each program.

### 5.4 Hand Off to Phase 2 Extractors

Spawn `program-discovery-agent` instances in extractor mode with the deduped
findings grouped into batches of ~20. The extractors will:
1. Visit each program URL
2. Extract structured fields using taxonomy values
3. Apply the three filter gates (applicant, activity, project type)
4. Dedup check against `funding_programs`
5. INSERT passing programs

Programs that fail the gates are filtered out at this step — with real page
content, not search summaries. This is the authoritative filter.

---

## 6. Phase 3 — Consolidated Report

After filtering and dedup, build the final report.

### 6.1 Categorize Findings

**Category 1 — New Findings (passed all 3 gates)**: Not in DB, passed three-gate
filter, appears to match client.

**Category 2 — Matching Anomalies**: Found in DB (matched dedup) but NOT in this
client's `client_matches`. Two sub-types:
- **2A — Should match**: Geographic and type alignment suggest it should match.
  Flag as possible matching gap.
- **2B — Search error**: On closer inspection, the program doesn't actually
  match the client (wrong geography, wrong type). The search agent was mistaken.

**Category 3 — Bonus Finds**: Doesn't match this client but looks valuable
for Meridian's other clients or future clients.

**Category 4 — Filtered Out**: Failed one or more gates. Listed with gate failure
reasons so the user can override if they disagree with the filtering.

### 6.2 Present Report

```
═══════════════════════════════════════════════════════════
CLIENT SCOUT REPORT: Environmental Charter Schools
═══════════════════════════════════════════════════════════

Search Summary:
  Waves completed: 5
  Total agents used: 30
  Unique new findings: [N]
  Already in DB: [N]
  Bonus finds: [N]

═══ CATEGORY 1: NEW MATCHES ([N] findings) ═══

  1. [Title] — [Source Name] ([Source Type])
     URL: [url]
     Funding type: [Grant/Incentive/Rebate]
     Status: [Open/Upcoming/Rolling/Unknown]
     Matched needs: [HVAC, Solar]
     Confidence: [high/medium]
     Why it matches: [brief reasoning]

  2. [Title] — [Source Name] ([Source Type])
     ...

═══ CATEGORY 2: MATCHING ANOMALIES ([N] findings) ═══

  A. [Title] (already in DB)
     Existing in Meridian: [matching title/URL]
     Issue: This should be matching but isn't — [reason]
     Suggested fix: [check coverage areas / check eligible_applicants / etc.]

═══ CATEGORY 3: BONUS FINDS ([N] findings) ═══

  i. [Title] — [Source Name]
     URL: [url]
     Best for: [description of who would benefit]

═══════════════════════════════════════════════════════════
SELECT findings from Category 1 to ingest (by number, e.g., "1, 3, 5-8")
or "none" to skip ingestion:
═══════════════════════════════════════════════════════════
```

### 6.3 User Approval Gate

Wait for user input. The user selects which Category 1 findings to ingest.
Parse their selection (e.g., "1, 3, 5-8" → findings 1, 3, 5, 6, 7, 8).

If user says "none", skip to summary and end.

---

## 7. Phase 4 — Selective Ingestion (Reverse Pipeline)

For each approved finding, execute the backfill + pipeline sequence.

### 7.1 Step 1 — Backfill Source

Check if the funding source already exists:

```sql
SELECT id, name FROM funding_sources
WHERE name ILIKE '%[source_name]%'
   OR website ILIKE '%[source_website_domain]%'
LIMIT 5;
```

**If found**: Use the existing source_id. Report: "Source '[name]' already exists (ID: [id])."

**If not found**: Create it via psql:

```sql
SET search_path TO public;
INSERT INTO funding_sources (id, name, type, website, state_code, description)
VALUES (
  gen_random_uuid(),
  '[source_name]',
  '[Utility/State/County/Municipality/Foundation/Federal]',
  '[website]',
  '[state_code]',
  'Discovered by Client Scout for [client_name]'
)
ON CONFLICT (name) DO UPDATE SET
  website = COALESCE(EXCLUDED.website, funding_sources.website),
  updated_at = NOW()
RETURNING id;
```

### 7.2 Step 2 — Backfill Program

Check if the program already exists under this source:

```sql
SELECT id, name FROM funding_programs
WHERE source_id = '[source_id]'
  AND (name ILIKE '%[program_name]%' OR name ILIKE '%[short_name]%')
LIMIT 5;
```

**If found**: Use the existing program_id.

**If not found**: Create it:

```sql
SET search_path TO public;
INSERT INTO funding_programs (id, source_id, name, program_urls, status, next_check_at, pipeline)
VALUES (
  gen_random_uuid(),
  '[source_id]',
  '[program_name]',
  '[{"url": "[main_url]", "label": "main"}, {"url": "[application_url]", "label": "application"}]'::jsonb,
  'unknown',
  NOW(),
  'manual'
)
RETURNING id;
```

### 7.3 Step 3 — Opportunity Discovery (Existing Agent)

Spawn the existing `opportunity-discovery-agent` via Task tool, scoped to just
this ONE program:

```
Task(
  subagent_type="opportunity-discovery-agent",
  prompt="Phase 3: Check if this ONE program has an open/upcoming opportunity.

          Program: [program_name]
          Program ID: [program_id]
          Source: [source_name]
          Source ID: [source_id]

          Program URLs:
          [list of URLs]

          SCOPE: Check ONLY this program. Do NOT crawl the source's entire catalog.

          If open/upcoming: Create ONE staging record in manual_funding_opportunities_staging.
          Use: discovery_method = 'client_scout'
               discovered_by = 'client-scout-[clientId]-[timestamp]'

          If closed but recurring (has historical rounds): Still create staging record.
          If defunct/discontinued with no future indication: Skip and report.

          Skill file: .claude/skills/opportunity-discovery/SKILL.md
          DB reads: mcp__postgres__query
          DB writes: source .env.local && psql \"$[ENV_VAR]\""
)
```

**If no staging record created** (program is defunct): Report to user and skip
remaining steps for this finding.

### 7.4 Steps 4-6 — Extraction → Analysis → Storage

After all approved findings have been through Step 3, run the pipeline phases
sequentially. Scope all queries by `discovered_by`:

```
-- Scoping filter for all phases:
WHERE discovered_by = 'client-scout-[clientId]-[timestamp]'
```

**Step 4 — Extraction**:
```
Task(
  subagent_type="extraction-agent",
  prompt="Phase 4: Extract staging records from the Client Scout run.

          Skill file: .claude/skills/extraction/SKILL.md
          Taxonomy file: lib/constants/taxonomies.js (MUST read before extraction)

          Query:
          SELECT * FROM manual_funding_opportunities_staging
          WHERE discovered_by = 'client-scout-[clientId]-[timestamp]'
            AND extraction_status = 'pending'
          ORDER BY id;

          DB reads: mcp__postgres__query
          DB writes: source .env.local && psql \"$[ENV_VAR]\""
)
```

**Step 5 — Analysis**:
```
Task(
  subagent_type="analysis-agent",
  prompt="Phase 5: Analyze extracted staging records from Client Scout.

          Skill file: .claude/skills/analysis/SKILL.md
          V2 reference files (MUST read before analysis):
            - lib/agents-v2/core/analysisAgent/contentEnhancer.js
            - lib/agents-v2/core/analysisAgent/scoringAnalyzer.js
          Taxonomy file: lib/constants/taxonomies.js

          Query:
          SELECT * FROM manual_funding_opportunities_staging
          WHERE discovered_by = 'client-scout-[clientId]-[timestamp]'
            AND extraction_status = 'complete'
            AND analysis_status = 'pending'
          ORDER BY id;

          DB reads: mcp__postgres__query
          DB writes: source .env.local && psql \"$[ENV_VAR]\""
)
```

**Step 6 — Storage**:
```
Task(
  subagent_type="storage-agent",
  prompt="Phase 6: Store analyzed records from Client Scout.

          REQUIRED — read these V2 reference files first:
            - lib/agents-v2/core/storageAgent/dataSanitizer.js
            - lib/services/locationMatcher.js
            - lib/agents-v2/core/storageAgent/utils/fieldMapping.js
          Skill file: .claude/skills/storage/SKILL.md

          Query:
          SELECT * FROM manual_funding_opportunities_staging
          WHERE discovered_by = 'client-scout-[clientId]-[timestamp]'
            AND analysis_status = 'complete'
            AND storage_status = 'pending'
          ORDER BY id;

          DB reads: mcp__postgres__query
          DB writes: source .env.local && psql \"$[ENV_VAR]\""
)
```

### 7.5 Post-Storage Summary

After all phases complete, report:

```
═══ INGESTION COMPLETE ═══

Records processed:
  Staging records created: [N]
  Extraction: [N] complete, [N] skipped, [N] error
  Analysis: [N] complete, [N] filtered (score < 2)
  Storage: [N] stored with promotion_status='pending_review'

New opportunities:
  1. [Title] → stored as [opportunity_id]
  2. [Title] → stored as [opportunity_id]

Next steps:
  - Review at /admin/review to approve/reject
  - Daily match computation will pick these up automatically
  - Or trigger manual recompute: POST /api/cron/compute-matches { opportunityIds: [...] }
```

---

## 8. Error Handling

- **Client not found**: Ask user to verify client name or provide client ID.
- **No utilities found**: Skip Wave 1, proceed with other waves.
- **Search wave returns 0 findings**: Log and continue to next wave. Report in summary.
- **All waves return 0 findings**: Report "No new opportunities found" with search stats.
- **Source/program backfill fails**: Skip that finding, report error, continue with others.
- **Extraction/analysis/storage fails**: Standard pipeline error handling (mark as `error` in staging, continue batch).
- **Agent spawn fails**: Report error, try remaining findings individually.

---

## 9. Guardrails

- **Never auto-ingest** — always present the report and wait for user approval.
- **Never write during search** — search agents are read-only. Only Phase 4 writes.
- **Environment must be explicit** — never assume production.
- **Scope ingestion agents** — always use the `discovered_by` filter to isolate scout records.
- **One program at a time** — opportunity discovery checks ONE program, not the source catalog.
- **Respect existing pipeline skills** — extraction, analysis, and storage agents use their
  existing skills unchanged. Do not override or shortcut their processes.
