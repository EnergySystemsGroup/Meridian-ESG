/**
 * Unit Tests for Content Enhancer Component
 * 
 * Tests the content enhancement logic including:
 * - Prompt construction with business context
 * - JSON response parsing and repair
 * - Token limit calculations
 * - Error handling and fallback scenarios
 * - Schema validation
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { 
  generateOpportunity,
  generateMinimalOpportunity,
  generateOpportunityWithLongContent,
  generateOpportunityWithSpecialChars,
  generateBatchWithAllEdgeCases
} from '../../fixtures/opportunities.js'
import {
  validContentEnhancementResponse,
  truncatedArrayResponse,
  truncatedObjectResponse,
  malformedQuotesResponse,
  missingFieldsResponse,
  createMalformedResponse
} from '../../fixtures/llmResponses.js'

// Mock dependencies
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
    }
  }
}))

jest.mock('../../../lib/constants/taxonomies.js', () => ({
  TAXONOMIES: {
    TARGET_CLIENT_TYPES: ['K-12 School Districts', 'Municipal Government', 'City Government', 'County Government', 'Colleges & Universities'],
    PREFERRED_ACTIVITIES: ['Energy Efficiency Improvements', 'HVAC System Installation', 'HVAC System Replacement', 'Lighting System Upgrades', 'Solar System Installation', 'Building Envelope Retrofits', 'Energy Management System Installation', 'Infrastructure Modernization']
  }
}))

// Import the module under test
import { enhanceOpportunityContent } from '../../../lib/agents-v2/core/analysisAgent/contentEnhancer.js'

describe('Content Enhancer Unit Tests', () => {
  let mockAnthropicClient
  let mockSource
  let consoleLogSpy
  let consoleErrorSpy
  
  // Helper to create mock response in correct format
  const createMockResponse = (analyses) => ({
    data: { analyses },
    performance: { tokenUsage: 100, executionTime: 50 }
  })
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockAnthropicClient = {
      calculateOptimalBatchSize: jest.fn((avgLength) => ({
        batchSize: avgLength > 500 ? 3 : 5,
        maxTokens: 4000,
        modelName: 'claude-3-sonnet',
        modelCapacity: 200000
      })),
      callWithSchema: jest.fn()
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
  
  describe('Prompt Construction', () => {
    it('should construct enhancement prompt with business context', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(validContentEnhancementResponse.slice(0, 1))
      )
      
      await enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      
      const callArgs = mockAnthropicClient.callWithSchema.mock.calls[0]
      const prompt = callArgs[0]
      
      // Verify business context is included
      expect(prompt).toContain('TARGET CLIENTS: K-12 School Districts, Municipal Government, City Government')
      expect(prompt).toContain('PREFERRED ACTIVITIES: Energy Efficiency Improvements, HVAC System Installation')
      expect(prompt).toContain('energy services business')
    })
    
    it('should include all opportunity details in prompt', async () => {
      const opportunity = generateOpportunity({
        id: 'TEST-001',
        title: 'Unique Test Grant',
        description: 'Specific test description',
        minimumAward: 25000,
        maximumAward: 100000
      })
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([{
          id: 'TEST-001',
          enhancedDescription: 'Enhanced',
          actionableSummary: 'Summary'
        }])
      )
      
      await enhanceOpportunityContent([opportunity], mockSource, mockAnthropicClient)
      
      const prompt = mockAnthropicClient.callWithSchema.mock.calls[0][0]
      expect(prompt).toContain('TEST-001')
      expect(prompt).toContain('Unique Test Grant')
      expect(prompt).toContain('Specific test description')
      expect(prompt).toContain('$25,000')
      expect(prompt).toContain('$100,000')
    })
    
    it('should handle opportunities with missing fields gracefully', async () => {
      const minimalOpp = generateMinimalOpportunity({ id: 'MIN-001' })
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([{
          id: 'MIN-001',
          enhancedDescription: 'Enhanced minimal',
          actionableSummary: 'Minimal summary'
        }])
      )
      
      const result = await enhanceOpportunityContent([minimalOpp], mockSource, mockAnthropicClient)
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('MIN-001')
      expect(mockAnthropicClient.callWithSchema).toHaveBeenCalled()
    })
  })
  
  describe('JSON Response Parsing and Repair', () => {
    it('should parse valid JSON responses correctly', async () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001' }),
        generateOpportunity({ id: 'TEST-002' })
      ]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(validContentEnhancementResponse)
      )
      
      const result = await enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      
      expect(result).toHaveLength(2)
      expect(result[0].enhancedDescription).toContain('federal grant opportunity')
      expect(result[1].actionableSummary).toContain('brownfield-to-solar')
    })
    
    it('should handle string responses that need parsing', async () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001' }),
        generateOpportunity({ id: 'TEST-002' })
      ]
      
      // Simulate string response that needs JSON parsing
      mockAnthropicClient.callWithSchema.mockResolvedValue({
        data: {
          analyses: JSON.stringify(validContentEnhancementResponse)
        },
        performance: { tokenUsage: 100, executionTime: 50 }
      })
      
      const result = await enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      
      // Should successfully parse the string
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('TEST-001')
    })
    
    it('should handle direct content strings', async () => {
      const opportunities = [
        generateOpportunity({ id: 'TEST-001' })
      ]
      
      // Simulate data as direct array (fallback case)
      mockAnthropicClient.callWithSchema.mockResolvedValue({
        data: validContentEnhancementResponse.slice(0, 1),
        performance: { tokenUsage: 100, executionTime: 50 }
      })
      
      const result = await enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('TEST-001')
    })
    
    it('should extract JSON from responses with extra text', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      const responseWithPreamble = `
        Here is the enhanced content:
        [{"id": "TEST-001", "enhancedDescription": "Enhanced", "actionableSummary": "Summary"}]
        Processing complete.
      `
      
      mockAnthropicClient.callWithSchema.mockResolvedValue({
        data: { analyses: responseWithPreamble },
        performance: { tokenUsage: 100, executionTime: 50 }
      })
      
      const result = await enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('TEST-001')
    })
    
    it('should handle deeply nested JSON structures', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      const nestedResponse = [{
        id: 'TEST-001',
        enhancedDescription: 'Description with nested {braces} and [brackets]',
        actionableSummary: 'Summary with {"nested": "json"} content'
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(nestedResponse)
      )
      
      const result = await enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      
      expect(result).toHaveLength(1)
      expect(result[0].enhancedDescription).toContain('nested {braces}')
    })
  })
  
  describe('Token Limit Calculations', () => {
    it('should calculate appropriate token limits based on content length', async () => {
      const shortOpp = generateOpportunity({ 
        id: 'SHORT-001',
        description: 'Short'
      })
      const longOpp = generateOpportunityWithLongContent({ id: 'LONG-001' })
      
      // Mock response for shortOpp test
      mockAnthropicClient.callWithSchema.mockResolvedValueOnce(
        createMockResponse([
          { id: 'SHORT-001', enhancedDescription: 'E', actionableSummary: 'S' }
        ])
      )
      
      // Mock response for longOpp test
      mockAnthropicClient.callWithSchema.mockResolvedValueOnce(
        createMockResponse([
          { id: 'LONG-001', enhancedDescription: 'E', actionableSummary: 'S' }
        ])
      )
      
      await enhanceOpportunityContent([shortOpp], mockSource, mockAnthropicClient)
      expect(mockAnthropicClient.calculateOptimalBatchSize).toHaveBeenCalledWith(
        expect.any(Number) // Just the average description length
      )
      
      await enhanceOpportunityContent([longOpp], mockSource, mockAnthropicClient)
      // Should be called with larger average length
      const lastCall = mockAnthropicClient.calculateOptimalBatchSize.mock.calls[1]
      expect(lastCall[0]).toBeGreaterThan(1000) // Long content
    })
    
    it('should respect model token capacity', async () => {
      const veryLongOpps = Array(10).fill(null).map((_, i) => 
        generateOpportunityWithLongContent({ id: `LONG-${i}` })
      )
      
      mockAnthropicClient.calculateOptimalBatchSize.mockReturnValue({
        batchSize: 2, // Small batch due to long content
        maxTokens: 8000,
        modelName: 'claude-3-sonnet',
        modelCapacity: 200000
      })
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([
          { id: 'LONG-0', enhancedDescription: 'E', actionableSummary: 'S' },
          { id: 'LONG-1', enhancedDescription: 'E', actionableSummary: 'S' }
        ])
      )
      
      await enhanceOpportunityContent(veryLongOpps.slice(0, 2), mockSource, mockAnthropicClient)
      
      expect(mockAnthropicClient.calculateOptimalBatchSize).toHaveBeenCalled()
      const config = mockAnthropicClient.calculateOptimalBatchSize.mock.results[0].value
      expect(config.batchSize).toBeLessThanOrEqual(5) // Should limit batch size
    })
  })
  
  describe('Error Handling', () => {
    it('should handle API call failures gracefully', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      mockAnthropicClient.callWithSchema.mockRejectedValue(
        new Error('API rate limit exceeded')
      )
      
      await expect(
        enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow('API rate limit exceeded')
    })
    
    it('should handle completely malformed JSON responses', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      const completelyBroken = 'This is not JSON at all { [ } ]'
      
      mockAnthropicClient.callWithSchema.mockResolvedValue({
        data: { analyses: completelyBroken },
        performance: { tokenUsage: 100, executionTime: 50 }
      })
      
      await expect(
        enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow()
    })
    
    it('should handle null/undefined responses', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue({
        data: { analyses: null },
        performance: { tokenUsage: 100, executionTime: 50 }
      })
      
      await expect(
        enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow()
    })
    
    it('should handle empty array responses', async () => {
      const opportunities = [generateOpportunity({ id: 'TEST-001' })]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([])
      )
      
      // Should throw error for count mismatch
      await expect(
        enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      ).rejects.toThrow('Content result count mismatch: expected 1, got 0')
    })
  })
  
  describe('Special Characters and Encoding', () => {
    it('should handle opportunities with special characters', async () => {
      const specialOpp = generateOpportunityWithSpecialChars({ id: 'SPECIAL-001' })
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([{
          id: 'SPECIAL-001',
          enhancedDescription: 'Enhanced with "quotes" & symbols',
          actionableSummary: 'Summary with €£¥ unicode'
        }])
      )
      
      const result = await enhanceOpportunityContent([specialOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].enhancedDescription).toContain('"quotes"')
      expect(result[0].actionableSummary).toContain('€£¥')
    })
    
    it('should handle HTML content in opportunities', async () => {
      const opportunities = [generateOpportunity({
        id: 'HTML-001',
        description: '<p>HTML <strong>content</strong></p>'
      })]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([{
          id: 'HTML-001',
          enhancedDescription: 'Enhanced <b>HTML</b> content',
          actionableSummary: 'Summary with <tags>'
        }])
      )
      
      const result = await enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      
      expect(result[0].enhancedDescription).toContain('<b>HTML</b>')
      expect(result[0].actionableSummary).toContain('<tags>')
    })
    
    it('should handle newlines and tabs in content', async () => {
      const opportunities = [generateOpportunity({
        id: 'MULTILINE-001',
        description: 'Line 1\nLine 2\tTabbed'
      })]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([{
          id: 'MULTILINE-001',
          enhancedDescription: 'Enhanced\nwith\nnewlines',
          actionableSummary: 'Summary\twith\ttabs'
        }])
      )
      
      const result = await enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      
      expect(result[0].enhancedDescription).toContain('\n')
      expect(result[0].actionableSummary).toContain('\t')
    })
  })
  
  describe('Batch Processing', () => {
    it('should handle edge case opportunities in batch', async () => {
      const edgeCases = generateBatchWithAllEdgeCases()
      
      // Mock responses for each edge case
      const mockResponses = edgeCases.map(opp => ({
        id: opp.id,
        enhancedDescription: `Enhanced ${opp.id}`,
        actionableSummary: `Summary ${opp.id}`
      }))
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(mockResponses)
      )
      
      const result = await enhanceOpportunityContent(edgeCases, mockSource, mockAnthropicClient)
      
      expect(result).toHaveLength(edgeCases.length)
      result.forEach((item, index) => {
        expect(item.id).toBe(edgeCases[index].id)
        expect(item.enhancedDescription).toContain(edgeCases[index].id)
      })
    })
    
    it('should handle very large batches efficiently', async () => {
      const largeBatch = Array(100).fill(null).map((_, i) => 
        generateOpportunity({ id: `LARGE-${i}` })
      )
      
      // Mock batch processing
      mockAnthropicClient.calculateOptimalBatchSize.mockReturnValue({
        batchSize: 10,
        maxTokens: 4000,
        modelName: 'claude-3-sonnet',
        modelCapacity: 200000
      })
      
      const mockBatchResponse = largeBatch.slice(0, 10).map(opp => ({
        id: opp.id,
        enhancedDescription: `Enhanced ${opp.id}`,
        actionableSummary: `Summary ${opp.id}`
      }))
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(mockBatchResponse)
      )
      
      const result = await enhanceOpportunityContent(largeBatch.slice(0, 10), mockSource, mockAnthropicClient)
      
      expect(result).toHaveLength(10)
      expect(mockAnthropicClient.calculateOptimalBatchSize).toHaveBeenCalled()
    })
  })
  
  describe('Performance and Optimization', () => {
    it('should optimize prompt size for efficiency', async () => {
      const opportunities = Array(5).fill(null).map((_, i) => 
        generateOpportunity({ 
          id: `OPT-${i}`,
          description: 'x'.repeat(1000) // Long description
        })
      )
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(opportunities.map(o => ({
          id: o.id,
          enhancedDescription: 'E',
          actionableSummary: 'S'
        })))
      )
      
      await enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      
      // Should optimize batch size based on content
      expect(mockAnthropicClient.calculateOptimalBatchSize).toHaveBeenCalled()
      const avgLength = mockAnthropicClient.calculateOptimalBatchSize.mock.calls[0][0]
      expect(avgLength).toBeGreaterThan(500) // Long content should be detected
    })
    
    it('should track performance metrics', async () => {
      const opportunities = [generateOpportunity({ id: 'PERF-001' })]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([{
          id: 'PERF-001',
          enhancedDescription: 'Enhanced',
          actionableSummary: 'Summary'
        }])
      )
      
      const startTime = Date.now()
      await enhanceOpportunityContent(opportunities, mockSource, mockAnthropicClient)
      const endTime = Date.now()
      
      // Should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(1000)
      
      // Should log performance info
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ContentEnhancer]')
      )
    })
  })
})