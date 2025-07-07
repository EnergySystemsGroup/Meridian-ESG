/**
 * Unit Tests for EarlyDuplicateDetector V2
 * 
 * Tests cover:
 * - Batch fetching optimization
 * - ID + Title validation approach
 * - 4-scenario freshness check decision matrix
 * - Critical field change detection
 * - Edge cases and error handling
 * - Performance characteristics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules with factory functions
vi.mock('../core/storageAgent/duplicateDetector.js', () => ({
  duplicateDetector: {
    titlesAreSimilar: vi.fn()
  }
}));

vi.mock('../core/storageAgent/changeDetector.js', () => ({
  changeDetector: {
    hasFieldChanged: vi.fn()
  }
}));

// Import after mocking
const { earlyDuplicateDetector } = await import('../core/storageAgent/earlyDuplicateDetector.js');
const { duplicateDetector } = await import('../core/storageAgent/duplicateDetector.js');
const { changeDetector } = await import('../core/storageAgent/changeDetector.js');

// Mock Supabase client
const createMockSupabase = () => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(() => ({
          data: [],
          error: null
        }))
      }))
    }))
  }))
});

describe('EarlyDuplicateDetector', () => {
  let mockSupabase;
  
  beforeEach(() => {
    mockSupabase = createMockSupabase();
    vi.clearAllMocks();
  });

  describe('detectDuplicates', () => {
    it('should handle empty opportunities array', async () => {
      const result = await earlyDuplicateDetector.detectDuplicates([], 'source-1', mockSupabase);
      
      expect(result.newOpportunities).toEqual([]);
      expect(result.opportunitiesToUpdate).toEqual([]);
      expect(result.opportunitiesToSkip).toEqual([]);
      expect(result.metrics.totalProcessed).toBe(0);
    });

    it('should validate input parameters', async () => {
      await expect(
        earlyDuplicateDetector.detectDuplicates(null, 'source-1', mockSupabase)
      ).rejects.toThrow('Opportunities must be an array');

      await expect(
        earlyDuplicateDetector.detectDuplicates([], null, mockSupabase)
      ).rejects.toThrow('Source ID is required');
    });

    it('should categorize all new opportunities correctly', async () => {
      const opportunities = [
        { id: 'new-1', title: 'New Grant 1' },
        { id: 'new-2', title: 'New Grant 2' }
      ];

      // Mock no existing records found
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      });

      const result = await earlyDuplicateDetector.detectDuplicates(opportunities, 'source-1', mockSupabase);
      
      expect(result.newOpportunities).toHaveLength(2);
      expect(result.opportunitiesToUpdate).toHaveLength(0);
      expect(result.opportunitiesToSkip).toHaveLength(0);
      expect(result.metrics.totalProcessed).toBe(2);
    });
  });

  describe('batchFetchDuplicates', () => {
    it('should perform efficient batch queries', async () => {
      const opportunities = [
        { id: 'id-1', title: 'Grant 1' },
        { id: 'id-2', title: 'Grant 2' },
        { id: 'id-1', title: 'Grant 1' } // Duplicate ID should be deduplicated
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }));

      mockSupabase.from.mockReturnValue({
        select: mockSelect
      });

      await earlyDuplicateDetector.batchFetchDuplicates(opportunities, 'source-1', mockSupabase);

      // Should only call database twice (once for IDs, once for titles)
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('funding_opportunities');
    });

    it('should handle database errors gracefully', async () => {
      const opportunities = [{ id: 'test-1', title: 'Test Grant' }];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB Error') }))
          }))
        }))
      });

      // Should not throw despite database errors
      const result = await earlyDuplicateDetector.batchFetchDuplicates(opportunities, 'source-1', mockSupabase);
      expect(result.idMap.size).toBe(0);
      expect(result.titleMap.size).toBe(0);
    });

    it('should filter out short titles and empty IDs', async () => {
      const opportunities = [
        { id: '', title: 'Short' }, // Empty ID, short title
        { id: 'valid-id', title: 'This is a valid long title' },
        { id: null, title: null }
      ];

      const mockIn = vi.fn(() => Promise.resolve({ data: [], error: null }));
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ in: mockIn }))
        }))
      });

      await earlyDuplicateDetector.batchFetchDuplicates(opportunities, 'source-1', mockSupabase);

      // Should only query for valid ID and valid title
      expect(mockIn).toHaveBeenCalledWith(['valid-id']); // Only valid ID
      expect(mockIn).toHaveBeenCalledWith(['This is a valid long title']); // Only valid title
    });
  });

  describe('findExistingWithValidation', () => {
    it('should prioritize ID + Title validation', () => {
      const opportunity = { id: 'test-id', title: 'Test Grant' };
      const idMatch = { id: 1, opportunity_id: 'test-id', title: 'Test Grant' };
      
      const idMap = new Map([['test-id', idMatch]]);
      const titleMap = new Map();

      duplicateDetector.titlesAreSimilar.mockReturnValue(true);

      const result = earlyDuplicateDetector.findExistingWithValidation(opportunity, idMap, titleMap);
      
      expect(result).toBe(idMatch);
      expect(duplicateDetector.titlesAreSimilar).toHaveBeenCalledWith('Test Grant', 'Test Grant');
    });

    it('should detect ID reuse and fall back to title matching', () => {
      const opportunity = { id: 'reused-id', title: 'Different Grant' };
      const idMatch = { id: 1, opportunity_id: 'reused-id', title: 'Original Grant' };
      const titleMatch = { id: 2, opportunity_id: 'other-id', title: 'Different Grant' };
      
      const idMap = new Map([['reused-id', idMatch]]);
      const titleMap = new Map([['Different Grant', titleMatch]]);

      duplicateDetector.titlesAreSimilar.mockReturnValue(false); // ID validation fails

      const result = earlyDuplicateDetector.findExistingWithValidation(opportunity, idMap, titleMap);
      
      expect(result).toBe(titleMatch); // Should fall back to title match
      expect(duplicateDetector.titlesAreSimilar).toHaveBeenCalledWith('Original Grant', 'Different Grant');
    });

    it('should return null when no matches found', () => {
      const opportunity = { id: 'no-match', title: 'No Match Grant' };
      const idMap = new Map();
      const titleMap = new Map();

      const result = earlyDuplicateDetector.findExistingWithValidation(opportunity, idMap, titleMap);
      
      expect(result).toBeNull();
    });
  });

  describe('performFreshnessCheck', () => {
    const baseOpportunity = { title: 'Test Grant' };
    const baseExisting = { updated_at: '2024-01-01T00:00:00Z' };

    it('should handle Scenario 1: API timestamp newer', () => {
      const opportunity = { 
        ...baseOpportunity, 
        api_updated_at: '2024-06-01T00:00:00Z' 
      };
      const existing = { 
        ...baseExisting, 
        api_updated_at: '2024-05-01T00:00:00Z' 
      };

      const result = earlyDuplicateDetector.performFreshnessCheck(opportunity, existing);
      
      expect(result.action).toBe('process');
      expect(result.reason).toBe('api_timestamp_newer');
    });

    it('should handle Scenario 2: API timestamp not newer', () => {
      const opportunity = { 
        ...baseOpportunity, 
        api_updated_at: '2024-05-01T00:00:00Z' 
      };
      const existing = { 
        ...baseExisting, 
        api_updated_at: '2024-06-01T00:00:00Z' 
      };

      const result = earlyDuplicateDetector.performFreshnessCheck(opportunity, existing);
      
      expect(result.action).toBe('skip');
      expect(result.reason).toBe('api_timestamp_not_newer');
    });

    it('should handle Scenario 3: No API timestamp, stale record (>90 days)', () => {
      const opportunity = baseOpportunity; // No api_updated_at
      const existing = { 
        updated_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() // 100 days ago
      };

      const result = earlyDuplicateDetector.performFreshnessCheck(opportunity, existing);
      
      expect(result.action).toBe('process');
      expect(result.reason).toBe('stale_review_90_days');
    });

    it('should handle Scenario 4: No API timestamp, recently reviewed (<90 days)', () => {
      const opportunity = baseOpportunity; // No api_updated_at
      const existing = { 
        updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
      };

      const result = earlyDuplicateDetector.performFreshnessCheck(opportunity, existing);
      
      expect(result.action).toBe('skip');
      expect(result.reason).toBe('recently_reviewed');
    });
  });

  describe('checkCriticalFieldChanges', () => {
    it('should detect changes in critical fields', () => {
      const existing = { minimumAward: 1000 };
      const opportunity = { minimumAward: 2000 };

      changeDetector.hasFieldChanged.mockReturnValue(true);

      const result = earlyDuplicateDetector.checkCriticalFieldChanges(existing, opportunity);
      
      expect(result).toBe(true);
      expect(changeDetector.hasFieldChanged).toHaveBeenCalledWith(existing, opportunity, 'minimumAward');
    });

    it('should check all 6 critical fields', () => {
      const existing = {};
      const opportunity = {};

      changeDetector.hasFieldChanged.mockReturnValue(false);

      earlyDuplicateDetector.checkCriticalFieldChanges(existing, opportunity);
      
      const expectedFields = [
        'title',
        'minimumAward',
        'maximumAward', 
        'totalFundingAvailable',
        'closeDate',
        'openDate'
      ];

      expectedFields.forEach(field => {
        expect(changeDetector.hasFieldChanged).toHaveBeenCalledWith(existing, opportunity, field);
      });
    });

    it('should return false when no critical fields changed', () => {
      const existing = {};
      const opportunity = {};

      changeDetector.hasFieldChanged.mockReturnValue(false);

      const result = earlyDuplicateDetector.checkCriticalFieldChanges(existing, opportunity);
      
      expect(result).toBe(false);
    });
  });

  describe('Integration Test', () => {
    it('should handle complete duplicate detection workflow', async () => {
      const opportunities = [
        { id: 'new-1', title: 'Completely New Grant' },
        { id: 'update-1', title: 'Grant to Update', minimumAward: 2000 },
        { id: 'skip-1', title: 'Grant to Skip' }
      ];

      // Mock database responses
      const existingRecords = [
        { 
          id: 1, 
          opportunity_id: 'update-1', 
          title: 'Grant to Update', 
          minimumAward: 1000,
          updated_at: '2024-01-01T00:00:00Z'
        },
        { 
          id: 2, 
          opportunity_id: 'skip-1', 
          title: 'Grant to Skip',
          updated_at: new Date().toISOString() // Recent
        }
      ];

      // Mock batch fetch returning existing records
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn((field, values) => {
              if (field === 'opportunity_id') {
                return Promise.resolve({ 
                  data: existingRecords.filter(r => values.includes(r.opportunity_id)), 
                  error: null 
                });
              }
              return Promise.resolve({ data: [], error: null });
            })
          }))
        }))
      });

      // Mock title similarity (always true for exact matches)
      duplicateDetector.titlesAreSimilar.mockReturnValue(true);

      // Mock field changes
      changeDetector.hasFieldChanged.mockImplementation((existing, opportunity, field) => {
        if (existing.opportunity_id === 'update-1' && field === 'minimumAward') {
          return true; // Grant to Update has changes
        }
        return false;
      });

      const result = await earlyDuplicateDetector.detectDuplicates(opportunities, 'source-1', mockSupabase);
      
      expect(result.newOpportunities).toHaveLength(1);
      expect(result.newOpportunities[0].id).toBe('new-1');
      
      expect(result.opportunitiesToUpdate).toHaveLength(1);
      expect(result.opportunitiesToUpdate[0].apiRecord.id).toBe('update-1');
      
      expect(result.opportunitiesToSkip).toHaveLength(1);
      expect(result.opportunitiesToSkip[0].apiRecord.id).toBe('skip-1');
      
      expect(result.metrics.totalProcessed).toBe(3);
    });
  });
}); 