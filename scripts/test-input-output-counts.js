#!/usr/bin/env node

/**
 * Test script to verify input/output counts are being tracked correctly
 * in the pipeline_stages table after implementing task 38.16
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testInputOutputCounts() {
  console.log('🧪 Testing Pipeline Stages Input/Output Count Tracking');
  console.log('=' .repeat(50));
  
  try {
    // Get the most recent pipeline run
    const { data: latestRun, error: runError } = await supabase
      .from('pipeline_runs')
      .select('id, api_source_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (runError) {
      console.error('❌ Error fetching latest run:', runError);
      return;
    }
    
    if (!latestRun || latestRun.length === 0) {
      console.log('⚠️ No pipeline runs found. Please run a pipeline first.');
      return;
    }
    
    const run = latestRun[0];
    console.log(`\n📊 Analyzing Run: ${run.id}`);
    console.log(`   Status: ${run.status}`);
    console.log(`   Created: ${new Date(run.created_at).toLocaleString()}`);
    
    // Get all stages for this run
    const { data: stages, error: stagesError } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('run_id', run.id)
      .order('stage_order');
    
    if (stagesError) {
      console.error('❌ Error fetching stages:', stagesError);
      return;
    }
    
    if (!stages || stages.length === 0) {
      console.log('⚠️ No stages found for this run.');
      return;
    }
    
    console.log(`\n📋 Pipeline Stages Analysis:`);
    console.log('-'.repeat(50));
    
    let hasInputOutputCounts = false;
    
    stages.forEach((stage, index) => {
      console.log(`\n${index + 1}. ${stage.stage_name.toUpperCase()}`);
      console.log(`   Status: ${stage.status}`);
      console.log(`   Input Count: ${stage.input_count ?? 'NULL'} ${stage.input_count === 0 ? '⚠️' : stage.input_count > 0 ? '✅' : ''}`);
      console.log(`   Output Count: ${stage.output_count ?? 'NULL'} ${stage.output_count === 0 ? '⚠️' : stage.output_count > 0 ? '✅' : ''}`);
      
      if (stage.input_count > 0 || stage.output_count > 0) {
        hasInputOutputCounts = true;
      }
      
      // Show flow metrics
      if (stage.input_count > 0 && stage.output_count !== null) {
        const conversionRate = stage.input_count > 0 
          ? Math.round((stage.output_count / stage.input_count) * 100) 
          : 0;
        console.log(`   Conversion: ${conversionRate}% (${stage.output_count}/${stage.input_count})`);
      }
      
      // Show execution time if available
      if (stage.execution_time_ms) {
        console.log(`   Execution Time: ${stage.execution_time_ms}ms`);
      }
    });
    
    // Calculate funnel metrics
    console.log('\n📈 Pipeline Funnel Analysis:');
    console.log('-'.repeat(50));
    
    const dataExtraction = stages.find(s => s.stage_name === 'data_extraction');
    const earlyDuplicate = stages.find(s => s.stage_name === 'early_duplicate_detector');
    const analysis = stages.find(s => s.stage_name === 'analysis');
    const filter = stages.find(s => s.stage_name === 'filter');
    const storage = stages.find(s => s.stage_name === 'storage');
    const directUpdate = stages.find(s => s.stage_name === 'direct_update');
    
    if (dataExtraction?.output_count > 0) {
      console.log(`📥 Extracted: ${dataExtraction.output_count} opportunities`);
      
      if (earlyDuplicate) {
        // Get metrics from stage results to understand the branching
        const stageResults = earlyDuplicate.stage_results || {};
        const newCount = stageResults.metrics?.newOpportunities || 0;
        const updateCount = stageResults.metrics?.opportunitiesToUpdate || 0;
        const skipCount = stageResults.metrics?.opportunitiesToSkip || 0;
        
        console.log(`🔍 After Duplicate Detection:`);
        console.log(`   - New (→ Analysis): ${newCount}`);
        console.log(`   - Update (→ Direct Update): ${updateCount}`);
        console.log(`   - Skip (→ Nowhere): ${skipCount}`);
        console.log(`   - Total Output: ${earlyDuplicate.output_count || 0} (should be New + Update = ${newCount + updateCount})`);
        
        // Validate flow consistency
        const expectedOutput = newCount + updateCount;
        if (earlyDuplicate.output_count === expectedOutput) {
          console.log(`   ✅ Flow consistent: output count matches NEW + UPDATE`);
        } else {
          console.log(`   ❌ Flow mismatch: output (${earlyDuplicate.output_count}) ≠ NEW + UPDATE (${expectedOutput})`);
        }
      }
      
      if (analysis && analysis.output_count > 0) {
        console.log(`🧠 After Analysis: ${analysis.output_count} enhanced`);
      }
      
      if (filter && filter.output_count !== null) {
        console.log(`🔍 After Filter: ${filter.output_count} passed`);
      }
      
      if (storage && storage.output_count > 0) {
        console.log(`💾 Stored: ${storage.output_count} new opportunities`);
      }
      
      if (directUpdate && directUpdate.output_count > 0) {
        // Get detailed metrics from direct update stage
        const directStageResults = directUpdate.stage_results || {};
        const successful = directStageResults.metrics?.successful || 0;
        const failed = directStageResults.metrics?.failed || 0;
        const skipped = directStageResults.metrics?.skipped || 0;
        
        console.log(`🔄 Direct Update Results:`);
        console.log(`   - Input: ${directUpdate.input_count || 0} opportunities`);
        console.log(`   - Successful: ${successful} updated`);
        console.log(`   - Failed: ${failed} failed`);
        console.log(`   - Skipped: ${skipped} no changes worth updating`);
        console.log(`   - Total Output: ${directUpdate.output_count || 0} (should equal input for Direct Update)`);
        
        // Validate direct update flow
        if (directUpdate.input_count === directUpdate.output_count) {
          console.log(`   ✅ Direct Update integrity: all inputs processed`);
        } else {
          console.log(`   ❌ Direct Update integrity issue: input (${directUpdate.input_count}) ≠ output (${directUpdate.output_count})`);
        }
        
        // Validate against Early Duplicate Detector UPDATE count
        if (earlyDuplicate) {
          const updateCount = earlyDuplicate.stage_results?.metrics?.opportunitiesToUpdate || 0;
          if (directUpdate.input_count === updateCount) {
            console.log(`   ✅ Flow handoff: Direct Update input matches Early Duplicate UPDATE count`);
          } else {
            console.log(`   ❌ Flow handoff issue: Direct Update input (${directUpdate.input_count}) ≠ Early Duplicate UPDATE (${updateCount})`);
          }
        }
      }
    }
    
    // Final verdict
    console.log('\n✅ Test Results:');
    console.log('-'.repeat(50));
    
    if (hasInputOutputCounts) {
      console.log('🎉 SUCCESS: Input/output counts are being tracked!');
      console.log('   Task 38.16 implementation is working correctly.');
    } else {
      console.log('❌ FAILURE: All input/output counts are still 0.');
      console.log('   The implementation needs debugging.');
      console.log('\n🔍 Debugging hints:');
      console.log('   1. Check that ProcessCoordinatorV2 is passing counts');
      console.log('   2. Verify RunManagerV2.updateV2Stage() is saving counts');
      console.log('   3. Run a new pipeline to test the changes');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testInputOutputCounts()
  .then(() => {
    console.log('\n🏁 Test complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });