---
name: client-scout-search
description: >
  Search sub-skill for the Client Opportunity Scout. Defines the full search
  process, output format, dedup protocol, and validation rules. Preloaded
  into client-scout-search-agent via skills declaration.
---

# Client Scout Search — Sub-Skill

## 1. Mission

Find funding opportunities that match a specific client's profile but aren't yet
in Meridian's database. You search one source-type wave with a chunk of 3-5 project
needs. Report structured findings — do NOT write to any database.

**Quality standard**: Every finding must be a REAL funding opportunity (not news,
not a blog post, not a general information page). Include enough detail for the
orchestrator to assess match quality and for the ingestion phase to locate the program.

---

## 2. First Action

**Read the search strategies reference before doing anything else:**

```
Read: .claude/skills/client-scout-search/SEARCH-STRATEGIES.md
```

This file contains query templates, site navigation patterns, DSIRE techniques,
PDF handling, and source-type-specific guidance you need for execution.

---

## 3. Input Parsing

Your prompt from the orchestrator contains these fields. Parse them before searching:

| Field | Description |
|-------|-------------|
| `wave` | Source type: `utility`, `county`, `state`, `federal`, `foundation` |
| `sources` | Specific entities to search (e.g., "Southern California Edison", "Los Angeles County") |
| `needs_chunk` | Array of 3-5 project needs (e.g., ["HVAC Systems", "Solar Panels", "Battery Storage"]) |
| `client_type` | Client's type (e.g., "K-12 School Districts") |
| `expanded_types` | Expanded type list (synonyms + hierarchy + cross-categories) |
| `state_code` | Client's state (e.g., "CA") |
| `county` | Client's county (e.g., "Los Angeles County") |
| `city` | Client's city (e.g., "Redondo Beach") |
| `dac` | Whether client is in a Disadvantaged Community (true/false) |
| `dedup_titles` | Existing opportunity titles in Meridian (for dedup) |
| `dedup_urls` | Existing opportunity URLs in Meridian (for dedup) |

---

## 4. Search Execution

For each project need in your `needs_chunk`, execute the search strategies
appropriate to your `wave` type (defined in SEARCH-STRATEGIES.md).

### 4.1 General Search Flow

1. **Construct search queries** using templates from SEARCH-STRATEGIES.md
2. **Execute WebSearch** for each query
3. **Evaluate results**: Scan titles and snippets for funding program indicators
4. **Follow promising links**: Use WebFetch (or Playwright for JS-rendered pages) to verify
5. **Extract basic program info**: title, URL, source name, funding type guess, status guess
6. **Check dedup**: Compare against `dedup_titles` and `dedup_urls`
7. **Assess match quality**: Does this program plausibly match the client?

### 4.2 Content Retrieval Standard

Same as the extraction skill — hierarchical fallback:

**HTML pages**:
1. WebFetch(url) — check if content is substantive (not just nav/headers)
2. If empty/garbled → Playwright (`browser_navigate` + `browser_snapshot`)

**PDF documents**:
```bash
curl -sL -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "PDF_URL" | python3 -c "
import sys, fitz
doc = fitz.open(stream=sys.stdin.buffer.read(), filetype='pdf')
for page in doc[:20]: print(page.get_text())
"
```
- ALWAYS include User-Agent header
- Skip PDFs > 10MB
- Extract first 20 pages only

**Login-gated pages**: Flag and skip — do not attempt to bypass.

### 4.3 Per-Source Search Depth

- **Visit the source's website directly** (if known) — check rebates/incentives/grants pages
- **Follow links 1-2 levels deep** from program listing pages
- **Check DSIRE** for this source (if utility or state agency)
- **Execute 2-3 web search queries** per project need per source
- **If DAC client**: Add environmental justice / IRA bonus credit searches

### 4.4 What Counts as a Finding

**Include**:
- Active grant programs, rebate programs, incentive programs, tax credit programs
- Programs accepting applications from the client's type
- Programs covering the client's geography
- Programs that fund at least one of your assigned project needs
- Open, upcoming, or rolling/continuous programs
- Closed-but-recurring programs (worth tracking for future rounds)

**Exclude**:
- News articles or press releases about funding (not the program itself)
- Residential-only programs (unless client type includes residential)
- Programs clearly for a different geography
- Programs for a completely different applicant type
- Informational pages that aren't actual funding programs
- Defunct/discontinued programs with no indication of future rounds

---

## 5. Dedup Protocol

Before including any finding in your output:

1. **URL check**: Is the URL (or a close variant) in `dedup_urls`?
2. **Title check**: Is a very similar title in `dedup_titles`? (fuzzy — account for slight naming differences)
3. **If found in dedup list**: Do NOT include as a new finding. Instead, add to your `already_in_db` list with the matching title/URL.

The orchestrator uses the `already_in_db` list to detect matching anomalies (Category 2 in the report).

---

## 6. Match Quality Assessment

For each finding, assess whether it would plausibly match the client using these criteria
(mirrors the 4-criteria matching algorithm in `evaluateMatch.js`):

| Criterion | What to Check |
|-----------|--------------|
| **Location** | Does the program cover the client's geography? (utility territory, county, state, national) |
| **Applicant Type** | Does the program accept the client's type or any of the expanded types? |
| **Project Needs** | Does the program fund at least one of your assigned project needs? |
| **Activities** | Does the program involve construction/installation/renovation type activities? |

Assign a `confidence` level:
- **high**: All 4 criteria clearly match based on available information
- **medium**: 2-3 criteria match, others are unclear from search results alone
- **low**: Only 1 criterion clearly matches, significant uncertainty

---

## 7. Output Format

Return your findings as a structured report. The orchestrator will parse this.

```
=== WAVE REPORT: [wave_type] ===
Agent: [agent_name]
Needs chunk: [need1, need2, need3]
Queries executed: [N]
URLs evaluated: [N]

--- NEW FINDINGS ---

FINDING 1:
  title: [Official program name]
  url: [Primary URL]
  source_name: [Funding entity name]
  source_type: [Utility/County/State/Federal/Foundation]
  source_website: [Entity's main website]
  state_code: [XX]
  funding_type_guess: [Grant/Incentive/Rebate/Tax Credit/Loan]
  status_guess: [Open/Upcoming/Rolling/Closed-Recurring/Unknown]
  confidence: [high/medium/low]
  match_reasoning: [1-2 sentences: why this matches the client]
  matched_needs: [which project needs from your chunk this covers]
  program_urls: [array of URLs: main page, application page, PDF links]
  is_pdf: [true/false — whether primary content is a PDF]

FINDING 2:
  ...

--- ALREADY IN DB ---

EXISTING 1:
  found_title: [What you found]
  found_url: [URL you found]
  existing_match: [Title/URL from dedup list that matches]
  note: [Why you think this should/shouldn't be matching the client]

--- BONUS FINDS ---

BONUS 1:
  title: [Program name]
  url: [URL]
  source_name: [Entity name]
  note: [Why this is interesting even though it doesn't match THIS client]
  best_for: [What client types/geographies would benefit]

=== END WAVE REPORT ===
```

---

## 8. Error Handling

- **WebSearch returns no results** for a query: Try alternate query formulations (see SEARCH-STRATEGIES.md). After 3 attempts with no results, move to next need.
- **WebFetch returns empty/error**: Try Playwright. If both fail, note the URL as "could not access" and continue.
- **PDF extraction fails**: Note the URL as "PDF extraction failed" and continue.
- **Source website is down**: Note as "source website unavailable" and try web search queries instead.
- **No findings for entire chunk**: Report zero findings — that's a valid outcome. Don't invent findings.
