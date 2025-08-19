# V2 Pipeline Testing Strategy Document

## Executive Summary

This document outlines a comprehensive testing strategy for the Meridian ESG V2 pipeline system. The current testing infrastructure uses a fragmented approach with Vitest for unit tests and custom Node.js scripts for integration tests, leading to incomplete coverage and low confidence in test results. This strategy proposes a unified testing framework using Jest for all non-E2E tests and Playwright for end-to-end scenarios, ensuring complete coverage of all opportunity lifecycle permutations.

## Current State Analysis

### Problems with Existing Approach

1. **Fragmented Testing Stack**
   - Vitest configured for Node environment only (no React component testing)
   - Custom Node.js scripts for integration tests (not using a test framework)
   - No API route testing
   - No E2E testing
   - Tests scattered across multiple directories without clear organization

2. **Coverage Gaps**
   - React components untested
   - API routes untested
   - Database transactions not properly isolated
   - No simulation of real user workflows
   - Missing edge cases in opportunity lifecycle

3. **Low Confidence**
   - Tests may not be running correctly
   - No consistent mocking strategy
   - Integration tests don't use proper test database isolation
   - Uncertain if tests reflect production behavior

## Proposed Testing Architecture

### Technology Stack

1. **Jest** - Primary testing framework
   - Unit tests for all business logic
   - Integration tests for multi-component interactions
   - Component tests for React UI
   - API route tests

2. **Playwright** - End-to-end testing
   - Complete user workflow testing
   - Real browser interaction
   - Full pipeline execution testing
   - Performance benchmarking

3. **Supporting Tools**
   - React Testing Library for component testing
   - MSW (Mock Service Worker) for API mocking
   - Supabase CLI for local database testing

### Directory Structure

```
__tests__/                          # All Jest tests
├── unit/                           
│   ├── components/                 # React component tests
│   │   ├── Dashboard.test.js
│   │   ├── FundingSourcesPage.test.js
│   │   └── RunDetails.test.js
│   ├── api/                        # API route tests  
│   │   ├── funding/
│   │   │   ├── sources/
│   │   │   │   ├── [id].test.js
│   │   │   │   └── process.test.js
│   │   └── admin/
│   │       └── system-config/
│   │           └── [key].test.js
│   ├── agents/                     # Individual agent tests
│   │   ├── sourceOrchestrator.test.js
│   │   ├── dataExtractionAgent.test.js
│   │   ├── earlyDuplicateDetector.test.js
│   │   ├── analysisAgent.test.js
│   │   ├── filterFunction.test.js
│   │   ├── storageAgent.test.js
│   │   └── directUpdateHandler.test.js
│   └── services/                   # Service layer tests
│       ├── processCoordinatorV2.test.js
│       └── runManagerV2.test.js
│
├── integration/                    # Multi-component interaction tests
│   ├── pipeline/
│   │   ├── newOpportunityFlow.test.js
│   │   ├── duplicateDetection.test.js
│   │   ├── materialChanges.test.js
│   │   ├── forceReprocessing.test.js
│   │   └── mixedBatch.test.js
│   ├── database/
│   │   ├── queries.test.js
│   │   ├── transactions.test.js
│   │   └── migrations.test.js
│   └── metrics/
│       ├── stageMetrics.test.js
│       └── performanceTracking.test.js
│
├── fixtures/                       # Shared test data
│   ├── opportunities.js            # Opportunity data generators
│   ├── sources.js                  # Source configurations
│   ├── runs.js                     # Run data fixtures
│   └── metrics.js                  # Metric fixtures
│
├── mocks/                          # Service mocks
│   ├── anthropic.js                # LLM service mock
│   ├── grantsGov.js                # API service mock
│   ├── supabase.js                 # Database mock
│   └── handlers.js                 # MSW request handlers
│
└── setup/                          # Test configuration
    ├── jest.setup.js               # Global Jest setup
    ├── testDatabase.js             # Database setup/teardown
    └── testEnvironment.js          # Environment configuration

e2e/                                # Playwright E2E tests
├── scenarios/                      # Complete user workflows
│   ├── processNewOpportunities.spec.js
│   ├── handleDuplicates.spec.js
│   ├── forceFullReprocessing.spec.js
│   └── adminDashboard.spec.js
├── performance/                    # Performance tests
│   ├── largeBatchProcessing.spec.js
│   └── concurrentRuns.spec.js
├── fixtures/                       
│   ├── auth.js                     # Authentication setup
│   └── database.js                 # Database state management
└── playwright.config.js
```

### Improvements Over Current Structure

1. **Clear Separation of Concerns**
   - Unit tests isolated from integration tests
   - Component tests separate from business logic tests
   - E2E tests in dedicated directory

2. **Consistent Organization**
   - Mirror source code structure
   - Shared fixtures and mocks
   - Centralized setup and configuration

3. **Complete Coverage**
   - All layers tested (UI, API, Business Logic, Database)
   - All components have corresponding tests
   - All pipeline stages validated

## Opportunity Lifecycle Coverage

### Complete Permutation Matrix

The opportunity lifecycle includes all possible states and transitions an opportunity can experience from initial discovery to final storage or skip.

#### 1. Initial Discovery States
- **NEW**: Opportunity never seen before
- **EXISTING_UNCHANGED**: Exact duplicate with no changes
- **EXISTING_CHANGED**: Duplicate with material changes
- **EXISTING_MINOR_CHANGE**: Duplicate with non-material changes

#### 2. Processing Paths

```
Data Extraction
    ↓
Early Duplicate Detection → Categorization:
    │
    ├─ NEW → Analysis → Filter → Storage
    │         - Token consumption
    │         - Enhancement generation
    │         - Eligibility scoring
    │         - Database insertion
    │
    ├─ UPDATE → Direct Update Handler
    │         - No token consumption
    │         - Field-level updates only
    │         - Preserve unchanged data
    │         - Update timestamp
    │
    └─ SKIP → End
              - No processing
              - No database changes
              - Metrics only
```

#### 3. Decision Points and Criteria

**Duplicate Detection Criteria:**
- Primary: API Opportunity ID match
- Secondary: Title similarity (>90% match)
- Validation: Both ID and title must align

**Material Change Thresholds:**
- Amount changes: >5% difference
- Date changes: Any change to open/close dates
- Status changes: Any status transition
- Description changes: Significant content changes (>20% difference)

**Filter Criteria:**
- Eligibility score threshold
- Geographic restrictions
- Category matching
- Funding amount ranges

#### 4. Special Cases

**Force Full Reprocessing (FFR):**
- Bypasses duplicate detection entirely
- All opportunities treated as NEW
- Triggered by source-level or global flag
- Auto-disables after run completion
- Rollback on failure

**Error Recovery Scenarios:**
- Partial batch failures
- API timeout recovery
- LLM service failures
- Database transaction rollbacks

## Test Simulation Strategy

### How Each Test Type Simulates Production

#### 1. Unit Tests

**Simulation Approach:**
- Pure function testing with controlled inputs
- Deterministic outputs for validation
- Edge case coverage

**Why It Mirrors Reality:**
- Business logic operates identically regardless of I/O
- Algorithms tested with real-world data patterns
- Edge cases derived from production logs

**Example Coverage:**
- Duplicate detection algorithm with various similarity scores
- Change detection with threshold boundaries (4.9%, 5%, 5.1%)
- Filter logic with complex eligibility criteria

#### 2. Integration Tests

**Simulation Approach:**
- Real database operations using test containers
- Mocked external services with realistic responses
- Transaction isolation for test independence

**Why It Mirrors Reality:**
- Actual SQL queries executed against real PostgreSQL
- Database constraints and triggers active
- Realistic data volumes and relationships
- Same Supabase client library as production

**Database Simulation:**
- Use Supabase local development environment
- Migrations applied to test database
- Seed data matches production patterns
- Transaction rollback ensures clean state

**External Service Mocking:**
- Anthropic mock returns consistent enhanced data
- Grants.gov mock provides various response scenarios
- Response times simulate network latency
- Error scenarios match real API failures

#### 3. Component Tests

**Simulation Approach:**
- Render components with various prop combinations
- User interaction simulation via Testing Library
- State management testing

**Why It Mirrors Reality:**
- Same React rendering engine
- Event handlers triggered as in browser
- Async state updates handled correctly
- API calls intercepted at network layer

#### 4. E2E Tests

**Simulation Approach:**
- Real browser automation
- Complete user workflows
- Actual API calls to test environment
- Real database state changes

**Why It Mirrors Reality:**
- Actual browser rendering and JavaScript execution
- Network requests follow same path as production
- Database operations identical to production
- Performance characteristics measurable

## Pipeline Stage Testing Requirements

### Stage 1: Source Orchestrator
**Test Coverage:**
- Configuration validation
- API endpoint construction
- Error handling for invalid sources
- Rate limiting behavior

**Simulation:** Mock API responses with various configurations

### Stage 2: Data Extraction Agent
**Test Coverage:**
- API response parsing
- Data normalization
- Pagination handling
- Partial failure recovery

**Simulation:** Mock API with paginated responses, errors, and edge cases

### Stage 3: Early Duplicate Detector
**Test Coverage:**
- ID-based matching
- Title similarity scoring
- Batch query optimization
- Change detection accuracy

**Simulation:** Seed database with known duplicates, test boundary conditions

### Stage 4A: Analysis Agent (NEW path only)
**Test Coverage:**
- LLM prompt construction
- Response parsing
- Token usage tracking
- Enhancement quality

**Simulation:** Mock LLM with deterministic responses based on input patterns

### Stage 4B: Direct Update Handler (UPDATE path)
**Test Coverage:**
- Field-level update logic
- Unchanged field preservation
- Atomic update operations
- Rollback on failure

**Simulation:** Database with existing records, verify selective updates

### Stage 5: Filter Function (NEW path only)
**Test Coverage:**
- Eligibility scoring
- Multi-criteria filtering
- Pass/fail rate calculation
- Edge case handling

**Simulation:** Opportunities with various eligibility profiles

### Stage 6: Storage Agent (NEW path only)
**Test Coverage:**
- Batch insertion optimization
- Duplicate key handling
- Transaction management
- Metrics collection

**Simulation:** Database constraints active, test concurrent insertions

## Metrics Validation

### What to Measure
1. **Execution Time** - Per stage and total pipeline
2. **Token Usage** - Only for NEW opportunities
3. **API Calls** - External service invocations
4. **Success Rates** - Pass/fail ratios per stage
5. **Optimization Impact** - Tokens saved via duplicate detection

### How to Validate
- Compare metrics against baseline expectations
- Verify metric aggregation accuracy
- Ensure metrics persist to database
- Validate dashboard calculations

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
1. Remove Vitest and related dependencies
2. Install Jest, React Testing Library, and Playwright
3. Configure Jest for Next.js
4. Setup test database strategy
5. Create base fixtures and mocks

### Phase 2: Core Pipeline Tests (Week 2)
1. Migrate existing agent tests to Jest
2. Add comprehensive integration tests for each pipeline path
3. Validate all permutations of opportunity lifecycle
4. Test Force Full Reprocessing scenarios

### Phase 3: Component and API Tests (Week 3)
1. Add React component tests
2. Test API routes with MSW
3. Validate admin interfaces
4. Test user interactions

### Phase 4: E2E and Performance (Week 4)
1. Implement Playwright E2E scenarios
2. Add performance benchmarks
3. Test concurrent processing
4. Validate error recovery

### Phase 5: CI/CD Integration (Week 5)
1. Configure GitHub Actions for test automation
2. Setup coverage reporting
3. Implement test result notifications
4. Create performance regression detection

## Success Criteria

1. **Coverage Targets**
   - Overall: >80% code coverage
   - Critical paths: >95% coverage
   - All pipeline permutations: 100% scenario coverage

2. **Performance Benchmarks**
   - Unit tests: <10ms per test
   - Integration tests: <100ms per test
   - E2E tests: <30s per scenario
   - Full test suite: <5 minutes

3. **Quality Metrics**
   - Zero flaky tests
   - All tests passing consistently
   - Clear failure messages
   - Fast feedback loop

## Risk Mitigation

1. **Migration Risks**
   - Run old and new tests in parallel initially
   - Gradual migration by component
   - Maintain test coverage throughout

2. **Test Data Management**
   - Use transactions for isolation
   - Automated cleanup procedures
   - Consistent seed data

3. **External Dependencies**
   - Comprehensive mocking strategy
   - Offline test capability
   - Service virtualization for APIs

## Maintenance Strategy

1. **Test Organization**
   - Tests co-located with source code conceptually
   - Shared fixtures updated centrally
   - Regular test refactoring sessions

2. **Documentation**
   - Test naming conventions
   - Fixture usage guidelines
   - Mock configuration documentation

3. **Continuous Improvement**
   - Regular test review sessions
   - Performance optimization
   - Coverage gap analysis
   - Production issue post-mortems inform new tests

## Conclusion

This unified testing strategy addresses all current gaps in test coverage while providing a maintainable, scalable foundation for ensuring the V2 pipeline operates correctly across all permutations of the opportunity lifecycle. By moving to Jest for all non-E2E tests and Playwright for true end-to-end scenarios, we achieve consistency, comprehensive coverage, and confidence that our tests accurately reflect production behavior.