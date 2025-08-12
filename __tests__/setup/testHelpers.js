// Test Helper Functions for V2 Pipeline Testing

import { createClient } from '@supabase/supabase-js'

// Create test Supabase client
export function createTestSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
  )
}

// Mock Anthropic client
export function createMockAnthropicClient() {
  return {
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          text: JSON.stringify({
            analysis: 'Test analysis',
            eligibilityScore: 85,
            tags: ['test']
          })
        }],
        usage: {
          input_tokens: 100,
          output_tokens: 50
        }
      })
    }
  }
}

// Test database helpers
export async function clearTestDatabase(supabase, tables = []) {
  const defaultTables = [
    'funding_opportunities',
    'runs',
    'run_v2_metrics',
    'api_raw_responses'
  ]
  
  const tablesToClear = tables.length > 0 ? tables : defaultTables
  
  for (const table of tablesToClear) {
    await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }
}

export async function seedTestDatabase(supabase, data) {
  const results = {}
  
  if (data.sources) {
    const { data: sources, error } = await supabase
      .from('api_sources')
      .insert(data.sources)
      .select()
    
    if (error) throw error
    results.sources = sources
  }
  
  if (data.opportunities) {
    const { data: opportunities, error } = await supabase
      .from('funding_opportunities')
      .insert(data.opportunities)
      .select()
    
    if (error) throw error
    results.opportunities = opportunities
  }
  
  if (data.runs) {
    const { data: runs, error } = await supabase
      .from('runs')
      .insert(data.runs)
      .select()
    
    if (error) throw error
    results.runs = runs
  }
  
  return results
}

// Pipeline test helpers
export function createTestPipelineContext(overrides = {}) {
  return {
    runId: 'test-run-1',
    sourceId: 'test-source-1',
    forceFullReprocessing: false,
    metrics: {
      stages: [],
      summary: {}
    },
    ...overrides
  }
}

export function assertStageMetrics(metrics, stageName, expectations) {
  const stageMetrics = metrics.stages.find(s => s.stage_name === stageName)
  
  expect(stageMetrics).toBeDefined()
  
  if (expectations.executionTime) {
    expect(stageMetrics.execution_time_ms).toBeLessThan(expectations.executionTime)
  }
  
  if (expectations.itemsProcessed !== undefined) {
    expect(stageMetrics.items_processed).toBe(expectations.itemsProcessed)
  }
  
  if (expectations.metadata) {
    Object.entries(expectations.metadata).forEach(([key, value]) => {
      expect(stageMetrics.metadata[key]).toBe(value)
    })
  }
}

export function assertTokenOptimization(metrics, minOptimizationPercentage = 60) {
  expect(metrics.summary.optimization_percentage).toBeGreaterThanOrEqual(minOptimizationPercentage)
  expect(metrics.summary.tokens_saved).toBeGreaterThan(0)
}

// Mock data generators
export function generateMockApiResponse(opportunities) {
  return {
    data: {
      opportunities: opportunities,
      totalCount: opportunities.length,
      page: 1,
      hasMore: false
    },
    status: 200
  }
}

export function generateMockAnalysisResponse(opportunity) {
  return {
    enhanced_description: `Enhanced: ${opportunity.description}`,
    eligibility_score: Math.floor(Math.random() * 40) + 60, // 60-100
    tags: ['federal', 'grant', 'research'],
    key_dates: {
      open_date: opportunity.openDate,
      close_date: opportunity.closeDate
    },
    eligible_states: ['CA', 'NY', 'TX'],
    funding_category: 'Research & Development'
  }
}

// Assertion helpers
export function assertOpportunityPath(opportunity, expectedPath) {
  const validPaths = ['NEW', 'UPDATE', 'SKIP']
  expect(validPaths).toContain(expectedPath)
  expect(opportunity.processingPath).toBe(expectedPath)
}

export function assertDuplicateDetection(results, expectations) {
  expect(results.new.length).toBe(expectations.new || 0)
  expect(results.toUpdate.length).toBe(expectations.update || 0)
  expect(results.toSkip.length).toBe(expectations.skip || 0)
}

// Performance test helpers
export function measureExecutionTime(fn) {
  return async (...args) => {
    const start = Date.now()
    const result = await fn(...args)
    const executionTime = Date.now() - start
    return { result, executionTime }
  }
}

export function assertPerformanceBaseline(executionTime, baseline, tolerance = 0.2) {
  const maxTime = baseline * (1 + tolerance)
  expect(executionTime).toBeLessThanOrEqual(maxTime)
}

// Error simulation helpers
export function simulateApiError(error = 'API Error') {
  return Promise.reject(new Error(error))
}

export function simulateDatabaseError(error = 'Database Error') {
  return Promise.reject(new Error(error))
}

export function simulateTimeout(ms = 1000) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), ms)
  })
}