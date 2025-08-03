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
   * Create scenario for testing all three pipeline paths simultaneously
   */
  createMultiPathScenario(config = {}) {
    const {
      newCount = 2,
      updateCount = 2,
      skipCount = 2,
      staleCount = 1
    } = config;

    const scenario = {
      name: 'Multi-Path Pipeline Validation',
      description: 'Tests NEW, UPDATE, SKIP, and STALE paths in single run',
      fundingSourceId: this.fundingSourceId,
      
      // Test data organized by expected pipeline path
      opportunities: {
        // NEW opportunities - should go through full pipeline
        new: this.generateNewOpportunities(newCount),
        
        // UPDATE opportunities - should use DirectUpdate optimization
        update: this.generateUpdateOpportunities(updateCount),
        
        // SKIP opportunities - should be skipped entirely
        skip: this.generateSkipOpportunities(skipCount),
        
        // STALE opportunities - should be re-analyzed due to age
        stale: this.generateStaleOpportunities(staleCount)
      },
      
      // Pre-existing database state (for duplicates)
      databaseState: {
        existingOpportunities: []
      },
      
      // Expected results for validation
      expectedResults: {
        pipelinePaths: {
          NEW: newCount,
          UPDATE: updateCount,
          SKIP: skipCount,
          STALE: staleCount
        },
        totalOpportunities: newCount + updateCount + skipCount + staleCount,
        optimizationExpected: updateCount + skipCount > 0,
        estimatedTokenSavings: Math.round(((updateCount + skipCount) / (newCount + updateCount + skipCount + staleCount)) * 100)
      },
      
      // Metrics to validate (Task 36 requirements)
      requiredMetrics: [
        'pipeline_runs',
        'pipeline_stages', 
        'opportunity_processing_paths',
        'duplicate_detection_sessions'
      ]
    };

    // Generate corresponding database records for duplicates
    scenario.databaseState.existingOpportunities = [
      ...scenario.opportunities.update.map(opp => this.createDatabaseRecord(opp, 'update')),
      ...scenario.opportunities.skip.map(opp => this.createDatabaseRecord(opp, 'skip')),
      ...scenario.opportunities.stale.map(opp => this.createDatabaseRecord(opp, 'stale'))
    ];

    return scenario;
  }

  /**
   * Create metrics validation scenario for Task 36 requirements
   */
  createMetricsValidationScenario() {
    const scenario = {
      name: 'Metrics Validation Scenario',
      description: 'Validates Task 36 clean metrics system implementation',
      fundingSourceId: this.fundingSourceId,
      
      opportunities: {
        // Minimal set to test each path once
        new: this.generateNewOpportunities(1, 'METRICS-NEW'),
        update: this.generateUpdateOpportunities(1, 'METRICS-UPD'),
        skip: this.generateSkipOpportunities(1, 'METRICS-SKIP')
      },
      
      // Define all metrics that must be captured
      requiredMetrics: {
        pipeline_runs: {
          fields: ['id', 'api_source_id', 'status', 'total_execution_time_ms', 'success_rate_percentage', 'created_at'],
          validations: [
            'status should be completed',
            'total_execution_time_ms should be positive',
            'success_rate_percentage should be 0-100'
          ]
        },
        pipeline_stages: {
          fields: ['run_id', 'stage_name', 'stage_order', 'status', 'execution_time_ms', 'stage_results'],
          validations: [
            'all stages should have execution_time_ms',
            'stage_order should be sequential',
            'status should be completed or skipped'
          ]
        },
        opportunity_processing_paths: {
          fields: ['run_id', 'api_opportunity_id', 'path_type', 'final_outcome', 'processing_time_ms'],
          validations: [
            'path_type should be NEW, UPDATE, or SKIP',
            'final_outcome should match path_type',
            'processing_time_ms should be positive'
          ]
        },
        duplicate_detection_sessions: {
          fields: ['run_id', 'total_opportunities_checked', 'new_opportunities', 'duplicates_to_update', 'duplicates_to_skip', 'llm_processing_bypassed'],
          validations: [
            'totals should sum correctly',
            'llm_processing_bypassed should be >= 0',
            'all counts should be non-negative'
          ]
        }
      },
      
      // Performance benchmarks from Task 36
      performanceBenchmarks: {
        tokenSavingsTarget: 60, // 60-80% savings expected
        timeImprovementTarget: 60, // 60-80% time improvement
        efficiencyScoreTarget: 75 // Overall efficiency target
      }
    };

    // Generate database state
    scenario.databaseState = {
      existingOpportunities: [
        ...scenario.opportunities.update.map(opp => this.createDatabaseRecord(opp, 'update')),
        ...scenario.opportunities.skip.map(opp => this.createDatabaseRecord(opp, 'skip'))
      ]
    };

    return scenario;
  }

  /**
   * Create edge case testing scenario
   */
  createEdgeCaseScenario() {
    const scenario = {
      name: 'Edge Case Testing',
      description: 'Tests pipeline behavior with edge cases and error conditions',
      fundingSourceId: this.fundingSourceId,
      
      opportunities: {
        // Empty extraction result
        empty: [],
        
        // Invalid data
        invalid: [
          {
            api_opportunity_id: 'EDGE-INVALID-001',
            // Missing required fields
            description: 'Invalid opportunity missing title and amounts'
          },
          {
            api_opportunity_id: 'EDGE-INVALID-002',
            title: 'Invalid Data Types',
            minimum_award: 'not-a-number',
            maximum_award: null,
            close_date: 'invalid-date'
          }
        ],
        
        // Boundary conditions
        boundary: [
          {
            api_opportunity_id: 'EDGE-BOUNDARY-001',
            title: 'Zero Amount Opportunity',
            minimum_award: 0,
            maximum_award: 0,
            total_funding_available: 0
          },
          {
            api_opportunity_id: 'EDGE-BOUNDARY-002',
            title: 'Maximum Amount Opportunity',
            minimum_award: 999999999,
            maximum_award: 999999999,
            total_funding_available: 999999999
          }
        ]
      },
      
      expectedBehaviors: {
        empty: 'Should complete successfully with no processing',
        invalid: 'Should handle gracefully with error logging',
        boundary: 'Should process normally with edge values'
      }
    };

    return scenario;
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
  createPerformanceScenario(config = {}) {
    const {
      totalOpportunities = 100,
      duplicateRatio = 0.7, // 70% duplicates
      updateRatio = 0.3 // 30% of duplicates are updates
    } = config;

    const duplicateCount = Math.floor(totalOpportunities * duplicateRatio);
    const newCount = totalOpportunities - duplicateCount;
    const updateCount = Math.floor(duplicateCount * updateRatio);
    const skipCount = duplicateCount - updateCount;

    const scenario = {
      name: 'Performance Testing',
      description: `Tests pipeline performance with ${totalOpportunities} opportunities (${newCount} new, ${updateCount} updates, ${skipCount} skips)`,
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

    // Generate update opportunities
    scenario.opportunities.update = [];
    scenario.opportunities.baseUpdate = [];
    
    for (let i = 0; i < updateCount; i++) {
      const base = this.opportunityFactory.createNewOpportunity({
        api_opportunity_id: `PERF-UPD-${String(i + 1).padStart(4, '0')}`
      });
      
      scenario.opportunities.baseUpdate.push(base);
      scenario.opportunities.update.push(
        this.opportunityFactory.createUpdateOpportunity(base)
      );
    }

    // Generate skip opportunities
    scenario.opportunities.skip = [];
    scenario.opportunities.baseSkip = [];
    
    for (let i = 0; i < skipCount; i++) {
      const base = this.opportunityFactory.createNewOpportunity({
        api_opportunity_id: `PERF-SKIP-${String(i + 1).padStart(4, '0')}`
      });
      
      scenario.opportunities.baseSkip.push(base);
      scenario.opportunities.skip.push(
        this.opportunityFactory.createSkipOpportunity(base)
      );
    }

    scenario.performanceTargets = {
      maxExecutionTimeMs: 300000, // 5 minutes
      minTokenSavingsPercent: Math.floor(duplicateRatio * 100 * 0.8), // 80% of theoretical max
      maxTokensPerOpportunity: 2000,
      maxMemoryUsageMB: 512
    };

    scenario.expectedResults = {
      newOpportunities: newCount,
      updateOpportunities: updateCount,
      skipOpportunities: skipCount,
      totalOpportunities,
      estimatedTokenSavings: Math.floor(duplicateRatio * 100),
      estimatedTimeImprovement: Math.floor(duplicateRatio * 60), // 60% time improvement
      duplicateDetectionAccuracy: 100 // Should be 100% for known test data
    };

    // Generate database state for duplicates
    scenario.databaseState = {
      existingOpportunities: [
        ...scenario.opportunities.baseUpdate,
        ...scenario.opportunities.baseSkip
      ]
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

  /**
   * Generate NEW opportunities
   */
  generateNewOpportunities(count, prefix = 'NEW') {
    const opportunities = [];
    for (let i = 0; i < count; i++) {
      opportunities.push(
        this.opportunityFactory.createNewOpportunity({
          api_opportunity_id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
          title: `${prefix} Opportunity ${i + 1} - ${this.generateRandomTitle()}`
        })
      );
    }
    return opportunities;
  }

  /**
   * Generate UPDATE opportunities (with corresponding base records)
   */
  generateUpdateOpportunities(count, prefix = 'UPDATE') {
    const opportunities = [];
    for (let i = 0; i < count; i++) {
      const baseOpportunity = this.opportunityFactory.createNewOpportunity({
        api_opportunity_id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
        title: `${prefix} Opportunity ${i + 1} - ${this.generateRandomTitle()}`
      });
      
      // Create updated version with changes
      const updatedOpportunity = this.opportunityFactory.createUpdateOpportunity(baseOpportunity, {
        // Add some additional changes to ensure detection
        description: baseOpportunity.description + ' [UPDATED CONTENT]',
        total_funding_available: baseOpportunity.total_funding_available * 1.5
      });
      
      opportunities.push(updatedOpportunity);
    }
    return opportunities;
  }

  /**
   * Generate SKIP opportunities (identical to existing records)
   */
  generateSkipOpportunities(count, prefix = 'SKIP') {
    const opportunities = [];
    for (let i = 0; i < count; i++) {
      const baseOpportunity = this.opportunityFactory.createNewOpportunity({
        api_opportunity_id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
        title: `${prefix} Opportunity ${i + 1} - ${this.generateRandomTitle()}`
      });
      
      // Create skip version (no changes)
      const skipOpportunity = this.opportunityFactory.createSkipOpportunity(baseOpportunity);
      opportunities.push(skipOpportunity);
    }
    return opportunities;
  }

  /**
   * Generate STALE opportunities (old records needing re-analysis)
   */
  generateStaleOpportunities(count, prefix = 'STALE') {
    const opportunities = [];
    for (let i = 0; i < count; i++) {
      const baseOpportunity = this.opportunityFactory.createNewOpportunity({
        api_opportunity_id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
        title: `${prefix} Opportunity ${i + 1} - ${this.generateRandomTitle()}`
      });
      
      const staleOpportunity = this.opportunityFactory.createStaleOpportunity(baseOpportunity);
      opportunities.push(staleOpportunity);
    }
    return opportunities;
  }

  /**
   * Create database record for existing opportunities
   */
  createDatabaseRecord(opportunity, type) {
    const record = { ...opportunity };
    
    // Modify based on type
    switch (type) {
      case 'update':
        // Base record before updates
        record.minimum_award = Math.round(opportunity.minimum_award / 1.1);
        record.maximum_award = Math.round(opportunity.maximum_award / 1.2);
        record.close_date = new Date(new Date(opportunity.close_date).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        record.description = opportunity.description?.replace(' [UPDATED CONTENT]', '') || record.description;
        record.total_funding_available = Math.round(opportunity.total_funding_available / 1.5);
        break;
        
      case 'skip':
        // Identical record
        break;
        
      case 'stale':
        // Old record (91+ days old)
        record.updated_at = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
        break;
    }
    
    // Generate proper UUID for database fields
    record.id = this.generateUUID();
    record.created_at = record.created_at || new Date().toISOString();
    record.updated_at = record.updated_at || new Date().toISOString();
    
    return record;
  }

  /**
   * Generate a valid UUID v4
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Generate random opportunity titles
   */
  generateRandomTitle() {
    const subjects = ['Clean Energy', 'Infrastructure', 'Education', 'Healthcare', 'Research', 'Community Development'];
    const types = ['Grant Program', 'Initiative', 'Fund', 'Research Grant', 'Development Fund'];
    const descriptors = ['Advanced', 'Innovative', 'Sustainable', 'Comprehensive', 'Strategic'];
    
    return `${this.randomChoice(descriptors)} ${this.randomChoice(subjects)} ${this.randomChoice(types)}`;
  }

  /**
   * Helper: Random choice from array
   */
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Generate validation queries for metrics testing
   */
  generateMetricsValidationQueries() {
    return {
      // Basic existence checks
      basicChecks: [
        'SELECT COUNT(*) as count FROM pipeline_runs WHERE api_source_id = $1',
        'SELECT COUNT(*) as count FROM pipeline_stages WHERE run_id = $1',
        'SELECT COUNT(*) as count FROM opportunity_processing_paths WHERE run_id = $1',
        'SELECT COUNT(*) as count FROM duplicate_detection_sessions WHERE run_id = $1'
      ],
      
      // Data integrity checks
      integrityChecks: [
        'SELECT * FROM pipeline_runs WHERE status NOT IN (\'started\', \'processing\', \'completed\', \'failed\', \'cancelled\')',
        'SELECT * FROM pipeline_stages WHERE execution_time_ms < 0',
        'SELECT * FROM opportunity_processing_paths WHERE path_type NOT IN (\'NEW\', \'UPDATE\', \'SKIP\')',
        'SELECT * FROM duplicate_detection_sessions WHERE total_opportunities_checked != (new_opportunities + duplicates_to_update + duplicates_to_skip)'
      ],
      
      // Performance validation checks
      performanceChecks: [
        'SELECT success_rate_percentage FROM pipeline_runs WHERE success_rate_percentage < 50',
        'SELECT total_execution_time_ms FROM pipeline_runs WHERE total_execution_time_ms > 300000'
      ],
      
      // Analytics queries for dashboard validation
      analyticsQueries: [
        'SELECT AVG(success_rate_percentage) as avg_success_rate FROM pipeline_runs',
        'SELECT path_type, COUNT(*) as count FROM opportunity_processing_paths GROUP BY path_type',
        'SELECT stage_name, AVG(execution_time_ms) as avg_time FROM pipeline_stages GROUP BY stage_name',
        'SELECT AVG(detection_time_ms) as avg_detection_time FROM duplicate_detection_sessions'
      ]
    };
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