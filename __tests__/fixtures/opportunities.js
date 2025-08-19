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

// Edge case generators for comprehensive testing

export function generateMinimalOpportunity(overrides = {}) {
  return {
    id: `MINIMAL-${Date.now()}`,
    title: 'Minimal Required Fields Only',
    ...overrides
  }
}

export function generateOpportunityWithNulls(overrides = {}) {
  return {
    id: `NULL-${Date.now()}`,
    title: 'Opportunity with null values',
    description: null,
    closeDate: null,
    minimumAward: null,
    maximumAward: null,
    eligibleApplicants: null,
    fundingType: null,
    ...overrides
  }
}

export function generateOpportunityWithEmptyStrings(overrides = {}) {
  return {
    id: `EMPTY-${Date.now()}`,
    title: '',
    description: '',
    closeDate: '',
    category: '',
    fundingInstrumentType: '',
    ...overrides
  }
}

export function generateOpportunityWithLongContent(overrides = {}) {
  const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100);
  return {
    id: `LONG-${Date.now()}`,
    title: 'Opportunity with very long content fields for token limit testing',
    description: longText, // ~5000 characters
    eligibleActivities: Array(50).fill('Activity').map((a, i) => `${a} ${i}`),
    eligibleProjectTypes: Array(30).fill('Type').map((t, i) => `${t} ${i}`),
    ...overrides
  }
}

export function generateOpportunityWithSpecialChars(overrides = {}) {
  return {
    id: `SPECIAL-${Date.now()}`,
    title: 'Grant with "quotes" & special <characters>',
    description: 'Description with\nnewlines\ttabs and unicode: 日本 €£¥',
    category: 'Energy & Environment',
    fundingInstrumentType: 'Grant/Loan',
    ...overrides
  }
}

export function generateOpportunityWithHTMLContent(overrides = {}) {
  return {
    id: `HTML-${Date.now()}`,
    title: 'Grant with <strong>HTML</strong> content',
    description: '<p>This grant includes <b>bold</b> and <a href="#">links</a></p>',
    eligibleActivities: ['<div>Activity 1</div>', '<span>Activity 2</span>'],
    ...overrides
  }
}

export function generateOpportunityWithInvalidDates(overrides = {}) {
  return {
    id: `INVALID-DATE-${Date.now()}`,
    title: 'Opportunity with invalid date formats',
    closeDate: 'Not a valid date',
    openDate: '2024-13-45', // Invalid month and day
    ...overrides
  }
}

export function generateOpportunityWithNegativeAmounts(overrides = {}) {
  return {
    id: `NEGATIVE-${Date.now()}`,
    title: 'Opportunity with negative funding amounts',
    minimumAward: -10000,
    maximumAward: -500000,
    totalFundingAvailable: -1000000,
    ...overrides
  }
}

export function generateOpportunityWithMismatchedAmounts(overrides = {}) {
  return {
    id: `MISMATCH-${Date.now()}`,
    title: 'Opportunity with illogical funding amounts',
    minimumAward: 500000, // Min > Max
    maximumAward: 10000,
    totalFundingAvailable: 5000, // Total < Max
    ...overrides
  }
}

export function generateBatchWithAllEdgeCases() {
  return [
    generateMinimalOpportunity({ id: 'EDGE-1' }),
    generateOpportunityWithNulls({ id: 'EDGE-2' }),
    generateOpportunityWithEmptyStrings({ id: 'EDGE-3' }),
    generateOpportunityWithLongContent({ id: 'EDGE-4' }),
    generateOpportunityWithSpecialChars({ id: 'EDGE-5' }),
    generateOpportunityWithHTMLContent({ id: 'EDGE-6' }),
    generateOpportunityWithInvalidDates({ id: 'EDGE-7' }),
    generateOpportunityWithNegativeAmounts({ id: 'EDGE-8' }),
    generateOpportunityWithMismatchedAmounts({ id: 'EDGE-9' })
  ]
}

export function generateVeryLargeBatch(count = 500) {
  const opportunities = []
  const generators = [
    generateNewOpportunity,
    generateMinimalOpportunity,
    generateOpportunityWithLongContent,
    generateOpportunityWithSpecialChars
  ]
  
  for (let i = 0; i < count; i++) {
    const generator = generators[i % generators.length]
    opportunities.push(generator({ id: `LARGE-BATCH-${i}` }))
  }
  
  return opportunities
}

export function generateOpportunityForScoring(score = 'high', overrides = {}) {
  const configs = {
    high: {
      title: 'Municipal Energy Infrastructure Modernization Grant',
      description: 'Federal grant for municipal governments to upgrade energy infrastructure with smart grid technology',
      eligibleApplicants: ['Municipal Government', 'State Government'],
      eligibleActivities: ['Energy Infrastructure', 'Grid Modernization', 'Renewable Energy'],
      fundingInstrumentType: 'Grant',
      minimumAward: 1000000,
      maximumAward: 10000000,
      totalFundingAvailable: 100000000
    },
    medium: {
      title: 'Environmental Services Support Program',
      description: 'Funding for environmental remediation and conservation projects',
      eligibleApplicants: ['Non-profit', 'Private Company'],
      eligibleActivities: ['Environmental Remediation', 'Conservation'],
      fundingInstrumentType: 'Cooperative Agreement',
      minimumAward: 50000,
      maximumAward: 500000,
      totalFundingAvailable: 10000000
    },
    low: {
      title: 'Academic Research Initiative',
      description: 'Grants for university research in theoretical physics',
      eligibleApplicants: ['Educational Institution'],
      eligibleActivities: ['Research', 'Education'],
      fundingInstrumentType: 'Grant',
      minimumAward: 10000,
      maximumAward: 50000,
      totalFundingAvailable: 1000000
    },
    zero: {
      title: 'International Arts Exchange Program',
      description: 'Cultural exchange program for artists',
      eligibleApplicants: ['Individual', 'Arts Organization'],
      eligibleActivities: ['Arts', 'Cultural Exchange'],
      fundingInstrumentType: 'Fellowship',
      minimumAward: 5000,
      maximumAward: 15000,
      totalFundingAvailable: 200000
    }
  }
  
  const config = configs[score] || configs.medium
  return generateOpportunity({
    id: `SCORING-${score.toUpperCase()}-${Date.now()}`,
    ...config,
    ...overrides
  })
}