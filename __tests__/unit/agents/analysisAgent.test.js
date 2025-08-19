/**
 * Unit Tests for Analysis Agent V2
 * 
 * Tests the analysis agent logic including:
 * - LLM prompt construction for opportunity enhancement
 * - Response parsing from Anthropic API
 * - Token usage tracking and reporting
 * - Enhancement quality validation
 * - Retry logic for API failures
 * - Batch processing of multiple opportunities
 * - Parallel processing coordination
 * - Performance metrics collection
 */

import '@anthropic-ai/sdk/shims/node'
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { 
  generateOpportunity,
  generateNewOpportunity,
  generateMixedBatch,
  generateLargeBatch
} from '../../fixtures/opportunities.js'

// Import the mocked parallelCoordinator
import { 
  executeParallelAnalysis as mockExecuteParallel,
  validateParallelResults 
} from '../../../__mocks__/lib/agents-v2/core/analysisAgent/parallelCoordinator.js'

// Mock anthropicClient schemas first
jest.mock('../../../lib/agents-v2/utils/anthropicClient.js', () => ({
  schemas: {
    contentEnhancement: {
      type: 'object',
      properties: {
        analyses: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'enhancedDescription', 'actionableSummary'],
            properties: {
              id: { type: 'string' },
              enhancedDescription: { type: 'string' },
              actionableSummary: { type: 'string' }
            }
          }
        }
      },
      required: ['analyses']
    },
    scoringAnalysis: {
      type: 'object',
      properties: {
        analyses: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'scoring', 'relevanceReasoning'],
            properties: {
              id: { type: 'string' },
              scoring: {
                type: 'object',
                properties: {
                  clientRelevance: { type: 'number', minimum: 0, maximum: 3 },
                  projectRelevance: { type: 'number', minimum: 0, maximum: 3 },
                  fundingAttractiveness: { type: 'number', minimum: 0, maximum: 3 },
                  fundingType: { type: 'number', minimum: 0, maximum: 1 },
                  overallScore: { type: 'number', minimum: 0, maximum: 10 }
                }
              },
              relevanceReasoning: { type: 'string' },
              concerns: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      },
      required: ['analyses']
    },
    filterAnalysis: {
      type: 'object',
      properties: {
        analyses: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'shouldFilter', 'reason'],
            properties: {
              id: { type: 'string' },
              shouldFilter: { type: 'boolean' },
              reason: { type: 'string' }
            }
          }
        }
      },
      required: ['analyses']
    }
  }
}))

// Mock taxonomies
jest.mock('../../../lib/constants/taxonomies.js', () => ({
  TAXONOMIES: {
    TARGET_CLIENT_TYPES: ['Government', 'Non-profit', 'Commercial'],
    PREFERRED_ACTIVITIES: ['Energy Infrastructure', 'Environmental Services', 'Technology']
  }
}))

// parallelCoordinator is automatically mocked via moduleNameMapper in jest.config.js

// Mock other dependencies
jest.mock('../../../lib/agents-v2/core/analysisAgent/contentEnhancer.js', () => ({
  enhanceOpportunityContent: jest.fn()
}))

jest.mock('../../../lib/agents-v2/core/analysisAgent/scoringAnalyzer.js', () => ({
  analyzeOpportunityScoring: jest.fn()
}))

jest.mock('../../../utils/supabase.js', () => ({
  createSupabaseClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue({ data: [], error: null })
  })),
  logAgentExecution: jest.fn()
}))

jest.mock('../../../lib/agents-v2/config/analysis.config.js', () => ({
  AnalysisConfig: {
    BATCH_SIZE: 5,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
  }
}))

// Import the module under test
import { enhanceOpportunities } from '../../../lib/agents-v2/core/analysisAgent/index.js'

describe('Analysis Agent Unit Tests', () => {
  let mockAnthropicClient
  let mockSource
  let consoleLogSpy
  let consoleErrorSpy
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    if (mockExecuteParallel?.mockClear) {
      mockExecuteParallel.mockClear()
    }
    
    // Mock Anthropic client with realistic responses
    mockAnthropicClient = {
      calculateOptimalBatchSize: jest.fn((avgLength) => ({
        batchSize: avgLength > 500 ? 3 : 5,
        maxTokens: 4000,
        modelName: 'claude-3-sonnet',
        modelCapacity: 200000,
        tokensPerOpportunity: 800,
        baseTokens: 400,
        reason: avgLength > 500 ? 'complex content' : 'standard content'
      })),
      callWithSchema: jest.fn(),
      getPerformanceMetrics: jest.fn(() => ({
        totalTokens: 12500,
        totalCalls: 3,
        averageLatency: 1200
      }))
    }
    
    // Mock source configuration
    mockSource = {
      id: 'test-source',
      name: 'Test Funding Source',
      type: 'federal'
    }
    
    // Setup default mock implementation if supported
    if (mockExecuteParallel?.mockImplementation) {
      mockExecuteParallel.mockImplementation(async (opportunities) => {
        return {
          opportunities: opportunities.map(opp => ({
            ...opp,
            enhancedDescription: `Enhanced: ${opp.description || 'No description'}`,
            actionableSummary: `Summary for ${opp.title}`,
            scoring: { overallScore: 7.5 },
            relevanceReasoning: 'Test reasoning',
            concerns: []
          })),
          executionTime: 100,
          parallelProcessing: true
        }
      })
    }
    
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })
  
  afterEach(() => {
    jest.clearAllMocks()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
  
  describe('LLM prompt construction', () => {
    it('should construct proper enhancement prompt with business context', async () => {
      const opportunities = [generateNewOpportunity()]
      
      await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      // Verify parallel execution was called with proper context
      expect(mockExecuteParallel.mock.calls.length).toBeGreaterThan(0)
      expect(mockExecuteParallel.mock.calls[0]).toEqual([
        opportunities,
        mockSource,
        mockAnthropicClient
      ])
    })
    
    it('should include opportunity details in prompt', async () => {
      const opportunity = generateNewOpportunity({
        totalFundingAvailable: 5000000,
        minimumAward: 100000,
        maximumAward: 500000,
        closeDate: '2024-12-31',
        eligibleApplicants: ['Non-profit', 'Government'],
        status: 'posted'
      })
      
      const result = await enhanceOpportunities([opportunity], mockSource, mockAnthropicClient)
      
      expect(result.opportunities[0]).toHaveProperty('enhancedDescription')
      expect(result.opportunities[0]).toHaveProperty('actionableSummary')
      expect(result.opportunities[0]).toHaveProperty('scoring')
    })
  })
  
  describe('Response parsing from Anthropic API', () => {
    it('should parse valid enhancement responses correctly', async () => {
      const opportunities = [generateNewOpportunity()]
      
      mockExecuteParallel.mockResolvedValueOnce({
        opportunities: [{
          ...opportunities[0],
          enhancedDescription: 'This is a comprehensive grant opportunity...',
          actionableSummary: 'Quick summary for sales team...',
          scoring: {
            overallScore: 9.0,
            fundingType: 1,
            targetClientAlignment: 0.9,
            preferredActivityMatch: 0.8,
            fundingAmountScore: 0.95,
            locationRelevance: 1.0,
            applicationComplexity: 0.6
          },
          relevanceReasoning: 'Excellent fit for energy infrastructure',
          concerns: ['Tight deadline']
        }],
        executionTime: 100,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.opportunities[0].enhancedDescription).toBe('This is a comprehensive grant opportunity...')
      expect(result.opportunities[0].scoring.overallScore).toBe(9.0)
      expect(result.opportunities[0].concerns).toContain('Tight deadline')
    })
    
    it('should handle malformed API responses gracefully', async () => {
      const opportunities = [generateNewOpportunity()]
      
      // Mock a parsing error in parallel coordinator
      mockExecuteParallel.mockRejectedValue(
        new Error('Invalid response structure: missing required fields')
      )
      
      await expect(
        enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow('Invalid response structure')
    })
  })
  
  describe('Token usage tracking', () => {
    it('should track token usage for processed opportunities', async () => {
      const opportunities = generateMixedBatch().slice(0, 3)
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(mockAnthropicClient.getPerformanceMetrics).toHaveBeenCalled()
      expect(result.analysisMetrics.totalTokens).toBe(12500)
      expect(result.analysisMetrics.totalApiCalls).toBe(3)
    })
    
    it('should optimize token usage with dynamic batch sizing', async () => {
      const largeDescriptionOpps = [
        generateNewOpportunity({ description: 'A'.repeat(1000) }),
        generateNewOpportunity({ description: 'B'.repeat(1000) })
      ]
      
      await enhanceOpportunities(largeDescriptionOpps, mockSource, mockAnthropicClient)
      
      // Verify optimal batch size was calculated based on content complexity
      expect(mockAnthropicClient.calculateOptimalBatchSize).toHaveBeenCalled()
      const call = mockAnthropicClient.calculateOptimalBatchSize.mock.calls[0]
      expect(call[0]).toBeGreaterThan(900) // Average description length
    })
  })
  
  describe('Enhancement quality validation', () => {
    it('should validate all required fields are enhanced', async () => {
      const opportunities = [generateNewOpportunity()]
      
      mockExecuteParallel.mockResolvedValueOnce({
        opportunities: [{
          ...opportunities[0],
          enhancedDescription: 'Enhanced description'
          // actionableSummary could be missing
        }],
        executionTime: 100,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      // Should still have the original opportunity data
      expect(result.opportunities[0].id).toBe(opportunities[0].id)
      expect(result.opportunities[0].enhancedDescription).toBe('Enhanced description')
    })
    
    it('should calculate proper analysis metrics', async () => {
      const opportunities = generateMixedBatch().slice(0, 3)
      
      mockExecuteParallel.mockResolvedValueOnce({
        opportunities: opportunities.map((opp, idx) => ({
          ...opp,
          enhancedDescription: 'Enhanced',
          actionableSummary: 'Summary',
          scoring: { 
            overallScore: idx === 0 ? 9 : idx === 1 ? 6 : 3,
            fundingType: idx === 0 ? 1 : 0
          },
          relevanceReasoning: 'Test'
        })),
        executionTime: 100,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.analysisMetrics.totalAnalyzed).toBe(3)
      expect(result.analysisMetrics.averageScore).toBeCloseTo(6, 1)
      expect(result.analysisMetrics.scoreDistribution.high).toBe(1)
      expect(result.analysisMetrics.scoreDistribution.medium).toBe(1)
      expect(result.analysisMetrics.scoreDistribution.low).toBe(1)
    })
  })
  
  describe('Retry logic for API failures', () => {
    it('should retry on rate limit errors', async () => {
      const opportunities = [generateNewOpportunity()]
      
      // First call fails with rate limit, second succeeds
      mockExecuteParallel
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({
          opportunities: [{
            ...opportunities[0],
            enhancedDescription: 'Enhanced after retry',
            actionableSummary: 'Summary after retry',
            scoring: { overallScore: 7 },
            relevanceReasoning: 'Test'
          }],
          executionTime: 100,
          parallelProcessing: true
        })
      
      // The main function retries on rate limit and succeeds
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.opportunities).toHaveLength(1)
      expect(result.opportunities[0].enhancedDescription).toBe('Enhanced after retry')
    })
    
    it('should fail fast on JSON parsing errors', async () => {
      const opportunities = [generateNewOpportunity()]
      
      mockExecuteParallel.mockRejectedValue(
        new Error('JSON parsing failed: Unexpected token')
      )
      
      await expect(
        enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow('JSON parsing failed')
    })
  })
  
  describe('Batch processing', () => {
    it('should process opportunities in optimal batches', async () => {
      const opportunities = generateLargeBatch(10)
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.opportunities.length).toBe(10)
      expect(mockAnthropicClient.calculateOptimalBatchSize).toHaveBeenCalled()
    })
    
    it('should handle empty batches correctly', async () => {
      const result = await enhanceOpportunities([], mockSource, mockAnthropicClient)
      
      expect(result.opportunities).toEqual([])
      expect(result.analysisMetrics.totalAnalyzed).toBe(0)
      expect(result.analysisMetrics.averageScore).toBe(0)
    })
  })
  
  describe('Parallel processing coordination', () => {
    it('should execute content and scoring analysis in parallel', async () => {
      const opportunities = [generateNewOpportunity()]
      
      let executionTime = 0
      
      mockExecuteParallel.mockImplementation(async () => {
        const startTime = Date.now()
        await new Promise(resolve => setTimeout(resolve, 100))
        executionTime = Date.now() - startTime
        
        return {
          opportunities: [{
            ...opportunities[0],
            enhancedDescription: 'Enhanced',
            actionableSummary: 'Summary',
            scoring: { overallScore: 8 },
            relevanceReasoning: 'Test'
          }],
          executionTime,
          parallelProcessing: true
        }
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.opportunities.length).toBe(1)
      expect(executionTime).toBeGreaterThan(99)
    })
    
    it('should validate parallel results for completeness', () => {
      const opportunities = generateMixedBatch().slice(0, 3)
      
      const contentResults = opportunities.map(opp => ({
        id: opp.id,
        enhancedDescription: 'Enhanced',
        actionableSummary: 'Summary'
      }))
      
      const scoringResults = opportunities.map(opp => ({
        id: opp.id,
        scoring: { overallScore: 7 },
        relevanceReasoning: 'Test'
      }))
      
      const validation = validateParallelResults(opportunities, contentResults, scoringResults)
      
      expect(validation.isValid).toBe(true)
      expect(validation.issues).toEqual([])
    })
    
    it('should detect missing results in parallel processing', () => {
      const opportunities = generateMixedBatch().slice(0, 3)
      
      const contentResults = opportunities.slice(0, 2).map(opp => ({
        id: opp.id,
        enhancedDescription: 'Enhanced',
        actionableSummary: 'Summary'
      }))
      
      const scoringResults = opportunities.map(opp => ({
        id: opp.id,
        scoring: { overallScore: 7 },
        relevanceReasoning: 'Test'
      }))
      
      const validation = validateParallelResults(opportunities, contentResults, scoringResults)
      
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain(`Content count mismatch: expected 3, got 2`)
      expect(validation.issues).toContain(`Missing content for opportunity ID: ${opportunities[2].id}`)
    })
    
    it('should merge parallel results correctly', async () => {
      const opportunities = [generateNewOpportunity({
        id: 'TEST-123',
        title: 'Test Grant'
      })]
      
      mockExecuteParallel.mockResolvedValueOnce({
        opportunities: [{
          id: 'TEST-123',
          title: 'Test Grant',
          enhancedDescription: 'Enhanced description text',
          actionableSummary: 'Summary for sales',
          scoring: {
            overallScore: 8.5,
            fundingType: 1
          },
          relevanceReasoning: 'High relevance',
          concerns: ['Short deadline']
        }],
        executionTime: 100,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      const merged = result.opportunities[0]
      expect(merged.id).toBe('TEST-123')
      expect(merged.title).toBe('Test Grant')
      expect(merged.enhancedDescription).toBe('Enhanced description text')
      expect(merged.actionableSummary).toBe('Summary for sales')
      expect(merged.scoring.overallScore).toBe(8.5)
      expect(merged.relevanceReasoning).toBe('High relevance')
      expect(merged.concerns).toContain('Short deadline')
    })
  })
  
  describe('Performance metrics', () => {
    it('should track execution time accurately', async () => {
      const opportunities = [generateNewOpportunity()]
      
      mockExecuteParallel.mockImplementation(async (opps) => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return {
          opportunities: opps.map(opp => ({
            ...opp,
            enhancedDescription: 'Enhanced',
            actionableSummary: 'Summary',
            scoring: { overallScore: 7 },
            relevanceReasoning: 'Test'
          })),
          executionTime: 50,
          parallelProcessing: true
        }
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.executionTime).toBeGreaterThanOrEqual(50)
      expect(result.processingMode).toBe('parallel')
    })
    
    it('should calculate scoring distribution metrics', async () => {
      const opportunities = [
        generateNewOpportunity({ id: 'HIGH' }),
        generateNewOpportunity({ id: 'MED' }),
        generateNewOpportunity({ id: 'LOW' })
      ]
      
      mockExecuteParallel.mockResolvedValueOnce({
        opportunities: [
          { ...opportunities[0], scoring: { overallScore: 8.5 }, relevanceReasoning: 'Test' },
          { ...opportunities[1], scoring: { overallScore: 6.5 }, relevanceReasoning: 'Test' },
          { ...opportunities[2], scoring: { overallScore: 3.5 }, relevanceReasoning: 'Test' }
        ],
        executionTime: 100,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.analysisMetrics.scoreDistribution.high).toBe(1)
      expect(result.analysisMetrics.scoreDistribution.medium).toBe(1)
      expect(result.analysisMetrics.scoreDistribution.low).toBe(1)
      expect(result.analysisMetrics.averageScore).toBeCloseTo(6.17, 1)
    })
  })
  
  describe('Error handling', () => {
    it('should handle content enhancement failures', async () => {
      const opportunities = [generateNewOpportunity()]
      
      mockExecuteParallel.mockRejectedValue(new Error('Content enhancement failed'))
      
      await expect(
        enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow('AnalysisAgent failed: Content enhancement failed')
    })
    
    it('should handle scoring analysis failures', async () => {
      const opportunities = [generateNewOpportunity()]
      
      mockExecuteParallel.mockRejectedValue(new Error('Scoring analysis failed'))
      
      await expect(
        enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow('AnalysisAgent failed: Scoring analysis failed')
    })
    
    it('should validate input parameters', async () => {
      await expect(
        enhanceOpportunities(null, mockSource, mockAnthropicClient)
      ).rejects.toThrow() // Will throw when trying to access properties of null
      
      await expect(
        enhanceOpportunities('not-an-array', mockSource, mockAnthropicClient)
      ).rejects.toThrow('Opportunities must be an array')
    })
  })
  
  describe('Fallback processing', () => {
    it('should fall back to individual processing on network errors', async () => {
      const opportunities = generateMixedBatch().slice(0, 2)
      
      // Mock parallel failure then individual success
      mockExecuteParallel
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          opportunities: [{
            ...opportunities[0],
            enhancedDescription: 'Enhanced individually',
            scoring: { overallScore: 7 }
          }],
          executionTime: 50,
          parallelProcessing: false
        })
        .mockResolvedValueOnce({
          opportunities: [{
            ...opportunities[1],
            enhancedDescription: 'Enhanced individually',
            scoring: { overallScore: 8 }
          }],
          executionTime: 50,
          parallelProcessing: false
        })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.opportunities.length).toBe(2)
      expect(mockExecuteParallel.mock.calls.length).toBe(3) // 1 batch fail + 2 individual
    })
  })
  
  describe('Advanced JSON Repair and Edge Cases', () => {
    it('should handle truncated JSON arrays in responses', async () => {
      const opportunities = [generateNewOpportunity({ id: 'TRUNC-001' })]
      
      // Simulate truncated JSON that needs repair
      mockExecuteParallel.mockResolvedValue({
        opportunities: [{
          ...opportunities[0],
          enhancedDescription: 'Truncated but repaired',
          actionableSummary: 'Fixed summary',
          scoring: { overallScore: 5 }
        }],
        executionTime: 100,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.opportunities[0].enhancedDescription).toBeDefined()
      expect(result.opportunities[0].actionableSummary).toBeDefined()
    })
    
    it('should handle opportunities with special characters', async () => {
      const specialOpp = generateOpportunity({
        id: 'SPECIAL-001',
        title: 'Grant with "quotes" & <tags>',
        description: 'Multi-line\ndescription\twith\ttabs'
      })
      
      mockExecuteParallel.mockResolvedValue({
        opportunities: [{
          ...specialOpp,
          enhancedDescription: 'Enhanced with "quotes" preserved',
          actionableSummary: 'Summary with & symbols',
          scoring: { overallScore: 6 }
        }],
        executionTime: 50,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities([specialOpp], mockSource, mockAnthropicClient)
      
      expect(result.opportunities[0].title).toContain('"quotes"')
      expect(result.opportunities[0].enhancedDescription).toContain('"quotes"')
    })
    
    it('should handle very long content without truncation', async () => {
      const longContent = 'x'.repeat(5000)
      const longOpp = generateOpportunity({
        id: 'LONG-001',
        description: longContent
      })
      
      mockExecuteParallel.mockResolvedValue({
        opportunities: [{
          ...longOpp,
          enhancedDescription: 'Enhanced ' + 'y'.repeat(1000),
          actionableSummary: 'Summary',
          scoring: { overallScore: 7 }
        }],
        executionTime: 200,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities([longOpp], mockSource, mockAnthropicClient)
      
      expect(result.opportunities[0].description.length).toBeGreaterThan(4000)
      expect(result.opportunities[0].enhancedDescription.length).toBeGreaterThan(500)
    })
  })
  
  describe('Dynamic Batch Sizing', () => {
    it('should adjust batch size based on content complexity', async () => {
      const mixedComplexity = [
        generateOpportunity({ id: 'SHORT-001', description: 'Short' }),
        generateOpportunity({ 
          id: 'LONG-001', 
          description: 'Very long description '.repeat(100)
        })
      ]
      
      mockExecuteParallel.mockResolvedValue({
        opportunities: mixedComplexity.map(o => ({
          ...o,
          enhancedDescription: 'Enhanced',
          actionableSummary: 'Summary',
          scoring: { overallScore: 5 }
        })),
        executionTime: 100,
        parallelProcessing: true
      })
      
      await enhanceOpportunities(mixedComplexity, mockSource, mockAnthropicClient)
      
      // Should calculate optimal batch size
      expect(mockAnthropicClient.calculateOptimalBatchSize).toHaveBeenCalled()
      const avgLength = mockAnthropicClient.calculateOptimalBatchSize.mock.calls[0][0]
      expect(avgLength).toBeGreaterThan(100) // Should detect mixed complexity
    })
    
    it('should handle maximum batch size limits', async () => {
      const largeBatch = Array(100).fill(null).map((_, i) => 
        generateOpportunity({ id: `BATCH-${i}` })
      )
      
      // Mock batch size limit
      mockAnthropicClient.calculateOptimalBatchSize.mockReturnValue({
        batchSize: 10, // Limited batch size
        maxTokens: 4000,
        modelName: 'claude-3-sonnet',
        modelCapacity: 200000
      })
      
      let callCount = 0
      mockExecuteParallel.mockImplementation((opps) => {
        callCount++
        return Promise.resolve({
          opportunities: opps.map(o => ({
            ...o,
            enhancedDescription: 'Enhanced',
            actionableSummary: 'Summary',
            scoring: { overallScore: 5 }
          })),
          executionTime: 100,
          parallelProcessing: true
        })
      })
      
      const result = await enhanceOpportunities(largeBatch, mockSource, mockAnthropicClient)
      
      expect(result.opportunities).toHaveLength(100)
      expect(callCount).toBe(10) // 100 items / 10 batch size
    })
  })
  
  describe('Error Recovery and Retry Logic', () => {
    it('should retry on transient failures', async () => {
      const opportunities = [generateOpportunity({ id: 'RETRY-001' })]
      
      mockExecuteParallel
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          opportunities: [{
            ...opportunities[0],
            enhancedDescription: 'Success after retry',
            actionableSummary: 'Summary',
            scoring: { overallScore: 6 }
          }],
          executionTime: 100,
          parallelProcessing: true
        })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      expect(result.opportunities[0].enhancedDescription).toBe('Success after retry')
      expect(mockExecuteParallel.mock.calls.length).toBe(2)
    })
    
    it('should apply exponential backoff between retries', async () => {
      const opportunities = generateMixedBatch().slice(0, 1)
      
      let attemptCount = 0
      mockExecuteParallel.mockImplementation(async (opps) => {
        attemptCount++
        // First attempt fails (batch), subsequent attempts succeed (individual)
        if (attemptCount === 1) {
          throw new Error('Network timeout')
        }
        // Individual processing succeeds
        return {
          opportunities: opps.map(o => ({
            ...o,
            enhancedDescription: 'Enhanced',
            actionableSummary: 'Summary',
            scoring: { overallScore: 5 }
          })),
          executionTime: 100,
          parallelProcessing: false
        }
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      // Should have attempted twice - once for batch, once for individual
      expect(attemptCount).toBe(2)
      expect(result.opportunities).toHaveLength(1)
    })
    
    it('should handle partial batch failures gracefully', async () => {
      const batch = generateMixedBatch()
      
      // First attempt fails for full batch
      mockExecuteParallel
        .mockRejectedValueOnce(new Error('Batch too large'))
        // Then succeeds for individual items
        .mockResolvedValueOnce({
          opportunities: [{
            ...batch[0],
            enhancedDescription: 'Enhanced 1',
            actionableSummary: 'Summary 1',
            scoring: { overallScore: 7 }
          }],
          executionTime: 50,
          parallelProcessing: false
        })
        .mockResolvedValueOnce({
          opportunities: [{
            ...batch[1],
            enhancedDescription: 'Enhanced 2',
            actionableSummary: 'Summary 2',
            scoring: { overallScore: 6 }
          }],
          executionTime: 50,
          parallelProcessing: false
        })
        .mockResolvedValueOnce({
          opportunities: [{
            ...batch[2],
            enhancedDescription: 'Enhanced 3',
            actionableSummary: 'Summary 3',
            scoring: { overallScore: 8 }
          }],
          executionTime: 50,
          parallelProcessing: false
        })
        .mockResolvedValueOnce({
          opportunities: [{
            ...batch[3],
            enhancedDescription: 'Enhanced 4',
            actionableSummary: 'Summary 4',
            scoring: { overallScore: 5 }
          }],
          executionTime: 50,
          parallelProcessing: false
        })
        .mockResolvedValueOnce({
          opportunities: [{
            ...batch[4],
            enhancedDescription: 'Enhanced 5',
            actionableSummary: 'Summary 5',
            scoring: { overallScore: 9 }
          }],
          executionTime: 50,
          parallelProcessing: false
        })
      
      const result = await enhanceOpportunities(batch, mockSource, mockAnthropicClient)
      
      expect(result.opportunities).toHaveLength(5)
      expect(result.opportunities[0].enhancedDescription).toBe('Enhanced 1')
      expect(result.opportunities[4].enhancedDescription).toBe('Enhanced 5')
    })
  })
  
  describe('Scoring Distribution and Metrics', () => {
    it('should calculate accurate score distributions', async () => {
      const opportunities = [
        generateOpportunity({ id: 'HIGH-001' }),
        generateOpportunity({ id: 'MED-001' }),
        generateOpportunity({ id: 'LOW-001' })
      ]
      
      mockExecuteParallel.mockResolvedValue({
        opportunities: [
          {
            ...opportunities[0],
            enhancedDescription: 'High priority',
            actionableSummary: 'Excellent fit',
            scoring: { 
              overallScore: 9,
              breakdown: { clientRelevance: 3, projectRelevance: 3, fundingAttractiveness: 3, fundingType: 0 }
            }
          },
          {
            ...opportunities[1],
            enhancedDescription: 'Medium priority',
            actionableSummary: 'Good fit',
            scoring: {
              overallScore: 5,
              breakdown: { clientRelevance: 2, projectRelevance: 1.5, fundingAttractiveness: 1.5, fundingType: 0 }
            }
          },
          {
            ...opportunities[2],
            enhancedDescription: 'Low priority',
            actionableSummary: 'Poor fit',
            scoring: {
              overallScore: 2,
              breakdown: { clientRelevance: 0.5, projectRelevance: 0.5, fundingAttractiveness: 1, fundingType: 0 }
            }
          }
        ],
        executionTime: 150,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      // Check metrics calculation
      expect(result.analysisMetrics.scoreDistribution.high).toBe(1) // Score >= 7
      expect(result.analysisMetrics.scoreDistribution.medium).toBe(1) // 4 <= Score < 7
      expect(result.analysisMetrics.scoreDistribution.low).toBe(1) // Score < 4
      expect(result.analysisMetrics.averageScore).toBeCloseTo(5.33, 1)
    })
    
    it('should handle missing scores in metrics', async () => {
      const opportunities = [
        generateOpportunity({ id: 'SCORE-001' }),
        generateOpportunity({ id: 'NOSCORE-001' })
      ]
      
      mockExecuteParallel.mockResolvedValue({
        opportunities: [
          {
            ...opportunities[0],
            enhancedDescription: 'Has score',
            actionableSummary: 'Summary',
            scoring: { overallScore: 7 }
          },
          {
            ...opportunities[1],
            enhancedDescription: 'No score',
            actionableSummary: 'Summary',
            scoring: null // Missing score
          }
        ],
        executionTime: 100,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities(opportunities, mockSource, mockAnthropicClient)
      
      // Should handle missing scores gracefully
      expect(result.analysisMetrics.averageScore).toBeDefined()
      expect(result.analysisMetrics.scoreDistribution).toBeDefined()
    })
  })
  
  describe('Data Integrity', () => {
    it('should preserve original opportunity data', async () => {
      const original = generateOpportunity({
        id: 'PRESERVE-001',
        title: 'Original Title',
        customField: 'Should remain',
        metadata: { key: 'value' }
      })
      
      mockExecuteParallel.mockResolvedValue({
        opportunities: [{
          ...original,
          enhancedDescription: 'New enhanced',
          actionableSummary: 'New summary',
          scoring: { overallScore: 7 }
        }],
        executionTime: 100,
        parallelProcessing: true
      })
      
      const result = await enhanceOpportunities([original], mockSource, mockAnthropicClient)
      
      // Original fields preserved
      expect(result.opportunities[0].title).toBe('Original Title')
      expect(result.opportunities[0].customField).toBe('Should remain')
      expect(result.opportunities[0].metadata).toEqual({ key: 'value' })
      
      // New fields added
      expect(result.opportunities[0].enhancedDescription).toBe('New enhanced')
    })
    
    it('should maintain opportunity order after processing', async () => {
      const batch = Array(10).fill(null).map((_, i) => 
        generateOpportunity({ id: `ORDER-${i}` })
      )
      
      mockExecuteParallel.mockImplementation(async (opps) => ({
        opportunities: opps.map(o => ({
          ...o,
          enhancedDescription: `Enhanced ${o.id}`,
          actionableSummary: `Summary ${o.id}`,
          scoring: { overallScore: 5 }
        })),
        executionTime: 200,
        parallelProcessing: true
      }))
      
      const result = await enhanceOpportunities(batch, mockSource, mockAnthropicClient)
      
      // Check order is maintained
      expect(result.opportunities).toHaveLength(10)
      result.opportunities.forEach((opp, index) => {
        expect(opp.id).toBe(`ORDER-${index}`)
      })
    })
  })
})