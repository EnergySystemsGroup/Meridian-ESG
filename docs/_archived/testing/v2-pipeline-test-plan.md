# V2 Pipeline Comprehensive Test Plan

## Overview
This document outlines all test scenarios needed to verify the V2 pipeline's correct behavior across all permutations and edge cases.

## Pipeline Flow Summary
```
Extract → Early Duplicate Detector → Branch:
  ├─ NEW → Analysis → Filter → Storage
  ├─ UPDATE → Direct Update Handler
  └─ SKIP → End
```

## Test Scenarios

### 1. New Opportunities (NEW Path)
**Purpose**: Verify brand new opportunities go through full pipeline

#### Test 1.1: New Opportunities - Full Pipeline
- **Setup**: Clear funding_opportunities table for test source
- **Input**: Opportunities with IDs that don't exist in DB
- **Expected Path**: Extract → Duplicate Detector (NEW) → Analysis → Filter → Storage
- **Verification**:
  - All stages executed with metrics
  - Opportunities stored in database
  - Token usage tracked for Analysis
  - Execution time recorded for each stage

#### Test 1.2: New Opportunities - Filter Pass/Fail
- **Setup**: Empty database
- **Input**: Mix of eligible and ineligible opportunities
- **Expected Path**: NEW → Analysis → Filter (partial pass) → Storage
- **Verification**:
  - Only eligible opportunities stored
  - Filter metrics show correct pass/fail counts
  - Filtered opportunities not in database

### 2. Duplicate Detection - Skip Path
**Purpose**: Verify exact duplicates are skipped efficiently

#### Test 2.1: Exact Duplicates - No Changes
- **Setup**: Seed database with existing opportunities
- **Input**: Identical opportunities (same ID, title, all fields)
- **Expected Path**: Extract → Duplicate Detector (SKIP) → End
- **Verification**:
  - Analysis stage NOT called
  - No database updates
  - Skip metrics incremented
  - Token usage = 0 for skipped opportunities

#### Test 2.2: Minor Changes Below Threshold
- **Setup**: Existing opportunities in database
- **Input**: Opportunities with <5% amount changes or minor description edits
- **Expected Path**: Extract → Duplicate Detector (SKIP) → End
- **Verification**:
  - Changes detected but deemed immaterial
  - No updates performed
  - Skip reason logged as "below_threshold"

### 3. Update Path - Material Changes
**Purpose**: Verify opportunities with significant changes are updated efficiently

#### Test 3.1: Critical Field Changes
- **Setup**: Existing opportunities with known values
- **Input**: Same opportunities with changed critical fields:
  - Close date changed
  - Amount changed >5%
  - Status changed
- **Expected Path**: Extract → Duplicate Detector (UPDATE) → Direct Update Handler
- **Verification**:
  - Analysis stage bypassed (no token usage)
  - Only changed fields updated
  - Update metrics captured
  - Original non-changed fields preserved

#### Test 3.2: Multiple Field Changes
- **Setup**: Existing opportunity
- **Input**: Multiple critical fields changed simultaneously
- **Expected Path**: UPDATE path
- **Verification**:
  - All changes applied atomically
  - Update timestamp updated
  - Change history tracked

### 4. Force Full Reprocessing (FFR)
**Purpose**: Verify FFR bypasses duplicate detection correctly

#### Test 4.1: FFR Enabled - All Treated as New
- **Setup**: 
  - Database with existing opportunities
  - Enable force_full_reprocessing flag on source
- **Input**: Mix of new and existing opportunities
- **Expected Path**: Extract → Mock Duplicate Detector → Analysis → Filter → Storage
- **Verification**:
  - ALL opportunities go through Analysis (even duplicates)
  - FFR flag auto-disabled after run
  - Metrics show forceFullProcessingUsed = true
  - Existing records updated/replaced

#### Test 4.2: FFR Rollback on Failure
- **Setup**: Enable FFR flag
- **Input**: Cause deliberate failure in Storage stage
- **Expected Behavior**:
  - Pipeline fails
  - FFR flag restored to true (rollback)
  - Run marked as failed
  - Error metrics captured

### 5. Edge Cases

#### Test 5.1: Empty API Response
- **Setup**: Normal database state
- **Input**: Empty array from API
- **Expected Behavior**:
  - Pipeline completes successfully
  - All metrics show 0 processed
  - No errors thrown

#### Test 5.2: Missing Critical Fields
- **Setup**: Normal state
- **Input**: Opportunities missing required fields (ID, title)
- **Expected Behavior**:
  - Validation errors captured
  - Invalid opportunities skipped
  - Valid opportunities still processed
  - Error metrics incremented

#### Test 5.3: Duplicate Title, Different ID
- **Setup**: Existing opportunity with title "Grant A"
- **Input**: New opportunity with same title but different ID
- **Expected Path**: Treated as NEW (ID takes precedence)
- **Verification**: Both opportunities exist in database

#### Test 5.4: Same ID, Different Title
- **Setup**: Existing opportunity with ID "123"
- **Input**: Opportunity with same ID but different title
- **Expected Path**: UPDATE path (title change detected)
- **Verification**: Title updated in database

### 6. Mixed Batch Processing
**Purpose**: Verify correct routing when processing mixed opportunity types

#### Test 6.1: Mixed NEW, UPDATE, SKIP in Single Batch
- **Setup**: Database with some existing opportunities
- **Input**: Array containing:
  - 2 new opportunities
  - 2 opportunities with material changes
  - 2 exact duplicates
- **Expected Paths**:
  - NEW ones → Full pipeline
  - Changed ones → Direct Update
  - Duplicates → Skip
- **Verification**:
  - Each opportunity follows correct path
  - Aggregate metrics correct
  - Token usage only for NEW opportunities

### 7. Performance and Metrics

#### Test 7.1: Execution Time Tracking
- **Setup**: Standard test data
- **Input**: 10 opportunities
- **Verification**:
  - Each stage reports execution_time_ms
  - Total pipeline time = sum of stages
  - Metrics stored in run_v2_metrics table

#### Test 7.2: Token Usage and Cost Estimation
- **Setup**: Process NEW opportunities
- **Verification**:
  - Token usage tracked for Analysis stage
  - Cost estimation calculated correctly
  - Optimization metrics show tokens saved

#### Test 7.3: Database Query Optimization
- **Setup**: 100+ opportunities for batch processing
- **Verification**:
  - Single batch query for duplicate detection
  - Query time tracked in metrics
  - No N+1 query problems

### 8. Error Handling and Recovery

#### Test 8.1: Stage Failure Recovery
- **Setup**: Normal state
- **Failure Points**: Test failure at each stage:
  - Extraction failure
  - Duplicate detection failure
  - Analysis failure
  - Filter failure
  - Storage failure
- **Verification**:
  - Appropriate error logged
  - Run marked as failed with stage info
  - Partial data not committed
  - Resources cleaned up

#### Test 8.2: Database Connection Loss
- **Setup**: Interrupt database connection mid-process
- **Expected Behavior**:
  - Graceful error handling
  - Transaction rollback
  - Clear error message in logs

#### Test 8.3: API Rate Limiting
- **Setup**: Simulate API rate limit response
- **Expected Behavior**:
  - Retry with backoff
  - Eventually succeed or fail gracefully
  - Metrics show retry attempts

## Test Data Setup

### SQL Fixtures

```sql
-- Create test opportunity
INSERT INTO funding_opportunities (
  id, api_opportunity_id, title, close_date, maximum_award, 
  api_source_id, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'TEST-001', 'Test Grant', 
  '2024-12-31', 500000, '[source-id]', NOW(), NOW()
);

-- Enable FFR
UPDATE api_sources 
SET force_full_reprocessing = true 
WHERE id = '[source-id]';

-- Create material change
UPDATE funding_opportunities 
SET close_date = close_date + INTERVAL '7 days',
    maximum_award = maximum_award * 1.1
WHERE api_opportunity_id = 'TEST-001';

-- Verify metrics
SELECT * FROM run_v2_metrics 
WHERE run_id = '[run-id]' 
ORDER BY stage_order;
```

### Mock Data Generators

```javascript
// Generate test opportunities
export function generateOpportunity(overrides = {}) {
  return {
    id: `TEST-${Date.now()}`,
    title: 'Federal Research Grant',
    description: 'Funding for research projects',
    closeDate: '2024-12-31',
    openDate: '2024-01-01',
    minimumAward: 10000,
    maximumAward: 500000,
    status: 'posted',
    ...overrides
  };
}

// Generate batch with mixed scenarios
export function generateMixedBatch() {
  return [
    generateOpportunity({ id: 'NEW-1' }), // New
    generateOpportunity({ id: 'NEW-2' }), // New
    generateOpportunity({ 
      id: 'EXISTING-1',
      closeDate: '2025-01-15' // Material change
    }),
    generateOpportunity({ id: 'EXISTING-2' }), // No change
  ];
}
```

## Verification Queries

```sql
-- Check opportunity paths
SELECT 
  opportunity_id,
  path_type,
  stages_processed,
  final_outcome
FROM opportunity_paths
WHERE run_id = '[run-id]';

-- Verify duplicate detection
SELECT 
  new_opportunities,
  opportunities_to_update,
  opportunities_to_skip
FROM run_v2_stage_metrics
WHERE stage_name = 'early_duplicate_detector';

-- Check token optimization
SELECT 
  total_tokens_used,
  tokens_saved,
  optimization_percentage
FROM run_v2_summary
WHERE run_id = '[run-id]';
```

## Success Criteria

1. **Correctness**: Each opportunity follows the correct path based on its state
2. **Efficiency**: Duplicates don't consume tokens or processing time
3. **Metrics**: All metrics accurately captured and stored
4. **Error Handling**: Failures handled gracefully with proper rollback
5. **Performance**: Batch operations used, no N+1 queries
6. **FFR**: Force reprocessing works and auto-disables
7. **Atomicity**: Updates are atomic, no partial states

## Test Execution Order

1. **Phase 1 - Basic Paths**: Test each path in isolation (NEW, UPDATE, SKIP)
2. **Phase 2 - Edge Cases**: Test boundary conditions and error cases
3. **Phase 3 - Mixed Scenarios**: Test realistic mixed batches
4. **Phase 4 - Force Reprocessing**: Test FFR behavior
5. **Phase 5 - Performance**: Test with larger datasets
6. **Phase 6 - Error Recovery**: Test failure scenarios

## Automation Strategy

- Unit tests: Mock all external dependencies
- Integration tests: Use test database, mock APIs/LLMs
- E2E tests: Full pipeline with controlled test data
- CI/CD: Run on every commit
- Coverage target: >80% for critical paths