import { describe, test, expect, beforeEach, vi } from 'vitest';
import { storeOpportunities } from '../core/storageAgent/index.js';

/**
 * Test suite for StorageAgent V2
 * 
 * Tests enhanced storage functionality with deduplication and state eligibility
 */

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

describe('StorageAgent V2', () => {
  let mockSupabase;
  let mockOpportunities;
  let mockSource;

  beforeEach(() => {
    // Create fresh mock for each test
    mockSupabase = createMockSupabaseClient();
    
    // Setup default mock returns
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.single.mockResolvedValue({ data: { id: 'test-id' }, error: null });
    
    // Mock data
    mockOpportunities = [
      {
        id: 'grant-1',
        title: 'Energy Efficiency Grant',
        description: 'HVAC system funding',
        status: 'open',
        openDate: '2024-01-01',
        closeDate: '2024-12-31',
        minimumAward: 25000,
        maximumAward: 500000,
        totalFundingAvailable: 5000000,
        eligibleApplicants: ['School Districts', 'Municipal Government'],
        eligibleProjectTypes: ['HVAC', 'Energy Efficiency'],
        eligibleLocations: ['CA', 'OR', 'WA'],
        fundingType: 'grant',
        isNational: false,
        agencyName: 'State Energy Office',
        scoring: {
          overallScore: 8,
          projectTypeMatch: 3,
          clientTypeMatch: 3
        },
        enhancedDescription: 'Enhanced description for grant',
        actionableSummary: 'Apply by December 31st',
        filterResult: {
          passed: true,
          reason: 'passed_with_score_8'
        }
      }
    ];

    mockSource = {
      id: 'source-123',
      name: 'Test Energy API',
      type: 'government',
      website: 'https://energy.state.gov'
    };
  });

  test('should store opportunities successfully', async () => {
    // Mock funding source not found, then opportunity not found
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // funding source lookup
      .mockResolvedValueOnce({ data: null, error: null }); // opportunity lookup

    // Mock successful funding source creation, then opportunity creation
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'funding-source-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'opportunity-1', title: 'Energy Efficiency Grant' }, error: null });

    const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabase);

    expect(result).toMatchObject({
      results: {
        newOpportunities: expect.arrayContaining([
          expect.objectContaining({ id: 'opportunity-1' })
        ]),
        updatedOpportunities: [],
        ignoredOpportunities: [],
        duplicatesFound: []
      },
      metrics: {
        totalProcessed: 1,
        newOpportunities: 1,
        updatedOpportunities: 0,
        ignoredOpportunities: 0,
        duplicatesFound: 0
      },
      executionTime: expect.any(Number)
    });

    // Verify funding source creation was attempted
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'State Energy Office',
        type: 'government'
      })
    );

    // Verify opportunity insertion was attempted
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Energy Efficiency Grant',
        opportunity_id: 'grant-1',
        api_source_id: 'source-123'
      })
    );
  });

  test('should handle empty opportunities array', async () => {
    const result = await storeOpportunities([], mockSource, mockSupabase);

    expect(result).toEqual({
      metrics: {
        totalProcessed: 0,
        newOpportunities: 0,
        updatedOpportunities: 0,
        ignoredOpportunities: 0,
        duplicatesFound: 0
      },
      executionTime: expect.any(Number)
    });

    // Should not make any database calls
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });

  test('should detect and update existing opportunities', async () => {
    const existingOpportunity = {
      id: 'existing-opp-1',
      opportunity_id: 'grant-1',
      title: 'Energy Efficiency Grant',
      minimum_award: 20000, // Different amount - should trigger update
      maximum_award: 400000,
      status: 'open'
    };

    // Mock funding source not found, then existing opportunity found
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: existingOpportunity, error: null });

    // Mock funding source creation, then opportunity update
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'funding-source-1' }, error: null })
      .mockResolvedValueOnce({ data: { ...existingOpportunity, minimum_award: 25000 }, error: null });

    const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabase);

    expect(result.metrics).toMatchObject({
      totalProcessed: 1,
      newOpportunities: 0,
      updatedOpportunities: 1,
      ignoredOpportunities: 0,
      duplicatesFound: 1
    });

    // Verify update was called
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        minimum_award: 25000
      })
    );
  });

  test('should update opportunities with undefined to actual value changes', async () => {
    // This test shows the realistic scenario where incoming data has values 
    // but existing database record has undefined fields (sparse data)
    const incomingOpportunity = {
      id: 'grant-1',
      title: 'Energy Efficiency Grant',
      description: 'HVAC system funding',
      status: 'open',
      openDate: '2024-01-01',
      closeDate: '2024-12-31',
      minimumAward: 25000,
      maximumAward: 500000,
      totalFundingAvailable: 5000000,
      eligibleApplicants: ['School Districts', 'Municipal Government'],
      eligibleProjectTypes: ['HVAC', 'Energy Efficiency'],
      eligibleLocations: ['CA', 'OR', 'WA'],
      fundingType: 'grant',
      isNational: false,
      agencyName: 'State Energy Office'
    };

    // Create existing opportunity with some undefined fields (realistic scenario)
    const existingOpportunity = {
      id: 'existing-opp-1',
      opportunity_id: 'grant-1',
      title: 'Energy Efficiency Grant',
      description: 'HVAC system funding',
      status: 'open',
      open_date: undefined, // undefined → actual value = material change
      close_date: undefined,
      minimum_award: undefined,
      maximum_award: undefined,
      total_funding_available: undefined,
      eligible_applicants: ['School Districts', 'Municipal Government'],
      eligible_project_types: ['HVAC', 'Energy Efficiency'],
      eligible_locations: ['CA', 'OR', 'WA'],
      funding_type: 'grant',
      is_national: false,
      agency_name: 'State Energy Office'
    };

    // Mock funding source found, then existing opportunity found
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'existing-funding-1', name: 'State Energy Office' }, error: null })
      .mockResolvedValueOnce({ data: existingOpportunity, error: null });

    // Mock opportunity update
    mockSupabase.single
      .mockResolvedValueOnce({ data: { ...existingOpportunity }, error: null });

    const result = await storeOpportunities([incomingOpportunity], mockSource, mockSupabase);

    // Correctly detects material changes and updates
    expect(result.metrics).toMatchObject({
      totalProcessed: 1,
      newOpportunities: 0,
      updatedOpportunities: 1,
      ignoredOpportunities: 0,
      duplicatesFound: 1
    });

    // Verify update WAS called (this is correct behavior)
    expect(mockSupabase.update).toHaveBeenCalled();
  });

  test('should reuse existing funding sources', async () => {
    const existingFundingSource = { id: 'existing-funding-1', name: 'State Energy Office' };

    // Mock existing funding source found, then opportunity not found
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: existingFundingSource, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    // Mock opportunity creation only (no funding source creation)
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'opportunity-1', title: 'Energy Efficiency Grant' }, error: null });

    await storeOpportunities(mockOpportunities, mockSource, mockSupabase);

    // Should insert opportunity with existing funding source ID
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        funding_source_id: 'existing-funding-1'
      })
    );
  });

  test('should handle opportunities without funding source info', async () => {
    const opportunityWithoutAgency = {
      ...mockOpportunities[0],
      agencyName: undefined,
      fundingAgency: undefined
    };

    // Mock opportunity not found
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    
    // Mock opportunity creation - when no agency name, creates funding source from API source
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'api-source-funding' }, error: null }) // funding source from API source
      .mockResolvedValueOnce({ data: { id: 'opportunity-1' }, error: null }); // opportunity creation

    await storeOpportunities([opportunityWithoutAgency], mockSource, mockSupabase);

    // Should insert funding source using API source info
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Energy API',
        type: 'government'
      })
    );

    // Should insert opportunity with the created funding source ID
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        funding_source_id: 'api-source-funding'
      })
    );
  });

  test('should validate input parameters', async () => {
    await expect(storeOpportunities('not an array', mockSource, mockSupabase))
      .rejects.toThrow('Opportunities must be an array');

    await expect(storeOpportunities(mockOpportunities, null, mockSupabase))
      .rejects.toThrow('Cannot read properties of null');

    await expect(storeOpportunities(mockOpportunities, {}, mockSupabase))
      .rejects.toThrow('Source must have an id');
  });

  test('should process opportunities in batches', async () => {
    // Create 15 opportunities to test batching (batch size is 10)
    const manyOpportunities = Array.from({ length: 15 }, (_, i) => ({
      ...mockOpportunities[0],
      id: `grant-${i + 1}`,
      title: `Grant ${i + 1}`
    }));

    // Mock all as new opportunities
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.single.mockResolvedValue({ data: { id: 'test-id' }, error: null });

    const result = await storeOpportunities(manyOpportunities, mockSource, mockSupabase);

    expect(result.metrics.totalProcessed).toBe(15);
    expect(result.metrics.newOpportunities).toBe(15);
  });

  test('should sanitize opportunity data correctly', async () => {
    // Mock no existing data
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.single.mockResolvedValue({ data: { id: 'test-id' }, error: null });

    await storeOpportunities(mockOpportunities, mockSource, mockSupabase);

    // Check that camelCase fields were converted to snake_case
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        opportunity_id: 'grant-1',
        minimum_award: 25000,
        maximum_award: 500000,
        total_funding_available: 5000000,
        open_date: '2024-01-01T00:00:00.000Z',
        close_date: '2024-12-31T00:00:00.000Z',
        eligible_applicants: ['School Districts', 'Municipal Government'],
        eligible_project_types: ['HVAC', 'Energy Efficiency'],
        eligible_locations: ['CA', 'OR', 'WA'],
        funding_type: 'grant',
        is_national: false
      })
    );
  });

  test('should handle database errors gracefully', async () => {
    // Mock funding source lookup error
    mockSupabase.maybeSingle.mockRejectedValue(new Error('Database connection failed'));

    // Should continue processing despite individual errors
    const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabase);

    // Function should not throw, but handle errors gracefully
    expect(result).toMatchObject({
      metrics: {
        totalProcessed: 1,
        newOpportunities: 0,
        updatedOpportunities: 0,
        ignoredOpportunities: 0,
        duplicatesFound: 0
      }
    });
  });

  test('should handle state eligibility processing', async () => {
    // Mock successful opportunity creation
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'funding-source-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'opportunity-1' }, error: null });

    await storeOpportunities(mockOpportunities, mockSource, mockSupabase);

    // Should have attempted to insert funding source and opportunity
    // Note: State eligibility inserts happen but aren't tracked in the main insert spy
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'State Energy Office'
      })
    );

    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        funding_source_id: 'funding-source-1'
      })
    );
  });

  test('should skip state eligibility for national opportunities', async () => {
    const nationalOpportunity = {
      ...mockOpportunities[0],
      isNational: true,
      eligibleLocations: null
    };

    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.single.mockResolvedValue({ data: { id: 'test-id' }, error: null });

    await storeOpportunities([nationalOpportunity], mockSource, mockSupabase);

    // Function should complete successfully for national opportunities
    expect(mockSupabase.insert).toHaveBeenCalled();
  });

  test('should detect material changes in amount fields', async () => {
    const existingOpportunity = {
      id: 'existing-opp-1',
      opportunity_id: 'grant-1',
      minimum_award: 25000,
      maximum_award: 500000,
      total_funding_available: 5000000,
      open_date: '2024-01-01T00:00:00.000Z',
      close_date: '2024-12-31T00:00:00.000Z',
      status: 'open',
      description: 'HVAC system funding'
    };

    // Create opportunity with 10% change in funding (should trigger update)
    const updatedOpportunity = {
      ...mockOpportunities[0],
      totalFundingAvailable: 5500000 // 10% increase
    };

    // Mock funding source not found, then existing opportunity found
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: existingOpportunity, error: null });

    // Mock funding source creation, then opportunity update
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'funding-source-1' }, error: null })
      .mockResolvedValueOnce({ data: { ...existingOpportunity }, error: null });

    const result = await storeOpportunities([updatedOpportunity], mockSource, mockSupabase);

    expect(result.metrics.updatedOpportunities).toBe(1);
    expect(mockSupabase.update).toHaveBeenCalled();
  });


}); 