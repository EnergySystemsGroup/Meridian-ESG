/**
 * Unit Tests for FundingSourceManager
 * 
 * Comprehensive test suite covering all functions and edge cases
 * for funding source creation, updates, and categorization.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { fundingSourceManager } from '../../core/storageAgent/fundingSourceManager.js';

describe('FundingSourceManager', () => {
  let mockClient;

  beforeEach(() => {
    // Create fresh mocks for each test
    const mockChain = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
      single: vi.fn()
    };

    // Make all methods return the chain for proper chaining
    mockChain.select.mockReturnValue(mockChain);
    mockChain.insert.mockReturnValue(mockChain);
    mockChain.update.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);

    // Mock client
    mockClient = {
      from: vi.fn(() => mockChain)
    };
    
    vi.clearAllMocks();
  });

  describe('categorizeAgencyType', () => {
    test('should return source type when provided and not unknown', () => {
      expect(fundingSourceManager.categorizeAgencyType('federal', 'Test Agency')).toBe('federal');
      expect(fundingSourceManager.categorizeAgencyType('state', 'Test Agency')).toBe('state');
      expect(fundingSourceManager.categorizeAgencyType('foundation', 'Test Agency')).toBe('foundation');
    });

    test('should categorize federal agencies by name patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Department of Energy')).toBe('federal');
      expect(fundingSourceManager.categorizeAgencyType(null, 'Federal Trade Commission')).toBe('federal');
      expect(fundingSourceManager.categorizeAgencyType(undefined, 'EPA Regional Office')).toBe('federal');
      expect(fundingSourceManager.categorizeAgencyType('', 'DOE Office')).toBe('federal');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'USDA Rural Development')).toBe('federal');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Treasury Department')).toBe('federal');
    });

    test('should categorize state agencies by name patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'California Energy Commission')).toBe('state');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Texas State Energy Office')).toBe('state');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'New York Energy Office')).toBe('state');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Florida Energy Office')).toBe('state');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'State Energy Program')).toBe('state');
    });

    test('should categorize local agencies by name patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Los Angeles County')).toBe('local');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'City of San Francisco')).toBe('local');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Municipal Utility District')).toBe('local');
    });

    test('should categorize foundations by name patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Environmental Foundation')).toBe('foundation');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Climate Fund Initiative')).toBe('foundation');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Green Energy Trust')).toBe('foundation');
    });

    test('should categorize utilities by name patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Pacific Gas & Electric Company')).toBe('utility');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Edison Electric Company')).toBe('utility');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Regional Utility Company')).toBe('utility');
    });

    test('should default to government for unrecognized patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Random Organization')).toBe('government');
      expect(fundingSourceManager.categorizeAgencyType(null, 'Unknown Agency')).toBe('government');
      expect(fundingSourceManager.categorizeAgencyType(undefined, '')).toBe('government');
    });

    test('should handle case-insensitive matching', () => {
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'DEPARTMENT OF ENERGY')).toBe('federal');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'california ENERGY commission')).toBe('state');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'Environmental FOUNDATION')).toBe('foundation');
    });

    test('should prioritize federal patterns over state patterns', () => {
      // "Department of" triggers federal even if state name is present
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'New York Department of Energy')).toBe('federal');
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'California Department of Transportation')).toBe('federal');
    });
  });

  describe('findByName', () => {
    test('should query database with correct agency name', async () => {
      const mockData = { id: 'source-1', name: 'Test Agency' };
      const mockChain = mockClient.from();
      mockChain.maybeSingle.mockResolvedValue({ data: mockData });

      const result = await fundingSourceManager.findByName('Test Agency', mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('funding_sources');
      expect(result).toEqual(mockData);
    });

    test('should return null when agency not found', async () => {
      const mockChain = mockClient.from();
      mockChain.maybeSingle.mockResolvedValue({ data: null });

      const result = await fundingSourceManager.findByName('Nonexistent Agency', mockClient);

      expect(result).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      const mockChain = mockClient.from();
      mockChain.maybeSingle.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const result = await fundingSourceManager.findByName('Test Agency', mockClient);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('should create funding source with all available data', async () => {
      const opportunity = {
        agencyWebsite: 'https://agency.gov',
        agencyEmail: 'contact@agency.gov',
        agencyPhone: '555-0123'
      };
      const source = { type: 'federal', website: 'https://source.gov' };
      const agencyName = 'Department of Energy';
      const mockInserted = { id: 'new-source-1' };

      const mockChain = mockClient.from();
      mockChain.single.mockResolvedValue({ 
        data: mockInserted, 
        error: null 
      });

      const result = await fundingSourceManager.create(opportunity, source, agencyName, mockClient);

      expect(result).toBe('new-source-1');
    });

    test('should handle database insertion errors', async () => {
      const opportunity = {};
      const source = { type: 'government' };
      const agencyName = 'Test Agency';

      const mockChain = mockClient.from();
      mockChain.single.mockResolvedValue({ 
        data: null, 
        error: new Error('Insertion failed') 
      });

      const result = await fundingSourceManager.create(opportunity, source, agencyName, mockClient);

      expect(result).toBeNull();
    });
  });

  describe('updateIfNeeded', () => {
    const mockExisting = {
      id: 'existing-1',
      name: 'Test Agency',
      contact_email: null,
      contact_phone: null,
      website: null
    };

    test('should update when new contact information is available', async () => {
      const opportunity = {
        agencyEmail: 'new@agency.gov',
        agencyPhone: '555-9999',
        agencyWebsite: 'https://newsite.gov'
      };
      const source = { website: 'https://source.gov' };

      const mockChain = mockClient.from();
      mockChain.eq.mockResolvedValue({ error: null });

      const result = await fundingSourceManager.updateIfNeeded(mockExisting, opportunity, source, mockClient);

      expect(result).toBe('existing-1');
    });

    test('should not overwrite existing contact information', async () => {
      const existingWithData = {
        ...mockExisting,
        contact_email: 'existing@agency.gov',
        contact_phone: '555-1111',
        website: 'https://existing.gov'
      };
      const opportunity = {
        agencyEmail: 'new@agency.gov',
        agencyPhone: '555-9999',
        agencyWebsite: 'https://newsite.gov'
      };
      const source = {};

      const result = await fundingSourceManager.updateIfNeeded(existingWithData, opportunity, source, mockClient);

      expect(result).toBe('existing-1');
    });

    test('should handle database update errors gracefully', async () => {
      const opportunity = { agencyEmail: 'new@agency.gov' };
      const source = {};

      const mockChain = mockClient.from();
      mockChain.eq.mockResolvedValue({ 
        error: new Error('Update failed') 
      });

      const result = await fundingSourceManager.updateIfNeeded(mockExisting, opportunity, source, mockClient);

      expect(result).toBe('existing-1'); // Should still return ID even if update fails
    });

    test('should not update when no new information is available', async () => {
      const opportunity = {};
      const source = {};

      const result = await fundingSourceManager.updateIfNeeded(mockExisting, opportunity, source, mockClient);

      expect(result).toBe('existing-1');
    });
  });

  describe('getOrCreate', () => {
    test('should extract agency name from opportunity.agencyName', async () => {
      const opportunity = { agencyName: 'Test Agency' };
      const source = { name: 'Source Name' };

      const mockChain = mockClient.from();
      mockChain.maybeSingle.mockResolvedValue({ data: null });
      mockChain.single.mockResolvedValue({ 
        data: { id: 'new-1' }, 
        error: null 
      });

      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockClient);

      expect(result).toBe('new-1');
    });

    test('should return null for Unknown Agency', async () => {
      const opportunity = {};
      const source = {};

      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockClient);

      expect(result).toBeNull();
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    test('should return null when no agency name available', async () => {
      const opportunity = { agencyName: null };
      const source = { name: null };

      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockClient);

      expect(result).toBeNull();
    });

    test('should create new funding source when not found', async () => {
      const opportunity = { agencyName: 'New Agency' };
      const source = { type: 'federal' };

      const mockChain = mockClient.from();
      mockChain.maybeSingle.mockResolvedValue({ data: null });
      mockChain.single.mockResolvedValue({ 
        data: { id: 'new-4' }, 
        error: null 
      });

      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockClient);

      expect(result).toBe('new-4');
    });
  });

  describe('edge cases and error scenarios', () => {
    test('should handle empty strings as agency names', async () => {
      const opportunity = { agencyName: '' };
      const source = { name: '' };

      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockClient);

      expect(result).toBeNull();
    });

    test('should handle null and undefined values', async () => {
      const opportunity = { agencyName: null };
      const source = { name: undefined };

      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockClient);

      expect(result).toBeNull();
    });

    test('should handle very long agency names', async () => {
      const longName = 'A'.repeat(1000);
      const opportunity = { agencyName: longName };
      const source = {};

      const mockChain = mockClient.from();
      mockChain.maybeSingle.mockResolvedValue({ data: null });
      mockChain.single.mockResolvedValue({ 
        data: { id: 'new-long' }, 
        error: null 
      });

      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockClient);

      expect(result).toBe('new-long');
    });

    test('should handle special characters in agency names', async () => {
      const specialName = 'Agency & Co. (Non-Profit) [2024]';
      const opportunity = { agencyName: specialName };
      const source = {};

      const mockChain = mockClient.from();
      mockChain.maybeSingle.mockResolvedValue({ data: null });
      mockChain.single.mockResolvedValue({ 
        data: { id: 'new-special' }, 
        error: null 
      });

      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockClient);

      expect(result).toBe('new-special');
    });
  });
});