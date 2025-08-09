// Mock for Anthropic SDK
// This provides a mock implementation of the Anthropic client for testing

const mockAnthropicClient = {
  messages: {
    create: jest.fn().mockImplementation(async ({ messages, model, max_tokens }) => {
      // Default mock response for analysis agent
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            enhanced_title: messages[0]?.content?.includes('title') ? 'Enhanced Grant Title' : 'Default Title',
            enhanced_description: 'This is an enhanced description with better clarity and keywords.',
            eligibility_score: 85,
            eligibility_reasoning: 'High match based on organization type and location.',
            tags: ['federal', 'research', 'technology'],
            key_dates: {
              open_date: '2024-01-01',
              close_date: '2024-12-31',
              announcement_date: '2024-01-15'
            },
            funding_details: {
              total_available: 5000000,
              min_award: 50000,
              max_award: 500000,
              estimated_awards: 10
            },
            requirements: [
              'Non-profit status',
              'Research capability',
              'US-based organization'
            ],
            strategic_alignment: 'High alignment with federal research priorities.',
            application_tips: [
              'Focus on innovation aspects',
              'Highlight past performance',
              'Include detailed budget justification'
            ]
          })
        }],
        usage: {
          input_tokens: 500,
          output_tokens: 250,
          total_tokens: 750
        },
        model: model || 'claude-3-opus-20240229',
        stop_reason: 'end_turn'
      }

      return mockResponse
    })
  }
}

// Mock constructor
const Anthropic = jest.fn(() => mockAnthropicClient)

// Static properties
Anthropic.mockClient = mockAnthropicClient
Anthropic.resetMocks = () => {
  mockAnthropicClient.messages.create.mockClear()
}

// Helper to set custom responses
Anthropic.setMockResponse = (response) => {
  mockAnthropicClient.messages.create.mockResolvedValueOnce(response)
}

// Helper to simulate errors
Anthropic.setMockError = (error) => {
  mockAnthropicClient.messages.create.mockRejectedValueOnce(error)
}

module.exports = Anthropic