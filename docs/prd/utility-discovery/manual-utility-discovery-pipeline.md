# Manual Utility Program Discovery Pipeline

**Document Version:** 1.0
**Date:** November 20, 2025
**Status:** Draft
**Owner:** Meridian ESG Platform

---

## Executive Summary

This document outlines a manual agent-based pipeline for discovering, extracting, and storing utility incentive programs using Claude Code CLI. The system establishes a repeatable nationwide procedure to build a comprehensive database of ALL sustainability programs for commercial clients—including energy efficiency, water conservation, irrigation, stormwater management, HVAC, EV charging, building envelope, renewable energy, and retrofit incentives—that provide funding, rebates, and incentives.

**Key Objectives:**
- Establish a repeatable procedure to discover ALL utility programs across the United States
- Target **all non-residential customers** (no residential programs):
  - Commercial: Private businesses, offices, retail, restaurants, hotels
  - Institutional: Schools, hospitals, nonprofits, religious facilities
  - Government/Public Sector: Municipal buildings, K-12 schools, universities, government facilities
- Capture ALL sustainability-related programs: energy (electricity/gas), water conservation, irrigation, stormwater, HVAC, lighting, EV charging, building envelope, renewable energy, and any retrofit incentives
- Achieve near-complete coverage (targeting 100%) of available commercial utility incentive programs
- Handle both web pages and PDF documents (up to 5MB, 50 pages)
- Extract structured program data suitable for client matching
- Integrate with existing `funding_opportunities` database schema
- Execute entirely through Claude Code CLI conversational interface
- Create a scalable process that works for any state or utility in the country

**Approach:**
Five-agent pipeline with file-based intermediate storage, processing utilities in batches to manage context window constraints.

---

## Problem Statement

### Current State
- Meridian platform successfully processes federal funding opportunities via API sources (Grants.gov, SAM.gov)
- No systematic coverage of utility incentive programs despite high client relevance
- Utilities lack standardized APIs for program data access
- Manual discovery is time-consuming and incomplete

### Opportunity
- Utilities nationwide offer thousands of incentive programs for commercial customers
- Web search-based discovery is viable for comprehensive program coverage
- **IncentiveFind Benchmark**: A commercial tool that performs incentive searches for properties. We used their results as a baseline benchmark to validate our search approach—ensuring we at least match what they discovered. Note: We don't know their methodology or if their results are complete.
- Initial search strategy testing achieved 87% coverage with 2-3 queries per utility
- Expanding search strategies can approach 100% coverage to ensure completeness

### Success Criteria
- **Coverage**: Target near-complete coverage (approaching 100%) of available utility programs
- **Completeness**: Search strategies must be comprehensive enough to discover ALL eligible programs
- **Data Quality**: 100% complete structured data for all discovered programs
- **Deduplication**: 0% duplicates in final dataset (matching API pipeline standard)
- **Repeatability**: Process works for utilities in any state across the country
- **Storage**: Programs stored in `funding_opportunities` table with proper schema mapping

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                   Claude Code CLI Coordinator                │
│                  (Orchestrates agent pipeline)               │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐
│   Discovery  │      │  Extraction  │     │ Deduplication│
│     Agent    │──────▶    Agent     │─────▶    Agent     │
└──────────────┘      └──────────────┘     └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
        ┌──────────────┐            ┌──────────────┐
        │   Analysis   │            │   Storage    │
        │    Agent     │────────────▶    Agent     │
        └──────────────┘            └──────────────┘
                                            │
                                            ▼
                                ┌──────────────────────┐
                                │  funding_opportunities│
                                │        Table          │
                                └──────────────────────┘
```

### Core Principles

1. **Stateless Agents**: Each agent is independent, reads from files, writes to files
2. **File-Based Persistence**: Intermediate results stored in JSON files in `temp/utility-discovery/`
3. **Batch Processing**: Process utilities/programs in batches to manage context windows
4. **Idempotent Operations**: Agents can be re-run on same input without side effects
5. **Manual Oversight**: Human review between phases before final database writes

---

## Agent Pipeline Design

### Pipeline Stages

| Stage | Agent | Input | Output | Batch Size |
|-------|-------|-------|--------|------------|
| 1 | Discovery Agent | Utility names from DB | Program URLs with metadata (JSON) | 10 utilities |
| 2 | Extraction Agent | Program URLs with metadata | Program details (JSON) | 20 programs |
| 3 | Deduplication Agent | Program details | New programs only (JSON) | 100 programs |
| 4 | Analysis Agent | New programs | Enhanced programs (JSON) | 20 programs |
| 5 | Storage Agent | Enhanced programs | SQL INSERT statements | All programs |

**Note:** Discovery Agent output includes:
- Program URLs (both HTML and PDF)
- Content type indicators (html, pdf, doc)
- PDF metadata (file size, estimated pages) when available
- Utility type classification (electric, gas, water, combination)
- Search query source for each program

**Batch Size Rationale:**
- Conservative sizing to prevent context window exhaustion
- Extraction and Analysis agents process content-heavy operations (WebFetch/PDF reads)
- Each program can consume 5,000-20,000 tokens
- 20 programs per batch = ~100,000-400,000 tokens max (safe margin within 200k context limit)

---

## Pipeline Coordinator (Main CLI Session)

### Overview

The **main Claude Code CLI session** acts as the pipeline coordinator. Users trigger the entire pipeline with a simple command, and the coordinator automatically orchestrates all agents, batching, and data consolidation.

### Trigger Command

User provides a simple instruction to start the pipeline:

```
"Retrieve California utility programs"
"Search for utility opportunities in Texas"
"Discover all Oregon utility programs"
```

The coordinator extracts the state name and initiates the full pipeline automatically.

### Coordinator Responsibilities

The main CLI session (not a spawned agent) handles:

1. **Input Processing**: Parse user command to extract target state (convert to 2-letter code)
2. **Database Queries**: Query Supabase `coverage_areas` table for utilities filtered by `state_code` and `kind = 'utility'`
3. **Batch Calculation**: Divide utilities and programs into appropriate batch sizes
4. **Agent Spawning**: Launch parallel Task agents for each batch with specific instructions
5. **Wait & Monitor**: Track spawned agent completion status
6. **File Consolidation**: Read and merge output files from parallel agents between pipeline phases
7. **Phase Transitions**: Sequence through Discovery → Extraction → Deduplication → Analysis → Storage
8. **Progress Reporting**: Provide real-time updates to user on pipeline status
9. **Error Handling**: Track failures, retry logic, manual review queue management

### Execution Flow

**Example: "Retrieve California utility programs"**

#### Phase 1: Discovery
```
1. Query Supabase:
   SELECT id, name, code,
          metadata->>'url' as website,
          metadata->>'utility_type' as utility_type,
          metadata->>'ownership' as ownership
   FROM coverage_areas
   WHERE state_code = 'CA'
   AND kind = 'utility'
   ORDER BY name
   → Returns 85 utilities (electric only in current database)

2. Calculate batches: 85 utilities ÷ 10 per batch = 9 batches

3. Spawn 9 Discovery Agents IN PARALLEL using Task tool:
   - Discovery Agent 1: utilities [1-10]
     Input: [{id: uuid, name: "PG&E", code: "PG&E", website: "https://...", utility_type: "electric"}, ...]
     Output: temp/utility-discovery/01-discovery/discovery-batch-001.json

   - Discovery Agent 2: utilities [11-20]
     Output: temp/utility-discovery/01-discovery/discovery-batch-002.json

   - Discovery Agent 3: utilities [21-30]
     Output: temp/utility-discovery/01-discovery/discovery-batch-003.json

   - Discovery Agent 4: utilities [31-32]
     Output: temp/utility-discovery/01-discovery/discovery-batch-004.json

4. Wait for all 4 agents to complete

5. Consolidate Discovery Results:
   - Read all temp/01-discovery/discovery-batch-*.json files
   - Merge into single array of program URLs
   - Result: 215 program URLs discovered
```

#### Phase 2: Extraction
```
1. Split programs: 215 programs ÷ 20 per batch = 11 batches

2. Spawn 11 Extraction Agents IN PARALLEL:
   - Extraction Agent 1: programs [1-20]
     Input: Array of 20 {url, content_type, utility} objects
     Output: temp/utility-discovery/02-extracted/extraction-batch-001.json

   - Extraction Agent 2: programs [21-40]
     Output: temp/utility-discovery/02-extracted/extraction-batch-002.json

   ... (9 more agents)

   - Extraction Agent 11: programs [201-215]
     Output: temp/utility-discovery/02-extracted/extraction-batch-011.json

3. Wait for all 11 agents to complete

4. Consolidate Extraction Results:
   - Read all temp/02-extracted/extraction-batch-*.json files
   - Merge into single array of extracted programs
   - Result: 210 successfully extracted programs (5 failed/queued for manual review)
```

#### Phase 3: Deduplication
```
1. Spawn single Deduplication Agent:
   Input: All 210 extracted programs
   Output: temp/utility-discovery/03-deduped/deduped-programs.json
   Result: 180 new programs (30 already in database)
```

#### Phase 4: Analysis
```
1. Split programs: 180 new programs ÷ 20 per batch = 9 batches

2. Spawn 9 Analysis Agents IN PARALLEL:
   - Analysis Agent 1: programs [1-20]
     Output: temp/utility-discovery/04-analyzed/analysis-batch-001.json

   ... (8 more agents)

3. Wait and consolidate
   Result: 180 enhanced programs ready for storage
```

#### Phase 5: Storage
```
1. Spawn single Storage Agent:
   Input: All 180 enhanced programs
   Action: INSERT into funding_opportunities table
   Result: 180 new utility programs added to database
```

### Agent Batch Instructions

**When spawning each agent via Task tool, coordinator provides:**

```javascript
// Discovery Agent Example
Task({
  subagent_type: "general-purpose",
  description: "Discover utility programs batch 1",
  prompt: `You are the Discovery Agent processing batch 1 of 4.

Your assigned utilities:
${JSON.stringify(utilitiesBatch1, null, 2)}

For EACH utility, run 10 search queries (as specified in Discovery Agent section).
Write all discovered programs to: temp/utility-discovery/01-discovery/discovery-batch-001.json

Expected output format: Array of {utility, program_url, content_type, pdf_metadata, search_query}

Process all 10 utilities in this batch, then exit.`
})

// Extraction Agent Example
Task({
  subagent_type: "general-purpose",
  description: "Extract utility programs batch 1",
  prompt: `You are the Extraction Agent processing batch 1 of 11.

Your assigned programs (20 total):
${JSON.stringify(programsBatch1, null, 2)}

For EACH program:
1. Fetch content (WebFetch for HTML, Playwright+Read for PDFs)
2. Extract structured data using schemas.dataExtraction format
3. Append to output file

Write all extracted programs to: temp/utility-discovery/02-extracted/extraction-batch-001.json

Process all 20 programs in this batch, then exit.`
})
```

### File Organization

```
temp/utility-discovery/
├── 01-discovery/
│   ├── discovery-batch-001.json    # Utilities 1-10
│   ├── discovery-batch-002.json    # Utilities 11-20
│   ├── discovery-batch-003.json    # Utilities 21-30
│   └── discovery-batch-004.json    # Utilities 31-32
│
├── 02-extracted/
│   ├── extraction-batch-001.json   # Programs 1-20
│   ├── extraction-batch-002.json   # Programs 21-40
│   ├── ...
│   └── extraction-batch-011.json   # Programs 201-215
│
├── 03-deduped/
│   └── deduped-programs.json       # All new programs
│
├── 04-analyzed/
│   ├── analysis-batch-001.json     # Programs 1-20
│   ├── ...
│   └── analysis-batch-009.json     # Programs 161-180
│
└── pdfs/                           # Downloaded PDFs (temporary)
    ├── pge-commercial-rebates.pdf
    ├── sce-express-solutions.pdf
    └── ...
```

### Consolidation Between Phases

**Coordinator reads multiple batch files and merges:**

```javascript
// After Discovery Phase
const allDiscoveryFiles = await glob('temp/utility-discovery/01-discovery/*.json');
const allPrograms = [];
for (const file of allDiscoveryFiles) {
  const batch = JSON.parse(await readFile(file));
  allPrograms.push(...batch.programs);
}
// Result: Single array of all discovered programs to pass to Extraction

// After Extraction Phase
const allExtractionFiles = await glob('temp/utility-discovery/02-extracted/*.json');
const extractedPrograms = [];
for (const file of allExtractionFiles) {
  const batch = JSON.parse(await readFile(file));
  extractedPrograms.push(...batch.programs);
}
// Result: Single array of extracted programs to pass to Deduplication
```

### Progress Tracking

Coordinator maintains and displays real-time progress:

```
🔍 DISCOVERY PHASE
Querying database for California utilities... ✓ 32 utilities found
Creating 4 batches of 10 utilities each...
Spawning 4 parallel Discovery Agents...
  ✓ Batch 1 complete: 52 programs discovered
  ✓ Batch 2 complete: 58 programs discovered
  ✓ Batch 3 complete: 61 programs discovered
  ✓ Batch 4 complete: 44 programs discovered
Consolidating results... ✓ 215 programs discovered total

🔧 EXTRACTION PHASE
Creating 11 batches of 20 programs each...
Spawning 11 parallel Extraction Agents...
  ✓ Batch 1 complete: 19/20 extracted (1 PDF too large)
  ✓ Batch 2 complete: 20/20 extracted
  ... (progress updates)
Consolidating results... ✓ 210/215 extracted (5 queued for manual review)

🔍 DEDUPLICATION PHASE
Checking 210 programs against database...
  ✓ 180 new programs, 30 duplicates filtered

📊 ANALYSIS PHASE
Creating 9 batches of 20 programs each...
Spawning 9 parallel Analysis Agents...
  ... (progress updates)
  ✓ 180 programs enhanced

💾 STORAGE PHASE
Inserting 180 programs into database...
  ✓ 180 programs successfully stored

✅ PIPELINE COMPLETE
California utility programs: 180 new opportunities added to database
```

### Key Benefits of Main CLI as Coordinator

1. **User Visibility**: User sees entire pipeline progress in real-time
2. **State Management**: Main session maintains pipeline state (no separate coordinator needed)
3. **Error Recovery**: User can intervene if issues arise
4. **Simplicity**: Single conversation context, clear mental model
5. **Debugging**: Easy to track what went wrong and where
6. **Flexibility**: User can pause, modify, or restart phases as needed

---

## PDF Document Processing

### Overview

Many utility program details are published as PDF documents rather than web pages. The pipeline includes robust PDF handling to ensure comprehensive coverage of all program information.

### PDF Processing Capabilities

**Claude Code CLI Read Tool:**
- Supports PDF files up to **32MB** in size
- Handles up to **100 pages** with visual analysis (charts, tables, images)
- PDFs over 100 pages: Text-only extraction (no visual elements)
- Multimodal processing: Extracts both text content and visual information
- Page-by-page extraction with configurable limits

### Recommended Processing Limits

To balance comprehensive coverage with processing efficiency:

| Parameter | Limit | Rationale |
|-----------|-------|-----------|
| **File Size** | 5MB | Industry standard for web downloads, ensures reasonable processing time |
| **Page Count** | 50 pages | Conservative limit below Claude's 100-page threshold, typical utility programs are 10-30 pages |
| **Timeout** | 60 seconds | Industry standard for web scraping, allows for retries |
| **Token Budget** | ~100,000 tokens | At 2,000 tokens/page, 50 pages = 50% of context window |

### PDF Handling Workflow

**For PDFs Within Limits (≤5MB, ≤50 pages):**
1. Discovery Agent identifies PDF URLs and collects metadata
2. Extraction Agent uses Playwright to download PDF to `temp/utility-discovery/pdfs/`
3. Read tool extracts full content (text + visual analysis)
4. Claude processes extracted content as structured program data
5. Mark extraction confidence (typically "medium" for PDFs due to less structure)

**For PDFs Exceeding Limits:**
1. Flag as "pdf_too_large" or "pdf_too_many_pages"
2. Log to manual review queue with metadata (URL, size, page count)
3. Attempt to find alternative HTML version of content
4. Option: Process first 50 pages only with flag indicating partial extraction

**Download Failures:**
1. Retry once with exponential backoff
2. If retry fails, flag as "pdf_download_failed"
3. Continue to next program
4. Log failure for manual review

### Token Considerations

**Per-PDF Token Usage:**
- Simple text PDF: ~1,500 tokens per page
- Complex PDF (tables, charts): ~2,500 tokens per page
- 50-page PDF: ~75,000-125,000 tokens

**Batch Processing Strategy:**
- Process PDFs in small batches (10-20 at a time)
- Monitor token usage to stay within context window
- Reset context between batches if needed

### PDF Quality Considerations

**High-Quality Extraction (90%+ data completeness):**
- Native digital PDFs with selectable text
- Well-structured documents with clear sections
- Standard utility program format

**Medium-Quality Extraction (70-90% completeness):**
- Scanned PDFs with OCR text layer
- Complex layouts with multiple columns
- Heavy use of tables and graphics

**Low-Quality Extraction (<70% completeness):**
- Image-only scans without OCR
- Password-protected or restricted PDFs
- Corrupted or malformed files
- Flag for manual review

### Manual Review Queue

PDFs flagged for manual review will be logged with:
- Program title and utility name
- PDF URL
- Reason for flag (size, pages, download failure, quality)
- Alternative sources (if found)
- Priority level (based on program relevance)

---

## Detailed Agent Responsibilities

### Agent 1: Discovery Agent

**Type:** `general-purpose` or `Explore`

**Purpose:** Discover ALL incentive program URLs for a batch of utilities using comprehensive web searches covering energy, water, and sustainability programs.

#### Responsibilities
1. Read utility names from input file or database query
2. Determine utility type (electric, gas, water, or combination) to apply relevant search strategies
3. For each utility, execute 10 comprehensive search queries targeting commercial, institutional, and public sector programs:

   **Energy Efficiency (All Utilities):**
   - **Search 1**: `"[Utility] commercial institutional public sector energy programs incentives rebates"`
   - **Search 2**: `"[Utility] third-party energy efficiency programs commercial institutional government"`
   - **Search 8**: `"[Utility] retrocommissioning RCx strategic energy management commercial institutional government"`

   **Electric-Specific:**
   - **Search 3**: `"[Utility] EV charging infrastructure commercial institutional government business"`

   **Water Conservation (Water Utilities):**
   - **Search 4**: `"[Utility] water conservation rebates commercial institutional government business"`
   - **Search 5**: `"[Utility] irrigation rebates commercial institutional government landscape"`
   - **Search 6**: `"[Utility] water efficiency programs commercial institutional government WET"`
   - **Search 7**: `"[Utility] stormwater credits commercial institutional government green infrastructure"`

   **Building Improvements (All Utilities):**
   - **Search 9**: `"[Utility] building envelope windows insulation rebates commercial institutional government"`
   - **Search 10**: `"[Utility] custom incentives commercial institutional government projects"`

4. **Filter search results before collection.** For each result, evaluate:

   **INCLUDE only if:**
   - Page appears to be a program landing page, application portal, or program documentation
   - Contains actionable info: rebate amounts, eligibility requirements, how to apply
   - Would let a customer actually apply or learn specific rebate amounts

   **EXCLUDE:**
   - News articles, press releases, blog posts ABOUT programs
   - General "we offer rebates" marketing pages without specific program details
   - Third-party articles discussing utility programs (news sites, energy publications)
   - Government/regulatory filings about programs (CPUC decisions, rate cases)
   - Aggregator sites listing programs (we want primary sources only)
   - Pages that talk ABOUT a program rather than being THE program page

   **When in doubt:** Ask "Could a business use this page to start an application or determine their rebate amount?" If no, skip it.

5. For each program that passes filtering, collect:
   - Program title
   - Program URL
   - Content type (html, pdf, doc)
   - PDF metadata (file size, estimated pages if available)
   - Source search query
   - Relevance score
7. Compile results into structured JSON format with utility type and applicable searches
8. Write output to `temp/utility-discovery/01-discovery/[utility]-programs.json`
9. Document any gaps found compared to benchmark sources (IncentiveFind)

#### Input Format
```json
{
  "utilities": [
    {"name": "SCE", "state": "CA", "type": "electric"},
    {"name": "SoCalGas", "state": "CA", "type": "gas"},
    {"name": "SDG&E", "state": "CA", "type": "electric"}
  ]
}
```

#### Output Format
```json
{
  "utility": "SCE",
  "state": "CA",
  "utility_type": "electric",
  "applicable_searches": [1, 2, 3, 8, 9, 10],
  "search_date": "2025-11-20T10:30:00Z",
  "search_queries": [
    "SCE commercial institutional public sector energy programs incentives rebates",
    "SCE third-party energy efficiency programs commercial institutional government",
    "SCE EV charging infrastructure commercial institutional government business",
    "SCE retrocommissioning RCx strategic energy management commercial institutional government",
    "SCE building envelope windows insulation rebates commercial institutional government",
    "SCE custom incentives commercial institutional government projects"
  ],
  "programs_discovered": [
    {
      "title": "Express Solutions",
      "url": "https://www.sce.com/business/savings-incentives/express-solutions",
      "content_type": "html",
      "source": "search_1",
      "relevance_score": "high"
    },
    {
      "title": "Commercial Rebates Guide",
      "url": "https://www.sce.com/downloads/commercial-rebates.pdf",
      "content_type": "pdf",
      "file_size": "3.2MB",
      "estimated_pages": 25,
      "within_limits": true,
      "source": "search_1",
      "relevance_score": "high"
    },
    {
      "title": "CEDA - California Energy Design Assistance",
      "url": "https://www.willdan.com/programs/sce-ceda",
      "content_type": "html",
      "source": "search_2",
      "relevance_score": "high"
    }
  ],
  "total_programs_found": 48,
  "html_programs": 35,
  "pdf_programs": 13,
  "search_timestamp": "2025-11-20T10:35:00Z"
}
```

#### Key Considerations
- **Utility Type Detection**: Determine if utility is electric, gas, water, or combination to apply relevant search queries
  - Electric utilities: Skip water conservation searches (4-7)
  - Gas utilities: Skip EV charging (3) and water conservation (4-7)
  - Water utilities: Skip EV charging (3), focus on water programs (4-7)
  - Combination utilities: Use all applicable searches
- **PDF Identification**: Collect PDF metadata (file size, estimated pages) during discovery for extraction planning
- **Comprehensive Non-Residential Coverage**: All searches include "commercial", "institutional", and "government" terms to capture programs for:
  - Private businesses (commercial)
  - Schools, hospitals, nonprofits (institutional)
  - Municipal buildings, government facilities (public sector)
  - This ensures coverage for K-12 schools, universities, government entities (50%+ of client base)
- Flag duplicate URLs across searches
- Prioritize official utility websites and known third-party implementers (Willdan, TRC, Resource Innovations)
- Include water districts and municipal utilities in searches (not just electric/gas)
- Log search queries used for reproducibility
- **Coverage Validation**: Compare results against IncentiveFind baseline when available

---

### Agent 2: Extraction Agent

**Type:** `general-purpose`

**Purpose:** Extract structured program data from discovered URLs using web scraping and Claude analysis.

#### Pre-Extraction Filtering (Quality Gate)

Before fetching content, the extraction agent applies filtering criteria to identify and skip low-value programs, conserving tokens and improving data quality.

**Filtering Strategy:**

Programs are **SKIPPED** if they match any of these patterns:

1. **URL Pattern Filters** (news/articles, not actual programs):
   - URL contains: `/news/`, `/blog/`, `/article/`, `/press-release/`, `/about/`, `/media/`, `/press/`, `/updates/`
   - Title indicates news coverage: "News", "Press Release", "Article", "Blog Post", "Announcement"
   - Rationale: These pages discuss programs but are not program pages themselves

2. **Insufficient Detail Indicators** (all three must be true to filter):
   - No specific rebate amounts in discovery metadata
   - No indication of free technical assistance
   - Discovery relevance score marked as "low"
   - Rationale: Generic landing pages or placeholders without actionable program details

3. **Expired/Closed Programs**:
   - Discovery metadata indicates closed or expired status
   - Historical programs with no current information
   - Rationale: Not relevant for current client needs

Programs are **ALWAYS EXTRACTED** if they show:

1. **High-Value Indicators**:
   - Specific rebate amounts, rates, or ranges in metadata
   - Keywords: "rebates", "incentives", "application", "program details"
   - Discovery relevance score: "high" or "medium"

2. **Technical Assistance Programs**:
   - Free audits, assessments, design services
   - Keywords: "audit", "assessment", "design assistance", "technical support"
   - Rationale: High client value even without direct monetary rebates

3. **Established Program Types**:
   - Custom or deemed savings programs
   - Prescriptive rebate programs
   - Third-party implementer programs (CEDA, CERI, Willdan, TRC)

**Expected Impact:**
- Token savings: 10-20% reduction (filtering low-value programs before extraction)
- Quality improvement: Higher average program relevance scores
- Batch efficiency: Faster processing with fewer failed/incomplete extractions

**Tracking:**
- Filtered programs logged in batch summary with filter reason
- Manual spot-checks recommended to validate filtering accuracy

#### Responsibilities
1. Read all JSON files from `temp/utility-discovery/01-discovery/`
2. Apply pre-extraction filtering to identify programs worth extracting
3. For each qualifying program URL, determine content type and process accordingly:

   **For HTML Content:**
   - Use `WebFetch` to retrieve page content and convert to markdown
   - Extract structured fields using Claude

   **For PDF Content:**
   - Check file size ≤5MB and pages ≤50 (from discovery metadata)
   - If within limits:
     - Use Playwright to download PDF to `temp/utility-discovery/pdfs/`
     - Use Read tool to extract full content (text + visual analysis)
     - Extract structured fields using Claude from PDF content
     - Mark extraction_confidence as "medium" (PDFs typically less structured)
   - If exceeding limits:
     - Flag as "pdf_too_large" or "pdf_too_many_pages"
     - Add to manual review queue with metadata
     - Attempt to find alternative HTML version
     - Continue to next program
   - Handle download failures:
     - Retry once with exponential backoff
     - If fails, flag as "pdf_download_failed" and continue

3. Extract structured fields for all programs (HTML or PDF) using `schemas.dataExtraction` format:
   - **Required**: `id`, `title`, `description`, `eligibleApplicants`, `eligibleProjectTypes`, `eligibleActivities`
   - **Funding**: `fundingType`, `totalFundingAvailable`, `minimumAward`, `maximumAward`, `notes`
   - **Dates**: `openDate`, `closeDate`, `status` (format: YYYY-MM-DD; often NULL for evergreen programs)
   - **Geographic**: `eligibleLocations` (utility territory), `isNational` (typically false)
   - **Funding Source**: Complete `funding_source` object (name, type='utility', website, contact_email, contact_phone, description)
   - **Matching**: `matchingRequired`, `matchingPercentage`
   - **Process**: `disbursementType` (instant_rebate, mail_in_rebate, reimbursement, on_bill_credit), `awardProcess` (automatic, application_required, first_come_first_served)
   - **Categorization**: `categories`, `tags`
   - **URL**: Source URL where program was discovered
   - **Program-Specific Details** (capture in notes/description/tags):
     - **For water programs**: Water savings (gallons/year), fixture types, irrigation equipment
     - **For EV programs**: Charger types, port counts, infrastructure rebates
     - **For building programs**: Envelope measures, insulation R-values, window U-factors

4. Generate unique program ID: `[utility-slug]-[program-slug]-[hash]`
5. Write each program to `temp/utility-discovery/02-extracted/[program-id].json`
6. Create batch summary file with extraction statistics (HTML success rate, PDF success rate, manual review queue)

#### Input Format
Reads from Discovery Agent output files

#### Output Format (Per Program)

**Example 1: Energy Efficiency Program (HTML Source)**
```json
{
  "program_id": "sce-express-solutions-a3f2",
  "utility": "SCE",
  "source_url": "https://www.sce.com/business/savings-incentives/express-solutions",
  "content_type": "html",
  "extraction_date": "2025-11-20T11:00:00Z",
  "program_data": {
    "id": "sce-express-solutions-a3f2",
    "title": "Express Solutions",
    "description": "Prescriptive rebates for qualifying energy-efficient equipment including HVAC, lighting, refrigeration, and food service equipment. Online application through SCE Marketplace or contractor submission.",
    "eligibleApplicants": ["Commercial", "Industrial", "Agricultural"],
    "eligibleProjectTypes": ["HVAC", "Lighting", "Refrigeration", "Food Service Equipment"],
    "eligibleActivities": ["Equipment Purchase", "Installation", "Retrofit"],
    "fundingType": "rebate",
    "totalFundingAvailable": null,
    "minimumAward": 50,
    "maximumAward": 10000,
    "notes": "Varies by measure ($50-$10,000 per unit). Non-residential customers only. Ongoing program subject to budget availability.",
    "openDate": null,
    "closeDate": null,
    "status": "open",
    "eligibleLocations": ["SCE service territory"],
    "isNational": false,
    "funding_source": {
      "name": "Southern California Edison",
      "type": "utility",
      "website": "https://www.sce.com",
      "contact_email": "business@sce.com",
      "contact_phone": "1-800-990-7788",
      "description": "Investor-owned electric utility serving Southern California"
    },
    "matchingRequired": true,
    "matchingPercentage": null,
    "disbursementType": "reimbursement",
    "awardProcess": "application_required",
    "categories": ["Energy Efficiency", "Prescriptive"],
    "tags": ["HVAC", "lighting", "refrigeration", "foodservice", "commercial", "industrial"],
    "url": "https://www.sce.com/business/savings-incentives/express-solutions"
  },
  "extraction_confidence": "high",
  "extraction_notes": "Complete data available on main program page. All required fields extracted."
}
```

**Example 2: Water Conservation Program (PDF Source)**
```json
{
  "program_id": "ebmud-commercial-fixtures-b7k9",
  "utility": "East Bay Municipal Utility District",
  "source_url": "https://www.ebmud.com/water/conservation/commercial/commercial-rebates.pdf",
  "content_type": "pdf",
  "pdf_metadata": {
    "file_size": "2.8MB",
    "pages": 18,
    "extraction_method": "claude_read_tool"
  },
  "extraction_date": "2025-11-20T11:15:00Z",
  "program_data": {
    "id": "ebmud-commercial-fixtures-b7k9",
    "title": "Commercial Fixture Rebates",
    "description": "Rebates for high-efficiency toilets, urinals, faucets, and pre-rinse spray valves for commercial customers. Estimated water savings up to 50,000 gallons/year per fixture. Submit rebate application within 90 days of purchase with receipts.",
    "eligibleApplicants": ["Commercial", "Industrial", "Institutional"],
    "eligibleProjectTypes": ["Water Efficiency", "Plumbing Fixtures"],
    "eligibleActivities": ["Equipment Purchase", "Installation"],
    "fundingType": "rebate",
    "totalFundingAvailable": null,
    "minimumAward": 50,
    "maximumAward": 150,
    "notes": "Toilets: $125/unit, Urinals: $150/unit, Faucets: $50/unit. Must be located in EBMUD service area. Submit application within 90 days of purchase.",
    "openDate": null,
    "closeDate": null,
    "status": "open",
    "eligibleLocations": ["EBMUD service territory"],
    "isNational": false,
    "funding_source": {
      "name": "East Bay Municipal Utility District",
      "type": "utility",
      "website": "https://www.ebmud.com",
      "contact_email": "commercial@ebmud.com",
      "contact_phone": "1-866-40-EBMUD",
      "description": "Public water utility serving the East Bay region of the San Francisco Bay Area"
    },
    "matchingRequired": true,
    "matchingPercentage": null,
    "disbursementType": "mail_in_rebate",
    "awardProcess": "application_required",
    "categories": ["Water Conservation", "Prescriptive"],
    "tags": ["toilets", "urinals", "faucets", "pre-rinse valves", "water efficiency", "commercial", "institutional"],
    "url": "https://www.ebmud.com/water/conservation/commercial/commercial-rebates.pdf"
  },
  "extraction_confidence": "medium",
  "extraction_notes": "Extracted from PDF, pages 8-12. All required fields captured. Water savings data included in description."
}
```

#### Batch Summary Format
```json
{
  "batch_id": "extraction-batch-001",
  "batch_number": 1,
  "total_batches": 11,
  "programs_assigned": 20,
  "programs_filtered": 2,
  "programs_attempted": 18,
  "filter_reasons": {
    "url_pattern": 1,
    "insufficient_detail": 1,
    "expired_program": 0,
    "article_content": 0
  },
  "content_types": {
    "html": 14,
    "pdf": 4
  },
  "successful_extractions": 17,
  "html_success": 13,
  "pdf_success": 4,
  "partial_extractions": 0,
  "failed_extractions": 1,
  "pdf_too_large": 1,
  "pdf_download_failed": 0,
  "failed_urls": ["https://utility.com/large-document.pdf"],
  "manual_review_queue": 1,
  "program_types": {
    "energy_efficiency": 11,
    "water_conservation": 4,
    "ev_charging": 2,
    "building_envelope": 0
  },
  "processing_time_minutes": 6
}
```

#### Key Considerations
- **Pre-Extraction Filtering**: Applied before content retrieval to skip low-value programs
  - URL pattern filtering (news, blog, articles)
  - Insufficient detail filtering (low relevance + no specific amounts + no free services)
  - Expired program filtering
  - Expected filter rate: 10-20% of discovered programs
  - Filtered programs logged with reason for validation
- **Batch Size & Context Management**: 20 programs per Extraction Agent batch
  - Each program can consume 5,000-20,000 tokens (HTML or PDF content)
  - 20 programs = ~100,000-400,000 tokens max per agent
  - Pre-filtering reduces token consumption by 10-20%
  - Conservative sizing prevents context window exhaustion
  - Agent writes each program to file and clears content from context after processing
  - Multiple agents run in parallel to maintain performance
- **Schema Alignment**: Uses `schemas.dataExtraction` from agents-v2 pipeline for full parity with API-sourced opportunities
  - **Field Exclusion**: `api_updated_at` is NOT used (web-scraped sources, not APIs)
  - **Utility Adaptations**:
    - `eligibleApplicants`: Use utility customer types (Commercial, Industrial, Institutional, Government, Non-Profit) instead of federal applicant categories
    - `eligibleLocations`: Extract utility territory (e.g., "PG&E service territory", "SMUD service area")
    - `fundingType`: Expect 'rebate', 'incentive', 'direct_payment', 'tax_credit'
    - `disbursementType`: Include utility-specific values ('instant_rebate', 'mail_in_rebate', 'on_bill_credit', 'reimbursement')
    - `awardProcess`: Include 'automatic' for point-of-sale/instant rebates
    - `funding_source.type`: Always 'utility' for utility programs
    - Many NULL values expected for evergreen programs (`openDate`, `closeDate`, `totalFundingAvailable`)
  - **ID Generation**: Generate from URL slug + hash (not API-provided IDs)
  - **Description Field**: Combine all program details, eligibility, and application process into comprehensive description
- **PDF Processing**: Check size/page limits before attempting extraction. Download to temp directory using Playwright, extract using Read tool
- **Extraction Quality**: Target 100% complete data for all programs
  - HTML sources: High confidence (90%+ completeness)
  - PDF sources: Medium confidence acceptable (70-90% completeness) due to less structured format
  - Flag incomplete extractions for manual review
- **Program Type Specificity**:
  - Water programs: Focus on fixture types, irrigation equipment, water savings (gallons/year)
  - EV programs: Capture charger types (Level 2, DC fast), port counts, make-ready vs equipment rebates
  - Building envelope: R-values, U-factors, specific measures (windows, insulation, air sealing)
- Handle various page formats (utility sites, third-party implementers, PDF documents)
- Skip or flag pages that require login/authentication
- If a page lacks critical data, flag for manual review and attempt to find complete information from alternative sources
- **Commercial Filter**: Verify program is for commercial customers (exclude residential programs discovered in searches)
- Track any programs where complete data extraction is not possible for manual completion
- Log PDF processing statistics (success rate, oversized PDFs, download failures)

---

### Agent 3: Deduplication Agent

**Type:** `general-purpose`

**Purpose:** Identify and filter out programs already in the database to maintain 0% duplicates (matching API pipeline standard).

#### Responsibilities
1. Read all extracted program files from `temp/utility-discovery/02-extracted/`
2. Query `funding_opportunities` table for existing utility programs:
   ```sql
   SELECT id, title, agency_name, source_url
   FROM funding_opportunities
   WHERE agency_type = 'Utility'
   ```
3. For each extracted program, check for duplicates using:
   - **Primary match**: Exact title + utility name match
   - **Secondary match**: Fuzzy title match (>85% similarity) + same utility
   - **Tertiary match**: Same source URL
4. Flag programs as:
   - `new`: Not in database
   - `duplicate_exact`: Exact match found
   - `duplicate_similar`: Likely duplicate (needs review)
   - `update_candidate`: Existing program with different data (potential update)
5. Write only NEW programs to `temp/utility-discovery/03-deduped/[utility]-new-programs.json`
6. Write duplicate report to `temp/utility-discovery/03-deduped/duplicate-report.json`

#### Input Format
Reads from Extraction Agent output files

#### Output Format (New Programs)
```json
{
  "utility": "SCE",
  "new_programs": [
    {
      "program_id": "sce-express-solutions-a3f2",
      "title": "Express Solutions",
      "dedup_status": "new",
      "dedup_confidence": "high",
      "checked_against": 342
    }
  ],
  "total_new_programs": 18,
  "total_duplicates_skipped": 3
}
```

#### Duplicate Report Format
```json
{
  "deduplication_date": "2025-01-20T12:00:00Z",
  "total_programs_checked": 50,
  "new_programs": 42,
  "duplicates": {
    "exact_matches": 5,
    "similar_matches": 2,
    "update_candidates": 1
  },
  "duplicate_details": [
    {
      "extracted_program_id": "sce-express-solutions-a3f2",
      "extracted_title": "Express Solutions",
      "match_type": "exact",
      "existing_opportunity_id": 1234,
      "existing_title": "Express Solutions",
      "similarity_score": 1.0
    }
  ]
}
```

#### Key Considerations
- **Zero-duplicate standard**: Must achieve 0% duplicates to match API pipeline quality
- Use fuzzy string matching for titles (handle variations like "Express Solutions" vs "SCE Express Solutions Program")
- Consider program administrator field (SCE direct vs Willdan implementing for SCE)
- Flag potential updates if existing program has outdated data (but don't insert as duplicate)
- Preserve original extracted data even if flagged as duplicate (for review)
- When in doubt, flag for manual review rather than risk duplicate insertion

---

### Agent 4: Analysis Agent

**Type:** `general-purpose`

**Purpose:** Enhance program content and perform systematic scoring analysis using the same schemas as agents-v2 pipeline for database compatibility.

#### Responsibilities
1. Read new programs from `temp/utility-discovery/03-deduped/`
2. For each program batch (20 programs), perform **parallel analysis** using both `schemas.contentEnhancement` and `schemas.scoringAnalysis`:

   **A. Content Enhancement** (`schemas.contentEnhancement`):
   - **enhancedDescription**: Detailed strategic description explaining what the program is, who can apply, what projects qualify, with 2-3 use case examples showing how clients (commercial, institutional, government) could take advantage of it
   - **actionableSummary**: Concise summary for sales teams focusing on program scope, applicant eligibility, relevant project types, and client fit
   - **programOverview**: 2-3 sentence elevator pitch stating what it funds, rebate amounts, who can apply, and unique strategic value (<75 words)
   - **programUseCases**: 3-4 specific bulleted use cases with client type, problem, and funding solution
   - **applicationSummary**: Process steps, timeline, key requirements, important submissions, and success tips (4-5 sentences)
   - **programInsights**: 2-3 bullet points of important non-obvious details (restrictions, guidelines, technical assistance, documentation needs)

   **B. Scoring Analysis** (`schemas.scoringAnalysis`):
   - **clientRelevance** (0-3 points): How well eligible customer types (Commercial, Institutional, Government) match our target clients
   - **projectRelevance** (0-3 points): How well eligible project types (HVAC, Water Efficiency, EV Charging, Building Envelope) match our preferred activities
   - **fundingAttractiveness** (0-3 points): Based on rebate amounts available
   - **fundingType** (0-1 points): Rebate/incentive vs loan (rebates = 1, loans = 0)
   - **overallScore** (0-10 points): Sum of all criteria
   - **relevanceReasoning**: Clear explanation of scoring rationale and client fit
   - **concerns**: Array of red flags or concerns (complex applications, restrictive eligibility, limited funding, etc.)

3. Merge both analyses into complete enhanced program object
4. Write enhanced programs to `temp/utility-discovery/04-analyzed/analysis-batch-[number].json`

#### Input Format
Reads from Deduplication Agent output files

#### Output Format

**Enhanced Program Object** (matches v2 pipeline structure):
```json
{
  "program_id": "sce-express-solutions-a3f2",

  // Original extracted data (from Extraction Agent - schemas.dataExtraction)
  "id": "sce-express-solutions-a3f2",
  "title": "Express Solutions",
  "description": "Prescriptive rebates for qualifying energy-efficient equipment...",
  "eligibleApplicants": ["Commercial", "Industrial", "Agricultural"],
  "eligibleProjectTypes": ["HVAC", "Lighting", "Refrigeration", "Food Service Equipment"],
  "eligibleActivities": ["Equipment Purchase", "Installation", "Retrofit"],
  "fundingType": "rebate",
  "minimumAward": 50,
  "maximumAward": 10000,
  "disbursementType": "reimbursement",
  "awardProcess": "application_required",
  "eligibleLocations": ["SCE service territory"],
  "isNational": false,
  "funding_source": {
    "name": "Southern California Edison",
    "type": "utility",
    "website": "https://www.sce.com",
    "contact_email": "business@sce.com",
    "contact_phone": "1-800-990-7788"
  },
  "status": "open",
  "url": "https://www.sce.com/business/savings-incentives/express-solutions",

  // Content enhancement (from schemas.contentEnhancement)
  "enhancedDescription": "SCE's Express Solutions program provides prescriptive rebates for commercial, industrial, and agricultural customers installing pre-qualified energy-efficient equipment. The program offers fixed rebates ranging from $50 to $10,000 per unit for HVAC systems, LED lighting, commercial refrigeration, and foodservice equipment, eliminating the need for custom engineering studies. Applications are submitted online through SCE's Marketplace platform or by participating contractors, with fast processing and payment timelines.\n\nUse Cases:\n- Office building replacing aging rooftop HVAC units can receive up to $10,000 per unit for high-efficiency replacements\n- Retail chain upgrading to LED lighting across 20 locations receives fixed rebates per fixture with no engineering study required\n- Restaurant installing Energy Star commercial kitchen equipment qualifies for instant rebates on refrigeration and cooking equipment",

  "actionableSummary": "SCE Express Solutions offers prescriptive rebates ($50-$10,000 per unit) for commercial customers installing energy-efficient HVAC, lighting, refrigeration, and foodservice equipment. No engineering study required—equipment is pre-qualified with fixed rebate amounts. Perfect fit for our commercial and institutional clients seeking straightforward incentives for routine equipment upgrades. Applications processed through online marketplace with participating contractors.",

  "programOverview": "SCE Express Solutions provides $50-$10,000 prescriptive rebates per unit for pre-qualified energy-efficient equipment including HVAC, lighting, refrigeration, and foodservice systems. Open to commercial, industrial, and agricultural customers in SCE territory. Key advantage: Fixed rebate amounts with no engineering study required—streamlined online application process.",

  "programUseCases": "- Office building manager replacing 10 aging HVAC units receives $80,000 in rebates ($8,000/unit) with simple online application\n- School district retrofitting 500 classrooms with LED lighting qualifies for $25,000 in prescriptive rebates with no energy study\n- Grocery chain upgrading refrigeration cases across 15 stores receives $120,000 in combined equipment rebates\n- Manufacturing facility installing high-efficiency compressed air systems gets $15,000 in instant rebates through contractor portal",

  "applicationSummary": "Applications submitted through SCE Marketplace online portal or by participating trade ally contractors. Timeline: Submit application → Equipment installation → Invoice submission → Rebate payment within 4-6 weeks. Key requirement: Must use pre-qualified equipment from SCE's approved product list. Important submissions: Proof of purchase, installation photos, equipment specifications. Success tip: Work with SCE trade ally contractor for streamlined processing and guaranteed equipment qualification.",

  "programInsights": "- Trade ally contractors can submit applications on behalf of customers, speeding up processing and ensuring equipment qualifies\n- Rebates can be stacked with federal tax credits (Section 179D) and other SCE programs for maximum savings\n- Equipment must be installed by licensed contractor and meet minimum efficiency thresholds per measure category\n- Online marketplace provides instant rebate estimates and equipment eligibility verification before purchase",

  // Scoring analysis (from schemas.scoringAnalysis)
  "scoring": {
    "clientRelevance": 3,
    "projectRelevance": 3,
    "fundingAttractiveness": 2,
    "fundingType": 1,
    "overallScore": 9
  },

  "relevanceReasoning": "Excellent fit for our energy services business. Commercial/industrial/institutional customer types align perfectly with our target clients (3/3 points). HVAC, lighting, refrigeration project types match our core service offerings (3/3 points). $50-$10K rebate range is attractive for equipment-level incentives (2/3 points). Rebate funding type is preferred over loans (1/1 point). Overall score of 9/10 reflects strong alignment with our business model and high client applicability.",

  "concerns": [
    "Equipment must be on pre-qualified list—some newer high-efficiency models may not yet be approved",
    "Prescriptive rebates are fixed per unit, so larger/more efficient equipment doesn't receive higher incentives",
    "Program subject to budget availability—high-demand measures may run out of funding mid-year"
  ],

  // Metadata
  "analysis_date": "2025-01-20T13:00:00Z",
  "analysis_confidence": "high"
}
```

**Batch Summary Format**:
```json
{
  "batch_id": "analysis-batch-001",
  "batch_number": 1,
  "total_batches": 9,
  "programs_analyzed": 20,
  "average_score": 7.2,
  "score_distribution": {
    "high_score_8_10": 12,
    "medium_score_5_7": 6,
    "low_score_0_4": 2
  },
  "program_type_breakdown": {
    "energy_efficiency": 14,
    "water_conservation": 3,
    "ev_charging": 2,
    "building_envelope": 1
  },
  "processing_time_minutes": 6
}
```

#### Key Considerations
- **Schema Alignment**: Uses `schemas.contentEnhancement` and `schemas.scoringAnalysis` from agents-v2 for full database compatibility
- **Batch Size**: 20 programs per Analysis Agent batch (matching Extraction Agent)
- **Parallel Analysis**: Each agent performs content enhancement AND scoring in parallel, then merges results
- **Utility Context Adaptations**:
  - **Client Types**: Focus on Commercial, Institutional, Government customer types (not federal grant applicants)
  - **Project Types**: HVAC, Water Efficiency, EV Charging, Building Envelope, Irrigation (not federal infrastructure projects)
  - **Funding Amounts**: Rebate/incentive amounts typically $50-$50,000 per project (not multi-million dollar grants)
  - **Application Process**: Often simple online forms or contractor-submitted (not complex federal grant applications)
  - **Use Cases**: Practical building equipment/system upgrades (not large-scale federal programs)
- **Scoring Criteria**:
  - **clientRelevance (0-3)**: 3 = perfect match (Commercial/Institutional/Government), 2 = partial match, 1 = limited match, 0 = no match
  - **projectRelevance (0-3)**: 3 = core services (HVAC/lighting/water/EV), 2 = adjacent services, 1 = limited relevance, 0 = outside expertise
  - **fundingAttractiveness (0-3)**: 3 = $10K+ per project, 2 = $1K-$10K, 1 = $100-$1K, 0 = <$100
  - **fundingType (0-1)**: 1 = rebate/incentive/grant, 0 = loan/financing
- **Program-Specific Enhancement**:
  - **Energy programs**: Emphasize kWh savings, demand reduction, equipment lifecycle, utility bill impact
  - **Water programs**: Highlight gallons saved, compliance with ordinances, payback period, rebate per fixture
  - **EV programs**: Distinguish make-ready vs equipment rebates, fleet readiness, infrastructure capacity
  - **Building envelope**: Note year-round benefits (heating + cooling), comfort improvements, moisture control
- **Consistency**: Score all program types fairly—don't over-weight energy vs water vs EV programs
- **Use Case Quality**: Provide specific, realistic examples (not generic "a city could use this")
- **Concerns**: Identify genuine red flags (complex eligibility, limited funding, restrictive requirements) not routine program features

---

### Agent 5: Storage Agent

**Type:** `general-purpose`

**Purpose:** Insert enhanced program data directly into the database using Supabase client, following the same storage logic as agents-v2 pipeline.

#### Responsibilities

1. **Environment Detection**: Detect current environment (dev/staging/prod) and configure Supabase client accordingly
2. **Read Enhanced Programs**: Read all enhanced programs from `temp/utility-discovery/04-analyzed/` batch files
3. **Data Preparation** using v2 storage components:
   - **fundingSourceManager**: Get or create `funding_sources` table entry for each utility
   - **dataSanitizer**: Comprehensive field mapping and sanitization (following v2 approach)
   - Map all Analysis Agent fields to database schema (see Field Mapping section)
4. **Preview & Confirmation**:
   - Display insertion preview: environment, database, total programs, sample records
   - **Request final user confirmation** before proceeding with insertion
5. **Batch Insertion** (default 50 programs per batch):
   - Insert opportunities into `funding_opportunities` table
   - Automatically link to `coverage_areas` using linkOpportunityToCoverageAreas
   - Process batches in parallel for performance
6. **Return Results**: Inserted record IDs, metrics, execution time

**Note on stateEligibilityProcessor**: NOT used for utility programs. Utility programs are single-state by nature (within utility territory), so state_opportunity_eligibility table is not populated. Coverage area linking handles geographic matching.

#### Input Format
Reads from Analysis Agent output files

#### Execution Flow

**1. Environment Detection**
```javascript
// Agent automatically detects environment
const environment = process.env.NODE_ENV || 'development';
const supabaseUrl = process.env[`NEXT_PUBLIC_SUPABASE_URL_${environment.toUpperCase()}`];
const supabaseKey = process.env[`SUPABASE_SERVICE_ROLE_KEY_${environment.toUpperCase()}`];

console.log(`🗄️  Configured for ${environment} environment`);
```

**2. Insertion Preview**
```
💾 STORAGE AGENT - Insertion Preview
════════════════════════════════════

Environment: development
Database: dev-meridian-esg.supabase.co
Total Programs: 180 utility programs

Sample Programs (first 3):
  1. Express Solutions (SCE) - $50-$10,000 rebates
  2. Business Rebates (SoCalGas) - $500-$25,000 rebates
  3. Commercial Fixtures (EBMUD) - $50-$150 rebates

Utilities Covered: SCE, SoCalGas, SDG&E, EBMUD, SCVWD (5 utilities)

Breakdown:
  - Energy programs: 120
  - Water programs: 45
  - EV charging programs: 15

This will:
  ✓ Create 5 funding_sources entries (or reuse existing)
  ✓ Insert 180 funding_opportunities
  ✓ Link to coverage_areas automatically
  ✓ Set all records to active status

⚠️  CONFIRM INSERTION TO DEVELOPMENT DATABASE?
   Type 'yes' to proceed, 'no' to cancel:
```

**3. User Confirmation Required**
Agent waits for explicit "yes" confirmation before proceeding.

#### Output Format (After Confirmation)

**Insertion Results**:
```json
{
  "environment": "development",
  "database": "dev-meridian-esg.supabase.co",
  "insertion_summary": {
    "total_programs": 180,
    "successfully_inserted": 180,
    "failed_insertions": 0,
    "funding_sources_created": 2,
    "funding_sources_reused": 3,
    "coverage_areas_linked": 450
  },
  "inserted_opportunities": [
    {
      "id": 12345,
      "title": "Express Solutions",
      "agency_name": "SCE",
      "funding_source_id": "fs_sce_001",
      "url": "https://www.sce.com/business/savings-incentives/express-solutions",
      "coverage_areas_linked": 8
    },
    {
      "id": 12346,
      "title": "Business Rebates",
      "agency_name": "SoCalGas",
      "funding_source_id": "fs_socalgas_001",
      "url": "https://www.socalgas.com/business/rebates",
      "coverage_areas_linked": 10
    }
    // ... 178 more records
  ],
  "metrics": {
    "average_score": 7.2,
    "score_distribution": {
      "high_8_10": 95,
      "medium_5_7": 70,
      "low_0_4": 15
    },
    "total_max_funding": "$8,450,000"
  },
  "execution_time_ms": 4250,
  "timestamp": "2025-01-20T14:00:00Z"
}
```

#### Field Mapping (dataSanitizer Logic)

**Comprehensive mapping from Analysis Agent output to database schema:**

| Analysis Agent Field | Database Field | Transformation |
|---------------------|----------------|----------------|
| **Core Fields** |
| `id` | `api_opportunity_id` | Direct mapping (utility program ID) |
| `title` | `title` | Sanitize, limit to 255 chars |
| `enhancedDescription` | `description` | From contentEnhancement schema |
| `actionableSummary` | `actionable_description` | From contentEnhancement schema |
| `programOverview` | `program_overview` | From contentEnhancement schema |
| `programUseCases` | `program_use_cases` | From contentEnhancement schema |
| `applicationSummary` | `application_summary` | From contentEnhancement schema |
| `programInsights` | `program_insights` | From contentEnhancement schema |
| `url` | `url` | Direct mapping (source URL) |
| **Funding Details** |
| `fundingType` | `funding_type` | Direct mapping ('rebate', 'incentive', 'grant') |
| `minimumAward` | `minimum_award` | Sanitize to numeric, NULL if not specified |
| `maximumAward` | `maximum_award` | Sanitize to numeric, NULL if not specified |
| `totalFundingAvailable` | `total_funding_available` | Sanitize to numeric, NULL if not specified |
| `notes` | `notes` | Additional program details |
| **Dates** |
| `openDate` | `open_date` | Sanitize to YYYY-MM-DD, NULL if evergreen |
| `closeDate` | `close_date` | Sanitize to YYYY-MM-DD, NULL if evergreen |
| `status` | `status` | Map to enum ('open', 'upcoming', 'closed') |
| **Eligibility** |
| `eligibleApplicants` | `eligible_applicants` | Array of customer types (Commercial, Institutional, etc.) |
| `eligibleProjectTypes` | `eligible_project_types` | Array of project types (HVAC, Water Efficiency, etc.) |
| `eligibleActivities` | `eligible_activities` | Array of activities (Equipment Purchase, Installation, etc.) |
| `eligibleLocations` | `eligible_locations` | Array of location strings (used for coverage area linking) |
| `isNational` | `is_national` | Boolean (typically false for utilities) |
| **Matching** |
| `matchingRequired` | `cost_share_required` | Boolean |
| `matchingPercentage` | `cost_share_percentage` | Numeric percentage |
| **Process** |
| `disbursementType` | `disbursement_type` | Direct mapping ('instant_rebate', 'mail_in_rebate', 'reimbursement', 'on_bill_credit') |
| `awardProcess` | `award_process` | Direct mapping ('automatic', 'application_required', 'first_come_first_served') |
| **Categorization** |
| `categories` | `categories` | Array of program categories |
| `tags` | `tags` | Array of tags for filtering |
| **Scoring** |
| `scoring.overallScore` | `relevance_score` | Extract from scoring object (0-10) |
| `relevanceReasoning` | `relevance_reasoning` | From scoringAnalysis schema |
| `concerns` | `concerns` | Array of concerns/red flags |
| **Funding Source** |
| `funding_source.name` | → `funding_sources.name` | Create/lookup in funding_sources table |
| `funding_source.type` | → `funding_sources.type` | Always 'utility' |
| `funding_source.website` | → `funding_sources.website` | Utility website |
| `funding_source.contact_email` | → `funding_sources.contact_email` | Contact email |
| `funding_source.contact_phone` | → `funding_sources.contact_phone` | Contact phone |
| **System Fields** |
| N/A | `funding_source_id` | Foreign key from fundingSourceManager |
| N/A | `api_source_id` | NULL (not from API) |
| N/A | `created_at` | Current timestamp |
| N/A | `updated_at` | Current timestamp |

**NOT Mapped (API-specific fields):**
- `api_updated_at` - NULL for web-scraped sources

#### Key Considerations

- **V2 Component Reuse**: Uses same storage modules as agents-v2 (fundingSourceManager, dataSanitizer, linkOpportunityToCoverageAreas)
- **Environment Safety**: Requires explicit confirmation before insertion, with environment and database clearly displayed
- **Batch Processing**: Default 50 programs per batch for performance (configurable)
- **Parallel Execution**: Opportunities within batch processed in parallel
- **Automatic Relationships**:
  - fundingSourceManager: Creates/reuses funding_sources entries
  - linkOpportunityToCoverageAreas: Links to coverage_areas based on eligible_locations
  - NO stateEligibilityProcessor: Utility programs are single-state
- **Data Sanitization**: All fields sanitized per dataSanitizer logic:
  - Strings: Trimmed, escaped, length-limited
  - Numbers: Parsed to numeric, NULL if invalid
  - Dates: Validated YYYY-MM-DD format, NULL if invalid
  - Arrays: Sanitized elements, empty array if NULL
  - Booleans: Strict true/false conversion
- **Error Handling**: Failed insertions logged but don't stop batch processing
- **Traceability**: Original program IDs preserved in api_opportunity_id for debugging

---

## Data Flow & File Structure

### Directory Structure

```
temp/utility-discovery/
├── input/
│   └── ca-utilities.json              # Input: List of utilities to process
│
├── 01-discovery/                      # Stage 1: Discovery Agent output
│   ├── pge-programs.json
│   ├── sce-programs.json
│   ├── sdge-programs.json
│   └── ...
│
├── 02-extracted/                      # Stage 2: Extraction Agent output
│   ├── pge-express-efficiency-a1b2.json
│   ├── pge-advanced-energy-c3d4.json
│   ├── sce-express-solutions-e5f6.json
│   └── ...
│
├── 03-deduped/                        # Stage 3: Deduplication Agent output
│   ├── pge-new-programs.json
│   ├── sce-new-programs.json
│   ├── sdge-new-programs.json
│   └── duplicate-report.json
│
├── 04-analyzed/                       # Stage 4: Analysis Agent output
│   ├── pge-enhanced.json
│   ├── sce-enhanced.json
│   ├── sdge-enhanced.json
│   └── analysis-summary.json
│
├── 05-storage/                        # Stage 5: Storage Agent output
│   ├── ca-major-utilities-inserts.sql
│   ├── ca-municipal-utilities-inserts.sql
│   └── storage-summary.json
│
└── logs/
    ├── discovery-log.json
    ├── extraction-log.json
    ├── deduplication-log.json
    ├── analysis-log.json
    └── storage-log.json
```

### Data Flow Diagram

```
┌─────────────────┐
│  CA Utilities   │
│   (Database)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  input/ca-utilities.json            │
│  [{"name": "SCE", "type": "electric"}]│
└────────┬────────────────────────────┘
         │
         ▼  [Discovery Agent - WebSearch]
┌─────────────────────────────────────┐
│  01-discovery/sce-programs.json     │
│  [{"title": "Express Solutions",    │
│    "url": "https://..."}]           │
└────────┬────────────────────────────┘
         │
         ▼  [Extraction Agent - WebFetch + Claude]
┌─────────────────────────────────────┐
│  02-extracted/sce-express-a3f2.json │
│  {program_id, title, description,   │
│   incentive_amount, eligibility...} │
└────────┬────────────────────────────┘
         │
         ▼  [Deduplication Agent - DB Query]
┌─────────────────────────────────────┐
│  03-deduped/sce-new-programs.json   │
│  [Programs NOT in database]         │
└────────┬────────────────────────────┘
         │
         ▼  [Analysis Agent - Claude Enhancement]
┌─────────────────────────────────────┐
│  04-analyzed/sce-enhanced.json      │
│  {enhanced_description, summary,    │
│   relevance_score, categories...}   │
└────────┬────────────────────────────┘
         │
         ▼  [Storage Agent - SQL Generation]
┌─────────────────────────────────────┐
│  05-storage/ca-utilities-inserts.sql│
│  INSERT INTO funding_opportunities..│
└────────┬────────────────────────────┘
         │
         ▼  [Manual Review + Execution]
┌─────────────────────────────────────┐
│    funding_opportunities table      │
│    (Production Database)            │
└─────────────────────────────────────┘
```

---

## Execution Workflow

### Phase 1: Preparation

**Step 1.1: Query Utilities from Database**
```sql
-- Get all California utilities
SELECT DISTINCT utility_name, utility_type, state
FROM coverage_areas
WHERE state = 'CA' AND utility_name IS NOT NULL
ORDER BY utility_name;
```

**Step 1.2: Create Input File**
Save query results to `temp/utility-discovery/input/ca-utilities.json`:
```json
{
  "state": "CA",
  "utilities": [
    {"name": "Pacific Gas & Electric (PG&E)", "type": "electric", "state": "CA"},
    {"name": "Southern California Edison (SCE)", "type": "electric", "state": "CA"},
    {"name": "San Diego Gas & Electric (SDG&E)", "type": "electric", "state": "CA"},
    {"name": "Southern California Gas Company", "type": "gas", "state": "CA"},
    {"name": "Sacramento Municipal Utility District (SMUD)", "type": "electric", "state": "CA"}
  ],
  "total_utilities": 50,
  "prepared_date": "2025-01-20"
}
```

**Step 1.3: Create Directory Structure**
```bash
mkdir -p temp/utility-discovery/{input,01-discovery,02-extracted,03-deduped,04-analyzed,05-storage,logs}
```

### Phase 2: Execute Agent Pipeline

**Batch 1: Major IOUs (PG&E, SCE, SDG&E, SoCalGas)**

#### Stage 1: Discovery (10 utilities)
```
Launch Discovery Agent via Task tool:
- Input: temp/utility-discovery/input/ca-utilities.json (first 10)
- Agent Type: general-purpose
- Prompt: "Execute utility program discovery for batch 1..."
- Output: temp/utility-discovery/01-discovery/*.json
- Expected: ~40 program URLs per utility = 400 URLs total
```

**Review Checkpoint**: Verify discovery output, check for search quality

#### Stage 2: Extraction (50 programs per batch)
```
Launch Extraction Agent (8 batches for 400 programs):
- Input: temp/utility-discovery/01-discovery/*.json
- Agent Type: general-purpose
- Prompt: "Extract program details for 50 URLs..."
- Output: temp/utility-discovery/02-extracted/*.json
- Expected: ~380 successful extractions (95%)
```

**Review Checkpoint**: Check extraction quality, identify failed URLs

#### Stage 3: Deduplication
```
Launch Deduplication Agent:
- Input: temp/utility-discovery/02-extracted/*.json
- Agent Type: general-purpose
- Prompt: "Check for duplicates against existing database..."
- Output: temp/utility-discovery/03-deduped/*.json
- Expected: ~340 new programs (assuming 40 duplicates)
```

**Review Checkpoint**: Review duplicate report, verify matches

#### Stage 4: Analysis (50 programs per batch)
```
Launch Analysis Agent (7 batches for 340 programs):
- Input: temp/utility-discovery/03-deduped/*.json
- Agent Type: general-purpose
- Prompt: "Enhance program descriptions and score..."
- Output: temp/utility-discovery/04-analyzed/*.json
- Expected: Enhanced descriptions for all 340 programs
```

**Review Checkpoint**: Spot-check enhanced descriptions and scores

#### Stage 5: Storage
```
Launch Storage Agent:
- Input: temp/utility-discovery/04-analyzed/*.json
- Agent Type: general-purpose
- Prompt: "Generate SQL INSERT statements..."
- Output: temp/utility-discovery/05-storage/batch-1-inserts.sql
- Expected: Transaction-wrapped SQL for 340 programs
```

**Review Checkpoint**: Validate SQL syntax, review sample inserts

### Phase 3: Validation & Execution

**Step 3.1: Manual SQL Review**
- Open `temp/utility-discovery/05-storage/batch-1-inserts.sql`
- Spot-check 10-20 random INSERT statements
- Verify schema mapping is correct
- Check for data quality issues

**Step 3.2: Test Execution (Staging)**
```sql
-- Run on staging database first
\i temp/utility-discovery/05-storage/batch-1-inserts.sql

-- Verify inserts
SELECT COUNT(*) FROM funding_opportunities WHERE agency_type = 'Utility';
SELECT * FROM funding_opportunities WHERE agency_name = 'SCE' ORDER BY created_at DESC LIMIT 5;
```

**Step 3.3: Production Execution**
```sql
-- After staging validation, run on production
\i temp/utility-discovery/05-storage/batch-1-inserts.sql
```

**Step 3.4: Post-Insertion Validation**
```sql
-- Verify coverage
SELECT agency_name, COUNT(*) as program_count
FROM funding_opportunities
WHERE agency_type = 'Utility'
GROUP BY agency_name
ORDER BY program_count DESC;

-- Check for duplicates
SELECT title, agency_name, COUNT(*)
FROM funding_opportunities
WHERE agency_type = 'Utility'
GROUP BY title, agency_name
HAVING COUNT(*) > 1;
```

### Phase 4: Benchmark Comparison

**Step 4.1: Compare Against IncentiveFind Baseline**
- Manually review IncentiveFind reports (when available) for target utilities
- Cross-reference our discovered programs against their results
- Verify we captured at least everything they found
- Note: IncentiveFind methodology is unknown, and their results may not be complete

**Step 4.2: Identify Coverage Gaps**
- Document any programs found by IncentiveFind but missed by our agents
- Analyze why they were missed (search terms, website structure, etc.)
- Refine and expand search strategy to approach 100% coverage
- Conduct additional searches if gaps are identified
- Goal: Exceed IncentiveFind baseline and achieve near-complete coverage

---

## Trigger Prompt for CLAUDE.md

Add the following section to `CLAUDE.md` to enable easy triggering:

```markdown
## Utility Program Discovery Pipeline

To execute the manual utility discovery pipeline:

**Command:** "Run utility discovery for [state]"

**Examples:**
- "Run utility discovery for California"
- "Run utility discovery for Texas"
- "Run utility discovery for New York"

This will trigger the 5-agent pipeline:
1. Discovery Agent - Search for utility programs (comprehensive search for 100% coverage)
2. Extraction Agent - Extract program details
3. Deduplication Agent - Remove duplicates
4. Analysis Agent - Enhance descriptions
5. Storage Agent - Generate SQL inserts

**Expected Output:** All discoverable utility programs ready for database insertion

**Prerequisites:**
- Database access for utility list and duplicate checking
- WebSearch and WebFetch MCP tools available
- `temp/utility-discovery/` directory structure exists

**Process Flow:**
The process is repeatable for any state:
- Batch utilities in groups of 10 for discovery
- Extract program details in batches of 50
- Deduplicate against existing database
- Enhance with analysis and scoring
- Generate SQL for database insertion

**Coverage Goal:**
Target near-complete (100%) coverage of available utility programs by using comprehensive search strategies.

**Review Checkpoints:**
- After Discovery: Verify search quality and coverage completeness
- After Extraction: Check data completeness
- After Deduplication: Review duplicate matches
- Before Storage: Validate SQL statements
```

---

## Success Metrics

### Quantitative Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Coverage Rate** | Target 100% (near-complete) | Manual comparison vs IncentiveFind baseline |
| **Extraction Success Rate** | 100% complete data | All discovered programs have complete structured data |
| **Duplicate Rate** | 0% duplicates | Zero duplicate programs in final dataset |
| **Processing Time** | <8 hours per state (50 utilities) | Wall-clock time for full pipeline |
| **Repeatability** | Works for any US state | Test on multiple states successfully |

### Qualitative Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Data Quality** | High-quality descriptions | Manual review of 50 random programs |
| **Actionability** | Clear next steps for clients | User testing of actionable summaries |
| **Categorization Accuracy** | Correct program categories | Spot-check 100 programs |
| **Schema Compliance** | 100% valid SQL | SQL execution without errors |

---

## Future Considerations

### Multi-State Expansion
- Extend to additional states (Oregon, Washington, Arizona, Nevada)
- Adapt search strategies for state-specific programs
- Handle regional utility structures (municipal, co-ops, IOUs)

### Automation Opportunities
- Convert manual agent pipeline to automated scheduled process
- Build utility program scraper using Playwright/Puppeteer
- Integrate with agents-v2 pipeline for unified processing
- Implement change detection for program updates

### Data Quality Improvements
- Implement program update detection (compare old vs new data)
- Add program expiration date tracking
- Build feedback loop from client matches to improve scoring

### Integration Enhancements
- Link programs to coverage_areas for geographic matching
- Build client-to-program recommendation engine
- Create program comparison tools for clients

---

## Appendices

### Appendix A: Search Strategy Research

**Benchmark Testing (SCE)**
- 6 searches (base energy efficiency): 50% coverage
- 14 searches (expanded framework): 87% coverage
- **Expanded 10-query framework: Target 95%+ coverage including energy, water, and sustainability programs**

**Complete 10-Query Search Strategy:**

**Note:** All queries include "commercial", "institutional", and "government" terms to ensure comprehensive coverage for private businesses, schools, hospitals, nonprofits, and government facilities. This addresses the fact that 50%+ of clients are schools, universities, or government entities.

1. **`"[Utility] commercial institutional public sector energy programs incentives rebates"`**
   - Purpose: Broad energy efficiency programs (all customer types)
   - Applies to: All utility types
   - Target: Private businesses, schools, hospitals, government, nonprofits
   - Expected results: Prescriptive rebates, comprehensive program guides, institutional programs

2. **`"[Utility] third-party energy efficiency programs commercial institutional government"`**
   - Purpose: Third-party implementer programs (CEDA, CERI, Willdan, TRC)
   - Applies to: All utility types
   - Target: All non-residential customers including public sector
   - Expected results: Partner programs, design assistance, public sector programs

3. **`"[Utility] EV charging infrastructure commercial institutional government business"`**
   - Purpose: Electric vehicle charging programs
   - Applies to: Electric utilities only
   - Target: Private fleets, school districts, municipal fleets, government facilities
   - Expected results: Charge Ready, make-ready incentives, fleet programs, public charging

4. **`"[Utility] water conservation rebates commercial institutional government business"`**
   - Purpose: Water efficiency programs
   - Applies to: Water utilities
   - Target: Businesses, schools, hospitals, government buildings
   - Expected results: Fixture rebates, water audits, institutional programs

5. **`"[Utility] irrigation rebates commercial institutional government landscape"`**
   - Purpose: Irrigation efficiency programs
   - Applies to: Water utilities
   - Target: Commercial properties, schools, parks, government facilities
   - Expected results: Smart controllers, drip systems, landscape conversion, public landscape

6. **`"[Utility] water efficiency programs commercial institutional government WET"`**
   - Purpose: Custom water efficiency programs (Water Efficiency Teams)
   - Applies to: Water utilities
   - Target: All non-residential including schools and government
   - Expected results: WET programs, custom projects, institutional water programs

7. **`"[Utility] stormwater credits commercial institutional government green infrastructure"`**
   - Purpose: Stormwater management incentives
   - Applies to: Water/sewer utilities, municipalities
   - Target: Commercial properties, schools, government facilities
   - Expected results: Rain gardens, permeable pavement, green roofs, public stormwater

8. **`"[Utility] retrocommissioning RCx strategic energy management commercial institutional government"`**
   - Purpose: Operational efficiency programs
   - Applies to: All utility types
   - Target: Large buildings including schools, hospitals, government
   - Expected results: RCx, SEM, CEI, continuous improvement, public sector programs

9. **`"[Utility] building envelope windows insulation rebates commercial institutional government"`**
   - Purpose: Building shell improvements
   - Applies to: All utility types
   - Target: All building types including schools and government facilities
   - Expected results: Window upgrades, insulation, air sealing, public building programs

10. **`"[Utility] custom incentives commercial institutional government projects"`**
    - Purpose: Large custom projects and calculated incentives
    - Applies to: All utility types
    - Target: Major projects including school renovations, government retrofits
    - Expected results: Custom programs, pay-for-performance, large public sector projects

**Utility Type Query Matrix:**

| Utility Type | Applicable Queries | Skip Queries |
|--------------|-------------------|--------------|
| **Electric** | 1, 2, 3, 8, 9, 10 | 4, 5, 6, 7 (water-specific) |
| **Gas** | 1, 2, 8, 9, 10 | 3 (EV), 4, 5, 6, 7 (water-specific) |
| **Water** | 1, 2, 4, 5, 6, 7, 8 | 3 (EV-specific) |
| **Electric+Gas (Combination)** | 1, 2, 3, 8, 9, 10 | 4, 5, 6, 7 (unless also water) |
| **Water+Sewer (Combination)** | 1, 2, 4, 5, 6, 7, 8 | 3 (EV) |
| **All Services (E+G+W)** | All 10 queries | None |

**Expected Coverage by Program Type:**
- Energy efficiency: 95%+ (queries 1, 2, 8, 9, 10)
  - Commercial/private businesses: 95%+
  - Institutional (schools, hospitals, nonprofits): 90%+
  - Government/municipal facilities: 90%+
- Water conservation: 90%+ (queries 4, 5, 6, 7)
  - Includes institutional and government water programs
- EV charging: 90%+ (query 3)
  - Includes school district fleets, municipal fleets, public charging
- Building improvements: 85%+ (queries 8, 9, 10)
  - Includes public building programs

**Overall Expected Coverage: 95%+ across all sustainability programs and all customer types (commercial, institutional, public sector)**

**Institutional & Public Sector Coverage:**
With the addition of "institutional" and "government" terms to all queries, programs specifically designed for schools, universities, hospitals, nonprofits, and government facilities are now captured comprehensively. This addresses the 30-40% gap that existed when using only "commercial" terms.

### Appendix B: Program Categories

**Energy Efficiency Programs:**
- Prescriptive rebates (fixed amounts for qualified equipment)
- Custom incentives (engineering-based, project-specific)
- Continuous Energy Improvement (CEI/SEM)
- Retrocommissioning (RCx)
- Lighting upgrades (LED, controls, daylighting)
- HVAC optimization (tune-ups, controls, economizers)
- Refrigeration upgrades (efficient systems, controls)
- Process improvements (motors, VFDs, compressed air)

**Water Conservation Programs:**
- **Fixture Rebates**: High-efficiency toilets, urinals, faucets, showerheads
- **Pre-Rinse Spray Valves**: Commercial kitchen equipment
- **Cooling Tower Management**: Water-efficient cooling systems
- **Water Audits**: Professional assessments, leak detection
- **Custom Water Projects**: Process water optimization, reuse systems

**Irrigation & Landscape Programs:**
- **Smart Irrigation Controllers**: Weather-based, soil moisture sensors
- **Efficient Irrigation Equipment**: Drip systems, high-efficiency nozzles, pressure regulation
- **Landscape Conversion**: Turf removal, native plants, drought-tolerant landscaping
- **Irrigation Audits**: Professional landscape water assessments

**Stormwater & Green Infrastructure:**
- **Stormwater Credits**: Fee reductions for green infrastructure
- **Rain Gardens**: Bioretention, bioswales
- **Permeable Pavement**: Pervious concrete, porous asphalt
- **Green Roofs**: Vegetated roof systems
- **Rainwater Harvesting**: Cisterns, storage systems

**Third-Party Programs:**
- CEDA (California Energy Design Assistance) - Willdan
- CERI (Commercial Energy Reduction Initiative) - Resource Innovations
- Comfortably CA - HVAC third-party
- TECH Clean California - Heat pump program
- WET (Water Efficiency Team) programs

**EV & Charging:**
- Charge Ready programs (infrastructure rebates)
- Make-ready incentives (electrical upgrades)
- Fleet electrification programs
- DC fast charging incentives
- Workplace charging programs

**Building Envelope:**
- **Windows**: High-performance glazing, film, replacements
- **Insulation**: Roof, wall, foundation insulation upgrades
- **Air Sealing**: Building envelope tightening, weatherization
- **Roofing**: Cool roofs, reflective coatings

**Generation & Storage:**
- SGIP (Self-Generation Incentive Program)
- Net metering programs
- Community solar
- Battery storage incentives
- Fuel cells, microturbines

**Financing & Enabling:**
- On-Bill Financing (0% interest loans)
- PACE financing (Property Assessed Clean Energy)
- Energy service agreements
- Performance contracting

### Appendix C: Database Schema Reference

**funding_opportunities table (relevant fields):**
```sql
- id (SERIAL PRIMARY KEY)
- title (TEXT)
- description (TEXT)
- actionable_description (TEXT)
- agency_name (TEXT)
- agency_type (ENUM: 'Federal', 'State', 'Local', 'Utility', 'Foundation')
- url (TEXT)
- funding_amount_min (NUMERIC)
- funding_amount_max (NUMERIC)
- categories (JSONB)
- metadata (JSONB)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

**coverage_areas table:**
```sql
- id (SERIAL PRIMARY KEY)
- state (TEXT)
- county (TEXT)
- city (TEXT)
- zip_code (TEXT)
- utility_name (TEXT)
- utility_type (TEXT)
```

**opportunity_coverage_areas (junction table):**
```sql
- opportunity_id (INTEGER REFERENCES funding_opportunities)
- coverage_area_id (INTEGER REFERENCES coverage_areas)
```

### Appendix D: PDF Processing Guidelines

**File Size and Page Limits:**
- **Maximum file size**: 5MB (industry standard for web downloads)
- **Maximum pages**: 50 pages (conservative limit to ensure processing efficiency)
- **Timeout**: 60 seconds for download operations

**Processing Workflow:**
1. Discovery Agent identifies PDFs and collects metadata (size, estimated pages)
2. Extraction Agent checks if PDF is within limits
3. If within limits:
   - Playwright downloads to `temp/utility-discovery/pdfs/[program-id].pdf`
   - Read tool extracts content (text + visual analysis)
   - Claude processes as structured data
4. If exceeding limits:
   - Flag as "pdf_too_large" or "pdf_too_many_pages"
   - Add to manual review queue
   - Continue to next program

**Token Budgeting:**
- Simple text PDF: ~1,500 tokens per page
- Complex PDF (charts, tables): ~2,500 tokens per page
- 50-page limit = ~75,000-125,000 tokens (50% of context window)
- Process PDFs in batches of 10-20 to manage context

**Quality Expectations:**
- Native digital PDFs: 90%+ data completeness
- Scanned PDFs with OCR: 70-90% completeness
- Image-only scans: Flag for manual review

**Manual Review Criteria:**
- File size >5MB
- Page count >50 pages
- Download failures after retry
- Password-protected or restricted PDFs
- Low extraction confidence (<70%)

**Error Handling:**
- Retry failed downloads once with exponential backoff
- Log all failures with detailed metadata
- Continue processing remaining programs
- Maintain manual review queue for human follow-up

---

**End of Document**

*This PRD will be refined through team discussion and updated as agent prompts are developed and tested.*
