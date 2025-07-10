/**
 * Test Data Factories for Integration Testing
 * 
 * Provides realistic test data generation for all three pipeline paths:
 * - NEW opportunities (not in database)
 * - UPDATE opportunities (duplicates with changes) 
 * - SKIP opportunities (duplicates without changes)
 * 
 * Also provides mock API responses and service mocking utilities.
 */

// Simple data generators to avoid external dependencies
const DataGenerator = {
  randomString(length = 8) {
    return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
  },
  
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  randomFloat(min, max, decimals = 1) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
  },
  
  randomBoolean() {
    return Math.random() < 0.5;
  },
  
  randomDate(daysFromNow = 0, rangeDays = 30) {
    const baseDate = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
    const randomOffset = Math.random() * rangeDays * 24 * 60 * 60 * 1000;
    return new Date(baseDate.getTime() + randomOffset);
  },
  
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  },
  
  randomCompany() {
    const prefixes = ['Advanced', 'Global', 'National', 'Regional', 'Metropolitan'];
    const middles = ['Energy', 'Research', 'Development', 'Innovation', 'Technology'];
    const suffixes = ['Institute', 'Foundation', 'Corporation', 'Agency', 'Center'];
    
    return `${this.randomChoice(prefixes)} ${this.randomChoice(middles)} ${this.randomChoice(suffixes)}`;
  },
  
  randomWords(count = 4) {
    const words = [
      'sustainable', 'innovative', 'collaborative', 'comprehensive', 'strategic',
      'research', 'development', 'community', 'infrastructure', 'technology',
      'education', 'healthcare', 'environment', 'economic', 'social',
      'program', 'initiative', 'project', 'grant', 'fund'
    ];
    
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(this.randomChoice(words));
    }
    return result.join(' ');
  }
};

/**
 * OpportunityFactory - Generates realistic test opportunities
 */
export class OpportunityFactory {
  constructor(fundingSourceId = 'd8410c4e-35f0-4279-909a-93ea141c7e57') {
    this.fundingSourceId = fundingSourceId;
  }

  /**
   * Generate a new opportunity for testing NEW pipeline path
   */
  createNewOpportunity(overrides = {}) {
    const baseOpportunity = {
      api_opportunity_id: `NEW-${DataGenerator.randomString(8)}`,
      title: `${DataGenerator.randomCompany()} - ${DataGenerator.randomWords(4)} Grant Program`,
      description: this.generateDescription(),
      minimum_award: DataGenerator.randomInt(5000, 50000),
      maximum_award: DataGenerator.randomInt(50000, 500000),
      total_funding_available: DataGenerator.randomInt(100000, 10000000),
      cost_share_required: DataGenerator.randomBoolean(),
      cost_share_percentage: DataGenerator.randomFloat(0, 50, 1),
      posted_date: DataGenerator.randomDate(-30, 30).toISOString(),
      open_date: DataGenerator.randomDate(7, 7).toISOString(),
      close_date: DataGenerator.randomDate(30, 60).toISOString(),
      agency_name: DataGenerator.randomCompany(),
      is_national: DataGenerator.randomBoolean(),
      funding_source_id: this.fundingSourceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return { ...baseOpportunity, ...overrides };
  }

  /**
   * Generate a duplicate opportunity for testing UPDATE pipeline path
   * This creates an opportunity that exists in DB but with modified critical fields
   */
  createUpdateOpportunity(existingOpportunity, overrides = {}) {
    const updatedOpportunity = { ...existingOpportunity };
    
    // Modify critical fields to trigger UPDATE path
    updatedOpportunity.minimum_award = existingOpportunity.minimum_award * 1.1; // 10% increase
    updatedOpportunity.maximum_award = existingOpportunity.maximum_award * 1.2; // 20% increase
    updatedOpportunity.close_date = new Date(
      new Date(existingOpportunity.close_date).getTime() + 7 * 24 * 60 * 60 * 1000
    ).toISOString(); // Extend by 7 days
    
    // Add API timestamp to indicate freshness
    updatedOpportunity.api_updated_at = new Date().toISOString();
    
    return { ...updatedOpportunity, ...overrides };
  }

  /**
   * Generate a skip opportunity for testing SKIP pipeline path
   * This creates an opportunity that's identical to what's in the DB
   */
  createSkipOpportunity(existingOpportunity, overrides = {}) {
    const skipOpportunity = { ...existingOpportunity };
    
    // No changes to critical fields - should be skipped
    // Remove API timestamp to test stale review logic (under 90 days)
    delete skipOpportunity.api_updated_at;
    
    return { ...skipOpportunity, ...overrides };
  }

  /**
   * Generate opportunities for stale review testing (90+ days old)
   */
  createStaleOpportunity(existingOpportunity, overrides = {}) {
    const staleOpportunity = { ...existingOpportunity };
    
    // Make it stale (older than 90 days)
    staleOpportunity.updated_at = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    
    // No API timestamp to trigger stale review
    delete staleOpportunity.api_updated_at;
    
    return { ...staleOpportunity, ...overrides };
  }

  /**
   * Generate a realistic opportunity description
   */
  generateDescription() {
    const purposes = [
      'research and development',
      'infrastructure improvement',
      'educational initiatives',
      'community development',
      'environmental conservation',
      'technology innovation',
      'healthcare advancement',
      'economic development'
    ];
    
    const requirements = [
      'must demonstrate community impact',
      'requires matching funds',
      'must serve underrepresented populations',
      'requires partnership with local organizations',
      'must show measurable outcomes',
      'requires environmental compliance',
      'must include sustainability plan'
    ];
    
    const applicantTypes = ['nonprofits', 'universities', 'government agencies', 'tribal organizations'];
    
    const purpose = DataGenerator.randomChoice(purposes);
    const requirement = DataGenerator.randomChoice(requirements);
    const firstApplicant = DataGenerator.randomChoice(applicantTypes);
    const secondApplicant = DataGenerator.randomChoice(applicantTypes.filter(t => t !== firstApplicant));
    const applicants = [firstApplicant, secondApplicant].filter(Boolean);
    
    return `This grant program supports ${purpose} initiatives that ${requirement}. ` +
           `Eligible applicants include ${applicants.join(' and ')}. ` +
           `Projects should demonstrate ${DataGenerator.randomWords(3)} and provide ${DataGenerator.randomWords(4)} to the community.`;
  }

  /**
   * Create a batch of opportunities for comprehensive testing
   */
  createTestBatch(count = 10) {
    const opportunities = [];
    
    for (let i = 0; i < count; i++) {
      opportunities.push(this.createNewOpportunity({
        api_opportunity_id: `BATCH-${String(i + 1).padStart(3, '0')}`
      }));
    }
    
    return opportunities;
  }
}

/**
 * APIResponseFactory - Generates mock API responses
 */
export class APIResponseFactory {
  /**
   * Create mock API response for DataExtractionAgent testing
   */
  static createMockAPIResponse(opportunities, metadata = {}) {
    return {
      data: opportunities,
      metadata: {
        totalCount: opportunities.length,
        currentPage: metadata.currentPage || 1,
        totalPages: metadata.totalPages || 1,
        hasMore: metadata.hasMore || false,
        lastUpdated: new Date().toISOString(),
        source: metadata.source || 'mock-api',
        apiVersion: metadata.apiVersion || '2.0',
        ...metadata
      },
      status: 'success',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create mock API response with pagination
   */
  static createPaginatedResponse(allOpportunities, page = 1, pageSize = 10) {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageOpportunities = allOpportunities.slice(startIndex, endIndex);
    const totalPages = Math.ceil(allOpportunities.length / pageSize);
    
    return this.createMockAPIResponse(pageOpportunities, {
      currentPage: page,
      totalPages,
      pageSize,
      totalCount: allOpportunities.length,
      hasMore: page < totalPages
    });
  }

  /**
   * Create mock error response
   */
  static createErrorResponse(errorType = 'RATE_LIMIT', message = 'API rate limit exceeded') {
    return {
      error: {
        type: errorType,
        message,
        code: errorType === 'RATE_LIMIT' ? 429 : 500,
        retryAfter: errorType === 'RATE_LIMIT' ? 60 : null
      },
      status: 'error',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * MockAPIClient - Simulates API behavior for testing
 */
export class MockAPIClient {
  constructor(opportunities = []) {
    this.opportunities = opportunities;
    this.requestCount = 0;
    this.failureRate = 0; // 0-1, percentage of requests that should fail
    this.responseDelay = 0; // milliseconds to delay responses
  }

  /**
   * Set failure rate for testing error scenarios
   */
  setFailureRate(rate) {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Set response delay for testing timeout scenarios
   */
  setResponseDelay(delayMs) {
    this.responseDelay = delayMs;
  }

  /**
   * Simulate API call with optional failures and delays
   */
  async fetchOpportunities(params = {}) {
    this.requestCount++;
    
    // Simulate delay
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }
    
    // Simulate random failures
    if (Math.random() < this.failureRate) {
      throw new Error('Mock API failure');
    }
    
    // Simulate pagination
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    
    return APIResponseFactory.createPaginatedResponse(
      this.opportunities, 
      page, 
      pageSize
    );
  }

  /**
   * Get mock API statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      failureRate: this.failureRate,
      responseDelay: this.responseDelay,
      totalOpportunities: this.opportunities.length
    };
  }

  /**
   * Reset mock API state
   */
  reset() {
    this.requestCount = 0;
    this.failureRate = 0;
    this.responseDelay = 0;
  }
}

/**
 * TestScenarioFactory - Creates complete test scenarios
 */
export class TestScenarioFactory {
  constructor(fundingSourceId) {
    this.fundingSourceId = fundingSourceId;
    this.opportunityFactory = new OpportunityFactory(fundingSourceId);
  }

  /**
   * Create comprehensive test scenario with all three pipeline paths
   */
  createComprehensiveScenario() {
    const scenario = {
      name: 'Comprehensive Pipeline Testing',
      description: 'Tests all three pipeline paths: NEW, UPDATE, and SKIP',
      fundingSourceId: this.fundingSourceId,
      opportunities: {},
      expectedResults: {}
    };

    // Create NEW opportunities
    scenario.opportunities.new = [
      this.opportunityFactory.createNewOpportunity({
        api_opportunity_id: 'TEST-NEW-001',
        title: 'New Clean Energy Research Grant'
      }),
      this.opportunityFactory.createNewOpportunity({
        api_opportunity_id: 'TEST-NEW-002', 
        title: 'New Infrastructure Development Program'
      })
    ];

    // Create UPDATE opportunities (these will be seeded in DB first)
    const baseUpdateOpportunity = this.opportunityFactory.createNewOpportunity({
      api_opportunity_id: 'TEST-UPDATE-001',
      title: 'Existing Education Initiative Grant'
    });
    
    scenario.opportunities.baseUpdate = baseUpdateOpportunity;
    scenario.opportunities.update = [
      this.opportunityFactory.createUpdateOpportunity(baseUpdateOpportunity)
    ];

    // Create SKIP opportunities (these will be seeded in DB first)
    const baseSkipOpportunity = this.opportunityFactory.createNewOpportunity({
      api_opportunity_id: 'TEST-SKIP-001',
      title: 'Existing Community Development Fund'
    });
    
    scenario.opportunities.baseSkip = baseSkipOpportunity;
    scenario.opportunities.skip = [
      this.opportunityFactory.createSkipOpportunity(baseSkipOpportunity)
    ];

    // Expected results
    scenario.expectedResults = {
      newOpportunities: 2,
      updateOpportunities: 1,
      skipOpportunities: 1,
      totalProcessed: 4,
      expectedPaths: {
        'TEST-NEW-001': 'NEW',
        'TEST-NEW-002': 'NEW',
        'TEST-UPDATE-001': 'UPDATE',
        'TEST-SKIP-001': 'SKIP'
      }
    };

    return scenario;
  }

  /**
   * Create performance testing scenario with large data sets
   */
  createPerformanceScenario(newCount = 50, duplicateCount = 100) {
    const scenario = {
      name: 'Performance Testing',
      description: `Tests pipeline performance with ${newCount} new and ${duplicateCount} duplicate opportunities`,
      fundingSourceId: this.fundingSourceId,
      opportunities: {},
      expectedResults: {}
    };

    // Generate large batch of new opportunities
    scenario.opportunities.new = [];
    for (let i = 0; i < newCount; i++) {
      scenario.opportunities.new.push(
        this.opportunityFactory.createNewOpportunity({
          api_opportunity_id: `PERF-NEW-${String(i + 1).padStart(4, '0')}`
        })
      );
    }

    // Generate duplicates for performance testing
    scenario.opportunities.duplicates = [];
    scenario.opportunities.baseDuplicates = [];
    
    for (let i = 0; i < duplicateCount; i++) {
      const base = this.opportunityFactory.createNewOpportunity({
        api_opportunity_id: `PERF-DUP-${String(i + 1).padStart(4, '0')}`
      });
      
      scenario.opportunities.baseDuplicates.push(base);
      
      // Mix of updates and skips
      if (i % 3 === 0) {
        // Update
        scenario.opportunities.duplicates.push(
          this.opportunityFactory.createUpdateOpportunity(base)
        );
      } else {
        // Skip
        scenario.opportunities.duplicates.push(
          this.opportunityFactory.createSkipOpportunity(base)
        );
      }
    }

    scenario.expectedResults = {
      newOpportunities: newCount,
      duplicateOpportunities: duplicateCount,
      totalProcessed: newCount + duplicateCount,
      expectedTokenSavings: Math.round((duplicateCount / (newCount + duplicateCount)) * 100)
    };

    return scenario;
  }

  /**
   * Create error handling test scenario
   */
  createErrorScenario() {
    const scenario = {
      name: 'Error Handling Testing',
      description: 'Tests pipeline behavior with various error conditions',
      fundingSourceId: this.fundingSourceId,
      opportunities: {},
      errorConditions: [
        'invalid_opportunity_data',
        'database_connection_failure',
        'anthropic_api_failure',
        'rate_limit_exceeded',
        'timeout_error'
      ]
    };

    // Create opportunities with various issues
    scenario.opportunities.invalid = [
      // Missing required fields
      {
        api_opportunity_id: 'ERROR-001',
        // Missing title
        description: 'Invalid opportunity missing title'
      },
      // Invalid data types
      {
        api_opportunity_id: 'ERROR-002',
        title: 'Invalid Amount Opportunity',
        minimum_award: 'not-a-number',
        maximum_award: 'also-not-a-number'
      }
    ];

    return scenario;
  }
}

/**
 * Export helper function to create factories with funding source
 */
export function createFactories(fundingSourceId) {
  return {
    opportunityFactory: new OpportunityFactory(fundingSourceId),
    scenarioFactory: new TestScenarioFactory(fundingSourceId),
    mockApiClient: new MockAPIClient(),
    apiResponseFactory: APIResponseFactory
  };
}

// Individual classes are exported inline above