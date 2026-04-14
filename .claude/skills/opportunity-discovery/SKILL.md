---
name: opportunity-discovery
description: >
  Phase 3 of the manual funding pipeline. Crawls program URLs to check
  for open or upcoming application windows. REPORTS findings to the
  orchestrator (single-writer pattern — checkers do NOT write to the
  database). The orchestrator validates and creates staging records.
  Designed to be run by Agent Team teammates.
---

# Opportunity Discovery — Phase 3

## 0. Before You Start (REQUIRED)

Read this entire skill file before doing any work. Understand:
1. **The Decision Tree** (Section 4) — it determines every action you take
2. **Content Retrieval Standard** (Section 0a) — how to fetch pages and PDFs
3. **Funding Status Assessment** (Section 3g) — REQUIRED for every program
4. **Report Format** (Section 7) — what the orchestrator needs from you

Unlike Phase 2, you do NOT need to read the taxonomy file. Phase 3 does not
assign categories or activities — those already exist on the program from Phase 2.

## CRITICAL: DO NOT WRITE TO THE DATABASE

You are a **reporter**, not a writer. Your job is to crawl program URLs, assess
application status, assess funding status, and report findings to the orchestrator
via SendMessage. The orchestrator validates and creates staging records.

- **DO NOT** run INSERT statements against `manual_funding_opportunities_staging`
- **DO NOT** run UPDATE statements on `funding_programs` scheduling fields
- **DO** use `mcp__postgres__query` for READ-ONLY queries (pre-flight, URL lookups)
- **DO** send your complete findings to the team lead via SendMessage

---

## 0a. Content Retrieval Standard

Use this decision tree for ALL URL fetching.

### HTML Pages — Detection-Based Routing

```
1. Try WebFetch(url)

2. Read the response. Route based on what you see:

   a) Content looks complete (body text > 500 chars, has program details)
      → DONE. Use this content.

   b) HTTP 403, or response contains "Access Denied" / "edgesuite" / "Akamai"
      → Akamai bot protection. Try:
        curl -sL -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
             AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
             -H "Accept: text/html" -H "Accept-Language: en-US,en" --compressed "URL"
        If curl also returns 403 → use Playwright:
          mcp__playwright__browser_navigate(url) + browser_snapshot()

   c) Response is small (< 500 chars body) with <script> tags referencing
      CMS frameworks ("civicplus", "requirejs", "vision-cms", "granicus")
      → JS-rendered CMS. Try curl with User-Agent header (same as above).
        If curl returns same thin content → use Playwright.

   d) Response contains "Just a moment" / "Checking your browser" / "cf-"
      → Cloudflare challenge. Skip curl, go directly to Playwright.

   e) curl with headers also returns 403 AND Playwright also fails
      → FLAG as unreachable. Never silently skip.
```

### PDF Documents

**Never use WebFetch for PDFs.** Always use curl piped to PyMuPDF:

```bash
curl -sL -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "PDF_URL" | python3 -c "
import sys, fitz
doc = fitz.open(stream=sys.stdin.buffer.read(), filetype='pdf')
for page in doc: print(page.get_text())
"
```

**Guards**: Always include User-Agent. Skip > 10MB. First 20 pages for > 50 page PDFs.
If 403 even with UA, try temp file download then process. Verify output is PDF not HTML.

### Login-Gated Pages

Flag as "Requires login, could not crawl" — skip entirely.

### Crawling Depth

- **Level 0**: Fetch the program URL from `program_urls`
- **Level 1**: Follow "Apply", "Application", "NOFA", "RFP", "Guidelines" links
- **Level 2**: Sub-pages with dates/deadlines
- **MAX 2 levels**. Flag deeper content for manual review.

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

### Step 3c — Follow Application Links AND Open PDFs (1-2 Levels Deep)

Don't stop at the program page. Follow links that suggest application info:
- Links containing: "Apply", "Application", "Current Opportunities", "Guidelines",
  "NOFA", "RFP", "Request for Proposals", "Funding Available", "How to Apply"
- **PDF links** (application guides, program handbooks, NOFAs, RFPs, QAPs)
- Links to application portals or submission systems

**CRITICAL — PDF Requirement**: Government agencies frequently publish deadlines,
application windows, and program details ONLY inside PDF documents (RFPs, NOFOs,
application handbooks, QAPs), not on the HTML page. You **MUST**:

1. **Identify ALL PDF links** on the program page (look for `.pdf` in URLs, or links
   labeled "RFP", "NOFO", "Application", "Guidelines", "Handbook", "RFA")
2. **Open at least the most recent/relevant PDF** using the Content Retrieval Standard
   (Section 0a). Prioritize PDFs with current-year dates in the filename or label
   (e.g., "2026 RFP", "FY2026 Application", "FY26 NOFO")
3. **Extract dates from the PDF** — look for: deadline dates, application periods,
   "due by", "submit by", "LOI due", "full application due", "open date", "close date"
4. **If the HTML page says "nothing found" but a linked PDF contains dates**, the PDF
   takes precedence — create a staging record based on the PDF content

**Do NOT report "nothing found" if you haven't checked linked PDFs.** A program page
that links to an RFP/NOFO PDF that you didn't open is an incomplete check. The only
acceptable skip is when there are genuinely no PDF links on the page, or all PDFs are
from prior years with no current-year document available.

**Depth limit**: 2 levels from the program page. Flag anything deeper.

### Step 3d — Completeness Check (Before Moving On)

Before concluding "nothing found" for a program, verify you have completed ALL of these:

- [ ] Fetched the main program page HTML
- [ ] Checked for open/upcoming indicators in the HTML text
- [ ] Identified any linked PDFs (RFP, NOFO, application, guidelines, handbook)
- [ ] **Opened the most recent PDF** and checked for dates/deadlines inside it
- [ ] Followed "Apply" / "Application" links to check portals or sub-pages

If you skipped any of these steps, go back. The most common miss is skipping the PDF
check — government grant deadlines live inside PDFs more often than on HTML pages.

### Step 3e — Supplementary Web Search (If URLs Insufficient)

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

### Step 3f — Funding Status Assessment (REQUIRED)

For EVERY program you check — whether Open, Upcoming, or Nothing — you MUST assess
the funding status. This is not optional. The orchestrator needs this to set the
`funding_status` and `funding_note` fields on the opportunity.

**Scan the page for these signals:**

**VERIFIED_ACTIVE** — explicit evidence the program is currently funded and accepting:
- "Apply Now" / "Submit Application" buttons with current-year dates
- "Applications are being accepted" with current fiscal year reference
- Active application portal (Formstack, ZoomGrants, eCivis) that loads
- Recently posted NOFA/RFP with current dates

**PRESUMED_ACTIVE** — default when nothing concerning is found:
- Program is listed on the source's catalog/grants page
- No closure, exhaustion, or waitlist language found
- Page hasn't been updated recently but nothing says "closed"

**LIMITED_FUNDING** — known finite pool that could exhaust:
- Mentions a specific dollar pool ("$1.8M WIFA grant", "$5M program")
- "First-come, first-served" / "until funds are exhausted"
- "Limited funding available" / "subject to availability"

**OVERSUBSCRIBED** — demand signals suggest funding is tight:
- "Waitlist" / "applications processed as funding allows"
- "Not accepting new applications at this time" (without permanent closure)
- "Program is currently paused" / "check back for next cycle"
- "High demand" / "oversubscribed" language

**EXHAUSTED** — ONLY set when DEFINITIVE (do not speculate):
- "All funds awarded for this cycle"
- "Program closed" / "no longer accepting applications"
- "Funding has been fully allocated"
- Application portal explicitly disabled with closure message

**Your report MUST include for each program:**
```
  funding_status: verified_active / presumed_active / limited_funding / oversubscribed / exhausted
  funding_note: "[one sentence, max 150 chars, with evidence from the page]"
```

If you cannot determine the funding status because the page was unreachable,
say: `funding_status: presumed_active` / `funding_note: "Page unreachable — status unverified"`

### Step 3f-2 — Application Window Type Assessment (REQUIRED)

Also assess the application window type for each program:

**DATED** — has specific open and close dates:
- "Applications open January 15, close March 31"
- A published NOFA with explicit deadline

**ROLLING** — perpetual, no application window:
- "Applications accepted on a rolling basis"
- "Open until funds are exhausted"
- "Apply anytime" / no deadline mentioned anywhere
- Rebate programs with no cycle (first-come-first-served)

**CYCLE_BASED** — has known recurring cycles but specific dates may not be captured:
- "Annual application cycle" / "FY2027 round expected fall 2026"
- "Applications typically open in October"
- Program has a history of annual/biennial rounds

**Your report MUST include:**
```
  window_type: dated / rolling / cycle_based
```

### Step 3g — URL Failure Cascade

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

## 5. Report Format (What the Orchestrator Needs)

Since you are a reporter (not a writer), your output is a structured report
sent via SendMessage to the team lead. The orchestrator uses this to write
staging records and update program scheduling.

### Per-Program Report Fields (ALL REQUIRED)

```
PROGRAM: [Program Name]
  program_id: [UUID]
  source_id: [UUID]
  source_name: [Name]

  status: Open / Upcoming / Nothing
  window_type: dated / rolling / cycle_based
  open_date: [YYYY-MM-DD or null]
  close_date: [YYYY-MM-DD or null]
  application_url: [URL of the actual apply page, if different from program page]

  funding_status: verified_active / presumed_active / limited_funding / oversubscribed / exhausted
  funding_note: "[max 150 chars — evidence from the page for your funding_status call]"

  has_details: true / false  (does the page have substantive program details or just an announcement?)
  guidelines_url: [URL of NOFA/RFP/guidelines PDF, if found]

  suggested_next_check: [YYYY-MM-DD]
  next_check_reason: "[why this date]"

  new_urls_found: [list of any new URLs discovered that should be added to program_urls]
  flags: [any concerns, unreachable URLs, stale content, etc.]
```

### Suggested Recheck Schedule (for `suggested_next_check`)

| Situation | Suggested Date | Reason |
|---|---|---|
| Open, dated (has close date) | close_date | Check for next round after this one closes |
| Open, rolling | NOW + 90 days | Recheck funding status periodically |
| Upcoming, details available | open_date - 7 days | Final confirmation before it opens |
| Upcoming, NO details yet | NOW + 30 days | Monthly check until NOFA/details published |
| Cycle-based, know typical month | typical_month - 60 days | Check 2 months early for NOFA |
| Nothing found | NOW + 30 days | Try again next month |
| All URLs failed | NULL (mark inactive) | Stop checking until manually re-enabled |

**Key principle for upcoming programs:** We want the details as early as possible,
not just before the window opens. If we discover in January that a program opens
in August but has no NOFA yet, check monthly until the NOFA appears. Once the NOFA
is published, stage it immediately — don't wait until August.

### What the Orchestrator Does With Your Report

The orchestrator (not you) will:
1. **Dedup check**: Does a staging record or funding_opportunity already exist for this program_id?
   - If a rolling opportunity already exists with the same source_hash → skip (just update verified_at)
   - If dated and the dates are different → new round, create staging record
2. **INSERT staging record** with your reported fields + the new funding status fields
3. **UPDATE program scheduling** (last_checked_at, next_check_at)
4. **Log** to claude_change_log

---

## 6. Program Scheduling Updates

The orchestrator handles scheduling updates based on your report. Include your
`suggested_next_check` and `next_check_reason` in every per-program report.

Reference table for suggested dates:

| Outcome | Suggested `next_check_at` | Reason |
|---------|---------------------------|--------|
| Open, dated (has close date) | `close_date` | Check for next round after this one closes |
| Open, rolling | `NOW() + 90 days` | Periodic funding status recheck |
| Upcoming, details available | `open_date - 7 days` | Final confirmation before window opens |
| Upcoming, NO details yet | `NOW() + 30 days` | Monthly check until NOFA/details published |
| Cycle-based, know typical month | `typical_month - 60 days` | Early check for NOFA publication |
| Nothing found | `NOW() + 30 days` | Try again next month |
| All URLs failed | `NULL` (mark inactive) | Stop checking |

**Key principle:** We want opportunity details as early as possible. If we learn
in January that a program opens in August but has no NOFA yet, suggest monthly
rechecks (not a single check 7 days before August). Once the NOFA is published,
the orchestrator stages it immediately.

**For rolling programs:** The orchestrator will check whether a funding_opportunity
already exists for this program_id before creating a new staging record. If one
exists with the same source_hash, it just updates `funding_verified_at` without
re-staging.

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
