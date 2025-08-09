// Mock for Generic Funding Source API Client
// Provider-agnostic mock that can simulate any funding source API

class GenericFundingSourceClient {
  constructor(config = {}) {
    // Configurable source settings
    this.sourceName = config.sourceName || 'Generic Funding Source'
    this.sourceType = config.sourceType || 'api'
    this.apiEndpoint = config.apiEndpoint || 'https://api.example.com'
    this.apiKey = config.apiKey || 'test-api-key'
    
    // Behavior configuration
    this.pageSize = config.pageSize || 25
    this.totalOpportunities = config.totalOpportunities || 100
    this.responseDelay = config.responseDelay || 0
    this.errorRate = config.errorRate || 0 // Percentage chance of error
    
    // State tracking
    this.callCount = 0
    this.lastCalledWith = null
  }

  // Generate mock opportunities with configurable attributes
  generateOpportunities(count, startIndex = 0) {
    const opportunities = []
    const categories = ['Research', 'Technology', 'Environment', 'Health', 'Education', 'Infrastructure']
    const statuses = ['Posted', 'Forecasted', 'Closed', 'Archived']
    const agencies = ['Federal Agency A', 'State Department B', 'Foundation C', 'NGO D']
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i
      const category = categories[index % categories.length]
      const status = statuses[Math.floor(index / 25) % statuses.length]
      const agency = agencies[index % agencies.length]
      
      opportunities.push({
        // Generic ID format that doesn't assume any specific API
        id: `OPP-${this.sourceType.toUpperCase()}-${String(index + 1).padStart(6, '0')}`,
        externalId: `${this.sourceType}-${index + 1}`,
        
        // Standard opportunity fields
        title: `${category} Funding Opportunity ${index + 1}`,
        description: `This is a funding opportunity for ${category.toLowerCase()} projects. ` +
                    `It supports innovative approaches and sustainable solutions.`,
        
        // Agency/Organization info
        agencyCode: `${this.sourceType.toUpperCase()}-${agency.substring(0, 3).toUpperCase()}`,
        agencyName: agency,
        
        // Funding details
        fundingType: index % 3 === 0 ? 'Grant' : index % 3 === 1 ? 'Cooperative Agreement' : 'Contract',
        totalFunding: 1000000 * (index % 10 + 1),
        minimumAward: 10000 * (index % 5 + 1),
        maximumAward: 100000 * (index % 10 + 1),
        expectedAwards: 5 + (index % 20),
        costSharing: index % 2 === 0,
        
        // Dates (relative to current date for realistic testing)
        postedDate: this.getRelativeDate(-90 - index),
        openDate: this.getRelativeDate(-60 - index),
        closeDate: this.getRelativeDate(30 + index * 2),
        archiveDate: this.getRelativeDate(90 + index * 2),
        lastUpdated: this.getRelativeDate(-index % 30),
        
        // Status and metadata
        status: status.toLowerCase(),
        category: category.toLowerCase(),
        tags: [category.toLowerCase(), this.sourceType, status.toLowerCase()],
        
        // Eligibility (generic, not assuming specific codes)
        eligibility: {
          type: index % 4 === 0 ? 'nonprofit' : 
                index % 4 === 1 ? 'forprofit' : 
                index % 4 === 2 ? 'government' : 'academic',
          description: `Eligible applicants include ${index % 2 === 0 ? 'domestic' : 'international'} organizations`
        },
        
        // Additional metadata
        sourceUrl: `${this.apiEndpoint}/opportunities/${index + 1}`,
        attachmentCount: index % 3,
        version: '1.0',
        
        // Custom fields that might vary by source
        customFields: {
          priority: index % 5 + 1,
          region: index % 2 === 0 ? 'national' : 'regional',
          matchScore: 50 + (index % 50)
        }
      })
    }
    
    return opportunities
  }

  // Helper to generate relative dates
  getRelativeDate(daysOffset) {
    const date = new Date()
    date.setDate(date.getDate() + daysOffset)
    return date.toISOString().split('T')[0]
  }

  // Simulate random API errors based on errorRate
  shouldSimulateError() {
    return Math.random() * 100 < this.errorRate
  }

  // Mock search/list opportunities with pagination
  async searchOpportunities(params = {}) {
    this.callCount++
    this.lastCalledWith = params
    
    // Simulate network delay
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay))
    }
    
    // Simulate random errors
    if (this.shouldSimulateError()) {
      throw new Error(`API Error: Failed to fetch from ${this.sourceName}`)
    }
    
    // Extract pagination params
    const page = params.page || 1
    const pageSize = params.pageSize || this.pageSize
    const startIndex = (page - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, this.totalOpportunities)
    const count = endIndex - startIndex
    
    // Generate opportunities for this page
    const opportunities = this.generateOpportunities(count, startIndex)
    
    // Return paginated response
    return {
      success: true,
      data: opportunities,
      pagination: {
        page,
        pageSize,
        totalItems: this.totalOpportunities,
        totalPages: Math.ceil(this.totalOpportunities / pageSize),
        hasNext: endIndex < this.totalOpportunities,
        hasPrevious: page > 1
      },
      metadata: {
        source: this.sourceName,
        requestId: `req-${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    }
  }

  // Mock get single opportunity by ID
  async getOpportunityById(oppId) {
    this.callCount++
    this.lastCalledWith = { oppId }
    
    // Simulate network delay
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay))
    }
    
    // Simulate random errors
    if (this.shouldSimulateError()) {
      throw new Error(`API Error: Failed to fetch opportunity ${oppId}`)
    }
    
    if (!oppId) {
      throw new Error('Opportunity ID is required')
    }
    
    // Extract index from ID if possible, otherwise use random
    const indexMatch = oppId.match(/\d+/)
    const index = indexMatch ? parseInt(indexMatch[0], 10) - 1 : 0
    
    // Generate a single opportunity
    const opportunity = this.generateOpportunities(1, index)[0]
    opportunity.id = oppId // Use the requested ID
    
    // Add additional details for single fetch
    opportunity.fullDescription = opportunity.description + '\n\n' +
      'This opportunity includes comprehensive support for project implementation, ' +
      'monitoring, and evaluation. Applicants should demonstrate capability and experience.'
    
    opportunity.requirements = [
      'Demonstrated expertise in the field',
      'Strong project management capabilities',
      'Financial management systems in place',
      'Ability to measure and report outcomes'
    ]
    
    opportunity.documents = [
      { name: 'Application Guidelines', url: `${this.apiEndpoint}/docs/guidelines.pdf` },
      { name: 'Budget Template', url: `${this.apiEndpoint}/docs/budget.xlsx` }
    ]
    
    return {
      success: true,
      data: opportunity,
      metadata: {
        source: this.sourceName,
        requestId: `req-${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    }
  }

  // Mock batch fetch opportunities
  async batchFetchOpportunities(oppIds) {
    if (!Array.isArray(oppIds)) {
      throw new Error('Opportunity IDs must be an array')
    }
    
    // Fetch each opportunity
    const promises = oppIds.map(id => this.getOpportunityById(id))
    const results = await Promise.allSettled(promises)
    
    // Separate successful and failed fetches
    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value.data)
    
    const failed = results
      .filter(r => r.status === 'rejected')
      .map((r, i) => ({ id: oppIds[i], error: r.reason.message }))
    
    return {
      success: true,
      data: successful,
      errors: failed,
      metadata: {
        source: this.sourceName,
        requested: oppIds.length,
        successful: successful.length,
        failed: failed.length
      }
    }
  }

  // Mock API health check
  async healthCheck() {
    return {
      status: 'healthy',
      source: this.sourceName,
      endpoint: this.apiEndpoint,
      timestamp: new Date().toISOString(),
      callCount: this.callCount
    }
  }

  // Reset mock state
  reset() {
    this.callCount = 0
    this.lastCalledWith = null
  }

  // Configure mock behavior
  configure(config) {
    Object.assign(this, config)
  }
}

// Factory function to create configured clients
const createFundingSourceClient = jest.fn((config = {}) => {
  return new GenericFundingSourceClient(config)
})

// Preset configurations for common test scenarios
const presetConfigurations = {
  // Standard API with moderate data
  standard: {
    sourceName: 'Standard Funding API',
    totalOpportunities: 100,
    pageSize: 25
  },
  
  // Large dataset for pagination testing
  largeDateset: {
    sourceName: 'Large Dataset API',
    totalOpportunities: 1000,
    pageSize: 50
  },
  
  // Slow API for timeout testing
  slowApi: {
    sourceName: 'Slow API',
    responseDelay: 2000,
    totalOpportunities: 50
  },
  
  // Unreliable API for error handling
  unreliable: {
    sourceName: 'Unreliable API',
    errorRate: 30, // 30% chance of error
    totalOpportunities: 50
  },
  
  // Empty results for edge cases
  empty: {
    sourceName: 'Empty API',
    totalOpportunities: 0
  },
  
  // Single page of results
  singlePage: {
    sourceName: 'Single Page API',
    totalOpportunities: 10,
    pageSize: 20
  }
}

// Helper to create preconfigured clients
const createPresetClient = (preset) => {
  const config = presetConfigurations[preset] || presetConfigurations.standard
  return new GenericFundingSourceClient(config)
}

// Export everything
module.exports = {
  GenericFundingSourceClient,
  createFundingSourceClient,
  presetConfigurations,
  createPresetClient
}