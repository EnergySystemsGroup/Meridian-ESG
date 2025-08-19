#!/usr/bin/env node

/**
 * Validate Test Improvements
 * 
 * Quick validation script to ensure our test improvements work correctly:
 * - Enhanced test data factories
 * - Path-specific test scenarios
 * - Metrics validation structure
 * - Performance baseline targets
 */

import { createFactories } from './integration/testDataFactories.js';

/**
 * Test Improvements Validator
 */
class TestImprovementsValidator {
  constructor() {
    this.results = [];
  }

  /**
   * Run all validation tests
   */
  async runValidation() {
    console.log('🧪 Validating Test Improvements');
    console.log('='.repeat(50));

    // Test 1: Enhanced Data Factories
    const factoriesTest = await this.testEnhancedDataFactories();
    this.results.push(factoriesTest);

    // Test 2: Multi-Path Scenarios
    const scenariosTest = await this.testMultiPathScenarios();
    this.results.push(scenariosTest);

    // Test 3: Metrics Validation Structure
    const metricsTest = await this.testMetricsValidationStructure();
    this.results.push(metricsTest);

    // Test 4: Performance Targets
    const performanceTest = await this.testPerformanceTargets();
    this.results.push(performanceTest);

    // Generate summary
    const summary = this.generateSummary();
    this.displayResults(summary);

    return summary;
  }

  /**
   * Test enhanced data factories
   */
  async testEnhancedDataFactories() {
    console.log('\n🔬 Testing Enhanced Data Factories...');
    
    try {
      const factories = createFactories('test-source-id');
      
      // Test opportunity factory
      const newOpp = factories.opportunityFactory.createNewOpportunity();
      const updateOpp = factories.opportunityFactory.createUpdateOpportunity(newOpp);
      const skipOpp = factories.opportunityFactory.createSkipOpportunity(newOpp);
      const staleOpp = factories.opportunityFactory.createStaleOpportunity(newOpp);

      // Validate structures
      const validations = [
        { name: 'NEW opportunity has api_opportunity_id', test: () => !!newOpp.api_opportunity_id },
        { name: 'UPDATE opportunity has modified amounts', test: () => updateOpp.minimum_award !== newOpp.minimum_award },
        { name: 'SKIP opportunity is identical', test: () => skipOpp.api_opportunity_id === newOpp.api_opportunity_id },
        { name: 'STALE opportunity has old timestamp', test: () => new Date(staleOpp.updated_at) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
      ];

      const passed = validations.filter(v => v.test()).length;
      const total = validations.length;

      console.log(`   ✅ OpportunityFactory: ${passed}/${total} validations passed`);

      // Test scenario factory
      const scenario = factories.scenarioFactory.createComprehensiveScenario();
      const hasAllPaths = !!(scenario.opportunities.new && scenario.opportunities.update && scenario.opportunities.skip);
      
      console.log(`   ✅ ScenarioFactory: ${hasAllPaths ? 'All paths' : 'Missing paths'} generated`);

      // Test mock API client
      const mockClient = factories.mockApiClient;
      mockClient.opportunities = [newOpp];
      const apiResponse = await mockClient.fetchOpportunities();
      
      console.log(`   ✅ MockAPIClient: ${apiResponse.data.length > 0 ? 'Working' : 'Failed'}`);

      return {
        success: passed === total && hasAllPaths && apiResponse.data.length > 0,
        testName: 'Enhanced Data Factories',
        details: `${passed}/${total} opportunity validations, scenario factory working, mock API working`
      };

    } catch (error) {
      console.log(`   ❌ Enhanced Data Factories test failed: ${error.message}`);
      return {
        success: false,
        testName: 'Enhanced Data Factories',
        error: error.message
      };
    }
  }

  /**
   * Test multi-path scenarios
   */
  async testMultiPathScenarios() {
    console.log('\n🔬 Testing Multi-Path Scenarios...');
    
    try {
      const factories = createFactories('test-source-id');
      
      // Test multi-path scenario
      const multiPathScenario = factories.scenarioFactory.createMultiPathScenario({
        newCount: 2,
        updateCount: 2,
        skipCount: 2,
        staleCount: 1
      });

      const validations = [
        { name: 'Has NEW opportunities', test: () => multiPathScenario.opportunities.new.length === 2 },
        { name: 'Has UPDATE opportunities', test: () => multiPathScenario.opportunities.update.length === 2 },
        { name: 'Has SKIP opportunities', test: () => multiPathScenario.opportunities.skip.length === 2 },
        { name: 'Has STALE opportunities', test: () => multiPathScenario.opportunities.stale.length === 1 },
        { name: 'Has database state', test: () => multiPathScenario.databaseState.existingOpportunities.length > 0 },
        { name: 'Has expected results', test: () => multiPathScenario.expectedResults.totalOpportunities === 7 },
        { name: 'Has required metrics', test: () => multiPathScenario.requiredMetrics.includes('pipeline_runs') }
      ];

      const passed = validations.filter(v => v.test()).length;
      const total = validations.length;

      console.log(`   ✅ Multi-Path Scenario: ${passed}/${total} validations passed`);

      // Test metrics validation scenario
      const metricsScenario = factories.scenarioFactory.createMetricsValidationScenario();
      const hasMetricsStructure = !!(metricsScenario.requiredMetrics && metricsScenario.performanceBenchmarks);
      
      console.log(`   ✅ Metrics Validation Scenario: ${hasMetricsStructure ? 'Complete' : 'Incomplete'}`);

      // Test edge case scenario
      const edgeScenario = factories.scenarioFactory.createEdgeCaseScenario();
      const hasEdgeCases = !!(edgeScenario.opportunities.invalid && edgeScenario.opportunities.boundary);
      
      console.log(`   ✅ Edge Case Scenario: ${hasEdgeCases ? 'Complete' : 'Incomplete'}`);

      return {
        success: passed === total && hasMetricsStructure && hasEdgeCases,
        testName: 'Multi-Path Scenarios',
        details: `${passed}/${total} scenario validations, metrics structure complete, edge cases complete`
      };

    } catch (error) {
      console.log(`   ❌ Multi-Path Scenarios test failed: ${error.message}`);
      return {
        success: false,
        testName: 'Multi-Path Scenarios',
        error: error.message
      };
    }
  }

  /**
   * Test metrics validation structure
   */
  async testMetricsValidationStructure() {
    console.log('\n🔬 Testing Metrics Validation Structure...');
    
    try {
      const factories = createFactories('test-source-id');
      const metricsScenario = factories.scenarioFactory.createMetricsValidationScenario();
      
      const requiredTables = ['pipeline_runs', 'pipeline_stages', 'opportunity_processing_paths', 'duplicate_detection_sessions'];
      const validations = [
        { name: 'Has pipeline_runs metrics', test: () => !!metricsScenario.requiredMetrics.pipeline_runs },
        { name: 'Has pipeline_stages metrics', test: () => !!metricsScenario.requiredMetrics.pipeline_stages },
        { name: 'Has opportunity_processing_paths metrics', test: () => !!metricsScenario.requiredMetrics.opportunity_processing_paths },
        { name: 'Has duplicate_detection_sessions metrics', test: () => !!metricsScenario.requiredMetrics.duplicate_detection_sessions },
        { name: 'Has performance benchmarks', test: () => !!metricsScenario.performanceBenchmarks },
        { name: 'Has token savings target', test: () => metricsScenario.performanceBenchmarks.tokenSavingsTarget >= 60 },
        { name: 'Has time improvement target', test: () => metricsScenario.performanceBenchmarks.timeImprovementTarget >= 60 },
        { name: 'Has efficiency score target', test: () => metricsScenario.performanceBenchmarks.efficiencyScoreTarget >= 70 }
      ];

      const passed = validations.filter(v => v.test()).length;
      const total = validations.length;

      console.log(`   ✅ Metrics Structure: ${passed}/${total} validations passed`);

      // Test validation queries
      const queries = factories.scenarioFactory.generateMetricsValidationQueries();
      const hasQueries = !!(queries.basicChecks && queries.integrityChecks && queries.performanceChecks && queries.analyticsQueries);
      
      console.log(`   ✅ Validation Queries: ${hasQueries ? 'Complete' : 'Incomplete'}`);

      return {
        success: passed === total && hasQueries,
        testName: 'Metrics Validation Structure',
        details: `${passed}/${total} metrics validations, validation queries complete`
      };

    } catch (error) {
      console.log(`   ❌ Metrics Validation Structure test failed: ${error.message}`);
      return {
        success: false,
        testName: 'Metrics Validation Structure',
        error: error.message
      };
    }
  }

  /**
   * Test performance targets
   */
  async testPerformanceTargets() {
    console.log('\n🔬 Testing Performance Targets...');
    
    try {
      const factories = createFactories('test-source-id');
      
      // Test performance scenario
      const perfScenario = factories.scenarioFactory.createPerformanceScenario({
        totalOpportunities: 100,
        duplicateRatio: 0.7
      });
      
      const validations = [
        { name: 'Has performance targets', test: () => !!perfScenario.performanceTargets },
        { name: 'Has max execution time', test: () => perfScenario.performanceTargets.maxExecutionTimeMs > 0 },
        { name: 'Has min token savings', test: () => perfScenario.performanceTargets.minTokenSavingsPercent >= 50 },
        { name: 'Has expected results', test: () => !!perfScenario.expectedResults },
        { name: 'Has correct opportunity count', test: () => perfScenario.expectedResults.totalOpportunities === 100 },
        { name: 'Has estimated savings', test: () => perfScenario.expectedResults.estimatedTokenSavings >= 60 }
      ];

      const passed = validations.filter(v => v.test()).length;
      const total = validations.length;

      console.log(`   ✅ Performance Targets: ${passed}/${total} validations passed`);

      return {
        success: passed === total,
        testName: 'Performance Targets',
        details: `${passed}/${total} performance validations`
      };

    } catch (error) {
      console.log(`   ❌ Performance Targets test failed: ${error.message}`);
      return {
        success: false,
        testName: 'Performance Targets',
        error: error.message
      };
    }
  }

  /**
   * Generate summary
   */
  generateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;

    return {
      total,
      passed,
      failed,
      successRate: Math.round((passed / total) * 100),
      results: this.results
    };
  }

  /**
   * Display results
   */
  displayResults(summary) {
    console.log('\n📊 Test Improvements Validation Summary');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Success Rate: ${summary.successRate}%`);

    if (summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      summary.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.testName}: ${r.error || 'Failed validation'}`));
    }

    if (summary.passed === summary.total) {
      console.log('\n🎉 All test improvements are working correctly!');
      console.log('✅ Enhanced data factories: Ready for use');
      console.log('✅ Path-specific scenarios: Complete');
      console.log('✅ Metrics validation: Structured');
      console.log('✅ Performance targets: Defined');
    } else {
      console.log('\n⚠️ Some test improvements need attention.');
    }
  }
}

/**
 * Main execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new TestImprovementsValidator();
  
  validator.runValidation()
    .then(summary => {
      if (summary.passed === summary.total) {
        console.log('\n🎯 Test improvements validation complete!');
        process.exit(0);
      } else {
        console.log('\n❌ Test improvements validation failed.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

export { TestImprovementsValidator };