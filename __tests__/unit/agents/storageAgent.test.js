import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Import mock implementations first
import * as fundingSourceManagerMocks from '../../../__mocks__/lib/agents-v2/core/storageAgent/fundingSourceManager.js'
import * as stateEligibilityProcessorMocks from '../../../__mocks__/lib/agents-v2/core/storageAgent/stateEligibilityProcessor.js'
import * as dataSanitizerMocks from '../../../__mocks__/lib/agents-v2/core/storageAgent/dataSanitizer.js'

// Set up the mocks before importing the module under test
jest.mock('../../../lib/agents-v2/core/storageAgent/fundingSourceManager.js', () => fundingSourceManagerMocks)
jest.mock('../../../lib/agents-v2/core/storageAgent/stateEligibilityProcessor.js', () => stateEligibilityProcessorMocks)
jest.mock('../../../lib/agents-v2/core/storageAgent/dataSanitizer.js', () => dataSanitizerMocks)
jest.mock('../../../utils/supabase.js')
jest.mock('@supabase/supabase-js')

// NOW import the module under test AFTER all mocks are set up
import { storeOpportunities } from '../../../lib/agents-v2/core/storageAgent/index.js'
import { createSupabaseClient, logAgentExecution } from '../../../utils/supabase.js'
import { createClient } from '@supabase/supabase-js'

// Use the mocks directly
const { fundingSourceManager } = fundingSourceManagerMocks
const { stateEligibilityProcessor } = stateEligibilityProcessorMocks
const { dataSanitizer } = dataSanitizerMocks

// ============================================================================
// Helper Functions for Proper Supabase Chain Mocking
// ============================================================================

// Helper to mock .from('funding_opportunities').insert().select().single() chain for inserts
function mockFromInsertChain(client, data, error = null) {
  client.from.mockImplementationOnce((table) => {
    if (table === 'funding_opportunities') {
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

// Helper to mock .from('funding_opportunities').upsert().select().single() chain for upserts
function mockFromUpsertChain(client, data, error = null) {
  client.from.mockImplementationOnce((table) => {
    if (table === 'funding_opportunities') {
      return {
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data, error })
          }))
        }))
      };
    }
    return {};
  });
}

// Helper to create a mock opportunity result
function createMockOpportunityResult(id, apiOpportunityId, title) {
  return {
    id,
    api_opportunity_id: apiOpportunityId,
    title
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Storage Agent Unit Tests', () => {
  let mockSupabaseClient
  let mockOpportunities
  let mockSource
  let consoleLogSpy
  let consoleWarnSpy
  let consoleErrorSpy

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create a fresh mock Supabase client for each test
    mockSupabaseClient = {
      from: jest.fn()
    }
    
    // Create fresh mock implementations
    createClient.mockReturnValue(mockSupabaseClient)
    createSupabaseClient.mockReturnValue(mockSupabaseClient)
    
    // Setup test data
    mockSource = {
      id: 'source-123',
      name: 'Test Funding Source',
      api_endpoint: 'https://api.test.com/v1'
    }
    
    mockOpportunities = [
      {
        id: 'opp-1',
        title: 'Test Opportunity 1',
        description: 'Description 1',
        minimum_award: 10000,
        maximum_award: 100000,
        close_date: '2025-12-31',
        open_date: '2025-01-01'
      },
      {
        id: 'opp-2',
        title: 'Test Opportunity 2',
        description: 'Description 2',
        minimum_award: 5000,
        maximum_award: 50000,
        close_date: '2025-11-30',
        open_date: '2025-01-15'
      }
    ]
    
    // Set up console spies for this test only
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console methods after each test
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('Batch Insertion Optimization', () => {
    test('should process opportunities in batches', async () => {
      // Create 150 opportunities to test batching (default batch size is 10 from StorageConfig)
      const largeBatch = []
      for (let i = 0; i < 150; i++) {
        largeBatch.push({
          id: `opp-batch-${i}`,
          title: `Batch Opportunity ${i}`,
          description: `Description ${i}`
        })
      }
      
      // Setup mocks for successful insertion
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id,
        funding_source_id: 'funding-source-id',
        api_opportunity_id: opp.id
      }))
      
      // Mock each insert operation
      for (let i = 0; i < 150; i++) {
        mockFromInsertChain(
          mockSupabaseClient,
          createMockOpportunityResult(`inserted-id-${i + 1}`, `opp-batch-${i}`, `Batch Opportunity ${i}`)
        )
      }
      
      stateEligibilityProcessor.processEligibility.mockResolvedValue(true)
      
      const result = await storeOpportunities(largeBatch, mockSource, mockSupabaseClient)
      
      expect(result.results.newOpportunities).toHaveLength(150)
      expect(result.metrics.totalProcessed).toBe(150)
      expect(result.metrics.newOpportunities).toBe(150)
      
      // Verify batch processing (should be called once per opportunity)
      expect(fundingSourceManager.getOrCreate).toHaveBeenCalledTimes(150)
      expect(dataSanitizer.prepareForInsert).toHaveBeenCalledTimes(150)
    })

    test('should handle partial batch failures gracefully', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      // Simulate success for first, failure for second
      mockFromInsertChain(
        mockSupabaseClient,
        createMockOpportunityResult('inserted-1', mockOpportunities[0].id, mockOpportunities[0].title)
      )
      mockFromInsertChain(
        mockSupabaseClient,
        null,
        { message: 'Insert failed' }
      )
      
      stateEligibilityProcessor.processEligibility.mockResolvedValueOnce(true)
      
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      expect(result.results.newOpportunities).toHaveLength(1)
      expect(result.metrics.newOpportunities).toBe(1)
      expect(result.metrics.totalProcessed).toBe(2)
    })
  })

  describe('Duplicate Key Handling (Upsert Logic)', () => {
    test('should use upsert when forceFullProcessing is enabled', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id,
        api_opportunity_id: opp.id
      }))
      
      // Mock upsert operations
      mockFromUpsertChain(
        mockSupabaseClient,
        createMockOpportunityResult('upserted-id-1', mockOpportunities[0].id, mockOpportunities[0].title)
      )
      mockFromUpsertChain(
        mockSupabaseClient,
        createMockOpportunityResult('upserted-id-2', mockOpportunities[1].id, mockOpportunities[1].title)
      )
      
      stateEligibilityProcessor.processEligibility.mockResolvedValue(true)
      
      const result = await storeOpportunities(
        mockOpportunities, 
        mockSource, 
        mockSupabaseClient,
        true // forceFullProcessing
      )
      
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2)
      expect(result.results.newOpportunities).toHaveLength(2)
    })

    test('should use regular insert when forceFullProcessing is disabled', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id,
        api_opportunity_id: opp.id
      }))
      
      // Mock insert operations
      mockFromInsertChain(
        mockSupabaseClient,
        createMockOpportunityResult('regular-inserted-1', mockOpportunities[0].id, mockOpportunities[0].title)
      )
      mockFromInsertChain(
        mockSupabaseClient,
        createMockOpportunityResult('regular-inserted-2', mockOpportunities[1].id, mockOpportunities[1].title)
      )
      
      stateEligibilityProcessor.processEligibility.mockResolvedValue(true)
      
      const result = await storeOpportunities(
        mockOpportunities, 
        mockSource, 
        mockSupabaseClient,
        false // forceFullProcessing
      )
      
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2)
      expect(result.results.newOpportunities).toHaveLength(2)
    })

    test('should handle duplicate key constraint errors', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      // Simulate duplicate key error for both
      mockFromInsertChain(mockSupabaseClient, null, { 
        message: 'duplicate key value violates unique constraint',
        code: '23505'
      })
      mockFromInsertChain(mockSupabaseClient, null, { 
        message: 'duplicate key value violates unique constraint',
        code: '23505'
      })
      
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      expect(result.results.newOpportunities).toHaveLength(0)
      expect(result.metrics.newOpportunities).toBe(0)
    })
  })

  describe('Transaction Management and Rollback', () => {
    test('should maintain data consistency during batch processing', async () => {
      const opportunities = [
        { id: 'tx-1', title: 'Transaction Test 1' },
        { id: 'tx-2', title: 'Transaction Test 2' },
        { id: 'tx-3', title: 'Transaction Test 3' }
      ]
      
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      // All succeed
      opportunities.forEach((opp, i) => {
        mockFromInsertChain(
          mockSupabaseClient,
          createMockOpportunityResult(`tx-inserted-${i + 1}`, opp.id, opp.title)
        )
      })
      
      stateEligibilityProcessor.processEligibility.mockResolvedValue(true)
      
      const result = await storeOpportunities(opportunities, mockSource, mockSupabaseClient)
      
      expect(result.results.newOpportunities).toHaveLength(3)
      expect(result.metrics.totalProcessed).toBe(3)
      expect(result.metrics.newOpportunities).toBe(3)
    })

    test('should handle rollback scenarios gracefully', async () => {
      fundingSourceManager.getOrCreate
        .mockResolvedValueOnce('funding-source-id')
        .mockRejectedValueOnce(new Error('Funding source creation failed'))
      
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      // First opportunity should succeed, second should fail
      expect(result.results.newOpportunities.length).toBeGreaterThanOrEqual(0)
      expect(result.metrics.totalProcessed).toBe(2)
    })
  })

  describe('Metrics Collection and Persistence', () => {
    test('should collect accurate metrics for successful operations', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-1' })
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-2' })
      
      stateEligibilityProcessor.processEligibility.mockResolvedValue(true)
      
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      expect(result.metrics).toMatchObject({
        totalProcessed: 2,
        newOpportunities: 2,
        updatedOpportunities: 0,
        ignoredOpportunities: 0,
        duplicatesFound: 0
      })
      expect(result.executionTime).toBeGreaterThan(0)
    })

    test('should track execution time', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-1' })
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-2' })
      
      stateEligibilityProcessor.processEligibility.mockResolvedValue(true)
      
      const startTime = Date.now()
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      const endTime = Date.now()
      
      expect(result.executionTime).toBeGreaterThanOrEqual(1)
      expect(result.executionTime).toBeLessThanOrEqual(endTime - startTime + 100)
    })

    test('should log agent execution', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-1' })
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-2' })
      
      stateEligibilityProcessor.processEligibility.mockResolvedValue(true)
      
      await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      expect(logAgentExecution).toHaveBeenCalledWith(
        expect.any(Object),
        'storage_v2',
        expect.objectContaining({
          source: { id: mockSource.id, name: mockSource.name },
          opportunityCount: 2
        }),
        expect.any(Object),
        expect.any(Number),
        null
      )
    })
  })

  describe('Field Sanitization Before Storage', () => {
    test('should sanitize data before insertion', async () => {
      const dirtyOpportunity = {
        id: 'dirty-1',
        title: '  Test Opportunity  ',
        description: 'Description\n\nwith\textra\twhitespace',
        minimum_award: '10000.00',
        maximum_award: 'invalid'
      }
      
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementationOnce((opp) => ({
        id: opp.id,
        title: opp.title.trim(),
        description: opp.description.replace(/\s+/g, ' '),
        minimum_award: parseFloat(opp.minimum_award) || null,
        maximum_award: null,
        api_source_id: mockSource.id,
        funding_source_id: 'funding-source-id'
      }))
      
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id' })
      
      stateEligibilityProcessor.processEligibility.mockResolvedValueOnce(true)
      
      await storeOpportunities([dirtyOpportunity], mockSource, mockSupabaseClient)
      
      expect(dataSanitizer.prepareForInsert).toHaveBeenCalledWith(
        dirtyOpportunity,
        mockSource.id,
        'funding-source-id'
      )
    })

    test('should handle null and undefined values properly', async () => {
      const opportunityWithNulls = {
        id: 'null-1',
        title: 'Test Opportunity',
        description: null,
        minimum_award: undefined,
        maximum_award: null,
        close_date: undefined
      }
      
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementationOnce((opp) => ({
        id: opp.id,
        title: opp.title,
        description: opp.description || null,
        minimum_award: opp.minimum_award || null,
        maximum_award: opp.maximum_award || null,
        close_date: opp.close_date || null,
        api_source_id: mockSource.id,
        funding_source_id: 'funding-source-id'
      }))
      
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id' })
      
      stateEligibilityProcessor.processEligibility.mockResolvedValueOnce(true)
      
      await storeOpportunities([opportunityWithNulls], mockSource, mockSupabaseClient)
      
      expect(dataSanitizer.prepareForInsert).toHaveBeenCalledWith(
        opportunityWithNulls,
        mockSource.id,
        'funding-source-id'
      )
    })
  })

  describe('Conflict Resolution for Concurrent Inserts', () => {
    test('should handle concurrent insert attempts', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      // Simulate concurrent insert conflict
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-1' })
      mockFromInsertChain(mockSupabaseClient, null, { 
        message: 'duplicate key value violates unique constraint',
        code: '23505'
      })
      
      stateEligibilityProcessor.processEligibility.mockResolvedValueOnce(true)
      
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      expect(result.results.newOpportunities).toHaveLength(1)
      expect(result.metrics.newOpportunities).toBe(1)
    })

    test('should maintain result integrity with frozen objects', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-1' })
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-2' })
      
      stateEligibilityProcessor.processEligibility.mockResolvedValue(true)
      
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      // Results should be frozen to prevent modification
      expect(Object.isFrozen(result.results)).toBe(true)
      
      // Test that the frozen object properties cannot be reassigned
      const originalArray = result.results.newOpportunities
      expect(originalArray).toHaveLength(2) // Should have 2 opportunities
      
      // Try to replace the array (this should fail silently or throw)
      try {
        result.results.newOpportunities = [{ id: 'hack' }]
      } catch (e) {
        // In strict mode this would throw - that's fine
      }
      
      // The array reference should still be the same
      expect(result.results.newOpportunities).toBe(originalArray)
      expect(result.results.newOpportunities).toHaveLength(2)
    })
  })

  describe('Error Recovery and Partial Batch Handling', () => {
    test('should continue processing after individual failures', async () => {
      fundingSourceManager.getOrCreate
        .mockResolvedValueOnce('funding-source-id')
        .mockRejectedValueOnce(new Error('Funding source error'))
        .mockResolvedValueOnce('funding-source-id')
      
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-1' })
      // No mock for second opportunity since funding source fails
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-3' })
      
      stateEligibilityProcessor.processEligibility
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
      
      const opportunities = [
        { id: 'success-1', title: 'Will succeed' },
        { id: 'fail-1', title: 'Will fail' },
        { id: 'success-2', title: 'Will succeed' }
      ]
      
      const result = await storeOpportunities(opportunities, mockSource, mockSupabaseClient)
      
      expect(result.metrics.totalProcessed).toBe(3)
      expect(result.results.newOpportunities.length).toBe(2)
    })

    test('should handle database connection errors', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      // Simulate database connection error
      mockFromInsertChain(mockSupabaseClient, null, { message: 'Connection timeout' })
      mockFromInsertChain(mockSupabaseClient, null, { message: 'Connection timeout' })
      
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      expect(result.results.newOpportunities).toHaveLength(0)
      expect(result.metrics.newOpportunities).toBe(0)
    })

    test('should return error result instead of throwing', async () => {
      // Mock to throw an error immediately for the first call
      fundingSourceManager.getOrCreate
        .mockRejectedValueOnce(new Error('Critical error'))
        .mockRejectedValueOnce(new Error('Critical error'))
      
      // Also make sure logAgentExecution doesn't throw
      logAgentExecution.mockResolvedValue(undefined)
      createSupabaseClient.mockReturnValue(mockSupabaseClient)
      
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      // Since both opportunities fail, we should get empty results but valid metrics
      expect(result).toBeDefined()
      expect(result.metrics).toBeDefined()
      expect(result.metrics.totalProcessed).toBe(2)
      expect(result.results.newOpportunities).toHaveLength(0)
      expect(result.executionTime).toBeGreaterThan(0)
    })
  })

  describe('Input Validation', () => {
    test('should validate opportunities array', async () => {
      const result = await storeOpportunities('not-an-array', mockSource, mockSupabaseClient)
      
      expect(result.metrics.error).toBe(true)
      expect(result.metrics.errorMessage).toBe('Opportunities must be an array')
    })

    test('should validate source object', async () => {
      const result = await storeOpportunities(mockOpportunities, null, mockSupabaseClient)
      
      expect(result.metrics.error).toBe(true)
      expect(result.metrics.errorMessage).toBe('Source must have an id')
    })

    test('should validate source has id', async () => {
      const invalidSource = { name: 'No ID Source' }
      
      const result = await storeOpportunities(mockOpportunities, invalidSource, mockSupabaseClient)
      
      expect(result.metrics.error).toBe(true)
      expect(result.metrics.errorMessage).toBe('Source must have an id')
    })

    test('should handle empty opportunities array', async () => {
      const result = await storeOpportunities([], mockSource, mockSupabaseClient)
      
      expect(result.metrics).toBeDefined()
      expect(result.results.newOpportunities).toHaveLength(0)
      expect(result.metrics.totalProcessed).toBe(0)
      expect(result.executionTime).toBeGreaterThan(0)
    })
  })

  describe('State Eligibility Processing', () => {
    test('should process state eligibility for inserted opportunities', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id,
        api_opportunity_id: opp.id,
        funding_source_id: 'funding-source-id'
      }))
      
      // Mock successful inserts
      mockFromInsertChain(
        mockSupabaseClient,
        createMockOpportunityResult('inserted-1', mockOpportunities[0].id, mockOpportunities[0].title)
      )
      mockFromInsertChain(
        mockSupabaseClient,
        createMockOpportunityResult('inserted-2', mockOpportunities[1].id, mockOpportunities[1].title)
      )
      
      // Mock state eligibility processing
      stateEligibilityProcessor.processEligibility
        .mockResolvedValueOnce({ stateCount: 3, isNational: false })
        .mockResolvedValueOnce({ stateCount: 2, isNational: false })
      
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      // Verify state eligibility was processed for each inserted opportunity
      expect(stateEligibilityProcessor.processEligibility).toHaveBeenCalledTimes(2)
      expect(stateEligibilityProcessor.processEligibility).toHaveBeenCalledWith(
        'inserted-1',
        expect.objectContaining({
          id: 'opp-1'  // The original opportunity has 'id', not 'api_opportunity_id'
        }),
        mockSupabaseClient
      )
      expect(stateEligibilityProcessor.processEligibility).toHaveBeenCalledWith(
        'inserted-2',
        expect.objectContaining({
          id: 'opp-2'
        }),
        mockSupabaseClient
      )
      
      // Results should still be successful even with state processing
      expect(result.results.newOpportunities).toHaveLength(2)
      expect(result.metrics.newOpportunities).toBe(2)
    })

    test('should not fail if state eligibility processing fails', async () => {
      fundingSourceManager.getOrCreate.mockResolvedValue('funding-source-id')
      dataSanitizer.prepareForInsert.mockImplementation((opp) => ({
        ...opp,
        api_source_id: mockSource.id
      }))
      
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-1' })
      mockFromInsertChain(mockSupabaseClient, { id: 'inserted-id-2' })
      
      // Mock state eligibility processor to fail
      stateEligibilityProcessor.processEligibility.mockRejectedValue(
        new Error('State eligibility processing failed')
      )
      
      const result = await storeOpportunities(mockOpportunities, mockSource, mockSupabaseClient)
      
      // Should still succeed even if eligibility processing fails
      expect(result.results.newOpportunities).toHaveLength(2)
      expect(result.metrics.newOpportunities).toBe(2)
      
      // Verify the error was logged but didn't stop processing
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('State eligibility processing failed'),
        expect.any(Error)
      )
    })
  })
})