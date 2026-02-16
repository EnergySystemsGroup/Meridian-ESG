---
name: analysis
description: >
  Phase 5 of the manual funding pipeline. Performs LLM content enhancement
  (6 fields) and deterministic scoring on extracted staging records. Merges
  results into analysis_data JSONB. Source-type agnostic — the energy services
  GC framing applies to all source types. Orchestrator handles post-batch
  filtering (finalScore < 2 = filtered).
---

# Content Analysis & Scoring — Phase 5

## 0. Before You Start (REQUIRED)

Read this entire skill file before processing any records.

**MANDATORY**: Read these files BEFORE any analysis work:

### Taxonomy File (MUST read first)

Read `lib/constants/taxonomies.js` — you need all five tiered taxonomy categories:

| Taxonomy | Used For | Scoring Role |
|----------|----------|-------------|
| `ELIGIBLE_APPLICANTS` | Who can apply (tiered: hot/strong/mild/weak) | `clientRelevance` (0-3) |
| `ELIGIBLE_PROJECT_TYPES` | What gets funded (tiered) | `projectTypeRelevance` (0-3) |
| `ELIGIBLE_ACTIVITIES` | What actions the money pays for (tiered) | `activityMultiplier` (0.25-1.0) |
| `CATEGORIES` | Broad domain — Energy, Infrastructure, etc. (tiered) | Reference only |
| `FUNDING_TYPES` | Grant, Rebate, Tax Credit, etc. (tiered) | `fundingType` (0-1) |

### V2 Analysis Reference Files (MUST read before analyzing)

| File | What It Provides | Key Lines |
|------|-----------------|-----------|
| `lib/agents-v2/core/analysisAgent/contentEnhancer.js` | LLM prompt for 6 content fields | Lines 23-85: full prompt template |
| `lib/agents-v2/core/analysisAgent/scoringAnalyzer.js` | Deterministic scoring functions | Lines 13-95: tier calculations; Lines 102-143: reasoning; Lines 151-175: concerns |
| `lib/agents-v2/core/analysisAgent/parallelCoordinator.js` | Merge pattern | Lines 54-106: `mergeAnalysisResults()` |

**Rules**:
- Read ALL files above before processing any records
- Scoring is DETERMINISTIC — replicate the JS functions, do NOT use LLM for scoring
- Content enhancement uses LLM — follow the contentEnhancer.js prompt structure
- All taxonomy values must come from `lib/constants/taxonomies.js`

---

## 1. Mission

Transform staging records from extracted data into fully-analyzed, scored opportunities
ready for storage.

**Input**: Staging records where `extraction_status = 'complete'` AND `analysis_status = 'pending'`

**Output per record**:
- `analysis_data` JSONB: merged object = all extraction fields + 6 content enhancement fields + scoring object + relevanceReasoning + concerns
- `analysis_status = 'complete'` (the analysis agent always sets complete or error — filtering is handled by the orchestrator post-batch)

**Source-type agnostic**: The V2 content enhancement prompt is written from Meridian's
perspective as an energy services general contractor. This framing applies to ALL source
types — utilities, state agencies, counties, municipalities, foundations, federal. The
question is always "is this relevant to OUR clients (school districts, municipalities)?"

**Processing model**: Task tool, batches of 20, sequential within batch.

---

## 2. Input Processing

### Query Pending Records

Use `mcp__postgres__query` (read-only):

```sql
SELECT mfos.id, mfos.title, mfos.url, mfos.extraction_data, mfos.source_id,
       mfos.program_id,
       fs.name as source_name, fs.funder_type, fs.state_code
FROM manual_funding_opportunities_staging mfos
JOIN funding_sources fs ON fs.id = mfos.source_id
WHERE mfos.extraction_status = 'complete'
  AND mfos.analysis_status = 'pending'
ORDER BY mfos.id
LIMIT 20;
```

### Claim Records

Before processing each record, mark it as processing via psql:

```sql
UPDATE manual_funding_opportunities_staging
SET analysis_status = 'processing'
WHERE id = '[staging_record_uuid]';
```

### Pre-Validation

For each claimed record:
- If `extraction_data` is NULL or empty → set `analysis_status = 'error'`,
  `analysis_error = 'Missing extraction_data'`, continue to next record
- If `extraction_data` lacks required fields (`title`, `eligibleApplicants`) →
  log warning but proceed (extract what you can)

### Zero Pending

If the query returns zero rows, report "No pending analysis records" and stop.

---

## 3. Content Enhancement (LLM)

Generate 6 strategic content fields using the extraction_data from Phase 4.

### 3a. Prompt Structure

Read `lib/agents-v2/core/analysisAgent/contentEnhancer.js` (lines 23-85) for the
full prompt structure. The V2 prompt includes:
- Business context: energy services company, primary clients from taxonomy hot tier
- Emphasis on "our role as the service provider executing work FOR clients"
- Instruction to analyze INDEPENDENTLY per opportunity

Follow the V2 prompt for fields 1, 3-6 EXACTLY as written. For field 2
(`actionableSummary`), use the repurposed "How to Win" prompt below.

### 3b. Six Content Fields

**1. `enhancedDescription`** (2-3 paragraphs)
- Follow V2 contentEnhancer.js field #1 exactly
- Detailed strategic description: what it is, who qualifies, what projects qualify
- Include 2-3 use case examples showing how WE help clients by executing work FOR them

**2. `actionableSummary`** — **"How to Win This Grant"** (REPURPOSED)

This field is repurposed from the V2 "general sales brief" to a strategic winning guide.
Use this prompt instead of the V2 prompt for field #2:

> Write a strategic "How to Win" brief for this funding opportunity. Answer the question:
> "What do I need to do to maximize my chances of winning this grant?"
>
> Focus on the 3-5 most impactful things that would make the difference between a funded
> and unfunded application. Be specific to THIS program — no generic advice.
>
> Cover as applicable:
> - **Narrative**: What story or angle should the application tell? What resonates with
>   this program's goals? (e.g., "Emphasize community impact and equity outcomes")
> - **Evaluation priorities**: What do reviewers score highest? What gets bonus points?
>   (e.g., "50%+ cost match scores significantly higher", "Disadvantaged community
>   projects get automatic priority")
> - **Pitfalls**: What non-obvious requirements or restrictions could sink an application?
>   (e.g., "Must have pre-approval before purchasing equipment", "Letters of support
>   from 3+ community organizations required")
> - **Competitive actions**: What concrete steps should the applicant take?
>   (e.g., "Build relationship with the regional coordinator before applying",
>   "Focus on projects that demonstrate measurable energy savings")
>
> Write in direct, actionable language: "You should...", "Focus on...", "Make sure to..."
> Keep to 3-5 key points. Each point should be a substantive insight, not a checkbox.

**3. `programOverview`** (<75 words)
- Follow V2 contentEnhancer.js field #3 exactly
- Elevator pitch: what it funds, award range, who can apply, unique strategic value

**4. `programUseCases`** (3-4 bullets)
- Follow V2 contentEnhancer.js field #4 exactly
- Specific, realistic scenarios — NOT generic
- Format: [Client Type] + [Problem] + [Funding Solution]
- Quality check: if a use case could apply to any program, it's too generic — rewrite

**5. `applicationSummary`** (4-5 bullets)
- Follow V2 contentEnhancer.js field #5 exactly
- Process steps, timeline, key submissions, one tip for success

**6. `programInsights`** (2-3 bullets)
- Follow V2 contentEnhancer.js field #6 exactly
- Non-obvious details that impact decisions: restrictions, scoring bonuses, tech assistance

### 3c. Quality Standards

- Use cases MUST be specific and realistic:
  - Good: "School district retrofitting 500 classrooms with LED lighting qualifies for $25,000"
  - Bad: "Schools can get rebates for lighting"
- Enhanced descriptions MUST include concrete examples from OUR perspective as service provider
- "How to Win" MUST be specific to this program — reject anything that could apply generically

---

## 4. Scoring (DETERMINISTIC)

Scoring is NOT done by LLM. Replicate the exact functions from `scoringAnalyzer.js`.

### 4a. Five Scoring Components

**1. `clientRelevance`** (0-3): `calculateTierScore(eligibleApplicants, TAXONOMIES.ELIGIBLE_APPLICANTS)`
- Match each applicant type against taxonomy tiers
- Return highest matching tier: hot=3, strong=2, mild=1, weak/none=0

**2. `projectTypeRelevance`** (0-3): `calculateTierScore(eligibleProjectTypes, TAXONOMIES.ELIGIBLE_PROJECT_TYPES)`
- Same tier matching logic as clientRelevance

**3. `fundingAttractiveness`** (0-3): `calculateFundingScore(opportunity)`
- 3 (Exceptional): `totalFundingAvailable >= $50M` OR `maximumAward >= $5M`
- 2 (Strong): `totalFundingAvailable >= $25M` OR `maximumAward >= $2M`
- 1 (Moderate): `totalFundingAvailable >= $10M` OR `maximumAward >= $1M` OR **both amounts unknown** (null/0)
- 0 (Low): Below all thresholds AND at least one amount is known
- **Key nuance**: "unknown" (score=1) only applies when BOTH `totalFundingAvailable` and `maximumAward` are null/0. If one is known and below thresholds, score is 0.

**4. `fundingType`** (0-1): `calculateFundingTypeScore(fundingType, TAXONOMIES.FUNDING_TYPES)`
- 1: hot or strong tier (e.g., Grant, Rebate)
- 0.5: mild tier
- 0: weak tier or unknown
- Case-insensitive matching

**5. `activityMultiplier`** (0.25-1.0): `calculateActivityMultiplier(eligibleActivities, TAXONOMIES.ELIGIBLE_ACTIVITIES)`
- 1.0: hot tier activities (e.g., Installation, Equipment Purchase)
- 0.75: strong tier
- 0.5: mild tier
- 0.25: weak tier or no activities specified

### 4b. Score Calculation

```
baseScore = clientRelevance + projectTypeRelevance + fundingAttractiveness + fundingType
           (range: 0-10)

finalScore = Math.round(baseScore * activityMultiplier * 10) / 10
           (range: 0-10, rounded to 1 decimal)
```

### 4c. Reasoning

Follow `generateDeterministicReasoning()` from scoringAnalyzer.js (lines 102-143).
Format:

```
CLIENT RELEVANCE (X/3): "[applicant list]" → Tier: [Hot/Strong/Mild/Weak] → Score: X

PROJECT TYPE RELEVANCE (X/3): "[project type list]" → Tier: [tier] → Score: X

FUNDING ATTRACTIVENESS (X/3): "$[total] total, $[max] max award" → Tier: [tier] → Score: X

FUNDING TYPE (X/1): "[type]" → Score: X

ACTIVITY MULTIPLIER (Xx): "[activity list]" → Tier: [tier] → Multiplier: Xx

BASE SCORE: X | FINAL SCORE: X × X = X.X
```

### 4d. Concerns

Follow `identifyBasicConcerns()` from scoringAnalyzer.js (lines 151-175):
- No eligible applicants specified → "manual review required"
- No project types specified → "manual review required"
- No activities specified → "may limit scoring accuracy"
- Both funding amounts unknown → "may impact attractiveness scoring"
- Description contains "research only" → "may not align with implementation services"

---

## 5. Filtering (Orchestrator-Handled)

**The analysis agent does NOT filter.** It sets all successfully analyzed records to
`analysis_status = 'complete'`.

**After the batch completes**, the orchestrator runs a filter SQL:

```sql
UPDATE manual_funding_opportunities_staging
SET analysis_status = 'filtered',
    analysis_error = 'Filtered: finalScore ' ||
      (analysis_data->'scoring'->>'finalScore') || ' below threshold 2'
WHERE analysis_status = 'complete'
  AND (analysis_data->'scoring'->>'finalScore')::numeric < 2;
```

**Threshold**: `finalScore < 2` (matches V2 `filterFunction.js`)

**Effect**: Phase 6 queries `WHERE analysis_status = 'complete'` — filtered records
are naturally excluded. Full `analysis_data` remains on filtered records for review.

**The analysis agent reports scores in its batch report** (including below-threshold
scores) so the orchestrator knows what to expect from the filter SQL.

---

## 6. Merging (analysis_data JSONB)

Follow `parallelCoordinator.js` `mergeAnalysisResults()` (lines 54-106).

The `analysis_data` JSONB must contain the COMPLETE merged object — ALL extraction
fields PLUS ALL analysis fields:

```json
{
  // ===== EXTRACTION FIELDS (spread ALL from extraction_data) =====
  "id": "[staging record UUID]",
  "title": "Program Name",
  "description": "...",
  "fundingType": "Grant",
  "funding_source": { "name": "Source Name", "type": "State" },
  "totalFundingAvailable": 30000,
  "minimumAward": 5000,
  "maximumAward": 20000,
  "openDate": "2026-01-15",
  "closeDate": "2026-06-30",
  "eligibleApplicants": ["Local Governments", "Nonprofit Organizations 501(c)(3)"],
  "eligibleProjectTypes": ["Water Conservation", "Stormwater Management"],
  "eligibleLocations": ["OR"],
  "eligibleActivities": ["Installation", "Design", "Technical Assistance"],
  "url": "https://example.com/program",
  "matchingRequired": true,
  "matchingPercentage": 40,
  "categories": ["Environment", "Infrastructure"],
  "tags": ["water", "nonpoint-source", "EPA"],
  "status": "open",
  "isNational": false,
  "awardProcess": "competitive",
  "disbursementType": "reimbursement",

  // ===== CONTENT ENHANCEMENT (6 LLM-generated fields) =====
  "enhancedDescription": "...",
  "actionableSummary": "...",
  "programOverview": "...",
  "programUseCases": "...",
  "applicationSummary": "...",
  "programInsights": "...",

  // ===== SCORING (DETERMINISTIC from scoringAnalyzer.js) =====
  "scoring": {
    "clientRelevance": 2,
    "projectTypeRelevance": 2,
    "fundingAttractiveness": 0,
    "fundingType": 1,
    "activityMultiplier": 1.0,
    "baseScore": 5,
    "finalScore": 5.0
  },
  "relevanceReasoning": "CLIENT RELEVANCE (2/3): ... → Tier: Strong → Score: 2\n\n...",
  "concerns": []
}
```

**CRITICAL**: The storage agent expects `analysis_data` to contain EVERYTHING needed
for `funding_opportunities` table insertion. Do NOT omit any extraction fields.

**Merge rule**: `analysis_data = { ...extraction_data, ...contentEnhancement, scoring, relevanceReasoning, concerns }`

---

## 7. Database Updates (SQL Templates)

All writes via `psql "$ENV_VAR"` — the environment variable is provided by the
orchestrator in the agent prompt. **Never hardcode database URLs.**

### Success (complete)

```sql
UPDATE manual_funding_opportunities_staging
SET
  analysis_status = 'complete',
  analysis_data = $ANALYSIS$
[merged JSON object]
$ANALYSIS$::jsonb,
  analysis_error = NULL,
  analyzed_at = NOW(),
  analyzed_by = 'analysis-agent',
  updated_at = NOW()
WHERE id = '[staging_record_uuid]';
```

### Error

```sql
UPDATE manual_funding_opportunities_staging
SET
  analysis_status = 'error',
  analysis_error = '[error description]',
  analyzed_at = NOW(),
  analyzed_by = 'analysis-agent',
  updated_at = NOW()
WHERE id = '[staging_record_uuid]';
```

### SQL Safety

- **Dollar-quoting**: Use `$ANALYSIS$...$ANALYSIS$` to wrap JSON (prevents SQL
  injection from content containing single quotes)
- **Large content** (>100KB SQL statement): Write to a temp `.sql` file, execute
  via `psql -f /tmp/analysis_update_[uuid].sql "$ENV_VAR"`, then delete the temp file
- **One UPDATE per record**: Do not batch multiple records into a single UPDATE

### Filtered (orchestrator handles — NOT the analysis agent)

See Section 5. The orchestrator runs filter SQL after all analysis agents complete.

---

## 8. Batch Report Format

After processing all records in a batch, output this report:

```
=== ANALYSIS REPORT ===
Records processed: X of Y pending
  Complete:  A (analysis_data populated)
  Errors:    B

Score distribution:
  High (8-10):              H records
  Medium (5-7.9):           M records
  Low (2-4.9):              L records
  Below threshold (<2):     F records
  Average finalScore:       N.N

Details:
  [uuid] "Title" → complete (finalScore: 7.2)
  [uuid] "Title" → complete (finalScore: 1.5)  ← will be filtered by orchestrator
  [uuid] "Title" → error (Missing extraction_data)

Remaining pending: Z records
```

**Note**: The report includes ALL scored records. Records with `finalScore < 2` will be
flipped to `filtered` by the orchestrator AFTER this report.

---

## 9. Error Handling

| Situation | Action |
|-----------|--------|
| `extraction_data` is NULL | Set `analysis_status='error'`, `analysis_error='Missing extraction_data'`, continue |
| Content enhancement fails (LLM error) | Retry once. Still failing → set `error`, continue |
| Scoring produces NaN/undefined | Recalculate with 0 defaults, add concern, proceed |
| `finalScore != baseScore * activityMultiplier` | Recalculate deterministically (rounding error) |
| Generic use cases detected | Regenerate with more specific examples |
| psql write fails | Log error, set `analysis_status='error'`, continue |
| All records in batch error | Complete batch, report error count |

**Key principle**: Never silently skip a record. Every record ends with
`analysis_status = 'complete'` or `analysis_status = 'error'`.

---

## 10. Database Reference

### Tables Read (via `mcp__postgres__query`)

| Table | Columns Used |
|-------|-------------|
| `manual_funding_opportunities_staging` | id, title, url, extraction_data, source_id, program_id, extraction_status, analysis_status |
| `funding_sources` | id, name, funder_type, state_code |

### Tables Written (via `psql "$ENV_VAR"`)

| Table | Columns Written |
|-------|----------------|
| `manual_funding_opportunities_staging` | analysis_status, analysis_data, analysis_error, analyzed_at, analyzed_by, updated_at |

### Connection Pattern

- **Reads**: `mcp__postgres__query` (read-only MCP tool)
- **Writes**: `source .env.local && psql "$ENV_VAR"` where `$ENV_VAR` is provided by orchestrator
  - Dev: `$DEV_CLAUDE_URL`
  - Staging: `$STAGING_CLAUDE_URL`
  - Production: `$PROD_CLAUDE_URL`
