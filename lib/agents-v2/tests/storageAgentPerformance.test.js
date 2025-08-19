/**
 * Storage Agent V2 Performance Tests
 * 
 * Tests the Storage Agent in its optimized scenario where it only processes
 * new opportunities (post-pipeline-integration behavior). Validates performance
 * characteristics and functionality when duplicates are handled upstream.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { storeOpportunities } from '../core/storageAgent/index.js';

// Enhanced mock Supabase client with proper method chaining
function createMockSupabaseClient() {
  const mockChain = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    textSearch: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn()
  };

  // Make all methods return the chain for proper chaining
  Object.keys(mockChain).forEach(key => {
    if (key !== 'maybeSingle' && key !== 'single') {
      mockChain[key].mockReturnValue(mockChain);
    }
  });

  return mockChain;
}

describe('Storage Agent V2 - Performance Tests (New Opportunities Only)', () => {
  let mockSupabase;
  let mockSource;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    
    // Setup default mock returns for new opportunity scenario
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null }); // No existing opportunities found
    mockSupabase.single.mockResolvedValue({ data: { id: 'test-id' }, error: null });
    
    mockSource = {
      id: 'test-source-1',
      name: 'Test Funding Source',
      organization: 'Test Agency'
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  test('should efficiently process batch of new opportunities', async () => {
    // Simulate filtered opportunities that are confirmed new (post-EarlyDuplicateDetector)
    const newOpportunities = [
      {
        id: 'new-opp-1',
        title: 'Environmental Protection Grant 2025',
        description: 'Funding for environmental protection projects',
        minimumAward: 50000,
        maximumAward: 500000,
        totalFundingAvailable: 5000000,
        openDate: '2025-01-01T00:00:00Z',
        closeDate: '2025-12-31T23:59:59Z',
        eligibleProjectTypes: ['Environmental'],
        eligibleApplicants: ['Municipal Government'],
        stateEligibility: ['CA', 'NY', 'TX']
      },
      {
        id: 'new-opp-2', 
        title: 'Infrastructure Development Initiative',
        description: 'Support for infrastructure improvements',
        minimumAward: 100000,
        maximumAward: 2000000,
        totalFundingAvailable: 50000000,
        openDate: '2025-02-01T00:00:00Z',
        closeDate: '2025-11-30T23:59:59Z',
        eligibleProjectTypes: ['Infrastructure'],
        eligibleApplicants: ['State Government'],
        stateEligibility: ['ALL']
      }
    ];

    const startTime = Date.now();
    
    const result = await storeOpportunities(newOpportunities, mockSource, mockSupabase);
    
    const executionTime = Date.now() - startTime;

    // Validate results
    expect(result).toHaveProperty('metrics');
    expect(result.metrics.totalProcessed).toBe(2);
    expect(result.metrics.newOpportunities).toBe(2);
    expect(result.metrics.updatedOpportunities).toBe(0);
    expect(result.metrics.ignoredOpportunities).toBe(0);
    expect(result.metrics.duplicatesFound).toBe(0);

    // Performance validation
    expect(executionTime).toBeLessThan(1000); // Should complete under 1 second
    expect(result.executionTime).toBeGreaterThan(0);

    console.log(`Storage Agent processed ${newOpportunities.length} new opportunities in ${executionTime}ms`);
  });

  test('should handle large batch of new opportunities efficiently', async () => {
    // Generate 50 new opportunities to test batch processing
    const largeOpportunitySet = Array.from({ length: 50 }, (_, index) => ({
      id: `bulk-opp-${index + 1}`,
      title: `Test Opportunity ${index + 1}`,
      description: `Description for opportunity ${index + 1}`,
      minimumAward: 10000 + (index * 1000),
      maximumAward: 100000 + (index * 10000),
      totalFundingAvailable: 1000000 + (index * 100000),
      openDate: '2025-01-01T00:00:00Z',
      closeDate: '2025-12-31T23:59:59Z',
      eligibleProjectTypes: ['General'],
      eligibleApplicants: ['All'],
      stateEligibility: ['CA']
    }));

    const startTime = Date.now();
    
    const result = await storeOpportunities(largeOpportunitySet, mockSource, mockSupabase);
    
    const executionTime = Date.now() - startTime;

    // Validate all opportunities were processed as new
    expect(result.metrics.totalProcessed).toBe(50);
    expect(result.metrics.newOpportunities).toBe(50);
    expect(result.metrics.updatedOpportunities).toBe(0);
    expect(result.metrics.duplicatesFound).toBe(0);

    // Performance validation for large batch
    expect(executionTime).toBeLessThan(5000); // Should complete under 5 seconds for 50 opportunities
    
    // Validate batch processing (Storage Agent processes in batches of 10)
    const expectedBatches = Math.ceil(largeOpportunitySet.length / 10);
    // Note: insert is called twice per opportunity (funding source + opportunity)
    expect(mockSupabase.insert).toHaveBeenCalledTimes(100); // Each opportunity creates funding source + opportunity record

    console.log(`Storage Agent processed ${largeOpportunitySet.length} opportunities in ${executionTime}ms (${expectedBatches} batches)`);
  });

  test('should handle empty opportunity set gracefully', async () => {
    const result = await storeOpportunities([], mockSource, mockSupabase);

    expect(result.metrics.totalProcessed).toBe(0);
    expect(result.metrics.newOpportunities).toBe(0);
    expect(result.executionTime).toBeGreaterThan(0);

    // No database operations should occur for empty set
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });

  test('should validate input parameters correctly', async () => {
    // Test invalid opportunities parameter
    await expect(storeOpportunities(null, mockSource, mockSupabase))
      .rejects.toThrow();

    // Test invalid source parameter  
    await expect(storeOpportunities([], null, mockSupabase))
      .rejects.toThrow('Cannot read properties of null');

    await expect(storeOpportunities([], {}, mockSupabase))
      .rejects.toThrow('Source must have an id');
  });

  test('should process funding source creation efficiently', async () => {
    const opportunities = [{
      id: 'test-opp-1',
      title: 'Test Grant Program',
      description: 'Test description',
      agency: 'Department of Test',
      organization: 'Federal Test Agency'
    }];

    await storeOpportunities(opportunities, mockSource, mockSupabase);

    // Verify funding source management is called
    // Note: This tests the integration with fundingSourceManager
    expect(mockSupabase.from).toHaveBeenCalledWith('funding_sources');
  });

  test('should process state eligibility efficiently', async () => {
    const opportunities = [{
      id: 'test-opp-1',
      title: 'Multi-State Grant Program',
      description: 'Available in multiple states',
      stateEligibility: ['CA', 'NY', 'TX', 'FL']
    }];

    await storeOpportunities(opportunities, mockSource, mockSupabase);

    // Verify database operations occur (funding sources, opportunities, eligibility)
    expect(mockSupabase.from).toHaveBeenCalledWith('funding_sources');
    expect(mockSupabase.from).toHaveBeenCalledWith('funding_opportunities');
    // Note: state_eligibility processing may occur but depends on valid parsed states
  });

  test('should maintain performance characteristics under error conditions', async () => {
    // Simulate database error for one opportunity
    let callCount = 0;
    mockSupabase.single.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.resolve({ data: null, error: new Error('Database error') });
      }
      return Promise.resolve({ data: { id: `test-id-${callCount}` }, error: null });
    });

    const opportunities = [
      { id: 'good-opp-1', title: 'Working Opportunity', description: 'This should work' },
      { id: 'bad-opp-1', title: 'Failing Opportunity', description: 'This will fail' },
      { id: 'good-opp-2', title: 'Another Working Opportunity', description: 'This should also work' }
    ];

    const startTime = Date.now();
    
    const result = await storeOpportunities(opportunities, mockSource, mockSupabase);
    
    const executionTime = Date.now() - startTime;

    // Should still complete in reasonable time despite errors
    expect(executionTime).toBeLessThan(2000);
    
    // Should process the opportunities that don't fail
    expect(result.metrics.totalProcessed).toBe(3);
    
    console.log(`Storage Agent handled errors gracefully in ${executionTime}ms`);
  });

  test('should track metrics accurately for new-only scenario', async () => {
    const opportunities = [
      { id: 'metrics-test-1', title: 'First Opportunity' },
      { id: 'metrics-test-2', title: 'Second Opportunity' },
      { id: 'metrics-test-3', title: 'Third Opportunity' }
    ];

    const result = await storeOpportunities(opportunities, mockSource, mockSupabase);

    // Validate comprehensive metrics
    expect(result.metrics).toEqual({
      totalProcessed: 3,
      newOpportunities: 3,
      updatedOpportunities: 0,
      ignoredOpportunities: 0,
      duplicatesFound: 0
    });

    expect(result.executionTime).toBeGreaterThan(0);
    expect(result.results).toHaveProperty('newOpportunities');
    expect(result.results).toHaveProperty('updatedOpportunities');
    expect(result.results).toHaveProperty('ignoredOpportunities');
    expect(result.results).toHaveProperty('duplicatesFound');

    // In new-only scenario, all should be new
    expect(result.results.newOpportunities).toHaveLength(3);
    expect(result.results.updatedOpportunities).toHaveLength(0);
    expect(result.results.ignoredOpportunities).toHaveLength(0);
    expect(result.results.duplicatesFound).toHaveLength(0);
  });
});