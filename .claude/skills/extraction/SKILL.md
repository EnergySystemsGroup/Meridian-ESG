---
name: extraction
description: >
  Phase 4 of the manual funding pipeline. Fetches content from staging record
  URLs, extracts ~24 structured fields into extraction_data JSONB, stores
  raw_content (capped at 50KB), computes source_hash for change detection,
  and updates extraction_status. Source-type agnostic — handles utilities,
  state agencies, counties, municipalities, foundations, and federal sources.
---

# Data Extraction — Phase 4

## 0. Before You Start (REQUIRED)

Read this entire skill file before processing any records.

**MANDATORY**: Read `lib/constants/taxonomies.js` BEFORE any extraction work.
You need all five taxonomy categories memorized:

| Taxonomy | Used For |
|----------|----------|
| `ELIGIBLE_APPLICANTS` | Who can apply (tiered: hot/strong/mild/weak) |
| `ELIGIBLE_PROJECT_TYPES` | What gets funded — equipment, systems, infrastructure (tiered) |
| `ELIGIBLE_ACTIVITIES` | What actions the money pays for — installation, design, etc. (tiered) |
| `CATEGORIES` | Broad domain — Energy, Infrastructure, Education, etc. (tiered) |
| `FUNDING_TYPES` | Grant, Rebate, Tax Credit, Loan, etc. (tiered) |

**Rules**:
- Use ONLY values from the taxonomy file — no invented values
- Select ALL applicable options (multiple selections encouraged)
- For edge cases, choose the closest match — NO "Other" values
- Be exhaustive — don't miss relevant options

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
- **Level 0**: Fetch the URLs from `program_urls` or `mfos.url`
- **Level 1**: Follow links containing "Apply", "Application", "Guidelines", "Details"
- **Level 2**: If a Level 1 page references sub-pages with eligibility/amounts, fetch those
- **MAX 2 levels**. Flag deeper content for manual review.

### Fallback Chain (All Modes)

When the primary method fails, try in order — never silently skip:
```
WebFetch → Playwright (headless) → FLAG for manual review
```
Always log what failed and why in your report.

---

## 1. Mission

Transform staging records from pending discovery data into fully-extracted
structured opportunities.

**Input**: Records in `manual_funding_opportunities_staging` where
`extraction_status = 'pending'`.

**Output** (per record):
- `extraction_data` — JSONB with 24 structured fields (see Section 5)
- `raw_content` — combined markdown/text from all fetched URLs, capped at 50KB
- `source_hash` — MD5 of the full (un-truncated) combined content
- `extraction_status` — updated to `complete`, `skipped`, `duplicate`, or `error`

**Source-type agnostic**: The same extraction process works for utilities, state
agencies, counties, municipalities, foundations, and federal sources. The
`funding_source` object is populated from the source JOIN data, not hardcoded.

**Processing model**: Spawned via Task tool, batches of 20, sequential processing
within each batch. The orchestrator re-checks pending count after each batch and
spawns another agent if more remain.

---

## 2. Input Processing

### Query Template

Use `mcp__postgres__query` to fetch the next batch:

```sql
SELECT mfos.id, mfos.title, mfos.url, mfos.program_urls, mfos.content_type,
       mfos.source_id, mfos.program_id,
       fs.name as source_name, fs.funder_type, fs.website as source_website,
       fs.state_code
FROM manual_funding_opportunities_staging mfos
JOIN funding_sources fs ON fs.id = mfos.source_id
WHERE mfos.extraction_status = 'pending'
ORDER BY mfos.id
LIMIT 20;
```

### Claim Records

Before processing, mark each record as `processing` to prevent other agents
from picking it up:

```sql
UPDATE manual_funding_opportunities_staging
SET extraction_status = 'processing'
WHERE id = 'UUID';
```

Run this UPDATE via `psql` for each record as you begin processing it.

### Zero Pending

If the query returns zero rows, report "No pending extraction records" and stop.

### Minimal Pre-Filter

Phase 3 already filtered — if a record exists in staging, it is worth extracting.
The ONLY records to skip are:
- Records where ALL URLs are login-gated (from Phase 3 flags in `content_type`)
- Records with zero URLs (`program_urls = '[]'` AND `url IS NULL`)

For skipped pre-filter records: set `extraction_status = 'skipped'`,
`extraction_error = 'Pre-filter: [reason]'`.

---

## 3. Content Fetching + Early Duplicate Detection

### 3a. Parse program_urls

Each staging record has a `program_urls` JSONB array from Phase 3:

```json
[
  {"url": "https://example.com/program", "type": "main", "label": "Program page"},
  {"url": "https://example.com/apply", "type": "application", "label": "Application"},
  {"url": "https://example.com/guide.pdf", "type": "pdf", "label": "Guidelines PDF"}
]
```

**Fetch priority order**: `application` → `main` → `pdf` → others.

If `program_urls` is empty, null, or `'[]'`, fall back to `mfos.url`.

### 3b. Fetch Content

Apply the Content Retrieval Standard (Section 0a) to each URL.

Combine all fetched content with section markers:

```
=== SOURCE: https://example.com/program (type: main) ===
[markdown content from WebFetch]

=== SOURCE: https://example.com/apply (type: application) ===
[markdown content from WebFetch]

=== SOURCE: https://example.com/guide.pdf (type: pdf) ===
[extracted text from curl | PyMuPDF]
```

**Rate limiting**: 2-3 second pause between fetches to the same domain.

### 3c. raw_content and source_hash

**raw_content**: Store the combined markdown/text. **Cap at 50KB** (51,200 bytes).
If the combined content exceeds 50KB, truncate and append:
```
[TRUNCATED — original content was X bytes. First 50KB retained.]
```

**source_hash**: Compute MD5 of the FULL (un-truncated) combined content.

```bash
echo -n "FULL_COMBINED_CONTENT" | md5sum | cut -d' ' -f1
```

For large content, use a temp approach:
```bash
printf '%s' "CONTENT" | md5sum | cut -d' ' -f1
```

Or via Python if content has special characters:
```python
python3 -c "import hashlib, sys; print(hashlib.md5(sys.stdin.buffer.read()).hexdigest())" <<< "CONTENT"
```

### 3d. Early Duplicate Detection (Before LLM Extraction)

After computing source_hash, check for existing matches BEFORE doing LLM extraction:

```sql
SELECT id, title, extraction_status, extraction_data
FROM manual_funding_opportunities_staging
WHERE source_hash = '[computed_hash]'
  AND extraction_status IN ('complete', 'skipped')
  AND id != '[current_record_id]'
LIMIT 1;
```

**If match found** — content is identical to a previously-extracted record:
- Copy `extraction_data` from the matched record (no LLM call needed)
- Set `extraction_status = 'duplicate'`
- Set `extraction_error = 'Dedup: content matches [matched_id]'`
- Store `raw_content` and `source_hash` as normal
- This saves LLM tokens — the manual pipeline equivalent of V2's raw response hash dedup

**If no match** — proceed with normal LLM extraction (Section 4).

### 3e. All URLs Fail

If every URL in `program_urls` (and the fallback `mfos.url`) returns an error:
- Set `extraction_status = 'error'`
- Set `extraction_error = 'All URLs failed: [brief details]'`
- Continue to the next record

---

## 4. Structured Data Extraction

Extract 24 fields from the combined `raw_content` into an `extraction_data` JSONB
object. This is the core LLM work — read the content carefully and populate every
field you can find evidence for.

### Field-by-Field Guidance

**`id`** (string, REQUIRED):
Use the staging record UUID from the query. Do NOT generate a slug or hash.

**`title`** (string, REQUIRED):
The official name of the opportunity/program as stated on the page.

**`description`** (string, REQUIRED):
Combine ALL relevant text: program overview, objectives, eligible activities,
application process, contact info. Be thorough — this is the primary content
field used for matching and display.

**`fundingType`** (string, nullable):
Map to FUNDING_TYPES taxonomy: Grant, Rebate, Tax Credit, Loan, etc.
Use the closest match from the taxonomy.

**`funding_source`** (object, REQUIRED):
Populate from the source JOIN data AND page content:
- `name`: Use `fs.name` from the query (the registered source name)
- `type`: Use `fs.funder_type` from the query (Utility, State, County, etc.)
- `website`: Use `fs.website` OR extract from page content
- `contact_email`: Extract from page content if available
- `contact_phone`: Extract from page content if available
- `description`: Brief note about the source from page content

**`totalFundingAvailable`** (number, nullable):
Total program budget if mentioned. Parse "$5 million" → 5000000.

**`minimumAward`** (number, nullable):
Minimum per-applicant amount. Parse "$500" → 500.

**`maximumAward`** (number, nullable):
Maximum per-applicant amount. Parse "$50,000" → 50000.

**`notes`** (string, nullable):
How funding values were determined. E.g., "Per unit rebate: $0.10/kWh up to $50,000."

**`openDate`** (string, nullable):
Application opening date in YYYY-MM-DD format. Parse various date formats.
If "rolling" or "ongoing", leave null (status handles this).

**`closeDate`** (string, nullable):
Application closing date in YYYY-MM-DD format.
If perpetual/ongoing with no close date, leave null.

**`eligibleApplicants`** (array of strings, REQUIRED):
Map page language to ELIGIBLE_APPLICANTS taxonomy values.

Source-type agnostic mapping guide:

| Page Language | Map To |
|---|---|
| "Commercial customers", "Businesses" | `For-Profit Businesses` |
| "Small business", "SME" | `Small/Medium Businesses (SMB)` |
| "Government", "Public agencies" | `Local Governments` / `State Governments` |
| "Nonprofit", "501(c)(3)" | `Nonprofit Organizations 501(c)(3)` |
| "School districts", "K-12" | `K-12 School Districts` |
| "Agricultural", "Farmers" | `Farms and Agricultural Producers` |
| "Tribal" | `Tribal Governments` |
| "Homeowners", "Residential" | `Homeowners`, `Individuals` |
| "Municipalities", "Cities" | `Municipal Government`, `City Government` |
| "Counties" | `County Government` |
| "Hospitals", "Healthcare" | `Hospitals`, `Healthcare Facilities` |
| "Higher education", "Universities" | `Institutions of Higher Education` |

**`eligibleProjectTypes`** (array of strings, REQUIRED):
Map to ELIGIBLE_PROJECT_TYPES taxonomy. These are the physical things being
funded: HVAC Systems, Solar Panels, Weatherization, etc.

**`eligibleActivities`** (array of strings, REQUIRED):
Map to ELIGIBLE_ACTIVITIES taxonomy. These are the actions: Installation,
Replacement, New Construction, Equipment Purchase, etc.

**`eligibleLocations`** (array of strings, nullable):
Extract from content. Rules by source type:
- **Utilities**: Service territory name (e.g., "PG&E service territory")
- **Counties**: County name (e.g., "Alachua County")
- **Municipalities**: City name (e.g., "City of Portland")
- **State agencies**: State name (e.g., "Oregon")
- **Federal**: Leave empty array — use `isNational = true`
- **Foundations**: Whatever geographic restriction is stated

**`url`** (string, nullable):
The best URL for this opportunity. Prefer the application page over the main page.

**`matchingRequired`** (boolean, REQUIRED):
Whether cost-share or matching funds are required.

**`matchingPercentage`** (number, nullable):
If matching is required, the percentage (e.g., 25 for 25% match).

**`categories`** (array of strings, REQUIRED):
Map to CATEGORIES taxonomy. Broad domains: Energy, Infrastructure, etc.

**`tags`** (array of strings, REQUIRED):
Short keywords (1-3 words each) extracted from the opportunity.
Examples: "solar", "weatherization", "low-income", "commercial lighting".

**`status`** (string, REQUIRED):
Extract from page content. Must be lowercase: `open`, `upcoming`, or `closed`.
If the page says the program is closed, that is what we store. This is normal
extraction, not re-validation.

**`isNational`** (boolean, REQUIRED):
True only for federal/national programs. State and local → false.

**`disbursementType`** (string, nullable):
How funding is distributed. Prefer standard values:
`reimbursement`, `upfront`, `milestone-based`, `performance-based`,
`instant_rebate`, `mail_in_rebate`, `on_bill_credit`, `direct_payment`.

**`awardProcess`** (string, nullable):
MUST be one of: `competitive`, `first-come-first-served`, `lottery`,
`formula-based`, `rolling`, `unknown`.

---

## 5. extraction_data JSONB Schema

The complete schema for the `extraction_data` JSONB column:

```json
{
  "id": "uuid-from-staging-record",
  "title": "Program Name",
  "description": "Full combined description...",
  "fundingType": "Grant",
  "funding_source": {
    "name": "Oregon Housing and Community Services",
    "type": "State",
    "website": "https://www.oregon.gov/ohcs",
    "contact_email": "info@ohcs.oregon.gov",
    "contact_phone": "(503) 986-2000",
    "description": "Oregon state housing and community services agency"
  },
  "totalFundingAvailable": 5000000,
  "minimumAward": 100000,
  "maximumAward": 500000,
  "notes": "Competitive award based on project readiness and community impact",
  "openDate": "2026-03-01",
  "closeDate": "2026-06-30",
  "eligibleApplicants": [
    "Nonprofit Organizations 501(c)(3)",
    "Local Governments",
    "Public Housing Authorities"
  ],
  "eligibleProjectTypes": [
    "Affordable Housing Units",
    "Weatherization",
    "HVAC Systems"
  ],
  "eligibleActivities": [
    "New Construction",
    "Renovation",
    "Installation"
  ],
  "eligibleLocations": ["Oregon"],
  "url": "https://www.oregon.gov/ohcs/development/pages/lift.aspx",
  "matchingRequired": true,
  "matchingPercentage": 25,
  "categories": ["Housing", "Energy", "Sustainability"],
  "tags": ["affordable housing", "energy efficiency", "low-income", "LIFT"],
  "status": "open",
  "isNational": false,
  "disbursementType": "reimbursement",
  "awardProcess": "competitive"
}
```

### Required Fields

These must always be populated (never null):
- `id`, `title`, `description`
- `eligibleApplicants`, `eligibleProjectTypes`, `eligibleActivities`
- `categories`, `tags`
- `status`, `isNational`, `matchingRequired`
- `url`

### Optional Fields

These may be null if not found on the page:
- `fundingType`, `totalFundingAvailable`, `minimumAward`, `maximumAward`, `notes`
- `openDate`, `closeDate`
- `eligibleLocations`, `matchingPercentage`
- `disbursementType`, `awardProcess`

The `funding_source` object is always populated (from the source JOIN data at minimum).

---

## 6. Closed/Expired Handling

If the extracted `status` is `closed`, OR if `closeDate` is in the past:

- Set `extraction_status = 'skipped'`
- Still store `extraction_data` and `raw_content` (for reference)
- Set `extraction_error = 'Skipped: opportunity status is closed (close_date: YYYY-MM-DD)'`
  or `'Skipped: opportunity status is closed (no close_date)'`
- Skipped records do NOT proceed to Phase 5

This is not "re-validation" — it is the natural result of extracting the status
field. If the page says the program is closed, we record that truth.

---

## 7. Database Updates (SQL Templates)

All writes go through `psql "$ENV_VAR"` where `$ENV_VAR` is provided by the
orchestrator in your prompt (e.g., `$DEV_CLAUDE_URL`, `$STAGING_CLAUDE_URL`).

### Success (extraction_status = 'complete')

```sql
UPDATE manual_funding_opportunities_staging
SET
  extraction_status = 'complete',
  raw_content = $RAW_CONTENT$[combined content]$RAW_CONTENT$,
  raw_content_fetched_at = NOW(),
  source_hash = '[32-char MD5 hash]',
  extraction_data = '[JSON object]'::jsonb,
  extracted_at = NOW(),
  extracted_by = 'extraction-agent',
  updated_at = NOW()
WHERE id = '[staging_record_uuid]';
```

### Skipped (closed/expired)

```sql
UPDATE manual_funding_opportunities_staging
SET
  extraction_status = 'skipped',
  raw_content = $RAW_CONTENT$[combined content]$RAW_CONTENT$,
  raw_content_fetched_at = NOW(),
  source_hash = '[32-char MD5 hash]',
  extraction_data = '[JSON object]'::jsonb,
  extraction_error = 'Skipped: opportunity status is closed (close_date: YYYY-MM-DD)',
  extracted_at = NOW(),
  extracted_by = 'extraction-agent',
  updated_at = NOW()
WHERE id = '[staging_record_uuid]';
```

### Duplicate (source_hash match)

```sql
UPDATE manual_funding_opportunities_staging
SET
  extraction_status = 'duplicate',
  raw_content = $RAW_CONTENT$[combined content]$RAW_CONTENT$,
  raw_content_fetched_at = NOW(),
  source_hash = '[32-char MD5 hash]',
  extraction_data = '[copied JSON from matched record]'::jsonb,
  extraction_error = 'Dedup: content matches [matched_record_id]',
  extracted_at = NOW(),
  extracted_by = 'extraction-agent',
  updated_at = NOW()
WHERE id = '[staging_record_uuid]';
```

### Error

```sql
UPDATE manual_funding_opportunities_staging
SET
  extraction_status = 'error',
  extraction_error = '[error description]',
  extracted_at = NOW(),
  extracted_by = 'extraction-agent',
  updated_at = NOW()
WHERE id = '[staging_record_uuid]';
```

### Dollar-Quoting for raw_content

Use `$RAW_CONTENT$...$RAW_CONTENT$` to safely embed markdown/text in SQL.
This avoids escaping issues with single quotes, backslashes, and special characters.

### Large Content (>100KB combined SQL statement)

If the total SQL statement (including raw_content and extraction_data) exceeds
~100KB, use the temp file approach:

```bash
# Write the full SQL to a temp file
cat > /tmp/extraction_update.sql << 'EXTRACTION_SQL'
UPDATE manual_funding_opportunities_staging
SET ...
WHERE id = '...';
EXTRACTION_SQL

# Execute via psql
source .env.local && psql "$DEV_CLAUDE_URL" -f /tmp/extraction_update.sql

# Clean up
rm /tmp/extraction_update.sql
```

### JSON Escaping for extraction_data

When embedding extraction_data JSON in SQL:
- Single quotes inside JSON strings must be doubled: `'` → `''`
- Or use dollar-quoting: `$EXTRACTION${"key": "value"}$EXTRACTION$::jsonb`
- Recommended: use dollar-quoting for both raw_content and extraction_data

---

## 8. Batch Report Format

After processing all records in a batch, output:

```
=== EXTRACTION REPORT ===
Records processed: X of Y pending
  Complete:   A (extraction_data populated)
  Skipped:    B (closed/expired)
  Duplicate:  C (source_hash match — LLM calls saved)
  Errors:     D

Details:
  [record_id] "Title" → complete
  [record_id] "Title" → skipped (closed, close_date: 2025-12-31)
  [record_id] "Title" → duplicate (matches record_id)
  [record_id] "Title" → error (All URLs returned 404)

Remaining pending: Z records
```

---

## 9. Error Handling

| Situation | Action |
|-----------|--------|
| URL returns 404 | Try next URL in program_urls. All fail → `error` |
| WebFetch returns empty/minimal | Playwright fallback. Still empty → try next URL |
| PDF > 10MB | Skip PDF, note in report, continue with other URLs |
| PDF encrypted/password-protected | Skip PDF, note in report, continue with other URLs |
| Login-gated page | Flag, skip URL, continue with others |
| All URLs fail | `extraction_status = 'error'` |
| Content too sparse for full extraction | Extract what you can, let Phase 5 handle quality |
| psql write fails | Log error, set `extraction_status = 'error'`, continue to next record |
| Rate limited (429) | Wait 15 seconds, retry once. Still failing → skip URL, try next |
| Content > 50KB | Truncate raw_content with note, hash uses full content |
| MD5 computation fails | Use 'no_hash' as source_hash, log warning, continue |

**Never silently skip a record.** Every record must end with an extraction_status
of `complete`, `skipped`, `duplicate`, or `error`.

---

## 10. Database Reference

### Tables Read (via mcp__postgres__query)

- `manual_funding_opportunities_staging` — pending records to extract
- `funding_sources` — source metadata (name, funder_type, website, state_code)

### Tables Written (via psql)

- `manual_funding_opportunities_staging` — update extraction_status, extraction_data,
  raw_content, source_hash, extracted_at, extracted_by, extraction_error

### Connection

- **Reads**: `mcp__postgres__query` (read-only MCP tool)
- **Writes**: `source .env.local && psql "$ENV_VAR"` where `$ENV_VAR` is provided
  in the agent prompt by the orchestrator. Common values:
  - `$DEV_CLAUDE_URL` — development database
  - `$STAGING_CLAUDE_URL` — staging database
  - `$PROD_CLAUDE_URL` — production database
- **NEVER assume an environment.** If the env var is not in your prompt, STOP and
  report the error.
