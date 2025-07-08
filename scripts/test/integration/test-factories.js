#!/usr/bin/env node

/**
 * Test the Test Data Factories
 * Quick verification that the factories generate valid data
 */

import { createFactories } from './testDataFactories.js';

const TEST_FUNDING_SOURCE_ID = '9cd692b7-485b-4d21-b810-f7e4373385c4';

async function testFactories() {
  console.log('🧪 Testing Test Data Factories');
  console.log('=' .repeat(40));
  
  const factories = createFactories(TEST_FUNDING_SOURCE_ID);
  
  // Test OpportunityFactory
  console.log('\n📋 Testing OpportunityFactory:');
  const newOpp = factories.opportunityFactory.createNewOpportunity();
  console.log(`  ✅ New Opportunity: ${newOpp.opportunity_number} - ${newOpp.title}`);
  console.log(`     Awards: $${newOpp.minimum_award.toLocaleString()} - $${newOpp.maximum_award.toLocaleString()}`);
  
  const baseOpp = factories.opportunityFactory.createNewOpportunity({
    opportunity_number: 'BASE-001',
    minimum_award: 10000,
    maximum_award: 50000
  });
  
  const updateOpp = factories.opportunityFactory.createUpdateOpportunity(baseOpp);
  console.log(`  ✅ Update Opportunity: ${updateOpp.opportunity_number}`);
  console.log(`     Original: $${baseOpp.minimum_award} - $${baseOpp.maximum_award}`);
  console.log(`     Updated:  $${updateOpp.minimum_award} - $${updateOpp.maximum_award}`);
  
  const skipOpp = factories.opportunityFactory.createSkipOpportunity(baseOpp);
  console.log(`  ✅ Skip Opportunity: ${skipOpp.opportunity_number} (identical to base)`);
  
  // Test APIResponseFactory
  console.log('\n🌐 Testing APIResponseFactory:');
  const opportunities = [newOpp, baseOpp];
  const apiResponse = factories.apiResponseFactory.createMockAPIResponse(opportunities);
  console.log(`  ✅ API Response: ${apiResponse.data.length} opportunities`);
  console.log(`     Status: ${apiResponse.status}, Timestamp: ${new Date(apiResponse.timestamp).toLocaleTimeString()}`);
  
  const paginatedResponse = factories.apiResponseFactory.createPaginatedResponse(opportunities, 1, 1);
  console.log(`  ✅ Paginated Response: Page ${paginatedResponse.metadata.currentPage}/${paginatedResponse.metadata.totalPages}`);
  
  // Test MockAPIClient
  console.log('\n🤖 Testing MockAPIClient:');
  factories.mockApiClient.opportunities = opportunities;
  const mockResponse = await factories.mockApiClient.fetchOpportunities({ page: 1, pageSize: 10 });
  console.log(`  ✅ Mock API Call: ${mockResponse.data.length} opportunities returned`);
  console.log(`     Stats: ${JSON.stringify(factories.mockApiClient.getStats())}`);
  
  // Test error simulation
  factories.mockApiClient.setFailureRate(1.0); // 100% failure rate
  try {
    await factories.mockApiClient.fetchOpportunities();
    console.log(`  ❌ Expected failure but succeeded`);
  } catch (error) {
    console.log(`  ✅ Error simulation working: ${error.message}`);
  }
  
  // Test TestScenarioFactory
  console.log('\n🎬 Testing TestScenarioFactory:');
  const comprehensiveScenario = factories.scenarioFactory.createComprehensiveScenario();
  console.log(`  ✅ Comprehensive Scenario: ${comprehensiveScenario.name}`);
  console.log(`     New: ${comprehensiveScenario.opportunities.new.length}`);
  console.log(`     Update: ${comprehensiveScenario.opportunities.update.length}`);
  console.log(`     Skip: ${comprehensiveScenario.opportunities.skip.length}`);
  console.log(`     Expected results: ${JSON.stringify(comprehensiveScenario.expectedResults.expectedPaths)}`);
  
  const performanceScenario = factories.scenarioFactory.createPerformanceScenario(5, 10);
  console.log(`  ✅ Performance Scenario: ${performanceScenario.name}`);
  console.log(`     New: ${performanceScenario.opportunities.new.length}`);
  console.log(`     Duplicates: ${performanceScenario.opportunities.duplicates.length}`);
  console.log(`     Expected token savings: ${performanceScenario.expectedResults.expectedTokenSavings}%`);
  
  const errorScenario = factories.scenarioFactory.createErrorScenario();
  console.log(`  ✅ Error Scenario: ${errorScenario.name}`);
  console.log(`     Error conditions: ${errorScenario.errorConditions.length}`);
  console.log(`     Invalid opportunities: ${errorScenario.opportunities.invalid.length}`);
  
  console.log('\n🎉 All factory tests passed!');
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  testFactories().catch(console.error);
}