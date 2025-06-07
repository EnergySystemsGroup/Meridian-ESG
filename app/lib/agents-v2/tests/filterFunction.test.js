import { describe, test, expect, beforeEach } from 'vitest';
import { 
  filterOpportunities, 
  createFilterConfig, 
  getDefaultFilterConfig,
  applyStrictFiltering,
  applyLenientFiltering
} from '../core/filterFunction.js';

/**
 * Test suite for Filter Function V2
 * 
 * Tests programmatic filtering logic based on scores and thresholds
 */

describe('Filter Function V2', () => {
  let mockOpportunities;

  beforeEach(() => {
    mockOpportunities = [
      // High-scoring opportunity (should pass all filters)
      {
        id: 'grant-1',
        title: 'Energy Efficiency Grants',
        description: 'HVAC upgrade funding',
        status: 'open',
        fundingType: 'grant',
        maximumAward: 1000000,
        scoring: {
          projectTypeMatch: 3,
          clientTypeMatch: 3,
          categoryMatch: 2,
          fundingThreshold: 1,
          fundingType: 1,
          overallScore: 10
        },
        enhancedDescription: 'Enhanced description available'
      },
      // Medium-scoring opportunity (should pass default filters)
      {
        id: 'grant-2', 
        title: 'Solar Installation Program',
        description: 'Solar panel funding',
        status: 'open',
        fundingType: 'grant',
        maximumAward: 500000,
        scoring: {
          projectTypeMatch: 2,
          clientTypeMatch: 2,
          categoryMatch: 1,
          fundingThreshold: 0,
          fundingType: 1,
          overallScore: 6
        }
      },
      // Low-scoring opportunity (should be excluded by default)
      {
        id: 'grant-3',
        title: 'Unrelated Program',
        description: 'Not energy related',
        status: 'open',
        fundingType: 'loan',
        maximumAward: 100000,
        scoring: {
          projectTypeMatch: 0,
          clientTypeMatch: 1,
          categoryMatch: 0,
          fundingThreshold: 0,
          fundingType: 0,
          overallScore: 1
        }
      },
      // Closed opportunity (should be excluded)
      {
        id: 'grant-4',
        title: 'Closed Energy Grant',
        description: 'Great opportunity but closed',
        status: 'closed',
        fundingType: 'grant',
        maximumAward: 2000000,
        scoring: {
          projectTypeMatch: 3,
          clientTypeMatch: 3,
          categoryMatch: 2,
          fundingThreshold: 1,
          fundingType: 1,
          overallScore: 10
        }
      },
      // Borderline opportunity (score = 2, exactly at default threshold)
      {
        id: 'grant-5',
        title: 'Borderline Opportunity',
        description: 'Right at threshold',
        status: 'open',
        fundingType: 'grant',
        maximumAward: 250000,
        scoring: {
          projectTypeMatch: 1,
          clientTypeMatch: 1,
          categoryMatch: 0,
          fundingThreshold: 0,
          fundingType: 0,
          overallScore: 2
        }
      }
    ];
  });

  test('should filter opportunities with default configuration', () => {
    const result = filterOpportunities(mockOpportunities);

    expect(result).toMatchObject({
      includedOpportunities: expect.any(Array),
      excludedOpportunities: expect.any(Array),
      filterMetrics: {
        totalAnalyzed: 5,
        included: expect.any(Number),
        excluded: expect.any(Number),
        exclusionReasons: expect.any(Object),
        inclusionRate: expect.any(Number)
      },
      executionTime: expect.any(Number)
    });

    // Should include high and medium scoring opportunities (grant-5 excluded due to non-grant + low score)
    expect(result.includedOpportunities).toHaveLength(2); // grant-1, grant-2
    expect(result.excludedOpportunities).toHaveLength(3); // grant-3 (low score), grant-4 (closed), grant-5 (non-grant + insufficient score)

    // Check specific inclusions
    const includedIds = result.includedOpportunities.map(opp => opp.id);
    expect(includedIds).toContain('grant-1'); // High score
    expect(includedIds).toContain('grant-2'); // Medium score

    // Check specific exclusions
    const excludedIds = result.excludedOpportunities.map(opp => opp.id);
    expect(excludedIds).toContain('grant-3'); // Low score
    expect(excludedIds).toContain('grant-4'); // Closed status
    expect(excludedIds).toContain('grant-5'); // Non-grant funding with insufficient score

    // Check metrics
    expect(result.filterMetrics.inclusionRate).toBe(40); // 2/5 = 40%
    expect(result.filterMetrics.exclusionReasons).toHaveProperty('low_overall_score_1');
    expect(result.filterMetrics.exclusionReasons).toHaveProperty('opportunity_closed');
  });

  test('should handle empty opportunities array', () => {
    const result = filterOpportunities([]);

    expect(result).toEqual({
      includedOpportunities: [],
      excludedOpportunities: [],
      filterMetrics: {
        totalAnalyzed: 0,
        included: 0,
        excluded: 0,
        exclusionReasons: {}
      },
      executionTime: expect.any(Number)
    });

    expect(result.executionTime).toBeGreaterThan(0);
  });

  test('should apply custom filtering configuration', () => {
    const strictConfig = createFilterConfig({
      minimumOverallScore: 7,
      minimumProjectTypeMatch: 2,
      minimumClientTypeMatch: 2
    });

    const result = filterOpportunities(mockOpportunities, strictConfig);

    // Only grant-1 should pass (score 10, perfect matches)
    expect(result.includedOpportunities).toHaveLength(1);
    expect(result.includedOpportunities[0].id).toBe('grant-1');
    expect(result.excludedOpportunities).toHaveLength(4);
  });

  test('should handle opportunities without scoring data', () => {
    const opportunitiesWithoutScoring = [
      {
        id: 'no-score-1',
        title: 'No Scoring Data',
        status: 'open'
      },
      {
        id: 'partial-score-1',
        title: 'Partial Scoring',
        status: 'open',
        scoring: {
          projectTypeMatch: 2
          // Missing other scoring fields
        }
      }
    ];

    const result = filterOpportunities(opportunitiesWithoutScoring);

    // Both should be excluded due to missing/insufficient scoring
    expect(result.includedOpportunities).toHaveLength(0);
    expect(result.excludedOpportunities).toHaveLength(2);
    expect(result.filterMetrics.exclusionReasons).toHaveProperty('low_overall_score_0');
  });

  test('should apply funding type preferences correctly', () => {
    const grantPreferenceConfig = createFilterConfig({
      minimumOverallScore: 2,
      preferGrants: true
    });

    // Test with loan opportunity that has medium score
    const loanOpportunity = [{
      id: 'loan-1',
      title: 'Medium Score Loan',
      status: 'open',
      fundingType: 'loan',
      scoring: {
        projectTypeMatch: 1,
        clientTypeMatch: 1,
        categoryMatch: 1,
        fundingThreshold: 0,
        fundingType: 0, // Not a grant
        overallScore: 3 // Above minimum but not high enough to compensate for non-grant
      }
    }];

    const result = filterOpportunities(loanOpportunity, grantPreferenceConfig);

    // Should be excluded because it's not a grant and score isn't high enough
    expect(result.includedOpportunities).toHaveLength(0);
    expect(result.excludedOpportunities).toHaveLength(1);
    expect(result.filterMetrics.exclusionReasons).toHaveProperty('non_grant_funding_insufficient_score');
  });

  test('should exclude closed and expired opportunities', () => {
    const closedOpportunities = [
      {
        id: 'closed-1',
        title: 'Closed Opportunity',
        status: 'closed',
        scoring: { 
          overallScore: 8,
          projectTypeMatch: 2,
          clientTypeMatch: 2 
        }
      },
      {
        id: 'expired-1',
        title: 'Expired Opportunity', 
        status: 'expired',
        scoring: { 
          overallScore: 9,
          projectTypeMatch: 2,
          clientTypeMatch: 2 
        }
      },
      {
        id: 'open-1',
        title: 'Open Opportunity',
        status: 'open',
        scoring: { 
          overallScore: 5,
          projectTypeMatch: 2,
          clientTypeMatch: 2 
        }
      }
    ];

    const result = filterOpportunities(closedOpportunities);

    expect(result.includedOpportunities).toHaveLength(1);
    expect(result.includedOpportunities[0].id).toBe('open-1');
    expect(result.excludedOpportunities).toHaveLength(2);
    expect(result.filterMetrics.exclusionReasons.opportunity_closed).toBe(2);
  });

  test('should validate input parameters', () => {
    expect(() => filterOpportunities('not an array'))
      .toThrow('Opportunities must be an array');

    expect(() => filterOpportunities(null))
      .toThrow('Opportunities must be an array');
  });

  test('should add filter results to opportunities', () => {
    const result = filterOpportunities(mockOpportunities);

    // Check included opportunities have filter results
    result.includedOpportunities.forEach(opp => {
      expect(opp.filterResult).toMatchObject({
        passed: true,
        reason: expect.stringMatching(/passed_with_score_\d+/)
      });
    });

    // Check excluded opportunities have filter results
    result.excludedOpportunities.forEach(opp => {
      expect(opp.filterResult).toMatchObject({
        passed: false,
        reason: expect.any(String)
      });
    });
  });

  test('should apply strict filtering correctly', () => {
    const result = applyStrictFiltering(mockOpportunities);

    // Only the highest-scoring opportunity should pass
    expect(result.includedOpportunities).toHaveLength(1);
    expect(result.includedOpportunities[0].id).toBe('grant-1');
    expect(result.filterMetrics.inclusionRate).toBe(20); // 1/5 = 20%
  });

  test('should apply lenient filtering correctly', () => {
    const result = applyLenientFiltering(mockOpportunities);

    // Should include most opportunities except closed ones
    expect(result.includedOpportunities).toHaveLength(4);
    expect(result.excludedOpportunities).toHaveLength(1);
    
    // Should exclude only the closed opportunity
    expect(result.excludedOpportunities[0].id).toBe('grant-4');
    expect(result.filterMetrics.inclusionRate).toBe(80); // 4/5 = 80%
  });

  test('should handle funding threshold preferences', () => {
    const thresholdConfig = createFilterConfig({
      minimumOverallScore: 2,
      preferFundingThreshold: true
    });

    // Opportunity with low funding that doesn't meet threshold
    const lowFundingOpportunity = [{
      id: 'low-funding-1',
      title: 'Low Funding Opportunity',
      status: 'open',
      maximumAward: 50000,
      scoring: {
        projectTypeMatch: 1,
        clientTypeMatch: 1,
        categoryMatch: 1,
        fundingThreshold: 0, // Below $1M threshold
        fundingType: 1,
        overallScore: 4 // Not high enough to compensate
      }
    }];

    const result = filterOpportunities(lowFundingOpportunity, thresholdConfig);

    // Should be excluded for not meeting funding threshold with insufficient compensation score
    expect(result.includedOpportunities).toHaveLength(0);
    expect(result.excludedOpportunities).toHaveLength(1);
    expect(result.filterMetrics.exclusionReasons).toHaveProperty('below_funding_threshold_insufficient_score');
  });

  test('should get and create filter configurations', () => {
    const defaultConfig = getDefaultFilterConfig();
    expect(defaultConfig).toMatchObject({
      minimumOverallScore: 2,
      minimumProjectTypeMatch: 1,
      minimumClientTypeMatch: 1,
      preferGrants: true,
      preferFundingThreshold: false,
      excludeClosedOpportunities: true,
      requireDescription: false,
      requireFundingInfo: false
    });

    const customConfig = createFilterConfig({
      minimumOverallScore: 5,
      preferGrants: false
    });

    expect(customConfig.minimumOverallScore).toBe(5);
    expect(customConfig.preferGrants).toBe(false);
    expect(customConfig.minimumClientTypeMatch).toBe(1); // Should inherit default
  });

  test('should track detailed exclusion reasons', () => {
    const mixedOpportunities = [
      { id: '1', scoring: { overallScore: 1 } }, // Low score
      { id: '2', scoring: { overallScore: 5, projectTypeMatch: 0, clientTypeMatch: 2 } }, // Insufficient project match
      { id: '3', scoring: { overallScore: 5, projectTypeMatch: 2, clientTypeMatch: 0 } }, // Insufficient client match
      { id: '4', status: 'closed', scoring: { overallScore: 8, projectTypeMatch: 2, clientTypeMatch: 2 } }, // Closed
      { id: '5', scoring: { overallScore: 8, projectTypeMatch: 2, clientTypeMatch: 2 } } // Should pass
    ];

    const result = filterOpportunities(mixedOpportunities);

    expect(result.includedOpportunities).toHaveLength(1);
    expect(result.filterMetrics.exclusionReasons).toMatchObject({
      'low_overall_score_1': 1,
      'insufficient_project_type_match': 1,
      'insufficient_client_type_match': 1,
      'opportunity_closed': 1
    });
  });
}); 