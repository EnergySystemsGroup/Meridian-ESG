#!/usr/bin/env node

/**
 * Performance Baseline Comparison Testing
 * 
 * Validates the V2 pipeline performance improvements against baseline expectations:
 * - Token usage optimization (60-80% savings with duplicates)
 * - Execution time improvements (60-80% faster with duplicates)
 * - Memory usage efficiency
 * - Throughput improvements
 * - Scalability testing with large datasets
 */

import { withTestEnvironment } from './00-setup-test-infrastructure.js';
import { createFactories } from './testDataFactories.js';
import { processApiSourceV2 } from '../../../app/lib/services/processCoordinatorV2.js';

/**
 * Performance Baseline Test Suite
 */
export class PerformanceBaselineTests {
  constructor() {
    this.baselineTargets = {
      // Task 36 performance targets
      tokenSavingsPercent: 60, // 60-80% token savings
      timeImprovementPercent: 60, // 60-80% time improvement
      maxExecutionTimeMs: 300000, // 5 minutes maximum
      minEfficiencyScore: 70, // Minimum efficiency score
      maxMemoryUsageMB: 512, // Maximum memory usage
      minThroughputOpsPerSecond: 1 // Minimum throughput
    };
    
    this.testResults = [];
  }

  /**
   * Run complete performance baseline validation
   */
  async runPerformanceTests() {
    console.log('🧪 Performance Baseline Comparison Tests');
    console.log('='.repeat(60));

    const results = [];

    await withTestEnvironment(async (testEnv) => {
      // Test 1: Token optimization validation
      const tokenTest = await this.testTokenOptimization(testEnv);
      results.push(tokenTest);

      // Test 2: Execution time optimization
      const timeTest = await this.testExecutionTimeOptimization(testEnv);
      results.push(timeTest);

      // Test 3: Memory usage efficiency
      const memoryTest = await this.testMemoryEfficiency(testEnv);
      results.push(memoryTest);

      // Test 4: Throughput performance
      const throughputTest = await this.testThroughputPerformance(testEnv);
      results.push(throughputTest);

      // Test 5: Scalability testing
      const scalabilityTest = await this.testScalabilityPerformance(testEnv);
      results.push(scalabilityTest);
    });

    // Generate performance summary
    const summary = this.generatePerformanceSummary(results);
    console.log('\n📊 Performance Baseline Summary');
    console.log('='.repeat(40));
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Success Rate: ${summary.successRate}%`);

    if (summary.failed > 0) {
      console.log('\n❌ Failed Performance Tests:');
      summary.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.testName}: ${r.error || 'Performance target not met'}`));
    }

    return summary;
  }

  /**
   * Test token usage optimization
   */
  async testTokenOptimization(testEnv) {
    console.log('\n🔬 Test: Token Usage Optimization');
    console.log('-'.repeat(50));

    const { supabase, anthropic, config } = testEnv;
    const factories = createFactories(config.testSources.grantsGov.id);

    try {
      // Create scenario with high duplicate ratio for maximum optimization
      const scenario = factories.scenarioFactory.createPerformanceScenario({
        totalOpportunities: 20,
        duplicateRatio: 0.8, // 80% duplicates
        updateRatio: 0.3
      });

      console.log(`📋 Testing token optimization with ${scenario.expectedResults.totalOpportunities} opportunities`);
      console.log(`   - Expected duplicates: ${Math.floor(scenario.expectedResults.totalOpportunities * 0.8)}`);
      console.log(`   - Expected token savings: ${scenario.expectedResults.estimatedTokenSavings}%`);

      // Seed database with existing records
      console.log('🌱 Seeding database for duplicate detection...');
      for (const record of scenario.databaseState.existingOpportunities) {
        await supabase.from('funding_opportunities').insert(record);
      }

      // Measure token usage
      const startTime = Date.now();
      const result = await processApiSourceV2(
        config.testSources.grantsGov.id,
        null,
        supabase,
        anthropic
      );
      const executionTime = Date.now() - startTime;

      // Calculate token metrics
      const tokenMetrics = this.calculateTokenMetrics(result);
      console.log(`📊 Token Usage Results:`);
      console.log(`   - Total tokens: ${tokenMetrics.totalTokens}`);
      console.log(`   - Bypassed opportunities: ${tokenMetrics.bypassedOpportunities}`);
      console.log(`   - Token savings: ${tokenMetrics.savingsPercent}%`);

      // Validate against baseline
      const meetsTokenTarget = tokenMetrics.savingsPercent >= this.baselineTargets.tokenSavingsPercent;
      const meetsEfficiencyTarget = tokenMetrics.efficiencyScore >= this.baselineTargets.minEfficiencyScore;

      const success = meetsTokenTarget && meetsEfficiencyTarget;
      
      if (success) {
        console.log(`✅ Token optimization meets baseline (${tokenMetrics.savingsPercent}% >= ${this.baselineTargets.tokenSavingsPercent}%)`);
      } else {
        console.log(`❌ Token optimization below baseline (${tokenMetrics.savingsPercent}% < ${this.baselineTargets.tokenSavingsPercent}%)`);
      }

      return {
        success,
        testName: 'Token Usage Optimization',
        tokenMetrics,
        executionTime,
        meetsTargets: {
          tokenSavings: meetsTokenTarget,
          efficiency: meetsEfficiencyTarget
        }
      };

    } catch (error) {
      console.error(`❌ Token optimization test failed: ${error.message}`);
      return {
        success: false,
        testName: 'Token Usage Optimization',
        error: error.message
      };
    }
  }

  /**
   * Test execution time optimization
   */
  async testExecutionTimeOptimization(testEnv) {
    console.log('\n🔬 Test: Execution Time Optimization');
    console.log('-'.repeat(50));

    const { supabase, anthropic, config } = testEnv;
    const factories = createFactories(config.testSources.grantsGov.id);

    try {
      // Test with different duplicate ratios to measure time improvement
      const scenarios = [
        { name: 'No Duplicates', duplicateRatio: 0, expectedImprovement: 0 },
        { name: 'High Duplicates', duplicateRatio: 0.8, expectedImprovement: 60 }
      ];

      const timingResults = [];

      for (const scenarioConfig of scenarios) {
        console.log(`⏱️ Testing ${scenarioConfig.name} scenario...`);

        const scenario = factories.scenarioFactory.createPerformanceScenario({
          totalOpportunities: 10,
          duplicateRatio: scenarioConfig.duplicateRatio,
          updateRatio: 0.5
        });

        // Seed database if needed
        if (scenarioConfig.duplicateRatio > 0) {
          for (const record of scenario.databaseState.existingOpportunities) {
            await supabase.from('funding_opportunities').insert(record);
          }
        }

        // Measure execution time
        const startTime = Date.now();
        const result = await processApiSourceV2(
          config.testSources.grantsGov.id,
          null,
          supabase,
          anthropic
        );
        const executionTime = Date.now() - startTime;

        timingResults.push({
          scenario: scenarioConfig.name,
          executionTime,
          duplicateRatio: scenarioConfig.duplicateRatio,
          expectedImprovement: scenarioConfig.expectedImprovement
        });

        console.log(`   ${scenarioConfig.name}: ${executionTime}ms`);

        // Clean up for next scenario
        await this.cleanupTestData(supabase);
      }

      // Calculate time improvement
      const baselineTime = timingResults.find(r => r.duplicateRatio === 0)?.executionTime || 0;
      const optimizedTime = timingResults.find(r => r.duplicateRatio > 0)?.executionTime || 0;
      const actualImprovement = baselineTime > 0 ? Math.round(((baselineTime - optimizedTime) / baselineTime) * 100) : 0;

      console.log(`📊 Execution Time Results:`);
      console.log(`   - Baseline time: ${baselineTime}ms`);
      console.log(`   - Optimized time: ${optimizedTime}ms`);
      console.log(`   - Actual improvement: ${actualImprovement}%`);

      // Validate against baseline
      const meetsTimeTarget = actualImprovement >= this.baselineTargets.timeImprovementPercent;
      const meetsMaxTimeTarget = Math.max(baselineTime, optimizedTime) <= this.baselineTargets.maxExecutionTimeMs;

      const success = meetsTimeTarget && meetsMaxTimeTarget;

      if (success) {
        console.log(`✅ Time optimization meets baseline (${actualImprovement}% >= ${this.baselineTargets.timeImprovementPercent}%)`);
      } else {
        console.log(`❌ Time optimization below baseline (${actualImprovement}% < ${this.baselineTargets.timeImprovementPercent}%)`);
      }

      return {
        success,
        testName: 'Execution Time Optimization',
        timingResults,
        actualImprovement,
        meetsTargets: {
          timeImprovement: meetsTimeTarget,
          maxExecutionTime: meetsMaxTimeTarget
        }
      };

    } catch (error) {
      console.error(`❌ Execution time optimization test failed: ${error.message}`);
      return {
        success: false,
        testName: 'Execution Time Optimization',
        error: error.message
      };
    }
  }

  /**
   * Test memory usage efficiency
   */
  async testMemoryEfficiency(testEnv) {
    console.log('\n🔬 Test: Memory Usage Efficiency');
    console.log('-'.repeat(50));

    const { supabase, anthropic, config } = testEnv;
    const factories = createFactories(config.testSources.grantsGov.id);

    try {
      // Monitor memory usage during pipeline execution
      const initialMemory = process.memoryUsage();
      console.log(`📊 Initial memory usage: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

      // Create moderate-sized scenario
      const scenario = factories.scenarioFactory.createPerformanceScenario({
        totalOpportunities: 50,
        duplicateRatio: 0.6,
        updateRatio: 0.4
      });

      // Seed database
      for (const record of scenario.databaseState.existingOpportunities) {
        await supabase.from('funding_opportunities').insert(record);
      }

      // Run pipeline with memory monitoring
      const memorySnapshots = [];
      const memoryMonitor = setInterval(() => {
        const memory = process.memoryUsage();
        memorySnapshots.push({
          timestamp: Date.now(),
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          rss: memory.rss
        });
      }, 1000);

      const result = await processApiSourceV2(
        config.testSources.grantsGov.id,
        null,
        supabase,
        anthropic
      );

      clearInterval(memoryMonitor);

      // Calculate memory metrics
      const finalMemory = process.memoryUsage();
      const peakMemory = Math.max(...memorySnapshots.map(s => s.heapUsed));
      const avgMemory = memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / memorySnapshots.length;

      console.log(`📊 Memory Usage Results:`);
      console.log(`   - Peak memory: ${Math.round(peakMemory / 1024 / 1024)}MB`);
      console.log(`   - Average memory: ${Math.round(avgMemory / 1024 / 1024)}MB`);
      console.log(`   - Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);

      // Validate against baseline
      const peakMemoryMB = peakMemory / 1024 / 1024;
      const meetsMemoryTarget = peakMemoryMB <= this.baselineTargets.maxMemoryUsageMB;

      if (meetsMemoryTarget) {
        console.log(`✅ Memory usage meets baseline (${Math.round(peakMemoryMB)}MB <= ${this.baselineTargets.maxMemoryUsageMB}MB)`);
      } else {
        console.log(`❌ Memory usage exceeds baseline (${Math.round(peakMemoryMB)}MB > ${this.baselineTargets.maxMemoryUsageMB}MB)`);
      }

      return {
        success: meetsMemoryTarget,
        testName: 'Memory Usage Efficiency',
        memoryMetrics: {
          peakMemoryMB: Math.round(peakMemoryMB),
          avgMemoryMB: Math.round(avgMemory / 1024 / 1024),
          finalMemoryMB: Math.round(finalMemory.heapUsed / 1024 / 1024)
        },
        memorySnapshots,
        meetsTargets: {
          maxMemoryUsage: meetsMemoryTarget
        }
      };

    } catch (error) {
      console.error(`❌ Memory efficiency test failed: ${error.message}`);
      return {
        success: false,
        testName: 'Memory Usage Efficiency',
        error: error.message
      };
    }
  }

  /**
   * Test throughput performance
   */
  async testThroughputPerformance(testEnv) {
    console.log('\n🔬 Test: Throughput Performance');
    console.log('-'.repeat(50));

    const { supabase, anthropic, config } = testEnv;
    const factories = createFactories(config.testSources.grantsGov.id);

    try {
      // Test throughput with different opportunity counts
      const throughputTests = [
        { count: 10, name: 'Small batch' },
        { count: 25, name: 'Medium batch' },
        { count: 50, name: 'Large batch' }
      ];

      const throughputResults = [];

      for (const test of throughputTests) {
        console.log(`⚡ Testing ${test.name} (${test.count} opportunities)...`);

        const scenario = factories.scenarioFactory.createPerformanceScenario({
          totalOpportunities: test.count,
          duplicateRatio: 0.5,
          updateRatio: 0.3
        });

        // Seed database
        for (const record of scenario.databaseState.existingOpportunities) {
          await supabase.from('funding_opportunities').insert(record);
        }

        // Measure throughput
        const startTime = Date.now();
        const result = await processApiSourceV2(
          config.testSources.grantsGov.id,
          null,
          supabase,
          anthropic
        );
        const executionTime = Date.now() - startTime;

        const throughput = test.count / (executionTime / 1000); // ops per second
        throughputResults.push({
          testName: test.name,
          opportunityCount: test.count,
          executionTime,
          throughput: Math.round(throughput * 100) / 100
        });

        console.log(`   ${test.name}: ${Math.round(throughput * 100) / 100} ops/sec`);

        // Clean up for next test
        await this.cleanupTestData(supabase);
      }

      // Calculate average throughput
      const avgThroughput = throughputResults.reduce((sum, r) => sum + r.throughput, 0) / throughputResults.length;

      console.log(`📊 Throughput Results:`);
      console.log(`   - Average throughput: ${Math.round(avgThroughput * 100) / 100} ops/sec`);

      // Validate against baseline
      const meetsThroughputTarget = avgThroughput >= this.baselineTargets.minThroughputOpsPerSecond;

      if (meetsThroughputTarget) {
        console.log(`✅ Throughput meets baseline (${Math.round(avgThroughput * 100) / 100} >= ${this.baselineTargets.minThroughputOpsPerSecond} ops/sec)`);
      } else {
        console.log(`❌ Throughput below baseline (${Math.round(avgThroughput * 100) / 100} < ${this.baselineTargets.minThroughputOpsPerSecond} ops/sec)`);
      }

      return {
        success: meetsThroughputTarget,
        testName: 'Throughput Performance',
        throughputResults,
        avgThroughput,
        meetsTargets: {
          minThroughput: meetsThroughputTarget
        }
      };

    } catch (error) {
      console.error(`❌ Throughput performance test failed: ${error.message}`);
      return {
        success: false,
        testName: 'Throughput Performance',
        error: error.message
      };
    }
  }

  /**
   * Test scalability performance
   */
  async testScalabilityPerformance(testEnv) {
    console.log('\n🔬 Test: Scalability Performance');
    console.log('-'.repeat(50));

    const { supabase, anthropic, config } = testEnv;
    const factories = createFactories(config.testSources.grantsGov.id);

    try {
      // Test scalability with increasing loads
      const scalabilityTests = [
        { count: 25, name: 'Baseline load' },
        { count: 100, name: 'High load' }
      ];

      const scalabilityResults = [];

      for (const test of scalabilityTests) {
        console.log(`📈 Testing ${test.name} (${test.count} opportunities)...`);

        const scenario = factories.scenarioFactory.createPerformanceScenario({
          totalOpportunities: test.count,
          duplicateRatio: 0.7,
          updateRatio: 0.4
        });

        // Seed database
        for (const record of scenario.databaseState.existingOpportunities) {
          await supabase.from('funding_opportunities').insert(record);
        }

        // Measure scalability metrics
        const startTime = Date.now();
        const initialMemory = process.memoryUsage();
        
        const result = await processApiSourceV2(
          config.testSources.grantsGov.id,
          null,
          supabase,
          anthropic
        );
        
        const executionTime = Date.now() - startTime;
        const finalMemory = process.memoryUsage();
        const throughput = test.count / (executionTime / 1000);

        scalabilityResults.push({
          testName: test.name,
          opportunityCount: test.count,
          executionTime,
          throughput,
          memoryIncrease: finalMemory.heapUsed - initialMemory.heapUsed,
          success: executionTime <= this.baselineTargets.maxExecutionTimeMs
        });

        console.log(`   ${test.name}: ${Math.round(throughput * 100) / 100} ops/sec, ${executionTime}ms`);

        // Clean up for next test
        await this.cleanupTestData(supabase);
      }

      // Analyze scalability characteristics
      const baselineResult = scalabilityResults.find(r => r.testName.includes('Baseline'));
      const highLoadResult = scalabilityResults.find(r => r.testName.includes('High'));

      let scalabilityScore = 100;
      if (baselineResult && highLoadResult) {
        const loadIncrease = highLoadResult.opportunityCount / baselineResult.opportunityCount;
        const timeIncrease = highLoadResult.executionTime / baselineResult.executionTime;
        scalabilityScore = Math.max(0, 100 - Math.round((timeIncrease - loadIncrease) * 20));
      }

      console.log(`📊 Scalability Results:`);
      console.log(`   - Scalability score: ${scalabilityScore}%`);

      // Validate scalability
      const meetsScalabilityTarget = scalabilityScore >= 70; // 70% scalability score minimum
      const allTestsPassTime = scalabilityResults.every(r => r.success);

      const success = meetsScalabilityTarget && allTestsPassTime;

      if (success) {
        console.log(`✅ Scalability meets baseline (${scalabilityScore}% >= 70%)`);
      } else {
        console.log(`❌ Scalability below baseline (${scalabilityScore}% < 70%)`);
      }

      return {
        success,
        testName: 'Scalability Performance',
        scalabilityResults,
        scalabilityScore,
        meetsTargets: {
          scalabilityScore: meetsScalabilityTarget,
          executionTime: allTestsPassTime
        }
      };

    } catch (error) {
      console.error(`❌ Scalability performance test failed: ${error.message}`);
      return {
        success: false,
        testName: 'Scalability Performance',
        error: error.message
      };
    }
  }

  /**
   * Calculate token usage metrics
   */
  calculateTokenMetrics(result) {
    const metrics = result.metrics || {};
    const stages = result.stages || {};
    
    // Calculate total tokens used
    let totalTokens = 0;
    Object.values(stages).forEach(stage => {
      if (stage.metrics?.totalTokens) {
        totalTokens += stage.metrics.totalTokens;
      }
    });

    // Calculate optimization metrics
    const dupeDetection = stages.earlyDuplicateDetector?.metrics || {};
    const totalOpportunities = dupeDetection.totalOpportunities || 0;
    const bypassedOpportunities = (dupeDetection.opportunitiesToUpdate || 0) + (dupeDetection.opportunitiesToSkip || 0);
    
    const savingsPercent = totalOpportunities > 0 ? 
      Math.round((bypassedOpportunities / totalOpportunities) * 100) : 0;
    
    const efficiencyScore = result.metrics?.efficiencyScore || 
      (result.optimizationImpact?.efficiencyScore) || 0;

    return {
      totalTokens,
      bypassedOpportunities,
      totalOpportunities,
      savingsPercent,
      efficiencyScore
    };
  }

  /**
   * Clean up test data
   */
  async cleanupTestData(supabase) {
    try {
      await supabase
        .from('funding_opportunities')
        .delete()
        .or('api_opportunity_id.like.PERF-%,api_opportunity_id.like.NEW-%,api_opportunity_id.like.UPDATE-%,api_opportunity_id.like.SKIP-%');
    } catch (error) {
      console.warn(`⚠️ Cleanup warning: ${error.message}`);
    }
  }

  /**
   * Generate performance summary
   */
  generatePerformanceSummary(results) {
    const totalTests = results.length;
    const passed = results.filter(r => r.success).length;
    const failed = totalTests - passed;

    return {
      totalTests,
      passed,
      failed,
      successRate: Math.round((passed / totalTests) * 100),
      results,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Main execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new PerformanceBaselineTests();
  
  // Prevent timeout during performance tests
  const keepAlive = setInterval(() => {}, 1000);
  
  const testTimeout = setTimeout(() => {
    console.error('❌ Performance tests timed out after 60 minutes');
    clearInterval(keepAlive);
    process.exit(1);
  }, 60 * 60 * 1000);
  
  testSuite.runPerformanceTests()
    .then(summary => {
      console.log('\n🎯 Performance Baseline Tests Complete!');
      
      clearTimeout(testTimeout);
      clearInterval(keepAlive);
      
      if (summary.passed === summary.totalTests) {
        console.log('🎉 All performance tests passed!');
        process.exit(0);
      } else {
        console.log('❌ Some performance tests failed.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Performance test suite failed:', error);
      clearTimeout(testTimeout);
      clearInterval(keepAlive);
      process.exit(1);
    });
}