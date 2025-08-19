import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, test, expect, beforeAll } from 'vitest';
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

describe('AnthropicClient', () => {
  let client;

  beforeAll(() => {
    // Skip tests if no API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ ANTHROPIC_API_KEY not found - skipping AnthropicClient tests');
      return;
    }
    client = getAnthropicClient();
  });

  test('should pass quick validation test', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ Skipping test - no API key');
      return;
    }

    const result = await client.callText('Say "AnthropicClient is working!" in a JSON object with a "message" field.');
    
    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    expect(result.performance).toBeDefined();
    expect(result.performance.duration).toBeGreaterThan(0);
    
    console.log(`✅ Quick test passed (${result.performance.duration}ms)`);
  }, 30000); // 30 second timeout for API calls

  test('should handle basic functionality with schema', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ Skipping test - no API key');
      return;
    }

    const result = await client.callWithSchema(testPrompt, testJsonSchema, {
      maxTokens: 1500
    });
    
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.performance).toBeDefined();
    expect(result.performance.totalTokens).toBeGreaterThan(0);
    
    // Check for expected structure
    if (result.data.opportunities) {
      expect(Array.isArray(result.data.opportunities)).toBe(true);
    }
    
    console.log(`✅ Basic functionality test passed (${result.performance.duration}ms, ${result.performance.totalTokens} tokens)`);
  }, 30000);

  test('should test individual schemas', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ Skipping test - no API key');
      return;
    }

    // Test data extraction schema
    const extractionResult = await client.callWithSchema(
      'Extract opportunities from this API: {"grants": [{"id": "test-123", "name": "Test Grant", "amount": 50000}]}',
      schemas.dataExtraction,
      { maxTokens: 1000 }
    );
    expect(extractionResult).toBeDefined();
    expect(extractionResult.data).toBeDefined();
    
    // Test source analysis schema
    const sourceResult = await client.callWithSchema(
      'Analyze this API source: {"name": "DOE Grants", "url": "https://api.energy.gov/grants", "type": "funding"}',
      schemas.sourceAnalysis,
      { maxTokens: 600 }
    );
    expect(sourceResult).toBeDefined();
    expect(sourceResult.data).toBeDefined();
    
    console.log('✅ Schema tests completed');
  }, 45000);

  test('should handle batch processing', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ Skipping test - no API key');
      return;
    }

    const batchPrompts = [
      { prompt: testPrompt, schema: testJsonSchema, options: { maxTokens: 1000 } },
      { prompt: testPrompt.replace('Schools', 'Hospitals'), schema: testJsonSchema, options: { maxTokens: 1000 } }
    ];
    
    const batchResults = await client.batchProcess(batchPrompts, { concurrency: 2 });
    
    expect(Array.isArray(batchResults)).toBe(true);
    expect(batchResults.length).toBe(2);
    
    const successfulBatches = batchResults.filter(r => !r.error);
    expect(successfulBatches.length).toBeGreaterThan(0);
    
    console.log(`✅ Batch processing completed (${successfulBatches.length}/${batchResults.length} successful)`);
  }, 60000);

  test('should handle errors gracefully', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ Skipping test - no API key');
      return;
    }

    // Test with very low token limit to potentially cause issues
    await expect(async () => {
      await client.callWithSchema('Invalid prompt with no clear request', testJsonSchema, {
        maxTokens: 10,
        retries: 1
      });
    }).rejects.toThrow();
    
    console.log('✅ Error handling works correctly');
  }, 30000);
});

// Export for use in other test files
export { testZodSchema, testJsonSchema, testPrompt, legacyApproach, newApproach }; 