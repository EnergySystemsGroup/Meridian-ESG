import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { analyzeSource } from '../core/sourceOrchestrator.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../../.env.local') });

/**
 * Test suite for SourceOrchestrator V2
 * 
 * Tests the shared Edge Function version of sourceOrchestrator
 * which doesn't have Supabase dependencies, making it suitable for testing.
 */

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ text: 'Mock AI analysis response' }],
          usage: { total_tokens: 150 }
        })
      }
    }))
  };
});

describe('SourceOrchestrator V2', () => {
  let mockAnthropic;

  beforeEach(() => {
    // Set up environment variable
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.clearAllMocks();
    
    // Create mock anthropic client
    mockAnthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ text: 'Mock AI analysis response' }],
          usage: { total_tokens: 150 }
        })
      }
    };
  });

  test('should analyze a basic source successfully', async () => {
    const mockSource = {
      id: 'test-source-1',
      name: 'Test Energy Grants API',
      api_endpoint: 'https://api.energy.gov/grants',
      configurations: {
        request_config: { method: 'GET' },
        query_parameters: { limit: 100 }
      }
    };

    const result = await analyzeSource(mockSource, mockAnthropic);

    expect(result).toMatchObject({
      workflow: 'single_api',
      apiEndpoint: 'https://api.energy.gov/grants',
      requestConfig: { method: 'GET' },
      queryParameters: {},
      estimatedComplexity: 'moderate',
      confidence: 85,
      tokensUsed: 150
    });

    expect(result.executionTime).toBeGreaterThan(0);
    expect(result.processingNotes).toContain('Analysis completed for Test Energy Grants API');
  });

  test('should identify two-step API workflow', async () => {
    const mockSource = {
      id: 'test-source-2',
      name: 'Two-Step API',
      api_endpoint: 'https://api.example.com/list',
      configurations: {
        detail_config: { enabled: true, endpoint: '/details/{id}' },
        request_config: { method: 'GET' }
      }
    };

    const result = await analyzeSource(mockSource, mockAnthropic);

    expect(result.workflow).toBe('two_step_api');
    expect(result.detailConfig).toEqual({ 
      enabled: true, 
      endpoint: '/details/{id}' 
    });
  });

  test('should handle missing configurations gracefully', async () => {
    const mockSource = {
      id: 'test-source-3',
      name: 'Minimal Source',
      api_endpoint: 'https://api.minimal.com/data',
      configurations: {}
    };

    const result = await analyzeSource(mockSource, mockAnthropic);

    expect(result).toMatchObject({
      workflow: 'single_api',
      apiEndpoint: 'https://api.minimal.com/data',
      requestConfig: { method: 'GET' },
      queryParameters: {},
      requestBody: null,
      authMethod: 'none',
      authDetails: {}
    });
  });

  test('should throw error for invalid source', async () => {
    const invalidSource = null;

    await expect(analyzeSource(invalidSource, mockAnthropic)).rejects.toThrow();
  });

  test('should throw error for source without name', async () => {
    const invalidSource = {
      id: 'test-source-4',
      api_endpoint: 'https://api.example.com',
      configurations: {}
      // Missing name
    };

    await expect(analyzeSource(invalidSource, mockAnthropic)).rejects.toThrow();
  });

  test('should include AI response in output', async () => {
    const mockSource = {
      id: 'test-source-5',
      name: 'AI Response Test',
      api_endpoint: 'https://api.test.com/data',
      configurations: {}
    };

    const result = await analyzeSource(mockSource, mockAnthropic);

    expect(result.tokensUsed).toBe(150);
  });

  test('should format configurations correctly', async () => {
    const mockSource = {
      id: 'test-source-6',
      name: 'Complex Config Source',
      api_endpoint: 'https://api.complex.com/data',
      configurations: {
        request_config: { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        request_body: { query: 'energy grants', filters: ['active'] },
        pagination_config: { enabled: true, pageSize: 50 },
        auth_method: 'bearer',
        auth_details: { tokenHeader: 'Authorization' }
      }
    };

    const result = await analyzeSource(mockSource, mockAnthropic);

    expect(result.requestConfig).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    expect(result.requestBody).toEqual({
      query: 'energy grants',
      filters: ['active']
    });
    expect(result.paginationConfig).toEqual({
      enabled: true,
      pageSize: 50
    });
    expect(result.authMethod).toBe('bearer');
    expect(result.authDetails).toEqual({
      tokenHeader: 'Authorization'
    });
  });
}); 