import { describe, test, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

// Mock the dependencies
jest.mock('@supabase/supabase-js')
jest.mock('../../../../lib/agents-v2/core/storageAgent/utils/locationParsing.js')

// Import the modules
import { stateEligibilityProcessor } from '../../../../lib/agents-v2/core/storageAgent/stateEligibilityProcessor.js'
import { locationParsing } from '../../../../lib/agents-v2/core/storageAgent/utils/locationParsing.js'

// ============================================================================
// Helper Functions for Proper Supabase Chain Mocking
// ============================================================================

// Mock .from('states').select().in() chain for state lookups
function mockFromStatesSelect(client, states, error = null) {
  client.from.mockImplementationOnce((table) => {
    if (table === 'states') {
      return {
        select: jest.fn(() => ({
          in: jest.fn().mockResolvedValue({ data: states, error })
        }))
      };
    }
    return {};
  });
}

// Mock .from('opportunity_state_eligibility').insert() chain
function mockFromInsert(client, error = null) {
  client.from.mockImplementationOnce((table) => {
    if (table === 'opportunity_state_eligibility') {
      return {
        insert: jest.fn().mockResolvedValue({ error })
      };
    }
    return {};
  });
}

// Mock .from('opportunity_state_eligibility').delete().eq() chain
function mockFromDelete(client, error = null) {
  client.from.mockImplementationOnce((table) => {
    if (table === 'opportunity_state_eligibility') {
      return {
        delete: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ error })
        }))
      };
    }
    return {};
  });
}

// Mock .from('opportunity_state_eligibility').select().eq() chain for getting eligible states
function mockFromEligibilitySelect(client, data, error = null) {
  client.from.mockImplementationOnce((table) => {
    if (table === 'opportunity_state_eligibility') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data, error })
        }))
      };
    }
    return {};
  });
}

// Mock .from('funding_opportunities').select().eq().single() chain
function mockFromOpportunitySelect(client, data, error = null) {
  client.from.mockImplementationOnce((table) => {
    if (table === 'funding_opportunities') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data, error })
          }))
        }))
      };
    }
    return {};
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('State Eligibility Processor Unit Tests', () => {
  let mockSupabaseClient
  let consoleLogSpy
  let consoleWarnSpy
  let consoleErrorSpy

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset mock implementations to defaults
    locationParsing.parseLocationToStateCodes.mockReturnValue([])
    locationParsing.isNationalLocation.mockReturnValue(false)
    locationParsing.parseIndividualStates.mockReturnValue([])
    locationParsing.isValidStateCode.mockReturnValue(false)
    locationParsing.getStateName.mockReturnValue(null)
    locationParsing.getStatesInRegion.mockReturnValue([])
    locationParsing.getAvailableRegions.mockReturnValue([])
    locationParsing.expandLocationsToStateCodes.mockReturnValue([])
    locationParsing.isMultiStateLocation.mockReturnValue(false)
    locationParsing.getLocationDescription.mockReturnValue('No specific states')
    
    // Create a fresh mock Supabase client for each test
    mockSupabaseClient = {
      from: jest.fn()
    }

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('processEligibility', () => {
    test('should handle national opportunities', async () => {
      const opportunity = {
        isNational: true,
        eligibleLocations: ['USA']
      }
      
      const result = await stateEligibilityProcessor.processEligibility('opp-national', opportunity, mockSupabaseClient)
      
      expect(result).toEqual({
        stateCount: 0,
        isNational: true
      })
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[StateEligibilityProcessor] 🌍 National opportunity: opp-national'
      )
    })

    test('should handle opportunities with no data', async () => {
      const result = await stateEligibilityProcessor.processEligibility('opp-null', null, mockSupabaseClient)
      
      expect(result).toEqual({
        stateCount: 0,
        isNational: false
      })
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[StateEligibilityProcessor] ⚠️ No opportunity data for: opp-null'
      )
    })

    test('should process eligible locations', async () => {
      const opportunity = {
        isNational: false,
        eligibleLocations: ['California', 'Texas']
      }
      
      locationParsing.parseLocationToStateCodes
        .mockReturnValueOnce(['CA'])
        .mockReturnValueOnce(['TX'])
      
      // Mock the states lookup
      mockFromStatesSelect(mockSupabaseClient, [
        { id: 'state-ca', code: 'CA' },
        { id: 'state-tx', code: 'TX' }
      ])
      
      // Mock the insert success
      mockFromInsert(mockSupabaseClient, null)
      
      const result = await stateEligibilityProcessor.processEligibility('opp-1', opportunity, mockSupabaseClient)
      
      expect(result).toEqual({
        stateCount: 2,
        isNational: false
      })
    })

    test('should handle duplicate state codes', async () => {
      const opportunity = {
        isNational: false,
        eligibleLocations: ['California', 'CA', 'Golden State']
      }
      
      // All three return CA
      locationParsing.parseLocationToStateCodes
        .mockReturnValueOnce(['CA'])
        .mockReturnValueOnce(['CA'])
        .mockReturnValueOnce(['CA'])
      
      // Mock the states lookup
      mockFromStatesSelect(mockSupabaseClient, [{ id: 'state-ca', code: 'CA' }])
      
      // Mock the insert success
      mockFromInsert(mockSupabaseClient, null)
      
      const result = await stateEligibilityProcessor.processEligibility('opp-dup', opportunity, mockSupabaseClient)
      
      // The deduplication happens at the parseLocationsToStateCodes level
      // So we should only get 1 state code, resulting in 1 state record
      expect(result.stateCount).toBe(1)
    })

    test('should handle opportunities with no valid states', async () => {
      const opportunity = {
        isNational: false,
        eligibleLocations: []
      }
      
      const result = await stateEligibilityProcessor.processEligibility('opp-empty', opportunity, mockSupabaseClient)
      
      expect(result).toEqual({
        stateCount: 0,
        isNational: false
      })
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[StateEligibilityProcessor] ⚠️ No valid states found for: opp-empty'
      )
    })

    test('should handle insert errors', async () => {
      const opportunity = {
        isNational: false,
        eligibleLocations: ['California']
      }
      
      locationParsing.parseLocationToStateCodes.mockReturnValue(['CA'])
      
      // Mock the states lookup
      mockFromStatesSelect(mockSupabaseClient, [{ id: 'state-ca', code: 'CA' }])
      
      // Mock the insert to return an error
      mockFromInsert(mockSupabaseClient, new Error('Insert failed'))
      
      await expect(
        stateEligibilityProcessor.processEligibility('opp-error', opportunity, mockSupabaseClient)
      ).rejects.toThrow('Insert failed')
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StateEligibilityProcessor] ❌ Error creating eligibility records:',
        expect.any(Error)
      )
    })
  })

  describe('updateEligibility', () => {
    test('should clear existing eligibility before processing', async () => {
      const opportunity = {
        isNational: false,
        eligibleLocations: ['California']
      }
      
      locationParsing.parseLocationToStateCodes.mockReturnValue(['CA'])
      
      // Mock the delete operation
      mockFromDelete(mockSupabaseClient, null)
      
      // Mock the states lookup
      mockFromStatesSelect(mockSupabaseClient, [{ id: 'state-ca', code: 'CA' }])
      
      // Mock the insert success
      mockFromInsert(mockSupabaseClient, null)
      
      const result = await stateEligibilityProcessor.updateEligibility('opp-update', opportunity, mockSupabaseClient)
      
      expect(result).toEqual({
        stateCount: 1,
        isNational: false
      })
    })

    test('should handle delete errors', async () => {
      const opportunity = {
        isNational: false,
        eligibleLocations: ['California']
      }
      
      // Mock the delete to return an error
      mockFromDelete(mockSupabaseClient, new Error('Delete failed'))
      
      await expect(
        stateEligibilityProcessor.updateEligibility('opp-del-error', opportunity, mockSupabaseClient)
      ).rejects.toThrow('Delete failed')
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StateEligibilityProcessor] ❌ Error clearing existing eligibility:',
        expect.any(Error)
      )
    })
  })

  describe('parseLocationsToStateCodes', () => {
    test('should parse valid location strings to state codes', async () => {
      const locations = ['California', 'Texas', 'New York']
      
      locationParsing.parseLocationToStateCodes
        .mockReturnValueOnce(['CA'])
        .mockReturnValueOnce(['TX'])
        .mockReturnValueOnce(['NY'])
      
      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(locations)
      
      expect(result).toEqual(['CA', 'NY', 'TX']) // Sorted
      expect(locationParsing.parseLocationToStateCodes).toHaveBeenCalledTimes(3)
    })

    test('should handle regional locations that expand to multiple states', async () => {
      const locations = ['New England', 'Southwest']
      
      locationParsing.parseLocationToStateCodes
        .mockReturnValueOnce(['CT', 'ME', 'MA', 'NH', 'RI', 'VT'])  // New England
        .mockReturnValueOnce(['AZ', 'NM', 'TX', 'OK'])  // Southwest
      
      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(locations)
      
      expect(result).toEqual(['AZ', 'CT', 'MA', 'ME', 'NH', 'NM', 'OK', 'RI', 'TX', 'VT'])
    })

    test('should filter out invalid locations', async () => {
      const locations = [null, undefined, '', '  ', 'California', 123, { invalid: true }]
      
      locationParsing.parseLocationToStateCodes.mockReturnValue(['CA'])
      
      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(locations)
      
      expect(result).toEqual(['CA'])
      expect(locationParsing.parseLocationToStateCodes).toHaveBeenCalledTimes(1)
      expect(locationParsing.parseLocationToStateCodes).toHaveBeenCalledWith('California')
    })

    test('should handle empty or invalid arrays', async () => {
      expect(await stateEligibilityProcessor.parseLocationsToStateCodes([])).toEqual([])
      expect(await stateEligibilityProcessor.parseLocationsToStateCodes(null)).toEqual([])
      expect(await stateEligibilityProcessor.parseLocationsToStateCodes(undefined)).toEqual([])
      expect(await stateEligibilityProcessor.parseLocationsToStateCodes('not an array')).toEqual([])
    })

    test('should deduplicate state codes', async () => {
      const locations = ['California', 'CA', 'Golden State', 'Cal']
      
      // All four locations return CA
      locationParsing.parseLocationToStateCodes
        .mockReturnValueOnce(['CA'])  // California
        .mockReturnValueOnce(['CA'])  // CA  
        .mockReturnValueOnce(['CA'])  // Golden State
        .mockReturnValueOnce(['CA'])  // Cal
      
      const result = await stateEligibilityProcessor.parseLocationsToStateCodes(locations)
      
      expect(result).toEqual(['CA'])
      expect(locationParsing.parseLocationToStateCodes).toHaveBeenCalledTimes(4)
    })
  })

  describe('createEligibilityRecords', () => {
    test('should create eligibility records for valid states', async () => {
      const stateCodes = ['CA', 'TX', 'NY']
      
      // Mock the states lookup
      mockFromStatesSelect(mockSupabaseClient, [
        { id: 'state-1', code: 'CA' },
        { id: 'state-2', code: 'TX' },
        { id: 'state-3', code: 'NY' }
      ])
      
      // Mock the insert success
      mockFromInsert(mockSupabaseClient, null)
      
      await stateEligibilityProcessor.createEligibilityRecords('opp-123', stateCodes, mockSupabaseClient)
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('states')
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('opportunity_state_eligibility')
    })

    test('should handle empty state codes array', async () => {
      await stateEligibilityProcessor.createEligibilityRecords('opp-empty', [], mockSupabaseClient)
      
      expect(mockSupabaseClient.from).not.toHaveBeenCalled()
    })

    test('should handle states not found in database', async () => {
      const stateCodes = ['XX', 'YY']
      
      // Mock the states lookup to return null
      mockFromStatesSelect(mockSupabaseClient, null)
      
      await stateEligibilityProcessor.createEligibilityRecords('opp-invalid', stateCodes, mockSupabaseClient)
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[StateEligibilityProcessor] ⚠️ No states found for codes: XX, YY'
      )
    })

    test('should throw on insert error', async () => {
      const stateCodes = ['CA']
      
      // Mock the states lookup
      mockFromStatesSelect(mockSupabaseClient, [{ id: 'state-ca', code: 'CA' }])
      
      // Mock the insert to return an error
      mockFromInsert(mockSupabaseClient, new Error('Insert failed'))
      
      await expect(
        stateEligibilityProcessor.createEligibilityRecords('opp-fail', stateCodes, mockSupabaseClient)
      ).rejects.toThrow('Insert failed')
    })
  })

  describe('clearExistingEligibility', () => {
    test('should clear existing eligibility records', async () => {
      // Mock the delete operation
      mockFromDelete(mockSupabaseClient, null)
      
      await stateEligibilityProcessor.clearExistingEligibility('opp-clear', mockSupabaseClient)
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('opportunity_state_eligibility')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[StateEligibilityProcessor] 🧹 Cleared existing eligibility for: opp-clear'
      )
    })

    test('should throw on delete error', async () => {
      // Mock the delete to return an error
      mockFromDelete(mockSupabaseClient, new Error('Delete failed'))
      
      await expect(
        stateEligibilityProcessor.clearExistingEligibility('opp-del-fail', mockSupabaseClient)
      ).rejects.toThrow('Delete failed')
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[StateEligibilityProcessor] ❌ Error clearing existing eligibility:',
        expect.any(Error)
      )
    })
  })

  describe('getEligibleStates', () => {
    test('should retrieve eligible states for an opportunity', async () => {
      const mockEligibility = [
        { state_id: 'state-1', states: { id: 'state-1', code: 'CA', name: 'California' } },
        { state_id: 'state-2', states: { id: 'state-2', code: 'TX', name: 'Texas' } }
      ]
      
      // Mock the eligibility select
      mockFromEligibilitySelect(mockSupabaseClient, mockEligibility)
      
      const result = await stateEligibilityProcessor.getEligibleStates('opp-get', mockSupabaseClient)
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('opportunity_state_eligibility')
      expect(result).toEqual([
        { id: 'state-1', code: 'CA', name: 'California' },
        { id: 'state-2', code: 'TX', name: 'Texas' }
      ])
    })

    test('should handle no eligible states', async () => {
      // Mock the eligibility select with empty array
      mockFromEligibilitySelect(mockSupabaseClient, [])
      
      const result = await stateEligibilityProcessor.getEligibleStates('opp-none', mockSupabaseClient)
      
      expect(result).toEqual([])
    })

    test('should handle null data', async () => {
      // Mock the eligibility select with null
      mockFromEligibilitySelect(mockSupabaseClient, null)
      
      const result = await stateEligibilityProcessor.getEligibleStates('opp-null', mockSupabaseClient)
      
      expect(result).toEqual([])
    })
  })

  describe('validateEligibility', () => {
    test('should validate national opportunities', async () => {
      // Mock the opportunity lookup
      mockFromOpportunitySelect(mockSupabaseClient, { id: 'opp-nat', is_national: true })
      
      // Mock the eligibility select
      mockFromEligibilitySelect(mockSupabaseClient, [])
      
      const result = await stateEligibilityProcessor.validateEligibility('opp-nat', mockSupabaseClient)
      
      expect(result).toEqual({
        isValid: true,
        stateCount: 0,
        isNational: true
      })
    })

    test('should validate non-national opportunities with states', async () => {
      // Mock the opportunity lookup
      mockFromOpportunitySelect(mockSupabaseClient, { id: 'opp-state', is_national: false })
      
      // Mock the eligibility select
      mockFromEligibilitySelect(mockSupabaseClient, [
        { state_id: 'state-1', states: { id: 'state-1', code: 'CA' } }
      ])
      
      const result = await stateEligibilityProcessor.validateEligibility('opp-state', mockSupabaseClient)
      
      expect(result).toEqual({
        isValid: true,
        stateCount: 1,
        isNational: false
      })
    })

    test('should detect invalid national opportunity with states', async () => {
      // Mock the opportunity lookup
      mockFromOpportunitySelect(mockSupabaseClient, { id: 'opp-invalid', is_national: true })
      
      // Mock the eligibility select with states (invalid for national)
      mockFromEligibilitySelect(mockSupabaseClient, [
        { state_id: 'state-1', states: { id: 'state-1', code: 'CA' } }
      ])
      
      const result = await stateEligibilityProcessor.validateEligibility('opp-invalid', mockSupabaseClient)
      
      expect(result).toEqual({
        isValid: false,
        error: 'National opportunity should not have state eligibility records'
      })
    })

    test('should detect invalid non-national opportunity without states', async () => {
      // Mock the opportunity lookup
      mockFromOpportunitySelect(mockSupabaseClient, { id: 'opp-invalid', is_national: false })
      
      // Mock the eligibility select with no states (invalid for non-national)
      mockFromEligibilitySelect(mockSupabaseClient, [])
      
      const result = await stateEligibilityProcessor.validateEligibility('opp-invalid', mockSupabaseClient)
      
      expect(result).toEqual({
        isValid: false,
        error: 'Non-national opportunity should have at least one eligible state'
      })
    })

    test('should handle opportunity not found', async () => {
      // Mock the opportunity lookup to return null
      mockFromOpportunitySelect(mockSupabaseClient, null)
      
      const result = await stateEligibilityProcessor.validateEligibility('opp-notfound', mockSupabaseClient)
      
      expect(result).toEqual({
        isValid: false,
        error: 'Opportunity not found'
      })
    })
  })
})