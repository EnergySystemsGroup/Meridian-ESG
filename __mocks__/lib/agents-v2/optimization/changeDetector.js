// Mock implementation of changeDetector
export const detectMaterialChanges = jest.fn().mockImplementation((existing, opportunity) => {
  // Simple mock logic for testing
  
  // Check amount changes >5%
  if (existing.maximumAward && opportunity.maximumAward) {
    const percentChange = Math.abs((opportunity.maximumAward - existing.maximumAward) / existing.maximumAward)
    if (percentChange > 0.05) return true
  }
  
  // Check date changes
  if (existing.closeDate !== opportunity.closeDate) return true
  if (existing.openDate !== opportunity.openDate) return true
  
  // Check status changes
  if (existing.status !== opportunity.status) return true
  
  // Default to no material changes
  return false
})