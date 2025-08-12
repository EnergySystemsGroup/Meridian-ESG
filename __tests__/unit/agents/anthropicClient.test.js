import dotenv from 'dotenv'
import path from 'path'
import { AnthropicClient, getAnthropicClient, schemas, PerformanceComparator } from '../../../lib/agents-v2/utils/anthropicClient.js'
import { ChatAnthropic } from '@langchain/anthropic'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { z } from 'zod'

// Load environment variables (use process.cwd() for Jest compatibility)
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

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
})

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
}

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
`

/**
 * Legacy LangChain + Zod approach for comparison
 */
async function legacyApproach(prompt, zodSchema) {
  const parser = StructuredOutputParser.fromZodSchema(zodSchema)
  const formatInstructions = parser.getFormatInstructions()
  
  const model = new ChatAnthropic({
    temperature: 0,
    modelName: 'claude-3-5-sonnet-20241022',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  })

  const finalPrompt = `${prompt}\n\n${formatInstructions}`
  const response = await model.invoke(finalPrompt)
  const parsedOutput = await parser.parse(response.content)
  
  return {
    data: parsedOutput,
    usage: response.usage,
    total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
  }
}

/**
 * New AnthropicClient approach
 */
async function newApproach(prompt, jsonSchema) {
  const client = new AnthropicClient()
  return await client.callWithSchema(prompt, jsonSchema)
}

describe('AnthropicClient', () => {
  let client

  beforeAll(() => {
    // Skip tests if no API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ ANTHROPIC_API_KEY not found - skipping AnthropicClient tests')
      return
    }
    client = getAnthropicClient()
  })

  test('should pass quick validation test', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ Skipping test - no API key')
      return
    }

    const testSchema = {
      type: "object",
      properties: {
        test: { type: "string" },
        number: { type: "number" }
      },
      required: ["test", "number"]
    }

    const result = await client.callWithSchema(
      "Generate a test object with string 'hello' and number 42",
      testSchema
    )

    expect(result.data).toBeDefined()
    expect(result.data.test).toBe('hello')
    expect(result.data.number).toBe(42)
    expect(result.usage).toBeDefined()
    expect(result.performance.total_ms).toBeLessThan(10000)
  }, 15000)

  test('should have singleton client', () => {
    const client1 = getAnthropicClient()
    const client2 = getAnthropicClient()
    expect(client1).toBe(client2)
  })

  test('should have pre-configured schemas', () => {
    expect(schemas.dataExtraction).toBeDefined()
    expect(schemas.analysis).toBeDefined()
    expect(schemas.filter).toBeDefined()
    expect(schemas.storage).toBeDefined()
  })

  test('should handle batch processing', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ Skipping test - no API key')
      return
    }

    const prompts = [
      "Say 'test1'",
      "Say 'test2'"
    ]

    const schema = {
      type: "object",
      properties: {
        response: { type: "string" }
      }
    }

    const results = await client.batchCallWithSchema(prompts, schema, {
      maxConcurrent: 2
    })

    expect(results).toHaveLength(2)
    expect(results[0].data.response).toContain('test1')
    expect(results[1].data.response).toContain('test2')
  }, 30000)

  test('should track performance metrics', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ Skipping test - no API key')
      return
    }

    const schema = {
      type: "object",
      properties: {
        message: { type: "string" }
      }
    }

    const result = await client.callWithSchema("Say hello", schema)

    expect(result.performance).toBeDefined()
    expect(result.performance.total_ms).toBeGreaterThan(0)
    expect(result.performance.api_call_ms).toBeGreaterThan(0)
    expect(result.performance.validation_ms).toBeDefined()
  }, 15000)

  test('should handle errors gracefully', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ Skipping test - no API key')
      return
    }

    const invalidSchema = {
      type: "invalid_type"
    }

    await expect(
      client.callWithSchema("Test prompt", invalidSchema)
    ).rejects.toThrow()
  })

  test('should demonstrate performance improvement over legacy approach', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ Skipping performance comparison - no API key')
      return
    }

    console.log('\n🏁 Performance Comparison Test Starting...\n')

    // Run legacy approach
    console.log('Testing legacy LangChain + Zod approach...')
    const legacyStart = Date.now()
    const legacyResult = await legacyApproach(testPrompt, testZodSchema)
    const legacyTime = Date.now() - legacyStart

    // Run new approach
    console.log('Testing new AnthropicClient approach...')
    const newStart = Date.now()
    const newResult = await newApproach(testPrompt, testJsonSchema)
    const newTime = Date.now() - newStart

    // Calculate improvements
    const timeImprovement = ((legacyTime - newTime) / legacyTime * 100).toFixed(1)
    const tokenImprovement = ((legacyResult.total_tokens - newResult.usage.total_tokens) / legacyResult.total_tokens * 100).toFixed(1)

    console.log('\n📊 Performance Results:')
    console.log('=' .repeat(50))
    console.log(`Legacy Approach: ${legacyTime}ms, ${legacyResult.total_tokens} tokens`)
    console.log(`New Approach: ${newTime}ms, ${newResult.usage.total_tokens} tokens`)
    console.log(`Time Improvement: ${timeImprovement}%`)
    console.log(`Token Improvement: ${tokenImprovement}%`)
    console.log('=' .repeat(50))

    // Assertions
    expect(newResult.data).toBeDefined()
    expect(newResult.data.opportunities).toBeDefined()
    expect(Array.isArray(newResult.data.opportunities)).toBe(true)
    
    // Performance should be better or at least comparable
    expect(newTime).toBeLessThanOrEqual(legacyTime * 1.2) // Allow 20% variance
  }, 60000)
})