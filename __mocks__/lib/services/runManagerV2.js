// Mock implementation of RunManagerV2
export class RunManagerV2 {
  constructor(existingRunId = null, supabaseClient = null) {
    this.supabase = supabaseClient
    this.runId = existingRunId || `test-run-${Math.random().toString(36).substring(7)}`
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
    this.updateV2SourceOrchestrator = jest.fn().mockResolvedValue()
    this.updateV2DataExtraction = jest.fn().mockResolvedValue()
    this.updateV2EarlyDuplicateDetector = jest.fn().mockResolvedValue()
    this.updateV2Analysis = jest.fn().mockResolvedValue()
    this.updateV2Filter = jest.fn().mockResolvedValue()
    this.updateV2Storage = jest.fn().mockResolvedValue()
    this.updateV2DirectUpdate = jest.fn().mockResolvedValue()
    this.updateV2Stage = jest.fn().mockResolvedValue()
    this.updateRunError = jest.fn().mockResolvedValue()
    this.recordFailure = jest.fn().mockResolvedValue()
    this.recordStageFailure = jest.fn().mockResolvedValue()
    this.startTimeoutProtection = jest.fn()
    this.clearTimeoutProtection = jest.fn()
    this.updateOptimizationMetrics = jest.fn().mockResolvedValue()
    this.recordOpportunityPath = jest.fn().mockResolvedValue()
  }
}