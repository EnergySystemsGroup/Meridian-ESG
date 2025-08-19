/**
 * Unit Tests for Parallel Coordinator Component
 * 
 * Tests the parallel execution coordination including:
 * - Simultaneous function execution
 * - Result validation logic
 * - ID-based merging
 * - Error propagation between parallel functions
 * - Missing data detection
 * - Performance timing
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import {
  generateOpportunity,
  generateMixedBatch,
  generateBatchWithAllEdgeCases
} from '../../fixtures/opportunities.js'
import {
  validContentEnhancementResponse,
  validScoringResponse
} from '../../fixtures/llmResponses.js'

// Import the mock functions directly
import { enhanceOpportunityContent } from '../../../__mocks__/lib/agents-v2/core/analysisAgent/contentEnhancer.js'
import { analyzeOpportunityScoring } from '../../../__mocks__/lib/agents-v2/core/analysisAgent/scoringAnalyzer.js'

// Import the module under test
import { 
  executeParallelAnalysis,
  validateParallelResults
} from '../../../lib/agents-v2/core/analysisAgent/parallelCoordinator.js'

describe('Parallel Coordinator Unit Tests', () => {
  let mockAnthropicClient
  let mockSource
  let consoleLogSpy
  let consoleErrorSpy
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Clear the manual mocks if they have the method
    if (enhanceOpportunityContent?.mockClear) {
      enhanceOpportunityContent.mockClear()
    }
    if (analyzeOpportunityScoring?.mockClear) {
      analyzeOpportunityScoring.mockClear()
    }
    
    mockAnthropicClient = {
      calculateOptimalBatchSize: jest.fn(() => ({
        batchSize: 5,
        maxTokens: 4000,
        modelName: 'claude-3-sonnet'
      }))
    }
    
    mockSource = {
      id: 'test-source',
      name: 'Test Source'
    }
    
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })
  
  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
  
  describe('Parallel Execution', () => {
    it('should execute content and scoring functions simultaneously', async () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001' }),
        generateOpportunity({ id: 'TEST-002' })
      ]
      
      // Track execution order
      const executionOrder = []
      
      enhanceOpportunityContent.mockImplementation(async () => {
        executionOrder.push('content-start')
        await new Promise(resolve => setTimeout(resolve, 50))
        executionOrder.push('content-end')
        return validContentEnhancementResponse
      })
      
      analyzeOpportunityScoring.mockImplementation(async () => {
        executionOrder.push('scoring-start')
        await new Promise(resolve => setTimeout(resolve, 30))
        executionOrder.push('scoring-end')
        return validScoringResponse
      })
      
      await executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      
      // Both should start before either ends (parallel execution)
      expect(executionOrder[0]).toBe('content-start')
      expect(executionOrder[1]).toBe('scoring-start')
      expect(executionOrder).toContain('content-end')
      expect(executionOrder).toContain('scoring-end')
    })
    
    it('should wait for both functions to complete', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      let contentComplete = false
      let scoringComplete = false
      
      enhanceOpportunityContent.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        contentComplete = true
        return [{ id: 'TEST-001', enhancedDescription: 'Enhanced', actionableSummary: 'Summary' }]
      })
      
      analyzeOpportunityScoring.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        scoringComplete = true
        return [{
          id: 'TEST-001',
          scoring: { total: 5, breakdown: { clientRelevance: 2, projectRelevance: 2, fundingAttractiveness: 1, fundingType: 0 } },
          relevanceReasoning: 'Test',
          concerns: []
        }]
      })
      
      const result = await executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      
      expect(contentComplete).toBe(true)
      expect(scoringComplete).toBe(true)
      expect(result.opportunities).toHaveLength(1)
    })
    
    it('should track execution time accurately', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      enhanceOpportunityContent.mockResolvedValue([{
        id: 'TEST-001',
        enhancedDescription: 'Enhanced',
        actionableSummary: 'Summary'
      }])
      
      analyzeOpportunityScoring.mockResolvedValue([{
        id: 'TEST-001',
        scoring: { total: 5, breakdown: { clientRelevance: 2, projectRelevance: 2, fundingAttractiveness: 1, fundingType: 0 } },
        relevanceReasoning: 'Test',
        concerns: []
      }])
      
      const startTime = Date.now()
      const result = await executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      const endTime = Date.now()
      
      expect(result.executionTime).toBeDefined()
      expect(result.executionTime).toBeGreaterThanOrEqual(0)
      expect(result.executionTime).toBeLessThanOrEqual(endTime - startTime + 10) // Allow 10ms margin
      expect(result.parallelProcessing).toBe(true)
    })
  })
  
  describe('Result Validation', () => {
    it('should validate matching counts between input and outputs', () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001' }),
        generateOpportunity({ id: 'TEST-002' })
      ]
      
      const contentResults = [
        { id: 'TEST-001', enhancedDescription: 'E1', actionableSummary: 'S1' },
        { id: 'TEST-002', enhancedDescription: 'E2', actionableSummary: 'S2' }
      ]
      
      const scoringResults = [
        { id: 'TEST-001', scoring: { total: 5 }, relevanceReasoning: 'R1' },
        { id: 'TEST-002', scoring: { total: 6 }, relevanceReasoning: 'R2' }
      ]
      
      const validation = validateParallelResults(opportunities, contentResults, scoringResults)
      
      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })
    
    it('should detect content count mismatch', () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001' }),
        generateOpportunity({ id: 'TEST-002' })
      ]
      
      const contentResults = [
        { id: 'TEST-001', enhancedDescription: 'E1', actionableSummary: 'S1' }
        // Missing TEST-002
      ]
      
      const scoringResults = [
        { id: 'TEST-001', scoring: { total: 5 }, relevanceReasoning: 'R1' },
        { id: 'TEST-002', scoring: { total: 6 }, relevanceReasoning: 'R2' }
      ]
      
      const validation = validateParallelResults(opportunities, contentResults, scoringResults)
      
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Content count mismatch: expected 2, got 1')
      expect(validation.issues).toContain('Missing content for opportunity ID: TEST-002')
    })
    
    it('should detect scoring count mismatch', () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001' }),
        generateOpportunity({ id: 'TEST-002' })
      ]
      
      const contentResults = [
        { id: 'TEST-001', enhancedDescription: 'E1', actionableSummary: 'S1' },
        { id: 'TEST-002', enhancedDescription: 'E2', actionableSummary: 'S2' }
      ]
      
      const scoringResults = [
        { id: 'TEST-001', scoring: { total: 5 }, relevanceReasoning: 'R1' }
        // Missing TEST-002
      ]
      
      const validation = validateParallelResults(opportunities, contentResults, scoringResults)
      
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Scoring count mismatch: expected 2, got 1')
      expect(validation.issues).toContain('Missing scoring for opportunity ID: TEST-002')
    })
    
    it('should detect missing IDs in results', () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001' }),
        generateOpportunity({ id: 'TEST-002' })
      ]
      
      const contentResults = [
        { id: 'TEST-001', enhancedDescription: 'E1', actionableSummary: 'S1' },
        { id: 'WRONG-ID', enhancedDescription: 'E2', actionableSummary: 'S2' } // Wrong ID
      ]
      
      const scoringResults = [
        { id: 'TEST-001', scoring: { total: 5 }, relevanceReasoning: 'R1' },
        { id: 'TEST-002', scoring: { total: 6 }, relevanceReasoning: 'R2' }
      ]
      
      const validation = validateParallelResults(opportunities, contentResults, scoringResults)
      
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Missing content for opportunity ID: TEST-002')
      expect(validation.issues).toContain('Extra content result for unknown ID: WRONG-ID')
    })
    
    it('should detect extra results not in original opportunities', () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001' })
      ]
      
      const contentResults = [
        { id: 'TEST-001', enhancedDescription: 'E1', actionableSummary: 'S1' },
        { id: 'EXTRA-001', enhancedDescription: 'Extra', actionableSummary: 'Extra' } // Extra
      ]
      
      const scoringResults = [
        { id: 'TEST-001', scoring: { total: 5 }, relevanceReasoning: 'R1' },
        { id: 'EXTRA-002', scoring: { total: 6 }, relevanceReasoning: 'Extra' } // Extra
      ]
      
      const validation = validateParallelResults(opportunities, contentResults, scoringResults)
      
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Extra content result for unknown ID: EXTRA-001')
      expect(validation.issues).toContain('Extra scoring result for unknown ID: EXTRA-002')
    })
    
    it('should handle empty results arrays', () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      const validation = validateParallelResults(opportunities, [], [])
      
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Content count mismatch: expected 1, got 0')
      expect(validation.issues).toContain('Scoring count mismatch: expected 1, got 0')
    })
  })
  
  describe('Result Merging', () => {
    it('should merge results correctly by ID', async () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001', title: 'Original Title 1' }),
        generateOpportunity({ id: 'TEST-002', title: 'Original Title 2' })
      ]
      
      enhanceOpportunityContent.mockResolvedValue([
        { id: 'TEST-001', enhancedDescription: 'Enhanced 1', actionableSummary: 'Summary 1' },
        { id: 'TEST-002', enhancedDescription: 'Enhanced 2', actionableSummary: 'Summary 2' }
      ])
      
      analyzeOpportunityScoring.mockResolvedValue([
        {
          id: 'TEST-001',
          scoring: { total: 7, breakdown: { clientRelevance: 2, projectRelevance: 2, fundingAttractiveness: 2, fundingType: 1 } },
          relevanceReasoning: 'Reasoning 1',
          concerns: ['Concern 1']
        },
        {
          id: 'TEST-002',
          scoring: { total: 5, breakdown: { clientRelevance: 1, projectRelevance: 2, fundingAttractiveness: 1, fundingType: 1 } },
          relevanceReasoning: 'Reasoning 2',
          concerns: []
        }
      ])
      
      const result = await executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.opportunities).toHaveLength(2)
      
      // Check first merged opportunity
      expect(result.opportunities[0].id).toBe('TEST-001')
      expect(result.opportunities[0].title).toBe('Original Title 1') // Original preserved
      expect(result.opportunities[0].enhancedDescription).toBe('Enhanced 1')
      expect(result.opportunities[0].actionableSummary).toBe('Summary 1')
      expect(result.opportunities[0].scoring.total).toBe(7)
      expect(result.opportunities[0].relevanceReasoning).toBe('Reasoning 1')
      expect(result.opportunities[0].concerns).toEqual(['Concern 1'])
      
      // Check second merged opportunity
      expect(result.opportunities[1].id).toBe('TEST-002')
      expect(result.opportunities[1].title).toBe('Original Title 2') // Original preserved
      expect(result.opportunities[1].enhancedDescription).toBe('Enhanced 2')
      expect(result.opportunities[1].scoring.total).toBe(5)
      expect(result.opportunities[1].concerns).toEqual([])
    })
    
    it('should preserve all original opportunity fields', async () => {
      const originalOpp = generateOpportunity({
        id: 'PRESERVE-001',
        title: 'Original Title',
        description: 'Original Description',
        minimumAward: 10000,
        maximumAward: 100000,
        closeDate: '2024-12-31',
        eligibleApplicants: ['Non-profit'],
        customField: 'Should be preserved'
      })
      
      enhanceOpportunityContent.mockResolvedValue([{
        id: 'PRESERVE-001',
        enhancedDescription: 'New Enhanced',
        actionableSummary: 'New Summary'
      }])
      
      analyzeOpportunityScoring.mockResolvedValue([{
        id: 'PRESERVE-001',
        scoring: { total: 5, breakdown: { clientRelevance: 2, projectRelevance: 2, fundingAttractiveness: 1, fundingType: 0 } },
        relevanceReasoning: 'New Reasoning',
        concerns: []
      }])
      
      const result = await executeParallelAnalysis([originalOpp], mockSource, mockAnthropicClient)
      
      const merged = result.opportunities[0]
      
      // Original fields preserved
      expect(merged.title).toBe('Original Title')
      expect(merged.description).toBe('Original Description')
      expect(merged.minimumAward).toBe(10000)
      expect(merged.maximumAward).toBe(100000)
      expect(merged.closeDate).toBe('2024-12-31')
      expect(merged.eligibleApplicants).toEqual(['Non-profit'])
      expect(merged.customField).toBe('Should be preserved')
      
      // New fields added
      expect(merged.enhancedDescription).toBe('New Enhanced')
      expect(merged.actionableSummary).toBe('New Summary')
      expect(merged.scoring.total).toBe(5)
      expect(merged.relevanceReasoning).toBe('New Reasoning')
    })
    
    it('should handle missing concerns field gracefully', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      enhanceOpportunityContent.mockResolvedValue([{
        id: 'TEST-001',
        enhancedDescription: 'Enhanced',
        actionableSummary: 'Summary'
      }])
      
      analyzeOpportunityScoring.mockResolvedValue([{
        id: 'TEST-001',
        scoring: { total: 5, breakdown: { clientRelevance: 2, projectRelevance: 2, fundingAttractiveness: 1, fundingType: 0 } },
        relevanceReasoning: 'Reasoning'
        // No concerns field
      }])
      
      const result = await executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      
      // Should default to empty array
      expect(result.opportunities[0].concerns).toEqual([])
    })
    
    it('should handle results in different order than input', async () => {
      const opportunities = [
        generateOpportunity({ id: 'ORDER-001' }),
        generateOpportunity({ id: 'ORDER-002' }),
        generateOpportunity({ id: 'ORDER-003' })
      ]
      
      // Return results in different order
      enhanceOpportunityContent.mockResolvedValue([
        { id: 'ORDER-003', enhancedDescription: 'E3', actionableSummary: 'S3' },
        { id: 'ORDER-001', enhancedDescription: 'E1', actionableSummary: 'S1' },
        { id: 'ORDER-002', enhancedDescription: 'E2', actionableSummary: 'S2' }
      ])
      
      analyzeOpportunityScoring.mockResolvedValue([
        { id: 'ORDER-002', scoring: { total: 2 }, relevanceReasoning: 'R2', concerns: [] },
        { id: 'ORDER-003', scoring: { total: 3 }, relevanceReasoning: 'R3', concerns: [] },
        { id: 'ORDER-001', scoring: { total: 1 }, relevanceReasoning: 'R1', concerns: [] }
      ])
      
      const result = await executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      
      // Should merge correctly despite order
      expect(result.opportunities[0].id).toBe('ORDER-001')
      expect(result.opportunities[0].enhancedDescription).toBe('E1')
      expect(result.opportunities[0].scoring.total).toBe(1)
      
      expect(result.opportunities[1].id).toBe('ORDER-002')
      expect(result.opportunities[1].enhancedDescription).toBe('E2')
      expect(result.opportunities[1].scoring.total).toBe(2)
      
      expect(result.opportunities[2].id).toBe('ORDER-003')
      expect(result.opportunities[2].enhancedDescription).toBe('E3')
      expect(result.opportunities[2].scoring.total).toBe(3)
    })
  })
  
  describe('Error Handling', () => {
    it('should propagate content enhancement errors', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      enhanceOpportunityContent.mockRejectedValue(new Error('Content API failed'))
      analyzeOpportunityScoring.mockResolvedValue([{
        id: 'TEST-001',
        scoring: { total: 5 },
        relevanceReasoning: 'Test',
        concerns: []
      }])
      
      await expect(
        executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow('Content API failed')
    })
    
    it('should propagate scoring analysis errors', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      enhanceOpportunityContent.mockResolvedValue([{
        id: 'TEST-001',
        enhancedDescription: 'Enhanced',
        actionableSummary: 'Summary'
      }])
      analyzeOpportunityScoring.mockRejectedValue(new Error('Scoring API failed'))
      
      await expect(
        executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow('Scoring API failed')
    })
    
    it('should fail if both functions error', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      enhanceOpportunityContent.mockRejectedValue(new Error('Content failed'))
      analyzeOpportunityScoring.mockRejectedValue(new Error('Scoring failed'))
      
      await expect(
        executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow() // Will throw one of the errors
    })
    
    it('should throw validation error for mismatched results', async () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001' }),
        generateOpportunity({ id: 'TEST-002' })
      ]
      
      // Content missing TEST-002
      enhanceOpportunityContent.mockResolvedValue([{
        id: 'TEST-001',
        enhancedDescription: 'Enhanced',
        actionableSummary: 'Summary'
      }])
      
      analyzeOpportunityScoring.mockResolvedValue([
        { id: 'TEST-001', scoring: { total: 5 }, relevanceReasoning: 'R1', concerns: [] },
        { id: 'TEST-002', scoring: { total: 6 }, relevanceReasoning: 'R2', concerns: [] }
      ])
      
      await expect(
        executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow('Parallel analysis validation failed')
    })
    
    it('should throw error if required data is missing during merge', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      // Provide wrong IDs that will cause merge to fail
      enhanceOpportunityContent.mockResolvedValue([{
        id: 'WRONG-ID', // Wrong ID will cause merge to fail
        enhancedDescription: 'Enhanced',
        actionableSummary: 'Summary'
      }])
      
      analyzeOpportunityScoring.mockResolvedValue([{
        id: 'WRONG-ID',
        scoring: { total: 5 },
        relevanceReasoning: 'Test',
        concerns: []
      }])
      
      // Should fail during validation stage before merge
      await expect(
        executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow('Missing content for opportunity ID: TEST-001')
    })
  })
  
  describe('Performance', () => {
    it('should complete faster than sequential execution', async () => {
      const opportunities = generateMixedBatch()
      
      // Simulate time-consuming operations
      const contentDelay = 100
      const scoringDelay = 80
      
      enhanceOpportunityContent.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, contentDelay))
        return opportunities.map(o => ({
          id: o.id,
          enhancedDescription: 'Enhanced',
          actionableSummary: 'Summary'
        }))
      })
      
      analyzeOpportunityScoring.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, scoringDelay))
        return opportunities.map(o => ({
          id: o.id,
          scoring: { total: 5, breakdown: { clientRelevance: 2, projectRelevance: 2, fundingAttractiveness: 1, fundingType: 0 } },
          relevanceReasoning: 'Test',
          concerns: []
        }))
      })
      
      const startTime = Date.now()
      const result = await executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      const parallelTime = Date.now() - startTime
      
      // Parallel should take approximately max(contentDelay, scoringDelay)
      // Sequential would take contentDelay + scoringDelay
      const expectedSequentialTime = contentDelay + scoringDelay
      
      expect(parallelTime).toBeLessThan(expectedSequentialTime)
      expect(result.parallelProcessing).toBe(true)
      expect(result.executionTime).toBeLessThan(expectedSequentialTime)
    })
    
    it('should handle large batches efficiently', async () => {
      const largeBatch = Array(50).fill(null).map((_, i) => 
        generateOpportunity({ id: `LARGE-${i}` })
      )
      
      enhanceOpportunityContent.mockResolvedValue(
        largeBatch.map(o => ({
          id: o.id,
          enhancedDescription: `Enhanced ${o.id}`,
          actionableSummary: `Summary ${o.id}`
        }))
      )
      
      analyzeOpportunityScoring.mockResolvedValue(
        largeBatch.map(o => ({
          id: o.id,
          scoring: { total: 5, breakdown: { clientRelevance: 2, projectRelevance: 2, fundingAttractiveness: 1, fundingType: 0 } },
          relevanceReasoning: `Reasoning ${o.id}`,
          concerns: []
        }))
      )
      
      const startTime = Date.now()
      const result = await executeParallelAnalysis(largeBatch, mockSource, mockAnthropicClient)
      const executionTime = Date.now() - startTime
      
      expect(result.opportunities).toHaveLength(50)
      expect(executionTime).toBeLessThan(1000) // Should complete quickly even with large batch
      
      // Verify all IDs are present
      const resultIds = result.opportunities.map(o => o.id)
      largeBatch.forEach(opp => {
        expect(resultIds).toContain(opp.id)
      })
    })
    
    it('should log performance metrics', async () => {
      const opportunities = [generateOpportunity({ id: 'PERF-001' })]
      
      enhanceOpportunityContent.mockResolvedValue([{
        id: 'PERF-001',
        enhancedDescription: 'E',
        actionableSummary: 'S'
      }])
      
      analyzeOpportunityScoring.mockResolvedValue([{
        id: 'PERF-001',
        scoring: { total: 5, breakdown: { clientRelevance: 2, projectRelevance: 2, fundingAttractiveness: 1, fundingType: 0 } },
        relevanceReasoning: 'R',
        concerns: []
      }])
      
      await executeParallelAnalysis(opportunities, mockSource, mockAnthropicClient)
      
      // Should log start, completion, and timing
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ParallelCoordinator]')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting parallel analysis')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Parallel execution completed')
      )
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle empty opportunities array', async () => {
      enhanceOpportunityContent.mockResolvedValue([])
      analyzeOpportunityScoring.mockResolvedValue([])
      
      const result = await executeParallelAnalysis([], mockSource, mockAnthropicClient)
      
      expect(result.opportunities).toEqual([])
      expect(result.parallelProcessing).toBe(true)
    })
    
    it('should handle single opportunity', async () => {
      const singleOpp = generateOpportunity({ id: 'SINGLE-001' })
      
      enhanceOpportunityContent.mockResolvedValue([{
        id: 'SINGLE-001',
        enhancedDescription: 'E',
        actionableSummary: 'S'
      }])
      
      analyzeOpportunityScoring.mockResolvedValue([{
        id: 'SINGLE-001',
        scoring: { total: 5, breakdown: { clientRelevance: 2, projectRelevance: 2, fundingAttractiveness: 1, fundingType: 0 } },
        relevanceReasoning: 'R',
        concerns: []
      }])
      
      const result = await executeParallelAnalysis([singleOpp], mockSource, mockAnthropicClient)
      
      expect(result.opportunities).toHaveLength(1)
      expect(result.opportunities[0].id).toBe('SINGLE-001')
    })
    
    it('should handle edge case opportunities', async () => {
      const edgeCases = generateBatchWithAllEdgeCases()
      
      enhanceOpportunityContent.mockResolvedValue(
        edgeCases.map(o => ({
          id: o.id,
          enhancedDescription: `Enhanced ${o.id}`,
          actionableSummary: `Summary ${o.id}`
        }))
      )
      
      analyzeOpportunityScoring.mockResolvedValue(
        edgeCases.map(o => ({
          id: o.id,
          scoring: { total: 5, breakdown: { clientRelevance: 2, projectRelevance: 2, fundingAttractiveness: 1, fundingType: 0 } },
          relevanceReasoning: `Reasoning ${o.id}`,
          concerns: []
        }))
      )
      
      const result = await executeParallelAnalysis(edgeCases, mockSource, mockAnthropicClient)
      
      expect(result.opportunities).toHaveLength(edgeCases.length)
      
      // Verify each edge case is properly merged
      edgeCases.forEach((original, index) => {
        const merged = result.opportunities[index]
        expect(merged.id).toBe(original.id)
        expect(merged.enhancedDescription).toBe(`Enhanced ${original.id}`)
        expect(merged.scoring.total).toBe(5)
      })
    })
  })
})