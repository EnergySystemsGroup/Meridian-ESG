# Meridian Pipeline V2: Unified Source → Program → Opportunity Architecture

## Status: PROPOSAL - Step-by-Step Review In Progress

---

## 1. Problem Statement

The current pipeline has two issues:

1. **Manual discovery is unstructured**: Web searches are ad-hoc with no systematic tracking of what entities exist, what programs they run, or where to find program information.

2. **No concept of "programs"**: Every opportunity is independent. When a program closes, it's just a "closed opportunity." There's no persistent record of the program itself, no way to track recurring programs across rounds, and no ability to say "this source runs these programs, check back for new opportunities."

### What We're Building

A three-tier data model that serves both manual and API pipelines:

```
FUNDING SOURCE (who funds things)
  └── PROGRAM (what they fund - persistent)
       └── OPPORTUNITY (specific window/round - temporal)
```

This adds one meaningful layer (programs) between sources and opportunities, changing how we discover, track, and present funding data.

---

## 2. Architecture Overview

### Data Model

```
funding_sources (enhanced)          ← WHO: "Arizona Public Service"
  │  + funder_type, sectors[], state_code
  │  + programs_last_searched_at
  │
  ├── source_program_urls (NEW)     ← WHERE TO LOOK: catalog/rebate/portal URLs
  │     + url, label, last_crawled_at
  │
  └── funding_programs (repurposed) ← WHAT: "Commercial HVAC Rebate Program"
       │  + categories, status, recurrence
       │
       └── funding_opportunities    ← WHEN: "2025 Round - Open Jan-Aug"
            │  + program_id (existing column, now populated)
            │
            └── opportunity_coverage_areas  ← WHERE: geographic linking
```

### Pipeline Phases

```
MANUAL PIPELINE                         API PIPELINE
═══════════════                         ════════════

Phase 1: Source Discovery               (sources pre-configured in api_sources)
Phase 2: Program Discovery              (programs auto-created from API data - future)
Phase 3: Opportunity Discovery          Stage 2: API Fetch
     ↓                                       ↓
┌─────────────────────────────────────────────────────┐
│  SHARED PROCESSING (both pipelines converge)        │
│                                                      │
│  Phase 4: Extraction (manual) / Stage 3 (API)       │
│  Phase 5: Analysis + Scoring                         │
│  Phase 6: Storage (promotion_status='pending_review')│
└─────────────────────────────────────────────────────┘
     ↓
Phase 7: Review & Publish (admin approves → visible via VIEW)
```

---

## 2b. Production Database Model

> **REVIEWED — Step 4 Discussion (Approved)**

All pipeline operations run against the **production database** directly. There is no
local→production transfer step. The approval gate for manual pipeline records is a
`promotion_status` column on the `funding_opportunities` table (see Section 3c).

**Database connection**:
- `PIPELINE_DB_URL` env var — the single connection string used by all pipeline skills
- **Production** (default): Points to production Supabase (`PROD_DB_URL`)
- **Development/testing**: Point at local Supabase for safe experimentation
- The `claude_writer` database role restricts destructive operations in production
  (see `docs/prd/db-security/production-database-configuration.md`)

**What goes where**:
| Data | Table | Pipeline Step | Approval Required? |
|------|-------|---------------|-------------------|
| Funding sources | `funding_sources` | Skill 1 | No — straight to production |
| Catalog URLs | `source_program_urls` | Skill 1 | No — straight to production |
| Programs | `funding_programs` | Skill 2 | No — straight to production |
| Staging records | `manual_funding_opportunities_staging` | Skill 3 | No — ETL workspace |
| Opportunities | `funding_opportunities` | Skill 6 | Yes — enters as `pending_review` |
| Published opportunities | `published_funding_opportunities` VIEW | Skill 7 | Admin flips to `promoted` |

**Note**: The hardcoded psql connection string in `CLAUDE.md` should be replaced with `$PIPELINE_DB_URL`.

---

## 3. Schema Changes

### 3a. Enhanced `funding_sources`

> **REVIEWED — Step 1 Discussion (Approved)**

**What exists**: id, name, agency_type (ENUM), type (TEXT), description, website, contact_email, contact_phone

**Schema changes**:

```sql
-- 1. Replace both agency_type (ENUM) and type (TEXT) with a single field
ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS funder_type TEXT;
  -- Values: 'Federal', 'State', 'Utility', 'Foundation', 'Other'
  -- Replaces the confusing dual agency_type/type columns
  -- TEXT (not ENUM) for flexibility — no migration needed to add new types

-- Migrate existing data before dropping old columns:
-- UPDATE funding_sources SET funder_type = agency_type::TEXT WHERE agency_type IS NOT NULL;
-- UPDATE funding_sources SET funder_type = type WHERE funder_type IS NULL AND type IS NOT NULL;
-- Then DROP agency_type and type columns

-- 2. Add sector classification (what domain does this source focus on?)
ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS sectors TEXT[];
  -- Array: a source can serve multiple sectors
  -- Values: 'energy', 'water', 'agriculture', 'commerce', 'environment',
  --         'transportation', 'housing', 'electricity', 'sustainability'
  -- Enables: "which sources in California focus on energy?"

-- 3. Add state code
ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS state_code CHAR(2);
  -- NULL for federal/national sources
  -- "AZ" for Arizona-specific sources, etc.

-- 4. Add pipeline origin tracking
ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS pipeline TEXT DEFAULT 'api';
  -- "api" = originally populated by API pipeline
  -- "manual" = originally populated by manual discovery
  -- Records the ORIGIN of how we first learned about this source
  -- Does NOT change if the source later gets used by both pipelines

-- 5. Add program search delinquency tracking
ALTER TABLE funding_sources ADD COLUMN IF NOT EXISTS programs_last_searched_at TIMESTAMPTZ;
  -- When we last ran a program discovery search for this source
  -- NULL = never searched
  -- Used to identify "delinquent" sources needing refresh
  -- Delinquency threshold: ~90 days (configurable)

-- Indexes for common queries
CREATE INDEX idx_funding_sources_state_funder_type
  ON funding_sources(state_code, funder_type) WHERE state_code IS NOT NULL;
CREATE INDEX idx_funding_sources_sectors
  ON funding_sources USING GIN(sectors);
CREATE INDEX idx_funding_sources_delinquent
  ON funding_sources(programs_last_searched_at)
  WHERE programs_last_searched_at IS NULL
  OR programs_last_searched_at < NOW() - INTERVAL '90 days';
```

**Query capability this enables**:
```sql
-- "Give me all utility sources in Arizona"
SELECT * FROM funding_sources
WHERE funder_type = 'Utility' AND state_code = 'AZ';

-- "Which sources in California focus on energy?"
SELECT * FROM funding_sources
WHERE state_code = 'CA' AND 'energy' = ANY(sectors);

-- "Which sources are delinquent (not searched in 90+ days)?"
SELECT * FROM funding_sources
WHERE programs_last_searched_at IS NULL
   OR programs_last_searched_at < NOW() - INTERVAL '90 days';

-- "Delinquent California utilities specifically"
SELECT * FROM funding_sources
WHERE state_code = 'CA' AND funder_type = 'Utility'
AND (programs_last_searched_at IS NULL
     OR programs_last_searched_at < NOW() - INTERVAL '90 days');
```

### 3a-2. NEW TABLE: `source_program_urls`

> **REVIEWED — Step 1 Discussion (Approved)**

**Purpose**: Stores program catalog/listing URLs per funding source. These are the
entry points for program discovery — the pages where a source lists its programs,
rebates, incentives, etc. A source may have multiple catalog URLs (e.g., a utility
with separate residential and commercial program pages, or third-party implementer sites).

```sql
CREATE TABLE source_program_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES funding_sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
    -- Human-readable description: "Main rebate catalog", "Commercial programs",
    -- "Third-party implementer portal", etc.
  last_crawled_at TIMESTAMPTZ,
    -- When this URL was last crawled for program discovery
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(source_id, url)  -- No duplicate URLs per source
);

CREATE INDEX idx_source_program_urls_source ON source_program_urls(source_id);
CREATE INDEX idx_source_program_urls_stale ON source_program_urls(last_crawled_at)
  WHERE last_crawled_at IS NULL OR last_crawled_at < NOW() - INTERVAL '90 days';
```

**How it's used**:
- Populated during **Source Registration** (Skill 1) — when we register a source, we
  also search for its program catalog pages and store them here
- Consumed during **Program Discovery** (Skill 2) — the skill reads these URLs as
  deterministic entry points, plus supplements with web search
- `last_crawled_at` is updated each time the URL is successfully crawled

### 3b. Repurposed `funding_programs`

> **REVIEWED — Step 2 Discussion (Approved)**

**What exists** (unused): id, source_id (FK), name, description, created_at, updated_at

**Design decisions from Step 2 discussion:**
- **Program URLs stored as JSONB** (not a separate table) — programs have 1-3 URLs max,
  tightly coupled to the program entity. `last_checked_at` on the program tracks crawl
  freshness at the program level.
- **Dual-purpose URLs**: A program URL often serves two purposes: (1) describes the program
  (static info extracted by Skill 2) and (2) is where you check if the program is currently
  open (temporal check by Skill 3). Same URL, different extraction goals.
- **Program stores static/general info; Opportunity stores temporal/round-specific info.**
  Some fields may overlap (categories, eligibility) — program has the general defaults,
  opportunity has the specific round's details. Opportunity table keeps ALL its existing
  fields — no removals, no JOINs required for basic info.
- **Smart scheduling via `next_check_at`**: Skill 3 sets this intelligently based on what
  it learns during crawling (expected open dates, seasonal patterns, etc.). Programs with
  an existing Open opportunity are skipped to avoid redundant checking.
- **"Is the program open?" is NOT tracked on the program table.** An Open opportunity
  linked via `program_id` means the program is currently accepting applications.

**Enhanced schema**:

```sql
-- Existing columns kept as-is, add:

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS program_urls JSONB DEFAULT '[]';
  -- Array of URLs associated with this program (typically 1-3):
  -- [
  --   {"url": "https://...", "type": "main", "notes": "Program page + application status"},
  --   {"url": "https://...", "type": "application", "notes": "Application portal"},
  --   {"url": "https://...", "type": "aggregator", "notes": "Third-party listing"}
  -- ]
  -- These URLs serve dual purpose:
  --   1. Skill 2 crawls them to extract program info (static)
  --   2. Skill 3 crawls them to check for open opportunities (temporal)

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS categories TEXT[];
  -- Aligned with TAXONOMIES.CATEGORIES
  -- e.g., ["Energy", "Sustainability"]
  -- General categories for the program — opportunity may inherit or narrow these

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS eligible_applicants TEXT[];
  -- General applicant types (program-level)
  -- Specific opportunity may narrow this further

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS eligible_project_types TEXT[];
  -- General project types the program covers

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS funding_type TEXT;
  -- Primary funding type: "Grant", "Rebate", "Loan", etc.

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unknown';
  -- "active" = program exists and runs (may or may not have open opportunity right now)
  -- "inactive" = program discontinued
  -- "unknown" = not yet verified
  -- NOTE: "is it open?" is answered by existence of an Open opportunity, not by this field

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'unknown';
  -- "one-time" = single offering
  -- "recurring" = repeats periodically (annual, seasonal, etc.)
  -- "continuous" = always accepting (rolling)
  -- "unknown" = not yet determined

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
  -- When Skill 3 last crawled this program's URLs to check for opportunities

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ;
  -- When to next check for opportunities. Smart scheduling:
  --   Skill 3 sets this based on what it learns during crawling:
  --   - "Opens March 2026" → next_check_at = '2026-02-25'
  --   - "Currently open through August" → next_check_at = '2026-09-01'
  --   - No info → next_check_at = NOW() + 30 days (default monthly)
  -- Initial value: NOW() (check immediately after discovery)

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS pipeline TEXT DEFAULT 'manual';
  -- Which pipeline created this

ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS api_program_id TEXT;
  -- For API pipeline: external program identifier (e.g., CFDA number)
  -- NULL for manual pipeline

-- Indexes
CREATE INDEX idx_funding_programs_source ON funding_programs(source_id);
CREATE INDEX idx_funding_programs_status ON funding_programs(status);
CREATE INDEX idx_funding_programs_categories ON funding_programs USING GIN(categories);
CREATE INDEX idx_funding_programs_next_check
  ON funding_programs(next_check_at)
  WHERE status = 'active' AND next_check_at IS NOT NULL;
```

**What this enables**:
```sql
-- "What programs does APS run?"
SELECT * FROM funding_programs WHERE source_id = '<aps-uuid>';

-- "Active energy programs with open opportunities?"
SELECT p.name, p.categories, o.title, o.status, o.close_date
FROM funding_programs p
LEFT JOIN funding_opportunities o ON o.program_id = p.id AND o.status = 'Open'
WHERE 'Energy' = ANY(p.categories) AND p.status = 'active';

-- "Which programs need checking for opportunities?"
-- (Smart scheduling: due for check + no existing open opportunity)
SELECT fp.* FROM funding_programs fp
WHERE fp.status = 'active'
  AND fp.next_check_at <= NOW()
  AND NOT EXISTS (
    SELECT 1 FROM funding_opportunities fo
    WHERE fo.program_id = fp.id AND fo.status = 'Open'
  );

-- "Programs we haven't checked in 30+ days?"
SELECT * FROM funding_programs
WHERE last_checked_at < NOW() - INTERVAL '30 days'
OR last_checked_at IS NULL;
```

### 3c. `funding_opportunities` Changes

> **REVIEWED — Step 4 Discussion (Approved)**

The table already has `program_id UUID REFERENCES funding_programs(id)` — it's just never populated.

**Schema changes**:

```sql
-- Promotion gate (controls visibility for both pipelines)
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS promotion_status TEXT;
  -- NULL = auto-promoted (API pipeline default, legacy records — VISIBLE)
  -- 'pending_review' = manual pipeline record awaiting admin review — HIDDEN
  -- 'promoted' = admin approved — VISIBLE
  -- 'rejected' = permanently hidden (bad data, not relevant) — HIDDEN
  -- 'needs_revision' = sent back for re-processing — HIDDEN

-- Review metadata (who approved/rejected, when, and why)
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE funding_opportunities ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Frontend visibility view: the SAFE default for all frontend queries
CREATE VIEW published_funding_opportunities AS
SELECT * FROM funding_opportunities
WHERE promotion_status IS NULL          -- legacy/API auto-promoted
   OR promotion_status = 'promoted';    -- manually approved

-- Index for admin review queries
CREATE INDEX idx_funding_opps_promotion
  ON funding_opportunities(promotion_status)
  WHERE promotion_status IS NOT NULL;
```

**How it works**:
- **API pipeline**: `promotion_status = NULL` (default). Records are immediately visible
  via the `published_funding_opportunities` VIEW. Zero changes to the API pipeline.
- **Manual pipeline**: Skill 6 sets `promotion_status = 'pending_review'`. Records are
  hidden from the frontend until an admin approves them (Skill 7).
- **Demotion**: Admin can set ANY record (API or manual) to `'rejected'`. The record
  stays in the table for audit purposes but is permanently hidden from the frontend.
  This handles the case where bad API data gets through — it can be flagged without deletion.
- **Needs revision**: Admin sends a record back for re-processing. The staging record's
  `extraction_status` is reset, the pipeline re-runs, and the UPSERT updates the existing
  `funding_opportunities` row. It returns to `pending_review` for another admin review.

**No separate shadow table needed**: The `promotion_status` column IS the approval gate.
Opportunities live in the real table from the moment Skill 6 writes them — they're just
not visible until promoted. This means coverage areas can be FK-linked immediately
(no JSONB workaround needed).

**API pipeline impact**: None. `promotion_status` defaults to NULL, which the VIEW treats
as promoted. API-created opportunities continue with `program_id = NULL`. Future backfill
can group them into programs.

### 3d. Staging Table Changes

**Add to `manual_funding_opportunities_staging`**:

```sql
ALTER TABLE manual_funding_opportunities_staging
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES funding_programs(id);
  -- Links staging record to discovered program

ALTER TABLE manual_funding_opportunities_staging
  ADD COLUMN IF NOT EXISTS program_urls JSONB DEFAULT '[]';
  -- URLs discovered for this program (carried through pipeline)
```

### 3e. Cross-Pipeline Dedup Strategy

> **REVIEWED — Step 3 Discussion (Approved)**

**Problem**: The API and manual pipelines use different UPSERT conflict keys, creating
a gap where the same opportunity can exist twice — once from each pipeline:

| Pipeline | UPSERT Conflict Key | Scope |
|----------|---------------------|-------|
| API | `(title, api_source_id)` | Only API records |
| Manual | `(funding_source_id, title) WHERE api_source_id IS NULL` | Only manual records |

An API-created opportunity for "APS Commercial HVAC Rebate" and a manually-discovered
one for the same program would NOT collide — they hit different unique indexes.

**Solution**: Enhanced NOT EXISTS clause in Skill 3's smart scheduling query. The dedup
is built INTO the scheduling check — no separate step, no extra query.

```sql
-- Enhanced: catches dupes from BOTH pipelines
AND NOT EXISTS (
  SELECT 1 FROM funding_opportunities fo
  WHERE fo.status = 'Open'
  AND (
    fo.program_id = fp.id                    -- manual pipeline records (have program_id)
    OR (fo.funding_source_id = fp.source_id  -- API pipeline records (no program_id yet)
        AND fo.title ILIKE '%' || fp.name || '%')
  )
);
```

**How it works:**
- `fo.program_id = fp.id` — catches manual-pipeline duplicates (program_id is set)
- `fo.funding_source_id = fp.source_id AND title ILIKE ...` — catches API-pipeline duplicates
  (no program_id, but same source + similar title)
- **Status-aware**: Only `status = 'Open'` blocks. A Closed opportunity is an old round —
  the new round should be processed. An Upcoming opportunity still allows re-checking
  (Skill 3 needs to detect when Upcoming → Open).
- **Self-healing**: As API records get backfilled with `program_id` over time, the fuzzy
  title path becomes redundant but continues to work as a safety net.

**Why `funding_source_id` matches across pipelines:**
Both pipelines converge on the same `funding_source_id` because `fundingSourceManager.getOrCreate()`
deduplicates sources by name. When the API creates "Arizona Public Service" and the manual
pipeline registers "Arizona Public Service", they get the same UUID.

**Full dedup layer stack (defense in depth):**

| Layer | Check | Where | What It Catches |
|-------|-------|-------|-----------------|
| 1. Staging URL | `ON CONFLICT (url) DO NOTHING` | Staging INSERT | Same URL discovered twice |
| 2. Staging source+title | `UNIQUE(source_id, title)` | Staging INSERT | Same program from same source |
| 3. **Cross-pipeline** | **Enhanced NOT EXISTS in Skill 3** | **Before staging** | **API opportunity already exists for this program** |
| 4. Storage manual UPSERT | `ON CONFLICT (funding_source_id, title) WHERE api_source_id IS NULL` | Storage INSERT | Manual record already exists |
| 5. Storage API UPSERT | `ON CONFLICT (title, api_source_id)` | Storage INSERT (force mode) | API record already exists |

**Layer 3 is the key addition** — it catches cross-pipeline duplicates BEFORE any processing
happens, saving extraction/analysis/storage work on records that would be rejected at Layer 4/5.

---

## 4. Pipeline Skills Specification

### Skill 1: Source Registration (`/source-registry`)

> **REVIEWED — Step 1 Discussion (Approved)**

**Purpose**: Find, register, and enrich funding entities in `funding_sources`, along
with their program catalog URLs in `source_program_urls`.

**Trigger**: `"Register sources: [STATE] [FUNDER_TYPE]"`
- Example: `"Register sources: California utilities"`
- Example: `"Register sources: Arizona state agencies"`
- Example: `"Register sources: national foundations"`

**Input parameters**:
- `state_code` (CHAR 2) — e.g., 'CA', 'AZ'. NULL for national/federal.
- `funder_type` (TEXT) — e.g., 'Utility', 'State', 'Foundation', 'Federal'

**Process**:

**Step 1 — Multi-strategy search for funding entities:**

Claude Code leverages Opus 4.6's agentic search capabilities (highest score in the
industry on BrowseComp for finding hard-to-find information online). The skill runs
multiple complementary search strategies in parallel:

| Strategy | Search queries | Purpose |
|----------|---------------|---------|
| Direct listing | "[State] electric utilities list" | Find comprehensive utility lists |
| Regulatory cross-reference | "[State] PUC regulated utilities", "CPUC utility list" | Official regulatory sources |
| Industry databases | "EIA utility list [State]" (Energy Information Administration) | Federal records of all US utilities |
| Aggregator sites | DSIRE, EnergySage utility program aggregators | Cross-reference with known aggregators |
| State agencies | "[State] energy office", "[State] commerce department grants" | Direct agency searches |
| Foundation databases | "[State] environmental foundation grants" | Foundation-specific searches |

For each entity found, capture: **name, website URL, funder_type, sectors[], state_code**

**Step 2 — Deduplication and registration:**

For each entity found:
1. Check against existing `funding_sources` by name (fuzzy match to handle variations like "APS" vs "Arizona Public Service")
2. If NEW: INSERT into `funding_sources` with all captured metadata
3. If EXISTS but incomplete: UPDATE missing fields (website, sectors, funder_type, state_code)
   - This handles the "enrichment" case — sources auto-created by the API pipeline that lack website/sectors

**Step 3 — Program catalog URL discovery:**

For each registered source that has a website:
1. WebFetch the source's main website
2. Search for program listing pages: "[source name] rebates", "[source name] incentive programs"
3. Follow links to rebate/grant/incentive catalog pages
4. For each catalog URL found: INSERT into `source_program_urls` with descriptive label
   - "Main rebate catalog page"
   - "Commercial programs listing"
   - "Third-party implementer portal"
   - "Residential incentives page"

**Output**:
- Updated `funding_sources` table with registered/enriched entities
- Populated `source_program_urls` with program catalog entry points
- Summary report: X new sources, Y enriched, Z catalog URLs found

**Cadence**: Quarterly or on-demand per state/funder_type.

**Tools used by this skill**:
- `WebSearch` — multi-query parallel searches for entity discovery
- `WebFetch` — fetch and analyze source websites for catalog URLs
- `mcp__postgres__query` — read existing sources for dedup checking
- `psql` (via Bash) — INSERT/UPDATE writes to funding_sources and source_program_urls
- `Task` tool with subagents — parallel search strategies for different entity types

---

### Skill 2: Program Discovery (`/discover-programs`)

> **REVIEWED — Step 2 Discussion (Approved)**

**Purpose**: For a given source (or set of sources), crawl its catalog URLs
(`source_program_urls`) to discover individual programs, extract their static
information, find their program-specific URLs, and store everything as persistent
entities in `funding_programs`.

**Key concept**: `source_program_urls` are WHERE you find LISTS of programs (catalog
pages populated by Skill 1). This skill crawls those catalogs to discover individual
programs, each of which has its own URL(s) — the actual program page(s). These
program URLs are stored in `funding_programs.program_urls` and become the entry
points for Skill 3 (opportunity checking).

**Trigger**: `"Discover programs for [SOURCE]"` or `"Discover programs for [STATE] [FUNDER_TYPE]"`
- Example: `"Discover programs for PG&E"`
- Example: `"Discover programs for California utilities"`
- Example: `"Discover programs for all delinquent sources in Arizona"`

**Delinquency-aware**: The skill queries `funding_sources.programs_last_searched_at`
to identify sources that haven't been searched in 90+ days. The user can scope the
run to any combination of state, funder_type, or specific source name.

**Process**:

**Step 1 — Identify target sources:**
```sql
-- Example: All delinquent California utilities
SELECT fs.*, array_agg(spu.url) as catalog_urls
FROM funding_sources fs
LEFT JOIN source_program_urls spu ON spu.source_id = fs.id
WHERE fs.state_code = 'CA' AND fs.funder_type = 'Utility'
AND (fs.programs_last_searched_at IS NULL
     OR fs.programs_last_searched_at < NOW() - INTERVAL '90 days')
GROUP BY fs.id;
```

**Step 2 — Deterministic crawl of catalog URLs:**
For each source, read its `source_program_urls` entries and crawl them:
- WebFetch each catalog URL (simple HTML pages)
- Playwright for JS-rendered pages (SPAs, dynamic content)
- Parse program listings from the page content
- Follow links to individual program detail pages (2-3 levels deep)
- Check for PDF links (application guides, fact sheets)

The distinction between catalog URL and program URL:
```
source_program_urls:  "aps.com/rebates-and-incentives"  ← CATALOG (lists many programs)
                       │
                       ├── "aps.com/hvac-rebate"  ← PROGRAM URL (this specific program)
                       ├── "aps.com/ev-charging"   ← PROGRAM URL
                       └── "aps.com/lighting"      ← PROGRAM URL
```

**Step 3 — Supplementary web search:**
In addition to deterministic URL crawling, run web searches to catch programs
hosted on third-party implementer sites or new pages not yet in our catalog:
- "[source name] rebate programs [sectors]"
- "[source name] incentive programs 2026"
- "[source name] energy efficiency programs"

**Step 4 — Extract program information:**
For each discovered program, crawl its program URL(s) to extract static info:
- **Name** and **description** (what is this program?)
- **Categories** (Energy, Water, Sustainability, etc.)
- **Eligible applicants** (Commercial, Residential, Municipal, etc.)
- **Eligible project types** (HVAC, Lighting, EV Charging, etc.)
- **Funding type** (Grant, Rebate, Loan, Tax Credit, etc.)
- **Recurrence** (one-time, recurring, continuous)
- **Status** (active, inactive — does this program still exist?)

This is the "general/default" program info. Some of these fields may appear on
specific opportunities too (opportunity can narrow eligibility, etc.), but the
program captures the persistent baseline.

**Step 5 — Register programs:**
For each program discovered:
1. Dedup against existing `funding_programs` by name + source_id (fuzzy match)
2. If NEW: INSERT into `funding_programs` with:
   - All extracted static info
   - `program_urls` JSONB with discovered URLs and labels
   - `status = 'active'`
   - `next_check_at = NOW()` (immediately eligible for Skill 3)
   - `pipeline = 'manual'`
3. If EXISTS: UPDATE changed fields (description, URLs, status, etc.)
4. Update `funding_sources.programs_last_searched_at = NOW()`
5. Update `source_program_urls.last_crawled_at = NOW()` for crawled catalog URLs

**Output**:
- Populated `funding_programs` table with persistent program entities
- Each program has `program_urls` pointing to its specific pages
- Each program has `next_check_at = NOW()` so Skill 3 can immediately check for opportunities
- Summary report: X new programs, Y updated, Z sources processed

**Cadence**: On-demand, or triggered by delinquency (90+ days since last search).

**Tools used**:
- `mcp__postgres__query` — read sources, catalog URLs, existing programs
- `WebFetch` — crawl catalog URLs and program pages (standard HTML)
- `WebSearch` — supplementary search for missed programs
- Playwright tools (`mcp__playwright__*`) — JS-rendered program pages
- Claude-in-Chrome tools (`mcp__claude-in-chrome__*`) — complex interactive pages
- `psql` (via Bash) — writes to funding_programs, update timestamps
- `Task` tool — spawn parallel subagents for multi-source processing

---

### Skill 3: Opportunity Discovery (`/discover-opportunities`)

> **REVIEWED — Step 2 Discussion (Approved)**

**Purpose**: For discovered programs, crawl their `program_urls` to check if the
program currently has an open or upcoming opportunity. If so, create a staging
record to enter the extraction pipeline.

**Key concept**: Skill 2 stored programs with their URLs. Skill 3 crawls those SAME
URLs — but with a different goal: not "what is this program?" (Skill 2's job) but
"is this program accepting applications right now, or will it soon?"

**Trigger**: `"Find opportunities for [SOURCE]"` or `"Find opportunities for [STATE] [TYPE]"`
- Example: `"Find opportunities for APS"`
- Example: `"Find opportunities for Arizona utilities"`
- Example: `"Find opportunities for all due programs"` (uses smart scheduling)

**Smart scheduling query** — which programs need checking (with cross-pipeline dedup):
```sql
SELECT fp.*, fs.name as source_name, fs.state_code
FROM funding_programs fp
JOIN funding_sources fs ON fs.id = fp.source_id
WHERE fp.status = 'active'
  AND fp.next_check_at <= NOW()
  AND NOT EXISTS (
    SELECT 1 FROM funding_opportunities fo
    WHERE fo.status = 'Open'
    AND (
      fo.program_id = fp.id                    -- manual pipeline records (have program_id)
      OR (fo.funding_source_id = fp.source_id  -- API pipeline records (no program_id yet)
          AND fo.title ILIKE '%' || fp.name || '%')
    )
  );
```
This means: only check active programs, only when `next_check_at` says it's time,
and skip programs that already have an open opportunity **from either pipeline**.
The cross-pipeline check catches API-created opportunities via fuzzy title+source
matching (see Section 3e for details).

**Process**:

**Step 1 — Identify programs to check:**
Query using the smart scheduling query above, filtered by user's scope (source, state, type).

**Step 2 — Crawl program URLs:**
For each program, crawl its `program_urls` JSONB entries:
- WebFetch/Playwright the URL(s)
- Look for: application windows, upcoming rounds, "apply now" links, open/close dates

**Step 3 — Handle URL failures (inline recovery):**
If a program URL returns 404 or has moved:
1. Try other URLs in the program's `program_urls` array
2. Fall back to `source_program_urls` catalog pages (re-crawl catalog to find updated URL)
3. Web search: "[source name] [program name] application"
4. If new URL found: update `funding_programs.program_urls`
5. If all fail: flag program `status = 'url_stale'` for manual review

**Step 4 — Determine opportunity status and set smart scheduling:**
For each program, one of these outcomes:

| Finding | Action | `next_check_at` |
|---------|--------|-----------------|
| **Open now**, has close_date | Create staging record (status=Open) | `close_date + 30 days` |
| **Open now**, no close_date (perpetual) | Create staging record (status=Open) | `NOW() + 365 days` (annual) |
| **Upcoming** with specific date ("opens July") | Create staging record (status=Upcoming) | Expected open date (e.g., July 1) |
| **Upcoming** vague ("coming summer 2026") | Create staging record (status=Upcoming) | First day of that period (e.g., June 1) |
| **Learned future date** but no details yet | No staging record (not enough to create) | Expected open date |
| **No indication** of upcoming rounds | No staging record | `NOW() + 30 days` (monthly default) |

**Why the NOT EXISTS clause checks only `status = 'Open'`:**
```sql
AND NOT EXISTS (
  SELECT 1 FROM funding_opportunities fo
  WHERE fo.status = 'Open'
  AND (
    fo.program_id = fp.id
    OR (fo.funding_source_id = fp.source_id
        AND fo.title ILIKE '%' || fp.name || '%')
  )
);
```
- **Open** opportunity → skip checking (already live, don't re-check until after close)
- **Closed** opportunity → ALLOW checking (old round, program may have a new round now)
- **Upcoming** opportunity → ALLOW checking (need to see if it's now actually open)
- **Cross-pipeline**: The OR clause catches API-created Open opportunities that lack
  `program_id` but match the same source + similar title (see Section 3e)
- This means: when `next_check_at` arrives for an Upcoming opportunity, Skill 3
  re-checks and can trigger `needs_refresh` to upgrade Upcoming → Open

**Auto-close mechanism (maintenance query):**
Opportunities close automatically based on their close_date:
```sql
-- Run periodically or as part of any pipeline skill execution
UPDATE funding_opportunities
SET status = 'Closed'
WHERE status = 'Open' AND close_date < NOW() AND close_date IS NOT NULL;
```
Once closed, the NOT EXISTS gate opens, and if `next_check_at` has passed,
the program gets checked for its next round.

**Execution trigger**: On-demand only. User runs "Find opportunities for [X]" which
checks all programs where `next_check_at <= NOW()` matching the scope. No cron/scheduling.

**Step 5 — Create staging records:**
For opportunities found (Open or Upcoming):
- INSERT into `manual_funding_opportunities_staging`
- Set `program_id`, `source_id`
- Store relevant URLs in `program_urls` JSONB (carried through pipeline)
- Set `extraction_status = 'pending'`
- Dedup: `ON CONFLICT (url) DO NOTHING`

**Step 6 — For previously-Upcoming opportunities now Open:**
If a program previously had an "Upcoming" staging record and is now Open:
- Set `needs_refresh = TRUE` on the existing staging record
- Reset `extraction_status = 'pending'` (triggers re-extraction with full content)
- The pipeline re-processes with richer data, updating Upcoming → Open

**Step 7 — Update program scheduling:**
- Set `last_checked_at = NOW()` on the program
- Set `next_check_at` based on what was learned (see table above)

**Pipeline-wide "Upcoming" awareness (affects Skills 4-6):**
When an opportunity enters the pipeline as "Upcoming":
- **Extraction (Skill 4)**: Extracts what's available from the program page. Notes limited
  data. Does NOT hallucinate missing fields — leaves them null/empty.
- **Analysis (Skill 5)**: Recognizes "Upcoming" status. Scores based on available data.
  Content enhancement focuses on what's known from the program's general info.
- **Storage (Skill 6)**: Stores as `status = 'Upcoming'` in `funding_opportunities`.
  Program-level fields (categories, eligible_applicants, etc.) fill in gaps where
  opportunity-specific data isn't yet available.
- **Frontend**: Can show a summary view for Upcoming opportunities rather than full
  details page (future frontend enhancement).

**Output**: Staging records with program context, ready for extraction pipeline.

**Cadence**: On-demand, or based on smart scheduling (programs whose `next_check_at` has passed).

---

### Skill 4: Extraction (`/extract-pending`)

**Purpose**: Fetch content and extract structured data from staging records.

**Trigger**: `"Extract pending"` or `"Extract opportunities for [SOURCE]"`

**Process** (existing pipeline, formalized):
1. Query staging: `WHERE extraction_status = 'pending'`
2. For each record:
   - Fetch ALL URLs from `program_urls` (not just one URL)
   - Use combined content for richer extraction
   - LLM extracts 24 structured fields into `extraction_data`
   - Store `raw_content`
3. Update staging: `extraction_status = 'complete'`

**Enhancement over current**: Extraction now has MULTIPLE URLs per record (program page + application page + guidelines PDF), giving the LLM much richer context.

---

### Skill 5: Analysis (`/analyze-pending`)

**Purpose**: Content enhancement + deterministic scoring.

**Trigger**: `"Analyze pending"` or `"Analyze opportunities for [SOURCE]"`

**Process** (existing pipeline, unchanged):
1. Query staging: `WHERE extraction_status = 'complete' AND analysis_status = 'pending'`
2. Content enhancement (LLM): 6 fields
3. Scoring (deterministic): `scoringAnalyzer.js`
4. Merge into `analysis_data`
5. Update staging: `analysis_status = 'complete'`

---

### Skill 6: Storage (`/store-pending`)

> **REVIEWED — Step 4 Discussion (Approved)**

**Purpose**: Sanitize, store to `funding_opportunities` with `promotion_status = 'pending_review'`,
and link coverage areas.

**Trigger**: `"Store pending"` or `"Store opportunities for [SOURCE]"`

**Process** (existing pipeline, enhanced):
1. Query staging: `WHERE analysis_status = 'complete' AND storage_status = 'pending'`
2. Sanitize via `dataSanitizer.js`
3. UPSERT to `funding_opportunities`:
   - **Now includes `program_id`** linking to the discovered program
   - Set `promotion_status = 'pending_review'`
   - UPSERT conflict key: `(funding_source_id, title) WHERE api_source_id IS NULL`
4. Link coverage areas via `locationMatcher.js`
   - Creates real `opportunity_coverage_areas` FK rows immediately
   - (This works because the `funding_opportunities.id` exists from step 3)
5. Update staging: `storage_status = 'complete'`, `opportunity_id = <uuid>`

**Key advantage of this approach**: Coverage areas are FK-linked immediately during storage.
The `funding_opportunities.id` exists from the UPSERT in step 3, so `locationMatcher.js`
works normally — no JSONB workaround, no deferred linking.

---

### Skill 7: Review & Publish (`/review-publish`)

> **REVIEWED — Step 4 Discussion (Approved)**

**Purpose**: Admin reviews `pending_review` records in `funding_opportunities` and
approves, rejects, or sends back for revision. This is a status flip — not a data
transfer between databases.

**Trigger**: `"Review pending"` or `"Publish approved"`

**Process**:

**Step 1 — Display review queue:**
```sql
SELECT fo.id, fo.title, fo.status, fo.description,
       fs.name as source_name, fp.name as program_name,
       fo.created_at, fo.amount_max, fo.close_date
FROM funding_opportunities fo
JOIN funding_sources fs ON fs.id = fo.funding_source_id
LEFT JOIN funding_programs fp ON fp.id = fo.program_id
WHERE fo.promotion_status = 'pending_review'
ORDER BY fo.created_at;
```

Display summary:
```
REVIEW QUEUE:
- 12 opportunities pending review (3 sources)
- APS: 5 opportunities (3 Open, 2 Upcoming)
- SRP: 4 opportunities (all Open)
- TEP: 3 opportunities (2 Open, 1 Upcoming)
```

**Step 2 — Admin review actions:**

| Action | SQL | Effect |
|--------|-----|--------|
| Approve | `SET promotion_status='promoted', reviewed_by=X, reviewed_at=NOW()` | Visible via `published_funding_opportunities` VIEW |
| Reject | `SET promotion_status='rejected', review_notes='reason', reviewed_by=X, reviewed_at=NOW()` | Permanently hidden, stays for audit |
| Needs revision | `SET promotion_status='needs_revision', review_notes='what to fix'` | Hidden; triggers re-processing |
| Approve all from [source] | Batch UPDATE by `funding_source_id` | Bulk approve trusted sources |
| Demote (existing record) | `SET promotion_status='rejected', review_notes='reason'` | Works on API records too |

**Step 3 — Handle needs_revision:**
- Reset staging record: `extraction_status = 'pending'`, `storage_status = 'pending'`
- Pipeline re-processes the record (Skills 4-5-6 re-run)
- Re-stored to `funding_opportunities` via UPSERT (updates existing row)
- Returns to `promotion_status = 'pending_review'` for another admin review

**Demotion of API records:**
This skill also supports demoting records from the API pipeline. If an API-imported
opportunity is not relevant or contains bad data, admin can set it to `'rejected'`.
The record stays in the table for audit but disappears from the frontend VIEW.

**Safety**: This skill always requires explicit admin confirmation. Never auto-triggered.

---

## 5. Complete Data Flow

### Manual Pipeline Flow (Production-First)

> **REVIEWED — Step 4 Discussion (Approved)**

```
"Register sources: Arizona utilities"
  │  (writes directly to PRODUCTION)
  ▼
funding_sources: APS, SRP, TEP registered/enriched
  (state_code='AZ', funder_type='Utility', sectors=['energy','electricity'])
source_program_urls: catalog URLs per source
  (APS → main rebates page, commercial page, implementer portal)
  │
  ▼
"Discover programs for Arizona utilities"
  (crawls source_program_urls → discovers individual programs)
  │  (writes directly to PRODUCTION)
  ▼
funding_programs:
  APS → Commercial HVAC Rebate (program_urls: [aps.com/hvac-rebate])
  APS → Lighting Retrofit     (program_urls: [aps.com/lighting])
  SRP → Cool Cash              (program_urls: [srp.com/cool-cash])
  (each with categories, status, recurrence, next_check_at=NOW())
funding_sources.programs_last_searched_at = NOW()
  │
  ▼
"Find opportunities for Arizona utilities"
  (crawls program_urls → checks if programs are Open or Upcoming)
  │
  ▼
  ┌─── OPEN: full guidelines available
  │     → staging record (extraction_status='pending')
  │     → program.next_check_at = close_date + buffer
  │
  ├─── UPCOMING: expected date known, no full details
  │     → staging record (status=Upcoming, extraction_status='pending')
  │     → program.next_check_at = before expected open date
  │     → pipeline extracts what's available, stores as Upcoming
  │     → later: re-extract via needs_refresh when Open
  │
  └─── NO INFO: no upcoming rounds detected
        → no staging record
        → program.next_check_at = +30 days (default)
  │
  ▼
"Extract pending" → "Analyze pending" → "Store pending"
  (pipeline is Upcoming-aware: no hallucination, partial info OK)
  │
  ▼
funding_opportunities:
  Records with program_id, promotion_status = 'pending_review'
  Coverage areas FK-linked immediately
  (status = 'Open' or 'Upcoming', but HIDDEN from frontend)
  │
  ▼
"Review pending" (admin review via Skill 7)
  │
  ├── Approve → promotion_status = 'promoted'
  │     → VISIBLE via published_funding_opportunities VIEW
  │
  ├── Reject → promotion_status = 'rejected'
  │     → permanently hidden, stays for audit
  │
  └── Needs revision → promotion_status = 'needs_revision'
        → re-enters pipeline (extraction reset)
        → re-processed, UPSERT updates existing row
        → back to 'pending_review'
```

### Batch Operations

```bash
# Full pipeline for one state
"Register sources: Arizona utilities"
"Discover programs for Arizona utilities"
"Find opportunities for Arizona utilities"
"Extract pending"
"Analyze pending"
"Store pending"
"Review pending"  # admin review — never auto-triggered

# Meta-skill (see Section 11 for orchestration details)
# "/run-pipeline Arizona utilities"  ← chains Skills 1→6 automatically
# Skill 7 (Review) always requires separate manual trigger
```

---

## 6. Impact on API Pipeline

### Immediate (No Changes Required)
- API pipeline continues creating opportunities with `program_id = NULL`
- `funding_sources` records created on-the-fly during storage still work
- New columns are nullable, no breaking changes

### Future Enhancement (Backfill)
When ready, the API pipeline can be enhanced to:
1. Auto-create `funding_programs` records from API data:
   - Use CFDA numbers, program names, or source groupings
   - Set `pipeline = 'api'`, `api_program_id = <cfda_number>`
2. Link existing opportunities to programs:
   ```sql
   -- Example: Group grants.gov opportunities by CFDA number
   UPDATE funding_opportunities fo
   SET program_id = fp.id
   FROM funding_programs fp
   WHERE fo.api_opportunity_id LIKE fp.api_program_id || '%';
   ```
3. This enables "program view" in the frontend for all data

### Frontend Readiness
The data model supports a future "Programs" module:
```sql
-- Programs per source with opportunity counts
SELECT
  fs.name as source_name,
  fp.name as program_name,
  fp.categories,
  fp.status as program_status,
  COUNT(fo.id) FILTER (WHERE fo.status = 'Open') as active_opportunities,
  COUNT(fo.id) as total_opportunities
FROM funding_sources fs
JOIN funding_programs fp ON fp.source_id = fs.id
LEFT JOIN funding_opportunities fo ON fo.program_id = fp.id
GROUP BY fs.id, fp.id;
```

---

## 7. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Source type field | Single `funder_type` TEXT replacing both `agency_type` and `type` | Eliminates confusing dual-column. TEXT over ENUM for flexibility. |
| Sector classification | `sectors TEXT[]` on funding_sources | Array allows multi-sector sources. Enables "all energy sources in CA" queries. |
| Source catalog URLs | Separate `source_program_urls` table | Per-URL crawl tracking (last_crawled_at). Cleaner than JSONB for querying. |
| Delinquency tracking | `programs_last_searched_at` on funding_sources | 90-day threshold. Drives program discovery scheduling. |
| Programs table | Repurpose existing `funding_programs` | Already has FK relationships, no new table needed |
| Program URLs | JSONB on `funding_programs` (not separate table) | Programs have 1-3 URLs max. Tightly coupled to program entity. `last_checked_at` on program tracks crawl freshness. |
| Dual-purpose URLs | Program URLs serve both static info + opportunity checking | Same URL crawled by Skill 2 (extract program info) and Skill 3 (check if open). Different extraction goals, same entry point. |
| Program vs opportunity data | Program has static/general info; opportunity has temporal/round-specific | Some fields overlap (categories, eligibility). Opportunity table keeps ALL existing fields — no removals, no JOINs for basic info. |
| Open status tracking | Via linked Open opportunity, NOT on program table | Program `status` = does it exist (active/inactive). "Is it open?" = EXISTS open opportunity with that program_id. |
| Smart scheduling | `next_check_at` on funding_programs, set by Skill 3 | Skill 3 learns expected dates during crawling and schedules next check intelligently. Default monthly fallback. |
| Upcoming opportunities | Two-phase lifecycle: Upcoming (partial) → Open (full) | Upcoming created with partial info from program page. Re-extracted via `needs_refresh` when guidelines published. Users see early notice. |
| URL recovery | Built into Skill 3 (inline) | On 404: try alt URLs → catalog pages → web search → flag as url_stale. No separate maintenance skill. |
| Source seeding | Web search only — NOT from coverage_areas | coverage_areas is geography, not entity data. Sources from web search + enrichment. |
| Entity registry | Database-only | `funding_sources` IS the registry. No file system, no separate registry concept. |
| Pipeline origin | Single value: 'api' or 'manual' | Records how we first learned about the source. Doesn't change later. |
| Enrichment | First run updates existing + adds new | API-created sources with missing data get backfilled. |
| Skills vs agents | Skills (SKILL.md) + subagents for parallelism | Skills define WHAT to do. Task tool spawns parallel subagents for HOW. Agent Teams (future) may enable peer-to-peer coordination. |
| Pipeline orchestration (original) | Meta-skill + coordinator pattern | Skills 1-7 run individually or chained. See Section 11 for full orchestration design. |
| Database target | All production, always | Sources, programs, catalog URLs, opportunities all go to production. `PIPELINE_DB_URL` env var for dev/testing. No local→prod transfer. |
| Approval gate | `promotion_status` on `funding_opportunities` | No shadow table. Status flip for approval. Coverage areas linked immediately. Both pipelines benefit from demotion. |
| API auto-promotion | `promotion_status = NULL` (auto-visible) | API pipeline unchanged. NULL treated as promoted in VIEW. Zero API pipeline impact. |
| Demotion | Universal via `promotion_status = 'rejected'` | Works on API AND manual records. Bad API data can be permanently hidden. Audit trail preserved. |
| Frontend safety | `published_funding_opportunities` VIEW | All frontend queries use VIEW. Raw table only for pipeline/admin. Prevents accidental display of pending/rejected. |
| Coverage area timing | Linked immediately during Skill 6 | Real `funding_opportunities.id` exists from UPSERT. No JSONB workaround needed. |
| Review metadata | `reviewed_by`, `reviewed_at`, `review_notes` on real table | Admin decisions tracked inline. No separate audit table needed. |
| Skill 7 purpose | Review & Publish (status flip) | Not DB transfer. Admin reviews pending records, flips to promoted/rejected. Simple UPDATE. |
| Pipeline DB connection | `PIPELINE_DB_URL` env var | Defaults to production. Set to local for development/testing. Single env var, not hardcoded. |
| Needs revision flow | Reset staging → re-process → UPSERT updates existing row | `needs_revision` resets staging extraction. Pipeline re-runs. UPSERT updates the same row. Back to `pending_review`. |
| API pipeline impact | None immediate | `program_id` nullable, backfill later |
| Scoring | Unchanged (`scoringAnalyzer.js`) | Deterministic, works well |
| Search capability | Opus 4.6 agentic search | Highest BrowseComp score. Multi-strategy parallel search. |
| Perpetually open opportunities | Check annually (365 days) | Opportunities with no close_date might close unexpectedly. Annual check catches this without monthly overhead. |
| Auto-close | Maintenance query: `SET status='Closed' WHERE close_date < NOW()` | Automatic, no skill needed. Once closed, program becomes eligible for next-round checking. |
| NOT EXISTS scope | Only checks for `status = 'Open'` (not Upcoming) | Upcoming opportunities still allow re-checking — Skill 3 needs to detect when Upcoming → Open. |
| Scheduling intelligence | Skill 3 sets `next_check_at` based on what it learns | "Opens in July" → July 1. "Coming summer" → June 1. No info → +30 days. Perpetual → +365 days. |
| Execution model | On-demand, no cron | User triggers "Find opportunities for X". Checks all due programs matching scope. |
| Legacy discovery-agent | Replaced by Skills 2+3 | Skills provide better structure (programs as persistent entities + opportunities as temporal). Old agent retired. |
| Crawling tools | WebFetch + Playwright + Claude-in-Chrome | WebFetch for simple HTML, Playwright for JS-rendered, Claude-in-Chrome for complex interactive. Full tool set available to all skills. |
| Cross-pipeline dedup | Enhanced NOT EXISTS in Skill 3 scheduling query | Single query catches both pipelines via `program_id` OR fuzzy `title+source`. Status-aware (Open only blocks). Zero extra steps. Self-healing as API records get backfilled. |
| Dedup status awareness | Only Open opportunities block new processing | Closed = old round, should be re-processable. Upcoming = still allow re-checking (detect when Open). |
| Pipeline orchestration | Meta-skill + sequential skill chaining | Each skill independently usable. Meta-skill (`/run-pipeline`) chains 1→6 automatically. Review & Publish (7) always manual. |
| Orchestration mechanism | Coordinator pattern (main context) | Claude Code main context orchestrates. Task tool spawns parallel subagents per skill. No Agent Teams dependency. |

---

## 8. Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDD_add_program_architecture.sql` | Schema changes (sources, programs, catalog URLs) |
| `supabase/migrations/YYYYMMDD_add_promotion_review.sql` | promotion_status, review columns, published VIEW |
| `.claude/skills/source-registry/SKILL.md` | Source discovery skill |
| `.claude/skills/discover-programs/SKILL.md` | Program discovery skill |
| `.claude/skills/discover-opportunities/SKILL.md` | Opportunity discovery skill |
| `.claude/skills/extract-pending/SKILL.md` | Extraction skill |
| `.claude/skills/analyze-pending/SKILL.md` | Analysis skill |
| `.claude/skills/store-pending/SKILL.md` | Storage skill |
| `.claude/skills/review-publish/SKILL.md` | Review & publish skill (admin approval) |
| `.claude/skills/run-pipeline/SKILL.md` | Meta-skill: full pipeline orchestration |

### Modified Files
| File | Change |
|------|--------|
| `lib/agents-v2/core/storageAgent/index.js` | Populate `program_id` during storage |
| `lib/agents-v2/core/storageAgent/fundingSourceManager.js` | Handle registry sources |
| `CLAUDE.md` | Update pipeline commands documentation |

### Existing Files (No Changes)
| File | Why Unchanged |
|------|---------------|
| `lib/agents-v2/core/analysisAgent/scoringAnalyzer.js` | Scoring logic unchanged |
| `lib/agents-v2/core/storageAgent/dataSanitizer.js` | Sanitization unchanged |
| `lib/services/locationMatcher.js` | Coverage area linking unchanged |
| `lib/constants/taxonomies.js` | Taxonomies unchanged |

---

## 9. Implementation Order

### Phase A: Schema Foundation
1. Create migration: enhance `funding_sources`, enhance `funding_programs`
2. Create migration: add `promotion_status`, review columns, `published_funding_opportunities` VIEW
3. Run migrations against dev database, verify existing data unaffected
4. Update frontend queries to use `published_funding_opportunities` VIEW

### Phase B: Core Skills (Manual Pipeline)
5. Build Skill 1: Source Registry
6. Build Skill 2: Program Discovery
7. Build Skill 3: Opportunity Discovery
8. Test: Register one state's utilities, discover programs, find opportunities

### Phase C: Processing Pipeline (Formalize Existing)
9. Build Skill 4: Extraction (formalize existing agent)
10. Build Skill 5: Analysis (formalize existing agent)
11. Build Skill 6: Storage (add program_id + promotion_status='pending_review')
12. Test: Full pipeline from source → `funding_opportunities` (pending_review)

### Phase D: Review & Publish
13. Build Skill 7: Review & Publish
14. Test: Admin approve → visible via VIEW; reject → hidden; needs_revision → re-process
15. Test: Demote API record → hidden via VIEW

### Phase E: API Pipeline Integration (Future)
16. Add program auto-creation to API pipeline
17. Backfill existing opportunities into programs
18. Build frontend Programs module
19. Build admin review UI

---

## 10. Verification Plan

### After Schema Migration
- Confirm all existing data intact
- Confirm new columns are nullable/defaulted correctly
- Confirm API pipeline still works unchanged

### After Skills Implementation
- Register Arizona utilities as test case
- Discover programs for one utility (e.g., APS)
- Find opportunities and process through full pipeline
- Verify data in local `funding_opportunities` with `program_id` populated
- Test promotion to a test production environment

### Ongoing
- Monthly: Run program discovery for registered sources
- Quarterly: Run source discovery for priority states
- Per-run: Extract → Analyze → Store → Promote cycle

---

## 11. Pipeline Orchestration

> **REVIEWED — Step 3 Discussion (Approved)**

### Cadence Table

| Skill | Frequency | Trigger | Typical Duration |
|-------|-----------|---------|------------------|
| 1. Source Registry | Quarterly | On-demand per state/type | ~5-10 min per state |
| 2. Program Discovery | On-demand | Delinquency (90 days since last search) | ~2-5 min per source |
| 3. Opportunity Discovery | On-demand | Smart scheduling (`next_check_at <= NOW()`) | ~1-2 min per program |
| 4. Extraction | Automatic | After discovery creates staging records | ~30s per record |
| 5. Analysis | Automatic | After extraction completes | ~30s per record |
| 6. Storage | Automatic | After analysis completes | ~10s per record |
| 7. Review & Publish | Manual trigger | After admin review | ~1 min per batch |

### Trigger Patterns

**Full pipeline** — runs all phases in sequence:
```
/run-pipeline [STATE] [FUNDER_TYPE]
```
- Example: `/run-pipeline Arizona utilities`
- Executes: Skills 1→2→3→4→5→6 automatically
- Skill 7 (Review & Publish) is NEVER auto-triggered — always requires admin review
- Each step reports progress summary before starting the next
- If any phase has zero records to process, it's skipped with a note

**Partial pipeline** — targeted execution of individual skills:

| Command | Skill(s) | Use Case |
|---------|----------|----------|
| `Register sources: [STATE] [TYPE]` | 1 only | Quarterly source refresh |
| `Discover programs for [X]` | 2 only | Check specific source for new programs |
| `Find opportunities for [X]` | 3 only | Check programs for open opportunities |
| `Process staging pipeline` | 4+5+6 chained | Process all pending staging records |
| `Extract pending` | 4 only | Run extraction phase only |
| `Analyze pending` | 5 only | Run analysis phase only |
| `Store pending` | 6 only | Run storage phase only |
| `Review pending` / `Publish approved` | 7 only | Admin review and publish |
| `Check staging status` | Read-only | Show counts at each pipeline stage |

**Shortcut chains** — common multi-skill sequences:

| Command | Executes | Use Case |
|---------|----------|----------|
| `Find and process opportunities for [X]` | 3→4→5→6 | Discovery + full processing |
| `Discover and find for [X]` | 2→3→4→5→6 | New source with programs to check |
| `Full refresh for [X]` | 1→2→3→4→5→6 | Complete source refresh |

### Coordinator Behavior

The main Claude Code context acts as the pipeline orchestrator:

1. **Sequential execution**: Skills run in order (1→2→3→4→5→6). Each skill must
   complete before the next starts, because later skills depend on earlier outputs.

2. **Subagent parallelism**: WITHIN each skill, the Task tool spawns parallel
   subagents for concurrent processing. For example:
   - Skill 1: parallel web searches for different entity types
   - Skill 2: parallel crawling of multiple sources
   - Skill 4: parallel extraction of multiple staging records (batches of 20)

3. **Progress reporting**: After each skill completes, the coordinator reports:
   ```
   PHASE 2 COMPLETE: Program Discovery
   Sources processed: 5
   New programs found: 23
   Updated programs: 4
   Catalog URLs crawled: 12
   → Starting Phase 3: Opportunity Discovery...
   ```

4. **Error handling**: Failed records are logged in the staging table's `*_error`
   columns. The pipeline continues — failures don't block processing of other records.

5. **Auto-close maintenance**: At the start of any pipeline run, the coordinator
   executes the auto-close maintenance query:
   ```sql
   UPDATE funding_opportunities
   SET status = 'Closed'
   WHERE status = 'Open' AND close_date < NOW() AND close_date IS NOT NULL;
   ```
   This ensures closed opportunities are marked before Skill 3 checks for new rounds.

### Operational Workflow Examples

**Weekly opportunity check (most common):**
```
User: "Find opportunities for all due programs"
  → Skill 3 queries next_check_at <= NOW() across all programs
  → Creates staging records for Open/Upcoming opportunities found
  → Skills 4→5→6 process them automatically
  → "12 new opportunities staged, 10 processed, 2 extraction errors"
  → User reviews, then: "Review pending"
  → Admin approves → records become visible via published VIEW
```

**Quarterly source refresh:**
```
User: "Full refresh for Arizona"
  → Skill 1: Checks for new utilities/agencies in AZ
  → Skill 2: Crawls all AZ sources for new programs
  → Skill 3: Checks all AZ programs for open opportunities
  → Skills 4→5→6: Processes everything
  → "3 new sources, 15 new programs, 8 open opportunities processed"
```

**Single source investigation:**
```
User: "Register sources: SRP"  (or: "Discover programs for SRP")
  → Runs just the targeted skill
  → Reports results
  → User decides whether to continue: "Find opportunities for SRP"
```

---

*Document Version: 6.0*
*Created: 2026-02-04*
*Updated: 2026-02-06*
*Status: Proposal — Steps 1-4 reviewed (schema, skills, dedup, orchestration, production-first, approval flow)*
*Supersedes: manual-v2-pipeline-architecture-proposal.md*
