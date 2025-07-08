/**
 * Integration Test Utilities
 * 
 * Common utilities and helpers for integration testing the optimized pipeline.
 * Provides validation, metrics collection, and pipeline path verification.
 */

/**
 * Pipeline Path Validator
 * Verifies that the correct pipeline path was taken based on opportunity type
 */
export class PipelinePathValidator {
  constructor() {
    this.expectedPaths = {
      NEW: ['SourceOrchestrator', 'DataExtraction', 'EarlyDuplicateDetector', 'Analysis', 'Filter', 'Storage'],
      UPDATE: ['SourceOrchestrator', 'DataExtraction', 'EarlyDuplicateDetector', 'DirectUpdate'],
      SKIP: ['SourceOrchestrator', 'DataExtraction', 'EarlyDuplicateDetector']
    };
  }

  /**
   * Validate that the correct pipeline path was taken
   */
  validatePath(result, expectedType) {
    const expectedPath = this.expectedPaths[expectedType];
    const actualStages = Object.keys(result.stages || {});
    
    console.log(`🛤️ Validating ${expectedType} pipeline path:`);
    console.log(`  Expected: ${expectedPath.join(' → ')}`);
    console.log(`  Actual: ${actualStages.join(' → ')}`);
    
    const validation = {
      type: expectedType,
      expected: expectedPath,
      actual: actualStages,
      isValid: true,
      issues: []
    };
    
    // Check all expected stages are present
    for (const stage of expectedPath) {
      const stageKey = this.getStageKey(stage);
      if (!actualStages.includes(stageKey)) {
        validation.isValid = false;
        validation.issues.push(`Missing expected stage: ${stage}`);
      }
    }
    
    // Check for unexpected stages
    for (const actualStage of actualStages) {
      const expectedStage = this.getExpectedStage(actualStage);
      if (expectedStage && !expectedPath.includes(expectedStage)) {
        validation.isValid = false;
        validation.issues.push(`Unexpected stage: ${actualStage}`);
      }
    }
    
    // Validate specific conditions based on type
    this.validateTypeSpecificConditions(result, expectedType, validation);
    
    return validation;
  }

  /**
   * Map result stage keys to expected stage names
   */
  getStageKey(stageName) {
    const stageMap = {
      'SourceOrchestrator': 'sourceOrchestrator',
      'DataExtraction': 'dataExtraction',
      'EarlyDuplicateDetector': 'earlyDuplicateDetector',
      'Analysis': 'analysis',
      'Filter': 'filter',
      'Storage': 'storage',
      'DirectUpdate': 'directUpdate'
    };
    return stageMap[stageName] || stageName;
  }

  /**
   * Map result stage keys back to expected stage names
   */
  getExpectedStage(stageKey) {
    const reverseMap = {
      'sourceOrchestrator': 'SourceOrchestrator',
      'dataExtraction': 'DataExtraction',
      'earlyDuplicateDetector': 'EarlyDuplicateDetector',
      'analysis': 'Analysis',
      'filter': 'Filter',
      'storage': 'Storage',
      'directUpdate': 'DirectUpdate'
    };
    return reverseMap[stageKey];
  }

  /**
   * Validate type-specific conditions
   */
  validateTypeSpecificConditions(result, expectedType, validation) {
    switch (expectedType) {
      case 'NEW':
        // Should have analysis and storage results
        if (!result.stages?.analysis?.opportunities?.length) {
          validation.issues.push('NEW opportunities should have analysis results');
          validation.isValid = false;
        }
        if (!result.stages?.storage?.metrics?.newOpportunities) {
          validation.issues.push('NEW opportunities should result in stored opportunities');
          validation.isValid = false;
        }
        break;
        
      case 'UPDATE':
        // Should have direct update results but no analysis
        if (result.stages?.analysis?.opportunities?.length) {
          validation.issues.push('UPDATE opportunities should not go through analysis');
          validation.isValid = false;
        }
        if (!result.stages?.directUpdate?.metrics?.successful) {
          validation.issues.push('UPDATE opportunities should have successful direct updates');
          validation.isValid = false;
        }
        break;
        
      case 'SKIP':
        // Should have neither analysis nor storage results
        if (result.stages?.analysis?.opportunities?.length) {
          validation.issues.push('SKIP opportunities should not go through analysis');
          validation.isValid = false;
        }
        if (result.stages?.storage?.metrics?.newOpportunities) {
          validation.issues.push('SKIP opportunities should not result in new storage');
          validation.isValid = false;
        }
        break;
    }
  }
}

/**
 * Performance Metrics Collector
 * Collects and validates performance metrics for the optimized pipeline
 */
export class PerformanceMetricsCollector {
  constructor() {
    this.metrics = {};
  }

  /**
   * Collect metrics from pipeline result
   */
  collectMetrics(result) {
    const metrics = {
      timestamp: new Date().toISOString(),
      totalExecutionTime: result.metrics?.totalExecutionTime || 0,
      pipeline: result.pipeline || 'unknown',
      
      // Stage execution times
      stageExecutionTimes: this.extractStageExecutionTimes(result),
      
      // Token usage metrics
      tokenMetrics: this.extractTokenMetrics(result),
      
      // Opportunity processing metrics
      opportunityMetrics: this.extractOpportunityMetrics(result),
      
      // Performance improvements
      performanceImprovements: this.calculatePerformanceImprovements(result)
    };
    
    this.metrics[result.runId || Date.now()] = metrics;
    return metrics;
  }

  /**
   * Extract execution times for each stage
   */
  extractStageExecutionTimes(result) {
    const stages = result.stages || {};
    const executionTimes = {};
    
    Object.entries(stages).forEach(([stageName, stageResult]) => {
      if (stageResult?.executionTime) {
        executionTimes[stageName] = stageResult.executionTime;
      }
    });
    
    return executionTimes;
  }

  /**
   * Extract token usage metrics
   */
  extractTokenMetrics(result) {
    const metrics = result.metrics || {};
    return {
      totalTokens: this.calculateTotalTokens(result),
      analysisTokens: metrics.analysis?.totalTokens || 0,
      tokenSavingsPercentage: metrics.pipelineOptimization?.tokenSavingsPercentage || 0,
      bypassedLLM: metrics.pipelineOptimization?.bypassedLLM || 0
    };
  }

  /**
   * Extract opportunity processing metrics
   */
  extractOpportunityMetrics(result) {
    const metrics = result.metrics || {};
    return {
      totalOpportunities: metrics.pipelineOptimization?.totalOpportunities || 0,
      processedThroughLLM: metrics.pipelineOptimization?.processedThroughLLM || 0,
      newOpportunities: metrics.earlyDuplicateDetection?.newOpportunities || 0,
      duplicatesFound: metrics.earlyDuplicateDetection?.opportunitiesToUpdate + metrics.earlyDuplicateDetection?.opportunitiesToSkip || 0,
      directUpdates: metrics.directUpdate?.successful || 0,
      skipped: metrics.earlyDuplicateDetection?.opportunitiesToSkip || 0
    };
  }

  /**
   * Calculate total tokens used across all stages
   */
  calculateTotalTokens(result) {
    let totalTokens = 0;
    const stages = result.stages || {};
    
    Object.values(stages).forEach(stage => {
      if (stage?.metrics?.totalTokens) {
        totalTokens += stage.metrics.totalTokens;
      }
    });
    
    return totalTokens;
  }

  /**
   * Calculate performance improvements vs baseline
   */
  calculatePerformanceImprovements(result) {
    const metrics = result.metrics || {};
    
    return {
      tokenSavings: metrics.pipelineOptimization?.tokenSavingsPercentage || 0,
      timeImprovement: this.estimateTimeImprovement(result),
      opportunitiesOptimized: metrics.pipelineOptimization?.bypassedLLM || 0
    };
  }

  /**
   * Estimate time improvement based on bypassed processing
   */
  estimateTimeImprovement(result) {
    const bypassed = result.metrics?.pipelineOptimization?.bypassedLLM || 0;
    const total = result.metrics?.pipelineOptimization?.totalOpportunities || 1;
    
    // Estimate that each bypassed opportunity saves ~3-5 seconds of processing
    const estimatedSavingsPerOpportunity = 4000; // 4 seconds in ms
    const totalEstimatedSavings = bypassed * estimatedSavingsPerOpportunity;
    const actualTime = result.metrics?.totalExecutionTime || 0;
    const estimatedOriginalTime = actualTime + totalEstimatedSavings;
    
    return estimatedOriginalTime > 0 ? 
      Math.round((totalEstimatedSavings / estimatedOriginalTime) * 100) : 0;
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const runs = Object.values(this.metrics);
    if (runs.length === 0) {
      return { error: 'No metrics collected' };
    }
    
    return {
      totalRuns: runs.length,
      averageExecutionTime: this.calculateAverage(runs, 'totalExecutionTime'),
      averageTokenSavings: this.calculateAverage(runs, r => r.performanceImprovements.tokenSavings),
      averageTimeImprovement: this.calculateAverage(runs, r => r.performanceImprovements.timeImprovement),
      totalOpportunitiesProcessed: runs.reduce((sum, r) => sum + r.opportunityMetrics.totalOpportunities, 0),
      totalOpportunitiesOptimized: runs.reduce((sum, r) => sum + r.performanceImprovements.opportunitiesOptimized, 0),
      runs: runs
    };
  }

  /**
   * Calculate average of a metric across runs
   */
  calculateAverage(runs, metricAccessor) {
    if (runs.length === 0) return 0;
    
    const sum = runs.reduce((acc, run) => {
      const value = typeof metricAccessor === 'function' ? 
        metricAccessor(run) : 
        run[metricAccessor];
      return acc + (value || 0);
    }, 0);
    
    return Math.round(sum / runs.length);
  }
}

/**
 * Test Result Validator
 * Validates integration test results against expected outcomes
 */
export class TestResultValidator {
  constructor() {
    this.validations = [];
  }

  /**
   * Validate a complete integration test result
   */
  validateIntegrationTest(testName, result, expectedOutcome) {
    console.log(`🔍 Validating integration test: ${testName}`);
    
    const validation = {
      testName,
      timestamp: new Date().toISOString(),
      passed: true,
      issues: [],
      details: {}
    };

    // Basic result structure validation
    this.validateResultStructure(result, validation);
    
    // Pipeline execution validation
    this.validatePipelineExecution(result, validation);
    
    // Expected outcome validation
    this.validateExpectedOutcome(result, expectedOutcome, validation);
    
    // Performance validation
    this.validatePerformance(result, validation);
    
    this.validations.push(validation);
    
    console.log(`${validation.passed ? '✅' : '❌'} Test ${testName}: ${validation.passed ? 'PASSED' : 'FAILED'}`);
    if (validation.issues.length > 0) {
      validation.issues.forEach(issue => console.log(`  ⚠️ ${issue}`));
    }
    
    return validation;
  }

  /**
   * Validate basic result structure
   */
  validateResultStructure(result, validation) {
    const requiredFields = ['status', 'pipeline', 'stages', 'metrics'];
    
    for (const field of requiredFields) {
      if (!result[field]) {
        validation.passed = false;
        validation.issues.push(`Missing required field: ${field}`);
      }
    }
    
    if (result.status !== 'success') {
      validation.passed = false;
      validation.issues.push(`Pipeline failed with status: ${result.status}`);
    }
  }

  /**
   * Validate pipeline execution
   */
  validatePipelineExecution(result, validation) {
    const stages = result.stages || {};
    
    // Verify required stages executed
    const requiredStages = ['sourceOrchestrator', 'dataExtraction', 'earlyDuplicateDetector'];
    
    for (const stage of requiredStages) {
      if (!stages[stage]) {
        validation.passed = false;
        validation.issues.push(`Missing required stage: ${stage}`);
      }
    }
    
    // Verify stage results have expected structure
    Object.entries(stages).forEach(([stageName, stageResult]) => {
      if (!stageResult || typeof stageResult !== 'object') {
        validation.passed = false;
        validation.issues.push(`Invalid stage result for: ${stageName}`);
      }
    });
  }

  /**
   * Validate expected outcome
   */
  validateExpectedOutcome(result, expectedOutcome, validation) {
    if (!expectedOutcome) return;
    
    const pathValidator = new PipelinePathValidator();
    const pathValidation = pathValidator.validatePath(result, expectedOutcome.pathType);
    
    if (!pathValidation.isValid) {
      validation.passed = false;
      validation.issues.push(...pathValidation.issues);
    }
    
    validation.details.pathValidation = pathValidation;
  }

  /**
   * Validate performance metrics
   */
  validatePerformance(result, validation) {
    const metrics = result.metrics || {};
    
    // Check execution time is reasonable (less than 5 minutes)
    const maxExecutionTime = 5 * 60 * 1000; // 5 minutes
    if (metrics.totalExecutionTime > maxExecutionTime) {
      validation.passed = false;
      validation.issues.push(`Execution time too long: ${metrics.totalExecutionTime}ms`);
    }
    
    // Check token savings if duplicates were found
    const duplicates = metrics.pipelineOptimization?.bypassedLLM || 0;
    if (duplicates > 0 && (!metrics.pipelineOptimization?.tokenSavingsPercentage || metrics.pipelineOptimization.tokenSavingsPercentage < 10)) {
      validation.issues.push('Expected token savings not achieved with duplicates present');
    }
  }

  /**
   * Generate validation summary
   */
  generateSummary() {
    const total = this.validations.length;
    const passed = this.validations.filter(v => v.passed).length;
    const failed = total - passed;
    
    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      validations: this.validations
    };
  }
}

/**
 * Test timeout utility
 */
export function withTimeout(promise, timeoutMs = 60000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Test timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Utility to create mock opportunities for testing
 */
export function createMockOpportunities(type, count = 1) {
  const opportunities = [];
  
  for (let i = 0; i < count; i++) {
    const baseOpportunity = {
      id: `TEST-${type}-${String(i + 1).padStart(3, '0')}`,
      title: `Test ${type} Opportunity ${i + 1}`,
      description: `This is a test opportunity for ${type} path testing`,
      minimumAward: 10000 + (i * 1000),
      maximumAward: 50000 + (i * 5000),
      totalFundingAvailable: 100000 + (i * 10000),
      openDate: new Date().toISOString(),
      closeDate: new Date(Date.now() + (30 + i) * 24 * 60 * 60 * 1000).toISOString()
    };
    
    opportunities.push(baseOpportunity);
  }
  
  return opportunities;
}

export { PipelinePathValidator, PerformanceMetricsCollector, TestResultValidator };