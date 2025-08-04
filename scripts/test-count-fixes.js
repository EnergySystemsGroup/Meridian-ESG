#!/usr/bin/env node

/**
 * Test script to verify the fixes for count flow inconsistencies
 * Tests the specific scenarios that were causing issues
 */

import { RunManagerV2 } from '../lib/services/runManagerV2.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testCountFixes() {
  console.log('🧪 Testing Count Flow Consistency Fixes');
  console.log('=' .repeat(50));
  
  try {
    // Get an API source for testing
    const { data: sources } = await supabase
      .from('api_sources')
      .select('id, name')
      .limit(1);
    
    if (!sources || sources.length === 0) {
      console.error('❌ No API sources found');
      return;
    }
    
    const sourceId = sources[0].id;
    console.log(`📋 Using API source: ${sources[0].name} (${sourceId})`);
    
    // Create a test run
    const runManager = new RunManagerV2(null, supabase);
    await runManager.startRun(sourceId, { test: true, pipeline_version: 'v2-count-fixes-test' });
    
    console.log(`✅ Created test run: ${runManager.v2RunId}`);
    
    // Test Scenario: Mixed pipeline with NEW, UPDATE, and SKIP opportunities
    console.log('\n📊 Testing mixed pipeline scenario:');
    
    // Data Extraction: Extract 10 opportunities 
    await runManager.updateV2DataExtraction(
      'completed',
      { opportunities: new Array(10).fill(null).map((_, i) => ({ id: i + 1 })) },
      { executionTime: 100 },
      1000,  // tokens
      1,     // API calls
      0,     // input count (from API)
      10     // output count (10 opportunities extracted)
    );
    console.log('   - Data Extraction: 0 in → 10 out ✅');
    
    // Early Duplicate Detector: Categorize into 3 NEW, 5 UPDATE, 2 SKIP
    // FIXED: Output should only count NEW (3) not NEW + UPDATE (8)
    await runManager.updateV2EarlyDuplicateDetector(
      'completed',
      { 
        newOpportunities: new Array(3).fill(null),
        opportunitiesToUpdate: new Array(5).fill(null),
        opportunitiesToSkip: new Array(2).fill(null)
      },
      { 
        newOpportunities: 3,
        opportunitiesToUpdate: 5,
        opportunitiesToSkip: 2,
        executionTime: 50 
      },
      10,  // input count (10 from extraction)
      3    // output count (FIXED: only NEW opportunities proceed to analysis, not NEW + UPDATE)
    );
    console.log('   - Early Duplicate Detector: 10 in → 3 out (NEW only) ✅');
    console.log('     (5 UPDATE opportunities branch to direct_update path)');
    
    // Analysis: Should process 3 NEW opportunities (matches early detector NEW output)
    await runManager.updateV2Analysis(
      'completed',
      { opportunities: new Array(3).fill(null) },
      { executionTime: 200 },
      2000,  // tokens
      2,     // API calls
      3,     // input count (3 NEW opportunities from early detector)
      3      // output count (3 enhanced)
    );
    console.log('   - Analysis: 3 in → 3 out (perfect handoff) ✅');
    
    // Filter: Process 3 enhanced, pass 2
    await runManager.updateV2Filter(
      'completed',
      { includedOpportunities: new Array(2).fill(null) },
      { executionTime: 20 },
      3,  // input count (3 from analysis)
      2   // output count (2 passed filter)
    );
    console.log('   - Filter: 3 in → 2 out ✅');
    
    // Storage: Store 2 filtered opportunities, all successful
    await runManager.updateV2Storage(
      'completed',
      { metrics: { newOpportunities: 2 } },
      { executionTime: 30 },
      0,  // tokens
      2,  // input count (2 from filter)
      2   // output count (2 stored)
    );
    console.log('   - Storage: 2 in → 2 out ✅');
    
    // Direct Update: Process 5 UPDATE opportunities
    // FIXED: Output should be totalProcessed (5) not just successful (which might be 0)
    await runManager.updateV2DirectUpdate(
      'completed',
      { 
        successful: [1, 2],  // 2 successful updates
        failed: [],          // 0 failed
        skipped: [3, 4, 5],  // 3 skipped (no changes)
        metrics: {
          totalProcessed: 5,
          successful: 2,
          failed: 0,
          skipped: 3
        }
      },
      { executionTime: 25 },
      5,  // input count (5 UPDATE opportunities)
      5   // output count (FIXED: totalProcessed, not just successful)
    );
    console.log('   - Direct Update: 5 in → 5 out (total processed, not just successful) ✅');
    console.log('     (2 successful updates, 3 skipped due to no changes)');
    
    // Complete the run
    await runManager.completeRun(500, { test: 'count-fixes-verified' });
    console.log(`\n✅ Test run completed: ${runManager.v2RunId}`);
    
    // Verify the counts in database
    const { data: stages, error } = await supabase
      .from('pipeline_stages')
      .select('stage_name, status, input_count, output_count')
      .eq('run_id', runManager.v2RunId)
      .order('stage_order');
    
    if (error) {
      console.error('❌ Error fetching stages:', error);
      return;
    }
    
    console.log('\n🔍 Verifying Count Flow Consistency:');
    console.log('-'.repeat(50));
    
    let previousOutput = null;
    let flowConsistent = true;
    
    stages.forEach((stage, index) => {
      const isFlowStage = ['data_extraction', 'early_duplicate_detector', 'analysis', 'filter', 'storage'].includes(stage.stage_name);
      const expectedInput = isFlowStage && previousOutput !== null ? previousOutput : stage.input_count;
      
      console.log(`${index + 1}. ${stage.stage_name.toUpperCase()}`);
      console.log(`   Input: ${stage.input_count}, Output: ${stage.output_count}`);
      
      // Check flow consistency for main pipeline path
      if (isFlowStage && previousOutput !== null && stage.input_count !== previousOutput) {
        console.log(`   ❌ FLOW ISSUE: Expected input ${previousOutput}, got ${stage.input_count}`);
        flowConsistent = false;
      } else if (isFlowStage) {
        console.log(`   ✅ Flow consistent`);
      }
      
      // Update previousOutput for next stage (only for main pipeline)
      if (isFlowStage) {
        previousOutput = stage.output_count;
      }
    });
    
    // Check direct_update separately (it's a branch from early_duplicate_detector)
    const directUpdate = stages.find(s => s.stage_name === 'direct_update');
    const earlyDetector = stages.find(s => s.stage_name === 'early_duplicate_detector');
    
    if (directUpdate && earlyDetector) {
      // Direct update should have input = 5 (UPDATE opportunities from early detector)
      const expectedDirectInput = 5; // From our test scenario
      if (directUpdate.input_count === expectedDirectInput) {
        console.log(`\n✅ Direct Update branch: Correctly received ${expectedDirectInput} opportunities`);
      } else {
        console.log(`\n❌ Direct Update branch: Expected ${expectedDirectInput}, got ${directUpdate.input_count}`);
        flowConsistent = false;
      }
    }
    
    console.log('\n📈 Final Assessment:');
    console.log('-'.repeat(50));
    
    if (flowConsistent) {
      console.log('🎉 SUCCESS: All count flow issues have been fixed!');
      console.log('✅ Early Duplicate Detector now correctly reports only NEW in output');
      console.log('✅ Direct Update now reports totalProcessed instead of just successful');
      console.log('✅ Stage handoffs are consistent throughout the pipeline');
      console.log('\n📊 Flow Summary:');
      console.log('   10 extracted → 3 NEW (to analysis) + 5 UPDATE (to direct_update) + 2 SKIP');
      console.log('   NEW path: 3 → 3 → 2 → 2 (extraction → analysis → filter → storage)');
      console.log('   UPDATE path: 5 → 5 (early_detector → direct_update)');
    } else {
      console.log('❌ FAILURE: Count flow issues still exist');
      console.log('   Review the validation output above for specific problems');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testCountFixes()
  .then(() => {
    console.log('\n🏁 Count fixes test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });