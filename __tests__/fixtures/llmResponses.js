/**
 * LLM Response Fixtures for Testing
 * 
 * Provides realistic mock responses from Claude API including:
 * - Valid responses
 * - Truncated/malformed JSON
 * - Error responses
 * - Edge cases
 */

// Valid content enhancement response
export const validContentEnhancementResponse = [
  {
    id: "TEST-001",
    enhancedDescription: "This federal grant opportunity provides critical funding for energy infrastructure modernization projects, specifically targeting municipal and state government entities seeking to upgrade aging electrical grid systems. The program emphasizes renewable energy integration, smart grid technologies, and resilience improvements that can withstand extreme weather events. Successful applicants will demonstrate clear project readiness, community benefit metrics, and alignment with federal clean energy goals. The funding structure supports both planning and implementation phases, making it ideal for comprehensive infrastructure overhauls.",
    actionableSummary: "High-value opportunity for municipal energy grid modernization with $10M+ available per project. Perfect fit for our smart grid expertise and existing municipal relationships. Quick win potential through our established project pipeline."
  },
  {
    id: "TEST-002", 
    enhancedDescription: "Comprehensive environmental remediation grant targeting brownfield sites with potential for renewable energy development. This opportunity combines cleanup funding with redevelopment incentives, creating a dual-benefit structure for communities affected by industrial legacy pollution. Priority given to projects that demonstrate job creation, environmental justice benefits, and sustainable land use planning. Technical assistance available for Phase I and II assessments.",
    actionableSummary: "Strategic opportunity for brownfield-to-solar conversions. Aligns with our environmental services division and renewable development capabilities. Consider partnering with local communities for stronger applications."
  }
];

// Valid scoring analysis response
export const validScoringResponse = [
  {
    id: "TEST-001",
    scoring: {
      clientRelevance: 3,
      projectRelevance: 3,
      fundingAttractiveness: 2.5,
      fundingType: 0,
      overallScore: 8.5
    },
    relevanceReasoning: "Strong alignment with municipal energy infrastructure focus. Grid modernization directly matches our core competencies. High funding amount justifies pursuit effort. Grant structure (not loan) maximizes client value.",
    concerns: []
  },
  {
    id: "TEST-002",
    scoring: {
      clientRelevance: 2.5,
      projectRelevance: 2.5,
      fundingAttractiveness: 2,
      fundingType: 0,
      overallScore: 7
    },
    relevanceReasoning: "Good fit for environmental services division. Brownfield expertise applicable. Renewable energy component adds value. Community partnership requirements may extend timeline.",
    concerns: ["Complex environmental assessment requirements", "Extended project timeline"]
  }
];

// Truncated JSON response (array not closed properly)
export const truncatedArrayResponse = `[
  {
    "id": "TEST-001",
    "enhancedDescription": "This federal grant opportunity provides critical funding for energy infrastructure modernization projects",
    "actionableSummary": "High-value opportunity for municipal energy grid modernization"
  },
  {
    "id": "TEST-002",
    "enhancedDescription": "Comprehensive environmental remediation grant targeting brownfield sites",
    "actionabl`;

// Truncated object (missing closing braces)
export const truncatedObjectResponse = `[
  {
    "id": "TEST-001",
    "enhancedDescription": "This federal grant opportunity provides critical funding",
    "actionableSummary": "High-value opportunity"
  },
  {
    "id": "TEST-002",
    "enhancedDescription": "Comprehensive environmental remediation grant"`;

// Malformed JSON with unescaped quotes
export const malformedQuotesResponse = `[
  {
    "id": "TEST-001",
    "enhancedDescription": "This grant includes "special" requirements that aren't properly escaped",
    "actionableSummary": "High-value opportunity"
  }
]`;

// Missing required fields
export const missingFieldsResponse = [
  {
    id: "TEST-001",
    // Missing enhancedDescription
    actionableSummary: "High-value opportunity"
  },
  {
    id: "TEST-002",
    enhancedDescription: "Comprehensive grant",
    // Missing actionableSummary
  }
];

// Extra fields in response
export const extraFieldsResponse = [
  {
    id: "TEST-001",
    enhancedDescription: "Valid description",
    actionableSummary: "Valid summary",
    unexpectedField: "This shouldn't be here",
    anotherExtra: 123
  }
];

// Empty array response
export const emptyArrayResponse = [];

// Null/undefined handling
export const nullFieldsResponse = [
  {
    id: "TEST-001",
    enhancedDescription: null,
    actionableSummary: undefined
  }
];

// Very long content response (for token limit testing)
export const longContentResponse = [
  {
    id: "TEST-001",
    enhancedDescription: "Lorem ipsum ".repeat(500), // ~5000 characters
    actionableSummary: "Summary ".repeat(50) // ~400 characters
  }
];

// Scoring edge cases
export const scoringEdgeCases = {
  // Perfect score
  perfectScore: {
    id: "TEST-001",
    scoring: {
      clientRelevance: 3,
      projectRelevance: 3,
      fundingAttractiveness: 3,
      fundingType: 1,
      overallScore: 10
    },
    relevanceReasoning: "Perfect alignment across all dimensions",
    concerns: []
  },
  
  // Zero score
  zeroScore: {
    id: "TEST-002",
    scoring: {
      clientRelevance: 0,
      projectRelevance: 0,
      fundingAttractiveness: 0,
      fundingType: 0,
      overallScore: 0
    },
    relevanceReasoning: "No alignment with business objectives",
    concerns: ["Not relevant to our services", "Outside target geography"]
  },
  
  // Invalid score values
  invalidScores: {
    id: "TEST-003",
    scoring: {
      clientRelevance: 5, // Should be max 3
      projectRelevance: -1, // Negative not allowed
      fundingAttractiveness: "high", // Should be number
      fundingType: 2, // Should be max 1
      overallScore: 15 // Out of range
    },
    relevanceReasoning: "Invalid scoring data",
    concerns: []
  }
};

// Network error responses
export const networkErrorResponse = {
  error: {
    type: "rate_limit_error",
    message: "Rate limit exceeded. Please retry after 1000ms"
  }
};

export const timeoutErrorResponse = {
  error: {
    type: "timeout",
    message: "Request timeout after 30000ms"
  }
};

// Partial batch success (some items processed, some failed)
export const partialBatchResponse = [
  {
    id: "TEST-001",
    enhancedDescription: "Successfully processed",
    actionableSummary: "Valid summary"
  },
  {
    id: "TEST-002",
    error: "Failed to process this opportunity"
  },
  {
    id: "TEST-003",
    enhancedDescription: "Another successful one",
    actionableSummary: "Good summary"
  }
];

// Response with HTML/XML content that needs escaping
export const htmlContentResponse = [
  {
    id: "TEST-001",
    enhancedDescription: "Grant for <strong>energy</strong> projects with >$1M funding & renewable focus",
    actionableSummary: "Opportunity for solar & wind projects <$5M total cost"
  }
];

// Unicode and special characters
export const unicodeResponse = [
  {
    id: "TEST-001",
    enhancedDescription: "Opportunité de financement pour l'énergie renouvelable 🌱 with 日本 partnership",
    actionableSummary: "€10M funding für Energieprojekte"
  }
];

// Deeply nested response (for testing parsing complexity)
export const nestedResponse = [
  {
    id: "TEST-001",
    enhancedDescription: "Complex opportunity",
    actionableSummary: "Summary",
    metadata: {
      processed: true,
      details: {
        categories: ["energy", "infrastructure"],
        scores: {
          primary: 8,
          secondary: 6
        }
      }
    }
  }
];

// Response with mixed valid/invalid JSON in string
export const mixedValidityResponse = `
Some preamble text that shouldn't be here
[
  {
    "id": "TEST-001",
    "enhancedDescription": "Valid JSON embedded in text",
    "actionableSummary": "Summary"
  }
]
Some trailing text
`;

// Fallback scoring response
export const fallbackScoringResponse = {
  id: "TEST-001",
  scoring: {
    clientRelevance: 1.5,
    projectRelevance: 1.5,
    fundingAttractiveness: 1.5,
    fundingType: 0.5,
    overallScore: 5
  },
  relevanceReasoning: "Requires manual review - insufficient data for accurate scoring",
  concerns: ["Incomplete opportunity data", "Manual review recommended"]
};

// Batch size test responses
export const batchResponses = {
  smallBatch: validContentEnhancementResponse.slice(0, 1),
  mediumBatch: Array(10).fill(null).map((_, i) => ({
    id: `TEST-${String(i + 1).padStart(3, '0')}`,
    enhancedDescription: `Description for opportunity ${i + 1}`,
    actionableSummary: `Summary for opportunity ${i + 1}`
  })),
  largeBatch: Array(50).fill(null).map((_, i) => ({
    id: `TEST-${String(i + 1).padStart(3, '0')}`,
    enhancedDescription: `Description for large batch item ${i + 1}`,
    actionableSummary: `Summary for large batch item ${i + 1}`
  }))
};

// Helper function to generate response with specific token count
export function generateResponseWithTokens(approximateTokens) {
  // Rough estimate: 1 token ≈ 4 characters
  const charCount = approximateTokens * 4;
  const wordCount = Math.floor(charCount / 6); // Average word length + space
  
  const description = Array(Math.floor(wordCount * 0.7))
    .fill('word')
    .join(' ');
  
  const summary = Array(Math.floor(wordCount * 0.3))
    .fill('text')
    .join(' ');
  
  return {
    id: "TEST-TOKEN",
    enhancedDescription: description,
    actionableSummary: summary
  };
}

// Export test helper for creating custom malformed responses
export function createMalformedResponse(type) {
  const types = {
    unclosedString: '{"id": "TEST", "description": "This string never closes',
    unexpectedEnd: '[{"id": "TEST", "description": "Valid"}, {"id": "TEST2", "descrip',
    invalidEscape: '{"id": "TEST", "description": "Bad escape \\q sequence"}',
    numberError: '{"id": "TEST", "score": 12.34.56}',
    missingComma: '{"id": "TEST" "description": "Missing comma"}',
    trailingComma: '{"id": "TEST", "description": "Trailing comma",}',
    singleQuotes: "{'id': 'TEST', 'description': 'Single quotes'}",
    unquotedKeys: '{id: "TEST", description: "Unquoted keys"}',
    comments: '{"id": "TEST", /* comment */ "description": "Has comments"}'
  };
  
  return types[type] || types.unclosedString;
}