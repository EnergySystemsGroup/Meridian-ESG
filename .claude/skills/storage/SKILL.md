# Storage Agent Skill

Phase 6 of the manual funding pipeline. Sanitizes `analysis_data` from staging,
UPSERTs to production `funding_opportunities` with `promotion_status='pending_review'`,
links coverage areas, and updates staging status.

---

## Section 0: Before You Start

**MANDATORY**: Read these V2 reference files before processing any records.
You MUST understand the sanitization functions and field mapping before writing SQL.

| File | What it provides |
|------|-----------------|
| `lib/agents-v2/core/storageAgent/dataSanitizer.js` | 10 sanitization functions (title, url, status, amount, date, array, boolean, percentage, relevanceScore, description) |
| `lib/services/locationMatcher.js` | Coverage area fuzzy matching (Levenshtein ≥70% confidence) |
| `lib/agents-v2/core/storageAgent/utils/fieldMapping.js` | camelCase → snake_case field mapping reference |
| `lib/constants/taxonomies.js` | Taxonomy values for validation |

---

## Section 1: Mission

Transfer staging records to production `funding_opportunities`.

- **Input**: `analysis_status='complete'` AND `storage_status='pending'`
- **Output**: Production records with coverage areas linked, staging status updated
- **Processing**: Task tool, batches of 20, **batch SQL** (single temp file per batch)
- **Reads**: `mcp__postgres__query` (read-only MCP tool)
- **Writes**: `psql` via Bash tool using the environment variable from your prompt

### Batch Processing Strategy

To minimize tool calls and maximize speed, use a **single temp .sql file per batch**:
1. Build ALL UPSERTs for the batch into one `.sql` file
2. Execute the entire file with one `psql -f` call
3. Run one batch verification query at the end
4. Run one batch staging status update at the end
5. Delete the temp file

**Do NOT** process records one-at-a-time with individual psql calls.

---

## Section 2: Input Processing

### 2.1 Query Pending Records

```sql
SELECT mfos.id, mfos.source_id, mfos.title, mfos.url,
       mfos.analysis_data, mfos.program_id,
       mfos.extraction_data
FROM manual_funding_opportunities_staging mfos
WHERE mfos.analysis_status = 'complete'
  AND mfos.storage_status = 'pending'
ORDER BY mfos.id
LIMIT 20;
```

### 2.2 Pre-validation

For each record before processing:
- If `analysis_data` is NULL → mark `storage_status='failed'`, `storage_error='analysis_data is null'`, continue to next
- If `analysis_data->>'title'` is NULL or empty → mark failed, continue
- Claim record: `UPDATE ... SET storage_status = 'processing' WHERE id = <id>`

---

## Section 3: Data Sanitization

### CRITICAL: TEXT FIELDS MUST BE COPIED VERBATIM

**DO NOT** summarize, shorten, truncate, or compress any text field.
Text fields can be 500-2000+ characters — this is EXPECTED and CORRECT.
`sanitizeDescription()` means "trim whitespace only" — NOT "make shorter".
**Preserve all formatting**: newlines (`\n`), bullet points (`-`), paragraph breaks.

### 3.1 Complete Field Mapping

| `analysis_data` field | Sanitizer | Production column |
|----------------------|-----------|-------------------|
| `title` | sanitizeTitle (trim, max 500 chars) | `title` |
| `description` | sanitizeDescription (trim whitespace) | `description` |
| `url` | sanitizeUrl (validate, add https://) | `url` |
| `status` | sanitizeStatus (active→Open, inactive→Closed, pending→Upcoming) | `status` |
| `minimumAward` | sanitizeAmount (parse currency) | `minimum_award` |
| `maximumAward` | sanitizeAmount | `maximum_award` |
| `totalFundingAvailable` | sanitizeAmount | `total_funding_available` |
| `openDate` | sanitizeDate (→ ISO format) | `open_date` |
| `closeDate` | sanitizeDate | `close_date` |
| `postedDate` | sanitizeDate | `posted_date` |
| `eligibleApplicants` | sanitizeArray (filter nulls/empty) | `eligible_applicants` |
| `eligibleProjectTypes` | sanitizeArray | `eligible_project_types` |
| `eligibleLocations` | sanitizeArray | `eligible_locations` |
| `eligibleActivities` | sanitizeArray | `eligible_activities` |
| `categories` | sanitizeArray | `categories` |
| `tags` | sanitizeArray | `tags` |
| `matchingRequired` | sanitizeBoolean | `cost_share_required` |
| `isNational` | sanitizeBoolean | `is_national` |
| `matchingPercentage` | sanitizePercentage (clamp 0-100) | `cost_share_percentage` |
| `fundingType` | direct copy | `funding_type` |
| `incentiveStructure` | direct copy | `incentive_structure` |
| `disbursementType` | direct copy | `disbursement_type` |
| `awardProcess` | direct copy | `award_process` |
| `notes` | sanitizeDescription | `notes` |
| `scoring` | direct copy (JSONB) | `scoring` |
| `scoring.finalScore` | sanitizeRelevanceScore (clamp 0-10, round 2dp) | `relevance_score` |
| `agencyName` | fallback: funding_source name | `agency_name` |

### 3.2 VERBATIM Content Fields (6 + relevanceReasoning)

These are the LLM-generated content enhancement fields. Copy them **IN FULL**.

| `analysis_data` field | Production column | Typical length |
|----------------------|-------------------|---------------|
| `enhancedDescription` | `enhanced_description` | 1000-2000 chars |
| `actionableSummary` | `actionable_summary` | 300-600 chars |
| `programOverview` | `program_overview` | 200-400 chars |
| `programUseCases` | `program_use_cases` | 400-800 chars |
| `applicationSummary` | `application_summary` | 300-600 chars |
| `programInsights` | `program_insights` | 200-400 chars |
| `relevanceReasoning` | `relevance_reasoning` | 200-500 chars |

### 3.3 Pipeline-Specific Fields

These fields mark the record as coming from the manual pipeline:

| Field | Value | Notes |
|-------|-------|-------|
| `funding_source_id` | `staging.source_id` | FK to funding_sources |
| `api_source_id` | `NULL` | Not from API |
| `api_opportunity_id` | `'manual'` | Literal string, identifies CC pipeline |
| `program_id` | `staging.program_id` | FK to funding_programs (from Phase 3) |
| `promotion_status` | `'pending_review'` | Hidden from dashboard until admin promotes |

---

## Section 4: Funding Source Enrichment

If `extraction_data->'funding_source'` contains additional details, update the
`funding_sources` record — but only fill NULL fields (COALESCE pattern):

```sql
UPDATE funding_sources
SET
  website = COALESCE(website, $STOR$<extracted_website>$STOR$),
  description = COALESCE(description, $STOR$<extracted_description>$STOR$),
  contact_email = COALESCE(contact_email, $STOR$<extracted_email>$STOR$),
  contact_phone = COALESCE(contact_phone, $STOR$<extracted_phone>$STOR$),
  updated_at = NOW()
WHERE id = '<source_id>'
  AND (website IS NULL OR description IS NULL
       OR contact_email IS NULL OR contact_phone IS NULL);
```

Skip this step if `extraction_data->'funding_source'` is NULL or all fields
already populated on the source.

---

## Section 5: UPSERT to funding_opportunities

### 5.1 SQL Template

```sql
INSERT INTO funding_opportunities (
  title, description, url, status,
  minimum_award, maximum_award, total_funding_available,
  open_date, close_date, posted_date,
  eligible_applicants, eligible_project_types, eligible_locations,
  eligible_activities, categories, tags,
  cost_share_required, is_national, cost_share_percentage,
  funding_type, incentive_structure, disbursement_type, award_process, notes,
  enhanced_description, actionable_summary,
  program_overview, program_use_cases, application_summary, program_insights,
  relevance_reasoning, relevance_score, scoring,
  agency_name, funding_source_id,
  api_source_id, api_opportunity_id, program_id, promotion_status,
  created_at, updated_at
) VALUES (
  $STOR$<title>$STOR$,
  $STOR$<description>$STOR$,
  $STOR$<url>$STOR$,
  '<status>',
  <minimum_award>,         -- numeric or NULL
  <maximum_award>,         -- numeric or NULL
  <total_funding_available>, -- numeric or NULL
  <open_date>,             -- timestamp or NULL
  <close_date>,            -- timestamp or NULL
  <posted_date>,           -- timestamp or NULL
  <eligible_applicants>,   -- ARRAY['...'] or NULL
  <eligible_project_types>,
  <eligible_locations>,
  <eligible_activities>,
  <categories>,
  <tags>,
  <cost_share_required>,   -- boolean or NULL
  <is_national>,           -- boolean or NULL
  <cost_share_percentage>, -- numeric or NULL
  $STOR$<funding_type>$STOR$,
  $STOR$<incentive_structure>$STOR$,
  $STOR$<disbursement_type>$STOR$,
  $STOR$<award_process>$STOR$,
  $STOR$<notes>$STOR$,
  $STOR$<enhanced_description>$STOR$,
  $STOR$<actionable_summary>$STOR$,
  $STOR$<program_overview>$STOR$,
  $STOR$<program_use_cases>$STOR$,
  $STOR$<application_summary>$STOR$,
  $STOR$<program_insights>$STOR$,
  $STOR$<relevance_reasoning>$STOR$,
  <relevance_score>,       -- numeric 0-10
  $STOR$<scoring_json>$STOR$::jsonb,
  $STOR$<agency_name>$STOR$,
  '<funding_source_id>'::uuid,
  NULL,                    -- api_source_id (not from API)
  'manual',                -- api_opportunity_id
  '<program_id>'::uuid,    -- from staging
  'pending_review',        -- hidden until admin promotes
  NOW(),
  NOW()
)
ON CONFLICT (funding_source_id, title) WHERE api_source_id IS NULL
DO UPDATE SET
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  status = EXCLUDED.status,
  minimum_award = EXCLUDED.minimum_award,
  maximum_award = EXCLUDED.maximum_award,
  total_funding_available = EXCLUDED.total_funding_available,
  open_date = EXCLUDED.open_date,
  close_date = EXCLUDED.close_date,
  posted_date = EXCLUDED.posted_date,
  eligible_applicants = EXCLUDED.eligible_applicants,
  eligible_project_types = EXCLUDED.eligible_project_types,
  eligible_locations = EXCLUDED.eligible_locations,
  eligible_activities = EXCLUDED.eligible_activities,
  categories = EXCLUDED.categories,
  tags = EXCLUDED.tags,
  cost_share_required = EXCLUDED.cost_share_required,
  is_national = EXCLUDED.is_national,
  cost_share_percentage = EXCLUDED.cost_share_percentage,
  funding_type = EXCLUDED.funding_type,
  incentive_structure = EXCLUDED.incentive_structure,
  disbursement_type = EXCLUDED.disbursement_type,
  award_process = EXCLUDED.award_process,
  notes = EXCLUDED.notes,
  enhanced_description = EXCLUDED.enhanced_description,
  actionable_summary = EXCLUDED.actionable_summary,
  program_overview = EXCLUDED.program_overview,
  program_use_cases = EXCLUDED.program_use_cases,
  application_summary = EXCLUDED.application_summary,
  program_insights = EXCLUDED.program_insights,
  relevance_reasoning = EXCLUDED.relevance_reasoning,
  relevance_score = EXCLUDED.relevance_score,
  scoring = EXCLUDED.scoring,
  agency_name = EXCLUDED.agency_name,
  program_id = EXCLUDED.program_id,
  promotion_status = EXCLUDED.promotion_status,
  updated_at = NOW()
RETURNING id;
```

### 5.2 Batch Execution Pattern

**Build ALL UPSERTs into a single temp .sql file**, then execute once:

```
-- /tmp/store_batch_<timestamp>.sql
-- Record 1
INSERT INTO funding_opportunities (...) VALUES (...) ON CONFLICT ... DO UPDATE SET ... RETURNING id;
-- Record 2
INSERT INTO funding_opportunities (...) VALUES (...) ON CONFLICT ... DO UPDATE SET ... RETURNING id;
-- ... (all records in batch)
```

Execute with: `psql "$ENV_VAR" -f /tmp/store_batch_<timestamp>.sql`

Capture RETURNING ids from psql output (each UPSERT prints the returned UUID).
Then delete the temp file.

### 5.3 Key Points

- **Dollar-quote text fields** with `$STOR$...$STOR$` to avoid SQL injection from quotes in content
- **UPSERT conflict key**: `(funding_source_id, title) WHERE api_source_id IS NULL` — the partial unique index only applies to manual pipeline records
- **DO UPDATE SET**: All fields except `id` and `created_at` — newer analysis always wins
- **RETURNING id**: Capture the UUID for coverage area linking in the next step
- **Single temp file per batch**: Build all UPSERTs, execute once with `psql -f`, delete file
- **Do NOT** run one psql call per record — batch them all into one file

---

## Section 6: Coverage Area Linking

After UPSERT returns the `opportunity_id`, link coverage areas from `eligible_locations`.

### 6.1 Manual SQL Approach

Since `locationMatcher.js` is a JS module (not callable from psql), replicate the
logic directly in SQL:

```sql
-- Step 1: Delete existing links (for UPSERT update case)
DELETE FROM opportunity_coverage_areas
WHERE opportunity_id = '<opportunity_id>'::uuid;

-- Step 2: For each location in eligible_locations, fuzzy match to coverage_areas
-- Example for a state match:
INSERT INTO opportunity_coverage_areas (opportunity_id, coverage_area_id)
SELECT '<opportunity_id>'::uuid, ca.id
FROM coverage_areas ca
WHERE ca.kind = 'state' AND ca.name ILIKE '%Oregon%'
ON CONFLICT DO NOTHING;

-- Example for a utility match:
INSERT INTO opportunity_coverage_areas (opportunity_id, coverage_area_id)
SELECT '<opportunity_id>'::uuid, ca.id
FROM coverage_areas ca
WHERE ca.kind = 'utility'
  AND similarity(LOWER(ca.name), LOWER('<location_text>')) > 0.7
ON CONFLICT DO NOTHING;
```

### 6.2 Location Type Detection

Parse each location string to determine kind:
- Contains "county" → `kind = 'county'`
- Contains state name or 2-letter code → `kind = 'state'`
- Contains "national", "nationwide", "all states" → set `is_national = TRUE` on opportunity
- Otherwise → try utility match first, then county, then state (most specific first)

### 6.3 Batch Coverage Linking

Include coverage area operations in the same temp `.sql` file as the UPSERTs.
For each record, append DELETE + INSERT statements after its UPSERT:

```sql
-- Record 1: UPSERT
INSERT INTO funding_opportunities (...) VALUES (...) ON CONFLICT ... RETURNING id;
-- Record 1: Coverage (use the known opportunity_id if updating, or handle RETURNING)
DELETE FROM opportunity_coverage_areas WHERE opportunity_id = '<id>';
INSERT INTO opportunity_coverage_areas (opportunity_id, coverage_area_id)
SELECT '<id>', ca.id FROM coverage_areas ca WHERE ... ON CONFLICT DO NOTHING;
-- Record 2: UPSERT
-- Record 2: Coverage
-- ...
```

### 6.4 Failure Handling

If coverage area linking fails for a record:
- Log a warning (not an error)
- The opportunity is still stored — just not linked geographically
- Continue processing (do NOT halt the batch)
- Can be re-linked later via backfill

---

## Section 7: Staging Status Updates

### 7.1 Batch Status Update

After ALL UPSERTs complete successfully, update staging status for the entire batch
in a **single psql call** (or append to the same temp .sql file):

```sql
-- Batch success update (one statement for all successful records)
UPDATE manual_funding_opportunities_staging
SET storage_status = 'complete',
    opportunity_id = v.opp_id::uuid,
    stored_at = NOW(),
    stored_by = 'storage-agent'
FROM (VALUES
  ('<staging_id_1>'::uuid, '<opp_id_1>'::uuid),
  ('<staging_id_2>'::uuid, '<opp_id_2>'::uuid),
  ('<staging_id_3>'::uuid, '<opp_id_3>'::uuid)
) AS v(staging_id, opp_id)
WHERE id = v.staging_id;
```

### 7.2 Individual Failure

If a specific record fails during UPSERT, mark it individually:

```sql
UPDATE manual_funding_opportunities_staging
SET storage_status = 'failed',
    storage_error = $STOR$<error_message>$STOR$,
    stored_at = NOW(),
    stored_by = 'storage-agent'
WHERE id = '<staging_id>'::uuid;
```

---

## Section 8: Batch Report

After processing all records, output this report:

```
=== STORAGE REPORT ===
Records processed: X of Y pending
  Stored:    A (new: N, updated: U)
  Failed:    B
  Coverage areas linked: C
Remaining pending: Z records
```

Determine new vs updated by checking if UPSERT returned a newly created record
(check if `created_at` equals `updated_at` on the returned id).

---

## Section 9: Error Handling

| Situation | Action |
|-----------|--------|
| `analysis_data` is NULL | Mark `failed`, continue to next |
| Missing required field (title) | Mark `failed`, skip record |
| UPSERT fails (constraint violation) | Mark `failed` with error, continue |
| Coverage linking fails | Warning only, opportunity still stored, continue |
| psql write fails (connection) | Log error, mark `failed`, continue |
| `program_id` is NULL on staging | Set `program_id = NULL` in UPSERT (nullable FK) |
| `source_id` is NULL on staging | Mark `failed` — cannot store without funding_source_id |
| Temp .sql file execution fails | Check psql error output, identify which record failed, mark that one `failed`, re-run remaining |

**Never halt the batch** for a single record failure. Each record gets its own
`complete` or `failed` status.

**Batch efficiency**: All UPSERTs + coverage area links go in ONE temp .sql file.
All staging status updates go in ONE psql call. ONE verification query at the end.
Target: ~10-15 tool calls total (not 6× per record).

---

## Section 10: Verification Query

Run after storage to verify text fields were NOT truncated:

```sql
SELECT
  fo.title,
  LENGTH(s.analysis_data->>'enhancedDescription') as staging_len,
  LENGTH(fo.enhanced_description) as prod_len,
  CASE WHEN LENGTH(fo.enhanced_description) < LENGTH(s.analysis_data->>'enhancedDescription') * 0.9
       THEN 'TRUNCATED' ELSE 'OK' END as status
FROM manual_funding_opportunities_staging s
JOIN funding_opportunities fo ON fo.id = s.opportunity_id
WHERE s.storage_status = 'complete'
ORDER BY staging_len DESC LIMIT 10;
```

If any show `TRUNCATED`, the agent must re-process those records.

Also verify pipeline-specific fields:
```sql
SELECT fo.title, fo.promotion_status, fo.api_source_id, fo.api_opportunity_id,
       fo.program_id, fo.funding_source_id
FROM funding_opportunities fo
JOIN manual_funding_opportunities_staging s ON fo.id = s.opportunity_id
WHERE s.storage_status = 'complete'
  AND s.stored_by = 'storage-agent';
```

Expected: `promotion_status='pending_review'`, `api_source_id=NULL`,
`api_opportunity_id='manual'`, `program_id` NOT NULL, `funding_source_id` NOT NULL.
