// Mock implementation of RunManagerV2
export class RunManagerV2 {
  constructor(existingRunId = null, supabaseClient = null) {
    this.supabase = supabaseClient
    this.runId = existingRunId || 'test-run-id'
    this.v2RunId = null
    this.startTime = Date.now()
    this.isCompleted = false
    this.isUpdating = false
    
    // Mock methods
    this.startRun = jest.fn().mockResolvedValue(this.runId)
    this.recordStageMetrics = jest.fn().mockResolvedValue()
    this.completeRun = jest.fn().mockResolvedValue()
    this.updateRunStatus = jest.fn().mockResolvedValue()
    this.recordError = jest.fn().mockResolvedValue()
  }
}