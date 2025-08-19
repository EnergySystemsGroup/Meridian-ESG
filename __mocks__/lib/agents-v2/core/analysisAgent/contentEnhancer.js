// Manual mock for contentEnhancer
// Note: jest.fn() doesn't work directly in manual mocks with ES modules
// We create a simple mock function that tracks calls

let mockImplementation = null
let mockResolvedValue = null
let mockRejectedValue = null
let calls = []

export const enhanceOpportunityContent = Object.assign(
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
      return enhanceOpportunityContent
    },
    mockResolvedValue: (value) => {
      mockResolvedValue = value
      mockRejectedValue = null
      return enhanceOpportunityContent
    },
    mockRejectedValue: (value) => {
      mockRejectedValue = value
      mockResolvedValue = null
      return enhanceOpportunityContent
    },
    mockClear: () => {
      calls = []
      mockImplementation = null
      mockResolvedValue = null
      mockRejectedValue = null
      return enhanceOpportunityContent
    },
    mock: { calls }
  }
)