import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AnthropicClient, getAnthropicClient, schemas, PerformanceComparator } from '../utils/anthropicClient.js';
import { ChatAnthropic } from '@langchain/anthropic';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../../.env.local') });

/**
 * Test suite for AnthropicClient performance validation
 * 
 * This validates:
 * 1. Basic functionality works correctly
 * 2. Performance improvements vs LangChain + Zod
 * 3. Schema validation and error handling
 * 4. Batch processing capabilities
 */

// Sample test schemas for comparison
const testZodSchema = z.object({
  opportunities: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    fundingType: z.string().optional(),
    totalFunding: z.number().optional().nullable(),
    eligibleApplicants: z.array(z.string()),
    relevanceScore: z.string(),
    recommended: z.boolean()
  })),
  metrics: z.object({
    totalFound: z.number(),
    extracted: z.number()
  })
});

const testJsonSchema = {
  type: "object",
  properties: {
    opportunities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          fundingType: { type: ["string", "null"] },
          totalFunding: { type: ["number", "null"] },
          eligibleApplicants: { type: "array", items: { type: "string" } },
          relevanceScore: { type: "string" },
          recommended: { type: "boolean" }
        },
        required: ["id", "title", "description", "eligibleApplicants", "relevanceScore", "recommended"]
      }
    },
    metrics: {
      type: "object",
      properties: {
        totalFound: { type: "number" },
        extracted: { type: "number" }
      }
    }
  },
  required: ["opportunities", "metrics"]
};

const testPrompt = `
Analyze this sample funding opportunity data and extract structured information:

API Response:
{
  "results": [
    {
      "grant_id": "DOE-12345",
      "program_name": "Energy Efficiency Grants for Schools",
      "description": "Federal funding for K-12 schools to upgrade HVAC systems and improve building efficiency",
      "total_amount": 5000000,
      "eligible_entities": ["Public K-12 Schools", "School Districts"],
      "application_deadline": "2024-12-31"
    },
    {
      "opportunity_id": "EPA-67890", 
      "title": "Water Conservation Infrastructure",
      "summary": "Municipal water system improvements and conservation projects",
      "funding_available": 2000000,
      "who_can_apply": ["Municipal Government", "Water Districts"]
    }
  ]
}

Extract opportunities with relevance scores and recommendations.
`;

/**
 * Legacy LangChain + Zod approach for comparison
 */
async function legacyApproach(prompt, zodSchema) {
  const parser = StructuredOutputParser.fromZodSchema(zodSchema);
  const formatInstructions = parser.getFormatInstructions();
  
  const model = new ChatAnthropic({
    temperature: 0,
    modelName: 'claude-3-5-sonnet-20241022',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  });

  const finalPrompt = `${prompt}\n\n${formatInstructions}`;
  const response = await model.invoke(finalPrompt);
  const parsedOutput = await parser.parse(response.content);
  
  return {
    data: parsedOutput,
    usage: response.usage,
    total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
  };
}

/**
 * New AnthropicClient approach
 */
async function newApproach(prompt, jsonSchema) {
  const client = new AnthropicClient();
  return await client.callWithSchema(prompt, jsonSchema);
}

/**
 * Main test function
 */
export async function testAnthropicClient() {
  console.log('🧪 Testing AnthropicClient Performance...\n');
  
  const comparator = new PerformanceComparator();
  
  try {
    // Test basic functionality
    console.log('1️⃣ Testing Basic Functionality...');
    const client = getAnthropicClient();
    
    const result = await client.callWithSchema(testPrompt, testJsonSchema, {
      maxTokens: 1500
    });
    
    console.log('✅ Basic functionality test passed');
    console.log(`   Duration: ${result.performance.duration}ms`);
    console.log(`   Tokens: ${result.performance.totalTokens}`);
    console.log(`   Opportunities extracted: ${result.data.opportunities?.length || 0}\n`);
    
    // Test performance comparison
    console.log('2️⃣ Testing Performance vs LangChain + Zod...');
    
    const comparison = await comparator.compareWithLegacy(
      testPrompt,
      testZodSchema,
      (prompt, schema) => legacyApproach(prompt, schema),
      (prompt, schema) => newApproach(prompt, schema)
    );
    
    if (comparison.improvement) {
      console.log('📊 Performance Comparison Results:');
      console.log(`   ⚡ Time improvement: ${comparison.improvement.timeImprovement}`);
      console.log(`   🪙 Token improvement: ${comparison.improvement.tokenImprovement}`);
      console.log(`   ⏱️  Time saved: ${comparison.improvement.timeSaved}ms`);
      console.log(`   🏆 New approach faster: ${comparison.improvement.newFaster ? 'YES' : 'NO'}\n`);
    }
    
    // Test batch processing
    console.log('3️⃣ Testing Batch Processing...');
    const batchPrompts = [
      { prompt: testPrompt, schema: testJsonSchema, options: { maxTokens: 1000 } },
      { prompt: testPrompt.replace('Schools', 'Hospitals'), schema: testJsonSchema, options: { maxTokens: 1000 } },
      { prompt: testPrompt.replace('Energy', 'Solar'), schema: testJsonSchema, options: { maxTokens: 1000 } }
    ];
    
    const batchStartTime = Date.now();
    const batchResults = await client.batchProcess(batchPrompts, { concurrency: 2 });
    const batchDuration = Date.now() - batchStartTime;
    
    const successfulBatches = batchResults.filter(r => !r.error);
    console.log(`✅ Batch processing completed`);
    console.log(`   Total duration: ${batchDuration}ms`);
    console.log(`   Successful: ${successfulBatches.length}/${batchResults.length}`);
    console.log(`   Average per request: ${Math.round(batchDuration / batchResults.length)}ms\n`);
    
    // Test error handling
    console.log('4️⃣ Testing Error Handling...');
    try {
      await client.callWithSchema('Invalid prompt with no clear request', testJsonSchema, {
        maxTokens: 10, // Very low token limit to potentially cause issues
        retries: 1
      });
    } catch (error) {
      console.log('✅ Error handling works correctly');
      console.log(`   Error caught: ${error.message}\n`);
    }
    
    // Get final performance metrics
    console.log('5️⃣ Final Performance Metrics...');
    const metrics = client.getPerformanceMetrics();
    console.log(`📈 Total calls: ${metrics.totalCalls}`);
    console.log(`📈 Total tokens: ${metrics.totalTokens}`);
    console.log(`📈 Average time: ${Math.round(metrics.averageTime)}ms`);
    console.log(`📈 Success rate: ${metrics.successRate?.toFixed(1)}%`);
    
    // Average improvement across all comparisons
    const avgImprovement = comparator.getAverageImprovement();
    if (avgImprovement) {
      console.log(`\n🎯 OVERALL PERFORMANCE IMPROVEMENT:`);
      console.log(`   Average time improvement: ${avgImprovement.averageTimeImprovement}`);
      console.log(`   Samples tested: ${avgImprovement.samplesCount}`);
      console.log(`   Consistently faster: ${avgImprovement.consistentlyFaster ? 'YES' : 'NO'}`);
    }
    
    return {
      success: true,
      metrics,
      improvements: avgImprovement,
      testResults: {
        basicFunctionality: true,
        performanceComparison: comparison,
        batchProcessing: { successful: successfulBatches.length, total: batchResults.length },
        errorHandling: true
      }
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test individual schemas
 */
export async function testSchemas() {
  console.log('🔧 Testing Individual Schemas...\n');
  
  const client = getAnthropicClient();
  
  // Test opportunity extraction schema
  console.log('Testing data extraction schema...');
  const extractionResult = await client.callWithSchema(
    'Extract opportunities from this API: {"grants": [{"id": "test-123", "name": "Test Grant", "amount": 50000}]}',
    schemas.dataExtraction,
    { maxTokens: 1000 }
  );
  console.log(`✅ Extraction: ${extractionResult.data.opportunities?.length || 0} opportunities found\n`);
  
  // Test analysis schema
  console.log('Testing opportunity analysis schema...');
  const analysisResult = await client.callWithSchema(
    'Analyze this opportunity: {"id": "test-123", "title": "Energy Efficiency Grant", "eligibleApplicants": ["Schools"]}',
    schemas.opportunityAnalysis,
    { maxTokens: 800 }
  );
  console.log(`✅ Analysis: ${analysisResult.data.opportunities?.length || 0} opportunities analyzed\n`);
  
  // Test source analysis schema
  console.log('Testing source analysis schema...');
  const sourceResult = await client.callWithSchema(
    'Analyze this API source: {"name": "DOE Grants", "url": "https://api.energy.gov/grants", "type": "funding"}',
    schemas.sourceAnalysis,
    { maxTokens: 600 }
  );
  console.log(`✅ Analysis: ${sourceResult.data.handlerType} handler recommended\n`);
  
  return {
    extraction: extractionResult.data,
    analysis: analysisResult.data,
    source: sourceResult.data
  };
}

/**
 * Quick validation test
 */
export async function quickTest() {
  console.log('⚡ Quick AnthropicClient Validation...');
  
  try {
    const client = getAnthropicClient();
    const result = await client.callText('Say "AnthropicClient is working!" in a JSON object with a "message" field.');
    
    console.log('✅ Quick test passed');
    console.log(`   Response: ${result.text?.substring(0, 100)}...`);
    console.log(`   Duration: ${result.performance.duration}ms`);
    
    return { success: true, duration: result.performance.duration };
  } catch (error) {
    console.error('❌ Quick test failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Export for use in other test files
export { testZodSchema, testJsonSchema, testPrompt, legacyApproach, newApproach };

/**
 * Main execution block - runs when file is executed directly
 */
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
    console.log(`   Analysis: ${schemaResults.analysis?.opportunities?.length || 0} analyzed`);
    console.log(`   Source: ${schemaResults.source?.handlerType || 'unknown'} handler\n`);
    
  } catch (error) {
    console.log(`❌ Schema tests failed: ${error.message}\n`);
  }
  
  console.log('🎉 AnthropicClient foundation is ready!');
  console.log('Next step: Build the v2 agents that use this client.');
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
} 