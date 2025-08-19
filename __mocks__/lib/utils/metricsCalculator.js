// Mock implementation of metricsCalculator

export const SLA_TARGETS = {
  maxProcessingTimeMinutes: 30,
  minSuccessRate: 95,
  maxCostPerOpportunity: 0.05,
  minThroughput: 10,
  maxErrorRate: 5
}

export const FAILURE_CATEGORIES = {
  API_ERRORS: 'apiErrors',
  VALIDATION_ERRORS: 'validationErrors',
  DUPLICATE_REJECTIONS: 'duplicateRejections',
  PROCESSING_ERRORS: 'processingErrors',
  STORAGE_ERRORS: 'storageErrors',
  TIMEOUT_ERRORS: 'timeoutErrors'
}

export const calculateSuccessRate = jest.fn().mockImplementation((metrics) => {
  if (!metrics || !metrics.totalOpportunities) return 0
  
  const totalFailures = Object.values(metrics.failures || {})
    .reduce((sum, count) => sum + (count || 0), 0)
  
  const successRate = ((metrics.totalOpportunities - totalFailures) / metrics.totalOpportunities) * 100
  return Math.round(Math.max(0, Math.min(100, successRate)))
})

export const calculateSLACompliance = jest.fn().mockImplementation((metrics, targets = SLA_TARGETS) => {
  const compliance = {
    overall: 85,
    breakdown: {
      timeCompliance: 90,
      successCompliance: 100,
      costCompliance: 100,
      throughputCompliance: 100
    },
    grade: 'B'
  }
  
  // Simple mock calculations
  if (metrics.executionTimeMinutes && metrics.executionTimeMinutes <= targets.maxProcessingTimeMinutes) {
    compliance.breakdown.timeCompliance = 100
  }
  
  if (metrics.successRate && metrics.successRate >= targets.minSuccessRate) {
    compliance.breakdown.successCompliance = 100
  }
  
  if (metrics.costPerOpportunity && metrics.costPerOpportunity <= targets.maxCostPerOpportunity) {
    compliance.breakdown.costCompliance = 100
  }
  
  if (metrics.throughput && metrics.throughput >= targets.minThroughput) {
    compliance.breakdown.throughputCompliance = 100
  }
  
  // Calculate overall
  const scores = Object.values(compliance.breakdown)
  compliance.overall = scores.reduce((a, b) => a + b, 0) / scores.length
  
  // Assign grade
  if (compliance.overall >= 90) compliance.grade = 'A'
  else if (compliance.overall >= 80) compliance.grade = 'B'
  else if (compliance.overall >= 70) compliance.grade = 'C'
  else if (compliance.overall >= 60) compliance.grade = 'D'
  else compliance.grade = 'F'
  
  return compliance
})