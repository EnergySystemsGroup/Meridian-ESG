# Manual Pipeline: Architecture Proposal

## Non-API Funding Opportunity Discovery & Extraction via Claude Code

---

## Document Purpose

This document captures the complete analysis and proposed architecture for the **Manual Pipeline** - a systematic approach to discovering, extracting, and processing funding opportunities from sources that lack APIs. This complements the existing API Pipeline which handles centralized, aggregated sources (grants.gov, state portals with APIs, etc.).

This document is intended to be refined with an agent that has visibility into the actual project structure.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Pipeline Context: API vs Manual](#pipeline-context-api-vs-manual)
3. [Current State](#current-state)
4. [Key Insights & Design Decisions](#key-insights--design-decisions)
5. [Proposed Architecture](#proposed-architecture)
6. [File System Structure](#file-system-structure)
7. [Database Schema](#database-schema)
8. [Skills Specification](#skills-specification)
9. [Data Flow](#data-flow)
10. [Entity & Source File Schemas](#entity--source-file-schemas)
11. [Open Questions for Refinement](#open-questions-for-refinement)

---

## Problem Statement

### The Core Challenge

The **Manual Pipeline** handles funding opportunities from sources that don't have APIs - the "one-offs" that can't be pulled from centralized aggregators. This includes:

- **Utilities**: Rebate and incentive programs (PG&E, SCE, APS, SRP, etc.)
- **State Agencies**: Grant programs not in state portals (Commerce, DOT, DEQ, Water authorities)
- **Federal Programs**: Opportunities not fully captured by grants.gov API
- **Special Districts**: Water districts, irrigation districts, regional bodies
- **Local Programs**: County and city-level funding not aggregated anywhere

### What Makes This Hard

1. **No Central Aggregator**: Unlike the API Pipeline (grants.gov, California Grants Portal), these programs are scattered across hundreds of individual websites with no central registry.

2. **Discovery vs. Extraction Gap**: 
   - Finding WHERE programs are listed (discovery) is different from
   - Thoroughly extracting ALL program details from those pages (extraction)

3. **Completeness Concerns**: Web search alone cannot guarantee comprehensive coverage. Search engines return top ~10 results; programs buried in PDFs or subpages get missed.

4. **Maintenance Burden**: URLs change, programs launch/expire, sites reorganize. Need systematic refresh without starting from scratch each time.

5. **Scale**: Must work across 50 states × multiple entity types (utilities, agencies, etc.) = potentially hundreds of funding sources.

### What We're Trying to Solve

| Problem | Solution Approach |
|---------|-------------------|
| Scattered, unknown sources | Entity-first registry: enumerate funding ENTITIES, then map to their data URLs |
| Incomplete web search | Deep crawling of KNOWN sources rather than hoping search finds everything |
| Ad-hoc discovery | Systematic, repeatable skills with audit trails |
| Temp file chaos | Structured file system + database for processing state |
| Utility-only pipeline | Universal pipeline that works for any non-API funding source type |

---

## Pipeline Context: API vs Manual

### Two Complementary Pipelines

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MERIDIAN DATA PIPELINES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  API PIPELINE (Existing)                                             │   │
│  │  ├── Sources: grants.gov, California Grants Portal, SAM.gov, etc.   │   │
│  │  ├── Method: Automated API calls on schedule                        │   │
│  │  ├── Confidence: High (structured data from source)                 │   │
│  │  └── Coverage: Federal + states with APIs                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  MANUAL PIPELINE (This Document)                                     │   │
│  │  ├── Sources: Utility websites, agency pages, one-off programs      │   │
│  │  ├── Method: Claude Code skills + web crawling                      │   │
│  │  ├── Confidence: Medium-High (requires extraction + validation)     │   │
│  │  └── Coverage: Utilities, states without APIs, special programs     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                    ↓                                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  MERIDIAN DATABASE                                                   │   │
│  │  └── funding_opportunities (unified production table)               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### When to Use Which Pipeline

| Source Type | Pipeline | Why |
|-------------|----------|-----|
| grants.gov listings | API Pipeline | Has API, structured data |
| California Grants Portal | API Pipeline | Has API |
| PG&E rebate programs | **Manual Pipeline** | No API, web scraping required |
| Arizona Commerce grants | **Manual Pipeline** | No centralized API |
| Utility incentive programs | **Manual Pipeline** | Each utility has own website |
| Small municipal programs | **Manual Pipeline** | No aggregation exists |

---

## Current State

### Existing Manual Pipeline (Utilities)

The current process uses Claude Code with sub-agents:

```
DISCOVERY → STAGING TABLE → EXTRACTION → ANALYSIS → STORAGE → PRODUCTION
```

#### Phase 0: Discovery (Current)
- Web searches for utility programs (energy efficiency, EV charging, water conservation)
- Strict filtering (85% noise rejection)
- Output: Inserts record into staging with just url, title, source_id
- Status: extraction_status = 'pending'
- **Problem**: "Helter-skelter" search approach, no systematic source tracking

#### Phase 1: Extraction
- Fetches the URL (WebFetch for HTML, Playwright for PDFs)
- LLM extracts structured data into 24 fields (title, description, eligibility, amounts, dates, etc.)
- Saves to staging:
  - raw_content = the fetched HTML/text
  - extraction_data = structured JSONB with all 24 fields
- Status: extraction_status = 'complete', analysis_status = 'pending'

#### Phase 2: Analysis
- Reads extraction_data from staging
- Two parallel processes:
  - a. Content Enhancement (LLM): Generates 6 fields - enhancedDescription, actionableSummary, programOverview, programUseCases, applicationSummary, programInsights
  - b. Scoring (Deterministic): Calculates relevance scores using taxonomy matching via scoringAnalyzer.js
- Saves to staging:
  - analysis_data = merged JSONB containing ALL extraction fields + 6 enhancements + scoring object
- Status: analysis_status = 'complete', storage_status = 'pending'

#### Phase 3: Storage
- Reads analysis_data from staging
- Sanitizes data (validates, normalizes formats)
- UPSERT to funding_opportunities (production table)
- Links coverage areas (fuzzy matches locations to coverage_areas table)
- Updates staging: opportunity_id = the new production record UUID
- Status: storage_status = 'complete'

### Technical Details

| Aspect | Current Implementation |
|--------|----------------------|
| Orchestration | Claude Code with spawned sub-agents |
| Database | Local Supabase @ 127.0.0.1:54322 |
| DB Writes | psql via Bash (MCP postgres is read-only) |
| Staging Table | manual_funding_opportunities_staging |
| Production Table | funding_opportunities |
| Dedup (Import) | ON CONFLICT (url) |
| Dedup (Storage) | ON CONFLICT (funding_source_id, title) |
| Text Fields | NOT truncated (1000-2000+ chars expected) |
| Scoring | Deterministic via scoringAnalyzer.js |

### Current Limitations

1. **Discovery is unsystematic**: No registry of what sources exist or should be checked
2. **No audit trail**: Temp files disappear, can't see what was found vs. missed
3. **Utility-specific**: Pipeline designed for utilities, not easily generalized
4. **No refresh logic**: Re-running rediscovers everything, no diffing against previous runs
5. **Source tracking weak**: funding_source created ad-hoc during import

---

## Key Insights & Design Decisions

### Insight 1: Entity-First Architecture

Instead of hunting for URLs, enumerate the funding ENTITIES first:

**URL-hunting approach (fragile)**:
> "Search for Arizona utility rebates" → hope you find them all

**Entity-first approach (robust)**:
> "Arizona has these utilities: APS, SRP, TEP. For each, find their program pages."

Entities are:
- **Enumerable**: Finite list of utilities, agencies per state
- **Stable**: Agencies don't appear/disappear often (unlike URLs)
- **Auditable**: Can track exactly which entities we're monitoring vs. not

### Insight 2: Separate Discovery from Extraction

Two distinct problems with different solutions:

| Layer | Problem | Confidence | Solution |
|-------|---------|------------|----------|
| Source Discovery | "Where does APS list their rebates?" | 90-95% | One-time research + periodic verification |
| Deep Extraction | "Extract ALL programs from that page" | 85-95% | Scripted crawler + LLM parsing |

Once you KNOW the source URL, extraction can be thorough via scripted crawling. The uncertainty is in finding sources, not extracting from them.

### Insight 3: Files vs. Database Split

| Data Type | Storage | Rationale |
|-----------|---------|-----------|
| Entity Registry | Files | Stable, human-reviewable, version-controllable, portable |
| Data Sources per Entity | Files (nested) | Tied to entity, rarely changes, auditable |
| Crawl Results | Files (timestamped) | Audit trail, diff-able between runs, debuggable |
| Processing State | Database (staging) | Needs status tracking, querying, dedup |
| Final Opportunities | Database (production) | Queryable, API-accessible |

**Files = Configuration + Audit Trail**
**Database = Processing Pipeline**

### Insight 4: Skills Replace Agents

Current approach uses ad-hoc sub-agents. Better approach:
- **Skills**: Defined, documented, repeatable workflows in SKILL.md files
- **Scripts**: Heavy lifting (crawling, PDF extraction, scoring) in Python/JS
- **LLM**: Content understanding, enhancement generation

### Insight 5: Universal Manual Pipeline

The pipeline should work for ANY non-API funding source type:

```
Entity Types Covered by Manual Pipeline:
├── Utilities
│   ├── Investor-Owned (IOUs)
│   ├── Municipal
│   └── Co-ops
├── State Agencies (without API access)
│   ├── Commerce/Economic Development
│   ├── Transportation (DOT)
│   ├── Environment (DEQ)
│   ├── Water Authorities
│   └── Energy Offices
├── Regional Bodies
│   ├── COGs (Councils of Government)
│   └── MPOs (Metropolitan Planning Organizations)
├── Special Districts
│   ├── Water Districts
│   ├── Irrigation Districts
│   └── Sanitation Districts
└── Quasi-Governmental
    ├── Housing Finance Authorities
    └── Infrastructure Banks
```

Same pipeline, different entity configurations.

---

## Proposed Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MANUAL PIPELINE                                     │
│                   (Non-API Funding Opportunity Processing)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LOCAL FILE SYSTEM (Claude Code workspace)                                  │
│  ══════════════════════════════════════════                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ENTITY REGISTRY (files)                                             │   │
│  │  - All known non-API funding entities                                │   │
│  │  - Their data source URLs                                            │   │
│  │  - Organized: state → type → entity                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CRAWLER (skill + script)                                            │   │
│  │  - Reads entity's data source URLs                                   │   │
│  │  - Deep crawls each URL (subpages, PDFs)                             │   │
│  │  - Outputs: runs/[entity]/[date]/crawl-results.json                  │   │
│  │  - Generates diff against previous run                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  IMPORTER (skill)                                                    │   │
│  │  - Reads crawl results (new/changed programs)                        │   │
│  │  - INSERTs into staging table                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ════════════════════════════════════════════════════════════════════════   │
│                                    │                                        │
│  DATABASE (Supabase)               ▼                                        │
│  ════════════════════                                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  STAGING → EXTRACTION → ANALYSIS → STORAGE → PRODUCTION              │   │
│  │  (Existing pipeline, now driven by skills instead of ad-hoc agents)  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Type | Input | Output |
|-----------|------|-------|--------|
| Entity Manager | Skill | Commands | Entity JSON files |
| Source Mapper | Skill | Entity (no sources) | Updated entity with data URLs |
| Crawler | Skill + Script | Entity with sources | runs/[entity]/[date]/*.json |
| Importer | Skill | Crawl results | Staging records (pending) |
| Extractor | Skill | Pending staging | Extracted staging |
| Analyzer | Skill + Script | Extracted staging | Analyzed staging |
| Storage | Skill | Analyzed staging | Production records |

---

## File System Structure

```
/manual-pipeline/                          # Or integrate into existing project structure
├── CLAUDE.md                              # Master context for Claude Code
│
├── .claude/
│   ├── rules/
│   │   ├── data-standards.md              # Meridian schema requirements
│   │   └── verification.md                # Always-verify rules
│   │
│   └── skills/
│       ├── entity-manager/
│       │   └── SKILL.md
│       ├── source-mapper/
│       │   └── SKILL.md
│       ├── crawler/
│       │   ├── SKILL.md
│       │   └── scripts/
│       │       ├── crawler.py             # Deep crawl logic
│       │       └── pdf-extractor.py       # PDF text extraction
│       ├── importer/
│       │   └── SKILL.md
│       ├── extractor/
│       │   └── SKILL.md
│       ├── analyzer/
│       │   ├── SKILL.md
│       │   └── scripts/
│       │       └── scoringAnalyzer.js     # Deterministic scoring
│       └── storage/
│           └── SKILL.md
│
├── data/
│   ├── entities/
│   │   ├── _index.json                    # Master list of all manual entities
│   │   │
│   │   ├── federal/                       # Federal programs not in API pipeline
│   │   │   └── [entity].json
│   │   │
│   │   └── states/
│   │       ├── arizona/
│   │       │   ├── _state-index.json      # All AZ manual entities
│   │       │   ├── utilities/
│   │       │   │   ├── aps.json
│   │       │   │   ├── srp.json
│   │       │   │   └── tep.json
│   │       │   ├── agencies/
│   │       │   │   ├── az-commerce.json
│   │       │   │   ├── adot.json
│   │       │   │   ├── azdeq.json
│   │       │   │   └── wifa.json
│   │       │   └── special-districts/
│   │       │       └── ...
│   │       │
│   │       ├── california/
│   │       │   ├── _state-index.json
│   │       │   ├── utilities/
│   │       │   │   ├── pge.json
│   │       │   │   ├── sce.json
│   │       │   │   └── sdge.json
│   │       │   └── agencies/
│   │       │       └── ...
│   │       │
│   │       └── [other states]/
│   │
│   └── runs/                              # Crawl history (audit trail)
│       └── [entity-id]/
│           ├── 2026-01-15/
│           │   ├── crawl-results.json     # All programs found
│           │   ├── diff.json              # New/changed since last run
│           │   └── crawl-log.txt          # Debug info
│           ├── 2026-02-15/
│           │   └── ...
│           └── latest -> 2026-02-15/      # Symlink to most recent
│
├── scripts/                               # Shared utility scripts
│   ├── crawler.py
│   ├── pdf-extractor.py
│   └── scoringAnalyzer.js
│
└── logs/
    └── manual-pipeline.log                # Overall processing log
```

---

## Database Schema

### Tables Overview

| Table | Purpose | Managed By |
|-------|---------|------------|
| funding_sources | Registry of funding entities (both API and Manual) | Entity Manager skill (syncs from files) |
| manual_funding_opportunities_staging | Manual Pipeline processing | Importer → Extractor → Analyzer → Storage |
| funding_opportunities | Production data (both pipelines feed here) | Storage skill |
| coverage_areas | Geographic coverage | Storage skill (linking) |

### funding_sources

```sql
-- Note: This table likely already exists and serves both pipelines
-- The Manual Pipeline adds entries for non-API sources

CREATE TABLE funding_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT UNIQUE NOT NULL,        -- e.g., "aps", "az-commerce"
  name TEXT NOT NULL,                     -- e.g., "Arizona Public Service"
  type TEXT NOT NULL,                     -- e.g., "utility", "agency"
  subtype TEXT,                           -- e.g., "investor-owned", "state"
  state TEXT,                             -- e.g., "AZ"
  pipeline TEXT DEFAULT 'manual',         -- 'api' or 'manual'
  entity_file_path TEXT,                  -- e.g., "states/arizona/utilities/aps.json"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### manual_funding_opportunities_staging

```sql
CREATE TABLE manual_funding_opportunities_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Discovery fields (from Importer)
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  funding_source_id UUID REFERENCES funding_sources(id),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  crawl_run TEXT,                         -- e.g., "aps/2026-01-15"
  
  -- Extraction fields
  raw_content TEXT,                       -- Fetched HTML/text
  extraction_data JSONB,                  -- 24 structured fields
  extraction_status TEXT DEFAULT 'pending',  -- pending, complete, failed
  extracted_at TIMESTAMPTZ,
  
  -- Analysis fields
  analysis_data JSONB,                    -- extraction + 6 enhancements + scoring
  analysis_status TEXT DEFAULT 'pending',    -- pending, complete, failed
  analyzed_at TIMESTAMPTZ,
  
  -- Storage fields
  storage_status TEXT DEFAULT 'pending',     -- pending, complete, failed
  stored_at TIMESTAMPTZ,
  opportunity_id UUID REFERENCES funding_opportunities(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### funding_opportunities (Production)

Structure TBD - assumed to exist and receive data from both API and Manual pipelines.

---

## Skills Specification

### Skill 1: Entity Manager

**Location**: `.claude/skills/entity-manager/SKILL.md`

**Commands**:
```
entity add <state> <type> <entity-id> --name "Full Name"
entity list [state] [type]
entity show <entity-id>
entity update <entity-id> [--name "..."] [--add-source "url"]
entity sync <entity-id>   # Sync to funding_sources table
entity sync all           # Sync all entities to database
```

**Behavior**:
- Creates/updates entity JSON files in data/entities/
- Maintains _index.json and _state-index.json files
- `sync` command upserts to funding_sources table with pipeline='manual'

### Skill 2: Source Mapper

**Location**: `.claude/skills/source-mapper/SKILL.md`

**Commands**:
```
map-sources <entity-id>
map-sources <entity-id> --verify   # Check existing sources still work
```

**Behavior**:
- For entity with empty/incomplete data_sources
- Searches for entity's funding/rebate/grant pages
- Proposes URLs with descriptions
- Human confirms, then updates entity file

### Skill 3: Crawler

**Location**: `.claude/skills/crawler/SKILL.md`

**Commands**:
```
crawl <entity-id>
crawl <entity-id> --depth 3
crawl all <state>/<type>          # e.g., crawl all arizona/utilities
crawl all                         # All entities with sources
```

**Behavior**:
1. Reads entity file for data_sources
2. For each source URL:
   - Runs crawler.py script
   - Traverses to configured depth
   - Extracts links to subpages and PDFs
   - Downloads and parses PDFs
3. Collects all program page URLs
4. Saves to data/runs/[entity]/[date]/crawl-results.json
5. Compares to previous run (if exists)
6. Generates diff.json with new/changed/removed programs
7. Updates "latest" symlink

**crawl-results.json Schema**:
```json
{
  "entity_id": "aps",
  "crawl_date": "2026-01-15T10:30:00Z",
  "sources_crawled": [
    {
      "url": "https://www.aps.com/...",
      "pages_found": 15,
      "pdfs_found": 3
    }
  ],
  "programs": [
    {
      "url": "https://www.aps.com/rebates/commercial-hvac",
      "title": "Commercial HVAC Rebate Program",
      "found_at": "https://www.aps.com/business/rebates",
      "content_hash": "abc123...",
      "pdf_links": ["https://...guideline.pdf"]
    }
  ],
  "total_programs": 12,
  "crawl_duration_seconds": 45
}
```

**diff.json Schema**:
```json
{
  "entity_id": "aps",
  "current_run": "2026-01-15",
  "previous_run": "2025-12-15",
  "new_programs": [
    { "url": "...", "title": "..." }
  ],
  "changed_programs": [
    { "url": "...", "title": "...", "change": "content_hash changed" }
  ],
  "removed_programs": [
    { "url": "...", "title": "..." }
  ],
  "unchanged_count": 8
}
```

### Skill 4: Importer

**Location**: `.claude/skills/importer/SKILL.md`

**Commands**:
```
import <entity-id>
import <entity-id> --only-new     # Only from diff.json new_programs
import <entity-id> --run 2026-01-15   # Specific run
import all pending                # All entities with unimported runs
```

**Behavior**:
1. Reads data/runs/[entity]/latest/diff.json (or crawl-results.json)
2. Looks up funding_source_id from entity file
3. For each program:
   - INSERT INTO manual_funding_opportunities_staging (url, title, funding_source_id, crawl_run)
   - ON CONFLICT (url) DO NOTHING
   - Set extraction_status = 'pending'
4. Reports: X inserted, Y skipped (duplicates)

### Skill 5: Extractor

**Location**: `.claude/skills/extractor/SKILL.md`

**Commands**:
```
extract pending
extract pending --limit 10
extract --source <entity-id>
extract --id <staging-uuid>
```

**Behavior**:
1. Query staging for extraction_status = 'pending'
2. For each record:
   - WebFetch URL (or Playwright for PDF/JS-heavy)
   - Store raw_content
   - LLM extracts 24 structured fields
   - Store extraction_data as JSONB
   - Set extraction_status = 'complete', analysis_status = 'pending'
3. Handle failures: extraction_status = 'failed', log error

**Extraction Fields (24)**:
```
title, description, program_type, funding_type, 
eligibility_applicant_types, eligibility_project_types, eligibility_requirements,
funding_amount_min, funding_amount_max, funding_amount_description,
cost_share_required, cost_share_percentage, cost_share_description,
deadline, deadline_type, application_url, application_process,
contact_name, contact_email, contact_phone,
geographic_coverage, geographic_restrictions,
additional_info, source_last_updated
```

### Skill 6: Analyzer

**Location**: `.claude/skills/analyzer/SKILL.md`

**Commands**:
```
analyze pending
analyze pending --limit 10
analyze --source <entity-id>
analyze --id <staging-uuid>
```

**Behavior**:
1. Query staging for analysis_status = 'pending'
2. For each record:
   - Read extraction_data
   - LLM generates 6 enhancement fields:
     - enhancedDescription
     - actionableSummary
     - programOverview
     - programUseCases
     - applicationSummary
     - programInsights
   - Run scoringAnalyzer.js for deterministic scoring
   - Merge: analysis_data = extraction_data + enhancements + scoring
   - Set analysis_status = 'complete', storage_status = 'pending'

### Skill 7: Storage

**Location**: `.claude/skills/storage/SKILL.md`

**Commands**:
```
store pending
store pending --limit 10
store --source <entity-id>
store --id <staging-uuid>
```

**Behavior**:
1. Query staging for storage_status = 'pending'
2. For each record:
   - Read analysis_data
   - Sanitize and validate
   - UPSERT to funding_opportunities
     - ON CONFLICT (funding_source_id, title) DO UPDATE
   - Link coverage_areas (fuzzy match geographic fields)
   - Update staging: opportunity_id, storage_status = 'complete'

---

## Data Flow

### Complete Manual Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPLETE MANUAL PIPELINE FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SETUP PHASE (One-time per entity)                                          │
│  ─────────────────────────────────                                          │
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │  entity add      │ →  │  map-sources     │ →  │  Human review    │      │
│  │  arizona utility │    │  aps             │    │  & confirm       │      │
│  │  aps             │    │                  │    │                  │      │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘      │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│  [data/entities/states/     [Proposed URLs]      [Entity file updated      │
│   arizona/utilities/                               with data_sources]       │
│   aps.json created]                                                         │
│                                                                             │
│  ────────────────────────────────────────────────────────────────────────   │
│                                                                             │
│  PROCESSING PHASE (Scheduled/On-demand)                                     │
│  ──────────────────────────────────────                                     │
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │  crawl aps       │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  [data/runs/aps/2026-01-15/crawl-results.json]                             │
│  [data/runs/aps/2026-01-15/diff.json]                                      │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │  import aps      │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  [staging: extraction_status='pending']                                     │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │  extract pending │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  [staging: extraction_data populated, analysis_status='pending']            │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │  analyze pending │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  [staging: analysis_data populated, storage_status='pending']               │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │  store pending   │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  [funding_opportunities: production record created/updated]                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Batch Operations

```bash
# Process all Arizona utilities
crawl all arizona/utilities
import all pending
extract pending
analyze pending
store pending

# Full pipeline for single entity
crawl aps && import aps && extract pending && analyze pending && store pending
```

---

## Entity & Source File Schemas

### Entity File Schema

```json
{
  "$schema": "entity-schema.json",
  "entity_id": "aps",
  "name": "Arizona Public Service (APS)",
  "type": "utility",
  "subtype": "investor-owned",
  "state": "AZ",
  "region": "arizona",
  "pipeline": "manual",
  
  "funding_source": {
    "id": "uuid-from-database-or-null",
    "synced_at": "2026-01-15T10:00:00Z"
  },
  
  "data_sources": [
    {
      "url": "https://www.aps.com/en/Business/Save-Money-and-Energy/Business-Solutions-and-Rebates",
      "type": "program_listing",
      "crawl_depth": 2,
      "include_pdfs": true,
      "last_crawled": "2026-01-15T10:30:00Z",
      "notes": "Main business rebates page"
    },
    {
      "url": "https://www.aps.com/en/Residential/Save-Money-and-Energy/Rebates-and-Incentives",
      "type": "program_listing",
      "crawl_depth": 2,
      "include_pdfs": true,
      "last_crawled": "2026-01-15T10:35:00Z",
      "notes": "Residential programs - may filter out"
    }
  ],
  
  "filters": {
    "exclude_residential": false,
    "require_keywords": ["commercial", "business", "rebate", "incentive"],
    "exclude_keywords": []
  },
  
  "metadata": {
    "created_at": "2026-01-10T09:00:00Z",
    "updated_at": "2026-01-15T10:00:00Z",
    "created_by": "manual",
    "verified_by": "human",
    "notes": "IOU serving most of Arizona except Tucson area (TEP territory)"
  }
}
```

### State Index Schema

```json
{
  "$schema": "state-index-schema.json",
  "state": "AZ",
  "state_name": "Arizona",
  "region": "arizona",
  "last_updated": "2026-01-15T10:00:00Z",
  
  "entities": {
    "utilities": ["aps", "srp", "tep", "unisource"],
    "agencies": ["az-commerce", "adot", "azdeq", "wifa"],
    "special_districts": []
  },
  
  "coverage_stats": {
    "total_entities": 8,
    "entities_with_sources": 6,
    "entities_pending_sources": 2,
    "last_full_crawl": "2026-01-15T12:00:00Z"
  }
}
```

### Master Index Schema

```json
{
  "$schema": "master-index-schema.json",
  "pipeline": "manual",
  "last_updated": "2026-01-15T12:00:00Z",
  
  "federal": {
    "entities": []
  },
  
  "states": {
    "arizona": "states/arizona/_state-index.json",
    "california": "states/california/_state-index.json"
  },
  
  "stats": {
    "total_states": 2,
    "total_entities": 45,
    "total_with_sources": 38
  }
}
```

---

## Open Questions for Refinement

### Questions About Existing Project Structure

1. **Current file locations**: Where do temp files currently live? Is there an existing data/ folder structure?

2. **Existing scripts**: Where is scoringAnalyzer.js located? Are there other scripts to incorporate?

3. **Database schema**: What's the exact schema of funding_sources and funding_opportunities tables?

4. **Connection strings**: How are database connections currently configured? Environment variables?

5. **Agent instructions**: Where do the current agent instructions live? In CLAUDE.md or elsewhere?

6. **API Pipeline integration**: How does the API Pipeline store its data? Same tables? Different schema?

### Questions About Desired Behavior

7. **Entity hierarchy**: Is `state → type → entity` the right organization, or should it be `type → state → entity`?

8. **Crawl frequency**: Different refresh rates for different entity types? (Utilities monthly, agencies quarterly?)

9. **Human-in-loop points**: Where exactly should the pipeline pause for human review?

10. **Failure handling**: What happens when extraction fails for a URL? Retry logic? Manual queue?

11. **Production deployment**: How does data get from local Supabase to production? Should this pipeline include that step?

### Technical Questions

12. **PDF handling**: Current Playwright usage - is this for PDFs specifically or for JavaScript-rendered pages?

13. **Rate limiting**: Any concerns about crawling frequency hitting site rate limits?

14. **Content hashing**: How should we detect "changed" vs "unchanged" programs between crawls?

15. **Dedup edge cases**: What if same program exists under different URLs? Or URL changes but program is the same?

### Scale Questions

16. **Priority states**: Which states should be set up first? California? Arizona? Others?

17. **Entity completeness**: For a given state, how complete does the entity registry need to be before we start crawling?

18. **Maintenance burden**: Who maintains the entity registry? Automated discovery of new entities, or purely manual?

---

## Next Steps

1. **Review this document** with the agent that has project visibility
2. **Answer the open questions** to refine the design
3. **Map to existing project structure** - what can be reused, what needs to change
4. **Prioritize implementation** - which skills to build first
5. **Create initial entity files** for one state as proof of concept
6. **Build and test skills** incrementally

---

## Appendix: Entity Type Templates

### Template: State Agency

```json
{
  "entity_id": "{state-abbrev}-{agency-type}",
  "type": "agency",
  "subtype": "{commerce|dot|deq|water|energy|housing}",
  "pipeline": "manual",
  "data_sources": [
    {
      "url": "https://{agency-domain}/grants",
      "type": "program_listing",
      "crawl_depth": 2
    }
  ]
}
```

### Template: Investor-Owned Utility

```json
{
  "entity_id": "{utility-abbrev}",
  "type": "utility",
  "subtype": "investor-owned",
  "pipeline": "manual",
  "data_sources": [
    {
      "url": "https://{utility-domain}/business/rebates",
      "type": "program_listing",
      "crawl_depth": 2,
      "notes": "Business/commercial programs"
    }
  ]
}
```

### Template: Municipal Utility

```json
{
  "entity_id": "{city}-utility",
  "type": "utility",
  "subtype": "municipal",
  "pipeline": "manual",
  "data_sources": [
    {
      "url": "https://{city-domain}/utilities/rebates",
      "type": "program_listing",
      "crawl_depth": 2
    }
  ]
}
```

### Template: Water Authority

```json
{
  "entity_id": "{state-abbrev}-{water-agency}",
  "type": "agency",
  "subtype": "water",
  "pipeline": "manual",
  "data_sources": [
    {
      "url": "https://{agency-domain}/funding",
      "type": "program_listing",
      "crawl_depth": 2
    }
  ]
}
```

---

*Document Version: 1.0*
*Created: 2026-02-04*
*Status: Proposal - Pending Refinement with Project Agent*
*Pipeline: Manual (Non-API)*
