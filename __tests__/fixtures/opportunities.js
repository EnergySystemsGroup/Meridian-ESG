// Test Opportunity Data Generators

export function generateOpportunity(overrides = {}) {
  return {
    id: `TEST-${Date.now()}`,
    title: 'Federal Research Grant',
    description: 'Funding for research projects',
    closeDate: '2024-12-31',
    openDate: '2024-01-01',
    minimumAward: 10000,
    maximumAward: 500000,
    status: 'posted',
    category: 'Research',
    eligibleApplicants: ['Non-profit', 'Educational Institution'],
    fundingInstrumentType: 'Grant',
    cfda: '12.345',
    version: 1,
    ...overrides
  }
}

export function generateNewOpportunity(overrides = {}) {
  return generateOpportunity({
    id: `NEW-${Date.now()}`,
    title: `New Grant Opportunity ${Date.now()}`,
    ...overrides
  })
}

export function generateExistingOpportunity(overrides = {}) {
  return generateOpportunity({
    id: 'EXISTING-001',
    title: 'Existing Federal Grant',
    ...overrides
  })
}

export function generateDuplicateOpportunity(overrides = {}) {
  return generateOpportunity({
    id: 'EXISTING-001',
    title: 'Existing Federal Grant',
    description: 'Same opportunity, no changes',
    ...overrides
  })
}

export function generateUpdatedOpportunity(overrides = {}) {
  return generateOpportunity({
    id: 'EXISTING-001',
    title: 'Existing Federal Grant',
    closeDate: '2025-01-15', // Material change
    maximumAward: 750000, // Material change (>5%)
    ...overrides
  })
}

export function generateMinorChangeOpportunity(overrides = {}) {
  return generateOpportunity({
    id: 'EXISTING-001',
    title: 'Existing Federal Grant',
    description: 'Slightly updated description', // Minor change
    maximumAward: 510000, // <5% change
    ...overrides
  })
}

export function generateMixedBatch() {
  return [
    generateNewOpportunity({ id: 'NEW-1' }),
    generateNewOpportunity({ id: 'NEW-2' }),
    generateUpdatedOpportunity({ 
      id: 'EXISTING-1',
      closeDate: '2025-01-15' // Material change
    }),
    generateDuplicateOpportunity({ id: 'EXISTING-2' }), // No change
    generateMinorChangeOpportunity({ id: 'EXISTING-3' }) // Minor change
  ]
}

export function generateLargeBatch(count = 100) {
  const opportunities = []
  for (let i = 0; i < count; i++) {
    const type = i % 3
    if (type === 0) {
      opportunities.push(generateNewOpportunity({ id: `NEW-${i}` }))
    } else if (type === 1) {
      opportunities.push(generateUpdatedOpportunity({ id: `EXISTING-${i}` }))
    } else {
      opportunities.push(generateDuplicateOpportunity({ id: `DUP-${i}` }))
    }
  }
  return opportunities
}

export function generateInvalidOpportunity() {
  return {
    // Missing required fields: id and title
    description: 'Invalid opportunity without ID or title',
    closeDate: '2024-12-31'
  }
}

export function generatePartialOpportunity() {
  return {
    id: 'PARTIAL-001',
    title: 'Partial Opportunity',
    // Missing other fields
  }
}