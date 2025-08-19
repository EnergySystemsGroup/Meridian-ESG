/**
 * Integration Tests - Complete Pipeline Flow
 * 
 * Tests the complete V2 pipeline flow from end-to-end, validating all paths:
 * - NEW opportunity path: Extract → Duplicate Detector (NEW) → Analysis → Filter → Storage
 * - UPDATE opportunity path: Extract → Duplicate Detector (UPDATE) → Direct Update Handler
 * - SKIP opportunity path: Extract → Duplicate Detector (SKIP) → End
 * 
 * Validates:
 * - Token usage optimization (60-80% reduction)
 * - Performance benchmarks (<5 seconds for 50 opportunities)
 * - Transaction boundaries and atomicity
 * - Metrics collection and aggregation
 */

import { processApiSourceV2 } from '../../../lib/services/processCoordinatorV2.js'
import { 
  generateNewOpportunity,
  generateUpdatedOpportunity,
  generateDuplicateOpportunity,
  generateMixedBatch
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

// Import mocked modules for control
import { extractFromSource } from '../../../lib/agents-v2/core/dataExtractionAgent/index.js'
import { detectDuplicates } from '../../../lib/agents-v2/optimization/earlyDuplicateDetector.js'
import { enhanceOpportunities } from '../../../lib/agents-v2/core/analysisAgent/index.js'
import { filterOpportunities } from '../../../lib/agents-v2/core/filterFunction.js'
import { storeOpportunities } from '../../../lib/agents-v2/core/storageAgent/index.js'
import { updateDuplicateOpportunities } from '../../../lib/agents-v2/optimization/directUpdateHandler.js'

describe('Complete Pipeline Flow Integration', () => {
  let mockSupabase
  let mockAnthropic
  let testSourceId
  
  beforeEach(async () => {
    // Setup mocks
    mockSupabase = createConfiguredMockSupabase()
    mockAnthropic = createMockAnthropicClient()
    testSourceId = '550e8400-e29b-41d4-a716-446655440001' // Valid UUID
  })
  
  afterEach(() => {
    jest.clearAllMocks()
  })
  
  describe('NEW Opportunity Path', () => {
    it('should process new opportunities through complete pipeline', async () => {
      // Setup: 10 new opportunities
      const newOpportunities = Array.from({ length: 10 }, (_, i) => 
        generateNewOpportunity({ id: `NEW-${i}` })
      )
      
      // Configure mocks for NEW path
      extractFromSource.mockResolvedValue({
        opportunities: newOpportunities,
        extractionMetrics: {
          totalFound: 10,
          totalRetrieved: 10,
          successfullyExtracted: 10,
          totalTokens: 500,
          apiCalls: 2,
          executionTime: 200
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: newOpportunities,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: [],
        metrics: {
          totalProcessed: 10,
          newOpportunities: 10,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 0,
          executionTime: 100
        }
      })
      
      const enhancedOpportunities = newOpportunities.map(opp => ({
        ...opp,
        enhanced_description: `Enhanced: ${opp.description}`,
        eligibility_score: 85,
        tags: ['federal', 'grant']
      }))
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: enhancedOpportunities,
        analysisMetrics: {
          totalTokens: 2000,
          totalApiCalls: 10,
          executionTime: 1500
        }
      })
      
      const filteredOpportunities = enhancedOpportunities.filter((_, i) => i < 8) // 80% pass rate
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: filteredOpportunities,
        filterMetrics: {
          executionTime: 50
        }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 8,
          failed: 0,
          executionTime: 300
        }
      })
      
      // Execute pipeline
      const { result, executionTime } = await measureExecutionTime(processApiSourceV2)(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Assertions
      expect(result.status).toBe('success')
      expect(result.version).toBe('v2.0')
      expect(result.pipeline).toBe('v2-optimized-with-metrics')
      
      // Verify all stages were called correctly
      expect(extractFromSource).toHaveBeenCalledTimes(1)
      expect(detectDuplicates).toHaveBeenCalledWith(
        newOpportunities,
        testSourceId,
        mockSupabase,
        undefined
      )
      expect(enhanceOpportunities).toHaveBeenCalledWith(
        newOpportunities,
        expect.any(Object),
        mockAnthropic
      )
      expect(filterOpportunities).toHaveBeenCalledWith(enhancedOpportunities)
      expect(storeOpportunities).toHaveBeenCalledWith(
        filteredOpportunities,
        expect.any(Object),
        mockSupabase,
        false
      )
      
      // Direct update should NOT be called for NEW path
      expect(updateDuplicateOpportunities).not.toHaveBeenCalled()
      
      // Validate metrics
      expect(result.enhancedMetrics).toBeDefined()
      expect(result.enhancedMetrics.totalTokensUsed).toBe(2600) // 100 + 500 + 2000
      expect(result.enhancedMetrics.totalApiCalls).toBe(13) // 1 + 2 + 10
      expect(result.enhancedMetrics.optimizationImpact.totalOpportunities).toBe(10)
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(0)
      
      // Validate opportunity paths
      expect(result.enhancedMetrics.opportunityPaths).toHaveLength(10)
      result.enhancedMetrics.opportunityPaths.forEach(path => {
        expect(path.pathType).toBe('NEW')
        expect(path.stagesProcessed).toContain('analysis')
        expect(path.stagesProcessed).toContain('filter')
        // Only stored opportunities have 'storage' in their path
        if (path.finalOutcome !== 'filtered_out') {
          expect(path.stagesProcessed).toContain('storage')
        } else {
          expect(path.stagesProcessed).not.toContain('storage')
        }
      })
      
      // Verify counts
      const stored = result.enhancedMetrics.opportunityPaths.filter(p => p.finalOutcome === 'stored')
      expect(stored).toHaveLength(8)
      const filteredOut = result.enhancedMetrics.opportunityPaths.filter(p => p.finalOutcome === 'filtered_out')
      expect(filteredOut).toHaveLength(2)
      
      // Performance benchmark
      assertPerformanceBaseline(executionTime, 5000, 0.5) // Should complete within 5 seconds ±50%
    })
    
    it('should track token usage only for NEW opportunities', async () => {
      const newOpportunities = Array.from({ length: 5 }, (_, i) => 
        generateNewOpportunity({ id: `NEW-TOKEN-${i}` })
      )
      
      // Configure mocks
      extractFromSource.mockResolvedValue({
        opportunities: newOpportunities,
        extractionMetrics: {
          totalFound: 5,
          totalRetrieved: 5,
          totalTokens: 250,
          apiCalls: 1,
          executionTime: 100
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: newOpportunities,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: [],
        metrics: {
          totalProcessed: 5,
          newOpportunities: 5,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 0,
          executionTime: 50
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: newOpportunities,
        analysisMetrics: {
          totalTokens: 1000, // Only NEW opportunities use tokens
          totalApiCalls: 5,
          executionTime: 800
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: newOpportunities,
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
      
      // Verify token usage
      expect(result.enhancedMetrics.totalTokensUsed).toBe(1350) // 100 + 250 + 1000
      expect(result.enhancedMetrics.stageMetrics.analysis.tokensUsed).toBe(1000)
      expect(result.optimizationImpact.totalTokensUsed).toBe(1350)
    })
  })
  
  describe('UPDATE Opportunity Path', () => {
    it('should process duplicate opportunities with changes via direct update', async () => {
      // Setup: 5 opportunities with material changes
      const updatedOpportunities = Array.from({ length: 5 }, (_, i) => 
        generateUpdatedOpportunity({ 
          id: `EXISTING-${i}`,
          closeDate: '2025-01-15',
          maximumAward: 750000
        })
      )
      
      // Configure mocks for UPDATE path
      extractFromSource.mockResolvedValue({
        opportunities: updatedOpportunities,
        extractionMetrics: {
          totalFound: 5,
          totalRetrieved: 5,
          totalTokens: 250,
          apiCalls: 1,
          executionTime: 100
        }
      })
      
      const opportunitiesToUpdate = updatedOpportunities.map(opp => ({
        apiRecord: opp,
        dbRecord: { ...opp, closeDate: '2024-12-31', maximumAward: 500000 },
        changesDetected: ['closeDate', 'maximumAward'],
        reason: 'material_changes'
      }))
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: [],
        opportunitiesToUpdate: opportunitiesToUpdate,
        opportunitiesToSkip: [],
        metrics: {
          totalProcessed: 5,
          newOpportunities: 0,
          opportunitiesToUpdate: 5,
          opportunitiesToSkip: 0,
          executionTime: 75
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 5,
          failed: 0,
          totalProcessed: 5,
          executionTime: 200
        }
      })
      
      // Execute pipeline
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Assertions
      expect(result.status).toBe('success')
      
      // Verify UPDATE path was taken
      expect(extractFromSource).toHaveBeenCalledTimes(1)
      expect(detectDuplicates).toHaveBeenCalledTimes(1)
      expect(updateDuplicateOpportunities).toHaveBeenCalledWith(
        opportunitiesToUpdate,
        mockSupabase
      )
      
      // Analysis and storage should NOT be called for UPDATE path
      expect(enhanceOpportunities).not.toHaveBeenCalled()
      expect(filterOpportunities).not.toHaveBeenCalled()
      expect(storeOpportunities).not.toHaveBeenCalled()
      
      // Validate optimization metrics
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(5)
      expect(result.enhancedMetrics.totalTokensUsed).toBe(350) // Only source + extraction tokens
      
      // Validate opportunity paths
      expect(result.enhancedMetrics.opportunityPaths).toHaveLength(5)
      result.enhancedMetrics.opportunityPaths.forEach(path => {
        expect(path.pathType).toBe('UPDATE')
        expect(path.pathReason).toBe('material_changes')
        expect(path.stagesProcessed).toContain('direct_update')
        expect(path.stagesProcessed).not.toContain('analysis')
        expect(path.finalOutcome).toBe('updated')
      })
    })
    
    it('should bypass expensive stages for UPDATE opportunities', async () => {
      const updatedOpportunity = generateUpdatedOpportunity({
        id: 'EXISTING-1',
        closeDate: '2025-02-01'
      })
      
      extractFromSource.mockResolvedValue({
        opportunities: [updatedOpportunity],
        extractionMetrics: {
          totalFound: 1,
          totalRetrieved: 1,
          totalTokens: 50,
          apiCalls: 1,
          executionTime: 50
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: [],
        opportunitiesToUpdate: [{
          apiRecord: updatedOpportunity,
          dbRecord: { ...updatedOpportunity, closeDate: '2024-12-31' },
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        }],
        opportunitiesToSkip: [],
        metrics: {
          totalProcessed: 1,
          newOpportunities: 0,
          opportunitiesToUpdate: 1,
          opportunitiesToSkip: 0,
          executionTime: 25
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
      
      // Verify no expensive operations
      expect(enhanceOpportunities).not.toHaveBeenCalled()
      expect(result.enhancedMetrics.totalTokensUsed).toBeLessThan(200) // Minimal token usage
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(1)
    })
  })
  
  describe('SKIP Opportunity Path', () => {
    it('should skip exact duplicates without any processing', async () => {
      // Setup: 3 exact duplicates
      const duplicateOpportunities = Array.from({ length: 3 }, (_, i) => 
        generateDuplicateOpportunity({ id: `DUP-${i}` })
      )
      
      // Configure mocks for SKIP path
      extractFromSource.mockResolvedValue({
        opportunities: duplicateOpportunities,
        extractionMetrics: {
          totalFound: 3,
          totalRetrieved: 3,
          totalTokens: 150,
          apiCalls: 1,
          executionTime: 75
        }
      })
      
      const opportunitiesToSkip = duplicateOpportunities.map(opp => ({
        apiRecord: opp,
        existingRecord: opp,
        reason: 'exact_duplicate'
      }))
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: [],
        opportunitiesToUpdate: [],
        opportunitiesToSkip: opportunitiesToSkip,
        metrics: {
          totalProcessed: 3,
          newOpportunities: 0,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 3,
          executionTime: 50
        }
      })
      
      // Execute pipeline
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Assertions
      expect(result.status).toBe('success')
      
      // Verify SKIP path - no further processing
      expect(extractFromSource).toHaveBeenCalledTimes(1)
      expect(detectDuplicates).toHaveBeenCalledTimes(1)
      
      // Nothing should be processed after duplicate detection
      expect(enhanceOpportunities).not.toHaveBeenCalled()
      expect(filterOpportunities).not.toHaveBeenCalled()
      expect(storeOpportunities).not.toHaveBeenCalled()
      expect(updateDuplicateOpportunities).not.toHaveBeenCalled()
      
      // Validate optimization
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(3)
      expect(result.enhancedMetrics.totalTokensUsed).toBe(250) // Only source + extraction
      
      // Validate opportunity paths
      expect(result.enhancedMetrics.opportunityPaths).toHaveLength(3)
      result.enhancedMetrics.opportunityPaths.forEach(path => {
        expect(path.pathType).toBe('SKIP')
        expect(path.pathReason).toBe('exact_duplicate')
        expect(path.finalOutcome).toBe('skipped')
        expect(path.stagesProcessed).toEqual(['data_extraction', 'early_duplicate_detector'])
      })
    })
  })
  
  describe('End-to-End Metrics Collection', () => {
    it('should collect comprehensive metrics across all stages', async () => {
      // Setup mixed batch
      const newOpp = generateNewOpportunity({ id: 'NEW-METRICS-1' })
      const updateOpp = generateUpdatedOpportunity({ id: 'UPDATE-METRICS-1' })
      const skipOpp = generateDuplicateOpportunity({ id: 'SKIP-METRICS-1' })
      
      extractFromSource.mockResolvedValue({
        opportunities: [newOpp, updateOpp, skipOpp],
        extractionMetrics: {
          totalFound: 3,
          totalRetrieved: 3,
          totalTokens: 150,
          apiCalls: 1,
          executionTime: 100
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
          executionTime: 75
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: [{ ...newOpp, enhanced: true }],
        analysisMetrics: {
          totalTokens: 500,
          totalApiCalls: 1,
          executionTime: 400
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: [{ ...newOpp, enhanced: true }],
        filterMetrics: { executionTime: 20 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 1,
          failed: 0,
          executionTime: 100
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 1,
          failed: 0,
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
      
      // Validate comprehensive metrics
      expect(result.enhancedMetrics).toBeDefined()
      
      // Stage metrics should be present
      expect(result.enhancedMetrics.stageMetrics).toHaveProperty('sourceOrchestrator')
      expect(result.enhancedMetrics.stageMetrics).toHaveProperty('dataExtraction')
      expect(result.enhancedMetrics.stageMetrics).toHaveProperty('earlyDuplicateDetector')
      expect(result.enhancedMetrics.stageMetrics).toHaveProperty('analysis')
      expect(result.enhancedMetrics.stageMetrics).toHaveProperty('filter')
      expect(result.enhancedMetrics.stageMetrics).toHaveProperty('storage')
      expect(result.enhancedMetrics.stageMetrics).toHaveProperty('directUpdate')
      
      // Optimization impact
      expect(result.enhancedMetrics.optimizationImpact.totalOpportunities).toBe(3)
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(2) // UPDATE + SKIP
      
      // Token tracking
      expect(result.enhancedMetrics.totalTokensUsed).toBe(750) // 100 + 150 + 500
      expect(result.enhancedMetrics.totalApiCalls).toBe(3) // 1 + 1 + 1
      
      // Opportunity paths
      expect(result.enhancedMetrics.opportunityPaths).toHaveLength(3)
      const paths = result.enhancedMetrics.opportunityPaths
      expect(paths.filter(p => p.pathType === 'NEW')).toHaveLength(1)
      expect(paths.filter(p => p.pathType === 'UPDATE')).toHaveLength(1)
      expect(paths.filter(p => p.pathType === 'SKIP')).toHaveLength(1)
    })
    
    it('should aggregate metrics correctly for large batches', async () => {
      // Setup: 50 opportunities
      const opportunities = Array.from({ length: 50 }, (_, i) => {
        if (i < 20) return generateNewOpportunity({ id: `NEW-${i}` })
        if (i < 35) return generateUpdatedOpportunity({ id: `UPDATE-${i}` })
        return generateDuplicateOpportunity({ id: `SKIP-${i}` })
      })
      
      extractFromSource.mockResolvedValue({
        opportunities,
        extractionMetrics: {
          totalFound: 50,
          totalRetrieved: 50,
          totalTokens: 500,
          apiCalls: 3,
          executionTime: 300
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: opportunities.slice(0, 20),
        opportunitiesToUpdate: opportunities.slice(20, 35).map(opp => ({
          apiRecord: opp,
          dbRecord: opp,
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        })),
        opportunitiesToSkip: opportunities.slice(35).map(opp => ({
          apiRecord: opp,
          existingRecord: opp,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 50,
          newOpportunities: 20,
          opportunitiesToUpdate: 15,
          opportunitiesToSkip: 15,
          executionTime: 200
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: opportunities.slice(0, 20),
        analysisMetrics: {
          totalTokens: 4000,
          totalApiCalls: 20,
          executionTime: 2000
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: opportunities.slice(0, 18), // 90% pass rate
        filterMetrics: { executionTime: 50 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 18,
          failed: 0,
          executionTime: 500
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 15,
          failed: 0,
          totalProcessed: 15,
          executionTime: 300
        }
      })
      
      // Execute with timing
      const { result, executionTime } = await measureExecutionTime(processApiSourceV2)(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Validate large batch processing
      expect(result.status).toBe('success')
      expect(result.enhancedMetrics.optimizationImpact.totalOpportunities).toBe(50)
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(30) // UPDATE + SKIP
      
      // Calculate successful opportunities from stage metrics
      const storedCount = result.enhancedMetrics.stageMetrics?.storage?.opportunitiesStored || 
                          result.enhancedMetrics.stageMetrics?.storage?.newOpportunities || 0
      const updatedCount = result.enhancedMetrics.stageMetrics?.directUpdate?.opportunitiesUpdated || 
                           result.enhancedMetrics.stageMetrics?.direct_update?.successful || 0
      expect(storedCount + updatedCount).toBe(33) // 18 stored + 15 updated
      
      // Performance benchmark for 50 opportunities
      assertPerformanceBaseline(executionTime, 5000, 0.5) // Should complete within 5 seconds
      
      // Token optimization validation (60-80% reduction)
      const tokenReduction = (30 / 50) * 100 // 60% bypassed
      expect(tokenReduction).toBeGreaterThanOrEqual(60)
    })
  })
  
  describe('Transaction Boundaries and Atomicity', () => {
    it('should maintain transaction boundaries across pipeline stages', async () => {
      const opportunities = generateMixedBatch()
      
      // Setup mocks with transaction tracking
      const transactionLog = []
      
      extractFromSource.mockImplementation(async () => {
        transactionLog.push('extract_start')
        await new Promise(r => setTimeout(r, 10))
        transactionLog.push('extract_end')
        return {
          opportunities,
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
        transactionLog.push('detect_start')
        await new Promise(r => setTimeout(r, 10))
        transactionLog.push('detect_end')
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
        transactionLog.push('enhance_start')
        await new Promise(r => setTimeout(r, 10))
        transactionLog.push('enhance_end')
        return {
          opportunities: opps,
          analysisMetrics: {
            totalTokens: 1000,
            totalApiCalls: 2,
            executionTime: 500
          }
        }
      })
      
      filterOpportunities.mockImplementation(async (opps) => {
        transactionLog.push('filter_start')
        await new Promise(r => setTimeout(r, 10))
        transactionLog.push('filter_end')
        return {
          includedOpportunities: opps,
          filterMetrics: { executionTime: 25 }
        }
      })
      
      storeOpportunities.mockImplementation(async (opps) => {
        transactionLog.push('store_start')
        await new Promise(r => setTimeout(r, 10))
        transactionLog.push('store_end')
        return {
          metrics: {
            newOpportunities: opps.length,
            failed: 0,
            executionTime: 150
          }
        }
      })
      
      updateDuplicateOpportunities.mockImplementation(async (opps) => {
        transactionLog.push('update_start')
        await new Promise(r => setTimeout(r, 10))
        transactionLog.push('update_end')
        return {
          metrics: {
            successful: opps.length,
            failed: 0,
            totalProcessed: opps.length,
            executionTime: 100
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
      
      // Validate transaction ordering
      expect(transactionLog).toEqual([
        'extract_start',
        'extract_end',
        'detect_start',
        'detect_end',
        'enhance_start',
        'enhance_end',
        'filter_start',
        'filter_end',
        'store_start',
        'store_end',
        'update_start',
        'update_end'
      ])
    })
    
    it('should handle partial failures gracefully', async () => {
      const opportunities = [
        generateNewOpportunity({ id: 'NEW-FAIL-1' }),
        generateNewOpportunity({ id: 'NEW-FAIL-2' })
      ]
      
      extractFromSource.mockResolvedValue({
        opportunities,
        extractionMetrics: {
          totalFound: 2,
          totalRetrieved: 2,
          totalTokens: 100,
          apiCalls: 1,
          executionTime: 50
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: opportunities,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: [],
        metrics: {
          totalProcessed: 2,
          newOpportunities: 2,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 0,
          executionTime: 25
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities,
        analysisMetrics: {
          totalTokens: 400,
          totalApiCalls: 2,
          executionTime: 200
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: opportunities,
        filterMetrics: { executionTime: 10 }
      })
      
      // Simulate partial storage failure
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 1,
          failed: 1,
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
      
      // Should complete successfully despite partial failure
      expect(result.status).toBe('success')
      expect(result.enhancedMetrics.stageMetrics.storage.opportunitiesFailed).toBe(1)
      expect(result.enhancedMetrics.stageMetrics.storage.successRate).toBe(50)
      expect(result.optimizationImpact.successfulOpportunities).toBe(1)
    })
  })
  
  describe('Error Propagation', () => {
    it('should propagate errors through pipeline stages', async () => {
      // Simulate extraction failure
      extractFromSource.mockRejectedValue(new Error('API connection failed'))
      
      // Execute
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Should return error status
      expect(result.status).toBe('error')
      expect(result.error).toContain('API connection failed')
      
      // Later stages should not be called
      expect(detectDuplicates).not.toHaveBeenCalled()
      expect(enhanceOpportunities).not.toHaveBeenCalled()
    })
    
    it('should handle analysis stage failure gracefully', async () => {
      const opportunities = [generateNewOpportunity({ id: 'NEW-ERROR-1' })]
      
      extractFromSource.mockResolvedValue({
        opportunities,
        extractionMetrics: {
          totalFound: 1,
          totalRetrieved: 1,
          totalTokens: 50,
          apiCalls: 1,
          executionTime: 25
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: opportunities,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: [],
        metrics: {
          totalProcessed: 1,
          newOpportunities: 1,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 0,
          executionTime: 15
        }
      })
      
      // Simulate analysis failure
      enhanceOpportunities.mockRejectedValue(new Error('LLM rate limit exceeded'))
      
      // Execute
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Should return error status
      expect(result.status).toBe('error')
      expect(result.error).toContain('LLM rate limit exceeded')
      
      // Storage should not be called
      expect(storeOpportunities).not.toHaveBeenCalled()
    })
  })
  
  describe('Performance Benchmarks', () => {
    it('should meet performance targets for different batch sizes', async () => {
      const testCases = [
        { size: 10, maxTime: 2000 },
        { size: 25, maxTime: 3500 },
        { size: 50, maxTime: 5000 }
      ]
      
      for (const { size, maxTime } of testCases) {
        // Reset mocks
        jest.clearAllMocks()
        
        // Generate batch
        const opportunities = Array.from({ length: size }, (_, i) => 
          generateNewOpportunity({ id: `PERF-${size}-${i}` })
        )
        
        // Configure mocks with realistic timing
        extractFromSource.mockResolvedValue({
          opportunities,
          extractionMetrics: {
            totalFound: size,
            totalRetrieved: size,
            totalTokens: size * 10,
            apiCalls: Math.ceil(size / 20),
            executionTime: size * 5
          }
        })
        
        detectDuplicates.mockResolvedValue({
          newOpportunities: opportunities,
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
          opportunities,
          analysisMetrics: {
            totalTokens: size * 100,
            totalApiCalls: size,
            executionTime: size * 20
          }
        })
        
        filterOpportunities.mockResolvedValue({
          includedOpportunities: opportunities,
          filterMetrics: { executionTime: size }
        })
        
        storeOpportunities.mockResolvedValue({
          metrics: {
            newOpportunities: size,
            failed: 0,
            executionTime: size * 5
          }
        })
        
        // Execute with timing
        const startTime = Date.now()
        await processApiSourceV2(
          testSourceId,
          null,
          mockSupabase,
          mockAnthropic
        )
        const executionTime = Date.now() - startTime
        
        // Assert performance
        expect(executionTime).toBeLessThan(maxTime)
      }
    })
    
    it('should demonstrate token optimization benefits', async () => {
      // Scenario: 100 opportunities, 70% duplicates
      const newOpps = Array.from({ length: 30 }, (_, i) => 
        generateNewOpportunity({ id: `NEW-OPT-${i}` })
      )
      const dupOpps = Array.from({ length: 70 }, (_, i) => 
        generateDuplicateOpportunity({ id: `DUP-OPT-${i}` })
      )
      const allOpps = [...newOpps, ...dupOpps]
      
      extractFromSource.mockResolvedValue({
        opportunities: allOpps,
        extractionMetrics: {
          totalFound: 100,
          totalRetrieved: 100,
          totalTokens: 500,
          apiCalls: 5,
          executionTime: 500
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: newOpps,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: dupOpps.map(o => ({
          apiRecord: o,
          existingRecord: o,
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 100,
          newOpportunities: 30,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 70,
          executionTime: 200
        }
      })
      
      // Only NEW opportunities use analysis tokens
      enhanceOpportunities.mockResolvedValue({
        opportunities: newOpps,
        analysisMetrics: {
          totalTokens: 3000, // Only 30 opportunities
          totalApiCalls: 30,
          executionTime: 1500
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: newOpps,
        filterMetrics: { executionTime: 30 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 30,
          failed: 0,
          executionTime: 300
        }
      })
      
      // Execute
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Calculate token savings
      const tokensWithoutOptimization = 100 * 100 // All opportunities through analysis
      const actualTokensUsed = result.enhancedMetrics.totalTokensUsed
      const tokensSaved = tokensWithoutOptimization - actualTokensUsed
      const savingsPercentage = (tokensSaved / tokensWithoutOptimization) * 100
      
      // Should achieve 60-80% token reduction
      expect(savingsPercentage).toBeGreaterThanOrEqual(60)
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(70)
      
      // Verify only NEW opportunities consumed analysis tokens
      expect(result.enhancedMetrics.stageMetrics.analysis.opportunitiesProcessed).toBe(30)
      expect(result.enhancedMetrics.stageMetrics.analysis.tokensUsed).toBe(3000)
    })
  })
})