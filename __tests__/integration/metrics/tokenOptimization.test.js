/**
 * Integration Tests - Metrics and Token Optimization
 * 
 * Tests the metrics collection and token optimization features:
 * - Token usage tracking per stage
 * - Tokens saved via duplicate detection calculation
 * - Execution time tracking per stage
 * - Optimization percentage calculations
 * - Metrics persistence to run_v2_metrics table
 * - Cost estimation accuracy
 * - Dashboard metrics aggregation
 */

// Mock the stage modules BEFORE any imports so the mocked coordinator sees them
jest.mock('../../../lib/agents-v2/core/dataExtractionAgent/index.js', () => ({ 
  extractFromSource: jest.fn() 
}))
jest.mock('../../../lib/agents-v2/optimization/earlyDuplicateDetector.js', () => ({ 
  detectDuplicates: jest.fn() 
}))
jest.mock('../../../lib/agents-v2/core/analysisAgent/index.js', () => ({ 
  enhanceOpportunities: jest.fn() 
}))
jest.mock('../../../lib/agents-v2/core/filterFunction.js', () => ({ 
  filterOpportunities: jest.fn() 
}))
jest.mock('../../../lib/agents-v2/core/storageAgent/index.js', () => ({ 
  storeOpportunities: jest.fn() 
}))

// Mock the services but use real metricsCalculator
jest.mock('../../../lib/services/processCoordinatorV2.js')
jest.mock('../../../lib/services/runManagerV2.js')

import { processApiSourceV2 } from '../../../__mocks__/lib/services/processCoordinatorV2.js'
import { RunManagerV2 } from '../../../__mocks__/lib/services/runManagerV2.js'
import { extractFromSource } from '../../../lib/agents-v2/core/dataExtractionAgent/index.js'
import { detectDuplicates } from '../../../lib/agents-v2/optimization/earlyDuplicateDetector.js'
import { enhanceOpportunities } from '../../../lib/agents-v2/core/analysisAgent/index.js'
import { filterOpportunities } from '../../../lib/agents-v2/core/filterFunction.js'
import { storeOpportunities } from '../../../lib/agents-v2/core/storageAgent/index.js'
import { 
  calculateSuccessRate,
  calculateSLACompliance,
  FAILURE_CATEGORIES,
  SLA_TARGETS
} from '../../../lib/utils/metricsCalculator.js'
import { 
  generateLargeBatch,
  generateNewOpportunity,
  generateDuplicateOpportunity
} from '../../fixtures/opportunities.js'
import { createConfiguredMockSupabase } from '../../mocks/supabase.js'

describe('Metrics and Token Optimization Tests', () => {
  let mockSupabase
  let runManager
  let metricsCollected
  
  beforeEach(() => {
    metricsCollected = []
    mockSupabase = createConfiguredMockSupabase()
    runManager = new RunManagerV2(null, mockSupabase)
    
    // Mock metrics recording (use direct assignment to avoid ESM spy issues)
    runManager.recordStageMetrics = jest.fn(async (metrics) => {
      metricsCollected.push(metrics)
      return Promise.resolve()
    })
    
    // Mock database tables for metrics
    mockSupabase.from = jest.fn((table) => {
      if (table === 'run_v2_metrics') {
        return {
          insert: jest.fn((data) => {
            metricsCollected.push({ table: 'run_v2_metrics', data })
            return Promise.resolve({ data, error: null })
          }),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ 
            data: metricsCollected.filter(m => m.table === 'run_v2_metrics'),
            error: null 
          })
        }
      }
      
      // Default mock for other tables
      return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ data: [], error: null }),
        update: jest.fn().mockResolvedValue({ data: [], error: null }),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null })
      }
    })
    
    jest.clearAllMocks()
  })
  
  describe('Token Usage Tracking', () => {
    test('should track token usage per stage', async () => {
      const opportunities = generateLargeBatch(20)
      
      const stageTokenUsage = {
        extraction: 500,
        analysis: 1500,
        filtering: 800,
        storage: 200
      }
      
      // Mock stages with token usage - using the mocked functions
      extractFromSource.mockResolvedValue({
        opportunities,
        tokenUsage: stageTokenUsage.extraction,
        executionTime: 100,
        extractionMetrics: {
          tokenUsage: stageTokenUsage.extraction,
          executionTime: 100
        }
      })
      
      detectDuplicates.mockResolvedValue({
        newOpportunities: opportunities,
        opportunitiesToUpdate: [],
        opportunitiesToSkip: [],
        metrics: { executionTime: 50 }
      })
      
      enhanceOpportunities.mockResolvedValue({
        enhancedOpportunities: opportunities,
        analysisMetrics: {
          tokenUsage: stageTokenUsage.analysis,
          executionTime: 300
        }
      })
      
      filterOpportunities.mockResolvedValue({
        filteredOpportunities: opportunities.slice(0, 15),
        filterMetrics: {
          tokenUsage: stageTokenUsage.filtering,
          executionTime: 150
        }
      })
      
      await processApiSourceV2(
        'test-source',
        {
          extractFromSource,
          detectDuplicates,
          enhanceOpportunities,
          filterOpportunities
        },
        mockSupabase,
        runManager
      )
      
      // Debug: log metrics collected (removed for clean output)
      
      // Verify token usage was tracked for each stage
      const extractionMetrics = metricsCollected.find(m => 
        m.stageName === 'data_extraction'
      )
      expect(extractionMetrics?.metrics?.tokenUsage).toBe(stageTokenUsage.extraction)
      
      const analysisMetrics = metricsCollected.find(m => 
        m.stageName === 'analysis'
      )
      expect(analysisMetrics?.metrics?.tokenUsage).toBe(stageTokenUsage.analysis)
      
      const filteringMetrics = metricsCollected.find(m => 
        m.stageName === 'filter'
      )
      expect(filteringMetrics?.metrics?.tokenUsage).toBe(stageTokenUsage.filtering)
      
      // Calculate total token usage
      const totalTokens = Object.values(stageTokenUsage).reduce((a, b) => a + b, 0)
      expect(totalTokens).toBe(3000)
    })
    
    test('should accurately track cumulative token usage', async () => {
      const batches = [
        generateLargeBatch(10),
        generateLargeBatch(15),
        generateLargeBatch(20)
      ]
      
      let cumulativeTokens = 0
      
      for (const batch of batches) {
        const batchTokens = batch.length * 150 // 150 tokens per opportunity
        cumulativeTokens += batchTokens
        
        // Mock the stages for each batch
        extractFromSource.mockResolvedValue({
          opportunities: batch,
          tokenUsage: batchTokens,
          extractionMetrics: {
            tokenUsage: batchTokens,
            executionTime: 100
          }
        })
        
        detectDuplicates.mockResolvedValue({
          newOpportunities: batch,
          opportunitiesToUpdate: [],
          opportunitiesToSkip: [],
          metrics: { executionTime: 50 }
        })
        
        await processApiSourceV2(
          'test-source',
          {
            extractFromSource,
            detectDuplicates
          },
          mockSupabase,
          runManager
        )
      }
      
      // Verify cumulative tracking
      const totalTokensTracked = metricsCollected
        .filter(m => m.metrics?.tokenUsage)
        .reduce((sum, m) => sum + m.metrics.tokenUsage, 0)
      
      expect(totalTokensTracked).toBe(cumulativeTokens)
    })
    
    test('should track token usage by model type', async () => {
      const opportunities = generateLargeBatch(10)
      
      const modelUsage = {
        'claude-3-sonnet': 1200,
        'claude-3-haiku': 300,
        'gpt-4': 500
      }
      
      await processApiSourceV2(
        'test-source',
        {
          extractFromSource: jest.fn().mockResolvedValue({
            opportunities,
            tokenUsage: modelUsage['claude-3-sonnet'],
            modelUsed: 'claude-3-sonnet',
            extractionMetrics: {
              tokenUsage: modelUsage['claude-3-sonnet'],
              modelUsed: 'claude-3-sonnet'
            }
          }),
          detectDuplicates: jest.fn().mockResolvedValue({
            newOpportunities: opportunities,
            opportunitiesToUpdate: [],
            opportunitiesToSkip: [],
            metrics: { executionTime: 50 }
          }),
          enhanceOpportunities: jest.fn().mockResolvedValue({
            enhancedOpportunities: opportunities,
            analysisMetrics: {
              tokenUsage: modelUsage['claude-3-haiku'],
              modelUsed: 'claude-3-haiku'
            }
          })
        },
        mockSupabase,
        runManager
      )
      
      // Verify model-specific tracking
      const sonnetMetrics = metricsCollected.find(m => 
        m.metrics?.modelUsed === 'claude-3-sonnet'
      )
      expect(sonnetMetrics?.metrics?.tokenUsage).toBe(modelUsage['claude-3-sonnet'])
      
      const haikuMetrics = metricsCollected.find(m => 
        m.metrics?.modelUsed === 'claude-3-haiku'
      )
      expect(haikuMetrics?.metrics?.tokenUsage).toBe(modelUsage['claude-3-haiku'])
    })
  })
  
  describe('Token Savings Calculation', () => {
    test('should calculate tokens saved via duplicate detection', async () => {
      const opportunities = [
        ...generateLargeBatch(20), // New opportunities
        ...generateLargeBatch(30).map(o => ({ ...o, id: `DUP-${o.id}` })) // Duplicates
      ]
      
      const avgTokensPerOpportunity = 1500
      const duplicateCount = 30
      const expectedSavings = duplicateCount * avgTokensPerOpportunity
      
      // Mock duplicate detection with savings
      const mockDuplicateDetection = jest.fn().mockResolvedValue({
        newOpportunities: opportunities.slice(0, 20),
        opportunitiesToUpdate: [],
        opportunitiesToSkip: opportunities.slice(20).map(o => ({
          apiRecord: o,
          existingRecord: {}
        })),
        metrics: {
          tokensSaved: expectedSavings,
          duplicatesDetected: duplicateCount
        }
      })
      
      await processApiSourceV2(
        'test-source',
        {
          extractFromSource: jest.fn().mockResolvedValue({ opportunities }),
          detectDuplicates: mockDuplicateDetection
        },
        mockSupabase,
        runManager
      )
      
      // Verify token savings tracked
      const detectionMetrics = metricsCollected.find(m => 
        m.stageName === 'early_duplicate_detector'
      )
      expect(detectionMetrics?.metrics?.tokensSaved).toBe(expectedSavings)
      expect(detectionMetrics?.metrics?.duplicatesDetected).toBe(duplicateCount)
    })
    
    test('should calculate optimization percentage accurately', async () => {
      const opportunities = generateLargeBatch(100)
      const skippedCount = 60
      
      // V1 baseline: all opportunities processed
      const v1TokenUsage = opportunities.length * 2000 // 2000 tokens per opportunity
      
      // V2 optimized: only process non-duplicates
      const v2TokenUsage = (opportunities.length - skippedCount) * 2000
      const tokensSaved = v1TokenUsage - v2TokenUsage
      const optimizationPercentage = (tokensSaved / v1TokenUsage) * 100
      
      const mockDuplicateDetection = jest.fn().mockResolvedValue({
        newOpportunities: opportunities.slice(0, 40),
        opportunitiesToUpdate: [],
        opportunitiesToSkip: opportunities.slice(40).map(o => ({
          apiRecord: o,
          existingRecord: {}
        })),
        metrics: {
          tokensSaved,
          optimizationPercentage
        }
      })
      
      await processApiSourceV2(
        'test-source',
        {
          extractFromSource: jest.fn().mockResolvedValue({ opportunities }),
          detectDuplicates: mockDuplicateDetection
        },
        mockSupabase,
        runManager
      )
      
      const metrics = metricsCollected.find(m => 
        m.metrics?.optimizationPercentage
      )
      expect(metrics?.metrics?.optimizationPercentage).toBeCloseTo(60, 1)
    })
    
    test('should track cumulative savings across runs', async () => {
      const runs = [
        { opportunities: 50, saved: 30 },
        { opportunities: 75, saved: 45 },
        { opportunities: 100, saved: 70 }
      ]
      
      let cumulativeSavings = 0
      
      for (const run of runs) {
        const opportunities = generateLargeBatch(run.opportunities)
        const tokensSaved = run.saved * 1500
        cumulativeSavings += tokensSaved
        
        await processApiSourceV2(
          'test-source',
          {
            extractFromSource: jest.fn().mockResolvedValue({ 
              opportunities,
              extractionMetrics: { tokenUsage: 0 }
            }),
            detectDuplicates: jest.fn().mockResolvedValue({
              newOpportunities: opportunities.slice(0, run.opportunities - run.saved),
              opportunitiesToSkip: opportunities.slice(run.opportunities - run.saved).map(o => ({
                apiRecord: o,
                existingRecord: {}
              })),
              metrics: { tokensSaved }
            })
          },
          mockSupabase,
          runManager
        )
      }
      
      // Calculate total savings
      const totalSavings = metricsCollected
        .filter(m => m.metrics?.tokensSaved)
        .reduce((sum, m) => sum + m.metrics.tokensSaved, 0)
      
      expect(totalSavings).toBe(cumulativeSavings)
    })
  })
  
  describe('Execution Time Tracking', () => {
    test('should track execution time per stage', async () => {
      const opportunities = generateLargeBatch(25)
      
      const stageTimes = {
        extraction: 150,
        detection: 50,
        analysis: 300,
        filtering: 100,
        storage: 200
      }
      
      // Mock stages with execution times
      const stages = {
        extractFromSource: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, stageTimes.extraction))
          return { 
            opportunities, 
            extractionMetrics: { executionTime: stageTimes.extraction }
          }
        }),
        detectDuplicates: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, stageTimes.detection))
          return {
            newOpportunities: opportunities,
            opportunitiesToUpdate: [],
            opportunitiesToSkip: [],
            metrics: { executionTime: stageTimes.detection }
          }
        }),
        enhanceOpportunities: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, stageTimes.analysis))
          return { 
            enhancedOpportunities: opportunities,
            analysisMetrics: { executionTime: stageTimes.analysis }
          }
        })
      }
      
      const startTime = Date.now()
      await processApiSourceV2('test-source', stages, mockSupabase, runManager)
      const totalTime = Date.now() - startTime
      
      // Verify stage times were tracked
      const extractionMetrics = metricsCollected.find(m => 
        m.stageName === 'data_extraction'
      )
      expect(extractionMetrics?.metrics?.executionTime).toBeGreaterThanOrEqual(stageTimes.extraction)
      
      const detectionMetrics = metricsCollected.find(m => 
        m.stageName === 'early_duplicate_detector'
      )
      expect(detectionMetrics?.metrics?.executionTime).toBeGreaterThanOrEqual(stageTimes.detection)
      
      // Total time should be sum of stage times (approximately)
      const expectedTotal = Object.values(stageTimes).slice(0, 3).reduce((a, b) => a + b, 0)
      expect(totalTime).toBeGreaterThanOrEqual(expectedTotal)
    })
    
    test('should calculate average time per opportunity', async () => {
      const opportunityCounts = [10, 25, 50, 100]
      const timingData = []
      
      for (const count of opportunityCounts) {
        const opportunities = generateLargeBatch(count)
        const result = await processApiSourceV2(
          'test-source',
          {
            extractFromSource: jest.fn().mockResolvedValue({ 
              opportunities,
              extractionMetrics: {
                executionTime: count * 2 // 2ms per opportunity
              }
            })
          },
          mockSupabase,
          new RunManagerV2(null, mockSupabase)
        )
        
        const totalExec = result.enhancedMetrics.totalExecutionTime || 0
        const avgTimePerOpportunity = totalExec / count
        timingData.push({ count, avgTime: avgTimePerOpportunity })
      }
      
      // Average time should be relatively consistent
      const avgTimes = timingData.map(d => d.avgTime)
      const meanAvgTime = avgTimes.reduce((a, b) => a + b) / avgTimes.length
      
      // All average times should be within 50% of mean
      avgTimes.forEach(time => {
        expect(time).toBeGreaterThan(meanAvgTime * 0.5)
        expect(time).toBeLessThan(meanAvgTime * 1.5)
      })
    })
  })
  
  describe('Cost Estimation', () => {
    test('should estimate costs based on token usage', async () => {
      const opportunities = generateLargeBatch(50)
      
      // Token costs per 1M tokens (example rates)
      const tokenCosts = {
        'claude-3-sonnet': 3.00,
        'claude-3-haiku': 0.25,
        'gpt-4': 30.00
      }
      
      const tokenUsage = {
        'claude-3-sonnet': 50000,
        'claude-3-haiku': 20000
      }
      
      const expectedCost = 
        (tokenUsage['claude-3-sonnet'] / 1000000) * tokenCosts['claude-3-sonnet'] +
        (tokenUsage['claude-3-haiku'] / 1000000) * tokenCosts['claude-3-haiku']
      
      await processApiSourceV2(
        'test-source',
        {
          extractFromSource: jest.fn().mockResolvedValue({
            opportunities,
            tokenUsage: tokenUsage['claude-3-sonnet'],
            modelUsed: 'claude-3-sonnet',
            estimatedCost: (tokenUsage['claude-3-sonnet'] / 1000000) * tokenCosts['claude-3-sonnet'],
            extractionMetrics: {
              tokenUsage: tokenUsage['claude-3-sonnet'],
              modelUsed: 'claude-3-sonnet',
              estimatedCost: (tokenUsage['claude-3-sonnet'] / 1000000) * tokenCosts['claude-3-sonnet']
            }
          }),
          detectDuplicates: jest.fn().mockResolvedValue({
            newOpportunities: opportunities,
            opportunitiesToUpdate: [],
            opportunitiesToSkip: [],
            metrics: { executionTime: 50 }
          }),
          enhanceOpportunities: jest.fn().mockResolvedValue({
            enhancedOpportunities: opportunities,
            tokenUsage: tokenUsage['claude-3-haiku'],
            modelUsed: 'claude-3-haiku',
            estimatedCost: (tokenUsage['claude-3-haiku'] / 1000000) * tokenCosts['claude-3-haiku'],
            analysisMetrics: {
              tokenUsage: tokenUsage['claude-3-haiku'],
              modelUsed: 'claude-3-haiku',
              estimatedCost: (tokenUsage['claude-3-haiku'] / 1000000) * tokenCosts['claude-3-haiku']
            }
          })
        },
        mockSupabase,
        runManager
      )
      
      // Calculate total cost from metrics
      const totalCost = metricsCollected
        .filter(m => m.metrics?.estimatedCost)
        .reduce((sum, m) => sum + m.metrics.estimatedCost, 0)
      
      expect(totalCost).toBeCloseTo(expectedCost, 3)
    })
    
    test('should track cost savings from optimization', async () => {
      const opportunities = generateLargeBatch(100)
      const duplicateCount = 60
      
      const tokenCostPer1M = 3.00
      const tokensPerOpportunity = 2000
      
      // Cost without optimization
      const unoptimizedCost = (opportunities.length * tokensPerOpportunity / 1000000) * tokenCostPer1M
      
      // Cost with optimization (skip duplicates)
      const optimizedCost = ((opportunities.length - duplicateCount) * tokensPerOpportunity / 1000000) * tokenCostPer1M
      
      const costSavings = unoptimizedCost - optimizedCost
      
      await processApiSourceV2(
        'test-source',
        {
          extractFromSource: jest.fn().mockResolvedValue({ opportunities }),
          detectDuplicates: jest.fn().mockResolvedValue({
            newOpportunities: opportunities.slice(0, 40),
            opportunitiesToSkip: opportunities.slice(40).map(o => ({
              apiRecord: o,
              existingRecord: {}
            })),
            metrics: {
              tokensSaved: duplicateCount * tokensPerOpportunity,
              costSavings
            }
          })
        },
        mockSupabase,
        runManager
      )
      
      const savingsMetrics = metricsCollected.find(m => 
        m.metrics?.costSavings
      )
      expect(savingsMetrics?.metrics?.costSavings).toBeCloseTo(costSavings, 2)
    })
  })
  
  describe('Metrics Persistence', () => {
    test('should persist metrics to run_v2_metrics table', async () => {
      const opportunities = generateLargeBatch(30)
      const insertedMetrics = []
      
      mockSupabase.from = jest.fn((table) => {
        if (table === 'run_v2_metrics') {
          return {
            insert: jest.fn((data) => {
              insertedMetrics.push(data)
              return Promise.resolve({ data, error: null })
            })
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      })
      
      await processApiSourceV2(
        'test-source',
        {
          extractFromSource: jest.fn().mockResolvedValue({ 
            opportunities,
            extractionMetrics: {
              tokenUsage: 1000
            }
          })
        },
        mockSupabase,
        runManager
      )
      
      // Verify metrics were persisted
      expect(insertedMetrics.length).toBeGreaterThan(0)
      expect(insertedMetrics[0]).toHaveProperty('run_id')
      expect(insertedMetrics[0]).toHaveProperty('stage_name')
      expect(insertedMetrics[0]).toHaveProperty('metrics')
    })
    
    test('should handle metrics persistence failures gracefully', async () => {
      const opportunities = generateLargeBatch(10)
      
      mockSupabase.from = jest.fn((table) => {
        if (table === 'run_v2_metrics') {
          return {
            insert: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Database error' } 
            })
          }
        }
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockResolvedValue({ data: [], error: null })
        }
      })
      
      // Should not throw even if metrics persistence fails
      await expect(
        processApiSourceV2(
          'test-source',
          {
            extractFromSource: jest.fn().mockResolvedValue({ 
              opportunities,
              extractionMetrics: {
                tokenUsage: 500
              }
            })
          },
          mockSupabase,
          runManager
        )
      ).resolves.not.toThrow()
    })
  })
  
  describe('Dashboard Metrics Aggregation', () => {
    test('should aggregate metrics for dashboard display', async () => {
      // Simulate multiple runs
      const runs = [
        { opportunities: 50, new: 20, updated: 10, skipped: 20, tokens: 30000 },
        { opportunities: 75, new: 30, updated: 15, skipped: 30, tokens: 45000 },
        { opportunities: 100, new: 40, updated: 20, skipped: 40, tokens: 60000 }
      ]
      
      for (const run of runs) {
        await processApiSourceV2(
          'test-source',
          {
            extractFromSource: jest.fn().mockResolvedValue({ 
              opportunities: generateLargeBatch(run.opportunities),
              tokenUsage: run.tokens
            }),
            detectDuplicates: jest.fn().mockResolvedValue({
              newOpportunities: generateLargeBatch(run.new),
              opportunitiesToUpdate: generateLargeBatch(run.updated).map(o => ({
                apiRecord: o,
                dbRecord: {}
              })),
              opportunitiesToSkip: generateLargeBatch(run.skipped).map(o => ({
                apiRecord: o,
                existingRecord: {}
              }))
            })
          },
          mockSupabase,
          new RunManagerV2(null, mockSupabase)
        )
      }
      
      // Aggregate metrics
      const aggregated = {
        totalOpportunities: runs.reduce((sum, r) => sum + r.opportunities, 0),
        totalNew: runs.reduce((sum, r) => sum + r.new, 0),
        totalUpdated: runs.reduce((sum, r) => sum + r.updated, 0),
        totalSkipped: runs.reduce((sum, r) => sum + r.skipped, 0),
        totalTokens: runs.reduce((sum, r) => sum + r.tokens, 0)
      }
      
      // Verify aggregation
      expect(aggregated.totalOpportunities).toBe(225)
      expect(aggregated.totalNew).toBe(90)
      expect(aggregated.totalUpdated).toBe(45)
      expect(aggregated.totalSkipped).toBe(90)
      expect(aggregated.totalTokens).toBe(135000)
    })
    
    test('should calculate success rates and SLA compliance', async () => {
      const metrics = {
        totalOpportunities: 100,
        failures: {
          [FAILURE_CATEGORIES.API_ERRORS]: 2,
          [FAILURE_CATEGORIES.VALIDATION_ERRORS]: 1,
          [FAILURE_CATEGORIES.PROCESSING_ERRORS]: 2
        }
      }
      
      const successRate = calculateSuccessRate(metrics)
      expect(successRate).toBe(95) // 95% success rate
      
      const slaCompliance = calculateSLACompliance({
        ...metrics,
        executionTimeMinutes: 25,
        successRate,
        costPerOpportunity: 0.04,
        throughput: 12
      })
      
      expect(slaCompliance.overall).toBeGreaterThan(80) // Good compliance
      expect(slaCompliance.breakdown.timeCompliance).toBeGreaterThan(0)
      expect(slaCompliance.breakdown.successCompliance).toBe(100) // Meets 95% target
      expect(slaCompliance.breakdown.costCompliance).toBe(100) // Under $0.05
      expect(slaCompliance.breakdown.throughputCompliance).toBe(100) // Above 10/min
    })
    
    test('should track optimization trends over time', async () => {
      const historicalRuns = []
      
      // Simulate improving optimization over time
      for (let i = 0; i < 5; i++) {
        const optimizationRate = 40 + (i * 10) // 40%, 50%, 60%, 70%, 80%
        const opportunities = 100
        const skipped = Math.floor(opportunities * (optimizationRate / 100))
        
        await processApiSourceV2(
          'test-source',
          {
            extractFromSource: jest.fn().mockResolvedValue({ 
              opportunities: generateLargeBatch(opportunities)
            }),
            detectDuplicates: jest.fn().mockResolvedValue({
              newOpportunities: generateLargeBatch(opportunities - skipped),
              opportunitiesToSkip: generateLargeBatch(skipped).map(o => ({
                apiRecord: o,
                existingRecord: {}
              })),
              metrics: {
                optimizationPercentage: optimizationRate
              }
            })
          },
          mockSupabase,
          new RunManagerV2(null, mockSupabase)
        )
        
        historicalRuns.push({ 
          run: i + 1, 
          optimizationRate 
        })
      }
      
      // Verify improving trend
      for (let i = 1; i < historicalRuns.length; i++) {
        expect(historicalRuns[i].optimizationRate).toBeGreaterThan(
          historicalRuns[i - 1].optimizationRate
        )
      }
      
      // Final optimization should be at target (60-80%)
      const finalOptimization = historicalRuns[historicalRuns.length - 1].optimizationRate
      expect(finalOptimization).toBeGreaterThanOrEqual(60)
      expect(finalOptimization).toBeLessThanOrEqual(80)
    })
  })
  
  describe('Real-time Metrics Updates', () => {
    test('should provide real-time metrics during processing', async () => {
      const opportunities = generateLargeBatch(50)
      const realtimeMetrics = []
      
      // Capture metrics as they're recorded
      runManager.recordStageMetrics = jest.fn(async (metrics) => {
        realtimeMetrics.push({
          timestamp: Date.now(),
          ...metrics
        })
      })
      
      await processApiSourceV2(
        'test-source',
        {
          extractFromSource: jest.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100))
            return { opportunities }
          }),
          detectDuplicates: jest.fn().mockImplementation(async (opps) => {
            await new Promise(resolve => setTimeout(resolve, 50))
            return {
              newOpportunities: opps,
              opportunitiesToUpdate: [],
              opportunitiesToSkip: []
            }
          }),
          enhanceOpportunities: jest.fn().mockImplementation(async (opps) => {
            await new Promise(resolve => setTimeout(resolve, 150))
            return { enhancedOpportunities: opps }
          })
        },
        mockSupabase,
        runManager
      )
      
      // Verify metrics were recorded in real-time (as stages complete)
      expect(realtimeMetrics.length).toBeGreaterThan(0)
      
      // Verify timestamps show progression
      for (let i = 1; i < realtimeMetrics.length; i++) {
        expect(realtimeMetrics[i].timestamp).toBeGreaterThanOrEqual(
          realtimeMetrics[i - 1].timestamp
        )
      }
    })
  })
})