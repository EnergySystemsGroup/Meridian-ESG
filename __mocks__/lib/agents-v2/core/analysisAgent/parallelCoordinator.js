// Manual mock for parallelCoordinator
// This mock provides a simplified version of executeParallelAnalysis for testing

let mockImplementation = null
let mockResolvedValue = null
let mockRejectedValue = null
let onceQueue = [] // Queue for one-time values (resolved or rejected)
let calls = []

const executeParallelAnalysisFn = async (opportunities, source, anthropic) => {
  calls.push([opportunities, source, anthropic])
  
  // Check for one-time values in queue first (highest priority)
  if (onceQueue.length > 0) {
    const { type, value } = onceQueue.shift()
    if (type === 'reject') {
      throw value
    } else {
      return value
    }
  }
  
  // Check for rejected value before implementation (to allow tests to override default impl)
  if (mockRejectedValue) {
    throw mockRejectedValue
  }
  
  if (mockResolvedValue) {
    return mockResolvedValue
  }
  
  if (mockImplementation) {
    return mockImplementation(opportunities, source, anthropic)
  }
  
  // Default implementation that returns properly formatted enhanced opportunities
  return {
    opportunities: opportunities.map(opp => ({
      ...opp,
      enhancedDescription: `Enhanced: ${opp.description || 'No description'}`,
      actionableSummary: `Summary for ${opp.title || 'Untitled'}`,
      scoring: {
        overallScore: 7.5,
        clientRelevance: 2,
        projectRelevance: 2,
        fundingAttractiveness: 2,
        fundingType: 1
      },
      relevanceReasoning: 'Test reasoning for ' + opp.id,
      concerns: []
    })),
    executionTime: 100,
    parallelProcessing: true
  }
}

// Create the mock function with Jest-like API
export const executeParallelAnalysis = Object.assign(
  executeParallelAnalysisFn,
  {
    mockImplementation: (fn) => {
      mockImplementation = fn
      return executeParallelAnalysis
    },
    mockResolvedValue: (value) => {
      mockResolvedValue = value
      mockRejectedValue = null
      return executeParallelAnalysis
    },
    mockResolvedValueOnce: (value) => {
      onceQueue.push({ type: 'resolve', value })
      return executeParallelAnalysis
    },
    mockRejectedValue: (value) => {
      mockRejectedValue = value
      mockResolvedValue = null
      return executeParallelAnalysis
    },
    mockRejectedValueOnce: (value) => {
      onceQueue.push({ type: 'reject', value })
      return executeParallelAnalysis
    },
    mockClear: () => {
      calls = []
      mockImplementation = null
      mockResolvedValue = null
      mockRejectedValue = null
      onceQueue = []
      return executeParallelAnalysis
    },
    mock: { 
      get calls() { return calls }
    }
  }
)

// Add custom matchers for Jest expectations
executeParallelAnalysis.toHaveBeenCalledWith = function(...expectedArgs) {
  return calls.some(call => {
    return JSON.stringify(call) === JSON.stringify(expectedArgs)
  })
}

// Export validateParallelResults as well (for completeness)
export function validateParallelResults(opportunities, contentResults, scoringResults) {
  const issues = []
  
  if (contentResults.length !== opportunities.length) {
    issues.push(`Content count mismatch: expected ${opportunities.length}, got ${contentResults.length}`)
  }
  
  if (scoringResults.length !== opportunities.length) {
    issues.push(`Scoring count mismatch: expected ${opportunities.length}, got ${scoringResults.length}`)
  }
  
  const opportunityIds = new Set(opportunities.map(opp => opp.id))
  const contentIds = new Set(contentResults.map(content => content.id))
  const scoringIds = new Set(scoringResults.map(scoring => scoring.id))
  
  for (const id of opportunityIds) {
    if (!contentIds.has(id)) {
      issues.push(`Missing content for opportunity ID: ${id}`)
    }
    if (!scoringIds.has(id)) {
      issues.push(`Missing scoring for opportunity ID: ${id}`)
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues: issues
  }
}