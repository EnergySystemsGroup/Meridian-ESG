// Test Run Data Generators

export function generateRun(overrides = {}) {
  return {
    id: 'run-test-1',
    source_id: 'source-test-1',
    status: 'pending',
    started_at: new Date().toISOString(),
    completed_at: null,
    opportunities_processed: 0,
    opportunities_added: 0,
    opportunities_updated: 0,
    opportunities_skipped: 0,
    error_message: null,
    metrics: {},
    ...overrides
  }
}

export function generateCompletedRun(overrides = {}) {
  const startTime = new Date()
  const endTime = new Date(startTime.getTime() + 60000) // 1 minute later
  
  return generateRun({
    id: 'run-completed-1',
    status: 'completed',
    started_at: startTime.toISOString(),
    completed_at: endTime.toISOString(),
    opportunities_processed: 100,
    opportunities_added: 40,
    opportunities_updated: 30,
    opportunities_skipped: 30,
    metrics: {
      total_duration_ms: 60000,
      extraction_time_ms: 5000,
      duplicate_detection_time_ms: 2000,
      analysis_time_ms: 30000,
      storage_time_ms: 3000,
      tokens_used: 15000,
      tokens_saved: 10000,
      optimization_percentage: 40
    },
    ...overrides
  })
}

export function generateFailedRun(overrides = {}) {
  return generateRun({
    id: 'run-failed-1',
    status: 'failed',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    error_message: 'API rate limit exceeded',
    opportunities_processed: 10,
    opportunities_added: 5,
    ...overrides
  })
}

export function generateInProgressRun(overrides = {}) {
  return generateRun({
    id: 'run-in-progress-1',
    status: 'processing',
    started_at: new Date().toISOString(),
    opportunities_processed: 50,
    opportunities_added: 20,
    opportunities_updated: 15,
    opportunities_skipped: 15,
    ...overrides
  })
}

export function generateRunHistory() {
  return [
    generateCompletedRun({ id: 'run-1', started_at: '2024-01-01T00:00:00Z' }),
    generateCompletedRun({ id: 'run-2', started_at: '2024-01-02T00:00:00Z' }),
    generateFailedRun({ id: 'run-3', started_at: '2024-01-03T00:00:00Z' }),
    generateCompletedRun({ id: 'run-4', started_at: '2024-01-04T00:00:00Z' }),
    generateInProgressRun({ id: 'run-5' })
  ]
}