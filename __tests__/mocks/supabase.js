/**
 * Mock Supabase Client for Integration Tests
 * 
 * Provides a comprehensive mock that simulates Supabase database operations
 * for the V2 pipeline integration tests.
 */

export function createMockSupabaseClient() {
  const mockData = {
    runs: [],
    funding_opportunities: [],
    api_sources: [],
    api_source_configurations: []
  }
  
  let callCount = 0
  
  const mockFrom = (table) => {
    return {
      select: jest.fn((columns) => ({
        eq: jest.fn((column, value) => ({
          single: jest.fn().mockResolvedValue({
            data: mockData[table]?.[0] || null,
            error: null
          }),
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: mockData[table] || [],
            error: null
          })
        })),
        neq: jest.fn((column, value) => ({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })),
        mockResolvedValue: jest.fn().mockResolvedValue({
          data: mockData[table] || [],
          error: null
        })
      })),
      insert: jest.fn((data) => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { 
              id: `run-${Date.now()}`,
              source_id: data.source_id,
              status: 'processing',
              created_at: new Date().toISOString(),
              ...data
            },
            error: null
          })
        }))
      })),
      update: jest.fn((data) => ({
        eq: jest.fn((column, value) => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { ...data, id: value },
              error: null
            })
          })),
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        }))
      })),
      delete: jest.fn(() => ({
        neq: jest.fn((column, value) => ({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        }))
      })),
      upsert: jest.fn((data) => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { ...data, id: data.id || `new-${Date.now()}` },
            error: null
          })
        }))
      }))
    }
  }
  
  return {
    from: jest.fn((table) => {
      callCount++
      
      // First call is for api_sources
      if (callCount === 1 && table === 'api_sources') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: '550e8400-e29b-41d4-a716-446655440001',
                  name: 'Test Source',
                  api_url: 'https://api.test.com',
                  api_type: 'two-step'
                },
                error: null
              })
            }))
          }))
        }
      }
      
      // Second call is for api_source_configurations
      if (callCount === 2 && table === 'api_source_configurations') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({
              data: [], // Empty configurations array
              error: null
            })
          }))
        }
      }
      
      // All other calls use the generic mock
      return mockFrom(table)
    }),
    
    rpc: jest.fn((functionName, params) => {
      // Mock RPC functions
      const rpcMocks = {
        'try_advisory_lock': { data: true, error: null },
        'release_advisory_lock': { data: true, error: null },
        'should_force_full_reprocessing': { data: false, error: null },
        'disable_force_full_reprocessing': { data: null, error: null }
      }
      
      return Promise.resolve(rpcMocks[functionName] || { data: null, error: null })
    }),
    
    // Add mock data setter for testing
    setMockData: (table, data) => {
      mockData[table] = data
    }
  }
}

export function createConfiguredMockSupabase() {
  const client = createMockSupabaseClient()
  
  // Pre-configure common responses
  client.setMockData('api_sources', [{
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Test Source',
    api_url: 'https://api.test.com',
    api_type: 'two-step'
  }])
  
  return client
}