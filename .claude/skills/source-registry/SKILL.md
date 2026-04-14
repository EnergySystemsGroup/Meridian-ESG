---
name: source-registry
description: >
  Phase 1 of the manual funding pipeline. Discovers funding entities
  (utilities, state agencies, foundations, counties, COGs) via multi-strategy
  web search and PROPOSES them to the orchestrator for validation and
  registration. Teammates DO NOT write to the database — the orchestrator
  is the single writer. Designed to be run by Agent Team teammates.
---

# Source Registry — Phase 1

## 1. Mission

Find every funding entity for a given state and funder type. A missed source
means all its programs and opportunities are invisible to our sales team —
thoroughness is non-negotiable.

**Inputs** (provided by the orchestrator):
- `state_code` — two-letter abbreviation (e.g., `AZ`, `CA`). NULL for federal/national.
- `type` — the SINGLE type you are searching for (e.g., `County`). Only propose
  entities of this type. If you find entities that belong to a different type,
  note them as "out-of-scope" in your report — do NOT propose them as your type.
- `batch_id` — for audit logging

**Outputs**:
- **Proposed entity list** sent to orchestrator via SendMessage (NOT database writes)
- Each proposal includes: name, website, type, description, catalog URLs, confidence, name_source
- Summary report: X entities proposed, Y out-of-scope flagged

## ⚠️ CRITICAL: DO NOT WRITE TO THE DATABASE

You are a **proposer**, not a writer. Your job is to search, verify, and propose.
The orchestrator validates (dedup, type check, name verification) and performs
all INSERTs. This ensures zero duplicates and zero bad data in production.

- **DO NOT** run INSERT statements against `funding_sources` or `source_program_urls`
- **DO NOT** run UPDATE statements on existing rows
- **DO** use `mcp__postgres__query` for READ-ONLY dedup checks (to avoid proposing
  entities that already exist)
- **DO** send your proposals to the team lead via SendMessage

---

## 2. Step 1 — Multi-Strategy Web Search

Run multiple complementary search strategies. When running as an Agent Team
teammate, you are assigned ONE strategy group. When running standalone,
execute all strategies sequentially.

**For detailed search instructions, queries, and navigation guidance for each strategy,
read `.claude/skills/source-registry/SEARCH-REFERENCE.md`.**

### Strategy Overview

| # | Strategy | Funder Types | Purpose |
|---|----------|-------------|---------|
| 1 | Direct listing search | Utility, County, Municipality, Tribal | Find comprehensive entity lists |
| 2 | Regulatory / PUC databases | Utility | Official government records of regulated entities |
| 3 | EIA federal database | Utility | Authoritative federal data — ground truth for utility counts |
| 4 | Aggregator sites (DSIRE, EnergySage, ACEEE) | All types | Cross-reference with curated incentive databases |
| 5 | State/federal agency search | State, Federal, County | Direct government office discovery |
| 6 | Foundation databases | Foundation | Philanthropic grant-making organizations |
| 7 | Taxonomy-driven search | All types (esp. County, Municipality) | Search by taxonomy category to find sources by what they fund |

### Funder-Type Strategy Selection

| Funder Type | Use Strategies |
|-------------|----------------|
| Utility | 1, 2, 3, 4 |
| State | 4, 5, 7 |
| Federal | 4, 5 (federal agencies) |
| Foundation | 4, 6, 7 |
| County | 1 (county variant), 5, 7 |
| Municipality | 1 (city variant), 5, 7 |
| Tribal | Use `Other` for tribal authorities |

### For Each Entity Found, Capture:

| Field | Column | Required | Notes |
|-------|--------|----------|-------|
| Entity name | `name` | Yes | Official full legal name (see naming rules below) |
| Website URL | `website` | Yes | Main website, e.g., `https://www.aps.com` |
| Funder type | `type` | Yes | Must match input parameter |
| Sectors | `sectors` | Recommended | TEXT[] — use values from `TAXONOMIES.CATEGORIES` (see below) |
| State code | `state_code` | Yes (if not federal) | Two-letter code matching input |
| Description | `description` | If available | Brief: what they fund, service territory, customer count |

**Name normalization rules:**
- Use the full official legal name, not abbreviations
- "Pacific Gas and Electric Company" not "PG&E"
- "Salt River Project Agricultural Improvement and Power District" not "SRP"
- Include the common abbreviation in description: "Known as APS. Serves central Arizona."
- For co-ops, spell out "Cooperative" (not "Co-op")
- Check the entity's own website footer or "About Us" for their official name

**Department-level naming** (for County and Municipality funder types):
- Use the department/agency name, not the parent government: "Clark County Department of Environment and Sustainability" not "Clark County"
- Include the parent in the description: "Department under Clark County government. Manages sustainability programs for..."
- If the department name doesn't include the parent, prepend it: "City of Las Vegas Office of Sustainability" not just "Office of Sustainability"
- Abbreviations go in description only: "Known as Clark County DES."

### Registration Granularity

Different funder types register at different levels:

| Funder Type | Registration Unit | Example | Rationale |
|-------------|-------------------|---------|-----------|
| Utility | Entity (the utility company) | "Arizona Public Service Company" | Utilities are the direct funder — programs map 1:1 to the utility |
| County | Department / Agency | "Clark County Department of Environment and Sustainability" | Counties have many departments; programs map to specific departments |
| Municipality | Department / Agency | "City of Las Vegas Office of Sustainability" | Same as County — the department runs the programs |
| State | Agency | "Arizona Department of Administration" | Already correct — state agencies are the natural registration unit |
| Federal | Agency | "U.S. Department of Energy" | Already correct |
| Foundation | Entity (the foundation) | "Kresge Foundation" | Foundations are the direct funder |
| Tribal | Entity (the tribal authority) | "Navajo Tribal Utility Authority" | Tribal utilities/authorities are the direct funder |

**Why department-level for County/Municipality?** Registering "Clark County" is too generic — it has dozens of departments. When Phase 2 discovers programs, each source should map to one department's programs. A single county government might have 3-6 departments that each run funding programs (Environment, Housing, Public Works, Economic Development, etc.) — each should be a separate source.

### Sectors — Use Taxonomy Categories

The `sectors` field is a TEXT[] array. Use values from the project's `TAXONOMIES.CATEGORIES`
(`lib/constants/taxonomies.js`) as the preferred vocabulary:

**Primary**: Energy, Infrastructure, Facilities & Buildings, Education, Sustainability
**Secondary**: Water, Wastewater, Healthcare, Recreation & Parks, Climate, Transportation, Public Safety, Emergency Services, Environment
**Tertiary**: Community Development, Economic Development, Workforce Development, Science & Technology, Agriculture, Food Systems, Housing, Human Services, Arts & Culture, Conservation

Assign ALL categories that apply to a source. A large utility might get:
`ARRAY['Energy', 'Sustainability', 'Transportation', 'Water']`

A state environmental agency might get:
`ARRAY['Environment', 'Climate', 'Sustainability', 'Water']`

Do NOT invent sector names outside this vocabulary — map to the closest match.

### Minimum Investigation Thresholds

If your search returns fewer entities than these minimums, your search is **likely
incomplete** — apply iterative deepening techniques (see SEARCH-REFERENCE.md Section 9)
before finishing:

| Funder Type | Minimum Before Flagging | Why |
|-------------|------------------------|-----|
| Utility (large state: CA, TX, FL, NY, PA) | 20+ | These states have dozens of IOUs, co-ops, and munis |
| Utility (medium state: AZ, CO, GA, NC, etc.) | 10+ | Still significant utility diversity |
| Utility (small state: VT, DE, RI, WY) | 5+ | Even small states have multiple utilities |
| State agencies | 3+ | At minimum: energy office, environment dept, housing authority |
| Federal agencies | 8+ | DOE, EPA, USDA, HUD, DOT, SBA, DOI, EDA at minimum |
| Foundation | No minimum — highly variable | Some states have many, some very few |
| County | 2+ departments per major county | Major counties have multiple departments running programs (Environment, Housing, Public Works, etc.) |
| Municipality | 2+ departments per major city | Large cities have sustainability, housing, economic development departments |
| Tribal | Check if tribal lands exist in state | Not all states have tribal utilities |

**There is no upper limit.** If you find 50 utilities in California, that's probably correct.
Never stop searching because you hit a "target number."

### Search Quality Rules

- **Minimum confidence**: Only include entities you can verify exist via at least one
  official source (website loads, appears in regulatory listing, confirmed on EIA/DSIRE)
- **Flag low-confidence finds**: If an entity appears in only one secondary source with
  no working website, flag it — don't silently include it
- **Count validation**: Compare your final count against EIA data (utilities) or DSIRE
  entity counts (all types). If significantly below minimum thresholds, dig deeper
- **Distinguish entities from brands**: Some utilities operate under multiple brand names.
  Register the operating entity that serves customers, not parent holding companies
- **Avoid duplicates across types**: A city might have both a municipal utility AND a
  sustainability office — these are different entities. Register both.

---

## 3. Step 2 — Deduplication and Proposal

For each entity from Step 1, check against existing `funding_sources` before proposing.
This pre-check avoids wasting the orchestrator's time on entities that already exist.

### Pre-Proposal Dedup Query (READ-ONLY)

```sql
-- Run via mcp__postgres__query (raw SQL, no bind variables)
SELECT id, name, website, type, state_code, sectors, pipeline
FROM funding_sources
WHERE (
  name ILIKE '%Arizona Public Service%'
  OR name ILIKE '%APS%'
  OR website ILIKE '%aps.com%'
)
AND (state_code = 'AZ' OR state_code IS NULL)
AND name NOT LIKE '[DEPRECATED-%';
```

Substitute the actual entity name, abbreviation, and domain for each lookup.
Use `mcp__postgres__query` for this read (raw SQL strings, not psql bind syntax).

### Decision Logic

| Scenario | Action |
|----------|--------|
| **No match found** | PROPOSE to orchestrator as new entity |
| **Match found, has NULL fields** | PROPOSE as enrichment (note which fields to fill) |
| **Match found, all fields populated** | SKIP — log as "already exists" |

### Proposal Format (sent via SendMessage to team-lead)

For each proposed entity, include ALL of the following fields:

```
PROPOSED ENTITY:
  name: "Arizona Public Service Company"
  website: "https://www.aps.com"
  type: Utility
  state_code: AZ
  sectors: [Energy, Sustainability]
  description: "Known as APS. Largest electric utility in Arizona. Serves ~1.3M customers."
  confidence: HIGH
  name_source: "from website footer" (or "from About Us page", "from breadcrumb", "from search result only")
  catalog_urls:
    - https://www.aps.com/en/Residential/Save-Money-and-Energy/Rebates-and-Incentives
    - https://www.aps.com/en/Business/Save-Money-and-Energy
  dedup_check: "No match found in funding_sources for APS / aps.com / AZ"
```

**Name source field**: This tells the orchestrator whether to spot-check the name.
- "from website footer" / "from About Us page" / "from breadcrumb" = verified, no spot-check needed
- "from search result only" = orchestrator will verify via WebFetch before INSERT

### DO NOT INSERT — the orchestrator handles all writes

## 4. Step 3 — Catalog URL Validation

Before including a catalog URL in your proposal, **verify it actually contains
funding program content.** Do NOT propose URLs you haven't checked.

### Validation Steps

For each candidate catalog URL:
1. Fetch the page (use the Content Retrieval Standard from program-discovery SKILL.md
   Section 0a — WebFetch first, then curl-with-headers, then Playwright if needed)
2. Check the page content for funding-program indicators:
   - Look for: "Apply", "Grant Application", "Funding Opportunity", "RFP", "NOFA",
     "Rebate", "Incentive", "Program Guidelines", specific dollar amounts
   - Look for links to individual program pages (not just department navigation)
3. Classify the URL:

| What You See | Action |
|---|---|
| Page lists programs with "Apply" links or dollar amounts | **INCLUDE** — this is a real catalog URL |
| Page is a department homepage with navigation links but no programs | **GO DEEPER** — follow the most promising link one level and check that page instead |
| Page is a generic info page with no program content | **EXCLUDE** — do not propose this URL |
| Page returns 404 or redirects to a generic landing page | **EXCLUDE** — dead URL |
| Page is on a different domain or department than expected | **FLAG** — note the misattribution in your report |

4. Include only validated catalog URLs in your proposal. Note any excluded URLs
   and why in your report.

### Why This Matters

Bad catalog URLs waste Phase 2 scout time. A scout assigned a navigation hub or
dead URL will crawl it, find nothing, and have to fall back to web search — losing
10-20 minutes. Validating upfront takes ~5 seconds per URL and prevents junk data
in `source_program_urls`.

---

### UPDATE Template (enrich existing source)

Only update NULL fields — never overwrite existing data:

```sql
-- Run via: psql "$PROD_CLAUDE_URL" -c "..."
UPDATE funding_sources SET
  website = COALESCE(website, 'https://www.aps.com'),
  type = COALESCE(type, 'Utility'),
  sectors = COALESCE(sectors, ARRAY['Energy', 'Sustainability']::TEXT[]),
  state_code = COALESCE(state_code, 'AZ'),
  description = COALESCE(description, 'Known as APS. Largest electric utility in Arizona.')
WHERE id = 'existing-uuid-here';
```

### Tracking Counts

Keep a running tally:
- `new_count` — freshly INSERTed sources
- `enriched_count` — existing sources with fields updated
- `skipped_count` — existing sources already complete

---

## 4. Step 3 — Program Catalog URL Discovery

For each registered source that has a `website`, find the pages where they list
their programs, rebates, incentives, or grants. These catalog URLs become the
entry points for Phase 2 (Program Discovery).

**For detailed navigation techniques and URL evaluation guidance,
read `.claude/skills/source-registry/SEARCH-REFERENCE.md` Section 8.**

### Process

**A. WebFetch the source website and navigate:**
1. Fetch the source's main website URL
2. Scan nav menus and links for: "rebates", "incentives", "programs", "grants",
   "savings", "energy efficiency", "commercial", "residential"
3. Follow promising links 1-2 clicks deep — the homepage is almost never the catalog
4. Look for "See All Programs" or "View All Rebates" aggregation pages

**B. WebSearch for supplementary catalog pages:**
- `"[Source Name] rebate programs"`
- `"[Source Name] incentive programs"`
- `"[Source Name] rebates and incentives"` (very common page title)
- `site:[source domain] rebates` (site-restricted search)

**C. Check for segmented pages** (large utilities split by customer type):
- Residential programs / "For Your Home"
- Commercial/Business programs / "For Your Business"
- Industrial / Large Commercial programs
- Income-qualified / Low-income programs
- New construction / EV / Transportation programs

**D. Check for third-party implementer portals:**
- Some utilities outsource to CLEAResult, ICF, Franklin Energy, etc.
- Search: `"[Source Name] rebates" -site:[source domain]`
- Look for: `savings.utilityname.com`, branded implementer domains

### Label Guidelines

| Page Content | Label |
|-------------|-------|
| All programs on one page | "Main rebate and incentive catalog" |
| Residential only | "Residential rebate programs" |
| Commercial/business only | "Commercial and industrial programs" |
| Low-income only | "Income-qualified programs" |
| EV / transportation | "EV and transportation incentives" |
| Third-party portal | "Third-party program portal ([implementer name])" |
| PDF catalog | "Program catalog (PDF)" |
| DSIRE page for this source | "DSIRE program listing" |

### INSERT Template

```sql
-- Run via: psql "$PROD_CLAUDE_URL" -c "..."
INSERT INTO source_program_urls (source_id, url, label)
VALUES ('source-uuid-here', 'https://www.aps.com/rebates', 'Main rebate and incentive catalog')
ON CONFLICT (source_id, url) DO NOTHING;
```

### Quality Rules

- **Prefer deep pages** over top-level landing pages
- **Include PDF links** if a source publishes program catalogs as PDFs
- **Skip login-gated pages** — flag instead: "Requires login, could not crawl"
- **Include DSIRE** as a catalog URL if DSIRE lists this source's programs
- **Minimum per source**: Major IOUs should have 2-5 catalog URLs. Small co-ops may have 1.
  If a major utility has zero, flag it.
- **Don't register individual program pages** — those are discovered in Phase 2

---

## 5. Output Report

When all 3 steps are complete, produce this summary:

```
═══ SOURCE REGISTRY COMPLETE: [State] [Funder Type] ═══

Sources:
  New:      X registered
  Enriched: Y updated (filled missing fields)
  Skipped:  Z already complete
  Total:    N in funding_sources for this scope

Catalog URLs:
  New:      X discovered
  Skipped:  Y already existed (ON CONFLICT)
  Total:    N in source_program_urls for these sources

Flags:
  - [any low-confidence entities]
  - [any sources with zero catalog URLs]
  - [any login-gated pages encountered]
  - [count below minimum investigation threshold]
```

If running as an Agent Team teammate, send this summary back to the team lead
via message. If running standalone via Task tool, return it as the task result.

---

## 6. Database Reference

### Tables Written

| Table | Operation | Columns |
|-------|-----------|---------|
| `funding_sources` | INSERT / UPDATE | name, website, type, sectors, state_code, pipeline, description |
| `source_program_urls` | INSERT (ON CONFLICT DO NOTHING) | source_id, url, label |

### Connection

- **Reads**: `mcp__postgres__query` (read-only MCP tool — use raw SQL strings)
- **Writes**: `psql "$PROD_CLAUDE_URL"` via Bash (default). Orchestrator may set `$STAGING_CLAUDE_URL` or `$DEV_CLAUDE_URL`.

### Key Constraints

- `funding_sources.name` is NOT NULL
- `source_program_urls` has UNIQUE(source_id, url) — always use ON CONFLICT
- `funding_sources.pipeline` defaults to `'api'` — set to `'manual'` for new sources
- `sectors` is TEXT[] — use values from `TAXONOMIES.CATEGORIES` (`lib/constants/taxonomies.js`)
- No DELETE permission on `claude_writer` role — can only add/update, never remove

---

## 7. Error Handling

### Search Failures

| Situation | Action |
|-----------|--------|
| WebSearch returns zero results for a query | Log the query, try alternate phrasing (see SEARCH-REFERENCE.md Section 9), continue to next query |
| All queries for a strategy return zero | Log as warning, note in output report flags. Do NOT stop — other strategies may still find entities |
| WebSearch is unavailable or rate-limited | Wait 10 seconds, retry once. If still failing, skip web searches and rely on database strategies (EIA, PUC) |

### Website Failures (Catalog URL Discovery)

| Situation | Action |
|-----------|--------|
| Source website returns 404 or connection error | Try `www.` prefix variant and `https://` vs `http://`. If still failing, flag: "Website unreachable — may be stale" |
| Website loads but has no program/rebate pages | Log: "No catalog URLs found — source may not have public program listings". Still register the source. |
| Website is login-gated | Flag: "Requires login, could not crawl". Do NOT register catalog URLs for gated pages |
| WebFetch returns garbled/empty content (JS-rendered) | Fallback to Playwright (`browser_navigate` + `browser_snapshot`). If still empty, try WebSearch `site:[domain] rebates`. If no usable results, flag and move on |
| PDF URL encountered during catalog discovery | Bookmark the URL with label including "(PDF)". Do NOT use WebFetch for PDFs. Downstream skills use `curl \| python3 PyMuPDF` for extraction |

### Database Failures

| Situation | Action |
|-----------|--------|
| `mcp__postgres__query` fails on dedup check | Retry once. If persistent, log error and skip dedup for this entity (register it — better a duplicate than a miss) |
| `psql` INSERT fails | Log the full error message. Common causes: NOT NULL violation (missing name), connection error. Do NOT silently skip — include in error count |
| ON CONFLICT fires on `source_program_urls` | Expected behavior — URL already exists. Count as "skipped", not an error |

---

## 8. Verification & Success Criteria

### Post-Registration Verification Query

After completing all registrations, run this to verify counts:

```sql
-- Run via mcp__postgres__query
SELECT
  COUNT(*) as total_sources,
  COUNT(*) FILTER (WHERE pipeline = 'manual') as manual_sources,
  COUNT(DISTINCT id) FILTER (
    WHERE id IN (SELECT source_id FROM source_program_urls)
  ) as sources_with_catalog_urls
FROM funding_sources
WHERE state_code = 'AZ' AND type = 'Utility';
```

Substitute actual state_code and type. Compare against your registration counts.

### Success Criteria Checklist

Before reporting completion, verify:

- [ ] All applicable search strategies executed (per funder type selection table)
- [ ] Entity count meets or exceeds minimum investigation threshold (SKILL.md Section 2)
- [ ] Each entity verified via at least one official source (website loads, appears in regulatory listing, or confirmed in DSIRE/EIA)
- [ ] Dedup check run for every entity before INSERT (SKILL.md Section 3)
- [ ] All new sources have `pipeline = 'manual'` set
- [ ] Sectors use values from `TAXONOMIES.CATEGORIES` only (SKILL.md Section 2)
- [ ] Catalog URL discovery attempted for every source with a working website
- [ ] Major sources (IOUs, large agencies) have 2+ catalog URLs
- [ ] Low-confidence entities flagged in output report
- [ ] Output report includes all counts (new, enriched, skipped, catalog URLs, flags)

---

## 9. Example Execution Flow

```
Assignment: state_code='AZ', type='Utility', strategy_group='regulatory'

1. Read SEARCH-REFERENCE.md

2. Execute Strategy 2 (PUC databases):
   - WebSearch: "Arizona Corporation Commission regulated utilities"
   - Find ACC website → list of regulated electric utilities
   - Extract: Arizona Public Service Company, Tucson Electric Power, UNS Electric
   - Each has ACC filing = HIGH confidence

3. Execute Strategy 3 (EIA federal database):
   - WebFetch: eia.gov/electricity/state/az/
   - Extract utility count and major names from state profile
   - Cross-reference: APS, TEP confirmed. Also find Salt River Project, several co-ops
   - SRP not in ACC list (it's a public power district, not PUC-regulated) = still valid

4. Dedup each entity:
   - mcp__postgres__query: SELECT id, name FROM funding_sources
     WHERE name ILIKE '%Arizona Public Service%' AND state_code = 'AZ'
   - APS found (id=abc123, website NULL) → UPDATE to enrich website
   - TEP not found → INSERT new source
   - SRP not found → INSERT new source

5. Report to team lead:
   "Found 5 entities via regulatory strategies:
    1. Arizona Public Service Company — aps.com — Confidence: HIGH
    2. Tucson Electric Power Company — tep.com — Confidence: HIGH
    3. Salt River Project — srpnet.com — Confidence: HIGH
    4. UNS Electric — uesaz.com — Confidence: HIGH
    5. Arizona Electric Power Cooperative — aepco.com — Confidence: MEDIUM
    Count: 5 found vs 10 minimum — needs deeper search from other teammates"
```

---

## 10. Agent Team Protocol

When spawned as a teammate in a source discovery Agent Team:

1. **Receive assignment**: Team lead assigns you a strategy group (e.g., "regulatory" or "aggregator")
2. **Read search reference**: `Read .claude/skills/source-registry/SEARCH-REFERENCE.md` for your assigned strategy's detailed instructions
3. **Execute your strategies**: Run the searches for your assigned group only
4. **Report findings**: Send your entity list to the team lead with confidence levels
5. **Cross-check phase**: When other teammates share their lists, validate against your sources
   - "I can confirm [entity] — it appears in [my source]"
   - "I did NOT find [entity] in regulatory records — low confidence"
6. **Final list**: Team lead merges all validated entities, you may be asked to do Step 3 (catalog URLs) for a subset

### Message Format to Team Lead

```
Found [N] entities via [strategy name]:

1. [Entity Name] — [website] — Confidence: HIGH
   Sectors: [Energy, Sustainability]
   Found in: [source1], [source2]
2. [Entity Name] — [website] — Confidence: MEDIUM
   Sectors: [Energy]
   Found in: [source1] only
...

Flagged:
- [Entity] — found in secondary source only, no working website
- Count: [N] found vs [minimum threshold] minimum — [adequate/needs deeper search]
```
