import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals'

// First, import from the mock file directly to get the mock objects
import * as supabaseMocks from '../../../__mocks__/lib/supabase.js'

// Mock the actual module to use our manual mock
jest.mock('../../../lib/supabase.js', () => supabaseMocks)

// Import everything AFTER mocking  
import { analyzeSource, getNextSourceToProcess, getSourceById } from '../../../lib/agents-v2/core/sourceOrchestrator.js'

// Use the mocks from the manual mock file
const { createSupabaseClient, mockSupabaseClient } = supabaseMocks

// Mock console methods to suppress warnings in tests
const originalWarn = console.warn
const originalError = console.error
const originalLog = console.log

beforeAll(() => {
  // Mock console methods
  console.warn = jest.fn()
  console.error = jest.fn()
  console.log = jest.fn()
})

afterAll(() => {
  console.warn = originalWarn
  console.error = originalError
  console.log = originalLog
})

describe('Source Orchestrator Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset mock implementations
    mockSupabaseClient.rpc.mockReset()
    mockSupabaseClient.from.mockReset()
    
    // Set default mock behaviors
    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: null })
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      })
    })
    
    // Ensure createSupabaseClient returns our mock
    createSupabaseClient.mockReturnValue(mockSupabaseClient)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('analyzeSource', () => {
    describe('Configuration Validation', () => {
      test('should validate that source is required', async () => {
        await expect(analyzeSource(null)).rejects.toThrow('Source is required')
      })

      test('should validate that source name is required', async () => {
        const invalidSource = {
          id: 'test-id',
          api_endpoint: 'https://api.example.com'
        }
        await expect(analyzeSource(invalidSource)).rejects.toThrow('Source name is required')
      })

      test('should validate that api_endpoint is required', async () => {
        const invalidSource = {
          id: 'test-id',
          name: 'Test Source'
        }
        await expect(analyzeSource(invalidSource)).rejects.toThrow('Source api_endpoint is required')
      })

      test('should handle source with missing configurations gracefully', async () => {
        const source = {
          id: 'test-source-1',
          name: 'Test API',
          api_endpoint: 'https://api.test.com/v1'
        }

        const result = await analyzeSource(source)

        expect(result).toMatchObject({
          workflow: 'single_api',
          apiEndpoint: 'https://api.test.com/v1',
          requestConfig: { method: 'GET' },
          queryParameters: {},
          requestBody: null,
          responseConfig: {},
          paginationConfig: { enabled: false },
          detailConfig: { enabled: false },
          responseMapping: {},
          authMethod: 'none',
          authDetails: {},
          handlerType: 'standard',
          apiNotes: '',
          processingNotes: ['Analysis completed for Test API']
        })
      })
    })

    describe('API Endpoint Construction', () => {
      test('should correctly set API endpoint from source', async () => {
        const source = {
          id: 'test-1',
          name: 'Grants API',
          api_endpoint: 'https://api.grants.gov/v2/opportunities',
          configurations: {}
        }

        const result = await analyzeSource(source)
        expect(result.apiEndpoint).toBe('https://api.grants.gov/v2/opportunities')
      })

      test('should preserve query parameters in configurations', async () => {
        const source = {
          id: 'test-2',
          name: 'Federal Grants',
          api_endpoint: 'https://api.example.com/grants',
          configurations: {
            query_params: {
              limit: 100,
              offset: 0,
              status: 'active'
            }
          }
        }

        const result = await analyzeSource(source)
        expect(result.queryParameters).toEqual({
          limit: 100,
          offset: 0,
          status: 'active'
        })
      })
    })

    describe('Scheduling and Timing Logic', () => {
      test('should track execution time', async () => {
        const source = {
          id: 'test-timing',
          name: 'Timing Test',
          api_endpoint: 'https://api.test.com'
        }

        const result = await analyzeSource(source)
        
        expect(result.executionTime).toBeDefined()
        expect(result.executionTime).toBeGreaterThan(0)
      })

      test('should ensure minimum execution time of 1ms', async () => {
        const source = {
          id: 'test-min-time',
          name: 'Min Time Test',
          api_endpoint: 'https://api.test.com'
        }

        const result = await analyzeSource(source)
        expect(result.executionTime).toBeGreaterThanOrEqual(1)
      })
    })

    describe('Error Handling', () => {
      test('should handle invalid source configurations', async () => {
        const source = {
          id: 'invalid-config',
          name: 'Invalid Config Source',
          api_endpoint: 'https://api.test.com',
          configurations: {
            detail_config: 'invalid' // Should be an object
          }
        }

        // Should not throw, but handle gracefully
        const result = await analyzeSource(source)
        expect(result).toBeDefined()
        expect(result.detailConfig).toEqual('invalid')
      })

      test('should handle undefined configurations object', async () => {
        const source = {
          id: 'no-config',
          name: 'No Config Source',
          api_endpoint: 'https://api.test.com',
          configurations: undefined
        }

        const result = await analyzeSource(source)
        expect(result.requestConfig).toEqual({ method: 'GET' })
        expect(result.queryParameters).toEqual({})
      })
    })


    describe('Two-Step API Detection', () => {
      test('should identify two-step API workflow when detail_config is enabled', async () => {
        const source = {
          id: 'two-step',
          name: 'Two Step API',
          api_endpoint: 'https://api.test.com/list',
          configurations: {
            detail_config: {
              enabled: true,
              endpoint: '/details/{id}',
              method: 'GET'
            }
          }
        }

        const result = await analyzeSource(source)
        expect(result.workflow).toBe('two_step_api')
        expect(result.detailConfig).toEqual({
          enabled: true,
          endpoint: '/details/{id}',
          method: 'GET'
        })
      })

      test('should use single_api workflow when detail_config is disabled', async () => {
        const source = {
          id: 'single-step',
          name: 'Single Step API',
          api_endpoint: 'https://api.test.com/data',
          configurations: {
            detail_config: {
              enabled: false
            }
          }
        }

        const result = await analyzeSource(source)
        expect(result.workflow).toBe('single_api')
      })
    })

    describe('Authentication Configuration', () => {
      test('should handle API key authentication', async () => {
        const source = {
          id: 'api-key-auth',
          name: 'API Key Auth',
          api_endpoint: 'https://api.test.com',
          auth_type: 'apikey',
          auth_details: {
            header: 'X-API-Key',
            value: 'test-key-123'
          }
        }

        const result = await analyzeSource(source)
        expect(result.authMethod).toBe('apikey')
        expect(result.authDetails).toEqual({
          header: 'X-API-Key',
          value: 'test-key-123'
        })
      })

      test('should handle Bearer token authentication', async () => {
        const source = {
          id: 'bearer-auth',
          name: 'Bearer Auth',
          api_endpoint: 'https://api.test.com',
          auth_type: 'bearer',
          auth_details: {
            token: 'bearer-token-456'
          }
        }

        const result = await analyzeSource(source)
        expect(result.authMethod).toBe('bearer')
        expect(result.authDetails.token).toBe('bearer-token-456')
      })

      test('should default to no authentication', async () => {
        const source = {
          id: 'no-auth',
          name: 'No Auth',
          api_endpoint: 'https://api.test.com'
        }

        const result = await analyzeSource(source)
        expect(result.authMethod).toBe('none')
        expect(result.authDetails).toEqual({})
      })
    })
  })

  describe('getNextSourceToProcess', () => {
    test('should fetch next source from queue successfully', async () => {
      const mockSource = {
        id: 'source-123',
        name: 'Test Source',
        api_endpoint: 'https://api.test.com',
        enabled: true
      }

      const mockConfigs = [
        { config_type: 'request_config', configuration: { method: 'GET' } },
        { config_type: 'query_params', configuration: { limit: 50 } }
      ]

      // Mock RPC call for getting next source
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [mockSource],
        error: null
      })

      // Mock configurations fetch
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'api_source_configurations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        // Default return for any other table
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        }
      })

      const result = await getNextSourceToProcess()

      expect(result).toEqual({
        ...mockSource,
        configurations: {
          request_config: { method: 'GET' },
          query_params: { limit: 50 }
        }
      })
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_next_api_source_to_process')
    })

    test('should return null when no sources are available', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const result = await getNextSourceToProcess()
      expect(result).toBeNull()
    })

    test('should handle database errors gracefully', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed')
      })

      const result = await getNextSourceToProcess()
      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalled()
    })
    
    test('should create only one supabase client per call', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null
      })
      
      await getNextSourceToProcess()
      expect(createSupabaseClient).toHaveBeenCalledTimes(1)
    })

    test('should handle configuration fetch errors', async () => {
      const mockSource = {
        id: 'source-456',
        name: 'Error Source',
        api_endpoint: 'https://api.test.com'
      }

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [mockSource],
        error: null
      })

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'api_source_configurations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Config fetch failed')
              })
            })
          }
        }
      })

      const result = await getNextSourceToProcess()
      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('getSourceById', () => {
    test('should fetch specific source by ID', async () => {
      const sourceId = 'test-source-789'
      const mockSource = {
        id: sourceId,
        name: 'Specific Source',
        api_endpoint: 'https://api.specific.com',
        enabled: true
      }

      const mockConfigs = [
        { config_type: 'pagination_config', configuration: { enabled: true, pageSize: 25 } }
      ]

      // Mock both from() calls
      mockSupabaseClient.from.mockImplementation((table) => {
        // First call is for api_sources table
        if (table === 'api_sources') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockSource,
                  error: null
                })
              })
            })
          }
        }
        
        // Second call is for api_source_configurations table
        if (table === 'api_source_configurations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        
        // Default return for any other table
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        }
      })

      const result = await getSourceById(sourceId)

      expect(result).toEqual({
        ...mockSource,
        configurations: {
          pagination_config: { enabled: true, pageSize: 25 }
        }
      })
    })

    test('should return null when source not found', async () => {
      const sourceId = 'non-existent'

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Not found')
            })
          })
        })
      })

      const result = await getSourceById(sourceId)
      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalled()
    })

    test('should handle empty configurations', async () => {
      const sourceId = 'no-config-source'
      const mockSource = {
        id: sourceId,
        name: 'No Config Source',
        api_endpoint: 'https://api.test.com'
      }

      mockSupabaseClient.from.mockImplementation((table) => {
        // First call is for api_sources table
        if (table === 'api_sources') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockSource,
                  error: null
                })
              })
            })
          }
        }
        
        // Second call is for api_source_configurations table
        if (table === 'api_source_configurations') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          }
        }
      })

      const result = await getSourceById(sourceId)

      expect(result).toEqual({
        ...mockSource,
        configurations: {}
      })
    })
  })
})
