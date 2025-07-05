#!/usr/bin/env node

/**
 * Stage 3: AnalysisAgent Testing with Real Data
 * 
 * Uses the extracted opportunities from Stage 2 (DataExtractionAgent) to test the AnalysisAgent:
 * - Content enhancement (descriptions and actionable summaries)
 * - Systematic scoring (project match, client match, funding criteria)
 * - Scoring validation and metrics calculation
 * 
 * This tests AI-powered content enhancement and objective scoring algorithms.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Verify API key is loaded
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
  process.exit(1);
}

import { enhanceOpportunities } from '../../app/lib/agents-v2/core/analysisAgent/index.js';
import { getAnthropicClient } from '../../app/lib/agents-v2/utils/anthropicClient.js';

// Load fresh Stage 2 results from the enhanced results file
const STAGE_2_RESULTS_PATH = path.join(process.cwd(), 'scripts', 'test', 'stage2-enhanced-results.json');

let STAGE_2_RESULTS;
try {
  const resultsData = fs.readFileSync(STAGE_2_RESULTS_PATH, 'utf8');
  STAGE_2_RESULTS = JSON.parse(resultsData);
  console.log(`📁 Loaded fresh Stage 2 results from: ${STAGE_2_RESULTS_PATH}`);
  console.log(`📅 Results timestamp: ${STAGE_2_RESULTS.timestamp}`);
  
  // Show data summary
  const californiaCount = STAGE_2_RESULTS.results.california?.opportunities?.length || 0;
  const grantsGovCount = STAGE_2_RESULTS.results.grantsGov?.opportunities?.length || 0;
  console.log(`📊 California opportunities: ${californiaCount}`);
  console.log(`📊 Grants.gov opportunities: ${grantsGovCount}`);
  console.log(`📊 Total opportunities to analyze: ${californiaCount + grantsGovCount}\n`);
  
} catch (error) {
  console.error(`❌ Failed to load Stage 2 results from ${STAGE_2_RESULTS_PATH}`);
  console.error(`💡 Make sure to run Stage 2 tests first: node scripts/test/02-test-data-extraction-agent.js`);
  console.error(`📍 Error: ${error.message}`);
  process.exit(1);
}

/**
 * Analyze and display enhanced opportunity details
 */
function displayEnhancedOpportunity(opportunity, index, sourceKey) {
  console.log(`\n📄 ENHANCED OPPORTUNITY ${index + 1} - ${sourceKey.toUpperCase()}`);
  console.log('─'.repeat(80));
  
  console.log(`🏷️  Title: ${opportunity.title}`);
  console.log(`💰 Funding: $${opportunity.totalFundingAvailable?.toLocaleString() || 'Unknown'} total`);
  console.log(`   Per Award: $${opportunity.minimumAward?.toLocaleString() || 'Unknown'} - $${opportunity.maximumAward?.toLocaleString() || 'Unknown'}`);
  console.log(`⏰ Deadline: ${opportunity.closeDate || 'Open-ended'}`);
  
  console.log(`\n📊 SCORING BREAKDOWN:`);
  const scoring = opportunity.scoring || {};
  const clientProjectRelevance = (scoring.clientRelevance || 0) + (scoring.projectRelevance || 0);
  console.log(`   Overall Score: ${scoring.overallScore || 0}/10`);
  console.log(`   Client/Project Relevance: ${clientProjectRelevance}/6 (Client: ${scoring.clientRelevance || 0}/3, Project: ${scoring.projectRelevance || 0}/3)`);
  console.log(`   Funding Attractiveness: ${scoring.fundingAttractiveness || 0}/3`);
  console.log(`   Funding Type (Grant): ${scoring.fundingType || 0}/1`);
  
  console.log(`\n💡 ENHANCED DESCRIPTION:`);
  console.log(`${opportunity.enhancedDescription || 'No enhanced description available'}`);
  
  console.log(`\n🎯 ACTIONABLE SUMMARY:`);
  console.log(`${opportunity.actionableSummary || 'No actionable summary available'}`);
  
  console.log(`\n🔍 SCORING EXPLANATION:`);
  console.log(opportunity.relevanceReasoning || 'No explanation available');
  
  if (opportunity.concerns && opportunity.concerns.length > 0) {
    console.log(`\n⚠️  CONCERNS:`);
    opportunity.concerns.forEach(concern => {
      console.log(`   • ${concern}`);
    });
  }
}

/**
 * Test the AnalysisAgent with a specific set of opportunities
 */
async function testAnalysisAgent(sourceKey, testData) {
  const { opportunities, source } = testData;
  
  console.log(`\n🧠 TESTING ANALYSIS AGENT: ${source.name}`);
  console.log('=' .repeat(70));
  console.log(`Input: ${opportunities.length} extracted opportunities`);
  
  try {
    const startTime = Date.now();
    const anthropic = getAnthropicClient();
    
    // Call AnalysisAgent
    console.log(`\n🔄 Running AnalysisAgent...`);
    const result = await enhanceOpportunities(opportunities, source, anthropic);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`⏱️  Execution time: ${executionTime}ms`);
    console.log(`✅ Analysis completed successfully!\n`);
    
    // Display results
    console.log('📊 ANALYSIS METRICS:');
    console.log('─'.repeat(40));
    
    const metrics = result.analysisMetrics;
    console.log(`Total Analyzed: ${metrics.totalAnalyzed}`);
    console.log(`Average Score: ${metrics.averageScore}/10`);
    console.log(`Score Distribution:`);
    console.log(`   High (7-10): ${metrics.scoreDistribution.high} opportunities`);
    console.log(`   Medium (4-6): ${metrics.scoreDistribution.medium} opportunities`);
    console.log(`   Low (0-3): ${metrics.scoreDistribution.low} opportunities`);
    console.log(`Meets Funding Threshold: ${metrics.meetsFundingThreshold} opportunities`);
    console.log(`Grant Funding: ${metrics.grantFunding} opportunities`);
    
    // Display enhanced opportunities
    if (result.opportunities && result.opportunities.length > 0) {
      console.log('\n🌟 ENHANCED OPPORTUNITIES:');
      result.opportunities.forEach((opp, index) => {
        displayEnhancedOpportunity(opp, index, sourceKey);
      });
    }
    
    console.log('\n🎯 VALIDATION:');
    console.log('─'.repeat(40));
    
    // Validate analysis results
    const validations = {
      'Has Enhanced Opportunities': result.opportunities && result.opportunities.length > 0,
      'Has Analysis Metrics': !!result.analysisMetrics,
      'All Opportunities Have Scores': result.opportunities.every(opp => !!opp.scoring && typeof opp.scoring.overallScore === 'number'),
      'All Opportunities Have Enhanced Descriptions': result.opportunities.every(opp => !!opp.enhancedDescription),
      'All Opportunities Have Actionable Summaries': result.opportunities.every(opp => !!opp.actionableSummary),
      'All Opportunities Have Relevance Reasoning': result.opportunities.every(opp => !!opp.relevanceReasoning),
      'Scores Are Valid (0-10)': result.opportunities.every(opp => 
        opp.scoring && opp.scoring.overallScore >= 0 && opp.scoring.overallScore <= 10
      ),
      'Client/Project Relevance Valid (0-6)': result.opportunities.every(opp => {
        if (!opp.scoring) return false;
        const clientProjectRelevance = (opp.scoring.clientRelevance || 0) + (opp.scoring.projectRelevance || 0);
        return clientProjectRelevance >= 0 && clientProjectRelevance <= 6;
      }),
      'Funding Attractiveness Valid (0-3)': result.opportunities.every(opp => 
        opp.scoring && opp.scoring.fundingAttractiveness >= 0 && opp.scoring.fundingAttractiveness <= 3
      ),
      'Funding Type Valid (0-1)': result.opportunities.every(opp => 
        opp.scoring && opp.scoring.fundingType >= 0 && opp.scoring.fundingType <= 1
      ),
      'Execution Time < 120s': executionTime < 120000,
      'Average Score Calculated': typeof metrics.averageScore === 'number',
      'Score Distribution Totals Match': (metrics.scoreDistribution.high + metrics.scoreDistribution.medium + metrics.scoreDistribution.low) === metrics.totalAnalyzed
    };
    
    Object.entries(validations).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`   ${status} ${check}`);
    });
    
    const allPassed = Object.values(validations).every(v => v);
    console.log(`\n🎯 Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    return {
      success: allPassed,
      result,
      executionTime,
      source
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

async function runAnalysisAgentTests() {
  console.log('🧠 STAGE 3: AnalysisAgent Testing with Real Data');
  console.log('=' .repeat(80));
  console.log('Testing content enhancement and systematic scoring with Stage 2 results\n');
  
  const results = {};
  
  // Test 1: California opportunities (full dataset)
  results.california = await testAnalysisAgent('california', STAGE_2_RESULTS.results.california);
  
  // Test 2: Grants.gov opportunities (full dataset)  
  console.log('\n🔄 Starting Grants.gov analysis...\n');
  results.grantsGov = await testAnalysisAgent('grantsGov', STAGE_2_RESULTS.results.grantsGov);
  
  // Summary
  console.log('\n📊 STAGE 3 SUMMARY');
  console.log('=' .repeat(50));
  
  Object.entries(results).forEach(([sourceKey, result]) => {
    const sourceInfo = sourceKey === 'california' ? 'California Grants Portal' : 'Grants.gov';
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const time = result.executionTime ? `(${result.executionTime}ms)` : '';
    const oppCount = result.result?.opportunities?.length || 0;
    const avgScore = result.result?.analysisMetrics?.averageScore || 0;
    console.log(`${sourceInfo}: ${status} ${time} - ${oppCount} opportunities analyzed (avg: ${avgScore}/10)`);
  });
  
  const successCount = Object.values(results).filter(r => r.success).length;
  console.log(`\n🎯 Overall: ${successCount}/2 sources analyzed successfully`);
  
  if (successCount === 2) {
    console.log('\n🎉 Stage 3 Complete! Ready for Stage 4 (FilterFunction)');
    console.log('\n💾 Preparing results for next stage...');
    
    // Prepare results for Stage 4 (FilterFunction)
    const stage3Results = {
      timestamp: new Date().toISOString(),
      results: Object.fromEntries(
        Object.entries(results)
          .filter(([_, result]) => result.success)
          .map(([key, result]) => [key, {
            opportunities: result.result.opportunities,
            analysisMetrics: result.result.analysisMetrics,
            source: result.source
          }])
      )
    };
    
    console.log('\n📄 Sample Results for Stage 4:');
    Object.entries(stage3Results.results).forEach(([key, data]) => {
      const avgScore = data.analysisMetrics.averageScore;
      const highScore = data.analysisMetrics.scoreDistribution.high;
      console.log(`${key}: ${data.opportunities.length} opportunities analyzed (avg: ${avgScore}/10, ${highScore} high-scoring)`);
    });
    
  } else {
    console.log('\n⚠️  Some analyses failed - fix issues before proceeding to Stage 4');
  }
  
  return results;
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runAnalysisAgentTests().catch(console.error);
}

export { runAnalysisAgentTests }; 