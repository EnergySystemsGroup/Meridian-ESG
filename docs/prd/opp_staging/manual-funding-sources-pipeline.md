# Non-API Funding Sources Pipeline

## Overview

This plan establishes a staging table and processing pipeline for funding opportunities that don't come from APIs (utility programs, county grants, foundation programs, etc.). The system supports both manual processing via Claude Code and automated processing via API endpoints using Claude Code SDK.

---

## 1. Staging Table: `manual_funding_sources`

### Schema

```sql
CREATE TABLE manual_funding_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source Identification
  source_type TEXT NOT NULL,              -- 'utility', 'county', 'state', 'foundation', 'other'
  source_name TEXT NOT NULL,              -- 'Pacific Gas & Electric', 'Alameda County'
  source_id UUID REFERENCES funding_sources(id),  -- FK to funding_sources only

  -- Program Identification
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content_type TEXT,                      -- 'html', 'pdf', 'unknown'

  -- Discovery Metadata
  discovery_method TEXT NOT NULL,         -- 'cc_agent', 'manual_entry', 'web_scrape', 'import'
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  discovered_by TEXT,                     -- 'claude_code', 'user:email', 'cron:discovery'

  -- Raw Content (fetched but not yet extracted)
  raw_content TEXT,                       -- HTML/text content from URL
  raw_content_fetched_at TIMESTAMPTZ,

  -- Stage 1: Extraction
  extraction_status TEXT DEFAULT 'pending',  -- pending, processing, complete, error, skipped
  extraction_data JSONB,                     -- Structured data matching dataExtraction schema
  extraction_error TEXT,
  extracted_at TIMESTAMPTZ,
  extracted_by TEXT,                         -- 'cc_manual', 'api:extraction', 'cc_sdk'

  -- Stage 2: Analysis
  analysis_status TEXT DEFAULT 'pending',    -- pending, processing, complete, error, skipped
  analysis_data JSONB,                       -- Enhanced content + scoring (contentEnhancement + scoringAnalysis)
  analysis_error TEXT,
  analyzed_at TIMESTAMPTZ,
  analyzed_by TEXT,

  -- Stage 3: Storage
  storage_status TEXT DEFAULT 'pending',     -- pending, processing, complete, error, skipped
  opportunity_id UUID,                       -- FK to funding_opportunities (after successful storage)
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
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_url UNIQUE(url),
  CONSTRAINT unique_source_title UNIQUE(source_name, title)
);

-- Indexes for efficient querying
CREATE INDEX idx_mfs_extraction_status ON manual_funding_sources(extraction_status) WHERE extraction_status = 'pending';
CREATE INDEX idx_mfs_analysis_status ON manual_funding_sources(analysis_status) WHERE analysis_status = 'pending';
CREATE INDEX idx_mfs_storage_status ON manual_funding_sources(storage_status) WHERE storage_status = 'pending';
CREATE INDEX idx_mfs_needs_refresh ON manual_funding_sources(needs_refresh) WHERE needs_refresh = TRUE;
CREATE INDEX idx_mfs_source_type ON manual_funding_sources(source_type);
```

### JSONB Field Schemas

**extraction_data** (matches V2 dataExtraction schema):
```json
{
  "id": "pge-business-rebates-7d9f",
  "title": "Business Energy Efficiency Rebates",
  "description": "...",
  "eligibleApplicants": ["Commercial", "Industrial"],
  "eligibleProjectTypes": ["HVAC", "Lighting"],
  "eligibleActivities": ["Equipment Purchase", "Retrofit"],
  "fundingType": "rebate",
  "minimumAward": 100,
  "maximumAward": 50000,
  "totalFundingAvailable": null,
  "openDate": "2024-01-01",
  "closeDate": null,
  "status": "open",
  "eligibleLocations": ["PG&E service territory"],
  "matchingRequired": false,
  "disbursementType": "mail_in_rebate",
  "awardProcess": "first_come_first_served",
  "categories": ["Energy Efficiency"],
  "tags": ["HVAC", "lighting", "commercial"],
  "notes": "Additional program details...",
  "funding_source": {
    "name": "Pacific Gas & Electric",
    "type": "utility",
    "website": "https://pge.com",
    "contact_phone": "1-800-..."
  }
}
```

**analysis_data** (matches V2 contentEnhancement + scoringAnalysis):
```json
{
  "enhancedDescription": "2-3 paragraph strategic description...",
  "actionableSummary": "3-5 sentence sales-focused summary...",
  "programOverview": "Elevator pitch (<75 words)...",
  "programUseCases": "- Use case 1\n- Use case 2\n- Use case 3",
  "applicationSummary": "Step-by-step application process...",
  "programInsights": "- Non-obvious detail 1\n- Detail 2",
  "scoring": {
    "clientRelevance": 3,
    "projectRelevance": 3,
    "fundingAttractiveness": 2,
    "fundingType": 1,
    "overallScore": 9
  },
  "relevanceReasoning": "Why this score...",
  "concerns": ["Limited funding available", "First-come-first-served"]
}
```

---

## 2. Processing Pipeline

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DISCOVERY PHASE                                  │
│  (CC Agents or Manual Entry)                                            │
│  Output: Row in manual_funding_sources with url, source info            │
│  Status: extraction_status = 'pending'                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTRACTION PHASE                                 │
│  Input: URL from manual_funding_sources                                 │
│  Process: Fetch content → LLM extraction → structured JSON              │
│  Output: extraction_data JSONB populated                                │
│  Status: extraction_status = 'complete', analysis_status = 'pending'    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ANALYSIS PHASE                                   │
│  Input: extraction_data from manual_funding_sources                     │
│  Process: Content enhancement + scoring (no fetching needed)            │
│  Output: analysis_data JSONB populated                                  │
│  Status: analysis_status = 'complete', storage_status = 'pending'       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         STORAGE PHASE                                    │
│  Input: extraction_data + analysis_data                                 │
│  Process: Dedup check → Insert to funding_opportunities                 │
│  Output: opportunity_id linked                                          │
│  Status: storage_status = 'complete'                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Processing Methods

### Method A: Manual Processing via Claude Code (Interactive)

**When to use:** Ad-hoc processing, testing, small batches, manual oversight needed

**Flow:**
1. User triggers processing in CC conversation
2. CC reads pending records from `manual_funding_sources`
3. CC processes each stage interactively
4. CC updates database via Supabase client

**Example Session:**
```
User: "Process the next 5 pending extractions"

Claude:
1. Queries: SELECT * FROM manual_funding_sources WHERE extraction_status = 'pending' LIMIT 5
2. For each record:
   - Uses WebFetch to get URL content
   - Extracts structured data
   - Updates extraction_data and extraction_status
3. Reports results to user
```

**Pros:** Full visibility, can handle edge cases, no infrastructure needed
**Cons:** Requires user involvement, not scalable

---

### Method B: API Endpoints + Cron (Automated)

**When to use:** Batch processing, scheduled runs, hands-off operation

**Architecture:**
```
┌──────────────┐     ┌─────────────────────────────────────────┐
│  Vercel Cron │────▶│  /api/pipeline/manual-sources/extract  │
│  (hourly)    │     └─────────────────────────────────────────┘
└──────────────┘                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │  Claude Code SDK              │
                        │  - Fetches URL (WebFetch)     │
                        │  - Extracts structured data   │
                        │  - Returns JSON               │
                        └───────────────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │  Update manual_funding_sources│
                        │  extraction_data = result     │
                        │  extraction_status = complete │
                        └───────────────────────────────┘
```

**API Endpoints:**

#### `/api/pipeline/manual-sources/extract`
```javascript
// POST /api/pipeline/manual-sources/extract
// Body: { limit: 10 } or { ids: ["uuid1", "uuid2"] }

import Anthropic from "@anthropic-ai/claude-code";

export async function POST(request) {
  const { limit = 5, ids } = await request.json();

  // 1. Get pending records
  const { data: records } = await supabase
    .from('manual_funding_sources')
    .select('*')
    .eq('extraction_status', 'pending')
    .limit(limit);

  const results = [];

  for (const record of records) {
    // 2. Mark as processing
    await supabase
      .from('manual_funding_sources')
      .update({ extraction_status: 'processing' })
      .eq('id', record.id);

    try {
      // 3. Use Claude Code SDK for extraction
      const client = new Anthropic();
      const response = await client.runSync({
        prompt: `
          Extract funding program data from this URL: ${record.url}

          Return JSON matching this schema:
          ${JSON.stringify(EXTRACTION_SCHEMA)}

          Focus on: eligibility, funding amounts, deadlines, application process.
        `,
        options: {
          allowedTools: ["WebFetch", "Read", "Bash"],
          maxTokens: 4096,
        }
      });

      // 4. Parse and store result
      const extractedData = parseExtraction(response);

      await supabase
        .from('manual_funding_sources')
        .update({
          extraction_status: 'complete',
          extraction_data: extractedData,
          extracted_at: new Date().toISOString(),
          extracted_by: 'api:extraction'
        })
        .eq('id', record.id);

      results.push({ id: record.id, status: 'complete' });

    } catch (error) {
      await supabase
        .from('manual_funding_sources')
        .update({
          extraction_status: 'error',
          extraction_error: error.message
        })
        .eq('id', record.id);

      results.push({ id: record.id, status: 'error', error: error.message });
    }
  }

  return Response.json({ processed: results.length, results });
}
```

#### `/api/pipeline/manual-sources/analyze`
```javascript
// POST /api/pipeline/manual-sources/analyze
// Uses existing V2 analysisAgent logic (Anthropic SDK)
// No URL fetching needed - works from extraction_data

export async function POST(request) {
  const { limit = 10 } = await request.json();

  // 1. Get records ready for analysis
  const { data: records } = await supabase
    .from('manual_funding_sources')
    .select('*')
    .eq('extraction_status', 'complete')
    .eq('analysis_status', 'pending')
    .limit(limit);

  for (const record of records) {
    // 2. Use existing V2 analysisAgent logic
    const analysisResult = await analyzeOpportunity(record.extraction_data);

    // 3. Store results
    await supabase
      .from('manual_funding_sources')
      .update({
        analysis_status: 'complete',
        analysis_data: analysisResult,
        analyzed_at: new Date().toISOString(),
        analyzed_by: 'api:analysis'
      })
      .eq('id', record.id);
  }
}
```

#### `/api/pipeline/manual-sources/store`
```javascript
// POST /api/pipeline/manual-sources/store
// Uses existing V2 storageAgent logic

export async function POST(request) {
  const { limit = 20 } = await request.json();

  // 1. Get records ready for storage
  const { data: records } = await supabase
    .from('manual_funding_sources')
    .select('*')
    .eq('analysis_status', 'complete')
    .eq('storage_status', 'pending')
    .limit(limit);

  for (const record of records) {
    // 2. Dedup check against funding_opportunities
    const isDupe = await checkDuplicate(record.extraction_data);

    if (isDupe) {
      await supabase
        .from('manual_funding_sources')
        .update({
          storage_status: 'skipped',
          storage_error: 'Duplicate detected'
        })
        .eq('id', record.id);
      continue;
    }

    // 3. Merge extraction + analysis into opportunity format
    const opportunity = mergeToOpportunity(record.extraction_data, record.analysis_data);

    // 4. Insert to funding_opportunities
    const { data: inserted } = await supabase
      .from('funding_opportunities')
      .insert(opportunity)
      .select()
      .single();

    // 5. Link back
    await supabase
      .from('manual_funding_sources')
      .update({
        storage_status: 'complete',
        opportunity_id: inserted.id,
        stored_at: new Date().toISOString(),
        stored_by: 'api:storage'
      })
      .eq('id', record.id);
  }
}
```

---

## 4. Processing Comparison by Stage

| Stage | Manual (CC) | API + Claude Code SDK | API + Anthropic SDK |
|-------|-------------|----------------------|---------------------|
| **Extraction** | CC uses WebFetch/Read tools | SDK has WebFetch/Read built-in | Must build fetching layer |
| **Analysis** | CC processes inline | Reuse V2 analysisAgent | Reuse V2 analysisAgent |
| **Storage** | CC runs insert script | Reuse V2 storageAgent | Reuse V2 storageAgent |
| **Coding Effort** | None (conversational) | Low (SDK handles tools) | Medium (build fetching) |
| **Cost/Program** | ~$0.15-0.25 | ~$0.10-0.20 | ~$0.02-0.05 |
| **Speed** | Slow (interactive) | Medium (SDK overhead) | Fast (direct calls) |
| **Automation** | Manual trigger | Cron/API trigger | Cron/API trigger |

---

## 5. Hybrid Recommendation

**Extraction Phase:** Use Claude Code SDK
- Needs URL fetching + content understanding
- SDK provides WebFetch/Read tools
- Simpler than building fetching infrastructure

**Analysis Phase:** Use existing Anthropic SDK (V2 analysisAgent)
- No fetching needed - works from extracted data
- Already built and tested
- Cheaper per call

**Storage Phase:** Use existing Supabase client (V2 storageAgent)
- No LLM needed
- Just database operations
- Already built

---

## 6. Refresh Strategy

### Change Detection
```sql
-- Update source_hash when content changes
UPDATE manual_funding_sources
SET source_hash = md5(raw_content)
WHERE id = :id;

-- Mark stale records for refresh
UPDATE manual_funding_sources
SET needs_refresh = TRUE
WHERE last_verified_at < NOW() - (refresh_interval_days || ' days')::interval
  AND storage_status = 'complete';
```

### Refresh API
```javascript
// POST /api/pipeline/manual-sources/refresh
// Re-fetches URLs and compares content hash

export async function POST(request) {
  const { data: stale } = await supabase
    .from('manual_funding_sources')
    .select('*')
    .eq('needs_refresh', true)
    .limit(10);

  for (const record of stale) {
    // Fetch current content
    const currentContent = await fetchContent(record.url);
    const currentHash = md5(currentContent);

    if (currentHash !== record.source_hash) {
      // Content changed - re-extract
      await supabase
        .from('manual_funding_sources')
        .update({
          extraction_status: 'pending',
          analysis_status: 'pending',
          storage_status: 'pending',
          raw_content: currentContent,
          source_hash: currentHash,
          needs_refresh: false,
          last_verified_at: new Date().toISOString()
        })
        .eq('id', record.id);
    } else {
      // No change - just update verified timestamp
      await supabase
        .from('manual_funding_sources')
        .update({
          needs_refresh: false,
          last_verified_at: new Date().toISOString()
        })
        .eq('id', record.id);
    }
  }
}
```

---

## 7. Implementation Steps

### Phase 1: Database Setup
1. Create `manual_funding_sources` table migration
2. Add indexes for status queries
3. Test with sample data

### Phase 2: Manual Processing (CC)
1. Create CC workflow for processing pending records
2. Test extraction → analysis → storage flow
3. Validate data quality

### Phase 3: API Endpoints
1. `/api/pipeline/manual-sources/extract` (Claude Code SDK)
2. `/api/pipeline/manual-sources/analyze` (Anthropic SDK, reuse V2)
3. `/api/pipeline/manual-sources/store` (Supabase, reuse V2)
4. `/api/pipeline/manual-sources/refresh` (change detection)

### Phase 4: Automation
1. Add Vercel cron triggers
2. Add monitoring/alerting
3. Add dashboard view for pipeline status

---

## 8. Critical Files to Modify/Create

**New Files:**
- `supabase/migrations/YYYYMMDD_create_manual_funding_sources.sql`
- `app/api/pipeline/manual-sources/extract/route.js`
- `app/api/pipeline/manual-sources/analyze/route.js`
- `app/api/pipeline/manual-sources/store/route.js`
- `app/api/pipeline/manual-sources/refresh/route.js`

**Reuse from V2:**
- `app/lib/agents-v2/analysisAgent/` - content enhancement + scoring
- `app/lib/agents-v2/storageAgent/` - database operations
- `app/lib/agents-v2/utils/anthropicClient.js` - schemas and client

**New Dependencies:**
- `@anthropic-ai/claude-code` - Claude Code SDK for extraction
