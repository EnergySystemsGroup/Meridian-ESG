/**
 * Unit Tests for StateEligibilityProcessor
 * 
 * Comprehensive test suite covering state eligibility processing,
 * location parsing integration, and database operations.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { stateEligibilityProcessor } from '../../core/storageAgent/stateEligibilityProcessor.js';

// Mock the locationParsing utility
vi.mock('../../core/storageAgent/utils/locationParsing.js', () => ({
  locationParsing: {
    parseLocationToStateCodes: vi.fn()
  }
}));

describe('StateEligibilityProcessor', () => {
  let mockClient;
  let mockLocationParsing;

  beforeEach(async () => {
    // Import the mocked locationParsing
    const { locationParsing } = await import('../../core/storageAgent/utils/locationParsing.js');
    mockLocationParsing = locationParsing;

    // Create fresh mocks for each test with simple approach
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    mockClient = {
      from: vi.fn(() => mockChain)
    };
    
    vi.clearAllMocks();
  });

  describe('parseLocationsToStateCodes', () => {
    test('should handle empty or invalid inputs', async () => {
      const result = await stateEligibilityProcessor.parseLocationsToStateCodes([]);
      expect(result).toEqual([]);

      const result2 = await stateEligibilityProcessor.parseLocationsToStateCodes(null);
      expect(result2).toEqual([]);

      const result3 = await stateEligibilityProcessor.parseLocationsToStateCodes(undefined);
      expect(result3).toEqual([]);
    });

    test('should filter out invalid location entries', async () => {
      mockLocationParsing.parseLocationToStateCodes.mockReturnValue(['CA']);

      const locations = ['California', null, '', '   ', 123, 'New York'];
      mockLocationParsing.parseLocationToStateCodes
        .mockReturnValueOnce(['CA'])
        .mockReturnValueOnce(['NY']);

      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(locations);

      expect(mockLocationParsing.parseLocationToStateCodes).toHaveBeenCalledTimes(2);
      expect(mockLocationParsing.parseLocationToStateCodes).toHaveBeenCalledWith('California');
      expect(mockLocationParsing.parseLocationToStateCodes).toHaveBeenCalledWith('New York');
      expect(result).toEqual(['CA', 'NY']);
    });

    test('should deduplicate state codes and sort them', async () => {
      const locations = ['California', 'CA', 'california', 'Texas'];
      mockLocationParsing.parseLocationToStateCodes
        .mockReturnValueOnce(['CA'])
        .mockReturnValueOnce(['CA'])
        .mockReturnValueOnce(['CA'])
        .mockReturnValueOnce(['TX']);

      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(locations);

      expect(result).toEqual(['CA', 'TX']);
    });

    test('should handle regional mappings that return multiple states', async () => {
      const locations = ['Northeast'];
      mockLocationParsing.parseLocationToStateCodes
        .mockReturnValueOnce(['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT']);

      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(locations);

      expect(result).toEqual(['CT', 'MA', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT']);
    });

    test('should trim whitespace from location strings', async () => {
      const locations = ['  California  ', '\t Texas \n'];
      mockLocationParsing.parseLocationToStateCodes
        .mockReturnValueOnce(['CA'])
        .mockReturnValueOnce(['TX']);

      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(locations);

      expect(mockLocationParsing.parseLocationToStateCodes).toHaveBeenCalledWith('California');
      expect(mockLocationParsing.parseLocationToStateCodes).toHaveBeenCalledWith('Texas');
      expect(result).toEqual(['CA', 'TX']);
    });
  });

  describe('createEligibilityRecords', () => {
    test('should handle empty state codes', async () => {
      await stateEligibilityProcessor.createEligibilityRecords('opp-1', [], mockClient);

      expect(mockClient.from).not.toHaveBeenCalled();
    });

    test('should create eligibility records for valid state codes', async () => {
      const mockStates = [
        { id: 'state-1', code: 'CA' },
        { id: 'state-2', code: 'NY' }
      ];

      const mockChain = mockClient.from();
      mockChain.in.mockResolvedValueOnce({ data: mockStates });
      mockChain.insert.mockResolvedValueOnce({ error: null });

      await stateEligibilityProcessor.createEligibilityRecords('opp-1', ['CA', 'NY'], mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('states');
    });

    test('should handle case where no states are found for codes', async () => {
      const mockChain = mockClient.from();
      mockChain.in.mockResolvedValue({ data: null });

      await stateEligibilityProcessor.createEligibilityRecords('opp-1', ['XX', 'YY'], mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('states');
    });

    test('should handle database insertion errors', async () => {
      const mockStates = [{ id: 'state-1', code: 'CA' }];

      const mockChain = mockClient.from();
      mockChain.in.mockResolvedValueOnce({ data: mockStates });
      mockChain.insert.mockResolvedValueOnce({ error: new Error('Insert failed') });

      await expect(
        stateEligibilityProcessor.createEligibilityRecords('opp-1', ['CA'], mockClient)
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('clearExistingEligibility', () => {
    test('should delete existing eligibility records', async () => {
      const mockChain = mockClient.from();
      mockChain.eq.mockResolvedValue({ error: null });

      await stateEligibilityProcessor.clearExistingEligibility('opp-1', mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('opportunity_state_eligibility');
    });

    test('should handle database deletion errors', async () => {
      const mockChain = mockClient.from();
      mockChain.eq.mockResolvedValue({ error: new Error('Delete failed') });

      await expect(
        stateEligibilityProcessor.clearExistingEligibility('opp-1', mockClient)
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('getEligibleStates', () => {
    test('should return eligible states for an opportunity', async () => {
      const mockEligibility = [
        { state_id: 'state-1', states: { id: 'state-1', code: 'CA', name: 'California', abbreviation: 'CA' } },
        { state_id: 'state-2', states: { id: 'state-2', code: 'NY', name: 'New York', abbreviation: 'NY' } }
      ];

      const mockChain = mockClient.from();
      mockChain.eq.mockResolvedValue({ data: mockEligibility });

      const result = await stateEligibilityProcessor.getEligibleStates('opp-1', mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('opportunity_state_eligibility');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'state-1', code: 'CA', name: 'California', abbreviation: 'CA' });
      expect(result[1]).toEqual({ id: 'state-2', code: 'NY', name: 'New York', abbreviation: 'NY' });
    });

    test('should return empty array when no eligibility found', async () => {
      const mockChain = mockClient.from();
      mockChain.eq.mockResolvedValue({ data: null });

      const result = await stateEligibilityProcessor.getEligibleStates('opp-1', mockClient);

      expect(result).toEqual([]);
    });

    test('should handle empty eligibility data', async () => {
      const mockChain = mockClient.from();
      mockChain.eq.mockResolvedValue({ data: [] });

      const result = await stateEligibilityProcessor.getEligibleStates('opp-1', mockClient);

      expect(result).toEqual([]);
    });
  });

  describe('processEligibility', () => {
    test('should handle national opportunities', async () => {
      const opportunity = { isNational: true };

      const result = await stateEligibilityProcessor.processEligibility('opp-1', opportunity, mockClient);

      expect(result).toEqual({ stateCount: 0, isNational: true });
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    test('should process state-specific opportunities', async () => {
      const opportunity = { 
        isNational: false,
        eligibleLocations: ['California', 'New York']
      };

      mockLocationParsing.parseLocationToStateCodes
        .mockReturnValueOnce(['CA'])
        .mockReturnValueOnce(['NY']);

      const mockStates = [
        { id: 'state-1', code: 'CA' },
        { id: 'state-2', code: 'NY' }
      ];

      const mockChain = mockClient.from();
      mockChain.in.mockResolvedValueOnce({ data: mockStates });
      mockChain.insert.mockResolvedValueOnce({ error: null });

      const result = await stateEligibilityProcessor.processEligibility('opp-1', opportunity, mockClient);

      expect(result).toEqual({ stateCount: 2, isNational: false });
      expect(mockLocationParsing.parseLocationToStateCodes).toHaveBeenCalledTimes(2);
    });

    test('should handle opportunities with no valid states', async () => {
      const opportunity = { 
        isNational: false,
        eligibleLocations: ['Invalid Location']
      };

      mockLocationParsing.parseLocationToStateCodes.mockReturnValue([]);

      const result = await stateEligibilityProcessor.processEligibility('opp-1', opportunity, mockClient);

      expect(result).toEqual({ stateCount: 0, isNational: false });
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    test('should handle opportunities with no eligibleLocations', async () => {
      const opportunity = { isNational: false };

      const result = await stateEligibilityProcessor.processEligibility('opp-1', opportunity, mockClient);

      expect(result).toEqual({ stateCount: 0, isNational: false });
    });

    test('should handle opportunities with empty eligibleLocations array', async () => {
      const opportunity = { 
        isNational: false,
        eligibleLocations: []
      };

      const result = await stateEligibilityProcessor.processEligibility('opp-1', opportunity, mockClient);

      expect(result).toEqual({ stateCount: 0, isNational: false });
    });
  });

  describe('updateEligibility', () => {
    test('should clear existing eligibility and process new eligibility', async () => {
      const opportunity = { 
        isNational: false,
        eligibleLocations: ['California']
      };

      mockLocationParsing.parseLocationToStateCodes.mockReturnValue(['CA']);

      const mockStates = [{ id: 'state-1', code: 'CA' }];

      const mockChain = mockClient.from();
      // Mock for clearExistingEligibility
      mockChain.eq.mockResolvedValueOnce({ error: null });
      // Mock for createEligibilityRecords
      mockChain.in.mockResolvedValueOnce({ data: mockStates });
      mockChain.insert.mockResolvedValueOnce({ error: null });

      const result = await stateEligibilityProcessor.updateEligibility('opp-1', opportunity, mockClient);

      expect(result).toEqual({ stateCount: 1, isNational: false });
    });

    test('should handle errors during clear operation', async () => {
      const opportunity = { isNational: false, eligibleLocations: ['California'] };

      const mockChain = mockClient.from();
      mockChain.eq.mockResolvedValue({ error: new Error('Delete failed') });

      await expect(
        stateEligibilityProcessor.updateEligibility('opp-1', opportunity, mockClient)
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('edge cases and error scenarios', () => {
    test('should handle null opportunity data gracefully', async () => {
      const opportunity = null;

      const result = await stateEligibilityProcessor.processEligibility('opp-1', opportunity, mockClient);

      expect(result).toEqual({ stateCount: 0, isNational: false });
    });

    test('should handle undefined opportunity data gracefully', async () => {
      const opportunity = undefined;

      const result = await stateEligibilityProcessor.processEligibility('opp-1', opportunity, mockClient);

      expect(result).toEqual({ stateCount: 0, isNational: false });
    });

    test('should handle malformed eligibleLocations', async () => {
      const opportunity = { 
        isNational: false,
        eligibleLocations: 'California' // String instead of array
      };

      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(opportunity.eligibleLocations);

      expect(result).toEqual([]);
    });

    test('should handle very large number of states', async () => {
      const locations = Array.from({ length: 50 }, (_, i) => `State${i}`);
      
      // Mock each location to return a unique state code
      locations.forEach((_, i) => {
        mockLocationParsing.parseLocationToStateCodes.mockReturnValueOnce([`S${i.toString().padStart(2, '0')}`]);
      });

      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(locations);

      expect(result).toHaveLength(50);
      expect(result[0]).toBe('S00');
      expect(result[49]).toBe('S49');
    });

    test('should handle empty strings in locations array', async () => {
      const locations = ['', '   ', '\t', '\n', 'California'];
      mockLocationParsing.parseLocationToStateCodes.mockReturnValueOnce(['CA']);

      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(locations);

      expect(mockLocationParsing.parseLocationToStateCodes).toHaveBeenCalledTimes(1);
      expect(mockLocationParsing.parseLocationToStateCodes).toHaveBeenCalledWith('California');
      expect(result).toEqual(['CA']);
    });

    test('should handle opportunity with missing isNational property', async () => {
      const opportunity = { eligibleLocations: ['California'] };

      mockLocationParsing.parseLocationToStateCodes.mockReturnValue(['CA']);

      const mockStates = [{ id: 'state-1', code: 'CA' }];
      const mockChain = mockClient.from();
      mockChain.in.mockResolvedValueOnce({ data: mockStates });
      mockChain.insert.mockResolvedValueOnce({ error: null });

      const result = await stateEligibilityProcessor.processEligibility('opp-1', opportunity, mockClient);

      expect(result).toEqual({ stateCount: 1, isNational: false });
    });

    test('should handle opportunity with falsy isNational values', async () => {
      const opportunities = [
        { isNational: false, eligibleLocations: ['CA'] },
        { isNational: 0, eligibleLocations: ['CA'] },
        { isNational: '', eligibleLocations: ['CA'] },
        { isNational: null, eligibleLocations: ['CA'] }
      ];

      mockLocationParsing.parseLocationToStateCodes.mockReturnValue(['CA']);

      const mockStates = [{ id: 'state-1', code: 'CA' }];
      const mockChain = mockClient.from();
      mockChain.in.mockReturnValue({ data: mockStates });
      mockChain.insert.mockReturnValue({ error: null });

      for (const opportunity of opportunities) {
        const result = await stateEligibilityProcessor.processEligibility('opp-1', opportunity, mockClient);
        expect(result.isNational).toBe(false);
      }
    });
  });
});