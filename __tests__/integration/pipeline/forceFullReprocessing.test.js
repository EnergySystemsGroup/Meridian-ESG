/**
 * Integration Tests - Force Full Reprocessing (FFR)
 * 
 * Tests the force full reprocessing feature that bypasses duplicate detection:
 * - FFR flag enables bypass of duplicate detection
 * - All opportunities treated as NEW when FFR enabled
 * - Auto-disable of FFR flag after successful run
 * - Metrics show forceFullProcessingUsed=true
 */

import { processApiSourceV2 } from '../../../lib/services/processCoordinatorV2.js'
import { 
  generateNewOpportunity,
  generateDuplicateOpportunity,
  generateExistingOpportunity,
  generateLargeBatch
} from '../../fixtures/opportunities.js'
import { createMockAnthropicClient } from '../../setup/testHelpers.js'
import { createConfiguredMockSupabase } from '../../mocks/supabase.js'

// Mock the agent modules
jest.mock('../../../lib/agents-v2/core/sourceOrchestrator.js', () => ({
  analyzeSource: jest.fn()
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
import { analyzeSource } from '../../../lib/agents-v2/core/sourceOrchestrator.js'
import { extractFromSource } from '../../../lib/agents-v2/core/dataExtractionAgent/index.js'
import { detectDuplicates } from '../../../lib/agents-v2/optimization/earlyDuplicateDetector.js'
import { enhanceOpportunities } from '../../../lib/agents-v2/core/analysisAgent/index.js'
import { filterOpportunities } from '../../../lib/agents-v2/core/filterFunction.js'
import { storeOpportunities } from '../../../lib/agents-v2/core/storageAgent/index.js'
import { updateDuplicateOpportunities } from '../../../lib/agents-v2/optimization/directUpdateHandler.js'

describe('Force Full Reprocessing (FFR) Tests', () => {
  let mockSupabase
  let mockAnthropic
  let testSourceId
  
  beforeEach(() => {
    mockSupabase = createConfiguredMockSupabase()
    mockAnthropic = createMockAnthropicClient()
    testSourceId = '550e8400-e29b-41d4-a716-446655440001'
    
    // Default mocks for agents
    analyzeSource.mockResolvedValue({
      analysis: { type: 'two-step', pagination: false },
      tokenUsage: 100,
      apiCalls: 1,
      executionTime: 50
    })
    
    jest.clearAllMocks()
  })
  
  describe('FFR Flag Behavior', () => {
    test('should bypass duplicate detection when FFR is enabled', async () => {
      // Enable FFR via RPC mock
      mockSupabase.rpc = jest.fn((functionName) => {
        if (functionName === 'should_force_full_reprocessing') {
          return Promise.resolve({ data: true, error: null }) // FFR enabled
        }
        if (functionName === 'disable_force_full_reprocessing') {
          return Promise.resolve({ data: null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })
      
      const opportunities = [
        generateExistingOpportunity({ id: 'EXISTING-1' }),
        generateDuplicateOpportunity({ id: 'EXISTING-2' }),
        generateNewOpportunity({ id: 'NEW-1' })
      ]
      
      // Setup extraction
      extractFromSource.mockResolvedValue({
        opportunities,
        extractionMetrics: {
          totalFound: 3,
          totalRetrieved: 3,
          totalTokens: 150,
          apiCalls: 1,
          executionTime: 100
        }
      })
      
      // This should NOT be called when FFR is enabled
      detectDuplicates.mockResolvedValue({
        newOpportunities: [],
        opportunitiesToUpdate: [],
        opportunitiesToSkip: opportunities.map(o => ({ 
          apiRecord: o, 
          existingRecord: {} 
        })),
        metrics: {
          totalProcessed: 3,
          newOpportunities: 0,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 3,
          executionTime: 50
        }
      })
      
      // All opportunities should be treated as NEW
      enhanceOpportunities.mockResolvedValue({
        opportunities,
        analysisMetrics: {
          totalTokens: 300,
          totalApiCalls: 3,
          executionTime: 150
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: opportunities,
        filterMetrics: { executionTime: 20 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 3,
          failed: 0,
          executionTime: 100
        }
      })
      
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // When FFR is enabled, duplicate detection should be bypassed
      expect(detectDuplicates).not.toHaveBeenCalled()
      
      // Duplicate detector stage is not included in metrics when FFR bypasses it
      // The real coordinator bypasses the duplicate detection logic entirely
      
      // All opportunities should go through analysis (treated as NEW)
      expect(enhanceOpportunities).toHaveBeenCalledWith(
        opportunities,
        expect.any(Object),
        mockAnthropic
      )
      
      // Verify metrics indicate FFR was used
      expect(result.enhancedMetrics.forceFullProcessingUsed).toBe(true)
      expect(result.status).toBe('success')
      
      // FFR opportunity paths should still include early_duplicate_detector (it ran but was bypassed)
      result.enhancedMetrics.opportunityPaths
        .filter(p => p.pathType === 'NEW')
        .forEach(p => {
          expect(p.stagesProcessed).toEqual(
            expect.arrayContaining(['data_extraction', 'early_duplicate_detector', 'analysis', 'filter', 'storage'])
          )
          // With FFR, all opportunities are marked as NEW with no_duplicate_found reason
          expect(p.pathReason).toBe('no_duplicate_found')
        })
      
      // Verify FFR was auto-disabled after success
      expect(mockSupabase.rpc).toHaveBeenCalledWith('disable_force_full_reprocessing', {
        source_id: testSourceId
      })
      
      // Second run to confirm normal path resumes after FFR auto-disable
      jest.clearAllMocks()
      mockSupabase = createConfiguredMockSupabase()
      mockSupabase.rpc = jest.fn((functionName) => {
        if (functionName === 'should_force_full_reprocessing') {
          return Promise.resolve({ data: false, error: null }) // FFR now disabled
        }
        return Promise.resolve({ data: null, error: null })
      })
      
      extractFromSource.mockResolvedValue({
        opportunities: [opportunities[0]],
        extractionMetrics: {
          totalFound: 1,
          totalRetrieved: 1,
          totalTokens: 50,
          apiCalls: 1,
          executionTime: 25
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: [],
        opportunitiesToUpdate: [],
        opportunitiesToSkip: [{
          apiRecord: opportunities[0],
          existingRecord: {},
          reason: 'exact_duplicate'
        }],
        metrics: {
          totalProcessed: 1,
          newOpportunities: 0,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 1,
          executionTime: 20
        }
      })
      
      const normalRunAfterFFR = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Confirm normal duplicate detection resumes
      expect(detectDuplicates).toHaveBeenCalled()
      expect(normalRunAfterFFR.enhancedMetrics.forceFullProcessingUsed).toBe(false)
    })
    
    test('should use normal duplicate detection when FFR is disabled', async () => {
      // Disable FFR via RPC mock
      mockSupabase.rpc = jest.fn((functionName) => {
        if (functionName === 'should_force_full_reprocessing') {
          return Promise.resolve({ data: false, error: null }) // FFR disabled
        }
        return Promise.resolve({ data: null, error: null })
      })
      
      const opportunities = [
        generateExistingOpportunity({ id: 'EXISTING-1' }),
        generateDuplicateOpportunity({ id: 'EXISTING-2' }),
        generateNewOpportunity({ id: 'NEW-1' })
      ]
      
      extractFromSource.mockResolvedValue({
        opportunities,
        extractionMetrics: {
          totalFound: 3,
          totalRetrieved: 3,
          totalTokens: 150,
          apiCalls: 1,
          executionTime: 100
        }
      })
      
      // Normal duplicate detection should categorize properly
      detectDuplicates.mockResolvedValue({
        newOpportunities: [opportunities[2]], // Only NEW-1
        opportunitiesToUpdate: [{
          apiRecord: opportunities[0],
          dbRecord: {},
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        }],
        opportunitiesToSkip: [{
          apiRecord: opportunities[1],
          existingRecord: {},
          reason: 'exact_duplicate'
        }],
        metrics: {
          totalProcessed: 3,
          newOpportunities: 1,
          opportunitiesToUpdate: 1,
          opportunitiesToSkip: 1,
          executionTime: 50
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: [opportunities[2]], // Only NEW opportunity
        analysisMetrics: {
          totalTokens: 100,
          totalApiCalls: 1,
          executionTime: 50
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: [opportunities[2]],
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
          successful: 1,
          failed: 0,
          totalProcessed: 1,
          executionTime: 30
        }
      })
      
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Duplicate detection should be called
      expect(detectDuplicates).toHaveBeenCalledWith(
        opportunities,
        testSourceId,
        mockSupabase,
        undefined // rawResponseId
      )
      
      // Only NEW opportunities should be enhanced
      expect(enhanceOpportunities).toHaveBeenCalledWith(
        [opportunities[2]],
        expect.any(Object),
        mockAnthropic
      )
      
      // Updates should be processed
      expect(updateDuplicateOpportunities).toHaveBeenCalled()
      
      // FFR should not be used
      expect(result.enhancedMetrics.forceFullProcessingUsed).toBe(false)
      expect(result.status).toBe('success')
      
      // FFR disable should NOT be called when FFR wasn't used
      expect(mockSupabase.rpc).not.toHaveBeenCalledWith('disable_force_full_reprocessing', 
        expect.any(Object)
      )
    })
  })
  
  describe('FFR Metrics and Reporting', () => {
    test('should track FFR usage in metrics', async () => {
      // Enable FFR
      mockSupabase.rpc = jest.fn((functionName) => {
        if (functionName === 'should_force_full_reprocessing') {
          return Promise.resolve({ data: true, error: null })
        }
        if (functionName === 'disable_force_full_reprocessing') {
          return Promise.resolve({ data: null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })
      
      const opportunities = generateLargeBatch(20)
      
      extractFromSource.mockResolvedValue({
        opportunities,
        extractionMetrics: {
          totalFound: 20,
          totalRetrieved: 20,
          totalTokens: 1000,
          apiCalls: 1,
          executionTime: 200
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities,
        analysisMetrics: {
          totalTokens: 2000,
          totalApiCalls: 20,
          executionTime: 1000
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: opportunities,
        filterMetrics: { executionTime: 100 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 20,
          failed: 0,
          executionTime: 500
        }
      })
      
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Check metrics
      expect(result.enhancedMetrics.forceFullProcessingUsed).toBe(true)
      
      // When FFR is enabled, duplicate detection is bypassed completely
      expect(detectDuplicates).not.toHaveBeenCalled()
      
      // All opportunities should be in NEW path
      const newPaths = result.enhancedMetrics.opportunityPaths.filter(p => p.pathType === 'NEW')
      expect(newPaths).toHaveLength(20)
      
      // FFR opportunity paths should still include early_duplicate_detector (it ran but was bypassed)
      newPaths.forEach(p => {
        expect(p.stagesProcessed).toEqual(
          expect.arrayContaining(['data_extraction', 'early_duplicate_detector', 'analysis', 'filter', 'storage'])
        )
        // With FFR, all opportunities are marked as NEW with no_duplicate_found reason
        expect(p.pathReason).toBe('no_duplicate_found')
      })
      
      // No UPDATE or SKIP paths
      const updatePaths = result.enhancedMetrics.opportunityPaths.filter(p => p.pathType === 'UPDATE')
      const skipPaths = result.enhancedMetrics.opportunityPaths.filter(p => p.pathType === 'SKIP')
      expect(updatePaths).toHaveLength(0)
      expect(skipPaths).toHaveLength(0)
      
      // Optimization impact should show no bypassed opportunities
      expect(result.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(0)
    })
    
    test('should compare FFR vs normal processing metrics', async () => {
      const opportunities = generateLargeBatch(10)
      
      // First run: Normal processing (FFR disabled)
      mockSupabase.rpc = jest.fn((functionName) => {
        if (functionName === 'should_force_full_reprocessing') {
          return Promise.resolve({ data: false, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })
      
      extractFromSource.mockResolvedValue({
        opportunities,
        extractionMetrics: {
          totalFound: 10,
          totalRetrieved: 10,
          totalTokens: 500,
          apiCalls: 1,
          executionTime: 100
        }
      })
      
      // Normal detection: mix of NEW, UPDATE, SKIP
      detectDuplicates.mockResolvedValue({
        newOpportunities: opportunities.slice(0, 3),
        opportunitiesToUpdate: opportunities.slice(3, 6).map(o => ({
          apiRecord: o,
          dbRecord: {},
          changesDetected: ['closeDate'],
          reason: 'material_changes'
        })),
        opportunitiesToSkip: opportunities.slice(6).map(o => ({
          apiRecord: o,
          existingRecord: {},
          reason: 'exact_duplicate'
        })),
        metrics: {
          totalProcessed: 10,
          newOpportunities: 3,
          opportunitiesToUpdate: 3,
          opportunitiesToSkip: 4,
          executionTime: 50
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities: opportunities.slice(0, 3),
        analysisMetrics: {
          totalTokens: 300,
          totalApiCalls: 3,
          executionTime: 150
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: opportunities.slice(0, 3),
        filterMetrics: { executionTime: 20 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 3,
          failed: 0,
          executionTime: 100
        }
      })
      
      updateDuplicateOpportunities.mockResolvedValue({
        metrics: {
          successful: 3,
          failed: 0,
          totalProcessed: 3,
          executionTime: 60
        }
      })
      
      const normalResult = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Second run: FFR enabled
      jest.clearAllMocks()
      
      // Re-setup mockSupabase after clearing
      mockSupabase = createConfiguredMockSupabase()
      mockSupabase.rpc = jest.fn((functionName) => {
        if (functionName === 'should_force_full_reprocessing') {
          return Promise.resolve({ data: true, error: null })
        }
        if (functionName === 'disable_force_full_reprocessing') {
          return Promise.resolve({ data: null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })
      
      extractFromSource.mockResolvedValue({
        opportunities,
        extractionMetrics: {
          totalFound: 10,
          totalRetrieved: 10,
          totalTokens: 500,
          apiCalls: 1,
          executionTime: 100
        }
      })
      
      // With FFR, all are treated as NEW
      enhanceOpportunities.mockResolvedValue({
        opportunities, // All 10 opportunities
        analysisMetrics: {
          totalTokens: 1000, // More tokens for all 10
          totalApiCalls: 10,
          executionTime: 500
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: opportunities,
        filterMetrics: { executionTime: 50 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 10,
          failed: 0,
          executionTime: 300
        }
      })
      
      const ffrResult = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Compare results
      // Normal processing should have optimization
      expect(normalResult.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(7) // 3 UPDATE + 4 SKIP
      expect(normalResult.enhancedMetrics.totalTokensUsed).toBe(900) // 100 (analysis) + 500 (extraction) + 300 (enhancement)
      
      // FFR should have no optimization but more tokens
      expect(ffrResult.enhancedMetrics.forceFullProcessingUsed).toBe(true)
      expect(ffrResult.enhancedMetrics.optimizationImpact.bypassedLLM).toBe(0)
      expect(ffrResult.enhancedMetrics.totalTokensUsed).toBe(1600) // 100 (analysis) + 500 (extraction) + 1000 (enhancement)
      
      // FFR uses more tokens due to processing all as NEW
      expect(ffrResult.enhancedMetrics.totalTokensUsed).toBeGreaterThan(
        normalResult.enhancedMetrics.totalTokensUsed
      )
    })
  })
  
  describe('Error Handling', () => {
    test('should handle FFR RPC check failure gracefully', async () => {
      // RPC fails
      mockSupabase.rpc = jest.fn((functionName) => {
        if (functionName === 'should_force_full_reprocessing') {
          return Promise.resolve({ data: null, error: { message: 'RPC error' } })
        }
        return Promise.resolve({ data: null, error: null })
      })
      
      const opportunities = [generateNewOpportunity({ id: 'NEW-1' })]
      
      extractFromSource.mockResolvedValue({
        opportunities,
        extractionMetrics: {
          totalFound: 1,
          totalRetrieved: 1,
          totalTokens: 50,
          apiCalls: 1,
          executionTime: 50
        }
      })
      
      // Should fall back to normal processing
      detectDuplicates.mockResolvedValue({
        newOpportunities: opportunities,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: [],
        metrics: {
          totalProcessed: 1,
          newOpportunities: 1,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 0,
          executionTime: 20
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities,
        analysisMetrics: {
          totalTokens: 100,
          totalApiCalls: 1,
          executionTime: 50
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: opportunities,
        filterMetrics: { executionTime: 10 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 1,
          failed: 0,
          executionTime: 30
        }
      })
      
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Should complete successfully with normal processing
      expect(result.status).toBe('success')
      expect(detectDuplicates).toHaveBeenCalled() // Normal flow
      expect(result.enhancedMetrics.forceFullProcessingUsed).toBe(false)
    })
    
    test('should handle FFR disable failure gracefully', async () => {
      // Enable FFR but disable fails
      mockSupabase.rpc = jest.fn((functionName) => {
        if (functionName === 'should_force_full_reprocessing') {
          return Promise.resolve({ data: true, error: null })
        }
        if (functionName === 'disable_force_full_reprocessing') {
          return Promise.resolve({ data: null, error: { message: 'Disable failed' } })
        }
        return Promise.resolve({ data: null, error: null })
      })
      
      const opportunities = [generateNewOpportunity({ id: 'NEW-1' })]
      
      extractFromSource.mockResolvedValue({
        opportunities,
        extractionMetrics: {
          totalFound: 1,
          totalRetrieved: 1,
          totalTokens: 50,
          apiCalls: 1,
          executionTime: 50
        }
      })
      
      enhanceOpportunities.mockResolvedValue({
        opportunities,
        analysisMetrics: {
          totalTokens: 100,
          totalApiCalls: 1,
          executionTime: 50
        }
      })
      
      filterOpportunities.mockResolvedValue({
        includedOpportunities: opportunities,
        filterMetrics: { executionTime: 10 }
      })
      
      storeOpportunities.mockResolvedValue({
        metrics: {
          newOpportunities: 1,
          failed: 0,
          executionTime: 30
        }
      })
      
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Should still complete successfully
      expect(result.status).toBe('success')
      expect(result.enhancedMetrics.forceFullProcessingUsed).toBe(true)
      
      // Disable was attempted but failed
      expect(mockSupabase.rpc).toHaveBeenCalledWith('disable_force_full_reprocessing', {
        source_id: testSourceId
      })
    })
  })
  
  describe('Edge Cases', () => {
    test('should handle FFR with empty opportunity list', async () => {
      // Enable FFR
      mockSupabase.rpc = jest.fn((functionName) => {
        if (functionName === 'should_force_full_reprocessing') {
          return Promise.resolve({ data: true, error: null })
        }
        if (functionName === 'disable_force_full_reprocessing') {
          return Promise.resolve({ data: null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      })
      
      extractFromSource.mockResolvedValue({
        opportunities: [],
        extractionMetrics: {
          totalFound: 0,
          totalRetrieved: 0,
          totalTokens: 50,
          apiCalls: 1,
          executionTime: 50
        }
      })
      
      const result = await processApiSourceV2(
        testSourceId,
        null,
        mockSupabase,
        mockAnthropic
      )
      
      // Should complete without errors
      expect(result.status).toBe('success')
      expect(result.enhancedMetrics.forceFullProcessingUsed).toBe(true)
      
      // No opportunities to process
      expect(enhanceOpportunities).not.toHaveBeenCalled()
      expect(storeOpportunities).not.toHaveBeenCalled()
    })
  })
})