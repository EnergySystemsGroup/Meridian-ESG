import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { enhanceOpportunities } from '../core/analysisAgent.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env.local') });

/**
 * Test suite for AnalysisAgent V2
 * 
 * Tests content enhancement and systematic scoring functionality
 */

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ 
            text: JSON.stringify([
              {
                opportunityIndex: 0,
                enhancedDescription: "The State Energy Office Energy Efficiency Program provides comprehensive funding for K-12 educational institutions to implement building performance improvements. This multi-year initiative focuses on HVAC system upgrades, lighting retrofits, and building envelope enhancements that demonstrate measurable energy savings.",
                actionableSummary: "State Energy Office offers grants for K-12 schools to upgrade HVAC and lighting systems. School districts can receive $25K-500K each with applications due December 31, 2024.",
                scoring: {
                  projectTypeMatch: 3,
                  clientTypeMatch: 3,
                  categoryMatch: 2,
                  fundingThreshold: 0,
                  fundingType: 1,
                  overallScore: 9
                },
                scoringExplanation: "High relevance due to perfect project type match (HVAC/energy efficiency) and client alignment (school districts). Strong category fit for energy programs.",
                concerns: [],
                fundingPerApplicant: 500000
              }
            ])
          }],
          usage: { total_tokens: 300 }
        })
      }
    }))
  };
});

describe('AnalysisAgent V2', () => {
  let mockAnthropic;
  let mockSource;
  let mockOpportunities;

  beforeEach(() => {
    // Set up environment variable
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.clearAllMocks();
    
    // Create mock anthropic client
    mockAnthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ 
            text: JSON.stringify([
              {
                opportunityIndex: 0,
                enhancedDescription: "Enhanced description for energy efficiency grants",
                actionableSummary: "K-12 schools can apply for HVAC upgrades with $25K-500K funding",
                scoring: {
                  projectTypeMatch: 3,
                  clientTypeMatch: 3,
                  categoryMatch: 2,
                  fundingThreshold: 0,
                  fundingType: 1,
                  overallScore: 9
                },
                scoringExplanation: "Perfect match for energy efficiency projects",
                concerns: [],
                fundingPerApplicant: 500000
              }
            ])
          }],
          usage: { total_tokens: 250 }
        })
      }
    };

    mockSource = {
      id: 'test-source-1',
      name: 'Test Energy Agency'
    };

    mockOpportunities = [
      {
        id: 'grant-123',
        title: 'Energy Efficiency Grants',
        description: 'Funding for energy efficiency improvements',
        totalFundingAvailable: 5000000,
        minimumAward: 25000,
        maximumAward: 500000,
        openDate: '2024-01-15',
        closeDate: '2024-12-31',
        eligibleApplicants: ['School Districts'],
        eligibleProjectTypes: ['HVAC', 'Lighting'],
        eligibleLocations: ['CA', 'OR'],
        fundingType: 'grant',
        status: 'open'
      }
    ];
  });

  test('should enhance opportunities successfully', async () => {
    const result = await enhanceOpportunities(mockOpportunities, mockSource, mockAnthropic);

    expect(result).toMatchObject({
      opportunities: expect.any(Array),
      analysisMetrics: {
        totalAnalyzed: 1,
        averageScore: expect.any(Number),
        scoreDistribution: expect.objectContaining({
          high: expect.any(Number),
          medium: expect.any(Number),
          low: expect.any(Number)
        }),
        meetsFundingThreshold: expect.any(Number),
        grantFunding: expect.any(Number)
      },
      executionTime: expect.any(Number)
    });

    expect(result.opportunities).toHaveLength(1);
    
    const enhancedOpp = result.opportunities[0];
    expect(enhancedOpp).toMatchObject({
      id: 'grant-123',
      title: 'Energy Efficiency Grants',
      enhancedDescription: expect.any(String),
      actionableSummary: expect.any(String),
      scoring: {
        projectTypeMatch: expect.any(Number),
        clientTypeMatch: expect.any(Number),
        categoryMatch: expect.any(Number),
        fundingThreshold: expect.any(Number),
        fundingType: expect.any(Number),
        overallScore: expect.any(Number)
      },
      scoringExplanation: expect.any(String),
      concerns: expect.any(Array),
      fundingPerApplicant: expect.any(Number)
    });

    // Check scoring constraints
    expect(enhancedOpp.scoring.projectTypeMatch).toBeGreaterThanOrEqual(0);
    expect(enhancedOpp.scoring.projectTypeMatch).toBeLessThanOrEqual(3);
    expect(enhancedOpp.scoring.clientTypeMatch).toBeGreaterThanOrEqual(0);
    expect(enhancedOpp.scoring.clientTypeMatch).toBeLessThanOrEqual(3);
    expect(enhancedOpp.scoring.categoryMatch).toBeGreaterThanOrEqual(0);
    expect(enhancedOpp.scoring.categoryMatch).toBeLessThanOrEqual(2);
    expect(enhancedOpp.scoring.fundingThreshold).toBeGreaterThanOrEqual(0);
    expect(enhancedOpp.scoring.fundingThreshold).toBeLessThanOrEqual(1);
    expect(enhancedOpp.scoring.fundingType).toBeGreaterThanOrEqual(0);
    expect(enhancedOpp.scoring.fundingType).toBeLessThanOrEqual(1);
  });

  test('should handle empty opportunities array', async () => {
    const result = await enhanceOpportunities([], mockSource, mockAnthropic);

    expect(result).toEqual({
      opportunities: [],
      analysisMetrics: {
        totalAnalyzed: 0,
        averageScore: 0,
        scoreDistribution: { high: 0, medium: 0, low: 0 },
        meetsFundingThreshold: 0,
        grantFunding: 0
      },
      executionTime: expect.any(Number)
    });

    expect(result.executionTime).toBeGreaterThan(0);
    expect(mockAnthropic.messages.create).not.toHaveBeenCalled();
  });

  test('should handle multiple opportunities in batches', async () => {
    const multipleOpportunities = [
      ...mockOpportunities,
      {
        id: 'grant-456',
        title: 'Solar Installation Grants',
        description: 'Funding for solar panel installations',
        maximumAward: 1000000,
        fundingType: 'grant'
      },
      {
        id: 'grant-789',
        title: 'HVAC Upgrade Program',
        description: 'Heating and cooling system improvements',
        maximumAward: 750000,
        fundingType: 'loan'
      }
    ];

    // Mock response for multiple opportunities
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{ 
        text: JSON.stringify([
          {
            opportunityIndex: 0,
            enhancedDescription: "Enhanced description 1",
            actionableSummary: "Summary 1",
            scoring: { projectTypeMatch: 3, clientTypeMatch: 3, categoryMatch: 2, fundingThreshold: 0, fundingType: 1 },
            scoringExplanation: "High relevance",
            concerns: [],
            fundingPerApplicant: 500000
          },
          {
            opportunityIndex: 1,
            enhancedDescription: "Enhanced description 2", 
            actionableSummary: "Summary 2",
            scoring: { projectTypeMatch: 3, clientTypeMatch: 2, categoryMatch: 2, fundingThreshold: 1, fundingType: 1 },
            scoringExplanation: "Very high relevance",
            concerns: [],
            fundingPerApplicant: 1000000
          },
          {
            opportunityIndex: 2,
            enhancedDescription: "Enhanced description 3",
            actionableSummary: "Summary 3", 
            scoring: { projectTypeMatch: 3, clientTypeMatch: 3, categoryMatch: 2, fundingThreshold: 0, fundingType: 0 },
            scoringExplanation: "Good relevance but loan funding",
            concerns: ["Loan funding instead of grant"],
            fundingPerApplicant: 750000
          }
        ])
      }],
      usage: { total_tokens: 500 }
    });

    const result = await enhanceOpportunities(multipleOpportunities, mockSource, mockAnthropic);

    expect(result.opportunities).toHaveLength(3);
    expect(result.analysisMetrics.totalAnalyzed).toBe(3);
    expect(result.analysisMetrics.averageScore).toBeGreaterThan(0);
    
    // Check that high scoring opportunities are counted correctly
    const highScoreOpps = result.opportunities.filter(opp => opp.scoring.overallScore >= 7);
    expect(result.analysisMetrics.scoreDistribution.high).toBe(highScoreOpps.length);
  });

  test('should handle AI parsing failures gracefully', async () => {
    // Mock invalid AI response
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{ text: 'Invalid JSON response that cannot be parsed' }],
      usage: { total_tokens: 50 }
    });

    const result = await enhanceOpportunities(mockOpportunities, mockSource, mockAnthropic);

    expect(result.opportunities).toHaveLength(1);
    
    const opportunity = result.opportunities[0];
    expect(opportunity.enhancedDescription).toBeDefined();
    expect(opportunity.actionableSummary).toContain('Analysis failed');
    expect(opportunity.scoring.overallScore).toBe(0);
    expect(opportunity.concerns).toContain('AI analysis failed');
  });

  test('should calculate analysis metrics correctly', async () => {
    const mixedOpportunities = [
      { ...mockOpportunities[0] }, // Will get high score (9)
      { ...mockOpportunities[0], id: 'grant-456' }, // Will get high score (9)
      { ...mockOpportunities[0], id: 'grant-789' }  // Will get high score (9)
    ];

    // Mock responses with different scores
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{ 
        text: JSON.stringify([
          {
            opportunityIndex: 0,
            enhancedDescription: "High scoring opportunity",
            actionableSummary: "High score summary",
            scoring: { projectTypeMatch: 3, clientTypeMatch: 3, categoryMatch: 2, fundingThreshold: 1, fundingType: 1 },
            scoringExplanation: "Perfect match",
            concerns: [],
            fundingPerApplicant: 1500000
          },
          {
            opportunityIndex: 1,
            enhancedDescription: "Medium scoring opportunity",
            actionableSummary: "Medium score summary",
            scoring: { projectTypeMatch: 2, clientTypeMatch: 2, categoryMatch: 1, fundingThreshold: 0, fundingType: 1 },
            scoringExplanation: "Good match",
            concerns: [],
            fundingPerApplicant: 500000
          },
          {
            opportunityIndex: 2,
            enhancedDescription: "Low scoring opportunity",
            actionableSummary: "Low score summary",
            scoring: { projectTypeMatch: 1, clientTypeMatch: 1, categoryMatch: 0, fundingThreshold: 0, fundingType: 0 },
            scoringExplanation: "Poor match",
            concerns: ["Low relevance"],
            fundingPerApplicant: 100000
          }
        ])
      }],
      usage: { total_tokens: 400 }
    });

    const result = await enhanceOpportunities(mixedOpportunities, mockSource, mockAnthropic);

    expect(result.analysisMetrics.totalAnalyzed).toBe(3);
    expect(result.analysisMetrics.scoreDistribution.high).toBe(1); // Score 10
    expect(result.analysisMetrics.scoreDistribution.medium).toBe(1); // Score 6  
    expect(result.analysisMetrics.scoreDistribution.low).toBe(1); // Score 2
    expect(result.analysisMetrics.meetsFundingThreshold).toBe(1); // Only first has fundingThreshold: 1
  });

  test('should validate input parameters', async () => {
    await expect(enhanceOpportunities('not an array', mockSource, mockAnthropic))
      .rejects.toThrow('Opportunities must be an array');

    await expect(enhanceOpportunities(null, mockSource, mockAnthropic))
      .rejects.toThrow('Opportunities must be an array');
  });

  test('should handle missing analysis data gracefully', async () => {
    // Mock response missing some opportunities
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{ 
        text: JSON.stringify([
          // Missing opportunityIndex: 0 - should get default values
        ])
      }],
      usage: { total_tokens: 100 }
    });

    const result = await enhanceOpportunities(mockOpportunities, mockSource, mockAnthropic);

    expect(result.opportunities).toHaveLength(1);
    
    const opportunity = result.opportunities[0];
    expect(opportunity.actionableSummary).toContain('Review required');
    expect(opportunity.scoring.overallScore).toBe(0);
    expect(opportunity.concerns).toContain('Analysis failed');
  });

  test('should enforce scoring constraints', async () => {
    // Mock response with out-of-bounds scores
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{ 
        text: JSON.stringify([
          {
            opportunityIndex: 0,
            enhancedDescription: "Test description",
            actionableSummary: "Test summary",
            scoring: {
              projectTypeMatch: 5, // Should be clamped to 3
              clientTypeMatch: -1, // Should be clamped to 0
              categoryMatch: 3,    // Should be clamped to 2
              fundingThreshold: 2, // Should be clamped to 1
              fundingType: -5      // Should be clamped to 0
            },
            scoringExplanation: "Test explanation",
            concerns: [],
            fundingPerApplicant: 500000
          }
        ])
      }],
      usage: { total_tokens: 200 }
    });

    const result = await enhanceOpportunities(mockOpportunities, mockSource, mockAnthropic);

    const scoring = result.opportunities[0].scoring;
    expect(scoring.projectTypeMatch).toBe(3); // Clamped from 5
    expect(scoring.clientTypeMatch).toBe(0);  // Clamped from -1
    expect(scoring.categoryMatch).toBe(2);    // Clamped from 3
    expect(scoring.fundingThreshold).toBe(1); // Clamped from 2
    expect(scoring.fundingType).toBe(0);      // Clamped from -5
    expect(scoring.overallScore).toBe(6);     // Sum: 3+0+2+1+0 = 6
  });
}); 