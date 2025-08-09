/**
 * Mock Supabase Client for Integration Tests
 * 
 * Provides a comprehensive mock that simulates Supabase database operations
 * with realistic constraint checking for the V2 pipeline integration tests.
 */

class MockSupabaseDatabase {
  constructor() {
    // In-memory storage
    this.tables = {
      funding_opportunities: new Map(),
      api_sources: new Map(),
      runs: new Map(),
      api_source_configurations: new Map()
    }
    
    // Define constraints to match real database
    this.constraints = {
      funding_opportunities: {
        unique: ['api_opportunity_id', 'source_id'], // Composite unique
        foreignKeys: { source_id: 'api_sources' },
        required: ['api_opportunity_id', 'source_id', 'title']
      },
      runs: {
        unique: ['id'],
        foreignKeys: { source_id: 'api_sources' },
        required: ['source_id', 'status']
      },
      api_sources: {
        unique: ['id', 'name'],
        required: ['name', 'type']
      }
    }
    
    // Initialize with base data
    this.initializeBaseData()
  }
  
  initializeBaseData() {
    // Add default test source
    this.tables.api_sources.set('test-source-1', {
      id: 'test-source-1',
      name: 'Test Funding Source',
      type: 'api',
      enabled: true,
      force_full_reprocessing: false,
      created_at: new Date().toISOString()
    })
  }
  
  checkUniqueConstraint(table, data) {
    const constraints = this.constraints[table]?.unique || []
    const tableData = this.tables[table]
    
    // Check composite unique constraint
    if (table === 'funding_opportunities' && data.api_opportunity_id && data.source_id) {
      for (const [id, record] of tableData) {
        if (record.api_opportunity_id === data.api_opportunity_id && 
            record.source_id === data.source_id &&
            id !== data.id) {
          return {
            error: {
              code: '23505',
              message: `duplicate key value violates unique constraint "funding_opportunities_api_opportunity_id_source_id_key"`,
              details: `Key (api_opportunity_id, source_id)=(${data.api_opportunity_id}, ${data.source_id}) already exists.`
            }
          }
        }
      }
    }
    
    return null
  }
  
  checkForeignKeyConstraint(table, data) {
    const foreignKeys = this.constraints[table]?.foreignKeys || {}
    
    for (const [field, refTable] of Object.entries(foreignKeys)) {
      if (data[field] && !this.tables[refTable].has(data[field])) {
        return {
          error: {
            code: '23503',
            message: `insert or update on table "${table}" violates foreign key constraint`,
            details: `Key (${field})=(${data[field]}) is not present in table "${refTable}".`
          }
        }
      }
    }
    
    return null
  }
  
  checkRequiredFields(table, data) {
    const required = this.constraints[table]?.required || []
    const missing = required.filter(field => !data[field])
    
    if (missing.length > 0) {
      return {
        error: {
          code: '23502',
          message: `null value in column "${missing[0]}" violates not-null constraint`,
          details: `Failing row contains null value for required field: ${missing[0]}`
        }
      }
    }
    
    return null
  }
}

export function createMockSupabaseClient() {
  const db = new MockSupabaseDatabase()
  let callCount = 0
  
  const mockFrom = (table) => {
    return {
      select: jest.fn((columns) => ({
        eq: jest.fn((column, value) => ({
          single: jest.fn().mockResolvedValue(() => {
            // Find matching record
            for (const [id, record] of db.tables[table]) {
              if (record[column] === value) {
                return { data: record, error: null }
              }
            }
            return { data: null, error: null }
          }),
          mockResolvedValue: jest.fn().mockResolvedValue(() => {
            const results = []
            for (const [id, record] of db.tables[table]) {
              if (record[column] === value) {
                results.push(record)
              }
            }
            return { data: results, error: null }
          })
        })),
        neq: jest.fn((column, value) => ({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })),
        mockResolvedValue: jest.fn().mockResolvedValue(() => {
          return { data: Array.from(db.tables[table].values()), error: null }
        })
      })),
      insert: jest.fn((data) => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue(() => {
            // Check constraints
            const requiredCheck = db.checkRequiredFields(table, data)
            if (requiredCheck) return requiredCheck
            
            const uniqueCheck = db.checkUniqueConstraint(table, data)
            if (uniqueCheck) return uniqueCheck
            
            const fkCheck = db.checkForeignKeyConstraint(table, data)
            if (fkCheck) return fkCheck
            
            // Generate ID if not provided
            const id = data.id || `${table}-${Date.now()}`
            const record = {
              id,
              created_at: new Date().toISOString(),
              ...data
            }
            
            // Store in database
            db.tables[table].set(id, record)
            
            return { data: record, error: null }
          })
        }))
      })),
      update: jest.fn((data) => ({
        eq: jest.fn((column, value) => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue(() => {
              // Find record to update
              for (const [id, record] of db.tables[table]) {
                if (record[column] === value) {
                  // Check foreign key constraints on update
                  const fkCheck = db.checkForeignKeyConstraint(table, data)
                  if (fkCheck) return fkCheck
                  
                  // Perform selective field update (preserves unchanged fields)
                  const updated = {
                    ...record,
                    ...data,
                    updated_at: new Date().toISOString()
                  }
                  
                  db.tables[table].set(id, updated)
                  return { data: updated, error: null }
                }
              }
              return { 
                data: null, 
                error: { 
                  code: 'PGRST116',
                  message: 'No rows found for update'
                }
              }
            })
          })),
          mockResolvedValue: jest.fn().mockResolvedValue(() => {
            const updated = []
            for (const [id, record] of db.tables[table]) {
              if (record[column] === value) {
                const updatedRecord = {
                  ...record,
                  ...data,
                  updated_at: new Date().toISOString()
                }
                db.tables[table].set(id, updatedRecord)
                updated.push(updatedRecord)
              }
            }
            return { data: updated, error: null }
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