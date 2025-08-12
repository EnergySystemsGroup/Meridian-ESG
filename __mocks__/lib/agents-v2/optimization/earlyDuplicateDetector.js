// Mock implementation of earlyDuplicateDetector
import { jest } from '@jest/globals';

export const detectDuplicates = jest.fn().mockImplementation(async (
  opportunities,
  sourceId,
  supabase,
  rawResponseId = null
) => {
  // Default mock returns all as new
  return {
    newOpportunities: opportunities || [],
    opportunitiesToUpdate: [],
    opportunitiesToSkip: [],
    metrics: {
      tokensSaved: 0,
      duplicatesDetected: 0,
      executionTime: 50
    }
  }
})