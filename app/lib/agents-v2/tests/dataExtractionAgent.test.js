import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { extractFromSource } from '../core/dataExtractionAgent.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env.local') });

/**
 * Test suite for DataExtractionAgent V2
 * 
 * Tests the API data collection, field mapping, and taxonomy standardization
 */

// Mock global fetch
global.fetch = vi.fn();

// Mock the centralized anthropic client
vi.mock('../utils/anthropicClient.js', () => {
  return {
    getAnthropicClient: vi.fn(() => ({
      callWithSchema: vi.fn().mockResolvedValue({
        data: {
          opportunities: [
            {
              id: 'grant-123',
              title: 'Energy Efficiency Grants',
              description: 'Funding for energy efficiency improvements',
              totalFundingAvailable: 5000000,
              minimumAward: 25000,
              maximumAward: 500000,
              openDate: '2024-01-15',
              closeDate: '2024-12-31',
              eligibleApplicants: ['Schools', 'Municipal Government'],
              eligibleProjectTypes: ['HVAC', 'Lighting'],
              eligibleLocations: ['CA', 'OR'],
              fundingType: 'grant',
              url: 'https://example.com/grant',
              status: 'open',
              categories: ['Energy'],
              isNational: false
            }
          ]
        },
        usage: { total_tokens: 200 }
      })
    })),
    schemas: {
      dataExtraction: {
        name: 'data_extraction',
        description: 'Extract funding opportunities from data'
      }
    }
  };
});

// Mock Supabase client
vi.mock('../../supabase.js', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [{ id: 'raw-response-id' }], error: null }))
      }))
    }))
  }))
}));

describe('DataExtractionAgent V2', () => {
  let mockSource;
  let mockProcessingInstructions;

  beforeEach(() => {
    // Set up environment variable
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.clearAllMocks();
    
    // Reset fetch mock
    fetch.mockClear();

    mockSource = {
      id: 'test-source-1',
      name: 'Test Energy API',
      api_endpoint: 'https://api.energy.gov/grants'
    };

    mockProcessingInstructions = {
      workflow: 'single_api',
      apiEndpoint: 'https://api.energy.gov/grants',
      requestConfig: { method: 'GET' },
      queryParameters: { limit: 100 },
      requestBody: null,
      authMethod: 'none',
      authDetails: {}
    };
  });

  test('should extract from single API successfully', async () => {
    // Mock API response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        {
          id: 'api-grant-1',
          name: 'School Energy Program',
          amount: '$500,000',
          deadline: '2024-12-31'
        }
      ])
    });

    const result = await extractFromSource(mockSource, mockProcessingInstructions);

    expect(result).toMatchObject({
      opportunities: expect.any(Array),
      extractionMetrics: {
        totalFound: expect.any(Number),
        successfullyExtracted: expect.any(Number),
        workflow: 'single_api',
        apiCalls: expect.any(String)
      },
      executionTime: expect.any(Number),
      rawResponseId: expect.any(String)
    });

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]).toMatchObject({
      id: 'grant-123',
      title: 'Energy Efficiency Grants',
      sourceId: 'test-source-1',
      sourceName: 'Test Energy API',
      rawResponseId: expect.any(String)
    });
  });

  test('should handle two-step API workflow', async () => {
    const twoStepInstructions = {
      ...mockProcessingInstructions,
      workflow: 'two_step_api',
      detailConfig: {
        enabled: true,
        endpoint: 'https://api.energy.gov/grants/detail',
        method: 'GET',
        idParam: 'id'
      }
    };

    // Mock list API response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { id: 'grant-1' },
        { id: 'grant-2' }
      ])
    });

    // Mock detail API responses - need to make sure we have the right number of calls
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'grant-1',
        title: 'First Grant',
        description: 'First grant description'
      })
    });

    const result = await extractFromSource(mockSource, twoStepInstructions);

    expect(result.extractionMetrics.workflow).toBe('two_step_api');
    expect(result.extractionMetrics.apiCalls).toBe('multiple');
    expect(fetch).toHaveBeenCalled();
  });

  test('should handle API authentication', async () => {
    const authInstructions = {
      ...mockProcessingInstructions,
      authMethod: 'apikey',
      authDetails: {
        apiKey: 'test-api-key',
        keyHeader: 'X-API-Key'
      }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([])
    });

    await extractFromSource(mockSource, authInstructions);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'test-api-key'
        })
      })
    );
  });

  test('should process schema-based data extraction correctly', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{
        id: 'raw-456',
        title: 'Raw API Grant',
        amount: '$1,500,000',
        deadline: '2024-06-01T00:00:00Z'
      }])
    });

    // Mock schema response with standardized data
    const { getAnthropicClient } = await import('../utils/anthropicClient.js');
    
    getAnthropicClient().callWithSchema.mockResolvedValueOnce({
      data: {
        opportunities: [
          {
            id: 'grant-456',
            title: 'Schema Processed Grant',
            totalFundingAvailable: 1500000,
            minimumAward: 10000,
            maximumAward: null,
            openDate: '2024-06-01',
            closeDate: null,
            eligibleApplicants: ['School Districts', 'Municipal Government'],
            eligibleProjectTypes: ['HVAC', 'Solar'],
            eligibleLocations: ['CA', 'TX'],
            fundingType: 'grant',
            status: 'open'
          }
        ]
      },
      usage: { total_tokens: 150 }
    });

    const result = await extractFromSource(mockSource, mockProcessingInstructions);

    const opportunity = result.opportunities[0];
    
    // Verify schema-based extraction returns properly structured data
    expect(opportunity.id).toBe('grant-456');
    expect(opportunity.title).toBe('Schema Processed Grant');
    expect(opportunity.totalFundingAvailable).toBe(1500000);
    expect(opportunity.openDate).toBe('2024-06-01');
    expect(opportunity.eligibleApplicants).toEqual(['School Districts', 'Municipal Government']);
    expect(opportunity.sourceId).toBe('test-source-1');
    expect(opportunity.rawResponseId).toBeDefined();
  });

  test('should handle API errors gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(extractFromSource(mockSource, mockProcessingInstructions))
      .rejects.toThrow('Network error');
  });

  test('should handle invalid schema responses', async () => {
    // Import the mock to modify it for this specific test
    const { getAnthropicClient } = await import('../utils/anthropicClient.js');
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{}])
    });

    // Mock invalid schema response
    getAnthropicClient().callWithSchema.mockResolvedValueOnce({
      data: { opportunities: [] }, // Empty but valid response
      usage: { total_tokens: 50 }
    });

    const result = await extractFromSource(mockSource, mockProcessingInstructions);

    // Should return empty opportunities array when schema returns no data
    expect(result.opportunities).toEqual([]);
    expect(result.extractionMetrics.successfullyExtracted).toBe(0);
  });

  test('should validate required inputs', async () => {
    await expect(extractFromSource(null, mockProcessingInstructions))
      .rejects.toThrow('Source and processing instructions are required');

    await expect(extractFromSource(mockSource, null))
      .rejects.toThrow('Source and processing instructions are required');
  });

  test('should handle empty API responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([])
    });

    const result = await extractFromSource(mockSource, mockProcessingInstructions);

    expect(result.opportunities).toEqual([]);
    expect(result.extractionMetrics.totalFound).toBe(0);
    expect(result.extractionMetrics.successfullyExtracted).toBe(0);
  });
}); 