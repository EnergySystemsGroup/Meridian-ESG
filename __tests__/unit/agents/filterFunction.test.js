import { describe, test, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals'
import { 
  filterOpportunities, 
  getDefaultFilterConfig, 
  createFilterConfig,
  validateFilterConfig
} from '../../../lib/agents-v2/core/filterFunction.js'

// Mock console methods to suppress warnings in tests
const originalWarn = console.warn
const originalError = console.error
const originalLog = console.log

beforeAll(() => {
  console.warn = jest.fn()
  console.error = jest.fn()
  console.log = jest.fn()
})

afterAll(() => {
  console.warn = originalWarn
  console.error = originalError
  console.log = originalLog
})

describe('Filter Function Unit Tests', () => {
  let mockOpportunities

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup test opportunities with various scoring combinations
    mockOpportunities = [
      {
        id: 'opp-1',
        title: 'High Relevance Opportunity',
        scoring: {
          clientRelevance: 80,
          projectRelevance: 75,
          fundingAttractiveness: 90,
          matchScore: 82
        }
      },
      {
        id: 'opp-2',
        title: 'Two Zero Categories',
        scoring: {
          clientRelevance: 0,
          projectRelevance: 0,
          fundingAttractiveness: 75,
          matchScore: 25
        }
      },
      {
        id: 'opp-3',
        title: 'Single Zero Category',
        scoring: {
          clientRelevance: 60,
          projectRelevance: 0,
          fundingAttractiveness: 70,
          matchScore: 43
        }
      },
      {
        id: 'opp-4',
        title: 'All Zero Categories',
        scoring: {
          clientRelevance: 0,
          projectRelevance: 0,
          fundingAttractiveness: 0,
          matchScore: 0
        }
      },
      {
        id: 'opp-5',
        title: 'Missing Scoring Data',
        scoring: null
      }
    ]
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Configuration Management', () => {
    test('should return default filter configuration', () => {
      const config = getDefaultFilterConfig()
      
      expect(config).toMatchObject({
        excludeIfTwoZeros: true,
        enableLogging: true,
        logLevel: 'info'
      })
    })

    test('should create custom filter configuration with overrides', () => {
      const customConfig = createFilterConfig({
        enableLogging: false,
        logLevel: 'debug',
        customProperty: 'test'
      })
      
      expect(customConfig).toMatchObject({
        excludeIfTwoZeros: true,
        enableLogging: false,
        logLevel: 'debug',
        customProperty: 'test'
      })
    })

    test('should validate valid filter configuration', () => {
      const config = {
        excludeIfTwoZeros: true,
        enableLogging: true,
        logLevel: 'info'
      }
      
      const validation = validateFilterConfig(config)
      
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    test('should detect invalid filter configuration', () => {
      const invalidConfig = {
        excludeIfTwoZeros: 'not-a-boolean',
        enableLogging: true
      }
      
      const validation = validateFilterConfig(invalidConfig)
      
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('excludeIfTwoZeros must be a boolean')
    })

    test('should detect null or non-object configuration', () => {
      const nullValidation = validateFilterConfig(null)
      expect(nullValidation.isValid).toBe(false)
      expect(nullValidation.errors).toContain('Config must be an object')
      
      const stringValidation = validateFilterConfig('invalid')
      expect(stringValidation.isValid).toBe(false)
      expect(stringValidation.errors).toContain('Config must be an object')
      
      const numberValidation = validateFilterConfig(123)
      expect(numberValidation.isValid).toBe(false)
      expect(numberValidation.errors).toContain('Config must be an object')
    })
  })

  describe('Eligibility Scoring Logic', () => {
    test('should include opportunities with all non-zero categories', async () => {
      const opportunities = [mockOpportunities[0]] // High relevance opportunity
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(1)
      expect(result.excludedOpportunities).toHaveLength(0)
      expect(result.filterMetrics.included).toBe(1)
      expect(result.filterMetrics.excluded).toBe(0)
    })

    test('should exclude opportunities with 2 zero categories', async () => {
      const opportunities = [mockOpportunities[1]] // Two zero categories
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(0)
      expect(result.excludedOpportunities).toHaveLength(1)
      expect(result.excludedOpportunities[0].exclusionReason).toContain('2 out of 3 core categories scored 0')
      expect(result.filterMetrics.exclusionReasons.twoZeroCategories).toBe(1)
    })

    test('should include opportunities with only 1 zero category', async () => {
      const opportunities = [mockOpportunities[2]] // Single zero category
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(1)
      expect(result.excludedOpportunities).toHaveLength(0)
      expect(result.filterMetrics.included).toBe(1)
    })

    test('should exclude opportunities with all zero categories', async () => {
      const opportunities = [mockOpportunities[3]] // All zero categories
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(0)
      expect(result.excludedOpportunities).toHaveLength(1)
      expect(result.excludedOpportunities[0].exclusionReason).toContain('3 out of 3 core categories scored 0')
      expect(result.filterMetrics.exclusionReasons.twoZeroCategories).toBe(1)
    })

    test('should exclude opportunities with missing scoring data', async () => {
      const opportunities = [mockOpportunities[4]] // Missing scoring
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(0)
      expect(result.excludedOpportunities).toHaveLength(1)
      expect(result.excludedOpportunities[0].exclusionReason).toBe('Missing scoring data')
      expect(result.filterMetrics.exclusionReasons.missingScoring).toBe(1)
    })
  })

  describe('Multi-Criteria Filtering', () => {
    test('should handle mixed batch of opportunities', async () => {
      const result = await filterOpportunities(mockOpportunities)
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(2) // opp-1 and opp-3
      expect(result.excludedOpportunities).toHaveLength(3) // opp-2, opp-4, opp-5
      expect(result.filterMetrics.totalAnalyzed).toBe(5)
      expect(result.filterMetrics.included).toBe(2)
      expect(result.filterMetrics.excluded).toBe(3)
    })

    test('should preserve opportunity data when including', async () => {
      const opportunities = [mockOpportunities[0]]
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.includedOpportunities[0]).toEqual(mockOpportunities[0])
      expect(result.includedOpportunities[0].id).toBe('opp-1')
      expect(result.includedOpportunities[0].title).toBe('High Relevance Opportunity')
      expect(result.includedOpportunities[0].scoring).toEqual(mockOpportunities[0].scoring)
    })

    test('should add exclusion reason to excluded opportunities', async () => {
      const opportunities = [mockOpportunities[1]]
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.excludedOpportunities[0]).toHaveProperty('exclusionReason')
      expect(result.excludedOpportunities[0].id).toBe('opp-2')
      expect(result.excludedOpportunities[0].title).toBe('Two Zero Categories')
    })
  })

  describe('Pass/Fail Rate Calculation', () => {
    test('should calculate correct inclusion rate', async () => {
      const result = await filterOpportunities(mockOpportunities)
      
      const inclusionRate = (result.filterMetrics.included / result.filterMetrics.totalAnalyzed) * 100
      
      expect(inclusionRate).toBe(40) // 2 out of 5 = 40%
    })

    test('should handle 100% inclusion rate', async () => {
      const opportunities = [
        {
          id: 'opp-100-1',
          scoring: { clientRelevance: 50, projectRelevance: 60, fundingAttractiveness: 70 }
        },
        {
          id: 'opp-100-2',
          scoring: { clientRelevance: 80, projectRelevance: 90, fundingAttractiveness: 85 }
        }
      ]
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.filterMetrics.included).toBe(2)
      expect(result.filterMetrics.excluded).toBe(0)
      expect(result.filterMetrics.totalAnalyzed).toBe(2)
    })

    test('should handle 0% inclusion rate', async () => {
      const opportunities = [
        {
          id: 'opp-0-1',
          scoring: { clientRelevance: 0, projectRelevance: 0, fundingAttractiveness: 50 }
        },
        {
          id: 'opp-0-2',
          scoring: null
        }
      ]
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.filterMetrics.included).toBe(0)
      expect(result.filterMetrics.excluded).toBe(2)
      expect(result.filterMetrics.totalAnalyzed).toBe(2)
    })
  })

  describe('Edge Case Handling', () => {
    test('should handle empty opportunity array', async () => {
      const result = await filterOpportunities([])
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(0)
      expect(result.excludedOpportunities).toHaveLength(0)
      expect(result.filterMetrics.totalAnalyzed).toBe(0)
    })

    test('should handle opportunities with undefined scoring fields', async () => {
      const opportunities = [
        {
          id: 'opp-undefined',
          title: 'Undefined Fields',
          scoring: {
            clientRelevance: undefined,
            projectRelevance: 50,
            fundingAttractiveness: undefined
          }
        }
      ]
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.success).toBe(true)
      expect(result.excludedOpportunities).toHaveLength(1)
      expect(result.excludedOpportunities[0].exclusionReason).toContain('2 out of 3 core categories scored 0')
    })

    test('should handle opportunities with null scoring fields', async () => {
      const opportunities = [
        {
          id: 'opp-null',
          title: 'Null Fields',
          scoring: {
            clientRelevance: null,
            projectRelevance: 60,
            fundingAttractiveness: 70
          }
        }
      ]
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(1)
    })

    test('should handle opportunities with missing core category fields', async () => {
      const opportunities = [
        {
          id: 'opp-missing',
          title: 'Missing Fields',
          scoring: {
            // Missing clientRelevance
            projectRelevance: 60,
            // Missing fundingAttractiveness
            matchScore: 30
          }
        }
      ]
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.success).toBe(true)
      expect(result.excludedOpportunities).toHaveLength(1)
      expect(result.filterMetrics.exclusionReasons.twoZeroCategories).toBe(1)
    })
  })

  describe('Filter Threshold Configuration', () => {
    test('should respect custom configuration settings', async () => {
      const config = createFilterConfig({
        enableLogging: false
      })
      
      const result = await filterOpportunities(mockOpportunities, config)
      
      expect(result.success).toBe(true)
      expect(result.config.enableLogging).toBe(false)
      expect(result.config.excludeIfTwoZeros).toBe(true)
    })

    test('should use default config when none provided', async () => {
      const result = await filterOpportunities(mockOpportunities)
      
      expect(result.config).toMatchObject({
        excludeIfTwoZeros: true,
        enableLogging: true,
        logLevel: 'info'
      })
    })
  })

  describe('Batch Filtering Performance', () => {
    test('should handle large batch of opportunities', async () => {
      const largeBatch = []
      
      // Create 1000 opportunities with various scoring patterns
      for (let i = 0; i < 1000; i++) {
        const pattern = i % 4
        let scoring
        
        switch (pattern) {
          case 0: // All good scores
            scoring = { clientRelevance: 70, projectRelevance: 80, fundingAttractiveness: 75 }
            break
          case 1: // One zero
            scoring = { clientRelevance: 0, projectRelevance: 60, fundingAttractiveness: 70 }
            break
          case 2: // Two zeros
            scoring = { clientRelevance: 0, projectRelevance: 0, fundingAttractiveness: 50 }
            break
          case 3: // Missing scoring
            scoring = null
            break
        }
        
        largeBatch.push({
          id: `opp-batch-${i}`,
          title: `Batch Opportunity ${i}`,
          scoring
        })
      }
      
      const startTime = Date.now()
      const result = await filterOpportunities(largeBatch)
      const processingTime = Date.now() - startTime
      
      expect(result.success).toBe(true)
      expect(result.filterMetrics.totalAnalyzed).toBe(1000)
      expect(result.includedOpportunities.length + result.excludedOpportunities.length).toBe(1000)
      expect(processingTime).toBeLessThan(1000) // Should process 1000 items in under 1 second
    })

    test('should maintain data integrity in batch processing', async () => {
      const batch = []
      
      for (let i = 0; i < 100; i++) {
        batch.push({
          id: `integrity-${i}`,
          title: `Integrity Test ${i}`,
          scoring: {
            clientRelevance: i % 100,
            projectRelevance: (i * 2) % 100,
            fundingAttractiveness: (i * 3) % 100
          },
          customData: { index: i }
        })
      }
      
      const result = await filterOpportunities(batch)
      
      // Verify all opportunities are accounted for
      expect(result.filterMetrics.totalAnalyzed).toBe(100)
      expect(result.includedOpportunities.length + result.excludedOpportunities.length).toBe(100)
      
      // Verify data integrity
      const allOpportunities = [...result.includedOpportunities, ...result.excludedOpportunities]
      const allIds = allOpportunities.map(opp => opp.id)
      const uniqueIds = new Set(allIds)
      
      expect(uniqueIds.size).toBe(100) // No duplicates
    })
  })

  describe('Metrics Collection', () => {
    test('should collect accurate metrics for filtered opportunities', async () => {
      const result = await filterOpportunities(mockOpportunities)
      
      expect(result.filterMetrics).toMatchObject({
        totalAnalyzed: 5,
        included: 2,
        excluded: 3,
        exclusionReasons: {
          twoZeroCategories: 2, // opp-2 and opp-4
          missingScoring: 1     // opp-5
        }
      })
    })

    test('should track processing time', async () => {
      const result = await filterOpportunities(mockOpportunities)
      
      expect(result).toHaveProperty('processingTime')
      expect(typeof result.processingTime).toBe('number')
      expect(result.processingTime).toBeGreaterThanOrEqual(0)
    })

    test('should maintain correct exclusion reason counts', async () => {
      const opportunities = [
        { id: '1', scoring: null },
        { id: '2', scoring: null },
        { id: '3', scoring: { clientRelevance: 0, projectRelevance: 0, fundingAttractiveness: 0 } },
        { id: '4', scoring: { clientRelevance: 0, projectRelevance: 0, fundingAttractiveness: 50 } }
      ]
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.filterMetrics.exclusionReasons.missingScoring).toBe(2)
      expect(result.filterMetrics.exclusionReasons.twoZeroCategories).toBe(2)
    })

    test('should return complete result structure', async () => {
      const result = await filterOpportunities(mockOpportunities)
      
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('includedOpportunities')
      expect(result).toHaveProperty('excludedOpportunities')
      expect(result).toHaveProperty('filterMetrics')
      expect(result).toHaveProperty('processingTime')
      expect(result).toHaveProperty('config')
      
      expect(Array.isArray(result.includedOpportunities)).toBe(true)
      expect(Array.isArray(result.excludedOpportunities)).toBe(true)
      expect(typeof result.filterMetrics).toBe('object')
      expect(typeof result.processingTime).toBe('number')
      expect(typeof result.config).toBe('object')
    })
  })

  describe('Advanced Error Handling', () => {
    test('should handle malformed opportunity objects missing id', async () => {
      const malformedOpportunities = [
        {
          // Missing id
          title: 'No ID Opportunity',
          scoring: {
            clientRelevance: 80,
            projectRelevance: 75,
            fundingAttractiveness: 90
          }
        }
      ]
      
      const result = await filterOpportunities(malformedOpportunities)
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(1)
      expect(result.includedOpportunities[0].title).toBe('No ID Opportunity')
    })

    test('should handle malformed opportunity objects missing title', async () => {
      const malformedOpportunities = [
        {
          id: 'opp-no-title',
          // Missing title
          scoring: {
            clientRelevance: 60,
            projectRelevance: 70,
            fundingAttractiveness: 80
          }
        }
      ]
      
      const result = await filterOpportunities(malformedOpportunities)
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(1)
      expect(result.includedOpportunities[0].id).toBe('opp-no-title')
    })

    test('should handle circular references in opportunity objects', async () => {
      const circularOpportunity = {
        id: 'circular-ref',
        title: 'Circular Reference Test',
        scoring: {
          clientRelevance: 50,
          projectRelevance: 60,
          fundingAttractiveness: 70
        }
      }
      // Create circular reference
      circularOpportunity.self = circularOpportunity
      
      const opportunities = [circularOpportunity]
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.success).toBe(true)
      expect(result.includedOpportunities).toHaveLength(1)
      expect(result.includedOpportunities[0].id).toBe('circular-ref')
    })

    test('should handle opportunities with non-numeric scoring values', async () => {
      const opportunities = [
        {
          id: 'non-numeric',
          title: 'Non-numeric scores',
          scoring: {
            clientRelevance: 'high',
            projectRelevance: null,
            fundingAttractiveness: undefined
          }
        }
      ]
      
      const result = await filterOpportunities(opportunities)
      
      expect(result.success).toBe(true)
      expect(result.excludedOpportunities).toHaveLength(1)
      expect(result.filterMetrics.exclusionReasons.twoZeroCategories).toBe(1)
    })

    test('should handle extremely large batch without memory issues', async () => {
      const largeBatch = []
      const batchSize = 10000
      
      for (let i = 0; i < batchSize; i++) {
        largeBatch.push({
          id: `stress-${i}`,
          title: `Stress Test ${i}`,
          scoring: {
            clientRelevance: Math.random() * 100,
            projectRelevance: Math.random() * 100,
            fundingAttractiveness: Math.random() * 100
          },
          metadata: {
            largeData: 'x'.repeat(1000) // Add some bulk to each object
          }
        })
      }
      
      const startMemory = process.memoryUsage().heapUsed
      const result = await filterOpportunities(largeBatch)
      const endMemory = process.memoryUsage().heapUsed
      
      expect(result.success).toBe(true)
      expect(result.filterMetrics.totalAnalyzed).toBe(batchSize)
      expect(result.includedOpportunities.length + result.excludedOpportunities.length).toBe(batchSize)
      
      // Memory usage should be reasonable (less than 500MB increase)
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024
      expect(memoryIncrease).toBeLessThan(500)
    })
  })

  describe('Integration Context Tests', () => {
    test('should demonstrate filter position in pipeline flow', async () => {
      // Simulate opportunities coming from Analysis stage
      const analyzedOpportunities = [
        {
          id: 'pipeline-1',
          title: 'From Analysis Stage',
          scoring: {
            clientRelevance: 85,
            projectRelevance: 90,
            fundingAttractiveness: 80,
            matchScore: 85
          },
          enhanced: true, // Flag from analysis stage
          analysisTimestamp: Date.now()
        }
      ]
      
      const result = await filterOpportunities(analyzedOpportunities)
      
      // Verify filter preserves upstream data
      expect(result.includedOpportunities[0].enhanced).toBe(true)
      expect(result.includedOpportunities[0].analysisTimestamp).toBeDefined()
      
      // Simulate what would go to Storage stage
      const forStorage = result.includedOpportunities
      expect(forStorage).toHaveLength(1)
      expect(forStorage[0].id).toBe('pipeline-1')
    })

    test('should exclude opportunities that should not reach storage', async () => {
      const opportunities = [
        {
          id: 'should-store',
          title: 'Good Opportunity',
          scoring: { clientRelevance: 70, projectRelevance: 80, fundingAttractiveness: 75 }
        },
        {
          id: 'should-not-store',
          title: 'Poor Opportunity',
          scoring: { clientRelevance: 0, projectRelevance: 0, fundingAttractiveness: 10 }
        }
      ]
      
      const result = await filterOpportunities(opportunities)
      
      // Only good opportunities should proceed to storage
      expect(result.includedOpportunities.map(o => o.id)).toEqual(['should-store'])
      expect(result.excludedOpportunities.map(o => o.id)).toEqual(['should-not-store'])
    })

    test('should handle UPDATE and SKIP path scenarios', async () => {
      // These opportunities would typically bypass the filter in the real pipeline
      const updatePathOpportunities = [
        {
          id: 'update-1',
          title: 'Update Path Opportunity',
          scoring: { clientRelevance: 0, projectRelevance: 0, fundingAttractiveness: 0 },
          _action: 'UPDATE' // Simulated flag
        }
      ]
      
      // Filter still processes them if called directly
      const result = await filterOpportunities(updatePathOpportunities)
      
      expect(result.excludedOpportunities).toHaveLength(1)
      expect(result.excludedOpportunities[0]._action).toBe('UPDATE')
    })

    test('should maintain metrics compatible with processCoordinatorV2', async () => {
      const result = await filterOpportunities(mockOpportunities)
      
      // Verify metrics structure matches what coordinator expects
      expect(result.filterMetrics).toHaveProperty('totalAnalyzed')
      expect(result.filterMetrics).toHaveProperty('included')
      expect(result.filterMetrics).toHaveProperty('excluded')
      expect(result.filterMetrics).toHaveProperty('exclusionReasons')
      expect(result).toHaveProperty('processingTime')
      
      // Simulate coordinator aggregation
      const coordinatorMetrics = {
        filter: {
          processed: result.filterMetrics.totalAnalyzed,
          included: result.filterMetrics.included,
          excluded: result.filterMetrics.excluded,
          processingTime: result.processingTime
        }
      }
      
      expect(coordinatorMetrics.filter.processed).toBe(5)
    })
  })

  describe('Logging Verification', () => {
    let consoleLogCalls

    beforeEach(() => {
      consoleLogCalls = []
      console.log = jest.fn((...args) => {
        consoleLogCalls.push(args.join(' '))
      })
    })

    test('should log filter start message with correct format', async () => {
      const config = createFilterConfig({ enableLogging: true })
      await filterOpportunities(mockOpportunities, config)
      
      expect(consoleLogCalls[0]).toContain('🔍 Stage 4: Filter Function Starting')
      expect(consoleLogCalls[1]).toContain('📊 Input: 5 opportunities to filter')
    })

    test('should log filter completion with metrics', async () => {
      const config = createFilterConfig({ enableLogging: true })
      await filterOpportunities(mockOpportunities, config)
      
      const completionLogs = consoleLogCalls.filter(log => log.includes('Filter Function Complete'))
      expect(completionLogs).toHaveLength(1)
      
      const metricsLogs = consoleLogCalls.filter(log => log.includes('Included:'))
      expect(metricsLogs).toHaveLength(1)
      expect(metricsLogs[0]).toContain('2 (40.0%)')
    })

    test('should not log when logging is disabled', async () => {
      const config = createFilterConfig({ enableLogging: false })
      await filterOpportunities(mockOpportunities, config)
      
      expect(consoleLogCalls).toHaveLength(0)
    })

    test('should log exclusion breakdown correctly', async () => {
      const config = createFilterConfig({ enableLogging: true })
      await filterOpportunities(mockOpportunities, config)
      
      const exclusionLogs = consoleLogCalls.filter(log => log.includes('Exclusion Breakdown'))
      expect(exclusionLogs).toHaveLength(1)
      
      const twoZeroLogs = consoleLogCalls.filter(log => log.includes('Two zero categories:'))
      expect(twoZeroLogs[0]).toContain('2')
      
      const missingScoringLogs = consoleLogCalls.filter(log => log.includes('Missing scoring:'))
      expect(missingScoringLogs[0]).toContain('1')
    })
  })

  describe('Concurrency and Thread Safety', () => {
    test('should handle concurrent filter calls safely', async () => {
      const batch1 = [
        { id: 'concurrent-1', scoring: { clientRelevance: 70, projectRelevance: 80, fundingAttractiveness: 75 } }
      ]
      const batch2 = [
        { id: 'concurrent-2', scoring: { clientRelevance: 60, projectRelevance: 65, fundingAttractiveness: 70 } }
      ]
      const batch3 = [
        { id: 'concurrent-3', scoring: { clientRelevance: 0, projectRelevance: 0, fundingAttractiveness: 50 } }
      ]
      
      // Run multiple filter operations concurrently
      const [result1, result2, result3] = await Promise.all([
        filterOpportunities(batch1),
        filterOpportunities(batch2),
        filterOpportunities(batch3)
      ])
      
      // Each should have independent results
      expect(result1.filterMetrics.included).toBe(1)
      expect(result2.filterMetrics.included).toBe(1)
      expect(result3.filterMetrics.excluded).toBe(1)
      
      // No cross-contamination of data
      expect(result1.includedOpportunities[0].id).toBe('concurrent-1')
      expect(result2.includedOpportunities[0].id).toBe('concurrent-2')
      expect(result3.excludedOpportunities[0].id).toBe('concurrent-3')
    })

    test('should maintain metrics isolation across concurrent calls', async () => {
      const createBatch = (prefix, count) => {
        return Array.from({ length: count }, (_, i) => ({
          id: `${prefix}-${i}`,
          scoring: {
            clientRelevance: Math.random() * 100,
            projectRelevance: Math.random() * 100,
            fundingAttractiveness: Math.random() * 100
          }
        }))
      }
      
      const batches = [
        createBatch('batch1', 100),
        createBatch('batch2', 150),
        createBatch('batch3', 200)
      ]
      
      const results = await Promise.all(
        batches.map(batch => filterOpportunities(batch))
      )
      
      // Verify each result has correct metrics for its batch
      expect(results[0].filterMetrics.totalAnalyzed).toBe(100)
      expect(results[1].filterMetrics.totalAnalyzed).toBe(150)
      expect(results[2].filterMetrics.totalAnalyzed).toBe(200)
      
      // Total of all results should match input
      const totalProcessed = results.reduce((sum, r) => sum + r.filterMetrics.totalAnalyzed, 0)
      expect(totalProcessed).toBe(450)
    })

    test('should handle rapid sequential calls without state pollution', async () => {
      const opportunities = [
        { id: 'seq-1', scoring: { clientRelevance: 50, projectRelevance: 60, fundingAttractiveness: 70 } }
      ]
      
      const results = []
      for (let i = 0; i < 10; i++) {
        results.push(await filterOpportunities(opportunities))
      }
      
      // All results should be identical
      results.forEach(result => {
        expect(result.filterMetrics.included).toBe(1)
        expect(result.includedOpportunities[0].id).toBe('seq-1')
      })
    })
  })
})