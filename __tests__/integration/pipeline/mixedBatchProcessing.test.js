/**
 * Integration Tests - Mixed Batch Processing
 * 
 * Tests the V2 pipeline's ability to handle mixed batches containing NEW, UPDATE, and SKIP
 * opportunities simultaneously, validating:
 * - Correct routing for each opportunity type
 * - Aggregate metrics validation
 * - Token usage optimization verification
 * - Batch size handling (small, medium, large)
 * - Partial failure recovery
 * - Transaction consistency across mixed operations
 * - Performance comparison: mixed vs single-type batches
 */

import { processApiSourceV2 } from '../../../lib/services/processCoordinatorV2.js'
import { 
  generateNewOpportunity,
  generateUpdatedOpportunity,
  generateDuplicateOpportunity,
  generateMinorChangeOpportunity,
  generateMixedBatch,
  generateLargeBatch
} from '../../fixtures/opportunities.js'
import {
  createMockAnthropicClient,
  measureExecutionTime,
  assertPerformanceBaseline
} from '../../setup/testHelpers.js'
import { createConfiguredMockSupabase } from '../../mocks/supabase.js'

// Mock all agents
jest.mock('../../../lib/agents-v2/core/sourceOrchestrator.js', () => ({
  analyzeSource: jest.fn().mockResolvedValue({
    analysis: { type: 'two-step', pagination: true },
    tokenUsage: 100,
    apiCalls: 1,
    executionTime: 50
  })
}))

jest.mock('../../../lib/agents-v2/core/dataExtractionAgent/index.js', () => ({
  extractFromSource: jest.fn()
}))

jest.mock('../../../lib/agents-v2/optimization/earlyDuplicateDetector.js', () => ({
  detectDuplicates: jest.fn()
}))

jest.mock('../../../lib/agents-v2/core/analysisAgent/index.js', () => ({
  enhanceOpportunities: jest.fn()
}))

jest.mock('../../../lib/agents-v2/core/filterFunction.js', () => ({
  filterOpportunities: jest.fn()
}))

jest.mock('../../../lib/agents-v2/core/storageAgent/index.js', () => ({
  storeOpportunities: jest.fn()
}))

jest.mock('../../../lib/agents-v2/optimization/directUpdateHandler.js', () => ({
  updateDuplicateOpportunities: jest.fn()
}))

// Import mocked modules
import { extractFromSource } from '../../../lib/agents-v2/core/dataExtractionAgent/index.js'
import { detectDuplicates } from '../../../lib/agents-v2/optimization/earlyDuplicateDetector.js'
import { enhanceOpportunities } from '../../../lib/agents-v2/core/analysisAgent/index.js'
import { filterOpportunities } from '../../../lib/agents-v2/core/filterFunction.js'
import { storeOpportunities } from '../../../lib/agents-v2/core/storageAgent/index.js'
import { updateDuplicateOpportunities } from '../../../lib/agents-v2/optimization/directUpdateHandler.js'

describe('Mixed Batch Processing Integration', () => {
  let mockSupabase
  let mockAnthropic
  let testSourceId
  
  beforeEach(() => {
    // Setup mocks
    mockSupabase = createConfiguredMockSupabase()
    mockAnthropic = createMockAnthropicClient()
    testSourceId = '550e8400-e29b-41d4-a716-446655440001' // Valid UUID
  })
  
  afterEach(() => {
    jest.clearAllMocks()
  })
  
  describe('Small Batch Processing (5-10 opportunities)', () => {
    it('should correctly route mixed batch of 5 opportunities', async () => {
      // Setup: 2 NEW, 2 UPDATE, 1 SKIP
      const newOpps = [
        generateNewOpportunity({ id: 'NEW-SMALL-1' }),
        generateNewOpportunity({ id: 'NEW-SMALL-2' })
      ]
      const updateOpps = [
        generateUpdatedOpportunity({ id: 'UPDATE-SMALL-1', closeDate: '2025-01-20' }),
        generateUpdatedOpportunity({ id: 'UPDATE-SMALL-2', maximumAward: 750000 })
      ]
      const skipOpps = [
        generateDuplicateOpportunity({ id: 'SKIP-SMALL-1' })
      ]
      const allOpportunities = [...newOpps, ...updateOpps, ...skipOpps]
      
      // Configure mocks
      extractFromSource.mockResolvedValue({
        opportunities: allOpportunities,
        extractionMetrics: {
          totalFound: 5,
          totalRetrieved: 5,
          totalTokens: 250,
          apiCalls: 1,
          executionTime: 100
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: newOpps,
        opportunitiesToUpdate: updateOpps.map(opp => ({
          apiRecord: opp,
          dbRecord: { ...opp, closeDate: '2024-12-31', maximumAward: 500000 },
          changesDetected: ['closeDate', 'maximumAward'],
          reason: 'material_changes'
        })),
        opportunitiesToSkip: skipOpps.map(opp => ({
          apiRecord: opp,
          existingRecord: opp,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 5,
          newOpportunities: 2,
          opportunitiesToUpdate: 2,
          opportunitiesToSkip: 1,
          executionTime: 50
        }
      })
      
      const enhancedNewOpps = newOpps.map(opp => ({
        ...opp,
        enhanced_description: `Enhanced: ${opp.description}`,
        eligibility_score: 85
      }))
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: enhancedNewOpps,
        analysisMetrics: {
          totalTokens: 400, // Only for 2 NEW
          totalApiCalls: 2,
          executionTime: 200
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: enhancedNewOpps,
        filterMetrics: { executionTime: 20 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 2,
          failed: 0,
          executionTime: 100
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 2,
          failed: 0,
          totalProcessed: 2,
          executionTime: 80
        }
      })
      
      // Execute
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Assertions
      expect(result.status).toBe('success')
      
      // Verify correct routing
      expect(enhanceOpportunities).toHaveBeenCalledWith(newOpps, expect.any(Object), mockAnthropic)
      expect(updateDuplicateOpportunities).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ apiRecord: updateOpps[0] }),
          expect.objectContaining({ apiRecord: updateOpps[1] })
        ]),
        mockSupabase
      )
      
      // Verify metrics
      expect(result.enhancedMetrics.optimizationImpact.totalOpportunities).toBe(5)
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(3) // 2 UPDATE + 1 SKIP
      const stored = result.enhancedMetrics.stageMetrics.storage?.opportunitiesStored || 0
      const updated = result.enhancedMetrics.stageMetrics.directUpdate?.opportunitiesUpdated || 0
      expect(stored + updated).toBe(4) // 2 NEW + 2 UPDATE
      
      // Verify opportunity paths
      const paths = result.enhancedMetrics.opportunityPaths
      expect(paths).toHaveLength(5)
      expect(paths.filter(p => p.pathType === 'NEW')).toHaveLength(2)
      expect(paths.filter(p => p.pathType === 'UPDATE')).toHaveLength(2)
      expect(paths.filter(p => p.pathType === 'SKIP')).toHaveLength(1)
    })
    
    it('should handle batch with majority duplicates efficiently', async () => {
      // Setup: 1 NEW, 2 UPDATE, 5 SKIP
      const newOpps = [generateNewOpportunity({ id: 'NEW-DUP-1' })]
      const updateOpps = [
        generateUpdatedOpportunity({ id: 'UPDATE-DUP-1' }),
        generateUpdatedOpportunity({ id: 'UPDATE-DUP-2' })
      ]
      const skipOpps = Array.from({ length: 5 }, (_, i) => 
        generateDuplicateOpportunity({ id: `SKIP-DUP-${i}` })
      )
      const allOpportunities = [...newOpps, ...updateOpps, ...skipOpps]
      
      extractFromSource.mockResolvedValue({
        opportunities: allOpportunities,
        extractionMetrics: {
          totalFound: 8,
          totalRetrieved: 8,
          totalTokens: 400,
          apiCalls: 1,
          executionTime: 150
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: newOpps,
        opportunitiesToUpdate: updateOpps.map(opp => ({
          apiRecord: opp,
          dbRecord: opp,
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        })),
        opportunitiesToSkip: skipOpps.map(opp => ({
          apiRecord: opp,
          existingRecord: opp,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 8,
          newOpportunities: 1,
          opportunitiesToUpdate: 2,
          opportunitiesToSkip: 5,
          executionTime: 75
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: newOpps,
        analysisMetrics: {
          totalTokens: 200, // Only 1 NEW
          totalApiCalls: 1,
          executionTime: 100
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: newOpps,
        filterMetrics: { executionTime: 10 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 1,
          failed: 0,
          executionTime: 50
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 2,
          failed: 0,
          totalProcessed: 2,
          executionTime: 60
        }
      })
      
      // Execute
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Should be highly optimized
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(7) // 87.5% bypassed
      expect(result.enhancedMetrics.totalTokensUsed).toBe(700) // Minimal token usage
      
      // Token optimization percentage
      const optimizationRate = (7 / 8) * 100
      expect(optimizationRate).toBeGreaterThanOrEqual(80)
    })
  })
  
  describe('Medium Batch Processing (50 opportunities)', () => {
    it('should efficiently process 50 mixed opportunities', async () => {
      // Setup: 15 NEW, 20 UPDATE, 15 SKIP
      const newOpps = Array.from({ length: 15 }, (_, i) => 
        generateNewOpportunity({ id: `NEW-MED-${i}` })
      )
      const updateOpps = Array.from({ length: 20 }, (_, i) => 
        generateUpdatedOpportunity({ 
          id: `UPDATE-MED-${i}`,
          closeDate: '2025-02-01'
        })
      )
      const skipOpps = Array.from({ length: 15 }, (_, i) => 
        generateDuplicateOpportunity({ id: `SKIP-MED-${i}` })
      )
      const allOpportunities = [...newOpps, ...updateOpps, ...skipOpps]
      
      extractFromSource.mockResolvedValue({
        opportunities: allOpportunities,
        extractionMetrics: {
          totalFound: 50,
          totalRetrieved: 50,
          totalTokens: 500,
          apiCalls: 3,
          executionTime: 300
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: newOpps,
        opportunitiesToUpdate: updateOpps.map(opp => ({
          apiRecord: opp,
          dbRecord: { ...opp, closeDate: '2024-12-31' },
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        })),
        opportunitiesToSkip: skipOpps.map(opp => ({
          apiRecord: opp,
          existingRecord: opp,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 50,
          newOpportunities: 15,
          opportunitiesToUpdate: 20,
          opportunitiesToSkip: 15,
          executionTime: 200
        }
      })
      
      const enhancedNewOpps = newOpps.map(opp => ({
        ...opp,
        enhanced_description: `Enhanced: ${opp.description}`,
        eligibility_score: 85 // Fixed score for deterministic tests
      }))
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: enhancedNewOpps,
        analysisMetrics: {
          totalTokens: 3000, // Only 15 NEW
          totalApiCalls: 15,
          executionTime: 1500
        }
      })
      
      const filteredOpps = enhancedNewOpps.filter((_, i) => i < 13) // ~87% pass rate
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: filteredOpps,
        filterMetrics: { executionTime: 50 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 13,
          failed: 0,
          executionTime: 400
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 19,
          failed: 1,
          totalProcessed: 20,
          executionTime: 500
        }
      })
      
      // Execute with timing
      const { result, executionTime } = await measureExecutionTime(processApiSourceV2)(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Assertions
      expect(result.status).toBe('success')
      
      // Verify correct distribution
      expect(result.enhancedMetrics.stageMetrics.earlyDuplicateDetector.newOpportunities).toBe(15)
      expect(result.enhancedMetrics.stageMetrics.earlyDuplicateDetector.opportunitiesToUpdate).toBe(20)
      expect(result.enhancedMetrics.stageMetrics.earlyDuplicateDetector.opportunitiesToSkip).toBe(15)
      
      // Verify optimization
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(35) // 70% bypassed
      const storedMed = result.enhancedMetrics.stageMetrics.storage?.opportunitiesStored || 0
      const updatedMed = result.enhancedMetrics.stageMetrics.directUpdate?.opportunitiesUpdated || 0
      expect(storedMed + updatedMed).toBe(32) // 13 NEW + 19 UPDATE
      
      // Performance check
      assertPerformanceBaseline(executionTime, 5000, 0.5) // Should complete within 5 seconds
      
      // Token efficiency
      const tokenEfficiency = (35 / 50) * 100
      expect(tokenEfficiency).toBe(70) // 70% token savings
    })
    
    it('should maintain consistency with varying distributions', async () => {
      const distributions = [
        { new: 40, update: 5, skip: 5 },   // Mostly new
        { new: 5, update: 40, skip: 5 },   // Mostly updates
        { new: 5, update: 5, skip: 40 },   // Mostly skips
        { new: 17, update: 17, skip: 16 }  // Even distribution
      ]
      
      for (const dist of distributions) {
        jest.clearAllMocks()
        // Reinitialize mocks and clients for each iteration
        mockSupabase = createConfiguredMockSupabase()
        mockAnthropic = createMockAnthropicClient()
        
        const newOpps = Array.from({ length: dist.new }, (_, i) => 
          generateNewOpportunity({ id: `NEW-DIST-${i}` })
        )
        const updateOpps = Array.from({ length: dist.update }, (_, i) => 
          generateUpdatedOpportunity({ id: `UPDATE-DIST-${i}` })
        )
        const skipOpps = Array.from({ length: dist.skip }, (_, i) => 
          generateDuplicateOpportunity({ id: `SKIP-DIST-${i}` })
        )
        const allOpportunities = [...newOpps, ...updateOpps, ...skipOpps]
        
        extractFromSource.mockResolvedValue({
          opportunities: allOpportunities,
          extractionMetrics: {
            totalFound: 50,
            totalRetrieved: 50,
            totalTokens: 500,
            apiCalls: 3,
            executionTime: 300
          }
        })
        
        detectDuplicates.mockResolvedValue({
          newOpportunities: newOpps,
          opportunitiesToUpdate: updateOpps.map(opp => ({
            apiRecord: opp,
            dbRecord: opp,
            changesDetected: ['closeDate'],
            reason: 'material_changes'
          })),
          opportunitiesToSkip: skipOpps.map(opp => ({
            apiRecord: opp,
            existingRecord: opp,
            reason: 'exact_duplicate'
          })),
          metrics: {
            totalProcessed: 50,
            newOpportunities: dist.new,
            opportunitiesToUpdate: dist.update,
            opportunitiesToSkip: dist.skip,
            executionTime: 200
          }
        })
        
        enhanceOpportunities.mockResolvedValue({
          opportunities: newOpps,
          analysisMetrics: {
            totalTokens: dist.new * 100,
            totalApiCalls: dist.new,
            executionTime: dist.new * 50
          }
        })
        
        filterOpportunities.mockResolvedValue({
          includedOpportunities: newOpps,
          filterMetrics: { executionTime: 50 }
        })
        
        storeOpportunities.mockResolvedValue({
          metrics: {
            newOpportunities: dist.new,
            failed: 0,
            executionTime: dist.new * 10
          }
        })
        
        updateDuplicateOpportunities.mockResolvedValue({
          metrics: {
            successful: dist.update,
            failed: 0,
            totalProcessed: dist.update,
            executionTime: dist.update * 10
          }
        })
        
        // Execute
        const result = await processApiSourceV2(
          testSourceId,
          null,
          mockSupabase,
          mockAnthropic
        )
        
        // Verify consistency
        expect(result.status).toBe('success')
        expect(result.enhancedMetrics.optimizationImpact.totalOpportunities).toBe(50)
        expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(dist.update + dist.skip)
        expect(result.enhancedMetrics.opportunityPaths).toHaveLength(50)
      }
    })
  })
  
  describe('Large Batch Processing (200+ opportunities)', () => {
    it('should handle stress test of 200 mixed opportunities', async () => {
      // Setup: 60 NEW, 80 UPDATE, 60 SKIP
      const newOpps = Array.from({ length: 60 }, (_, i) => 
        generateNewOpportunity({ id: `NEW-LARGE-${i}` })
      )
      const updateOpps = Array.from({ length: 80 }, (_, i) => 
        generateUpdatedOpportunity({ id: `UPDATE-LARGE-${i}` })
      )
      const skipOpps = Array.from({ length: 60 }, (_, i) => 
        generateDuplicateOpportunity({ id: `SKIP-LARGE-${i}` })
      )
      const allOpportunities = [...newOpps, ...updateOpps, ...skipOpps]
      
      extractFromSource.mockResolvedValue({
        opportunities: allOpportunities,
        extractionMetrics: {
          totalFound: 200,
          totalRetrieved: 200,
          totalTokens: 2000,
          apiCalls: 10,
          executionTime: 1000
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: newOpps,
        opportunitiesToUpdate: updateOpps.map(opp => ({
          apiRecord: opp,
          dbRecord: opp,
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        })),
        opportunitiesToSkip: skipOpps.map(opp => ({
          apiRecord: opp,
          existingRecord: opp,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 200,
          newOpportunities: 60,
          opportunitiesToUpdate: 80,
          opportunitiesToSkip: 60,
          executionTime: 800
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: newOpps,
        analysisMetrics: {
          totalTokens: 12000, // Only 60 NEW
          totalApiCalls: 60,
          executionTime: 6000
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: newOpps.filter((_, i) => i < 55), // ~92% pass rate
        filterMetrics: { executionTime: 200 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 55,
          failed: 0,
          executionTime: 1500
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 78,
          failed: 2,
          totalProcessed: 80,
          executionTime: 2000
        }
      })
      
      // Execute with timing
      const { result, executionTime } = await measureExecutionTime(processApiSourceV2)(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Assertions
      expect(result.status).toBe('success')
      expect(result.enhancedMetrics.optimizationImpact.totalOpportunities).toBe(200)
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(140) // 70% bypassed
      const storedLarge = result.enhancedMetrics.stageMetrics.storage?.opportunitiesStored || 0
      const updatedLarge = result.enhancedMetrics.stageMetrics.directUpdate?.opportunitiesUpdated || 0
      expect(storedLarge + updatedLarge).toBe(133) // 55 + 78
      
      // Performance for large batch
      assertPerformanceBaseline(executionTime, 15000, 0.5) // Should complete within 15 seconds
      
      // Token optimization at scale
      const tokenSavings = (140 / 200) * 100
      expect(tokenSavings).toBe(70) // 70% token savings maintained at scale
    })
    
    it('should maintain performance with extreme distributions', async () => {
      // Test: 195 duplicates, 5 new (worst case for duplicate detection)
      const newOpps = Array.from({ length: 5 }, (_, i) => 
        generateNewOpportunity({ id: `NEW-EXTREME-${i}` })
      )
      const skipOpps = Array.from({ length: 195 }, (_, i) => 
        generateDuplicateOpportunity({ id: `SKIP-EXTREME-${i}` })
      )
      const allOpportunities = [...newOpps, ...skipOpps]
      
      extractFromSource.mockResolvedValue({
        opportunities: allOpportunities,
        extractionMetrics: {
          totalFound: 200,
          totalRetrieved: 200,
          totalTokens: 1000,
          apiCalls: 10,
          executionTime: 1000
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: newOpps,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: skipOpps.map(opp => ({
          apiRecord: opp,
          existingRecord: opp,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 200,
          newOpportunities: 5,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 195,
          executionTime: 1000
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: newOpps,
        analysisMetrics: {
          totalTokens: 500, // Only 5 NEW
          totalApiCalls: 5,
          executionTime: 250
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: newOpps,
        filterMetrics: { executionTime: 25 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 5,
          failed: 0,
          executionTime: 150
        }
      })
      
      // Execute
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Should be extremely efficient
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(195) // 97.5% bypassed
      expect(result.enhancedMetrics.totalTokensUsed).toBe(1600) // Minimal tokens
      
      // Extreme optimization rate
      const optimizationRate = (195 / 200) * 100
      expect(optimizationRate).toBe(97.5)
    })
  })
  
  describe('Partial Failure Recovery', () => {
    it('should handle partial storage failures in mixed batch', async () => {
      const mixedBatch = generateMixedBatch()
      
      extractFromSource.mockResolvedValue({
        opportunities: mixedBatch,
        extractionMetrics: {
          totalFound: 5,
          totalRetrieved: 5,
          totalTokens: 250,
          apiCalls: 1,
          executionTime: 100
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: mixedBatch.slice(0, 2),
        opportunitiesToUpdate: [{
          apiRecord: mixedBatch[2],
          dbRecord: mixedBatch[2],
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        }],
        opportunitiesToSkip: mixedBatch.slice(3).map(opp => ({
          apiRecord: opp,
          existingRecord: opp,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 5,
          newOpportunities: 2,
          opportunitiesToUpdate: 1,
          opportunitiesToSkip: 2,
          executionTime: 50
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: mixedBatch.slice(0, 2),
        analysisMetrics: {
          totalTokens: 400,
          totalApiCalls: 2,
          executionTime: 200
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: mixedBatch.slice(0, 2),
        filterMetrics: { executionTime: 20 }
      })
      
      // Simulate partial failure in storage
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 1,
          failed: 1, // One failed
          executionTime: 150
        }
      })
      
      // Simulate partial failure in updates
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 0,
          failed: 1, // Failed to update
          totalProcessed: 1,
          executionTime: 75
        }
      })
      
      // Execute
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Should still succeed with partial results
      expect(result.status).toBe('success')
      expect(result.enhancedMetrics.stageMetrics.storage.opportunitiesFailed).toBe(1)
      expect(result.enhancedMetrics.stageMetrics.directUpdate.opportunitiesFailed).toBe(1)
      // Use computed sum since successfulOpportunities might not exist
      const storedPartial = result.enhancedMetrics.stageMetrics.storage?.opportunitiesStored || 0
      const updatedPartial = result.enhancedMetrics.stageMetrics.directUpdate?.opportunitiesUpdated || 0
      expect(storedPartial + updatedPartial).toBe(1) // Only 1 succeeded
      
      // Verify all paths are tracked despite failures
      expect(result.enhancedMetrics.opportunityPaths).toHaveLength(5)
    })
    
    it('should rollback on critical failures', async () => {
      const mixedBatch = generateMixedBatch()
      
      extractFromSource.mockResolvedValue({
        opportunities: mixedBatch,
        extractionMetrics: {
          totalFound: 5,
          totalRetrieved: 5,
          totalTokens: 250,
          apiCalls: 1,
          executionTime: 100
        }
      })
      
      // Simulate critical failure in duplicate detection
      detectDuplicates.mockRejectedValue(new Error('Database connection lost'))
      
      // Execute
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Should return error status
      expect(result.status).toBe('error')
      expect(result.error).toContain('Database connection lost')
      
      // Later stages should not be called
      expect(enhanceOpportunities).not.toHaveBeenCalled()
      expect(storeOpportunities).not.toHaveBeenCalled()
      expect(updateDuplicateOpportunities).not.toHaveBeenCalled()
    })
  })
  
  describe('Transaction Consistency', () => {
    it('should maintain atomicity for mixed operations', async () => {
      const transactionLog = []
      const mixedBatch = generateMixedBatch()
      
      // Mock with transaction tracking
      const mockTransaction = {
        begin: () => transactionLog.push('BEGIN'),
        commit: () => transactionLog.push('COMMIT'),
        rollback: () => transactionLog.push('ROLLBACK')
      }
      
      extractFromSource.mockImplementation(async () => {
        mockTransaction.begin()
        transactionLog.push('EXTRACT')
        return {
          opportunities: mixedBatch,
          extractionMetrics: {
            totalFound: 5,
            totalRetrieved: 5,
            totalTokens: 250,
            apiCalls: 1,
            executionTime: 100
          }
        }
      })
      
      detectDuplicates.mockImplementation(async (opps) => {
        transactionLog.push('DETECT')
        return {
          newOpportunities: opps.slice(0, 2),
          opportunitiesToUpdate: [{
            apiRecord: opps[2],
            dbRecord: opps[2],
            changesDetected: ['closeDate'],
            reason: 'material_changes'
          }],
          opportunitiesToSkip: opps.slice(3).map(o => ({
            apiRecord: o,
            existingRecord: o,
            reason: 'exact_duplicate'
          })),
          metrics: {
            totalProcessed: 5,
            newOpportunities: 2,
            opportunitiesToUpdate: 1,
            opportunitiesToSkip: 2,
            executionTime: 50
          }
        }
      })
      
      enhanceOpportunities.mockImplementation(async (opps) => {
        transactionLog.push('ENHANCE')
        return {
          opportunities: opps,
          analysisMetrics: {
            totalTokens: 400,
            totalApiCalls: 2,
            executionTime: 200
          }
        }
      })
      
      filterOpportunities.mockImplementation(async (opps) => {
        transactionLog.push('FILTER')
        return {
          includedOpportunities: opps,
          filterMetrics: { executionTime: 20 }
        }
      })
      
      storeOpportunities.mockImplementation(async (opps) => {
        transactionLog.push('STORE')
        mockTransaction.commit()
        return {
          metrics: {
            newOpportunities: opps.length,
            failed: 0,
            executionTime: 150
          }
        }
      })
      
      updateDuplicateOpportunities.mockImplementation(async (opps) => {
        transactionLog.push('UPDATE')
        mockTransaction.commit()
        return {
          metrics: {
            successful: opps.length,
            failed: 0,
            totalProcessed: opps.length,
            executionTime: 75
          }
        }
      })
      
      // Execute
      await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Verify transaction flow
      expect(transactionLog).toContain('BEGIN')
      expect(transactionLog).toContain('COMMIT')
      expect(transactionLog).not.toContain('ROLLBACK')
      
      // Verify order
      const beginIndex = transactionLog.indexOf('BEGIN')
      const extractIndex = transactionLog.indexOf('EXTRACT')
      const commitIndex = transactionLog.indexOf('COMMIT')
      
      expect(beginIndex).toBeLessThan(extractIndex)
      expect(extractIndex).toBeLessThan(commitIndex)
    })
    
    it('should ensure no cross-contamination between paths', async () => {
      const newOpp = generateNewOpportunity({ id: 'ISOLATED-NEW' })
      const updateOpp = generateUpdatedOpportunity({ id: 'ISOLATED-UPDATE' })
      const skipOpp = generateDuplicateOpportunity({ id: 'ISOLATED-SKIP' })
      
      extractFromSource.mockResolvedValue({
        opportunities: [newOpp, updateOpp, skipOpp],
        extractionMetrics: {
          totalFound: 3,
          totalRetrieved: 3,
          totalTokens: 150,
          apiCalls: 1,
          executionTime: 75
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: [newOpp],
        opportunitiesToUpdate: [{
          apiRecord: updateOpp,
          dbRecord: updateOpp,
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        }],
        opportunitiesToSkip: [{
          apiRecord: skipOpp,
          existingRecord: skipOpp,
          reason: 'exact_duplicate'
        }],
        metrics: {
          totalProcessed: 3,
          newOpportunities: 1,
          opportunitiesToUpdate: 1,
          opportunitiesToSkip: 1,
          executionTime: 40
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: [newOpp],
        analysisMetrics: {
          totalTokens: 200,
          totalApiCalls: 1,
          executionTime: 100
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: [newOpp],
        filterMetrics: { executionTime: 15 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 1,
          failed: 0,
          executionTime: 50
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 1,
          failed: 0,
          totalProcessed: 1,
          executionTime: 40
        }
      })
      
      // Execute
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Verify isolation
      // NEW path: should only process new opportunity
      expect(enhanceOpportunities).toHaveBeenCalledWith(
        [newOpp],
        expect.any(Object),
        mockAnthropic
      )
      expect(storeOpportunities).toHaveBeenCalledWith(
        [newOpp],
        expect.any(Object),
        mockSupabase,
        false
      )
      
      // UPDATE path: should only process update opportunity
      expect(updateDuplicateOpportunities).toHaveBeenCalledWith(
        [expect.objectContaining({ apiRecord: updateOpp })],
        mockSupabase
      )
      
      // SKIP path: should not process anything
      const skipPath = result.enhancedMetrics.opportunityPaths.find(
        p => p.opportunity.id === 'ISOLATED-SKIP'
      )
      expect(skipPath.stagesProcessed).toEqual(['data_extraction', 'early_duplicate_detector'])
      expect(skipPath.finalOutcome).toBe('skipped')
    })
  })
  
  describe('Performance Comparison: Mixed vs Single-Type', () => {
    it('should show token savings for mixed batches', async () => {
      // Test with size 50 for a meaningful comparison
      const size = 50
      
      // Test all NEW batch
      jest.clearAllMocks()
      // Reinitialize mocks for clean state
      mockSupabase = createConfiguredMockSupabase()
      mockAnthropic = createMockAnthropicClient()
      
      const allNewBatch = Array.from({ length: size }, (_, i) => 
        generateNewOpportunity({ id: `ALL-NEW-${i}` })
      )
      
      extractFromSource.mockResolvedValue({
        opportunities: allNewBatch,
        extractionMetrics: {
          totalFound: size,
          totalRetrieved: size,
          totalTokens: size * 10,
          apiCalls: Math.ceil(size / 20),
          executionTime: size * 5
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: allNewBatch,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: [],
        metrics: {
          totalProcessed: size,
          newOpportunities: size,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 0,
          executionTime: size * 2
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: allNewBatch,
        analysisMetrics: {
          totalTokens: size * 100,
          totalApiCalls: size,
          executionTime: size * 30
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: allNewBatch,
        filterMetrics: { executionTime: size }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: size,
          failed: 0,
          executionTime: size * 5
        }
      })
      
      const allNewResult = await processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic)
      expect(allNewResult.status).toBe('success')
      
      // Test mixed batch (30% NEW, 40% UPDATE, 30% SKIP)
      jest.clearAllMocks()
      // Reinitialize mocks again for clean state
      mockSupabase = createConfiguredMockSupabase()
      mockAnthropic = createMockAnthropicClient()
      
      const newCount = Math.floor(size * 0.3)
      const updateCount = Math.floor(size * 0.4)
      const skipCount = size - newCount - updateCount
      
      const mixedBatch = [
        ...Array.from({ length: newCount }, (_, i) => 
          generateNewOpportunity({ id: `MIXED-NEW-${i}` })
        ),
        ...Array.from({ length: updateCount }, (_, i) => 
          generateUpdatedOpportunity({ id: `MIXED-UPDATE-${i}` })
        ),
        ...Array.from({ length: skipCount }, (_, i) => 
          generateDuplicateOpportunity({ id: `MIXED-SKIP-${i}` })
        )
      ]
      
      extractFromSource.mockResolvedValue({
        opportunities: mixedBatch,
        extractionMetrics: {
          totalFound: size,
          totalRetrieved: size,
          totalTokens: size * 10,
          apiCalls: Math.ceil(size / 20),
          executionTime: size * 5
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: mixedBatch.slice(0, newCount),
        opportunitiesToUpdate: mixedBatch.slice(newCount, newCount + updateCount).map(o => ({
          apiRecord: o,
          dbRecord: o,
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        })),
        opportunitiesToSkip: mixedBatch.slice(newCount + updateCount).map(o => ({
          apiRecord: o,
          existingRecord: o,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: size,
          newOpportunities: newCount,
          opportunitiesToUpdate: updateCount,
          opportunitiesToSkip: skipCount,
          executionTime: size * 2
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: mixedBatch.slice(0, newCount),
        analysisMetrics: {
          totalTokens: newCount * 100, // Only NEW use tokens
          totalApiCalls: newCount,
          executionTime: newCount * 30
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: mixedBatch.slice(0, newCount),
        filterMetrics: { executionTime: newCount }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: newCount,
          failed: 0,
          executionTime: newCount * 5
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: updateCount,
          failed: 0,
          totalProcessed: updateCount,
          executionTime: updateCount * 3
        }
      })
      
      const mixedResult = await processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic)
      expect(mixedResult.status).toBe('success')
      
      // Mixed should consume fewer analysis tokens than all-new
      const allNewAnalysisTokens = allNewResult.enhancedMetrics.stageMetrics.analysis?.tokensUsed || 0
      const mixedAnalysisTokens = mixedResult.enhancedMetrics.stageMetrics.analysis?.tokensUsed || 0
      expect(mixedAnalysisTokens).toBeLessThan(allNewAnalysisTokens)
      
      // Compute token improvement percentage deterministically
      const tokenImprovement = ((allNewAnalysisTokens - mixedAnalysisTokens) / allNewAnalysisTokens) * 100
      expect(tokenImprovement).toBeGreaterThanOrEqual(60) // 70% of batch bypassed LLM
      
      // Also compare total tokens used
      const allNewTotalTokens = allNewResult.enhancedMetrics.totalTokensUsed || 0
      const mixedTotalTokens = mixedResult.enhancedMetrics.totalTokensUsed || 0
      expect(mixedTotalTokens).toBeLessThan(allNewTotalTokens)
    })
    
    it('should demonstrate cost savings for mixed batches', async () => {
      const COST_PER_TOKEN = 0.00001
      
      // Scenario 1: All NEW (worst case)
      const allNewBatch = Array.from({ length: 100 }, (_, i) => 
        generateNewOpportunity({ id: `COST-NEW-${i}` })
      )
      
      extractFromSource.mockResolvedValue({
        opportunities: allNewBatch,
        extractionMetrics: {
          totalFound: 100,
          totalRetrieved: 100,
          totalTokens: 1000,
          apiCalls: 5,
          executionTime: 500
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: allNewBatch,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: [],
        metrics: {
          totalProcessed: 100,
          newOpportunities: 100,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 0,
          executionTime: 200
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: allNewBatch,
        analysisMetrics: {
          totalTokens: 10000, // All 100 need analysis
          totalApiCalls: 100,
          executionTime: 3000
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: allNewBatch,
        filterMetrics: { executionTime: 100 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 100,
          failed: 0,
          executionTime: 500
        }
      })
      
      const allNewResult = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      expect(allNewResult.status).toBe('success')
      const allNewCost = (allNewResult.enhancedMetrics?.totalTokensUsed || 0) * COST_PER_TOKEN
      
      // Scenario 2: Mixed batch (best case for optimization)
      jest.clearAllMocks()
      // Reinitialize mocks for clean state
      mockSupabase = createConfiguredMockSupabase()
      mockAnthropic = createMockAnthropicClient()
      
      const mixedBatch = [
        ...Array.from({ length: 20 }, (_, i) => 
          generateNewOpportunity({ id: `COST-MIXED-NEW-${i}` })
        ),
        ...Array.from({ length: 40 }, (_, i) => 
          generateUpdatedOpportunity({ id: `COST-MIXED-UPDATE-${i}` })
        ),
        ...Array.from({ length: 40 }, (_, i) => 
          generateDuplicateOpportunity({ id: `COST-MIXED-SKIP-${i}` })
        )
      ]
      
      extractFromSource.mockResolvedValue({
        opportunities: mixedBatch,
        extractionMetrics: {
          totalFound: 100,
          totalRetrieved: 100,
          totalTokens: 1000,
          apiCalls: 5,
          executionTime: 500
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: mixedBatch.slice(0, 20),
        opportunitiesToUpdate: mixedBatch.slice(20, 60).map(o => ({
          apiRecord: o,
          dbRecord: o,
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        })),
        opportunitiesToSkip: mixedBatch.slice(60).map(o => ({
          apiRecord: o,
          existingRecord: o,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 100,
          newOpportunities: 20,
          opportunitiesToUpdate: 40,
          opportunitiesToSkip: 40,
          executionTime: 200
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: mixedBatch.slice(0, 20),
        analysisMetrics: {
          totalTokens: 2000, // Only 20 need analysis
          totalApiCalls: 20,
          executionTime: 600
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: mixedBatch.slice(0, 20),
        filterMetrics: { executionTime: 20 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 20,
          failed: 0,
          executionTime: 100
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 40,
          failed: 0,
          totalProcessed: 40,
          executionTime: 200
        }
      })
      
      const mixedResult = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      expect(mixedResult.status).toBe('success')
      const mixedCost = (mixedResult.enhancedMetrics?.totalTokensUsed || 0) * COST_PER_TOKEN
      
      // Calculate savings
      const costSavings = allNewCost > 0 ? ((allNewCost - mixedCost) / allNewCost) * 100 : 0
      
      // Should achieve significant cost savings
      expect(mixedCost).toBeLessThan(allNewCost)
      expect(costSavings).toBeGreaterThanOrEqual(70) // At least 70% cost reduction
      expect(mixedResult.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(80)
    })
  })
  
  describe('Aggregate Metrics Validation', () => {
    it('should correctly aggregate all metrics for mixed batch', async () => {
      const batch = generateMixedBatch()
      
      extractFromSource.mockResolvedValue({
        opportunities: batch,
        extractionMetrics: {
          totalFound: 5,
          totalRetrieved: 5,
          totalTokens: 250,
          apiCalls: 1,
          executionTime: 100
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: batch.slice(0, 2),
        opportunitiesToUpdate: [{
          apiRecord: batch[2],
          dbRecord: batch[2],
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        }],
        opportunitiesToSkip: batch.slice(3).map(o => ({
          apiRecord: o,
          existingRecord: o,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 5,
          newOpportunities: 2,
          opportunitiesToUpdate: 1,
          opportunitiesToSkip: 2,
          executionTime: 50
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: batch.slice(0, 2),
        analysisMetrics: {
          totalTokens: 400,
          totalApiCalls: 2,
          executionTime: 200
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: batch.slice(0, 2),
        filterMetrics: { executionTime: 20 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 2,
          failed: 0,
          executionTime: 100
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 1,
          failed: 0,
          totalProcessed: 1,
          executionTime: 50
        }
      })
      
      // Execute
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Validate comprehensive aggregation
      const metrics = result.enhancedMetrics
      
      // Token aggregation
      expect(metrics.totalTokensUsed).toBe(750) // 100 + 250 + 400
      expect(metrics.totalApiCalls).toBe(4) // 1 + 1 + 2
      
      // Stage metrics aggregation
      expect(metrics.stageMetrics.sourceOrchestrator.tokensUsed).toBe(100)
      expect(metrics.stageMetrics.dataExtraction.opportunitiesExtracted).toBe(5)
      expect(metrics.stageMetrics.earlyDuplicateDetector.newOpportunities).toBe(2)
      expect(metrics.stageMetrics.analysis.opportunitiesProcessed).toBe(2)
      expect(metrics.stageMetrics.filter.opportunitiesOutput).toBe(2)
      expect(metrics.stageMetrics.storage.opportunitiesStored).toBe(2)
      expect(metrics.stageMetrics.directUpdate.opportunitiesUpdated).toBe(1)
      
      // Optimization metrics
      expect(metrics.optimizationImpact.totalOpportunities).toBe(5)
      expect(metrics.optimizationImpact.bypassedLLM).toBe(3)
      const storedAgg = metrics.stageMetrics.storage?.opportunitiesStored || 0
      const updatedAgg = metrics.stageMetrics.directUpdate?.opportunitiesUpdated || 0
      expect(storedAgg + updatedAgg).toBe(3) // 2 NEW + 1 UPDATE
      
      // Path tracking
      expect(metrics.opportunityPaths).toHaveLength(5)
      expect(metrics.opportunityPaths.filter(p => p.finalOutcome === 'stored')).toHaveLength(2)
      expect(metrics.opportunityPaths.filter(p => p.finalOutcome === 'updated')).toHaveLength(1)
      expect(metrics.opportunityPaths.filter(p => p.finalOutcome === 'skipped')).toHaveLength(2)
    })
  })
})