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

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ 
            text: JSON.stringify([
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
            ])
          }],
          usage: { total_tokens: 200 }
        })
      }
    }))
  };
});

describe('DataExtractionAgent V2', () => {
  let mockAnthropic;
  let mockSource;
  let mockProcessingInstructions;

  beforeEach(() => {
    // Set up environment variable
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.clearAllMocks();
    
    // Reset fetch mock
    fetch.mockClear();
    
    // Create mock anthropic client
    mockAnthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ 
            text: JSON.stringify([
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
            ])
          }],
          usage: { total_tokens: 200 }
        })
      }
    };

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

    const result = await extractFromSource(mockSource, mockProcessingInstructions, mockAnthropic);

    expect(result).toMatchObject({
      opportunities: expect.any(Array),
      extractionMetrics: {
        totalFound: expect.any(Number),
        successfullyExtracted: expect.any(Number),
        workflow: 'single_api',
        apiCalls: 'single'
      },
      executionTime: expect.any(Number)
    });

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]).toMatchObject({
      id: 'grant-123',
      title: 'Energy Efficiency Grants',
      sourceId: 'test-source-1',
      sourceName: 'Test Energy API'
    });
  });

  test('should handle two-step API workflow', async () => {
    const twoStepInstructions = {
      ...mockProcessingInstructions,
      workflow: 'two_step_api',
      detailConfig: {
        endpoint: '/grants/{id}'
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

    // Mock detail API responses
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'grant-1',
        title: 'First Grant',
        description: 'First grant description'
      })
    });

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'grant-2', 
        title: 'Second Grant',
        description: 'Second grant description'
      })
    });

    const result = await extractFromSource(mockSource, twoStepInstructions, mockAnthropic);

    expect(result.extractionMetrics.workflow).toBe('two_step_api');
    expect(result.extractionMetrics.apiCalls).toBe('multiple');
    expect(fetch).toHaveBeenCalledTimes(3); // 1 list + 2 detail calls
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

    await extractFromSource(mockSource, authInstructions, mockAnthropic);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'test-api-key'
        })
      })
    );
  });

  test('should standardize opportunity fields correctly', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{}])
    });

    // Mock AI response with varied data formats
    mockAnthropic.messages.create.mockResolvedValueOnce({
      content: [{ 
        text: JSON.stringify([
          {
            id: 'grant-456',
            title: 'Mixed Format Grant',
            totalFundingAvailable: '$1,500,000',
            minimumAward: '10000',
            maximumAward: null,
            openDate: '2024-06-01T00:00:00Z',
            closeDate: 'invalid-date',
            eligibleApplicants: ['k-12', 'municipal'],
            eligibleProjectTypes: ['hvac', 'solar'],
            eligibleLocations: ['california', 'texas'],
            fundingType: 'loan program',
            status: 'OPEN'
          }
        ])
      }],
      usage: { total_tokens: 150 }
    });

    const result = await extractFromSource(mockSource, mockProcessingInstructions, mockAnthropic);

    const opportunity = result.opportunities[0];
    
    // Check amount parsing
    expect(opportunity.totalFundingAvailable).toBe(1500000);
    expect(opportunity.minimumAward).toBe(10000);
    expect(opportunity.maximumAward).toBeNull();
    
    // Check date standardization
    expect(opportunity.openDate).toBe('2024-06-01');
    expect(opportunity.closeDate).toBeNull(); // Invalid date should be null
    
    // Check taxonomy normalization
    expect(opportunity.eligibleApplicants).toContain('School Districts');
    expect(opportunity.eligibleApplicants).toContain('Municipal Government');
    expect(opportunity.eligibleProjectTypes).toContain('HVAC');
    expect(opportunity.eligibleProjectTypes).toContain('Solar');
    expect(opportunity.eligibleLocations).toContain('CA');
    expect(opportunity.eligibleLocations).toContain('TX');
    
    // Check other normalizations
    expect(opportunity.fundingType).toBe('loan');
    expect(opportunity.status).toBe('open');
  });

  test('should handle API errors gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(extractFromSource(mockSource, mockProcessingInstructions, mockAnthropic))
      .rejects.toThrow('Network error');
  });

  test('should handle invalid AI responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{}])
    });

    // Mock invalid AI response
    mockAnthropic.messages.create.mockResolvedValueOnce({
      content: [{ text: 'Invalid JSON response' }],
      usage: { total_tokens: 50 }
    });

    const result = await extractFromSource(mockSource, mockProcessingInstructions, mockAnthropic);

    // Should return empty opportunities array when AI parsing fails
    expect(result.opportunities).toEqual([]);
    expect(result.extractionMetrics.successfullyExtracted).toBe(0);
  });

  test('should validate required inputs', async () => {
    await expect(extractFromSource(null, mockProcessingInstructions, mockAnthropic))
      .rejects.toThrow('Source and processing instructions are required');

    await expect(extractFromSource(mockSource, null, mockAnthropic))
      .rejects.toThrow('Source and processing instructions are required');
  });

  test('should handle empty API responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([])
    });

    mockAnthropic.messages.create.mockResolvedValueOnce({
      content: [{ text: '[]' }],
      usage: { total_tokens: 20 }
    });

    const result = await extractFromSource(mockSource, mockProcessingInstructions, mockAnthropic);

    expect(result.opportunities).toEqual([]);
    expect(result.extractionMetrics.totalFound).toBe(0);
    expect(result.extractionMetrics.successfullyExtracted).toBe(0);
  });
}); 