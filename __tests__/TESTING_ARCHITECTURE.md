# Testing Architecture Guide

## Overview

We use a **three-tier hybrid testing strategy** that balances speed, coverage, and accuracy:

```
┌─────────────────────────────────────────────────────────────┐
│                      UNIT TESTS                             │
│  Fast • Isolated • Pure Mocks • Business Logic             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   INTEGRATION TESTS                         │
│  Fast • Smart Mocks • Component Interactions • Workflows    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   CRITICAL PATH TESTS                       │
│  Slower • Real Database • PostgreSQL-Specific • Edge Cases  │
└─────────────────────────────────────────────────────────────┘
```

## Test Types Explained

### 1. Unit Tests (`__tests__/unit/`)

**Purpose**: Test individual functions and components in complete isolation

**Characteristics**:
- No external dependencies (all mocked)
- Millisecond execution time
- Test pure business logic
- 100% deterministic

**Database**: None - everything mocked

**Example Use Cases**:
- Algorithm correctness (scoring calculations)
- Data transformation functions
- React component rendering
- Utility functions

**Example Test**:
```javascript
test('calculateOpportunityScore returns correct score', () => {
  const opportunity = { fundingAmount: 100000, match: 0.8 }
  const score = calculateOpportunityScore(opportunity)
  expect(score).toBe(8.5)
})
```

### 2. Integration Tests (`__tests__/integration/`)

**Purpose**: Test multiple components working together with realistic constraints

**Characteristics**:
- Smart mocks that simulate real behavior
- Fast execution (no network/disk I/O)
- Test component interactions
- Verify workflow correctness

**Database**: Smart mock with constraint simulation
- Enforces unique constraints in memory
- Simulates foreign key relationships
- Returns realistic error codes
- Maintains state between operations

**Example Use Cases**:
- Complete pipeline flows
- API endpoint testing with MSW
- Multi-stage processing workflows
- Error handling across components

**Example Test**:
```javascript
test('pipeline processes NEW opportunities through all stages', async () => {
  const opportunity = generateNewOpportunity()
  
  // Smart mock enforces constraints but doesn't hit real DB
  const result = await processPipeline(opportunity, mockSupabase)
  
  expect(result.stages).toEqual([
    'extracted',
    'duplicate-checked', 
    'analyzed',
    'filtered',
    'stored'
  ])
})
```

### 3. Critical Path Tests (`__tests__/critical/`)

**Purpose**: Verify database-specific behavior that only PostgreSQL can validate

**Characteristics**:
- Uses real PostgreSQL (Supabase local)
- Slower execution (real DB operations)
- Tests database-specific features
- Catches PostgreSQL quirks

**Database**: Real PostgreSQL test database
- Actual constraint enforcement
- Real transaction behavior
- True concurrent operation handling
- PostgreSQL-specific error codes

**Example Use Cases**:
- Composite unique constraint violations
- Transaction rollback atomicity
- Advisory lock behavior
- Concurrent operation deadlocks
- CASCADE delete behavior
- Trigger execution

**Example Test**:
```javascript
test('PostgreSQL rolls back entire batch on constraint violation', async () => {
  // This MUST use real DB to verify PostgreSQL's transactional behavior
  const batch = [validOpp1, duplicateOpp, validOpp2]
  
  const result = await supabase
    .from('funding_opportunities')
    .insert(batch)
  
  // PostgreSQL-specific: entire batch fails atomically
  expect(result.error.code).toBe('23505') // PG unique violation
  
  // Verify NONE were inserted (true atomicity)
  const count = await supabase
    .from('funding_opportunities')
    .select('count')
  expect(count).toBe(0) // All rolled back
})
```

## Decision Flowchart

```
Start: "What am I testing?"
           │
           ├─> "Pure business logic?" ──────> UNIT TEST
           │
           ├─> "Component interactions?" ───> INTEGRATION TEST
           │
           └─> "Database-specific behavior?"
                      │
                      ├─> "Can smart mock simulate it?"
                      │         │
                      │         ├─> Yes ──> INTEGRATION TEST
                      │         │
                      │         └─> No ───> CRITICAL PATH TEST
                      │
                      └─> Examples of "No":
                          • Exact PostgreSQL error codes
                          • Transaction atomicity
                          • Advisory locks
                          • Trigger execution
                          • CASCADE operations
                          • Concurrent conflicts
```

## What Goes Where

### Unit Tests Should Include:
- ✅ Scoring algorithms
- ✅ Data transformation functions
- ✅ React component rendering
- ✅ Utility functions
- ✅ Individual agent logic
- ✅ Pure calculations

### Integration Tests Should Include:
- ✅ Complete pipeline flows
- ✅ API endpoint workflows
- ✅ Multi-agent coordination
- ✅ Duplicate detection logic
- ✅ Material change detection
- ✅ MSW-mocked external APIs

### Critical Path Tests Should Include:
- ✅ Unique constraint violations
- ✅ Foreign key enforcement
- ✅ Transaction rollback verification
- ✅ Advisory lock testing
- ✅ Concurrent operation conflicts
- ✅ PostgreSQL-specific features

## Running Tests

### Development Workflow
```bash
# Daily development (fast, no DB needed)
npm test                    # Runs unit + integration

# Before committing
npm run test:all           # Includes critical tests

# Specific suites
npm run test:unit          # Just unit tests
npm run test:integration   # Just integration tests
npm run test:critical      # Just critical tests (needs Supabase)
```

### CI/CD Workflow
```bash
# Required tests (must pass)
npm run test:ci:unit
npm run test:ci:integration

# Optional tests (can fail without blocking)
npm run test:ci:critical
```

## Key Principles

1. **Speed First**: 95% of tests should be fast (unit + integration)
2. **Mock Smart**: Integration mocks should catch real issues
3. **Test Critical Paths**: Use real DB only when necessary
4. **Fail Gracefully**: Critical tests skip if DB unavailable
5. **Clear Naming**: Test names should indicate their type

## Common Mistakes to Avoid

❌ **Don't test PostgreSQL in integration tests**
- Wrong: Testing exact error codes with mocks
- Right: Test business logic reaction to errors

❌ **Don't use real DB for simple logic**
- Wrong: Using real DB to test scoring algorithm
- Right: Use unit test with pure functions

❌ **Don't mock incorrectly in integration tests**
- Wrong: Mock that allows impossible states
- Right: Smart mock that enforces constraints

❌ **Don't skip critical tests for DB features**
- Wrong: Assuming transaction rollback works
- Right: Verify with real PostgreSQL

## Test File Naming Convention

- `*.test.js` - Standard unit tests
- `*.integration.test.js` - Integration tests with mocks
- `*.critical.test.js` - Critical path tests with real DB
- `*.mock.test.js` - Tests specifically for mock behavior

## Performance Targets

| Test Type | Single Test | Full Suite | Count |
|-----------|------------|------------|-------|
| Unit | <10ms | <5s | 200+ |
| Integration | <100ms | <10s | 50+ |
| Critical | <1s | <30s | 10-15 |

## When to Add Critical Tests

Add a critical test when:
1. You're relying on PostgreSQL-specific behavior
2. The mock can't accurately simulate the scenario
3. Production bugs traced to DB behavior differences
4. Testing concurrent operations or locks
5. Verifying transaction boundaries

## Maintenance

- Review critical tests quarterly (keep minimal)
- Update smart mocks when DB schema changes
- Document why each critical test needs real DB
- Consider moving critical tests to integration if mock improves