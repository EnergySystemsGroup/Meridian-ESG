// Manual mock for scoringAnalyzer
// Note: jest.fn() doesn't work directly in manual mocks with ES modules
// We create a simple mock function that tracks calls

let mockImplementation = null
let mockResolvedValue = null
let mockRejectedValue = null
let calls = []

export const analyzeOpportunityScoring = Object.assign(
  async (...args) => {
    calls.push(args)
    
    if (mockImplementation) {
      return mockImplementation(...args)
    }
    
    if (mockRejectedValue) {
      throw mockRejectedValue
    }
    
    return mockResolvedValue || []
  },
  {
    mockImplementation: (fn) => {
      mockImplementation = fn
      return analyzeOpportunityScoring
    },
    mockResolvedValue: (value) => {
      mockResolvedValue = value
      mockRejectedValue = null
      return analyzeOpportunityScoring
    },
    mockRejectedValue: (value) => {
      mockRejectedValue = value
      mockResolvedValue = null
      return analyzeOpportunityScoring
    },
    mockClear: () => {
      calls = []
      mockImplementation = null
      mockResolvedValue = null
      mockRejectedValue = null
      return analyzeOpportunityScoring
    },
    mock: { calls }
  }
)