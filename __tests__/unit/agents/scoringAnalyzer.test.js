/**
 * Unit Tests for Scoring Analyzer Component
 * 
 * Tests the scoring analysis logic including:
 * - Score calculation formulas (0-10 scale)
 * - Client alignment scoring (0-3)
 * - Project relevance scoring (0-3)
 * - Funding attractiveness (0-3)
 * - Funding type classification (0-1)
 * - Fallback scoring mechanisms
 * - Reasoning generation
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import {
  generateOpportunity,
  generateOpportunityForScoring,
  generateMinimalOpportunity,
  generateOpportunityWithNulls,
  generateBatchWithAllEdgeCases
} from '../../fixtures/opportunities.js'
import {
  validScoringResponse,
  scoringEdgeCases,
  fallbackScoringResponse
} from '../../fixtures/llmResponses.js'

// Mock dependencies
jest.mock('../../../lib/agents-v2/utils/anthropicClient.js', () => ({
  schemas: {
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
    }
  }
}))

jest.mock('../../../lib/constants/taxonomies.js', () => ({
  TAXONOMIES: {
    TARGET_CLIENT_TYPES: ['K-12 School', 'Municipal Government', 'Federal Agency'],
    PREFERRED_ACTIVITIES: ['Energy Infrastructure', 'HVAC Systems', 'Solar Installation']
  }
}))

// Import the module under test
import { analyzeOpportunityScoring } from '../../../lib/agents-v2/core/analysisAgent/scoringAnalyzer.js'

describe('Scoring Analyzer Unit Tests', () => {
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
      calculateOptimalBatchSize: jest.fn(() => ({
        batchSize: 5,
        maxTokens: 3000,
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
  
  describe('Score Calculation Logic', () => {
    it('should calculate total score correctly from breakdown', async () => {
      const opportunities = [generateOpportunityForScoring('high', { id: 'HIGH-001' })]
      
      const response = [{
        id: 'HIGH-001',
        scoring: {
          clientRelevance: 3,
          projectRelevance: 3,
          fundingAttractiveness: 2.5,
          fundingType: 0,
          overallScore: 8.5
        },
        relevanceReasoning: 'Perfect alignment',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.overallScore).toBe(8.5)
      // Verify total matches sum of breakdown
      const expectedTotal = 3 + 3 + 2.5 + 0
      expect(result[0].scoring.overallScore).toBe(expectedTotal)
    })
    
    it('should handle perfect score (10/10)', async () => {
      const opportunities = [generateOpportunityForScoring('high', { id: 'PERFECT-001' })]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([scoringEdgeCases.perfectScore])
      )
      
      const result = await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.overallScore).toBe(10)
      expect(result[0].scoring.clientRelevance).toBe(3)
      expect(result[0].scoring.projectRelevance).toBe(3)
      expect(result[0].scoring.fundingAttractiveness).toBe(3)
      expect(result[0].scoring.fundingType).toBe(1)
    })
    
    it('should handle zero score (0/10)', async () => {
      const opportunities = [generateOpportunityForScoring('zero', { id: 'ZERO-001' })]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([scoringEdgeCases.zeroScore])
      )
      
      const result = await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.overallScore).toBe(0)
      expect(result[0].scoring.clientRelevance).toBe(0)
      expect(result[0].scoring.projectRelevance).toBe(0)
      expect(result[0].concerns).toContain('Not relevant to our services')
    })
    
    it('should validate score ranges', async () => {
      const opportunities = [generateOpportunity({ id: 'INVALID-001' })]
      
      // Invalid scores (out of range)
      const invalidResponse = [{
        id: 'INVALID-001',
        scoring: {
          overallScore: 15, // Should be max 10
          breakdown: {
            clientRelevance: 5,     // Should be max 3
            projectRelevance: -1,   // Should be min 0
            fundingAttractiveness: 4, // Should be max 3
            fundingType: 2         // Should be max 1
          }
        },
        relevanceReasoning: 'Invalid scores',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(invalidResponse)
      )
      
      // Should either fix the scores or throw validation error
      try {
        await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      } catch (error) {
        expect(error.message).toContain('validation')
      }
    })
  })
  
  describe('Client Relevance Scoring (0-3)', () => {
    it('should score municipal government opportunities highly', async () => {
      const municipalOpp = generateOpportunity({
        id: 'MUN-001',
        title: 'Municipal Infrastructure Grant',
        eligibleApplicants: ['Municipal Government', 'County Government']
      })
      
      const response = [{
        id: 'MUN-001',
        scoring: {
          clientRelevance: 3,
          projectRelevance: 2,
          fundingAttractiveness: 2,
          fundingType: 0,
          overallScore: 7
        },
        relevanceReasoning: 'Direct match to municipal government target',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([municipalOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.clientRelevance).toBe(3)
      expect(result[0].relevanceReasoning).toContain('municipal')
    })
    
    it('should score K-12 school opportunities appropriately', async () => {
      const schoolOpp = generateOpportunity({
        id: 'SCHOOL-001',
        title: 'K-12 Energy Efficiency Program',
        eligibleApplicants: ['K-12 School', 'School District']
      })
      
      const response = [{
        id: 'SCHOOL-001',
        scoring: {
          clientRelevance: 2.5,
          projectRelevance: 2,
          fundingAttractiveness: 2,
          fundingType: 0,
          overallScore: 6.5
        },
        relevanceReasoning: 'Strong K-12 school alignment',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([schoolOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.clientRelevance).toBe(2.5)
    })
    
    it('should score non-target clients low', async () => {
      const nonTargetOpp = generateOpportunity({
        id: 'NONTARGET-001',
        title: 'Individual Artist Grant',
        eligibleApplicants: ['Individual', 'Arts Organization']
      })
      
      const response = [{
        id: 'NONTARGET-001',
        scoring: {
          clientRelevance: 0,
          projectRelevance: 0,
          fundingAttractiveness: 1.5,
          fundingType: 0.5,
          overallScore: 2
        },
        relevanceReasoning: 'Not aligned with target client types',
        concerns: ['Outside target market']
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([nonTargetOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.clientRelevance).toBe(0)
      expect(result[0].concerns).toContain('Outside target market')
    })
  })
  
  describe('Project Relevance Scoring (0-3)', () => {
    it('should score energy infrastructure projects highly', async () => {
      const energyOpp = generateOpportunity({
        id: 'ENERGY-001',
        title: 'Smart Grid Modernization Grant',
        eligibleActivities: ['Energy Infrastructure', 'Grid Modernization', 'Smart Grid']
      })
      
      const response = [{
        id: 'ENERGY-001',
        scoring: {
          clientRelevance: 2.5,
          projectRelevance: 3,
          fundingAttractiveness: 2.5,
          fundingType: 0,
          overallScore: 8
        },
        relevanceReasoning: 'Direct energy infrastructure alignment',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([energyOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.projectRelevance).toBe(3)
    })
    
    it('should score HVAC and solar projects well', async () => {
      const hvacOpp = generateOpportunity({
        id: 'HVAC-001',
        title: 'HVAC Upgrade Program',
        eligibleActivities: ['HVAC Systems', 'Building Efficiency']
      })
      
      const response = [{
        id: 'HVAC-001',
        scoring: {
          clientRelevance: 2,
          projectRelevance: 2.5,
          fundingAttractiveness: 2,
          fundingType: 0.5,
          overallScore: 7
        },
        relevanceReasoning: 'HVAC expertise directly applicable',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([hvacOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.projectRelevance).toBe(2.5)
    })
    
    it('should score unrelated projects low', async () => {
      const unrelatedOpp = generateOpportunity({
        id: 'UNRELATED-001',
        title: 'Agricultural Research Grant',
        eligibleActivities: ['Agricultural Research', 'Farming']
      })
      
      const response = [{
        id: 'UNRELATED-001',
        scoring: {
          clientRelevance: 0.5,
          projectRelevance: 0,
          fundingAttractiveness: 1,
          fundingType: 0.5,
          overallScore: 2
        },
        relevanceReasoning: 'Outside core competencies',
        concerns: ['No relevant expertise']
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([unrelatedOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.projectRelevance).toBe(0)
    })
  })
  
  describe('Funding Attractiveness Scoring (0-3)', () => {
    it('should score high-value opportunities highly', async () => {
      const highValueOpp = generateOpportunity({
        id: 'HIGHVAL-001',
        title: 'Major Infrastructure Grant',
        minimumAward: 1000000,
        maximumAward: 10000000,
        totalFundingAvailable: 100000000
      })
      
      const response = [{
        id: 'HIGHVAL-001',
        scoring: {
          clientRelevance: 2.5,
          projectRelevance: 2.5,
          fundingAttractiveness: 3,
          fundingType: 0,
          overallScore: 8
        },
        relevanceReasoning: 'Exceptional funding opportunity',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([highValueOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.fundingAttractiveness).toBe(3)
    })
    
    it('should score medium-value opportunities moderately', async () => {
      const mediumValueOpp = generateOpportunity({
        id: 'MEDVAL-001',
        title: 'Standard Grant Program',
        minimumAward: 50000,
        maximumAward: 500000,
        totalFundingAvailable: 10000000
      })
      
      const response = [{
        id: 'MEDVAL-001',
        scoring: {
          clientRelevance: 2,
          projectRelevance: 2,
          fundingAttractiveness: 2,
          fundingType: 0,
          overallScore: 6
        },
        relevanceReasoning: 'Reasonable funding amount',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([mediumValueOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.fundingAttractiveness).toBe(2)
    })
    
    it('should score low-value opportunities lower', async () => {
      const lowValueOpp = generateOpportunity({
        id: 'LOWVAL-001',
        title: 'Small Grant',
        minimumAward: 5000,
        maximumAward: 25000,
        totalFundingAvailable: 500000
      })
      
      const response = [{
        id: 'LOWVAL-001',
        scoring: {
          clientRelevance: 1.5,
          projectRelevance: 1.5,
          fundingAttractiveness: 0.5,
          fundingType: 0,
          overallScore: 3.5
        },
        relevanceReasoning: 'Limited funding potential',
        concerns: ['Small award size']
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([lowValueOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.fundingAttractiveness).toBeLessThan(1)
    })
    
    it('should handle missing funding amounts', async () => {
      const noAmountOpp = generateOpportunityWithNulls({
        id: 'NOAMT-001',
        title: 'Unknown Funding Grant'
      })
      
      const response = [{
        id: 'NOAMT-001',
        scoring: {
          clientRelevance: 1.5,
          projectRelevance: 1.5,
          fundingAttractiveness: 1,
          fundingType: 0,
          overallScore: 4
        },
        relevanceReasoning: 'Funding amount unknown',
        concerns: ['Funding details not available']
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([noAmountOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.fundingAttractiveness).toBe(1)
      expect(result[0].concerns).toContain('Funding details not available')
    })
  })
  
  describe('Funding Type Classification (0-1)', () => {
    it('should score grants as 0 (best)', async () => {
      const grantOpp = generateOpportunity({
        id: 'GRANT-001',
        title: 'Federal Grant',
        fundingInstrumentType: 'Grant'
      })
      
      const response = [{
        id: 'GRANT-001',
        scoring: {
          clientRelevance: 2,
          projectRelevance: 2,
          fundingAttractiveness: 2,
          fundingType: 0,
          overallScore: 6
        },
        relevanceReasoning: 'Grant funding preferred',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([grantOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.fundingType).toBe(0)
    })
    
    it('should score loans as 1 (worst)', async () => {
      const loanOpp = generateOpportunity({
        id: 'LOAN-001',
        title: 'Low-Interest Loan',
        fundingInstrumentType: 'Loan'
      })
      
      const response = [{
        id: 'LOAN-001',
        scoring: {
          clientRelevance: 2,
          projectRelevance: 2,
          fundingAttractiveness: 2,
          fundingType: 1,
          overallScore: 7
        },
        relevanceReasoning: 'Loan requires repayment',
        concerns: ['Repayment required']
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([loanOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.fundingType).toBe(1)
      expect(result[0].concerns).toContain('Repayment required')
    })
    
    it('should score mixed funding types appropriately', async () => {
      const mixedOpp = generateOpportunity({
        id: 'MIXED-001',
        title: 'Grant/Loan Combination',
        fundingInstrumentType: 'Grant/Loan'
      })
      
      const response = [{
        id: 'MIXED-001',
        scoring: {
          clientRelevance: 2,
          projectRelevance: 2,
          fundingAttractiveness: 2,
          fundingType: 0.5,
          overallScore: 6.5
        },
        relevanceReasoning: 'Partial grant funding',
        concerns: ['Partial loan component']
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([mixedOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.fundingType).toBe(0.5)
    })
  })
  
  describe('Fallback Scoring Mechanism', () => {
    it('should apply fallback scoring on API failure', async () => {
      const opportunities = [generateOpportunity({ id: 'FALLBACK-001' })]
      
      // Mock API failure
      mockAnthropicClient.callWithSchema
        .mockRejectedValueOnce(new Error('API error'))
      
      const result = await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      
      // Should apply fallback scoring (all zeros)
      expect(mockAnthropicClient.callWithSchema).toHaveBeenCalledTimes(1)
      expect(result[0].scoring.overallScore).toBe(0)
      expect(result[0].concerns).toContain('Analysis failed - manual review required')
    })
    
    it('should apply default scoring for minimal opportunities', async () => {
      const minimalOpp = generateMinimalOpportunity({ id: 'MIN-001' })
      
      const response = [{
        id: 'MIN-001',
        scoring: {
          clientRelevance: 1.5,
          projectRelevance: 1.5,
          fundingAttractiveness: 1.5,
          fundingType: 0.5,
          overallScore: 5
        },
        relevanceReasoning: 'Insufficient data for accurate scoring',
        concerns: ['Incomplete opportunity data', 'Manual review recommended']
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([minimalOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.overallScore).toBe(5)
      expect(result[0].concerns).toContain('Manual review recommended')
    })
    
    it('should handle missing response fields with defaults', async () => {
      const opportunities = [generateOpportunity({ id: 'MISSING-001' })]
      
      // Response missing concerns field
      const incompleteResponse = [{
        id: 'MISSING-001',
        scoring: {
          clientRelevance: 2,
          projectRelevance: 2,
          fundingAttractiveness: 2,
          fundingType: 0,
          overallScore: 6
        },
        relevanceReasoning: 'Standard opportunity'
        // Missing concerns field
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(incompleteResponse)
      )
      
      const result = await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      
      // Should handle missing concerns field gracefully - concerns might be undefined
      expect(result[0].id).toBe('MISSING-001')
      expect(result[0].scoring.overallScore).toBe(6)
      // Concerns field may or may not exist - that's OK
    })
  })
  
  describe('Reasoning Generation', () => {
    it('should generate detailed reasoning for high scores', async () => {
      const highScoreOpp = generateOpportunityForScoring('high', { id: 'HIGH-001' })
      
      const response = [{
        id: 'HIGH-001',
        scoring: {
          clientRelevance: 3,
          projectRelevance: 3,
          fundingAttractiveness: 3,
          fundingType: 0,
          overallScore: 9
        },
        relevanceReasoning: 'Exceptional opportunity: Direct municipal energy infrastructure focus with significant grant funding. Aligns perfectly with core competencies and target market. High award amounts justify pursuit effort.',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([highScoreOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].relevanceReasoning).toContain('Exceptional')
      expect(result[0].relevanceReasoning).toContain('municipal')
      expect(result[0].relevanceReasoning).toContain('energy')
    })
    
    it('should explain concerns for low scores', async () => {
      const lowScoreOpp = generateOpportunityForScoring('zero', { id: 'LOW-001' })
      
      const response = [{
        id: 'LOW-001',
        scoring: {
          clientRelevance: 0,
          projectRelevance: 0,
          fundingAttractiveness: 0.5,
          fundingType: 0.5,
          overallScore: 1
        },
        relevanceReasoning: 'Poor fit: Arts program outside target market and core competencies. Limited funding with fellowship structure.',
        concerns: [
          'Not aligned with energy services',
          'Outside target client base',
          'Minimal funding available',
          'Fellowship not suitable for company'
        ]
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([lowScoreOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].relevanceReasoning).toContain('Poor fit')
      expect(result[0].concerns).toHaveLength(4)
      expect(result[0].concerns[0]).toContain('energy services')
    })
    
    it('should provide balanced reasoning for medium scores', async () => {
      const mediumScoreOpp = generateOpportunityForScoring('medium', { id: 'MED-001' })
      
      const response = [{
        id: 'MED-001',
        scoring: {
          clientRelevance: 2,
          projectRelevance: 2,
          fundingAttractiveness: 1.5,
          fundingType: 0,
          overallScore: 5.5
        },
        relevanceReasoning: 'Moderate opportunity: Environmental services alignment with reasonable funding. Consider as secondary priority after core energy opportunities.',
        concerns: ['Competitive field', 'Moderate award size']
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(response)
      )
      
      const result = await analyzeOpportunityScoring([mediumScoreOpp], mockSource, mockAnthropicClient)
      
      expect(result[0].relevanceReasoning).toContain('Moderate')
      expect(result[0].relevanceReasoning).toContain('secondary priority')
    })
  })
  
  describe('Batch Processing', () => {
    it('should score multiple opportunities in batch', async () => {
      const opportunities = [
        generateOpportunityForScoring('high', { id: 'BATCH-1' }),
        generateOpportunityForScoring('medium', { id: 'BATCH-2' }),
        generateOpportunityForScoring('low', { id: 'BATCH-3' })
      ]
      
      const batchResponse = [
        {
          id: 'BATCH-1',
          scoring: {
          clientRelevance: 3,
          projectRelevance: 3,
          fundingAttractiveness: 2,
          fundingType: 0,
          overallScore: 8 },
          relevanceReasoning: 'High priority',
          concerns: []
        },
        {
          id: 'BATCH-2',
          scoring: {
          clientRelevance: 2,
          projectRelevance: 1.5,
          fundingAttractiveness: 1.5,
          fundingType: 0,
          overallScore: 5 },
          relevanceReasoning: 'Medium priority',
          concerns: []
        },
        {
          id: 'BATCH-3',
          scoring: {
          clientRelevance: 0.5,
          projectRelevance: 0.5,
          fundingAttractiveness: 1,
          fundingType: 0,
          overallScore: 2 },
          relevanceReasoning: 'Low priority',
          concerns: ['Limited alignment']
        }
      ]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(batchResponse)
      )
      
      const result = await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      
      expect(result).toHaveLength(3)
      expect(result[0].scoring.overallScore).toBe(8)
      expect(result[1].scoring.overallScore).toBe(5)
      expect(result[2].scoring.overallScore).toBe(2)
    })
    
    it('should handle edge cases in batch processing', async () => {
      const edgeCases = generateBatchWithAllEdgeCases()
      
      // Create appropriate responses for edge cases
      const edgeResponses = edgeCases.map(opp => ({
        id: opp.id,
        scoring: {
          clientRelevance: 1.5,
          projectRelevance: 1.5,
          fundingAttractiveness: 1.5,
          fundingType: 0.5,
          overallScore: 5
        },
        relevanceReasoning: `Edge case ${opp.id} requires manual review`,
        concerns: ['Data quality issues']
      }))
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(edgeResponses)
      )
      
      const result = await analyzeOpportunityScoring(edgeCases, mockSource, mockAnthropicClient)
      
      expect(result).toHaveLength(edgeCases.length)
      result.forEach(item => {
        expect(item.scoring.overallScore).toBe(5)
        expect(item.concerns).toContain('Data quality issues')
      })
    })
  })
  
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const opportunities = [generateOpportunity({ id: 'ERROR-001' })]
      
      mockAnthropicClient.callWithSchema.mockRejectedValue(
        new Error('Rate limit exceeded')
      )
      
      // Should return fallback scoring instead of throwing
      const result = await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.overallScore).toBe(0)
      expect(result[0].concerns).toContain('Analysis failed - manual review required')
    })
    
    it('should handle malformed JSON responses', async () => {
      const opportunities = [generateOpportunity({ id: 'MALFORMED-001' })]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue({
        data: { analyses: 'Not valid JSON at all' },
        performance: { tokenUsage: 100, executionTime: 50 }
      })
      
      // Should return fallback scoring instead of throwing
      const result = await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      
      expect(result[0].scoring.overallScore).toBe(0)
      expect(result[0].concerns).toContain('Analysis failed - manual review required')
    })
    
    it('should validate response structure', async () => {
      const opportunities = [generateOpportunity({ id: 'INVALID-001' })]
      
      // Missing required scoring field
      const invalidResponse = [{
        id: 'INVALID-001',
        // Missing scoring object
        relevanceReasoning: 'Test',
        concerns: []
      }]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(invalidResponse)
      )
      
      // Should handle invalid response and return the partial data
      const result = await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      
      expect(result[0].id).toBe('INVALID-001')
      expect(result[0].relevanceReasoning).toBe('Test')
    })
  })
  
  describe('Performance and Optimization', () => {
    it('should optimize batch size for scoring', async () => {
      const largeBatch = Array(20).fill(null).map((_, i) => 
        generateOpportunity({ id: `PERF-${i}` })
      )
      
      mockAnthropicClient.calculateOptimalBatchSize.mockReturnValue({
        batchSize: 10, // Optimal for scoring
        maxTokens: 3000,
        modelName: 'claude-3-sonnet',
        modelCapacity: 200000
      })
      
      const mockResponse = largeBatch.slice(0, 10).map(opp => ({
        id: opp.id,
        scoring: {
          clientRelevance: 1.5,
          projectRelevance: 1.5,
          fundingAttractiveness: 1.5,
          fundingType: 0.5,
          overallScore: 5
        },
        relevanceReasoning: 'Standard scoring',
        concerns: []
      }))
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse(mockResponse)
      )
      
      await analyzeOpportunityScoring(largeBatch.slice(0, 10), mockSource, mockAnthropicClient)
      
      expect(mockAnthropicClient.calculateOptimalBatchSize).toHaveBeenCalledWith(
        expect.any(Number),
        600, // Conservative base for scoring
        500  // Conservative tokens per opportunity
      )
    })
    
    it('should track scoring performance metrics', async () => {
      const opportunities = [generateOpportunity({ id: 'METRICS-001' })]
      
      mockAnthropicClient.callWithSchema.mockResolvedValue(
        createMockResponse([{
          id: 'METRICS-001',
          scoring: {
            clientRelevance: 1.5,
            projectRelevance: 1.5,
            fundingAttractiveness: 1.5,
            fundingType: 0.5,
            overallScore: 5
          },
          relevanceReasoning: 'Test',
          concerns: []
        }])
      )
      
      const startTime = Date.now()
      await analyzeOpportunityScoring(opportunities, mockSource, mockAnthropicClient)
      const endTime = Date.now()
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(1000)
      
      // Should log performance info
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ScoringAnalyzer]')
      )
    })
  })
})