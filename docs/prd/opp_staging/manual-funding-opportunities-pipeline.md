# Manual Funding Opportunities Pipeline

## Overview

This document defines the staging table and processing pipeline for funding opportunities that don't come from APIs (utility programs, county grants, foundation programs, etc.). The system supports manual processing via Claude Code agents.

**Table**: `manual_funding_opportunities_staging`

**Pipeline Flow**: Discovery → Extraction → Analysis → Storage

---

## 1. Staging Table: `manual_funding_opportunities_staging`

### Current Schema (Post-Migration)

```sql
CREATE TABLE manual_funding_opportunities_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source Identification (FK to funding_sources)
  source_id UUID REFERENCES funding_sources(id),

  -- Program Identification
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content_type TEXT,                      -- 'html', 'pdf', 'unknown'

  -- Discovery Metadata
  discovery_method TEXT NOT NULL,         -- 'cc_agent', 'manual_entry', 'web_scrape', 'import'
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  discovered_by TEXT,                     -- 'discovery_agent', 'user:email', etc.

  -- Raw Content (fetched but not yet extracted)
  raw_content TEXT,                       -- HTML/text content from URL
  raw_content_fetched_at TIMESTAMPTZ,

  -- Stage 1: Extraction
  extraction_status TEXT DEFAULT 'pending',  -- pending, processing, complete, error, skipped
  extraction_data JSONB,                     -- Structured data matching dataExtraction schema
  extraction_error TEXT,
  extracted_at TIMESTAMPTZ,
  extracted_by TEXT,                         -- 'extraction_agent', 'api:extraction'

  -- Stage 2: Analysis
  analysis_status TEXT DEFAULT 'pending',    -- pending, processing, complete, error, skipped
  analysis_data JSONB,                       -- Enhanced content + scoring
  analysis_error TEXT,
  analyzed_at TIMESTAMPTZ,
  analyzed_by TEXT,

  -- Stage 3: Storage
  storage_status TEXT DEFAULT 'pending',     -- pending, processing, complete, error, skipped
  opportunity_id UUID REFERENCES funding_opportunities(id),  -- FK after storage
  storage_error TEXT,
  stored_at TIMESTAMPTZ,
  stored_by TEXT,

  -- Refresh Tracking
  last_verified_at TIMESTAMPTZ,
  refresh_interval_days INT DEFAULT 90,
  needs_refresh BOOLEAN DEFAULT FALSE,
  source_hash TEXT,                          -- Hash of raw_content for change detection

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique Constraints (Deduplication)
CREATE UNIQUE INDEX mfos_unique_url ON manual_funding_opportunities_staging(url);
CREATE UNIQUE INDEX idx_mfos_unique_source_title
  ON manual_funding_opportunities_staging(source_id, title)
  WHERE source_id IS NOT NULL;

-- Partial Indexes for Status Queries
CREATE INDEX idx_mfos_extraction_pending ON manual_funding_opportunities_staging(extraction_status)
  WHERE extraction_status = 'pending';
CREATE INDEX idx_mfos_analysis_pending ON manual_funding_opportunities_staging(analysis_status)
  WHERE analysis_status = 'pending';
CREATE INDEX idx_mfos_storage_pending ON manual_funding_opportunities_staging(storage_status)
  WHERE storage_status = 'pending';
CREATE INDEX idx_mfos_needs_refresh ON manual_funding_opportunities_staging(needs_refresh)
  WHERE needs_refresh = TRUE;
CREATE INDEX idx_mfos_source_id ON manual_funding_opportunities_staging(source_id);
```

### Key Relationships

```
funding_sources (id, name, type)
       │
       │ source_id FK
       ▼
manual_funding_opportunities_staging
       │
       │ opportunity_id FK (after storage)
       ▼
funding_opportunities (id, funding_source_id, title, ...)
```

---

## 2. Processing Pipeline

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 0: DISCOVERY                                   │
│  Agent: discovery-agent (.claude/agents/discovery-agent.md)                 │
│  Input: List of utilities from coverage_areas table                         │
│  Process: Web search → Strict filtering → Insert to staging                 │
│  Output: Rows in staging with url, source_id, title                         │
│  Status: extraction_status = 'pending'                                      │
│  Deduplication: ON CONFLICT (url) DO NOTHING                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ [Can STOP here, review staging, then continue]
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1: EXTRACTION                                  │
│  Agent: extraction-agent (.claude/agents/extraction-agent.md)               │
│  Input: Records WHERE extraction_status = 'pending'                         │
│  Process: WebFetch URL → LLM extraction → structured JSON                   │
│  Output: extraction_data JSONB populated                                    │
│  Status: extraction_status = 'complete', analysis_status = 'pending'        │
│  Reference: lib/agents-v2/utils/anthropicClient.js (dataExtraction schema)  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ [Can STOP here, review extraction, then continue]
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 2: ANALYSIS                                    │
│  Agent: analysis-agent (.claude/agents/analysis-agent.md)                   │
│  Input: Records WHERE extraction_status = 'complete' AND analysis = pending │
│  Process: Content enhancement + V2 scoring (no fetching needed)             │
│  Output: analysis_data JSONB populated                                      │
│  Status: analysis_status = 'complete', storage_status = 'pending'           │
│  Reference: lib/agents-v2/utils/anthropicClient.js (analysis schemas)       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ [Can STOP here, review analysis, then continue]
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 3: STORAGE                                     │
│  Agent: storage-agent (.claude/agents/storage-agent.md)                     │
│  Input: Records WHERE analysis_status = 'complete' AND storage = pending    │
│  Process: Sanitize → UPSERT to funding_opportunities → Link coverage areas  │
│  Output: opportunity_id linked back to staging                              │
│  Status: storage_status = 'complete'                                        │
│  Reference: lib/agents-v2/core/storageAgent/dataSanitizer.js                │
│  Reference: lib/services/locationMatcher.js                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase Details

### Phase 0: Discovery

**Agent Config**: `.claude/agents/discovery-agent.md`

**Trigger**: "Run discovery for [utility name]" or "Run utility discovery for [STATE]"

**Process**:
1. Get utilities from `coverage_areas` table or from user input
2. Execute 6-10 search queries per utility
3. Apply strict filtering (integrated pruning rules):
   - Reject aggregator domains (energybot.com, openei.org, etc.)
   - Reject landing pages (/programs/, /rebates/, /incentives/)
   - Reject news, press releases, regulatory filings
   - Keep only specific program documentation
4. Lookup/create funding source in `funding_sources` table
5. Insert valid programs to staging with `ON CONFLICT (url) DO NOTHING`

**Expected Output**:
- Major IOUs: 10-20 programs each
- Municipal utilities: 2-8 programs each
- CCAs: 1-5 programs each

**Deduplication**: URL uniqueness prevents duplicates across multiple discovery runs.

---

### Phase 1: Extraction

**Agent Config**: `.claude/agents/extraction-agent.md`

**Trigger**: "Extract pending opportunities" or "Run extraction for [ID]"

**Query**:
```sql
SELECT * FROM manual_funding_opportunities_staging
WHERE extraction_status = 'pending'
ORDER BY created_at ASC
LIMIT 20;
```

**Process**:
1. Fetch URL content via WebFetch
2. Extract structured data using V2 dataExtraction schema
3. Store in `extraction_data` JSONB column
4. Update status: `extraction_status = 'complete'`

**Schema Reference**: `lib/agents-v2/utils/anthropicClient.js` → `dataExtraction`

**extraction_data Structure**:
```json
{
  "id": "pge-ev-fleet-program-a1b2",
  "title": "EV Fleet Program",
  "description": "Rebates for commercial EV charging...",
  "eligibleApplicants": ["Commercial", "Industrial", "Government"],
  "eligibleProjectTypes": ["EV Charging", "Fleet Electrification"],
  "eligibleActivities": ["Equipment Purchase", "Installation"],
  "fundingType": "rebate",
  "minimumAward": 5000,
  "maximumAward": 500000,
  "totalFundingAvailable": null,
  "openDate": "2024-01-01",
  "closeDate": null,
  "status": "open",
  "eligibleLocations": ["PG&E service territory"],
  "matchingRequired": false,
  "disbursementType": "direct_payment",
  "awardProcess": "first-come-first-served",
  "categories": ["Transportation", "EV"],
  "tags": ["ev", "fleet", "charging"],
  "notes": "Must be existing PG&E customer..."
}
```

---

### Phase 2: Analysis

**Agent Config**: `.claude/agents/analysis-agent.md`

**Trigger**: "Analyze extracted opportunities" or "Run analysis for [ID]"

**Query**:
```sql
SELECT * FROM manual_funding_opportunities_staging
WHERE extraction_status = 'complete'
  AND analysis_status = 'pending'
ORDER BY created_at ASC
LIMIT 20;
```

**Process**:
1. Read extraction_data (no URL fetching needed)
2. Generate content enhancements (programOverview, useCases, etc.)
3. Calculate V2 scoring (clientRelevance, projectRelevance, etc.)
4. Store in `analysis_data` JSONB column
5. Update status: `analysis_status = 'complete'`

**Schema Reference**: `lib/agents-v2/utils/anthropicClient.js` → `contentEnhancement`, `scoringAnalysis`

**analysis_data Structure**:
```json
{
  "enhancedDescription": "2-3 paragraph strategic description...",
  "actionableSummary": "3-5 sentence sales-focused summary...",
  "programOverview": "Elevator pitch (<75 words)...",
  "programUseCases": "- Use case 1\n- Use case 2\n- Use case 3",
  "applicationSummary": "Step-by-step application process...",
  "programInsights": "- Non-obvious detail 1\n- Detail 2",
  "scoring": {
    "clientRelevance": { "score": 3, "reasoning": "..." },
    "projectRelevance": { "score": 3, "reasoning": "..." },
    "fundingAttractiveness": { "score": 2, "reasoning": "..." },
    "fundingType": { "score": 1, "reasoning": "..." },
    "finalScore": 8.0
  },
  "relevanceReasoning": "Overall relevance explanation...",
  "concerns": ["Limited funding available", "First-come-first-served"]
}
```

---

### Phase 3: Storage

**Agent Config**: `.claude/agents/storage-agent.md`

**Trigger**: "Store analyzed opportunities" or "Run storage for [ID]"

**Query**:
```sql
SELECT * FROM manual_funding_opportunities_staging
WHERE analysis_status = 'complete'
  AND storage_status = 'pending'
ORDER BY created_at ASC;
```

**Process**:
1. Read staging record with source_id, extraction_data, analysis_data
2. Apply data sanitization (`lib/agents-v2/core/storageAgent/dataSanitizer.js`)
3. UPSERT to `funding_opportunities` with conflict key `(funding_source_id, title)`
4. Link coverage areas via `linkOpportunityToCoverageAreas()`
5. Update staging: `storage_status = 'complete'`, `opportunity_id = [returned UUID]`

**CRITICAL**: Use `psql` for writes, not `mcp__postgres__query` (read-only).

**UPSERT Strategy**:
```sql
INSERT INTO funding_opportunities (funding_source_id, title, description, ...)
VALUES (...)
ON CONFLICT (funding_source_id, title) WHERE api_source_id IS NULL
DO UPDATE SET description = EXCLUDED.description, ...
RETURNING id;
```

---

## 4. JSONB Schema Reference

### extraction_data (V2 dataExtraction)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Generated ID (slug-hash format) |
| title | string | Program name |
| description | string | Raw description |
| eligibleApplicants | string[] | Who can apply |
| eligibleProjectTypes | string[] | Eligible project categories |
| eligibleActivities | string[] | Eligible activities |
| fundingType | string | rebate, grant, loan, etc. |
| minimumAward | number | Minimum funding amount |
| maximumAward | number | Maximum funding amount |
| totalFundingAvailable | number | Total program budget |
| openDate | string | Application open date (ISO) |
| closeDate | string | Application deadline (ISO) |
| status | string | open, closed, upcoming |
| eligibleLocations | string[] | Geographic eligibility |
| matchingRequired | boolean | Cost share required? |
| disbursementType | string | How funds are paid |
| awardProcess | enum | competitive, first-come-first-served, lottery, formula-based, rolling, unknown |
| categories | string[] | Program categories |
| tags | string[] | Searchable tags |
| notes | string | Additional details |

### analysis_data (V2 contentEnhancement + scoringAnalysis)

| Field | Type | Description |
|-------|------|-------------|
| enhancedDescription | string | 2-3 paragraph strategic description |
| actionableSummary | string | 3-5 sentence sales summary |
| programOverview | string | <75 word elevator pitch |
| programUseCases | string | Bullet list of use cases |
| applicationSummary | string | Application process steps |
| programInsights | string | Non-obvious program details |
| scoring | object | V2 scoring with breakdowns |
| scoring.finalScore | number | 0-10 relevance score |
| relevanceReasoning | string | Why this score |
| concerns | string[] | Red flags or limitations |

---

## 5. Claude Code Agent Configs

| Agent | Config File | Purpose |
|-------|-------------|---------|
| Discovery | `.claude/agents/discovery-agent.md` | Web search + strict filtering |
| Extraction | `.claude/agents/extraction-agent.md` | URL fetch + structured extraction |
| Analysis | `.claude/agents/analysis-agent.md` | Content enhancement + scoring |
| Storage | `.claude/agents/storage-agent.md` | Sanitize + UPSERT + coverage linking |

---

## 6. Orchestration via CLAUDE.md

The main Claude Code session acts as orchestrator. See `CLAUDE.md` section "Utility Program Discovery Pipeline" for:
- Trigger commands
- Batch sizing
- Agent coordination
- Progress tracking

---

## 7. Database Write Access

**CRITICAL**: The MCP postgres tool (`mcp__postgres__query`) is **READ-ONLY**.

For all INSERT/UPDATE operations, use psql via Bash:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "YOUR SQL HERE"
```

---

## 8. Deduplication Strategy

### At Discovery (Staging Insert)
- `ON CONFLICT (url) DO NOTHING` - URL uniqueness
- `ON CONFLICT (source_id, title) DO NOTHING` - Source+title uniqueness

### At Storage (Opportunities Insert)
- `ON CONFLICT (funding_source_id, title) WHERE api_source_id IS NULL` - CC pipeline records
- Existing constraint `(title, api_source_id)` - API pipeline records

---

## 9. Error Handling

Each phase tracks errors in dedicated columns:
- `extraction_error` - Why extraction failed
- `analysis_error` - Why analysis failed
- `storage_error` - Why storage failed

Status values: `pending` → `processing` → `complete` | `error` | `skipped`

Failed records can be retried by resetting status to `pending`.

---

## 10. Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Staging table | ✅ DONE | Migrated, renamed from manual_funding_sources |
| Discovery agent | ✅ DONE | Integrated pruning, database output |
| Extraction agent | ✅ DONE | V2 schema reference |
| Analysis agent | ✅ DONE | V2 scoring reference |
| Storage agent | ✅ DONE | V2 function reference |
| CLAUDE.md orchestration | 🔄 NEEDS UPDATE | Points to old utility-discovery PRD |
| API endpoints | 📋 PLANNED | Not yet implemented |
| Cron automation | 📋 PLANNED | Not yet implemented |
