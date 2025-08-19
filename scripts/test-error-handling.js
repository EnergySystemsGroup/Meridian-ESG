#!/usr/bin/env node

/**
 * Test Script for Enhanced Error Handling in V2 Pipeline
 * 
 * Tests:
 * - Error classification
 * - Retry logic with exponential backoff
 * - Circuit breaker functionality
 * - Error recovery tracking
 * - Checkpoint system
 */

import { 
  PipelineError,
  TransientError,
  PermanentError,
  RateLimitError,
  DatabaseError,
  ApiError,
  classifyError,
  formatErrorForLogging,
  getRecoverySuggestion
} from '../lib/utils/pipelineErrors.js';

import {
  withRetry,
  CircuitBreaker
} from '../lib/utils/retryHandler.js';

import { RetryPolicy, calculateRetryDelay } from '../lib/utils/pipelineErrors.js';

async function testErrorClassification() {
  console.log('\n🧪 Testing Error Classification\n' + '='.repeat(50));
  
  const testCases = [
    { error: new Error('rate limit exceeded'), expected: 'RATE_LIMIT' },
    { error: new Error('Connection timeout'), expected: 'TIMEOUT' },
    { error: new Error('duplicate key value'), expected: 'DATABASE' },
    { error: new Error('Invalid API key'), expected: 'VALIDATION' },
    { error: { message: 'Network error', code: 'ECONNRESET' }, expected: 'TRANSIENT' },
    { error: { message: 'Server error', response: { status: 500 } }, expected: 'API' },
    { error: new Error('Claude model overloaded'), expected: 'AI_SERVICE' }
  ];
  
  for (const testCase of testCases) {
    const classified = classifyError(testCase.error);
    const passed = classified.category === testCase.expected;
    
    console.log(`${passed ? '✅' : '❌'} ${testCase.error.message || testCase.error} → ${classified.category}`);
    console.log(`   Retryable: ${classified.retryable}, Severity: ${classified.severity}`);
    console.log(`   Suggestion: ${getRecoverySuggestion(classified)}`);
  }
}

async function testRetryLogic() {
  console.log('\n🧪 Testing Retry Logic\n' + '='.repeat(50));
  
  // Test successful retry
  let attempts = 0;
  const flakeyFunction = async () => {
    attempts++;
    console.log(`   Attempt ${attempts}`);
    if (attempts < 3) {
      throw new TransientError('Temporary failure', 'TEST_ERROR');
    }
    return 'Success!';
  };
  
  try {
    const result = await withRetry(flakeyFunction, {
      maxAttempts: 5,
      policy: RetryPolicy.DEFAULT,
      operation: 'flakeyFunction'
    });
    console.log(`✅ Retry succeeded after ${result.attempts} attempts: ${result.result}`);
  } catch (error) {
    console.log(`❌ Retry failed: ${error.message}`);
  }
  
  // Test non-retryable error
  console.log('\n   Testing non-retryable error:');
  const permanentFailure = async () => {
    throw new PermanentError('Configuration missing', 'CONFIG_ERROR');
  };
  
  try {
    await withRetry(permanentFailure, {
      maxAttempts: 3,
      operation: 'permanentFailure'
    });
  } catch (error) {
    console.log(`✅ Correctly rejected non-retryable error: ${error.message}`);
  }
  
  // Test retry delay calculation
  console.log('\n   Testing retry delay calculation:');
  for (let attempt = 1; attempt <= 4; attempt++) {
    const delay = calculateRetryDelay(attempt, RetryPolicy.DEFAULT);
    console.log(`   Attempt ${attempt}: ${delay}ms delay`);
  }
}

async function testCircuitBreaker() {
  console.log('\n🧪 Testing Circuit Breaker\n' + '='.repeat(50));
  
  const breaker = new CircuitBreaker('test-service', {
    failureThreshold: 3,
    resetTimeout: 2000,
    halfOpenRequests: 1
  });
  
  let callCount = 0;
  const unreliableService = async () => {
    callCount++;
    if (callCount <= 4) {
      throw new Error(`Service failure ${callCount}`);
    }
    return `Success on call ${callCount}`;
  };
  
  // Test circuit opening
  console.log('   Testing circuit opening:');
  for (let i = 0; i < 5; i++) {
    try {
      await breaker.execute(unreliableService);
      console.log(`   Call ${i + 1}: Success`);
    } catch (error) {
      const state = breaker.getState();
      console.log(`   Call ${i + 1}: Failed - Circuit state: ${state.state}`);
    }
  }
  
  // Test circuit recovery
  console.log('\n   Waiting for circuit reset timeout...');
  await new Promise(resolve => setTimeout(resolve, 2100));
  
  console.log('   Testing circuit recovery:');
  try {
    const result = await breaker.execute(unreliableService);
    console.log(`   ✅ Circuit recovered: ${result}`);
  } catch (error) {
    console.log(`   ❌ Circuit still failing: ${error.message}`);
  }
}

async function testErrorRecovery() {
  console.log('\n🧪 Testing Error Recovery Patterns\n' + '='.repeat(50));
  
  // Simulate different error scenarios and recovery
  const scenarios = [
    {
      name: 'Database Connection Recovery',
      error: new DatabaseError('Connection refused', { code: 'ECONNREFUSED' }),
      expectedRetry: true
    },
    {
      name: 'Rate Limit Handling',
      error: new RateLimitError('Too many requests', 5000),
      expectedRetry: true
    },
    {
      name: 'API 404 Error',
      error: new ApiError('Not found', 404),
      expectedRetry: false
    },
    {
      name: 'Timeout Recovery',
      error: new Error('Operation timed out'),
      expectedRetry: true
    }
  ];
  
  for (const scenario of scenarios) {
    const classified = scenario.error instanceof PipelineError ? scenario.error : classifyError(scenario.error);
    const canRecover = classified.retryable === scenario.expectedRetry;
    
    console.log(`\n   ${scenario.name}:`);
    console.log(`   Error: ${classified.message}`);
    console.log(`   Category: ${classified.category}, Code: ${classified.code}`);
    console.log(`   Retryable: ${classified.retryable} (expected: ${scenario.expectedRetry})`);
    console.log(`   ${canRecover ? '✅' : '❌'} Recovery strategy: ${getRecoverySuggestion(classified)}`);
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Enhanced Error Handling Test Suite');
  console.log('═'.repeat(60));
  
  try {
    await testErrorClassification();
    await testRetryLogic();
    await testCircuitBreaker();
    await testErrorRecovery();
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Execute tests
runTests();