/**
 * Jest Test Sequencer for CI
 * Optimizes test execution order for faster feedback
 */

const Sequencer = require('@jest/test-sequencer').default;
const fs = require('fs');
const path = require('path');

class CustomSequencer extends Sequencer {
  /**
   * Sort test files for optimal execution order
   */
  sort(tests) {
    // Load timing data if available
    const timingData = this.loadTimingData();
    
    // Categorize tests
    const categorizedTests = this.categorizeTests(tests);
    
    // Sort within each category
    const sortedCategories = {
      critical: this.sortByPriority(categorizedTests.critical, timingData),
      fast: this.sortByDuration(categorizedTests.fast, timingData, true),
      normal: this.sortByDuration(categorizedTests.normal, timingData),
      slow: this.sortByDuration(categorizedTests.slow, timingData),
      flaky: this.sortByFailureRate(categorizedTests.flaky, timingData),
    };
    
    // Combine in optimal order:
    // 1. Critical tests first (fail fast)
    // 2. Fast tests (quick feedback)
    // 3. Normal tests
    // 4. Slow tests
    // 5. Flaky tests last
    return [
      ...sortedCategories.critical,
      ...sortedCategories.fast,
      ...sortedCategories.normal,
      ...sortedCategories.slow,
      ...sortedCategories.flaky,
    ];
  }

  /**
   * Get shard of tests for parallel execution
   */
  shard(tests, options) {
    const { shardIndex, shardCount } = options;
    
    if (!shardIndex || !shardCount) {
      return tests;
    }
    
    // Sort tests first
    const sortedTests = this.sort(tests);
    
    // Distribute tests evenly across shards
    const shardSize = Math.ceil(sortedTests.length / shardCount);
    const start = (shardIndex - 1) * shardSize;
    const end = start + shardSize;
    
    return sortedTests.slice(start, end);
  }

  /**
   * Categorize tests based on patterns and history
   */
  categorizeTests(tests) {
    const categories = {
      critical: [],
      fast: [],
      normal: [],
      slow: [],
      flaky: [],
    };
    
    const flakyPatterns = this.loadFlakyPatterns();
    
    for (const test of tests) {
      const testPath = test.path;
      
      // Check if test is marked as flaky
      if (this.isFlaky(testPath, flakyPatterns)) {
        categories.flaky.push(test);
        continue;
      }
      
      // Critical tests (auth, payments, core functionality)
      if (this.isCritical(testPath)) {
        categories.critical.push(test);
        continue;
      }
      
      // Categorize by expected duration
      const category = this.categorizeByDuration(testPath);
      categories[category].push(test);
    }
    
    return categories;
  }

  /**
   * Check if test is critical
   */
  isCritical(testPath) {
    const criticalPatterns = [
      /auth/i,
      /payment/i,
      /security/i,
      /core/i,
      /api.*critical/i,
    ];
    
    return criticalPatterns.some(pattern => pattern.test(testPath));
  }

  /**
   * Check if test is flaky
   */
  isFlaky(testPath, flakyPatterns) {
    return flakyPatterns.some(pattern => {
      if (typeof pattern === 'string') {
        return testPath.includes(pattern);
      }
      return pattern.test(testPath);
    });
  }

  /**
   * Categorize test by expected duration
   */
  categorizeByDuration(testPath) {
    // Fast tests (< 1s expected)
    if (testPath.includes('unit') && !testPath.includes('heavy')) {
      return 'fast';
    }
    
    // Slow tests (> 5s expected)
    if (
      testPath.includes('e2e') ||
      testPath.includes('integration') ||
      testPath.includes('database')
    ) {
      return 'slow';
    }
    
    // Normal tests
    return 'normal';
  }

  /**
   * Sort tests by priority (critical tests that often fail)
   */
  sortByPriority(tests, timingData) {
    return tests.sort((a, b) => {
      const aFailRate = this.getFailureRate(a.path, timingData);
      const bFailRate = this.getFailureRate(b.path, timingData);
      
      // Tests that fail more often run first
      return bFailRate - aFailRate;
    });
  }

  /**
   * Sort tests by duration
   */
  sortByDuration(tests, timingData, ascending = false) {
    return tests.sort((a, b) => {
      const aDuration = this.getAverageDuration(a.path, timingData);
      const bDuration = this.getAverageDuration(b.path, timingData);
      
      return ascending ? aDuration - bDuration : bDuration - aDuration;
    });
  }

  /**
   * Sort tests by failure rate
   */
  sortByFailureRate(tests, timingData) {
    return tests.sort((a, b) => {
      const aRate = this.getFailureRate(a.path, timingData);
      const bRate = this.getFailureRate(b.path, timingData);
      
      // More stable tests run first
      return aRate - bRate;
    });
  }

  /**
   * Get average test duration from timing data
   */
  getAverageDuration(testPath, timingData) {
    if (timingData[testPath]?.averageTime) {
      return timingData[testPath].averageTime;
    }
    
    // Estimate based on file size
    try {
      const stats = fs.statSync(testPath);
      return stats.size / 10; // Rough estimate
    } catch {
      return 1000; // Default 1 second
    }
  }

  /**
   * Get test failure rate from timing data
   */
  getFailureRate(testPath, timingData) {
    if (timingData[testPath]?.failureRate) {
      return timingData[testPath].failureRate;
    }
    return 0; // Default: no failures
  }

  /**
   * Load timing data from previous runs
   */
  loadTimingData() {
    const timingFile = path.join(process.cwd(), '.test-timings.json');
    
    try {
      if (fs.existsSync(timingFile)) {
        return JSON.parse(fs.readFileSync(timingFile, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load timing data:', error.message);
    }
    
    return {};
  }

  /**
   * Load patterns for flaky tests
   */
  loadFlakyPatterns() {
    const flakyFile = path.join(process.cwd(), '.flaky-tests.json');
    
    try {
      if (fs.existsSync(flakyFile)) {
        const data = JSON.parse(fs.readFileSync(flakyFile, 'utf8'));
        return data.patterns || [];
      }
    } catch (error) {
      console.warn('Could not load flaky test patterns:', error.message);
    }
    
    // Default flaky patterns
    return [
      /\.flaky\.test\./,
      /temporal/i,
      /timing/i,
    ];
  }
}

module.exports = CustomSequencer;