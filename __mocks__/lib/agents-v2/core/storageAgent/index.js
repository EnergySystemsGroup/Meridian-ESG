// Mock implementation of storageAgent
export const storageAgent = {
  storeOpportunities: jest.fn().mockImplementation(async (opportunities, supabase) => {
    return {
      stored: opportunities,
      errors: [],
      metrics: {
        stored: opportunities.length,
        failed: 0,
        executionTime: 100
      }
    }
  }),
  
  updateOpportunities: jest.fn().mockImplementation(async (updates, supabase) => {
    return {
      updated: updates.length,
      errors: [],
      metrics: {
        updated: updates.length,
        failed: 0,
        executionTime: 50
      }
    }
  })
}