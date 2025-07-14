#!/usr/bin/env node

/**
 * Stage 4: Filter Function Testing with Static Analysis Results
 * 
 * Tests the simplified FilterFunction using pre-generated analysis results from stage3-analysis-results.json
 * This allows for fast, independent testing without LLM calls.
 * 
 * New Logic: Exclude if 2 out of 3 core categories (clientRelevance, projectRelevance, fundingAttractiveness) are 0
 * 
 * Tests:
 * - Core "2 out of 3 zeros" exclusion logic
 * - Filtering metrics and logging
 * - Edge cases and validation
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { filterOpportunities, getDefaultFilterConfig, createFilterConfig } from '../../lib/agents-v2/core/filterFunction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load static analysis results from JSON file
 */
function loadAnalysisResults() {
  try {
    const filePath = join(__dirname, 'stage3-analysis-results.json');
    const rawData = readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);
    return data.results;
  } catch (error) {
    console.error('❌ Failed to load analysis results:', error.message);
    return null;
  }
}

/**
 * Test the filter function with default configuration
 */
async function testFilterFunction(sourceKey, analysisData) {
  console.log(`\n🔍 Testing Filter Function: ${sourceKey}`);
  console.log(`📊 Input: ${analysisData.opportunities.length} opportunities`);
  
  const startTime = Date.now();
  
  try {
    const filterResult = await filterOpportunities(analysisData.opportunities);
    const endTime = Date.now();
    
    if (!filterResult.success) {
      throw new Error(filterResult.error || 'Filter function failed');
    }
    
    const metrics = filterResult.filterMetrics;
    console.log(`✅ Filter completed in ${endTime - startTime}ms`);
    console.log(`📊 Results:`);
    console.log(`   • Total analyzed: ${metrics.totalAnalyzed}`);
    console.log(`   • Included: ${metrics.included} (${((metrics.included/metrics.totalAnalyzed)*100).toFixed(1)}%)`);
    console.log(`   • Excluded: ${metrics.excluded} (${((metrics.excluded/metrics.totalAnalyzed)*100).toFixed(1)}%)`);
    
    console.log(`\n📋 Exclusion Breakdown:`);
    console.log(`   • Two zero categories: ${metrics.exclusionReasons.twoZeroCategories}`);
    console.log(`   • Missing scoring: ${metrics.exclusionReasons.missingScoring}`);
    
    // Validate filter results
    const validations = validateFilterResults(filterResult);
    
    return {
      success: true,
      filterResult,
      processingTime: endTime - startTime,
      validations
    };
    
  } catch (error) {
    console.error(`❌ Filter function failed:`, error.message);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Validate filter results
 */
function validateFilterResults(filterResult) {
  const metrics = filterResult.filterMetrics;
  
  const validations = {
    'Has Included Opportunities': filterResult.includedOpportunities.length >= 0,
    'Has Filter Metrics': !!filterResult.filterMetrics,
    'Metrics Math Correct': (metrics.included + metrics.excluded) === metrics.totalAnalyzed,
    'All Included Have Valid Scores': filterResult.includedOpportunities.every(opp => 
      opp.scoring && typeof opp.scoring.clientRelevance === 'number'
    ),
    'Two Zero Logic Correct': validateTwoZeroLogic(filterResult),
    'Processing Time Reasonable': filterResult.processingTime < 5000 // Should be under 5 seconds
  };
  
  console.log(`\n✅ Validation Results:`);
  Object.entries(validations).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    console.log(`   ${status} ${test}`);
  });
  
  const allPassed = Object.values(validations).every(v => v);
  console.log(`\n${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'All validations passed' : 'Some validations failed'}`);
  
  return validations;
}

/**
 * Validate the "2 out of 3 zeros" logic
 */
function validateTwoZeroLogic(filterResult) {
  const { includedOpportunities, excludedOpportunities } = filterResult;
  
  // Check included opportunities - should have 0 or 1 zero in core categories
  const invalidIncluded = includedOpportunities.filter(opp => {
    const scoring = opp.scoring;
    const coreCategories = [
      scoring.clientRelevance || 0,
      scoring.projectRelevance || 0,
      scoring.fundingAttractiveness || 0
    ];
    const zeroCount = coreCategories.filter(score => score === 0).length;
    return zeroCount >= 2; // Should not be included if 2+ zeros
  });
  
  // Check excluded opportunities - those excluded for "twoZeroCategories" should have 2+ zeros
  const invalidExcluded = excludedOpportunities.filter(opp => {
    if (opp.exclusionReason && opp.exclusionReason.includes('2 out of 3 core categories scored 0')) {
      const scoring = opp.scoring;
      const coreCategories = [
        scoring.clientRelevance || 0,
        scoring.projectRelevance || 0,
        scoring.fundingAttractiveness || 0
      ];
      const zeroCount = coreCategories.filter(score => score === 0).length;
      return zeroCount < 2; // Should not be excluded if less than 2 zeros
    }
    return false;
  });
  
  if (invalidIncluded.length > 0) {
    console.log(`   ❌ Found ${invalidIncluded.length} included opportunities with 2+ zero categories`);
  }
  
  if (invalidExcluded.length > 0) {
    console.log(`   ❌ Found ${invalidExcluded.length} excluded opportunities with <2 zero categories`);
  }
  
  return invalidIncluded.length === 0 && invalidExcluded.length === 0;
}

/**
 * Test different filter configurations
 */
async function testFilterConfigurations(sourceKey, analysisData) {
  console.log(`\n🔧 Testing Filter Configurations: ${sourceKey}`);
  
  const configs = {
    'Default': getDefaultFilterConfig(),
    'No Logging': createFilterConfig({ enableLogging: false })
  };
  
  const results = {};
  
  for (const [configName, config] of Object.entries(configs)) {
    try {
      const result = await filterOpportunities(analysisData.opportunities, config);
      results[configName] = {
        success: true,
        included: result.filterMetrics.included,
        excluded: result.filterMetrics.excluded,
        processingTime: result.processingTime
      };
    } catch (error) {
      results[configName] = {
        success: false,
        error: error.message
      };
    }
  }
  
  console.log('\n📊 Configuration Comparison:');
  console.log('Config Name'.padEnd(25) + 'Included'.padEnd(12) + 'Rate'.padEnd(10) + 'Status');
  console.log('-'.repeat(55));
  
  Object.entries(results).forEach(([name, result]) => {
    if (result.success) {
      const total = result.included + result.excluded;
      const rate = total > 0 ? ((result.included / total) * 100).toFixed(1) : '0.0';
      const status = result.success ? '✅' : '❌';
      console.log(`${name.padEnd(25)}${result.included.toString().padEnd(12)}${rate}%`.padEnd(10) + status);
    } else {
      console.log(`${name.padEnd(25)}${'ERROR'.padEnd(12)}${''.padEnd(10)}❌`);
    }
  });
  
  return results;
}

/**
 * Main test execution
 */
async function main() {
  console.log('🚀 Starting Filter Function Tests (Stage 4)');
  console.log('=' .repeat(60));
  
  // Load analysis results
  const analysisResults = loadAnalysisResults();
  
  if (!analysisResults || Object.keys(analysisResults).length === 0) {
    console.log('❌ Analysis results empty - cannot proceed with filtering tests');
    return { success: false, error: 'Analysis results dependency failed' };
  }
  
  console.log(`✅ Loaded analysis results for ${Object.keys(analysisResults).length} sources`);
  
  const results = {};
  
  try {
    // Test each source from the JSON file
    for (const [sourceKey, analysisData] of Object.entries(analysisResults)) {
      // Test default configuration
      results[sourceKey] = await testFilterFunction(sourceKey, analysisData);
      
      // Test different configurations
      const configResults = await testFilterConfigurations(sourceKey, analysisData);
      results[`${sourceKey}_configs`] = configResults;
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 FILTER FUNCTION TEST SUMMARY');
    console.log('='.repeat(60));
    
    Object.entries(results).forEach(([sourceKey, result]) => {
      if (!sourceKey.includes('_configs')) {
        const time = result.processingTime ? `${result.processingTime}ms` : 'N/A';
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        const sourceInfo = sourceKey.charAt(0).toUpperCase() + sourceKey.slice(1);
        
        if (result.success) {
          const metrics = result.filterResult.filterMetrics;
          const includeRate = ((metrics.included / metrics.totalAnalyzed) * 100).toFixed(1);
          console.log(`${sourceInfo}: ${status} ${time} - ${metrics.included}/${metrics.totalAnalyzed} included (${includeRate}%)`);
        } else {
          console.log(`${sourceInfo}: ${status} ${time} - ${result.error || 'Unknown error'}`);
        }
      }
    });
    
    const allPassed = Object.values(results)
      .filter(r => !r.hasOwnProperty('Default')) // Skip config test results
      .every(r => r.success);
    
    console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'));
    
    return { success: allPassed, results };
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return { success: false, error: error.message };
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as testFilterFunction }; 