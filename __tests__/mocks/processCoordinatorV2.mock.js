// Mock for processCoordinatorV2
export const processApiSourceV2 = jest.fn().mockImplementation(async (
  sourceId, 
  stages = {}, 
  supabase, 
  runManager, 
  options = {}
) => {
  // Default mock implementation
  const opportunities = stages.extractFromSource ? 
    await stages.extractFromSource() : 
    { opportunities: [], tokenUsage: 0 }
  
  if (stages.detectDuplicates) {
    await stages.detectDuplicates(opportunities.opportunities)
  }
  
  if (stages.enhanceOpportunities) {
    await stages.enhanceOpportunities(opportunities.opportunities)
  }
  
  if (stages.filterOpportunities) {
    await stages.filterOpportunities(opportunities.opportunities)
  }
  
  if (stages.storeOpportunities) {
    await stages.storeOpportunities(opportunities.opportunities)
  }
  
  return {
    success: true,
    processed: opportunities.opportunities.length,
    metrics: {
      tokenUsage: opportunities.tokenUsage || 0,
      executionTime: Date.now()
    }
  }
})