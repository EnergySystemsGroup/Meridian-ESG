#!/usr/bin/env node

/**
 * QUICK Analysis Agent Test - Tests 6 opportunities total (3 per source)
 * Avoids timeouts while validating the core functionality
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not found');
  process.exit(1);
}

import { enhanceOpportunities } from '../../app/lib/agents-v2/core/analysisAgent.js';
import { getAnthropicClient } from '../../app/lib/agents-v2/utils/anthropicClient.js';

const STAGE_2_RESULTS_PATH = path.join(process.cwd(), 'scripts', 'test', 'stage2-enhanced-results.json');

let STAGE_2_RESULTS;
try {
  const resultsData = fs.readFileSync(STAGE_2_RESULTS_PATH, 'utf8');
  STAGE_2_RESULTS = JSON.parse(resultsData);
  console.log(`📁 Loaded Stage 2 results`);
} catch (error) {
  console.error(`❌ Failed to load Stage 2 results: ${error.message}`);
  process.exit(1);
}

async function quickTest() {
  console.log('🚀 QUICK ANALYSIS AGENT TEST');
  console.log('=' .repeat(50));
  console.log('Testing with 9 opportunities per source (18 total) - Optimal Batch Size!\n');
  
  const anthropic = getAnthropicClient();
  
  // Test California (first 9 opportunities - optimal batch size)
  const californiaData = STAGE_2_RESULTS.results.california;
  const californiaQuick = {
    ...californiaData,
    opportunities: californiaData.opportunities.slice(0, 9)
  };
  
  console.log(`🧠 Testing California: 9 opportunities (optimal batch size)`);
  const startCalifornia = Date.now();
  const californiaResult = await enhanceOpportunities(californiaQuick.opportunities, californiaQuick.source, anthropic);
  const californiaTime = Date.now() - startCalifornia;
  console.log(`✅ California: ${californiaTime}ms (${(californiaTime/1000).toFixed(1)}s)`);
  console.log(`📊 Avg Score: ${californiaResult.analysisMetrics.averageScore}/10\n`);
  
  // Test Grants.gov (first 9 opportunities - optimal batch size)
  const grantsGovData = STAGE_2_RESULTS.results.grantsGov;
  const grantsGovQuick = {
    ...grantsGovData,
    opportunities: grantsGovData.opportunities.slice(0, 9)
  };
  
  console.log(`🧠 Testing Grants.gov: 9 opportunities (optimal batch size)`);
  const startGrantsGov = Date.now();
  const grantsGovResult = await enhanceOpportunities(grantsGovQuick.opportunities, grantsGovQuick.source, anthropic);
  const grantsGovTime = Date.now() - startGrantsGov;
  console.log(`✅ Grants.gov: ${grantsGovTime}ms (${(grantsGovTime/1000).toFixed(1)}s)`);
  console.log(`📊 Avg Score: ${grantsGovResult.analysisMetrics.averageScore}/10\n`);
  
  // Summary
  const totalTime = californiaTime + grantsGovTime;
  console.log('📊 QUICK TEST RESULTS:');
  console.log('─'.repeat(40));
  console.log(`California: ${(californiaTime/9000).toFixed(1)}s per opportunity`);
  console.log(`Grants.gov: ${(grantsGovTime/9000).toFixed(1)}s per opportunity`);
  console.log(`Total Time: ${(totalTime/1000).toFixed(1)}s for 18 opportunities`);
  console.log(`Average: ${(totalTime/18000).toFixed(1)}s per opportunity`);
  
  // Extrapolate full performance
  const fullTime = (totalTime / 18) * 20;
  console.log(`\n🎯 EXTRAPOLATED FULL PERFORMANCE:`);
  console.log(`Estimated 20 opportunities: ${(fullTime/1000).toFixed(1)}s (${(fullTime/60000).toFixed(1)} minutes)`);
  
  // Model info
  const modelConfig = anthropic.getModelConfig();
  console.log(`\n🤖 MODEL USED: ${modelConfig.name}`);
  console.log(`Max Output Tokens: ${modelConfig.maxOutputTokens.toLocaleString()}`);
  
  return { californiaResult, grantsGovResult, totalTime };
}

// Run quick test
if (import.meta.url === `file://${process.argv[1]}`) {
  quickTest().catch(console.error);
}

export { quickTest }; 