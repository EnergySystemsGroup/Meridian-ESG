#!/usr/bin/env node

/**
 * Edge Function Testing Script
 * 
 * Tests the process-source Edge Function with different scenarios:
 * 1. Basic connectivity test
 * 2. Invalid request test
 * 3. Real source processing test
 * 4. Performance/timeout test
 */

const EDGE_FUNCTION_URL = 'http://localhost:54321/functions/v1/process-source';

async function testEdgeFunction() {
  console.log('🧪 Starting Edge Function Tests\n');

  // Test 1: Basic connectivity
  console.log('📡 Test 1: Basic Connectivity');
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      console.log('✅ CORS preflight successful');
    } else {
      console.log('❌ CORS preflight failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Edge Function not accessible:', error.message);
    console.log('💡 Make sure to run: cd supabase && supabase functions serve process-source');
    return;
  }

  // Test 2: Invalid request (missing sourceId)
  console.log('\n🚫 Test 2: Invalid Request');
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU', // Local service role key
      },
      body: JSON.stringify({})
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.status === 400 && result.message?.includes('sourceId is required')) {
      console.log('✅ Error handling works correctly');
    } else {
      console.log('❌ Unexpected error response');
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }

  // Test 3: Valid request with test sourceId
  console.log('\n🎯 Test 3: Valid Request (Test Source)');
  try {
    const testPayload = {
      sourceId: 'test-source-123',
      runId: 'test-run-' + Date.now()
    };
    
    console.log('Sending payload:', JSON.stringify(testPayload, null, 2));
    
    const startTime = Date.now();
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU', // Local service role key
      },
      body: JSON.stringify(testPayload)
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log('Response status:', response.status);
    console.log('Response time:', responseTime + 'ms');
    
    const result = await response.json();
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (result.status === 'error' && result.version === 'v2.0') {
      console.log('✅ Edge Function responded with V2 format');
    } else if (result.status === 'success') {
      console.log('✅ Processing successful!');
      console.log(`📊 Metrics: ${JSON.stringify(result.metrics || {}, null, 2)}`);
    } else {
      console.log('❓ Unexpected response format');
    }
    
  } catch (error) {
    console.log('❌ Valid request test failed:', error.message);
  }

  console.log('\n🏁 Edge Function tests completed!');
}

// Run tests
testEdgeFunction().catch(console.error); 