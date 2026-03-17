---
name: program-discovery
description: >
  Phase 2 of the manual funding pipeline. Crawls source catalog URLs
  to discover individual funding programs, extracts structured program
  data, and registers programs in funding_programs. Supports two modes:
  Scout (find program URLs) and Extractor (extract data + store).
  Designed to be run by Agent Team teammates or standalone via Task tool.
---

# Program Discovery — Phase 2

## 0. Before You Start (REQUIRED)

Read these files before any scout or extractor work:

1. **`lib/constants/taxonomies.js`** — Contains the EXACT valid values for:
   - `ELIGIBLE_ACTIVITIES` (hot/strong/mild tiers = filter gate values)
   - `CATEGORIES` (Primary/Secondary/Tertiary)
   - `ELIGIBLE_PROJECT_TYPES` (hot/strong/mild/weak tiers)
   You MUST use exact values from this file. Do NOT invent values outside the taxonomy.
2. **This skill file** (you're reading it now) — for process, SQL templates, and report format.

If unsure about a value, map to the closest taxonomy match. Never fabricate categories or activities.

---

## 0a. Content Retrieval Standard

Use this decision tree for ALL URL fetching in both scout and extractor modes.

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

### Crawling Depth (Scouts)

Each "level" is a separate WebFetch call. Agents must identify links in returned
content and fetch them individually:
- **Level 0**: Fetch the assigned catalog URL
- **Level 1**: Parse content for program links, WebFetch each one
- **Level 2**: If a Level 1 page references sub-pages, fetch those too
- **MAX 2 levels**. Flag deeper content for manual review.

### Fallback Chain (All Modes)

When the primary method fails, try in order — never silently skip:
```
WebFetch → Playwright (headless) → FLAG for manual review
```
Always log what failed and why in your report.

---

## 1. Mission

Discover every funding program offered by registered sources. A missed program
means missed opportunities for our clients — thoroughness is non-negotiable.

Phase 2 operates in two rounds:
- **Round 1 (Scout)**: Crawl catalog URLs to find individual program pages
- **Round 2 (Extractor)**: Visit program pages, extract structured data, write to database

The orchestrator spawns scouts first, collects and merges their results, then
spawns extractors with deduplicated program assignments.

**Inputs** (provided by the orchestrator):
- `source_id(s)` — UUID(s) of funding sources to process
- `catalog_urls` — from `source_program_urls` table
- `type` — for taxonomy guidance
- `state_code` — for search queries
- `mode` — "scout" or "extractor" (detected from prompt)

**Outputs**:
- Scout mode: list of discovered programs with URLs, types, and confidence levels
- Extractor mode: programs written to `funding_programs` table with all fields populated
- Summary report: counts of new, updated, skipped programs and any flags

---

## 2. Scout Mode Instructions

Scouts crawl assigned catalog URLs to find individual program pages. Each scout
receives one or more catalog URLs from the orchestrator and reports back a list
of programs found.

### Process

1. **WebFetch each assigned catalog URL**
2. **Parse page content** — look for links to individual programs:
   - Navigation menus with program listings
   - Tables or cards listing rebates/incentives
   - "View all programs" or "See details" links
   - Sidebar navigation with program categories
   - **Check for cross-domain redirects**: If the final URL domain differs from the
     source's expected domain, flag it as `REDIRECT: [expected domain] → [actual domain]`.
     This indicates a broken link or misconfigured CMS — do not treat content from the
     redirected domain as belonging to this source.
3. **Follow links 1 level deep** (catalog page -> program page):
   - Click into each program link to confirm it is a real program page
   - Verify the page has program-specific content (not just marketing copy)
4. **Identify programs using taxonomy categories**:
   - Energy programs: rebates, incentives, efficiency programs
   - Water programs: conservation, recycling incentives
   - Sustainability: renewable energy, solar, EV charging
   - Infrastructure: building upgrades, weatherization
   - Housing: home improvement, low-income assistance
   - Transportation: EV rebates, fleet conversion programs
5. **For each program found, capture**:

| Field | Required | Notes |
|-------|----------|-------|
| `program_name` | Yes | Official name from the page |
| `program_url` | Yes | URL of the program's own page |
| `source_id` | Yes | From the assignment — MUST travel with every program |
| `source_name` | Yes | For reporting |
| `pdf_urls[]` | If present | Any PDF links (application guides, fact sheets) |
| `brief_description` | Yes | 1-2 sentence summary |
| `funding_type` | If identifiable | Grant, Incentive, Loan, Tax Credit, etc. |

6. **Note PDF URLs** with `type: "pdf"` label — extractors handle PDFs later
7. **Skip login-gated pages** — flag them instead: "Requires login, could not crawl"

### Searcher Variant (Supplementary Web Search)

When the prompt says `role: searcher`, do web search instead of URL crawling:
- `"[source name] rebate programs [sectors]"`
- `"[source name] incentive programs 2026"`
- `"[source name] energy efficiency programs"`
- `"[source name] grant programs"`
- `"[source name] sustainability programs"`
- Look specifically for programs NOT on the catalog pages (third-party implementer
  sites, new pages, programs hosted on partner domains)

### Crawling Depth

Maximum 2 levels:
- Level 0: Catalog page (assigned URL)
- Level 1: Program links found on catalog page
- Level 2: Sub-links if needed (e.g., program page links to sub-program pages)

Do NOT crawl beyond level 2. If deeper pages exist, note them as flags for
manual review.

### Cross-Check Protocol

After all scouts report, the team lead compares program lists. Scouts should flag:
- Programs found by only one scout (could be duplicates or unique finds)
- Programs found by searcher but not by URL crawlers (third-party hosted)
- Programs with ambiguous names that might be the same program listed differently
- Programs that appear to be sub-programs of a larger program

---

## 3. Extractor Mode Instructions

> **CRITICAL: Three Filter Gates (ALL must pass before INSERT)**
>
> All field values MUST come from `TAXONOMIES` in `lib/constants/taxonomies.js`.
> Do NOT use freeform values — map to the closest taxonomy match.
>
> **Gate 1 — Applicant Type**: At least one `hot`, `strong`, or `mild` tier match
> in `ELIGIBLE_APPLICANTS`. If only `weak` tier matches (Individuals, Homeowners,
> Renters, etc.) → **DO NOT INSERT**.
>
> **Gate 2 — Activity Type**: At least one `hot`, `strong`, or `mild` tier match
> in `ELIGIBLE_ACTIVITIES`. If only `weak` tier matches (Training, Education,
> Program Operations, etc.) → **DO NOT INSERT**.
>
> **Gate 3 — Project Type**: At least one match in `ELIGIBLE_PROJECT_TYPES` from
> **any tier** (hot, strong, mild, OR weak). This confirms the program funds a
> recognizable project. If you cannot map the program to ANY project type in the
> taxonomy → **DO NOT INSERT**.
>
> All three gates must pass. Log filtered programs with which gate(s) failed.

Extractors receive program assignments from the orchestrator and extract
structured data for database storage.

### Process

1. **Receive assignments**: list of `{program_url, source_id, program_name, pdf_urls[]}`
2. **For each program**, visit the program URL via WebFetch (or Playwright for JS-rendered pages)
3. **Extract these structured fields**:

| Field | Column | Required | Notes |
|-------|--------|----------|-------|
| Program name | `name` | Yes | Official program name from the page |
| Description | `description` | Yes | What the program funds, who it helps, how to apply |
| Categories | `categories` | Yes | TEXT[] from TAXONOMIES.CATEGORIES (see below) |
| Eligible applicants | `eligible_applicants` | Yes | TEXT[] — who can apply |
| Eligible project types | `eligible_project_types` | Yes (Gate 3) | TEXT[] from ELIGIBLE_PROJECT_TYPES taxonomy (any tier) |
| Eligible activities | `eligible_activities` | Yes | TEXT[] from ELIGIBLE_ACTIVITIES taxonomy (hot/strong/mild only) |
| Funding type | `funding_type` | If identifiable | Single value: Grant, Incentive, Loan, etc. |
| Status | `status` | Yes | Set to `'active'` on insert |
| Recurrence | `recurrence` | Recommended | one-time, recurring, continuous, unknown |
| Program URLs | `program_urls` | Yes | JSONB array of URL objects |
| Pipeline | `pipeline` | Yes | Set to `'manual'` |
| Next check at | `next_check_at` | Yes | Set to `NOW()` for immediate Phase 3 eligibility |

### Categories — Use Taxonomy Categories

The `categories` field is a TEXT[] array. Use values from `TAXONOMIES.CATEGORIES`
(`lib/constants/taxonomies.js`):

**Hot**: Energy, Infrastructure, Facilities & Buildings, Sustainability
**Strong**: Water, Wastewater, Healthcare, Recreation & Parks, Climate, Transportation, Public Safety, Emergency Services, Environment
**Mild**: Community Development, Economic Development, Workforce Development, Science & Technology
**Weak**: Education, Agriculture, Food Systems, Housing, Human Services, Arts & Culture, Disaster Recovery, Conservation

Assign ALL categories that apply to a program. A weatherization rebate might get:
`ARRAY['Energy', 'Sustainability', 'Housing']`

An EV charging incentive might get:
`ARRAY['Energy', 'Transportation', 'Sustainability']`

Do NOT invent category names outside this vocabulary — map to the closest match.

### Eligible Applicants — Use Taxonomy Values

Use EXACT values from `TAXONOMIES.ELIGIBLE_APPLICANTS` in `taxonomies.js`.
Do NOT use freeform terms like "Commercial" or "Municipal" — use the specific
taxonomy values like `For-Profit Businesses`, `Municipal Government`, etc.

**Gate 1 check**: If all matched applicant types are in the `weak` tier only → filter out.

### Eligible Project Types — Use Taxonomy Values

Use EXACT values from `TAXONOMIES.ELIGIBLE_PROJECT_TYPES` in `taxonomies.js`.

**How to identify the project type**: Determine what is **physically being built,
installed, or procured** — not where it happens. Ask: "What is the deliverable?"

- "Classroom HVAC upgrades" → project types: `HVAC Systems`, `Classroom Facilities`
- "School solar installation" → project type: `Solar Panels` or `Solar Arrays`
- "Buying science kits for K-5" → no valid project type → fails Gate 3
- "Data center construction" → project type: `Data Centers`
- "Water treatment plant renovation" → project type: `Water Treatment Plants`

Use facility-level types (e.g., `Classroom Facilities`, `Gymnasium Facilities`) only
when the program broadly funds facility work and you can't identify specific systems.

**Gate 3 check**: If zero taxonomy project types match from any tier → filter out.

### Eligible Activities — Use Taxonomy Values

Use EXACT values from `TAXONOMIES.ELIGIBLE_ACTIVITIES` (hot/strong/mild tiers ONLY).
Do NOT assign weak-tier activities.

**Gate 2 check**: If zero hot/strong/mild activities match → filter out.

### Program URLs — JSONB Format

Build a JSONB array with all relevant URLs for the program:

```json
[
  {"url": "https://example.com/program", "type": "main", "notes": "Program page"},
  {"url": "https://example.com/apply", "type": "application", "notes": "Application portal"},
  {"url": "https://example.com/docs/guide.pdf", "type": "pdf", "notes": "Application guide"}
]
```

Types: `main`, `application`, `pdf`, `faq`, `eligibility`, `contact`

4. **Handle PDFs**: If `pdf_urls` provided, extract text using the PDF method
   from Section 0a (curl piped to PyMuPDF). Do NOT use WebFetch for PDFs —
   it returns garbled binary. Extract key info: eligibility criteria, funding
   amounts, application dates, program details.
5. **Dedup check before writing** (see Section 4 for query)
6. **Run three filter gates** (all must pass):
   - **Gate 1 (Applicant)**: ≥1 hot/strong/mild `ELIGIBLE_APPLICANTS` match
   - **Gate 2 (Activity)**: ≥1 hot/strong/mild `ELIGIBLE_ACTIVITIES` match
   - **Gate 3 (Project Type)**: ≥1 `ELIGIBLE_PROJECT_TYPES` match from any tier
   If any gate fails → SKIP and log which gate(s) failed.
7. **INSERT or UPDATE** into `funding_programs` (see Section 4 for templates)
9. **Set `next_check_at = NOW()`** for new programs (immediate Phase 3 eligibility)
10. **After processing all programs for a source**, update timestamps:
   - `funding_sources.programs_last_searched_at = NOW()`
   - `source_program_urls.last_crawled_at = NOW()` for each crawled catalog URL

---

## 4. SQL Templates

### Query Sources + Catalog URLs for a Scope

```sql
-- Run via mcp__postgres__query
SELECT fs.id, fs.name, fs.website, fs.type, fs.state_code,
  (SELECT json_agg(json_build_object('id', spu.id, 'url', spu.url, 'label', spu.label))
   FROM source_program_urls spu WHERE spu.source_id = fs.id) as catalog_urls
FROM funding_sources fs
WHERE fs.state_code = 'FL' AND fs.type = 'County'
AND (fs.programs_last_searched_at IS NULL
     OR fs.programs_last_searched_at < NOW() - INTERVAL '90 days')
ORDER BY fs.created_at;
```

Substitute actual `state_code` and `type`. Use `mcp__postgres__query` for
this read (raw SQL strings, not psql bind syntax).

### Dedup Check

```sql
-- Run via mcp__postgres__query
SELECT id, name, program_urls, status
FROM funding_programs
WHERE source_id = 'source-uuid-here'
AND (name ILIKE '%program name%' OR name ILIKE '%alternate name%');
```

Run this for every program before INSERT. Substitute actual source_id and program
name fragments. Use multiple ILIKE patterns for alternate names or abbreviations.

### INSERT New Program

```sql
-- Run via: psql "$DEV_CLAUDE_URL" -c "..."
INSERT INTO funding_programs (
  source_id, name, description, program_urls, categories,
  eligible_applicants, eligible_project_types, eligible_activities,
  funding_type, status, recurrence, next_check_at, pipeline
) VALUES (
  'source-uuid-here',
  'Program Name',
  'Description of what this program funds.',
  '[{"url": "https://example.com/program", "type": "main", "notes": "Program page"}]'::JSONB,
  ARRAY['Energy', 'Sustainability']::TEXT[],
  ARRAY['Commercial', 'Residential']::TEXT[],
  ARRAY['HVAC', 'Lighting']::TEXT[],
  ARRAY['Installation', 'Replacement', 'Upgrade']::TEXT[],
  'Incentive',
  'active',
  'recurring',
  NOW(),
  'manual'
);
```

### UPDATE Existing Program

```sql
-- Run via: psql "$DEV_CLAUDE_URL" -c "..."
UPDATE funding_programs SET
  description = COALESCE(NULLIF('new description', ''), description),
  program_urls = '[{"url": "https://example.com/program", "type": "main", "notes": "Program page"}]'::JSONB,
  categories = ARRAY['Energy']::TEXT[],
  eligible_applicants = ARRAY['Commercial']::TEXT[],
  eligible_project_types = ARRAY['HVAC']::TEXT[],
  eligible_activities = ARRAY['Installation', 'Replacement']::TEXT[],
  status = 'active',
  updated_at = NOW()
WHERE id = 'program-uuid-here';
```

### Update Source Timestamp After Processing

```sql
-- Run via: psql "$DEV_CLAUDE_URL" -c "..."
UPDATE funding_sources SET programs_last_searched_at = NOW()
WHERE id = 'source-uuid-here';
```

### Update Catalog URL Timestamp After Crawling

```sql
-- Run via: psql "$DEV_CLAUDE_URL" -c "..."
UPDATE source_program_urls SET last_crawled_at = NOW()
WHERE id = 'catalog-url-uuid-here';
```

---

## 5. Output Report

### Scout Report Format

```
=== SCOUT REPORT: [Source Name] ===

Catalog URLs crawled: X
Programs found: Y

Programs:
1. [Program Name] -- [program_url]
   Type: Incentive | Description: Brief summary
   PDFs: [pdf_url1], [pdf_url2]
2. [Program Name] -- [program_url]
   Type: Grant | Description: Brief summary
...

Flags:
- [any login-gated pages]
- [any 404 or unreachable URLs]
- [any low-confidence finds]
```

### Extractor Report Format

```
=== EXTRACTOR REPORT: [Source Name] ===

Programs processed: X
  New:     Y inserted
  Updated: Z modified
  Skipped: W (dedup match, no changes)

Programs:
1. [Program Name] -- status: active -- funding_type: Incentive
   Categories: [Energy, Sustainability]
   Applicants: [Commercial, Residential]
2. ...

Errors:
- [any extraction failures]
- [any DB write failures]
```

### Cross-Check Report Format (Scouts Only)

```
=== CROSS-CHECK: [Source Name] ===

Confirmed by multiple scouts: X programs
Found by single scout only: Y programs (review needed)
Found by searcher only: Z programs (third-party hosted?)
Total unique programs: N
```

If running as an Agent Team teammate, send the report to the team lead via
message. If running standalone via Task tool, return it as the task result.

---

## 6. Database Reference

### Tables Written

| Table | Operation | Key Columns |
|-------|-----------|-------------|
| `funding_programs` | INSERT / UPDATE | source_id, name, description, program_urls, categories, eligible_applicants, eligible_project_types, funding_type, status, recurrence, next_check_at, pipeline |
| `funding_sources` | UPDATE (timestamp only) | programs_last_searched_at |
| `source_program_urls` | UPDATE (timestamp only) | last_crawled_at |

### Connection

- **Reads**: `mcp__postgres__query` (read-only MCP tool — use raw SQL strings)
- **Writes**: `psql "$DEV_CLAUDE_URL"` via Bash (default). Orchestrator may set `$STAGING_CLAUDE_URL` or `$PROD_CLAUDE_URL`.

### Key Constraints

- `funding_programs.source_id` is NOT NULL FK to `funding_sources(id)`
- `funding_programs.name` is NOT NULL
- No UNIQUE constraint on name — dedup is done via query (fuzzy match + source_id)
- `claude_writer` role has INSERT, SELECT, UPDATE — no DELETE
- Always use the environment variable provided by the orchestrator for writes
- `funding_programs.pipeline` should be set to `'manual'` for all programs created by this skill

---

## 7. Error Handling

### Crawling Failures

| Situation | Action |
|-----------|--------|
| Catalog URL returns 404 | Log error, flag in report, continue to next URL |
| Page is JS-rendered/empty via WebFetch | Fallback to Playwright (`browser_navigate` + `browser_snapshot`). If still empty, flag as "JS-rendered, could not extract" |
| Login-gated page | Flag: "Requires login, could not crawl". Skip — do NOT guess programs |
| Rate limited (429) | Wait 15 seconds, retry once. If persistent, move to next URL, come back later |
| PDF link returns 404 or is password-protected | Log, flag as inaccessible, continue |
| PDF returns garbled via WebFetch | Use `curl \| python3 PyMuPDF` instead (see Section 0a). Never use WebFetch for PDFs |
| Timeout on large page | Retry once with longer timeout. If still failing, flag and skip |

### Extraction Failures

| Situation | Action |
|-----------|--------|
| Program page has minimal info | Extract what you can, mark fields as NULL. Better a partial program than no program |
| Cannot determine funding_type | Set to NULL — don't guess |
| Cannot determine categories | Use the source's `sectors` as fallback categories |
| Cannot determine eligible_applicants | Set to NULL — don't guess. Flag for manual review |
| Page content is in non-English language | Flag, extract English content if available |
| PDF cannot be parsed via PyMuPDF | Try with User-Agent header. If still fails, flag as "PDF not parseable", continue with web page data only |

### Database Failures

| Situation | Action |
|-----------|--------|
| psql INSERT fails (NOT NULL violation) | Check that `name` and `source_id` are set. Log full error |
| psql INSERT fails (FK violation) | `source_id` doesn't exist — this is a bug in the handoff. Log and skip |
| mcp__postgres__query fails on dedup | Retry once. If persistent, skip dedup for this program (INSERT — better duplicate than miss) |
| psql UPDATE fails | Log full error, continue to next program. Include in error count |

---

## 8. Verification & Success Criteria

### Post-Processing Verification Query

After completing all extractions, run this to verify counts:

```sql
-- Run via mcp__postgres__query
SELECT
  COUNT(*) as total_programs,
  COUNT(*) FILTER (WHERE status = 'active') as active_programs,
  COUNT(*) FILTER (WHERE pipeline = 'manual') as manual_programs,
  COUNT(*) FILTER (WHERE categories IS NOT NULL) as with_categories,
  COUNT(*) FILTER (WHERE program_urls != '[]'::jsonb) as with_urls
FROM funding_programs
WHERE source_id IN (
  SELECT id FROM funding_sources
  WHERE state_code = 'FL' AND type = 'County'
);
```

Substitute actual `state_code` and `type`. Compare against your processing counts.

### Success Criteria Checklist

Before reporting completion, verify:

- [ ] All assigned catalog URLs crawled (or flagged if inaccessible)
- [ ] Each program has `source_id` correctly set (FK integrity)
- [ ] `program_urls` JSONB populated with at least the main URL
- [ ] `categories` populated using TAXONOMIES.CATEGORIES vocabulary only
- [ ] Dedup check run for every program before INSERT
- [ ] New programs have `status = 'active'` and `next_check_at = NOW()`
- [ ] `pipeline` set to `'manual'` for all new programs
- [ ] `programs_last_searched_at` updated on all processed sources
- [ ] `last_crawled_at` updated on all crawled catalog URLs
- [ ] Report includes counts (new, updated, skipped) and any flags

---

## 9. Example Execution Flow

### Scout Example

```
Assignment: mode=scout, source="Alachua County Office of Sustainability",
source_id="abc-123", catalog_urls=["https://sustainability.alachuacounty.us/programs"]

1. WebFetch "https://sustainability.alachuacounty.us/programs"
   - Page lists: Green Business Program, Energy Audit Program, Tree Planting Grants
   - Follow link: /programs/green-business -> program detail page
   - Follow link: /programs/energy-audit -> program detail page
   - Follow link: /programs/tree-grants -> links to PDF application

2. Capture programs:
   a. Green Business Program
      URL: https://sustainability.alachuacounty.us/programs/green-business
      Type: Technical Assistance
      PDFs: none
   b. Energy Audit Program
      URL: https://sustainability.alachuacounty.us/programs/energy-audit
      Type: Incentive
      PDFs: none
   c. Tree Planting Grants
      URL: https://sustainability.alachuacounty.us/programs/tree-grants
      Type: Grant
      PDFs: [https://sustainability.alachuacounty.us/docs/tree-grant-app.pdf]

3. Report to team lead:
   "Found 3 programs for Alachua County Office of Sustainability:
    1. Green Business Program -- /programs/green-business -- Technical Assistance
    2. Energy Audit Program -- /programs/energy-audit -- Incentive
    3. Tree Planting Grants -- /programs/tree-grants -- Grant (has PDF)"
```

### Extractor Example

```
Assignment: mode=extractor, programs=[
  {program_url: "https://sustainability.alachuacounty.us/programs/green-business",
   source_id: "abc-123", program_name: "Green Business Program", pdf_urls: []}
]

1. WebFetch "https://sustainability.alachuacounty.us/programs/green-business"
   - Extract: free energy assessments, waste audits for local businesses
   - Eligible: Commercial, Small Business
   - Project types: Energy Audit, Lighting, HVAC
   - Funding type: Technical Assistance
   - Recurrence: continuous

2. Dedup check:
   mcp__postgres__query: SELECT id, name FROM funding_programs
     WHERE source_id = 'abc-123'
     AND (name ILIKE '%Green Business%' OR name ILIKE '%green biz%');
   -> No match found

3. INSERT:
   psql "$DEV_CLAUDE_URL" -c "INSERT INTO funding_programs (
     source_id, name, description, program_urls, categories,
     eligible_applicants, eligible_project_types, funding_type,
     status, recurrence, next_check_at, pipeline
   ) VALUES (
     'abc-123',
     'Green Business Program',
     'Free energy assessments and waste audits for Alachua County businesses.',
     '[{\"url\": \"https://sustainability.alachuacounty.us/programs/green-business\",
       \"type\": \"main\", \"notes\": \"Program page\"}]'::JSONB,
     ARRAY['Energy', 'Sustainability']::TEXT[],
     ARRAY['Commercial', 'Small Business']::TEXT[],
     ARRAY['Energy Audit', 'Lighting', 'HVAC']::TEXT[],
     'Technical Assistance',
     'active',
     'continuous',
     NOW(),
     'manual'
   );"

4. Update source timestamp:
   psql "$DEV_CLAUDE_URL" -c "UPDATE funding_sources
     SET programs_last_searched_at = NOW()
     WHERE id = 'abc-123';"

5. Report to team lead:
   "Extracted 1 program for Alachua County Office of Sustainability:
    New: 1 inserted
    Updated: 0
    Skipped: 0
    Issues: none"
```

---

## 10. Agent Team Protocol

When spawned as a teammate in a program discovery Agent Team:

### Scout Teammates

1. **Receive assignment**: source + catalog URLs + mode from team lead
2. **Read this skill file**: Ensure you understand the scout process
3. **Crawl assigned catalog URLs**: Follow the process in Section 2
4. **Report program list** to team lead with confidence levels
5. **Cross-check phase**: When other scouts share their lists, validate findings:
   - "I can confirm [program] — found on [catalog URL]"
   - "I did NOT find [program] on any catalog page — low confidence"
6. **Confirm final merged list** with team lead

### Extractor Teammates

1. **Receive assignment**: program list with URLs and source_ids from team lead
2. **Read this skill file**: Ensure you understand the extractor process
3. **Visit each program URL**, extract structured data per Section 3
4. **Write to database**: INSERT or UPDATE per Section 4
5. **Report extraction results** to team lead with counts
6. **Flag any programs** that could not be fully extracted

### Message Format to Team Lead (Scouts)

```
Found [N] programs for [Source Name]:

1. [Program Name] -- [url] -- [funding_type]
   PDFs: [count]
   Confidence: HIGH (found on official catalog page)
2. [Program Name] -- [url] -- [funding_type]
   Confidence: MEDIUM (found via search, not on catalog)
...

Catalog URLs crawled: [N] of [total assigned]
Flags: [any issues]
```

### Message Format to Team Lead (Extractors)

```
Extracted [N] programs for [Source Name]:

New: [X] inserted into funding_programs
Updated: [Y] existing programs refreshed
Skipped: [Z] no changes needed

Issues: [any extraction failures or partial data]
```

### Important: Use the Environment Variable from the Orchestrator

The orchestrator will set the database environment variable in your prompt
(e.g., `$DEV_CLAUDE_URL`, `$STAGING_CLAUDE_URL`, or `$PROD_CLAUDE_URL`).
Always use that variable for psql writes. Never hardcode connection strings.
