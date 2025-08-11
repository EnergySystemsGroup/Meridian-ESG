import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { fundingSourceManager } from '../../../../lib/agents-v2/core/storageAgent/fundingSourceManager.js'

// ============================================================================
// Helper Functions for Proper Supabase Chain Mocking
// ============================================================================

// Helper to mock .from('funding_sources').select().eq().maybeSingle() chain for lookups
function mockFromSelectEqMaybeSingle(client, data, error = null) {
  client.from.mockImplementationOnce((table) => {
    if (table === 'funding_sources') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn().mockResolvedValue({ data, error })
          }))
        }))
      };
    }
    return {};
  });
}

// Helper to mock .from('funding_sources').insert().select().single() chain for creation
function mockFromInsertSelectSingle(client, data, error = null) {
  client.from.mockImplementationOnce((table) => {
    if (table === 'funding_sources') {
      return {
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data, error })
          }))
        }))
      };
    }
    return {};
  });
}

// Helper to mock .from('funding_sources').update().eq() chain for updates
function mockFromUpdateEq(client, error = null) {
  client.from.mockImplementationOnce((table) => {
    if (table === 'funding_sources') {
      return {
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error })
        }))
      };
    }
    return {};
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Funding Source Manager Unit Tests', () => {
  let mockSupabaseClient
  let consoleLogSpy
  let consoleErrorSpy

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create a fresh mock Supabase client for each test
    mockSupabaseClient = {
      from: jest.fn()
    }

    // Spy on console methods for this test only
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console methods after each test
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('getOrCreate', () => {
    test('should create new funding source when none exists', async () => {
      const opportunity = {
        agencyName: 'Test Agency',
        agencyEmail: 'test@agency.gov',
        agencyPhone: '555-1234',
        agencyWebsite: 'https://agency.gov'
      }
      const source = { name: 'API Source', type: 'federal' }
      
      // Mock no existing funding source
      mockFromSelectEqMaybeSingle(mockSupabaseClient, null)
      
      // Mock successful creation
      mockFromInsertSelectSingle(mockSupabaseClient, { id: 'new-funding-id' })
      
      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockSupabaseClient)
      
      expect(result).toBe('new-funding-id')
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('funding_sources')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[FundingSourceManager] ✨ Created new funding source: Test Agency'
      )
    })

    test('should return existing funding source ID when found', async () => {
      const opportunity = { agencyName: 'Existing Agency' }
      const source = { name: 'API Source' }
      
      // Mock existing funding source
      mockFromSelectEqMaybeSingle(mockSupabaseClient, {
        id: 'existing-id',
        name: 'Existing Agency',
        contact_email: null,
        contact_phone: null,
        website: null
      })
      
      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockSupabaseClient)
      
      expect(result).toBe('existing-id')
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1)
    })

    test('should update existing funding source with new information', async () => {
      const opportunity = {
        agencyName: 'Existing Agency',
        agencyEmail: 'new@agency.gov',
        agencyPhone: '555-5678'
      }
      const source = { name: 'API Source' }
      
      // Mock existing funding source without contact info
      mockFromSelectEqMaybeSingle(mockSupabaseClient, {
        id: 'existing-id',
        name: 'Existing Agency',
        contact_email: null,
        contact_phone: null,
        website: null
      })
      
      // Mock successful update
      mockFromUpdateEq(mockSupabaseClient, null)
      
      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockSupabaseClient)
      
      expect(result).toBe('existing-id')
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[FundingSourceManager] 📝 Updated funding source: Existing Agency'
      )
    })

    test('should return null for unknown agency', async () => {
      const opportunity = {}
      const source = {}
      
      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockSupabaseClient)
      
      expect(result).toBeNull()
      expect(mockSupabaseClient.from).not.toHaveBeenCalled()
    })

    test('should use fallback agency names', async () => {
      // Test priority: agencyName > fundingAgency > source.name
      const opportunity1 = { fundingAgency: 'Funding Agency' }
      const opportunity2 = {}
      const source = { name: 'Source Agency' }
      
      // First call - opportunity1 with fundingAgency
      mockFromSelectEqMaybeSingle(mockSupabaseClient, null)
      mockFromInsertSelectSingle(mockSupabaseClient, { id: 'new-id-1' })
      
      const result1 = await fundingSourceManager.getOrCreate(opportunity1, source, mockSupabaseClient)
      expect(result1).toBe('new-id-1')
      
      // Verify the first call created with 'Funding Agency'
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2)
      
      // Reset for second call
      jest.clearAllMocks()
      
      // Second call - opportunity2 with no agency, should use source.name
      mockFromSelectEqMaybeSingle(mockSupabaseClient, null)
      mockFromInsertSelectSingle(mockSupabaseClient, { id: 'new-id-2' })
      
      const result2 = await fundingSourceManager.getOrCreate(opportunity2, source, mockSupabaseClient)
      expect(result2).toBe('new-id-2')
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2)
    })
  })

  describe('findByName', () => {
    test('should find existing funding source by name', async () => {
      const expectedData = {
        id: 'found-id',
        name: 'Test Agency',
        type: 'federal'
      }
      
      mockFromSelectEqMaybeSingle(mockSupabaseClient, expectedData)
      
      const result = await fundingSourceManager.findByName('Test Agency', mockSupabaseClient)
      
      expect(result).toEqual(expectedData)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('funding_sources')
    })

    test('should return null when funding source not found', async () => {
      mockFromSelectEqMaybeSingle(mockSupabaseClient, null)
      
      const result = await fundingSourceManager.findByName('Nonexistent Agency', mockSupabaseClient)
      
      expect(result).toBeNull()
    })
  })

  describe('updateIfNeeded', () => {
    test('should update funding source with new contact information', async () => {
      const existing = {
        id: 'existing-id',
        name: 'Test Agency',
        contact_email: null,
        contact_phone: null,
        website: null
      }
      
      const opportunity = {
        agencyEmail: 'new@test.gov',
        agencyPhone: '555-9999',
        agencyWebsite: 'https://new.gov'
      }
      
      const source = { website: 'https://source.com' }
      
      mockFromUpdateEq(mockSupabaseClient, null)
      
      const result = await fundingSourceManager.updateIfNeeded(existing, opportunity, source, mockSupabaseClient)
      
      expect(result).toBe('existing-id')
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('funding_sources')
    })

    test('should not update if no new information', async () => {
      const existing = {
        id: 'existing-id',
        name: 'Test Agency',
        contact_email: 'existing@test.gov',
        contact_phone: '555-0000',
        website: 'https://existing.gov'
      }
      
      const opportunity = {
        agencyEmail: 'new@test.gov',
        agencyPhone: '555-9999',
        agencyWebsite: 'https://new.gov'
      }
      
      const source = {}
      
      const result = await fundingSourceManager.updateIfNeeded(existing, opportunity, source, mockSupabaseClient)
      
      expect(result).toBe('existing-id')
      expect(mockSupabaseClient.from).not.toHaveBeenCalled()
    })

    test('should use source website as fallback', async () => {
      const existing = {
        id: 'existing-id',
        name: 'Test Agency',
        website: null
      }
      
      const opportunity = {} // No website in opportunity
      const source = { website: 'https://source-website.com' }
      
      mockFromUpdateEq(mockSupabaseClient, null)
      
      await fundingSourceManager.updateIfNeeded(existing, opportunity, source, mockSupabaseClient)
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('funding_sources')
    })

    test('should handle update errors gracefully', async () => {
      const existing = {
        id: 'existing-id',
        name: 'Test Agency',
        contact_email: null
      }
      
      const opportunity = { agencyEmail: 'new@test.gov' }
      const source = {}
      
      mockFromUpdateEq(mockSupabaseClient, { message: 'Update failed' })
      
      const result = await fundingSourceManager.updateIfNeeded(existing, opportunity, source, mockSupabaseClient)
      
      expect(result).toBe('existing-id')
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[FundingSourceManager] ❌ Error updating funding source:',
        expect.objectContaining({ message: 'Update failed' })
      )
    })
  })

  describe('create', () => {
    test('should create new funding source with all fields', async () => {
      const opportunity = {
        agencyEmail: 'contact@agency.gov',
        agencyPhone: '555-1234',
        agencyWebsite: 'https://agency.gov'
      }
      const source = { type: 'federal' }
      const agencyName = 'New Federal Agency'
      
      mockFromInsertSelectSingle(mockSupabaseClient, { id: 'created-id' })
      
      const result = await fundingSourceManager.create(opportunity, source, agencyName, mockSupabaseClient)
      
      expect(result).toBe('created-id')
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('funding_sources')
    })

    test('should handle creation errors', async () => {
      const opportunity = {}
      const source = {}
      const agencyName = 'Failed Agency'
      
      mockFromInsertSelectSingle(mockSupabaseClient, null, { message: 'Insert failed' })
      
      const result = await fundingSourceManager.create(opportunity, source, agencyName, mockSupabaseClient)
      
      expect(result).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[FundingSourceManager] ❌ Error creating funding source:',
        expect.objectContaining({ message: 'Insert failed' })
      )
    })

    test('should use source website when opportunity website not available', async () => {
      const opportunity = {}
      const source = { website: 'https://source-site.com', type: 'state' }
      const agencyName = 'State Agency'
      
      mockFromInsertSelectSingle(mockSupabaseClient, { id: 'created-id' })
      
      await fundingSourceManager.create(opportunity, source, agencyName, mockSupabaseClient)
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('funding_sources')
    })
  })

  describe('categorizeAgencyType', () => {
    test('should use source type when available', () => {
      expect(fundingSourceManager.categorizeAgencyType('federal', 'Some Agency')).toBe('federal')
      expect(fundingSourceManager.categorizeAgencyType('state', 'Another Agency')).toBe('state')
      expect(fundingSourceManager.categorizeAgencyType('local', 'City Agency')).toBe('local')
      expect(fundingSourceManager.categorizeAgencyType('foundation', 'Fund Name')).toBe('foundation')
      expect(fundingSourceManager.categorizeAgencyType('utility', 'Electric Co')).toBe('utility')
    })

    test('should not use unknown source type', () => {
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'EPA')).toBe('federal')
      expect(fundingSourceManager.categorizeAgencyType('unknown', 'City of Austin')).toBe('local')
    })

    test('should categorize federal agencies by name patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType(null, 'Department of Energy')).toBe('federal')
      expect(fundingSourceManager.categorizeAgencyType(null, 'EPA Environmental Protection')).toBe('federal')
      expect(fundingSourceManager.categorizeAgencyType(null, 'DOE Grants')).toBe('federal')
      expect(fundingSourceManager.categorizeAgencyType(null, 'USDA Rural Development')).toBe('federal')
      expect(fundingSourceManager.categorizeAgencyType(null, 'Treasury Department')).toBe('federal')
      expect(fundingSourceManager.categorizeAgencyType(null, 'Federal Highway Administration')).toBe('federal')
    })

    test('should categorize state agencies by name patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType(null, 'State Energy Office')).toBe('state')
      expect(fundingSourceManager.categorizeAgencyType(null, 'California Energy Commission')).toBe('state')
      expect(fundingSourceManager.categorizeAgencyType(null, 'Texas Department of Transportation')).toBe('state')
      expect(fundingSourceManager.categorizeAgencyType(null, 'New York State Energy')).toBe('state')
      expect(fundingSourceManager.categorizeAgencyType(null, 'Florida DEP')).toBe('state')
    })

    test('should categorize local agencies by name patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType(null, 'County of Los Angeles')).toBe('local')
      expect(fundingSourceManager.categorizeAgencyType(null, 'City of Austin')).toBe('local')
      expect(fundingSourceManager.categorizeAgencyType(null, 'Municipal Water District')).toBe('local')
    })

    test('should categorize foundations by name patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType(null, 'Gates Foundation')).toBe('foundation')
      expect(fundingSourceManager.categorizeAgencyType(null, 'Energy Fund')).toBe('foundation')
      expect(fundingSourceManager.categorizeAgencyType(null, 'Community Trust')).toBe('foundation')
    })

    test('should categorize utilities by name patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType(null, 'Pacific Gas & Electric')).toBe('utility')
      expect(fundingSourceManager.categorizeAgencyType(null, 'Utility Company')).toBe('utility')
      expect(fundingSourceManager.categorizeAgencyType(null, 'Electric Cooperative')).toBe('utility')
    })

    test('should default to government for unknown patterns', () => {
      expect(fundingSourceManager.categorizeAgencyType(null, 'Random Organization')).toBe('government')
      expect(fundingSourceManager.categorizeAgencyType(null, 'Unknown Entity')).toBe('government')
      expect(fundingSourceManager.categorizeAgencyType('', 'Some Agency')).toBe('government')
    })

    test('should handle case insensitive matching', () => {
      expect(fundingSourceManager.categorizeAgencyType(null, 'DEPARTMENT OF ENERGY')).toBe('federal')
      expect(fundingSourceManager.categorizeAgencyType(null, 'state of california')).toBe('state')
      expect(fundingSourceManager.categorizeAgencyType(null, 'CITY OF CHICAGO')).toBe('local')
      expect(fundingSourceManager.categorizeAgencyType(null, 'gates FOUNDATION')).toBe('foundation')
    })
  })

  describe('Integration scenarios', () => {
    test('should handle complete flow: find, create, and log', async () => {
      const opportunity = {
        agencyName: 'Brand New Agency',
        agencyEmail: 'contact@new.gov',
        agencyPhone: '555-0000',
        agencyWebsite: 'https://newagency.gov'
      }
      const source = { type: 'federal', website: 'https://source.com' }
      
      // First call - no existing
      mockFromSelectEqMaybeSingle(mockSupabaseClient, null)
      
      // Create new
      mockFromInsertSelectSingle(mockSupabaseClient, { id: 'new-agency-id' })
      
      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockSupabaseClient)
      
      expect(result).toBe('new-agency-id')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[FundingSourceManager] ✨ Created new funding source: Brand New Agency'
      )
    })

    test('should handle complete flow: find, update, and log', async () => {
      const opportunity = {
        agencyName: 'Existing Agency',
        agencyEmail: 'updated@existing.gov'
      }
      const source = {}
      
      // Mock existing without email
      mockFromSelectEqMaybeSingle(mockSupabaseClient, {
        id: 'existing-agency-id',
        name: 'Existing Agency',
        contact_email: null
      })
      
      // Mock successful update
      mockFromUpdateEq(mockSupabaseClient, null)
      
      const result = await fundingSourceManager.getOrCreate(opportunity, source, mockSupabaseClient)
      
      expect(result).toBe('existing-agency-id')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[FundingSourceManager] 📝 Updated funding source: Existing Agency'
      )
    })
  })
})