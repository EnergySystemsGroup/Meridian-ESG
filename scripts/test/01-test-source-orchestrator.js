#!/usr/bin/env node

/**
 * Stage 1: SourceOrchestrator Testing with Real Data
 * 
 * Tests the SourceOrchestrator agent with actual database sources:
 * 1. California Grants Portal (one-step API)
 * 2. Grants.gov (two-step API)
 * 
 * This will give us the source analysis results to feed into Stage 2.
 */

import { analyzeSource } from '../../app/lib/agents-v2/core/sourceOrchestrator.js';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../.env.local' });

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Our real sources from database
const TEST_SOURCES = {
  californiaGrants: {
    id: '68000a0d-02f3-4bc8-93a5-53fcf2fb09b1',
    name: 'California Grants Portal',
    type: 'one-step API'
  },
  grantsGov: {
    id: '7767eedc-8a09-4058-8837-fc8df8e437cb', 
    name: 'Grants.gov',
    type: 'two-step API'
  }
};

async function fetchSourceFromDatabase(sourceId) {
  console.log(`📡 Fetching source ${sourceId} from database...`);
  
  // Get the source
  const { data: source, error } = await supabase
    .from('api_sources')
    .select('*')
    .eq('id', sourceId)
    .single();
    
  if (error) {
    throw new Error(`Failed to fetch source: ${error.message}`);
  }
  
  // Get the source configurations
  const { data: configurations, error: configError } = await supabase
    .from('api_source_configurations')
    .select('*')
    .eq('source_id', sourceId);

  if (configError) {
    throw new Error(`Failed to fetch configurations: ${configError.message}`);
  }

  // Group configurations by type
  const configObject = {};
  configurations.forEach((config) => {
    configObject[config.config_type] = config.configuration;
  });

  // Add configurations to the source
  source.configurations = configObject;
  
  console.log(`✅ Source fetched: ${source.name} with ${configurations.length} configurations`);
  return source;
}

async function testSourceOrchestrator(sourceKey, sourceInfo) {
  console.log(`\n🎯 TESTING: ${sourceInfo.name} (${sourceInfo.type})`);
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Fetch real source from database
    const source = await fetchSourceFromDatabase(sourceInfo.id);
    
    // Step 2: Analyze with SourceOrchestrator
    console.log(`\n🧠 Running SourceOrchestrator analysis...`);
    const startTime = Date.now();
    
    const analysis = await analyzeSource(source, anthropic);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`⏱️  Execution time: ${executionTime}ms`);
    console.log(`✅ Analysis completed successfully!\n`);
    
    // Step 3: Display results
    console.log('📋 ANALYSIS RESULTS:');
    console.log('─'.repeat(40));
    
    console.log('🔧 API Configuration:');
    console.log(`   Endpoint: ${analysis.apiEndpoint || 'N/A'}`);
    console.log(`   Method: ${analysis.requestConfig?.method || 'N/A'}`);
    console.log(`   Auth Method: ${analysis.authMethod || 'N/A'}`);
    
    if (analysis.queryParameters && Object.keys(analysis.queryParameters).length > 0) {
      console.log('🔍 Query Parameters:');
      Object.entries(analysis.queryParameters).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
    
    if (analysis.requestBody && Object.keys(analysis.requestBody).length > 0) {
      console.log('📄 Request Body:');
      Object.entries(analysis.requestBody).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
    
    if (analysis.paginationConfig) {
      console.log('📄 Pagination:');
      console.log(`   Enabled: ${analysis.paginationConfig.enabled}`);
      console.log(`   Type: ${analysis.paginationConfig.type || 'N/A'}`);
      console.log(`   Page Size: ${analysis.paginationConfig.pageSize || 'N/A'}`);
    }
    
    console.log('🔧 Response Configuration:');
    console.log(`   Data Path: ${analysis.responseConfig?.responseDataPath || 'N/A'}`);
    console.log(`   Count Path: ${analysis.responseConfig?.totalCountPath || 'N/A'}`);
    
    console.log('🗺️  Response Mapping:');
    const mappingCount = analysis.responseMapping ? Object.keys(analysis.responseMapping).length : 0;
    console.log(`   Fields Mapped: ${mappingCount}`);
    
    console.log('⚙️  Processing Details:');
    console.log(`   Handler Type: ${analysis.handlerType || 'N/A'}`);
    console.log(`   Workflow: ${analysis.workflow || 'N/A'}`);
    console.log(`   API Notes: ${analysis.apiNotes ? 'Present' : 'N/A'}`);
    
    console.log('\n🎯 VALIDATION:');
    console.log('─'.repeat(40));
    
    // Validate essential fields
    const validations = {
      'Has API Endpoint': !!analysis.apiEndpoint,
      'Has Request Config': !!analysis.requestConfig,
      'Has Auth Method': !!analysis.authMethod,
      'Has Workflow': !!analysis.workflow,
      'Has Handler Type': !!analysis.handlerType,
      'Has Response Config': !!analysis.responseConfig,
      'Has Response Mapping': !!analysis.responseMapping,
      'Execution Time < 15s': executionTime < 15000
    };
    
    Object.entries(validations).forEach(([check, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`   ${status} ${check}`);
    });
    
    const allPassed = Object.values(validations).every(v => v);
    console.log(`\n🎯 Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    return {
      success: allPassed,
      analysis,
      executionTime,
      source
    };
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    console.log(`📍 Stack: ${error.stack}`);
    
    return {
      success: false,
      error: error.message,
      source: null
    };
  }
}

async function runSourceOrchestratorTests() {
  console.log('🧪 STAGE 1: SourceOrchestrator Testing with Real Data');
  console.log('=' .repeat(80));
  console.log('Testing both API types with actual database sources\n');
  
  const results = {};
  
  // Test 1: California Grants Portal (one-step API)
  results.california = await testSourceOrchestrator('california', TEST_SOURCES.californiaGrants);
  
  // Wait between tests
  console.log('\n⏳ Waiting 2 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Grants.gov (two-step API)  
  results.grantsGov = await testSourceOrchestrator('grantsGov', TEST_SOURCES.grantsGov);
  
  // Summary
  console.log('\n📊 STAGE 1 SUMMARY');
  console.log('=' .repeat(50));
  
  Object.entries(results).forEach(([sourceKey, result]) => {
    const sourceInfo = sourceKey === 'california' ? TEST_SOURCES.californiaGrants : TEST_SOURCES.grantsGov;
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const time = result.executionTime ? `(${result.executionTime}ms)` : '';
    console.log(`${sourceInfo.name}: ${status} ${time}`);
  });
  
  const successCount = Object.values(results).filter(r => r.success).length;
  console.log(`\n🎯 Overall: ${successCount}/2 sources analyzed successfully`);
  
  if (successCount === 2) {
    console.log('\n🎉 Stage 1 Complete! Ready for Stage 2 (DataExtractionAgent)');
    console.log('\n💾 Saving results for next stage...');
    
    // Save results for Stage 2
    const stage1Results = {
      timestamp: new Date().toISOString(),
      results: Object.fromEntries(
        Object.entries(results)
          .filter(([_, result]) => result.success)
          .map(([key, result]) => [key, {
            analysis: result.analysis,
            source: result.source
          }])
      )
    };
    
    // You can save to file or just log for now
    console.log('\n📄 Results for Stage 2:');
    console.log(JSON.stringify(stage1Results, null, 2));
    
  } else {
    console.log('\n⚠️  Some sources failed - fix issues before proceeding to Stage 2');
  }
  
  return results;
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runSourceOrchestratorTests().catch(console.error);
}

export { runSourceOrchestratorTests }; 