// Add fetch shim for Anthropic SDK
import '@anthropic-ai/sdk/shims/node'

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Import mock implementations first  
import * as supabaseMocks from '../../../__mocks__/lib/supabase.js'
import * as anthropicMocks from '../../../__mocks__/lib/agents-v2/utils/anthropicClient.js'
import * as apiHandlerMocks from '../../../__mocks__/lib/agents-v2/core/dataExtractionAgent/apiHandlers/index.js'
import * as extractionMocks from '../../../__mocks__/lib/agents-v2/core/dataExtractionAgent/extraction/index.js'
import * as storageMocks from '../../../__mocks__/lib/agents-v2/core/dataExtractionAgent/storage/index.js'

// Set up the mocks - using require() in factory functions to avoid scope issues
jest.mock('../../../lib/supabase.js', () => require('../../../__mocks__/lib/supabase.js'))
jest.mock('../../../lib/agents-v2/utils/anthropicClient.js', () => require('../../../__mocks__/lib/agents-v2/utils/anthropicClient.js'))
jest.mock('../../../lib/agents-v2/core/dataExtractionAgent/apiHandlers/index.js', () => require('../../../__mocks__/lib/agents-v2/core/dataExtractionAgent/apiHandlers/index.js'))
jest.mock('../../../lib/agents-v2/core/dataExtractionAgent/extraction/index.js', () => require('../../../__mocks__/lib/agents-v2/core/dataExtractionAgent/extraction/index.js'))
jest.mock('../../../lib/agents-v2/core/dataExtractionAgent/storage/index.js', () => require('../../../__mocks__/lib/agents-v2/core/dataExtractionAgent/storage/index.js'))

// NOW import the module under test AFTER all mocks are set up
import { extractFromSource } from '../../../lib/agents-v2/core/dataExtractionAgent/index.js'

// Use the mocks directly
const { handleSingleApi, handleTwoStepApi } = apiHandlerMocks
const { extractOpportunitiesWithSchema } = extractionMocks
const { storeRawResponse } = storageMocks
const { getAnthropicClient } = anthropicMocks
const { createSupabaseClient, logAgentExecution } = supabaseMocks
describe('Data Extraction Agent Unit Tests', () => {
  let mockAnthropicClient

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked anthropic client
    mockAnthropicClient = getAnthropicClient()
    
    // Reset createSupabaseClient to return the mock client
    createSupabaseClient.mockReturnValue({
      from: jest.fn(),
      rpc: jest.fn(),
      auth: {
        getUser: jest.fn()
      }
    })
    // Also ensure logAgentExecution is properly mocked
    logAgentExecution.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('API Response Parsing', () => {
    test('should parse single API responses correctly', async () => {
      const mockSource = {
        id: 'source-1',
        name: 'Test API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants',
        requestConfig: { method: 'GET' }
      }

      const mockApiData = {
        rawResponse: {
          grants: [
            { id: 'grant-1', title: 'Grant 1', amount: 100000 },
            { id: 'grant-2', title: 'Grant 2', amount: 200000 }
          ]
        },
        data: [
          { id: 'grant-1', title: 'Grant 1', amount: 100000 },
          { id: 'grant-2', title: 'Grant 2', amount: 200000 }
        ],
        totalFound: 2,
        totalRetrieved: 2,
        apiCallCount: 1
      }

      const mockExtractedData = {
        opportunities: [
          { id: 'opp-1', title: 'Opportunity 1', fundingAmount: 100000 },
          { id: 'opp-2', title: 'Opportunity 2', fundingAmount: 200000 }
        ],
        totalExtracted: 2,
        extractionMetrics: { processingTime: 100 }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-123')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)


      const result = await extractFromSource(mockSource, mockInstructions)

      expect(handleSingleApi).toHaveBeenCalledWith(mockInstructions)
      expect(storeRawResponse).toHaveBeenCalledWith(
        'source-1',
        mockApiData.rawResponse,
        expect.objectContaining({
          source: mockSource,
          processingInstructions: mockInstructions
        }),
        expect.objectContaining({
          api_endpoint: 'https://api.test.com/grants',
          call_type: 'single',
          opportunity_count: 2
        })
      )
      expect(extractOpportunitiesWithSchema).toHaveBeenCalledWith(
        mockApiData,
        mockSource,
        expect.any(Object), // anthropic client
        mockInstructions
      )

      // Verify the complete result structure
      expect(result).toMatchObject({
        opportunities: expect.arrayContaining([
          expect.objectContaining({
            id: 'opp-1',
            sourceId: 'source-1',
            sourceName: 'Test API',
            rawResponseId: 'raw-response-123'
          }),
          expect.objectContaining({
            id: 'opp-2',
            sourceId: 'source-1',
            sourceName: 'Test API',
            rawResponseId: 'raw-response-123'
          })
        ]),
        extractionMetrics: expect.objectContaining({
          totalFound: 2,
          totalRetrieved: 2,
          successfullyExtracted: 2,
          workflow: 'single_api',
          apiCalls: 1,
          totalTokens: 500,
          executionTime: expect.any(Number),
          extractionProcessing: { processingTime: 100 }
        }),
        rawResponseId: 'raw-response-123',
        executionTime: expect.any(Number),
        rawApiData: mockApiData.rawResponse
      })
    })

    test('should parse two-step API responses correctly', async () => {
      const mockSource = {
        id: 'source-2',
        name: 'Two-Step API'
      }

      const mockInstructions = {
        workflow: 'two_step_api',
        apiEndpoint: 'https://api.test.com/list',
        detailConfig: {
          enabled: true,
          endpoint: '/details/{id}'
        }
      }

      const mockApiData = {
        rawResponse: { list: ['id-1', 'id-2'], details: [{}, {}] },
        data: [
          { id: 'detail-1', fullData: true },
          { id: 'detail-2', fullData: true }
        ],
        totalFound: 2,
        totalRetrieved: 2,
        detailMetrics: { detailCalls: 2 }
      }

      const mockExtractedData = {
        opportunities: [
          { id: 'opp-detail-1', title: 'Detailed Opportunity 1' },
          { id: 'opp-detail-2', title: 'Detailed Opportunity 2' }
        ],
        totalExtracted: 2,
        extractionMetrics: { detailProcessing: true }
      }

      handleTwoStepApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-456')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      // Verify two-step handler was called instead of single
      expect(handleTwoStepApi).toHaveBeenCalledWith(mockInstructions, 'source-2')
      expect(handleSingleApi).not.toHaveBeenCalled()

      // Verify complete two-step result
      expect(result).toMatchObject({
        opportunities: expect.arrayContaining([
          expect.objectContaining({
            id: 'opp-detail-1',
            sourceId: 'source-2',
            sourceName: 'Two-Step API',
            rawResponseId: 'raw-response-456'
          }),
          expect.objectContaining({
            id: 'opp-detail-2',
            sourceId: 'source-2',
            sourceName: 'Two-Step API',
            rawResponseId: 'raw-response-456'
          })
        ]),
        extractionMetrics: expect.objectContaining({
          workflow: 'two_step_api',
          apiCalls: 'multiple',
          detailProcessing: { detailCalls: 2 },
          totalFound: 2,
          totalRetrieved: 2,
          successfullyExtracted: 2
        })
      })
    })
  })

  describe('Data Normalization', () => {
    test('should normalize data to standard format', async () => {
      const mockSource = {
        id: 'source-3',
        name: 'Non-Standard API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/funding',
        responseMapping: {
          id: 'grant_identifier',
          title: 'program_name',
          amount: 'funding_amount'
        }
      }

      const mockApiData = {
        rawResponse: {
          results: [
            { grant_identifier: 'NSF-123', program_name: 'Science Grant', funding_amount: '500000' }
          ]
        },
        data: [
          { grant_identifier: 'NSF-123', program_name: 'Science Grant', funding_amount: '500000' }
        ],
        totalFound: 1,
        totalRetrieved: 1
      }

      const mockNormalizedData = {
        opportunities: [
          {
            id: 'NSF-123',
            title: 'Science Grant',
            fundingAmount: 500000,
            normalizedFields: true
          }
        ],
        totalExtracted: 1,
        extractionMetrics: { normalizationApplied: true }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-789')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockNormalizedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(extractOpportunitiesWithSchema).toHaveBeenCalledWith(
        mockApiData,
        mockSource,
        expect.any(Object),
        mockInstructions
      )
      expect(result.opportunities[0].normalizedFields).toBe(true)
    })
  })

  describe('Pagination Handling', () => {
    test('should handle pagination for large datasets', async () => {
      const mockSource = {
        id: 'source-4',
        name: 'Paginated API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants',
        paginationConfig: {
          enabled: true,
          pageSize: 50,
          pageParam: 'page',
          totalPagesPath: 'metadata.totalPages'
        }
      }

      // Simulate multiple pages of data
      const mockApiData = {
        rawResponse: {
          page1: Array(50).fill({}).map((_, i) => ({ id: `grant-${i}` })),
          page2: Array(50).fill({}).map((_, i) => ({ id: `grant-${50 + i}` })),
          page3: Array(25).fill({}).map((_, i) => ({ id: `grant-${100 + i}` }))
        },
        data: Array(125).fill({}).map((_, i) => ({ id: `grant-${i}` })),
        totalFound: 125,
        totalRetrieved: 125,
        apiCallCount: 3
      }

      const mockExtractedData = {
        opportunities: Array(125).fill({}).map((_, i) => ({
          id: `opp-${i}`,
          title: `Opportunity ${i}`
        })),
        totalExtracted: 125,
        extractionMetrics: { pagesProcessed: 3 }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-paginated')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.opportunities).toHaveLength(125)
      expect(result.extractionMetrics.totalFound).toBe(125)
      expect(result.extractionMetrics.totalRetrieved).toBe(125)
      expect(result.extractionMetrics.successfullyExtracted).toBe(125)
    })

    test('should handle pagination limits', async () => {
      const mockSource = {
        id: 'source-5',
        name: 'Limited Pagination API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants',
        paginationConfig: {
          enabled: true,
          pageSize: 100,
          maxPages: 5
        }
      }

      const mockApiData = {
        rawResponse: { data: Array(500).fill({}) },
        data: Array(500).fill({}).map((_, i) => ({ id: `grant-${i}` })),
        totalFound: 1000, // More available than retrieved
        totalRetrieved: 500, // Limited by maxPages
        apiCallCount: 5
      }

      const mockExtractedData = {
        opportunities: Array(500).fill({}).map((_, i) => ({
          id: `opp-${i}`
        })),
        totalExtracted: 500,
        extractionMetrics: { limitReached: true }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-limited')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.extractionMetrics.totalFound).toBe(1000)
      expect(result.extractionMetrics.totalRetrieved).toBe(500)
      expect(result.opportunities).toHaveLength(500)
    })
  })

  describe('Partial Failure Recovery', () => {
    test('should recover from partial API failures', async () => {
      const mockSource = {
        id: 'source-6',
        name: 'Partial Failure API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      // First attempt fails partially
      const mockApiData = {
        rawResponse: {
          successful: [{ id: 'grant-1' }, { id: 'grant-2' }],
          failed: ['grant-3']
        },
        data: [{ id: 'grant-1' }, { id: 'grant-2' }],
        totalFound: 3,
        totalRetrieved: 2,
        partialFailure: true
      }

      const mockExtractedData = {
        opportunities: [
          { id: 'opp-1', title: 'Recovered 1' },
          { id: 'opp-2', title: 'Recovered 2' }
        ],
        totalExtracted: 2,
        extractionMetrics: { partialRecovery: true }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-partial')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.opportunities).toHaveLength(2)
      expect(result.extractionMetrics.totalFound).toBe(3)
      expect(result.extractionMetrics.totalRetrieved).toBe(2)
    })

    test('should handle extraction failures gracefully', async () => {
      const mockSource = {
        id: 'source-7',
        name: 'Extraction Failure API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const mockApiData = {
        rawResponse: { data: [{ id: 'grant-1' }] },
        data: [{ id: 'grant-1' }],
        totalFound: 1,
        totalRetrieved: 1
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-fail')
      extractOpportunitiesWithSchema.mockRejectedValueOnce(new Error('Extraction failed'))

      await expect(extractFromSource(mockSource, mockInstructions))
        .rejects.toThrow('Extraction failed')
    })
  })

  describe('Field Mapping Validation', () => {
    test('should validate required fields are mapped', async () => {
      const mockSource = {
        id: 'source-8',
        name: 'Field Mapping API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants',
        responseMapping: {
          id: 'identifier',
          title: 'name',
          description: 'summary'
        }
      }

      const mockApiData = {
        rawResponse: {
          items: [
            { identifier: 'MAP-1', name: 'Mapped Grant', summary: 'Description' }
          ]
        },
        data: [
          { identifier: 'MAP-1', name: 'Mapped Grant', summary: 'Description' }
        ],
        totalFound: 1,
        totalRetrieved: 1
      }

      const mockMappedData = {
        opportunities: [
          {
            id: 'MAP-1',
            title: 'Mapped Grant',
            description: 'Description',
            mappingValidated: true
          }
        ],
        totalExtracted: 1,
        extractionMetrics: { fieldMappingApplied: true }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-mapped')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockMappedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.opportunities[0].mappingValidated).toBe(true)
      expect(result.extractionMetrics.extractionProcessing.fieldMappingApplied).toBe(true)
    })

    test('should handle nested field mappings', async () => {
      const mockSource = {
        id: 'source-9',
        name: 'Nested Fields API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants',
        responseMapping: {
          id: 'data.grant_id',
          title: 'data.details.title',
          amount: 'data.funding.total'
        }
      }

      const mockApiData = {
        rawResponse: {
          results: [{
            data: {
              grant_id: 'NESTED-1',
              details: { title: 'Nested Grant' },
              funding: { total: 750000 }
            }
          }]
        },
        data: [{
          data: {
            grant_id: 'NESTED-1',
            details: { title: 'Nested Grant' },
            funding: { total: 750000 }
          }
        }],
        totalFound: 1,
        totalRetrieved: 1
      }

      const mockExtractedData = {
        opportunities: [
          {
            id: 'NESTED-1',
            title: 'Nested Grant',
            fundingAmount: 750000,
            nestedFieldsExtracted: true
          }
        ],
        totalExtracted: 1,
        extractionMetrics: { nestedMappingSuccess: true }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-nested')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.opportunities[0].nestedFieldsExtracted).toBe(true)
    })
  })

  describe('Missing Field Handling', () => {
    test('should handle missing required fields', async () => {
      const mockSource = {
        id: 'source-10',
        name: 'Missing Fields API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const mockApiData = {
        rawResponse: {
          grants: [
            { id: 'MISS-1' }, // Missing title
            { title: 'Missing ID Grant' }, // Missing id
            { id: 'COMPLETE-1', title: 'Complete Grant' }
          ]
        },
        data: [
          { id: 'MISS-1' },
          { title: 'Missing ID Grant' },
          { id: 'COMPLETE-1', title: 'Complete Grant' }
        ],
        totalFound: 3,
        totalRetrieved: 3
      }

      const mockProcessedData = {
        opportunities: [
          { id: 'COMPLETE-1', title: 'Complete Grant' }
        ],
        totalExtracted: 1,
        extractionMetrics: {
          skippedDueToMissingFields: 2,
          validationErrors: ['Missing required field: title', 'Missing required field: id']
        }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-missing')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockProcessedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.opportunities).toHaveLength(1)
      expect(result.extractionMetrics.successfullyExtracted).toBe(1)
      expect(result.extractionMetrics.extractionProcessing.skippedDueToMissingFields).toBe(2)
    })

    test('should use default values for optional fields', async () => {
      const mockSource = {
        id: 'source-11',
        name: 'Optional Fields API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants',
        defaultValues: {
          status: 'active',
          fundingType: 'grant'
        }
      }

      const mockApiData = {
        rawResponse: {
          grants: [
            { id: 'OPT-1', title: 'Optional Grant' }
          ]
        },
        data: [
          { id: 'OPT-1', title: 'Optional Grant' }
        ],
        totalFound: 1,
        totalRetrieved: 1
      }

      const mockEnrichedData = {
        opportunities: [
          {
            id: 'OPT-1',
            title: 'Optional Grant',
            status: 'active',
            fundingType: 'grant',
            defaultsApplied: true
          }
        ],
        totalExtracted: 1,
        extractionMetrics: { defaultValuesUsed: true }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-optional')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockEnrichedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.opportunities[0].defaultsApplied).toBe(true)
      expect(result.opportunities[0].status).toBe('active')
      expect(result.opportunities[0].fundingType).toBe('grant')
    })
  })

  describe('Batch Processing', () => {
    test('should process data in batches efficiently', async () => {
      const mockSource = {
        id: 'source-12',
        name: 'Batch Processing API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants',
        batchConfig: {
          batchSize: 10,
          parallelBatches: 3
        }
      }

      // Create 30 items to process in 3 batches
      const mockApiData = {
        rawResponse: { data: Array(30).fill({}).map((_, i) => ({ id: `batch-${i}` })) },
        data: Array(30).fill({}).map((_, i) => ({ id: `batch-${i}` })),
        totalFound: 30,
        totalRetrieved: 30
      }

      const mockBatchProcessedData = {
        opportunities: Array(30).fill({}).map((_, i) => ({
          id: `processed-${i}`,
          batchNumber: Math.floor(i / 10)
        })),
        totalExtracted: 30,
        extractionMetrics: {
          batchesProcessed: 3,
          itemsPerBatch: 10
        }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-batched')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockBatchProcessedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.opportunities).toHaveLength(30)
      expect(result.extractionMetrics.extractionProcessing.batchesProcessed).toBe(3)
    })

    test('should handle batch processing errors', async () => {
      const mockSource = {
        id: 'source-13',
        name: 'Batch Error API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants',
        batchConfig: {
          batchSize: 5,
          continueOnBatchError: true
        }
      }

      const mockApiData = {
        rawResponse: { 
          successful: Array(10).fill({}).map((_, i) => ({ id: `success-${i}` })),
          failed: Array(5).fill({}).map((_, i) => ({ id: `failed-${i}` }))
        },
        data: Array(10).fill({}).map((_, i) => ({ id: `success-${i}` })),
        totalFound: 15,
        totalRetrieved: 10,
        batchErrors: 1
      }

      const mockPartialBatchData = {
        opportunities: Array(10).fill({}).map((_, i) => ({
          id: `processed-success-${i}`
        })),
        totalExtracted: 10,
        extractionMetrics: {
          batchErrors: 1,
          successfulBatches: 2,
          failedBatches: 1
        }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-batch-error')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockPartialBatchData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.opportunities).toHaveLength(10)
      expect(result.extractionMetrics.totalFound).toBe(15)
      expect(result.extractionMetrics.totalRetrieved).toBe(10)
    })
  })

  describe('Input Validation', () => {
    test('should validate source and instructions are provided', async () => {
      await expect(extractFromSource(null, {}))
        .rejects.toThrow('Source and processing instructions are required')

      await expect(extractFromSource({}, null))
        .rejects.toThrow('Source and processing instructions are required')
    })

    test('should handle empty API responses', async () => {
      const mockSource = {
        id: 'source-14',
        name: 'Empty Response API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const mockApiData = {
        rawResponse: { data: [] },
        data: [],
        totalFound: 0,
        totalRetrieved: 0
      }

      const mockEmptyExtraction = {
        opportunities: [],
        totalExtracted: 0,
        extractionMetrics: { emptyResponse: true }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-empty')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockEmptyExtraction)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.opportunities).toEqual([])
      expect(result.extractionMetrics.totalFound).toBe(0)
      expect(result.extractionMetrics.successfullyExtracted).toBe(0)
    })
  })

  describe('Error Scenarios', () => {
    test('should handle API handler errors gracefully', async () => {
      const mockSource = {
        id: 'source-error-1',
        name: 'API Error Source'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const apiError = new Error('Network timeout')
      handleSingleApi.mockRejectedValueOnce(apiError)
      logAgentExecution.mockResolvedValueOnce({ error: null })

      await expect(extractFromSource(mockSource, mockInstructions))
        .rejects.toThrow('Network timeout')
      
      // Verify error logging was attempted
      expect(logAgentExecution).toHaveBeenCalled()
    })

    test('should handle storage errors gracefully', async () => {
      const mockSource = {
        id: 'source-error-2',
        name: 'Storage Error Source'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const mockApiData = {
        rawResponse: { data: [{ id: 'test' }] },
        data: [{ id: 'test' }],
        totalFound: 1,
        totalRetrieved: 1
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockRejectedValueOnce(new Error('Database connection failed'))

      await expect(extractFromSource(mockSource, mockInstructions))
        .rejects.toThrow('Database connection failed')
    })

    test('should handle two-step API errors', async () => {
      const mockSource = {
        id: 'source-error-3',
        name: 'Two-Step Error Source'
      }

      const mockInstructions = {
        workflow: 'two_step_api',
        apiEndpoint: 'https://api.test.com/list',
        detailConfig: { enabled: true }
      }

      handleTwoStepApi.mockRejectedValueOnce(new Error('Detail API failed'))

      await expect(extractFromSource(mockSource, mockInstructions))
        .rejects.toThrow('Detail API failed')
    })

    test('should continue when logAgentExecution fails on success', async () => {
      const mockSource = {
        id: 'source-log-fail',
        name: 'Log Failure Source'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const mockApiData = {
        rawResponse: { data: [{ id: 'test' }] },
        data: [{ id: 'test' }],
        totalFound: 1,
        totalRetrieved: 1
      }

      const mockExtractedData = {
        opportunities: [{ id: 'opp-1' }],
        totalExtracted: 1,
        extractionMetrics: {}
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-id')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)
      
      // Make logAgentExecution fail
      logAgentExecution.mockRejectedValueOnce(new Error('Logging failed'))

      // Should not throw, just log the error
      const result = await extractFromSource(mockSource, mockInstructions)
      
      expect(result.opportunities).toHaveLength(1)
      expect(result.rawResponseId).toBe('raw-id')
    })
  })

  describe('Edge Cases', () => {
    test('should handle null/undefined in metric calculations', async () => {
      const mockSource = {
        id: 'source-edge-1',
        name: 'Edge Case Source'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const mockApiData = {
        rawResponse: { data: null },
        data: null,
        totalFound: null,
        totalRetrieved: undefined,
        apiCallCount: undefined
      }

      const mockExtractedData = {
        opportunities: [],
        totalExtracted: 0,
        extractionMetrics: {}
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-edge')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.extractionMetrics.totalFound).toBe(0)
      expect(result.extractionMetrics.totalRetrieved).toBe(0)
      expect(result.extractionMetrics.apiCalls).toBe(1)
    })

    test('should use custom anthropic client when provided', async () => {
      const mockSource = {
        id: 'source-custom',
        name: 'Custom Client Source'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const customAnthropicClient = {
        getPerformanceMetrics: jest.fn(() => ({
          totalTokens: 1000,
          totalRequests: 5
        }))
      }

      const mockApiData = {
        rawResponse: { data: [] },
        data: [],
        totalFound: 0,
        totalRetrieved: 0
      }

      const mockExtractedData = {
        opportunities: [],
        totalExtracted: 0,
        extractionMetrics: {}
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-custom')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions, customAnthropicClient)

      expect(customAnthropicClient.getPerformanceMetrics).toHaveBeenCalled()
      expect(result.extractionMetrics.totalTokens).toBe(1000)
      
      // Verify extractOpportunitiesWithSchema was called with the custom client
      expect(extractOpportunitiesWithSchema).toHaveBeenCalledWith(
        expect.any(Object),
        mockSource,
        customAnthropicClient, // Should use the custom client we passed
        mockInstructions
      )
    })

    test('should ensure minimum execution time of 1ms', async () => {
      const mockSource = {
        id: 'source-fast',
        name: 'Fast Source'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const mockApiData = {
        rawResponse: { data: [] },
        data: [],
        totalFound: 0,
        totalRetrieved: 0
      }

      const mockExtractedData = {
        opportunities: [],
        totalExtracted: 0,
        extractionMetrics: {}
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-fast')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.executionTime).toBeGreaterThanOrEqual(1)
      expect(result.extractionMetrics.executionTime).toBeGreaterThanOrEqual(1)
    })

    test('should add source tracking to all opportunities', async () => {
      const mockSource = {
        id: 'source-tracking',
        name: 'Tracking Test Source'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const mockApiData = {
        rawResponse: { data: [{ id: '1' }, { id: '2' }, { id: '3' }] },
        data: [{ id: '1' }, { id: '2' }, { id: '3' }],
        totalFound: 3,
        totalRetrieved: 3
      }

      const mockExtractedData = {
        opportunities: [
          { id: 'opp-1', title: 'Opportunity 1' },
          { id: 'opp-2', title: 'Opportunity 2' },
          { id: 'opp-3', title: 'Opportunity 3' }
        ],
        totalExtracted: 3,
        extractionMetrics: {}
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-tracking-123')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      // Verify ALL opportunities have source tracking
      result.opportunities.forEach(opp => {
        expect(opp.sourceId).toBe('source-tracking')
        expect(opp.sourceName).toBe('Tracking Test Source')
        expect(opp.rawResponseId).toBe('raw-tracking-123')
      })
    })
  })

  describe('Performance Tracking', () => {
    test('should track execution time', async () => {
      const mockSource = {
        id: 'source-15',
        name: 'Performance Test API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const mockApiData = {
        rawResponse: { data: [{ id: 'perf-1' }] },
        data: [{ id: 'perf-1' }],
        totalFound: 1,
        totalRetrieved: 1
      }

      const mockExtractedData = {
        opportunities: [{ id: 'perf-opp-1' }],
        totalExtracted: 1,
        extractionMetrics: {}
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-perf')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      expect(result.executionTime).toBeDefined()
      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.extractionMetrics.executionTime).toBe(result.executionTime)
    })

    test('should track token usage', async () => {
      const mockSource = {
        id: 'source-16',
        name: 'Token Tracking API'
      }

      const mockInstructions = {
        workflow: 'single_api',
        apiEndpoint: 'https://api.test.com/grants'
      }

      const mockApiData = {
        rawResponse: { data: [{ id: 'token-1' }] },
        data: [{ id: 'token-1' }],
        totalFound: 1,
        totalRetrieved: 1
      }

      const mockExtractedData = {
        opportunities: [{ id: 'token-opp-1' }],
        totalExtracted: 1,
        extractionMetrics: {},
        tokenUsage: { input: 100, output: 50, total: 150 }
      }

      handleSingleApi.mockResolvedValueOnce(mockApiData)
      storeRawResponse.mockResolvedValueOnce('raw-response-token')
      extractOpportunitiesWithSchema.mockResolvedValueOnce(mockExtractedData)

      const result = await extractFromSource(mockSource, mockInstructions)

      // Token usage comes from anthropicClient.getPerformanceMetrics()
      // which returns 500 in our mock
      expect(result.extractionMetrics.totalTokens).toBe(500)
      
      // Verify logAgentExecution was called with the tokenUsage from extraction
      expect(logAgentExecution).toHaveBeenCalledWith(
        expect.any(Object),
        'data_extraction_v2',
        expect.any(Object),
        expect.any(Object),
        expect.any(Number),
        mockExtractedData.tokenUsage // This should be passed
      )
    })
  })
})