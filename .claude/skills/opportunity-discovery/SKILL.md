---
name: opportunity-discovery
description: >
  Phase 3 of the manual funding pipeline. Crawls program URLs to check
  for open or upcoming application windows. Creates staging records for
  opportunities found and updates smart scheduling on funding_programs.
  Designed to be run by Agent Team teammates or standalone via Task tool.
---

# Opportunity Discovery — Phase 3

## 0. Before You Start (REQUIRED)

Read this entire skill file before doing any work. Understand:
1. **The Decision Tree** (Section 4) — it determines every action you take
2. **Content Retrieval Standard** (Section 0a) — how to fetch pages and PDFs
3. **SQL Templates** (Section 5) — exact INSERT/UPDATE patterns

Unlike Phase 2, you do NOT need to read the taxonomy file. Phase 3 does not
assign categories or activities — those already exist on the program from Phase 2.

---

## 0a. Content Retrieval Standard

Use this decision tree for ALL URL fetching.

### HTML Pages (~70% of URLs)

```
1. WebFetch(url)
   → If content looks complete (has program details, not just nav/headers) → DONE
2. If WebFetch returns empty/minimal/garbled content (JS-rendered page):
   → Playwright: mcp__playwright__browser_navigate(url) + browser_snapshot()
3. If Playwright also fails:
   → FLAG as "JS-rendered, could not extract" — never silently skip
```

### PDF Documents (~10% of URLs)

**Do NOT use WebFetch for PDFs** — it returns garbled binary.

```bash
# Pipe directly — zero temp files
curl -sL "PDF_URL" | python3 -c "
import sys, fitz
doc = fitz.open(stream=sys.stdin.buffer.read(), filetype='pdf')
for page in doc: print(page.get_text())
"
```

**Guards**:
- Check `Content-Length` header first. Skip if > 10MB (flag for manual review)
- For PDFs > 50 pages, extract first 20 pages only (add `if page.number < 20` guard)
- If curl gets a 403: retry with `curl -sL -H "User-Agent: Mozilla/5.0" "URL"`
- If PDF is password-protected or encrypted: flag and skip

### Login-Gated Pages (~5%)

Flag as "Requires login, could not crawl" — skip entirely. Do not guess content.

### Crawling Depth

Each "level" is a separate WebFetch call. Agents must identify links in returned
content and fetch them individually:
- **Level 0**: Fetch the program URL from `program_urls`
- **Level 1**: Follow links containing "Apply", "Application", "NOFA", "RFP", "Guidelines"
- **Level 2**: If a Level 1 page references sub-pages with dates/deadlines, fetch those
- **MAX 2 levels**. Flag deeper content for manual review.

### Fallback Chain (All Modes)

When the primary method fails, try in order — never silently skip:
```
WebFetch → Playwright (headless) → FLAG for manual review
```
Always log what failed and why in your report.

---

## 1. Mission

Check whether programs are currently accepting applications or will be soon.
A missed open opportunity means a missed deadline for our clients — thoroughness
is non-negotiable.

**What Phase 3 answers**: "Is this program accepting applications right now?"

**Key concept**: Phase 2 stored programs with their URLs. Phase 3 crawls those
SAME URLs — but with a different goal: not "what is this program?" (Phase 2's job)
but "is this program accepting applications right now, or will it soon?"

**Inputs** (provided by orchestrator or standalone prompt):
- Scope filter: state, source type, specific source, or "all due programs"
- Database connection variable (e.g., `$DEV_CLAUDE_URL`)

**Outputs**:
- Staging records in `manual_funding_opportunities_staging` for Open/Upcoming opportunities
- Updated `last_checked_at` and `next_check_at` on each checked program
- Summary report: open/upcoming/skipped/inactive counts and any flags

---

## 2. Pre-Flight

Run these steps BEFORE crawling any programs.

### Step 2a — Auto-Close Expired Opportunities

```sql
-- Run via psql
UPDATE funding_opportunities
SET status = 'Closed'
WHERE status = 'Open'
  AND close_date < NOW()
  AND close_date IS NOT NULL;
```

This opens the NOT EXISTS gate for programs whose opportunities just closed,
allowing them to be checked for new rounds.

### Step 2b — Smart Scheduling Query (Get Eligible Programs)

```sql
-- Run via mcp__postgres__query
SELECT fp.id, fp.name, fp.description, fp.program_urls,
       fp.status as program_status, fp.next_check_at, fp.last_checked_at,
       fp.source_id, fs.name as source_name, fs.state_code, fs.type
FROM funding_programs fp
JOIN funding_sources fs ON fs.id = fp.source_id
WHERE fp.status IN ('active', 'unknown')
  AND fp.next_check_at <= NOW()
  -- Scope filter: replace or remove these as needed
  -- AND fs.state_code = 'AZ'
  -- AND fs.type = 'Utility'
  -- AND fs.id = 'specific-source-uuid'
  AND NOT EXISTS (
    SELECT 1 FROM funding_opportunities fo
    WHERE fo.status = 'Open'
    AND fo.close_date IS NOT NULL              -- perpetual (no close_date) stays recheckable
    AND (
      fo.program_id = fp.id                    -- manual pipeline (has program_id)
      OR (fo.funding_source_id = fp.source_id  -- API pipeline (no program_id)
          AND fo.title ILIKE '%' || fp.name || '%')
    )
  )
ORDER BY fp.source_id, fp.name;
```

**Key logic**:
- `status IN ('active', 'unknown')` — check both. `unknown` is treated as active.
- `next_check_at <= NOW()` — only check programs that are due
- `NOT EXISTS ... status = 'Open' AND close_date IS NOT NULL` — skip programs that already
  have a dated open opportunity (from either manual or API pipeline). Perpetual opportunities
  (no close_date) do NOT block re-checking — they get rechecked every 180 days.
  Closed/Upcoming don't block re-checking.

### Step 2c — Report Pre-Flight Results

Before crawling, report to the team lead (or user if standalone):
```
Pre-flight complete:
- Auto-closed: X opportunities
- Programs eligible for checking: Y
- Scope: [state/type/source filter applied]
```

If zero programs are eligible, report this and stop.

---

## 3. Crawling Process (Per Program)

For EACH program returned by the smart scheduling query:

### Step 3a — Crawl Program URLs

1. Parse the program's `program_urls` JSONB array
2. Fetch each URL using Content Retrieval Standard (Section 0a)
3. **Prioritize** URLs of type `"application"` or `"main"` first

### Step 3b — Search for Application Status

On each fetched page, look for:

**Open indicators**:
- "Apply Now", "Submit Application", "Application Open"
- Active application portals or forms
- Current deadline dates (close dates in the future)
- "Applications accepted on a rolling basis" / "Open until funds are exhausted"

**Upcoming indicators**:
- "Coming soon", "Applications will open on [date]"
- "Next round begins [date]"
- "NOFA expected [date/period]"
- Published guidelines/handbook for an upcoming round

**Closed/No opportunity indicators**:
- "Applications closed", "Deadline passed"
- "Check back for future rounds"
- No mention of applications anywhere on the page
- Only historical/past round information

**Key things to extract when found**:
- **Open date** (when applications open/opened)
- **Close date** (application deadline)
- **Application URL** (the actual "Apply" link if different from program page)
- **Guidelines URL** (program handbook, NOFA, RFP document)
- **Funding amount** (if visible: per-project, total pool)

### Step 3c — Follow Application Links (1-2 Levels Deep)

Don't stop at the program page. Follow links that suggest application info:
- Links containing: "Apply", "Application", "Current Opportunities", "Guidelines",
  "NOFA", "RFP", "Request for Proposals", "Funding Available", "How to Apply"
- PDF links (application guides, program handbooks, NOFAs)
- Links to application portals or submission systems

**Depth limit**: 2 levels from the program page. Flag anything deeper.

### Step 3d — Supplementary Web Search (If URLs Insufficient)

If program URLs don't clearly indicate application status:

```
Search: "[program name] application 2026"
Search: "[source name] [program name] apply"
Search: "[program name] NOFA 2026"
```

Look for:
- Government gazette notices (NOFAs, RFPs)
- Press releases about new funding rounds
- Third-party sites reporting on open opportunities

### Step 3e — URL Failure Cascade

If a program URL returns 404, timeout, or unusable content:

1. **Try other URLs** in the `program_urls` array (there may be 2-3)
2. **Fall back to catalog pages**: Query `source_program_urls` for this source,
   re-crawl catalog to find updated program URL
   ```sql
   -- Run via mcp__postgres__query
   SELECT url, label FROM source_program_urls
   WHERE source_id = 'source-uuid-here';
   ```
3. **Web search**: `"[source name] [program name]"`
4. **If new URL found**: Update the program's URLs
   ```sql
   -- Run via psql
   UPDATE funding_programs
   SET program_urls = program_urls || '[{"url": "NEW_URL", "type": "main", "notes": "Updated by Phase 3 - old URL was dead"}]'::JSONB
   WHERE id = 'program-uuid-here';
   ```
5. **If ALL URLs fail**: Mark program as inactive
   ```sql
   -- Run via psql
   UPDATE funding_programs
   SET status = 'inactive',
       last_checked_at = NOW(),
       next_check_at = NULL
   WHERE id = 'program-uuid-here';
   ```
   Log: "All URLs failed for [program name]. Marked inactive."

---

## 4. Decision Tree

After crawling, apply this decision tree for EACH program:

| # | Finding | Has Guidelines? | Date Known? | Action | `next_check_at` |
|---|---------|----------------|-------------|--------|-----------------|
| 1 | **Open**, has close date | n/a | Yes | INSERT staging | `close_date` |
| 2 | **Open**, perpetual (no close date) | n/a | n/a | INSERT staging | `NOW() + 180 days` |
| 3 | **Upcoming**, substantive guidelines | n/a | Yes (open date known) | INSERT staging | `open_date - 30 days` |
| 4 | **Upcoming**, substantive guidelines | Yes | No (no open date) | SKIP | `NOW() + 30 days` |
| 5 | **Upcoming**, no/thin guidelines | Either | Either | SKIP | `NOW() + 30 days` |
| 6 | **Nothing found** | n/a | n/a | SKIP | `NOW() + 30 days` |

### Definitions

**"Open"**: The program is currently accepting applications. There is an active
application process — a form, portal, submission mechanism, or explicit statement
that applications are being accepted.

**"Perpetual"**: Open with no close date. Examples: "rolling basis", "until funds
exhausted", "accepted year-round", no deadline mentioned anywhere.

**"Upcoming"**: The program has announced a future application round but is not
yet accepting applications.

**"Substantive guidelines"**: A published document or page that contains REAL
program details — eligibility criteria, funding amounts, application process,
project types, evaluation criteria. NOT just "coming soon" or "check back later"
or a one-line announcement.

**"Date known"**: A specific open date is published (e.g., "Applications open
March 1, 2026"). Vague timeframes like "summer 2026" or "Q3" are NOT considered
known dates — treat as "date not known" (Row 4).

### Re-Check Scenarios

When `next_check_at` arrives for a Row 3 program (upcoming with date):
- If the program is now **Open**: INSERT a NEW staging record, set `next_check_at = close_date`
- If still **Upcoming**: SKIP, set `next_check_at = open_date - 15 days` (tighter check)
- If it disappeared: SKIP, set `next_check_at = NOW() + 30 days`

### Why These Rules

- **Row 1-2**: Open opportunities are actionable — clients can apply now
- **Row 3**: Upcoming with real details lets us pre-populate the pipeline so
  clients know what's coming. We re-check near the open date to confirm.
- **Row 4-5**: Without a date or without real guidelines, there's nothing
  actionable. Check again next month.
- **Row 6**: Nothing found doesn't mean nothing exists — just check again later.
- **Perpetual = 180 days**: These don't change often; 6-month check is sufficient.

---

## 5. SQL Templates

### INSERT Staging Record

```sql
-- Run via psql
INSERT INTO manual_funding_opportunities_staging (
  id,
  program_id,
  source_id,
  title,
  url,
  program_urls,
  content_type,
  discovery_method,
  discovered_by,
  extraction_status,
  analysis_status,
  storage_status
) VALUES (
  gen_random_uuid(),
  'PROGRAM_UUID',
  'SOURCE_UUID',
  'OPPORTUNITY_TITLE',
  'PRIMARY_APPLICATION_URL',
  'PROGRAM_URLS_JSONB'::JSONB,
  'opportunity',
  'phase3_crawl',
  'opportunity-discovery-agent',
  'pending',
  'pending',
  'pending'
);
```

**Field notes**:
- `title`: Use format "[Program Name] - [Year/Round]" if round info available,
  otherwise just the program name
- `url`: The most specific application-related URL found (application page > program page)
- `program_urls`: Copy of `funding_programs.program_urls` at discovery time — carry
  through pipeline so downstream agents have URL context
- `content_type`: Always `'opportunity'` for Phase 3 records
- `discovery_method`: Always `'phase3_crawl'`
- All status fields start as `'pending'` — Phase 4/5/6 will process them
- **No ON CONFLICT** — staging is a pure processing inbox. Each check round creates
  a new record. Smart scheduling prevents duplicate checks for the same window.

### UPDATE Program Scheduling

```sql
-- Run via psql
UPDATE funding_programs
SET last_checked_at = NOW(),
    next_check_at = 'CALCULATED_DATE'::TIMESTAMPTZ
WHERE id = 'PROGRAM_UUID';
```

Replace `CALCULATED_DATE` per the Decision Tree (Section 4):
- Row 1: The opportunity's close date
- Row 2: `NOW() + INTERVAL '180 days'`
- Row 3: The opportunity's open date minus 30 days
- Row 4-6: `NOW() + INTERVAL '30 days'`

### UPDATE Program URLs (When New URL Found)

```sql
-- Run via psql
UPDATE funding_programs
SET program_urls = program_urls || '[{"url": "NEW_URL", "type": "application", "notes": "Found by Phase 3 crawl"}]'::JSONB
WHERE id = 'PROGRAM_UUID';
```

### Mark Program Inactive (All URLs Failed)

```sql
-- Run via psql
UPDATE funding_programs
SET status = 'inactive',
    last_checked_at = NOW(),
    next_check_at = NULL
WHERE id = 'PROGRAM_UUID';
```

---

## 6. Program Scheduling Updates

EVERY program checked gets scheduling updates, regardless of outcome:

| Outcome | `last_checked_at` | `next_check_at` |
|---------|-------------------|-----------------|
| Open, has close date | `NOW()` | `close_date` |
| Open, perpetual | `NOW()` | `NOW() + 180 days` |
| Upcoming, with date | `NOW()` | `open_date - 30 days` |
| Upcoming, no date | `NOW()` | `NOW() + 30 days` |
| Nothing found | `NOW()` | `NOW() + 30 days` |
| All URLs failed | `NOW()` | `NULL` (inactive) |

**Always update `last_checked_at`** — even for skipped programs. This provides
an audit trail of when each program was last reviewed.

---

## 7. Output Report

### Per-Program Report (During Processing)

Log each program as you go:
```
[1/N] Program: [Program Name] (source: [Source Name])
  URLs checked: 3
  Finding: Open — close date 2026-06-30
  Action: INSERT staging record
  next_check_at: 2026-06-30

[2/N] Program: [Program Name] (source: [Source Name])
  URLs checked: 2
  Finding: Nothing found
  Action: SKIP
  next_check_at: 2026-03-14 (NOW + 30 days)
```

### Summary Report (At End)

```
=== OPPORTUNITY DISCOVERY REPORT ===
Scope: [state/type/source]
Programs checked: X

Results:
  Open opportunities found:     Y (staging records created)
  Upcoming opportunities found: Z (staging records created)
  Skipped (nothing found):      A
  Skipped (upcoming, no date):  B
  Skipped (upcoming, no guidelines): C
  Marked inactive (URLs dead):  D

Staging records created: Y + Z total
  Extraction pipeline: all set to pending

Programs with updated URLs: E
  [list program names where URLs were updated]

Flags:
  - [any login-gated pages]
  - [any ambiguous findings]
  - [any programs needing manual review]

Next check dates set:
  - Earliest: [date] ([program name])
  - Latest: [date] ([program name])
```

---

## 8. Error Handling

| Situation | Action |
|-----------|--------|
| Program URL returns 404 | Follow URL Failure Cascade (Section 3e). Try other URLs, catalog, web search. If all fail → inactive |
| Page is JS-rendered/empty via WebFetch | Playwright fallback (`browser_navigate` + `browser_snapshot`). If still empty, flag |
| Login-gated page | Flag: "Requires login". Skip — do NOT guess application status |
| Rate limited (429) | Wait 15 seconds, retry once. If persistent, move to next program, come back later |
| PDF link returns 404 or encrypted | Flag as inaccessible, continue with web page data |
| Ambiguous status | If you can't tell whether applications are open or closed, treat as "Nothing found" (Row 6). Note the ambiguity in flags. Do NOT guess. |
| Program page has moved (redirect) | If redirect goes to a valid program page, use the new URL and update `program_urls`. If redirect goes to a generic page, treat as URL failure. |
| Close date in the past | This is a **closed** opportunity, not open. Treat as "Nothing found" unless there's also a new/upcoming round. |
| Open date already passed | If open date is in the past and no close date found, treat as perpetual (Row 2). |
| psql INSERT fails | Log full error, continue to next program. Include in error count. |
| Multiple opportunities for one program | Rare but possible (e.g., two open rounds). Create a staging record for EACH. |

---

## 9. Database Reference

### Tables Read

| Table | Purpose | Tool |
|-------|---------|------|
| `funding_programs` | Programs to check, their URLs, scheduling | `mcp__postgres__query` |
| `funding_sources` | Source metadata (name, state, type) | `mcp__postgres__query` |
| `funding_opportunities` | NOT EXISTS check for open opportunities | `mcp__postgres__query` |
| `source_program_urls` | Fallback catalog URLs for URL failures | `mcp__postgres__query` |

### Tables Written

| Table | Operation | Tool |
|-------|-----------|------|
| `manual_funding_opportunities_staging` | INSERT new staging records | `psql` via Bash |
| `funding_programs` | UPDATE scheduling, URLs, status | `psql` via Bash |
| `funding_opportunities` | UPDATE auto-close (pre-flight) | `psql` via Bash |

### Connection

- **Reads**: `mcp__postgres__query` (read-only MCP tool — use raw SQL strings)
- **Writes**: `psql "$DEV_CLAUDE_URL"` via Bash (default). Orchestrator may set
  `$STAGING_CLAUDE_URL` or `$PROD_CLAUDE_URL`.

### Key Constraints

- `manual_funding_opportunities_staging` has NO unique constraints (except UUID PK).
  Each check round creates a new record. No ON CONFLICT needed.
- `funding_programs.program_urls` is JSONB — use `||` operator to append, not replace
- `claude_writer` role has INSERT, SELECT, UPDATE — no DELETE
- Always use the environment variable provided by the orchestrator for writes

---

## 10. Agent Team Protocol

### When Spawned as a Teammate

1. **Receive assignment**: List of programs (with IDs, URLs, source info) from team lead
2. **Read this skill file**: Understand the full process
3. **Process each assigned program**: Follow Sections 3-6
4. **Report results** to team lead using the Summary Report format (Section 7)
5. **Wait for shutdown** or additional assignments

### Workload

- **~10-15 programs per teammate** (depending on URL count per program)
- Programs are grouped by source (all programs from one source go to one teammate)
- This keeps catalog fallback lookups efficient (shared source_program_urls)

### Message Format to Team Lead

```
Completed [N] programs for [Source Name]:

Open: X (staging records created)
  - [Program Name] — closes [date]
  - [Program Name] — perpetual
Upcoming: Y (staging records created)
  - [Program Name] — opens [date], guidelines at [url]
Skipped: Z
  - [Program Name] — nothing found
  - [Program Name] — upcoming but no date
Inactive: W (URLs dead)
  - [Program Name]

Flags: [any issues]
```

### Standalone Mode

When run directly via Task tool (not as a teammate):
1. Run pre-flight yourself (Section 2)
2. Process all eligible programs matching the scope
3. Return the full Summary Report as your task result

### Important: Use the Environment Variable from the Orchestrator

The orchestrator will set the database environment variable in your prompt
(e.g., `$DEV_CLAUDE_URL`, `$STAGING_CLAUDE_URL`, or `$PROD_CLAUDE_URL`).
Always use that variable for psql writes. Never hardcode connection strings.
