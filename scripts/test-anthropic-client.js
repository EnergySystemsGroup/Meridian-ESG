#!/usr/bin/env node

/**
 * Standalone test script for AnthropicClient
 * 
 * Run with: node scripts/test-anthropic-client.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

// Now import our test modules
const { quickTest, testSchemas } = await import('../app/lib/agents-v2/tests/anthropicClient.test.js');

async function main() {
  console.log('🚀 Testing AnthropicClient Standalone...\n');
  
  // Quick validation test
  console.log('=== QUICK TEST ===');
  const quickResult = await quickTest();
  
  if (quickResult.success) {
    console.log(`✅ AnthropicClient is working! (${quickResult.duration}ms)\n`);
  } else {
    console.log(`❌ Quick test failed: ${quickResult.error}\n`);
    return;
  }
  
  // Test individual schemas
  console.log('=== SCHEMA TESTS ===');
  try {
    const schemaResults = await testSchemas();
    console.log('✅ All schemas working correctly!\n');
    
    console.log('📊 Schema Test Results:');
    console.log(`   Extraction: ${schemaResults.extraction?.opportunities?.length || 0} opportunities`);
    console.log(`   Scoring: ${schemaResults.scoring?.opportunities?.length || 0} scored`);
    console.log(`   Analysis: ${schemaResults.analysis?.handlerType || 'unknown'} handler\n`);
    
  } catch (error) {
    console.log(`❌ Schema tests failed: ${error.message}\n`);
  }
  
  console.log('🎉 AnthropicClient foundation is ready!');
  console.log('Next step: Build the v2 agents that use this client.');
}

main().catch(console.error); 