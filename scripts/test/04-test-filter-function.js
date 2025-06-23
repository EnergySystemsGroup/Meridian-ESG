#!/usr/bin/env node

/**
 * Stage 4: Filter Function Testing with Real Analysis Results
 * 
 * Takes the enhanced opportunities from Stage 3 (AnalysisAgent) and
 * tests the FilterFunction to validate gating system logic.
 * 
 * Tests:
 * - Primary gating (clientProjectRelevance ≥ 2)
 * - Auto-qualification (clientProjectRelevance ≥ 5)
 * - Secondary filtering (status, funding attractiveness)
 * - Filtering metrics and logging
 */

import { runAnalysisAgentTests } from './03-test-analysis-agent.js';
import { filterOpportunities, getDefaultFilterConfig, createFilterConfig } from '../../app/lib/agents-v2/core/filterFunction.js';

/**
 * Display detailed information about a filtered opportunity
 */
function displayFilteredOpportunity(opportunity, index, sourceKey, status) {
  const statusIcon = status === 'included' ? '✅' : '❌';
  console.log(`\n${statusIcon} OPPORTUNITY #${index + 1} (${sourceKey}): ${status.toUpperCase()}`);
  console.log('─'.repeat(80));
  
  console.log(`🏷️  Title: ${opportunity.title}`);
  console.log(`💰 Funding: $${opportunity.totalFundingAvailable?.toLocaleString() || 'Unknown'} total`);
  console.log(`⏰ Deadline: ${opportunity.closeDate || 'Open-ended'}`);
  console.log(`📊 Status: ${opportunity.status || 'Unknown'}`);
  
  const scoring = opportunity.scoring || {};
  console.log(`\n📊 SCORING:`);
  console.log(`   Overall Score: ${scoring.overallScore || 0}/10`);
  console.log(`   Client/Project Relevance: ${scoring.clientProjectRelevance || 0}/6`);
  console.log(`   Funding Attractiveness: ${scoring.fundingAttractiveness || 0}/3`);
  console.log(`   Funding Type (Grant): ${scoring.fundingType || 0}/1`);
  
  // Determine filter reasoning
  let filterReason = '';
  if (status === 'excluded') {
    if ((scoring.clientProjectRelevance || 0) < 2) {
      filterReason = 'Failed primary gate (clientProjectRelevance < 2)';
    } else if (opportunity.status === 'closed') {
      filterReason = 'Opportunity is closed/expired';
    } else if ((scoring.fundingAttractiveness || 0) < 1) {
      filterReason = 'Low funding attractiveness (< 1)';
    } else {
      filterReason = 'Unknown exclusion reason';
    }
  } else {
    if ((scoring.clientProjectRelevance || 0) >= 5) {
      filterReason = 'Auto-qualified (clientProjectRelevance ≥ 5)';
    } else {
      filterReason = 'Passed secondary filtering';
    }
  }
  
  console.log(`🔍 Filter Reason: ${filterReason}`);
  
  if (opportunity.enhancedDescription) {
    const desc = opportunity.enhancedDescription.length > 200 
      ? opportunity.enhancedDescription.substring(0, 200) + '...'
      : opportunity.enhancedDescription;
    console.log(`\n💡 Enhanced Description: ${desc}`);
  }
}

/**
 * Test the FilterFunction with analysis results from a specific source
 */
async function testFilterFunction(sourceKey, analysisData, filterConfig = null) {
  const { opportunities, source, analysisMetrics } = analysisData;
  
  console.log(`\n🔍 TESTING FILTER FUNCTION: ${source.name}`);
  console.log('=' .repeat(70));
  console.log(`Input: ${opportunities.length} analyzed opportunities`);
  console.log(`Analysis Avg Score: ${analysisMetrics.averageScore}/10`);
  
  try {
    const startTime = Date.now();
    
    // Use provided config or default
    const config = filterConfig || getDefaultFilterConfig();
    console.log(`\n🛠️  Filter Configuration:`);
    console.log(`   Primary Gate: clientProjectRelevance ≥ ${config.minimumClientProjectRelevance}`);
    console.log(`   Auto-Qualify: clientProjectRelevance ≥ ${config.autoQualificationThreshold}`);
    console.log(`   Secondary: fundingAttractiveness ≥ ${config.minimumFundingAttractiveness}`);
    console.log(`   Exclude Closed: ${config.excludeClosedOpportunities}`);
    
    // Apply filter function
    console.log(`\n🔄 Running FilterFunction...`);
    const filterResult = filterOpportunities(opportunities, config);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`⏱️  Execution time: ${executionTime}ms`);
    console.log(`✅ Filtering completed successfully!\n`);
    
    // Display filtering metrics
    console.log('📊 FILTERING METRICS:');
    console.log('─'.repeat(40));
    
    const metrics = filterResult.filterMetrics;
    console.log(`Total Input: ${metrics.totalInput}`);
    console.log(`Included: ${metrics.totalIncluded} (${((metrics.totalIncluded/metrics.totalInput)*100).toFixed(1)}%)`);
    console.log(`Excluded: ${metrics.totalExcluded} (${((metrics.totalExcluded/metrics.totalInput)*100).toFixed(1)}%)`);
    
    console.log(`\nGating Metrics:`);
    console.log(`   Failed Primary Gate: ${metrics.gatingMetrics.failedPrimaryGate}`);
    console.log(`   Auto-Qualified: ${metrics.gatingMetrics.autoQualified}`);
    console.log(`   Secondary Filtered: ${metrics.gatingMetrics.secondaryFiltered}`);
    
    console.log(`\nExclusion Reasons:`);
    Object.entries(metrics.exclusionReasons).forEach(([reason, count]) => {
      if (count > 0) {
        console.log(`   ${reason}: ${count}`);
      }
    });
    
    // Display detailed results for first few opportunities
    console.log('\n🌟 DETAILED FILTERING RESULTS:');
    
    // Show included opportunities
    console.log('\n✅ INCLUDED OPPORTUNITIES:');
    filterResult.includedOpportunities.slice(0, 3).forEach((opp, index) => {
      displayFilteredOpportunity(opp, index, sourceKey, 'included');
    });
    
    if (filterResult.includedOpportunities.length > 3) {
      console.log(`\n   ... and ${filterResult.includedOpportunities.length - 3} more included opportunities`);
    }
    
    // Show excluded opportunities  
    console.log('\n❌ EXCLUDED OPPORTUNITIES:');
    filterResult.excludedOpportunities.slice(0, 3).forEach((opp, index) => {
      displayFilteredOpportunity(opp, index, sourceKey, 'excluded');
    });
    
    if (filterResult.excludedOpportunities.length > 3) {
      console.log(`\n   ... and ${filterResult.excludedOpportunities.length - 3} more excluded opportunities`);
    }
    
    console.log('\n🎯 VALIDATION:');
    console.log('─'.repeat(40));
    
    // Validate filter results
    const validations = {
      'Has Included Opportunities': filterResult.includedOpportunities.length > 0,
      'Has Filter Metrics': !!filterResult.filterMetrics,
      'Metrics Math Correct': (metrics.totalIncluded + metrics.totalExcluded) === metrics.totalInput,
      'All Included Have Valid Scores': filterResult.includedOpportunities.every(opp => 
        opp.scoring && typeof opp.scoring.clientProjectRelevance === 'number'
      ),
      'Primary Gate Logic Correct': filterResult.includedOpportunities.every(opp => 
        (opp.scoring.clientProjectRelevance || 0) >= config.minimumClientProjectRelevance
      ),
      'Auto-Qualification Logic Correct': filterResult.includedOpportunities.filter(opp => 
        (opp.scoring.clientProjectRelevance || 0) >= config.autoQualificationThreshold
      ).length === metrics.gatingMetrics.autoQualified,
      'Closed Opportunities Excluded': config.excludeClosedOpportunities ? 
        filterResult.includedOpportunities.every(opp => opp.status !== 'closed') : true,
      'Secondary Filter Logic Correct': filterResult.includedOpportunities.filter(opp => 
        (opp.scoring.clientProjectRelevance || 0) < config.autoQualificationThreshold
      ).every(opp => (opp.scoring.fundingAttractiveness || 0) >= config.minimumFundingAttractiveness),
      'Execution Time < 5s': executionTime < 5000,
      'Filter Rate Reasonable': (metrics.totalIncluded / metrics.totalInput) >= 0.1 && (metrics.totalIncluded / metrics.totalInput) <= 0.9
    };
    
    Object.entries(validations).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`   ${status} ${check}`);
    });
    
    const allPassed = Object.values(validations).every(v => v);
    console.log(`\n🎯 Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    return {
      success: allPassed,
      filterResult,
      executionTime,
      source,
      filterConfig: config
    };
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    console.log(`📍 Stack: ${error.stack}`);
    
    return {
      success: false,
      error: error.message,
      source: source
    };
  }
}

/**
 * Test different filter configurations
 */
async function testFilterConfigurations(sourceKey, analysisData) {
  console.log(`\n🔧 TESTING DIFFERENT FILTER CONFIGURATIONS: ${analysisData.source.name}`);
  console.log('=' .repeat(70));
  
  const configs = [
    {
      name: 'Default Config',
      config: getDefaultFilterConfig()
    },
    {
      name: 'Relaxed Config (Lower Thresholds)',
      config: createFilterConfig({
        minimumClientProjectRelevance: 1,
        minimumFundingAttractiveness: 0
      })
    },
    {
      name: 'Strict Config (Higher Thresholds)', 
      config: createFilterConfig({
        minimumClientProjectRelevance: 3,
        autoQualificationThreshold: 6,
        minimumFundingAttractiveness: 2
      })
    }
  ];
  
  const results = {};
  
  for (const { name, config } of configs) {
    console.log(`\n🔄 Testing ${name}...`);
    const result = await testFilterFunction(sourceKey, analysisData, config);
    results[name] = result;
  }
  
  // Compare configurations
  console.log('\n📊 CONFIGURATION COMPARISON:');
  console.log('─'.repeat(60));
  console.log('Config Name'.padEnd(30) + 'Included'.padEnd(12) + 'Rate'.padEnd(10) + 'Status');
  console.log('─'.repeat(60));
  
  Object.entries(results).forEach(([name, result]) => {
    if (result.success) {
      const metrics = result.filterResult.filterMetrics;
      const rate = ((metrics.totalIncluded / metrics.totalInput) * 100).toFixed(1);
      const status = result.success ? '✅' : '❌';
      console.log(`${name.padEnd(30)}${metrics.totalIncluded.toString().padEnd(12)}${rate}%`.padEnd(10) + status);
    } else {
      console.log(`${name.padEnd(30)}${'ERROR'.padEnd(12)}${''.padEnd(10)}❌`);
    }
  });
  
  return results;
}

async function runFilterFunctionTests() {
  console.log('🔍 STAGE 4: FilterFunction Testing with Real Analysis Data');
  console.log('=' .repeat(80));
  console.log('Testing opportunity filtering with results from Stage 3 (AnalysisAgent)\n');
  
  // First, get the analysis results from Stage 3
  console.log('🔄 Running Stage 3 to get analysis results...\n');
  const stage3Results = await runAnalysisAgentTests();
  
  if (!stage3Results || Object.values(stage3Results).filter(r => r.success).length === 0) {
    console.log('❌ Stage 3 failed - cannot proceed with filtering tests');
    return { success: false, error: 'Stage 3 dependency failed' };
  }
  
  console.log('\n🔄 Starting Stage 4 filtering tests...\n');
  
  const results = {};
  
  // Test each successful source from Stage 3
  for (const [sourceKey, stage3Result] of Object.entries(stage3Results)) {
    if (stage3Result.success) {
      const analysisData = {
        opportunities: stage3Result.result.opportunities,
        analysisMetrics: stage3Result.result.analysisMetrics,
        source: stage3Result.source
      };
      
      // Test default configuration
      results[sourceKey] = await testFilterFunction(sourceKey, analysisData);
      
      // Test different configurations
      const configResults = await testFilterConfigurations(sourceKey, analysisData);
      results[`${sourceKey}_configs`] = configResults;
    }
  }
  
  // Summary
  console.log('\n📊 STAGE 4 SUMMARY');
  console.log('=' .repeat(50));
  
  Object.entries(results).forEach(([sourceKey, result]) => {
    if (sourceKey.endsWith('_configs')) {
      return; // Skip config comparison results in main summary
    }
    
    const sourceInfo = sourceKey === 'california' ? 'California Grants Portal' : 'Grants.gov';
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const time = result.executionTime ? `(${result.executionTime}ms)` : '';
    
    if (result.success) {
      const metrics = result.filterResult.filterMetrics;
      const includeRate = ((metrics.totalIncluded / metrics.totalInput) * 100).toFixed(1);
      console.log(`${sourceInfo}: ${status} ${time} - ${metrics.totalIncluded}/${metrics.totalInput} included (${includeRate}%)`);
    } else {
      console.log(`${sourceInfo}: ${status} ${time} - ${result.error || 'Unknown error'}`);
    }
  });
  
  const successCount = Object.values(results).filter(r => r.success && !r.source).length;
  const totalSources = Object.keys(results).filter(k => !k.endsWith('_configs')).length;
  console.log(`\n🎯 Overall: ${successCount}/${totalSources} sources filtered successfully`);
  
  if (successCount > 0) {
    console.log('\n🎉 Stage 4 Complete! FilterFunction is working with real data');
    console.log('\n💾 Ready for Stage 5 (StorageAgent integration)');
  } else {
    console.log('\n⚠️  Filter function tests failed - fix issues before proceeding');
  }
  
  return {
    success: successCount > 0,
    results,
    totalSources,
    successCount
  };
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runFilterFunctionTests().catch(console.error);
}

export { runFilterFunctionTests }; 