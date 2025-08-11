import { jest } from '@jest/globals'

// Mock schemas export - CRITICAL for tests to work
export const schemas = {
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

// Mock AnthropicClient class
export class AnthropicClient {
  constructor(config = {}) {
    // Don't instantiate real Anthropic SDK in tests
    this.client = null
    this.modelId = config.modelId || 'test-model'
    
    // Create jest mocks as instance properties so they track calls
    this.callWithSchema = jest.fn().mockResolvedValue({
      content: 'mocked response',
      usage: { totalTokens: 100 }
    })
    
    this.calculateOptimalBatchSize = jest.fn((avgLength, baseTokens = 500, tokensPerItem = 500) => ({
      batchSize: 5,
      maxTokens: 4000,
      modelName: 'claude-3-sonnet',
      modelCapacity: 200000
    }))
    
    this.getPerformanceMetrics = jest.fn(() => ({
      totalTokens: 500,
      totalRequests: 1,
      averageLatency: 100
    }))
  }
}

// Mock getAnthropicClient function
export const getAnthropicClient = jest.fn(() => ({
  callWithSchema: jest.fn().mockResolvedValue({
    content: 'mocked response',
    usage: { totalTokens: 100 }
  }),
  getPerformanceMetrics: jest.fn(() => ({
    totalTokens: 500,
    totalRequests: 1,
    averageLatency: 100
  }))
}))

// Export default for backwards compatibility
export default {
  AnthropicClient,
  getAnthropicClient
}