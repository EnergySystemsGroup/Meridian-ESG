import { describe, test, expect, beforeEach } from 'vitest';
import { 
  filterOpportunities, 
  createFilterConfig, 
  getDefaultFilterConfig
} from '../core/filterFunction.js';

/**
 * Test suite for Filter Function V2 - New Gating System
 * 
 * Tests programmatic filtering logic based on new gating system scores:
 * - clientProjectRelevance (0-6)
 * - fundingAttractiveness (0-3)
 * - fundingType (0-1)
 */

describe('Filter Function V2 - New Gating System', () => {
  let mockOpportunities;

  beforeEach(() => {
    mockOpportunities = [
      // Auto-qualifying opportunity (clientProjectRelevance ≥ 5)
      {
        id: 'grant-1',
        title: 'Perfect Energy Infrastructure Grant',
        description: 'HVAC upgrade funding for municipal facilities',
        status: 'open',
        fundingType: 'grant',
        maximumAward: 1000000,
        scoring: {
          clientProjectRelevance: 6,    // Perfect fit - auto-qualifies
          fundingAttractiveness: 3,     // Excellent funding
          fundingType: 1,               // Grant
          overallScore: 10
        },
        enhancedDescription: 'Enhanced description available'
      },
      // Auto-qualifying opportunity (clientProjectRelevance = 5)
      {
        id: 'grant-2', 
        title: 'Solar Installation for Schools',
        description: 'Solar panel funding for educational facilities',
        status: 'open',
        fundingType: 'grant',
        maximumAward: 500000,
        scoring: {
          clientProjectRelevance: 5,    // Auto-qualifies
          fundingAttractiveness: 2,     // Good funding
          fundingType: 1,               // Grant
          overallScore: 8
        }
      },
      // Secondary filtering pass (score 4 with good funding)
      {
        id: 'grant-3',
        title: 'Energy Efficiency Program',
        description: 'Building efficiency upgrades',
        status: 'open',
        fundingType: 'grant',
        maximumAward: 750000,
        scoring: {
          clientProjectRelevance: 4,    // Good fit, goes to secondary
          fundingAttractiveness: 2,     // Good funding
          fundingType: 1,               // Grant
          overallScore: 7
        }
      },
      // Secondary filtering pass (score 3 with excellent funding)
      {
        id: 'grant-4',
        title: 'Infrastructure Investment',
        description: 'Critical infrastructure projects',
        status: 'open',
        fundingType: 'grant',
        maximumAward: 2000000,
        scoring: {
          clientProjectRelevance: 3,    // Moderate fit, goes to secondary
          fundingAttractiveness: 3,     // Excellent funding compensates
          fundingType: 1,               // Grant
          overallScore: 7
        }
      },
      // Secondary filtering fail (non-grant with insufficient compensation)
      {
        id: 'loan-1',
        title: 'Low-Interest Energy Loan',
        description: 'Loan program for energy projects',
        status: 'open',
        fundingType: 'loan',
        maximumAward: 500000,
        scoring: {
          clientProjectRelevance: 3,    // Moderate fit
          fundingAttractiveness: 1,     // Moderate funding
          fundingType: 0,               // Not a grant
          overallScore: 4
        }
      },
      // Primary gate failure (clientProjectRelevance < 2)
      {
        id: 'grant-5',
        title: 'Unrelated Program',
        description: 'Not energy related',
        status: 'open',
        fundingType: 'grant',
        maximumAward: 100000,
        scoring: {
          clientProjectRelevance: 1,    // Fails primary gate
          fundingAttractiveness: 1,     // Doesn't matter
          fundingType: 1,               // Doesn't matter
          overallScore: 3
        }
      },
      // Closed opportunity (should be excluded regardless of score)
      {
        id: 'grant-6',
        title: 'Closed Energy Grant',
        description: 'Great opportunity but closed',
        status: 'closed',
        fundingType: 'grant',
        maximumAward: 2000000,
        scoring: {
          clientProjectRelevance: 6,    // Would auto-qualify if open
          fundingAttractiveness: 3,     // Excellent
          fundingType: 1,               // Grant
          overallScore: 10
        }
      },
      // Secondary filtering fail (low funding attractiveness)
      {
        id: 'grant-7',
        title: 'Small Energy Grant',
        description: 'Limited funding available',
        status: 'open',
        fundingType: 'grant',
        maximumAward: 50000,
        scoring: {
          clientProjectRelevance: 3,    // Passes primary gate
          fundingAttractiveness: 0,     // Fails funding threshold
          fundingType: 1,               // Grant
          overallScore: 4
        }
      }
    ];
  });

  test('should filter opportunities with new gating system', () => {
    const result = filterOpportunities(mockOpportunities);

    expect(result).toMatchObject({
      includedOpportunities: expect.any(Array),
      excludedOpportunities: expect.any(Array),
      filterMetrics: {
        totalAnalyzed: 8,
        included: expect.any(Number),
        excluded: expect.any(Number),
        exclusionReasons: expect.any(Object),
        gatingMetrics: {
          failedPrimaryGate: expect.any(Number),
          autoQualified: expect.any(Number),
          secondaryFiltered: expect.any(Number)
        },
        inclusionRate: expect.any(Number)
      },
      executionTime: expect.any(Number)
    });

    // Should include: grant-1 (auto), grant-2 (auto), grant-3 (secondary pass), grant-4 (secondary pass), loan-1 (now passes secondary)
    expect(result.includedOpportunities).toHaveLength(5);
    
    // Should exclude: grant-5 (primary gate), grant-6 (closed), grant-7 (low funding)
    expect(result.excludedOpportunities).toHaveLength(3);

    // Check auto-qualified opportunities
    expect(result.filterMetrics.gatingMetrics.autoQualified).toBe(2); // grant-1, grant-2

    // Check primary gate failures  
    expect(result.filterMetrics.gatingMetrics.failedPrimaryGate).toBe(1); // grant-5

    // Check secondary filtering count
    expect(result.filterMetrics.gatingMetrics.secondaryFiltered).toBe(5); // grant-3, grant-4, loan-1, grant-6, grant-7

    // Check specific inclusions
    const includedIds = result.includedOpportunities.map(opp => opp.id);
    expect(includedIds).toContain('grant-1'); // Auto-qualified
    expect(includedIds).toContain('grant-2'); // Auto-qualified  
    expect(includedIds).toContain('grant-3'); // Secondary pass
    expect(includedIds).toContain('grant-4'); // Secondary pass
    expect(includedIds).toContain('loan-1');  // Now passes secondary (no grant preference)

    // Check specific exclusions
    const excludedIds = result.excludedOpportunities.map(opp => opp.id);
    expect(excludedIds).toContain('grant-5'); // Primary gate failure
    expect(excludedIds).toContain('grant-6'); // Closed status
    expect(excludedIds).toContain('grant-7'); // Low funding attractiveness

    // Check gate types
    const autoQualified = result.includedOpportunities.filter(opp => 
      opp.filterResult.gateType === 'auto_qualified'
    );
    expect(autoQualified).toHaveLength(2);

    const secondaryPassed = result.includedOpportunities.filter(opp => 
      opp.filterResult.gateType === 'secondary_passed'
    );
    expect(secondaryPassed).toHaveLength(3); // grant-3, grant-4, loan-1
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
        exclusionReasons: {},
        gatingMetrics: {
          failedPrimaryGate: 0,
          autoQualified: 0,
          secondaryFiltered: 0
        }
      },
      executionTime: expect.any(Number)
    });

    expect(result.executionTime).toBeGreaterThan(0);
  });

  test('should apply custom gating configuration', () => {
    const customConfig = createFilterConfig({
      minimumClientProjectRelevance: 4,    // Higher primary gate
      autoQualificationThreshold: 6,       // Only perfect scores auto-qualify
      minimumFundingAttractiveness: 2      // Higher funding requirement
    });

    const result = filterOpportunities(mockOpportunities, customConfig);

    // Only grant-1 should auto-qualify (score 6)
    // grant-2 now goes to secondary (score 5) and passes
    // grant-3 passes secondary (score 4, funding 2)
    // grant-4 passes secondary (score 3 fails primary gate now)
    expect(result.filterMetrics.gatingMetrics.autoQualified).toBe(1); // Only grant-1
    
    // Should include grant-1, grant-2, grant-3
    expect(result.includedOpportunities).toHaveLength(3);
  });

  test('should handle opportunities without new scoring fields', () => {
    const legacyOpportunities = [
      {
        id: 'legacy-1',
        title: 'Legacy Opportunity',
        status: 'open',
        scoring: {
          // Missing new scoring fields
          projectTypeMatch: 2,
          clientTypeMatch: 3
        }
      },
      {
        id: 'no-score-1',
        title: 'No Scoring Data',
        status: 'open'
        // No scoring object at all
      }
    ];

    const result = filterOpportunities(legacyOpportunities);

    // Both should be excluded due to missing new scoring fields
    expect(result.includedOpportunities).toHaveLength(0);
    expect(result.excludedOpportunities).toHaveLength(2);
    
    // Check exclusion reasons
    expect(result.filterMetrics.exclusionReasons).toHaveProperty('missing_new_scoring_fields');
  });

  test('should validate scoring field ranges', () => {
    const opportunitiesWithInvalidScores = [
      {
        id: 'invalid-1',
        title: 'Out of Range Scores',
        status: 'open',
        scoring: {
          clientProjectRelevance: 10,      // Should be clamped to 6
          fundingAttractiveness: -1,       // Should be clamped to 0
          fundingType: 2,                  // Should be clamped to 1
          overallScore: 5
        }
      }
    ];

    const result = filterOpportunities(opportunitiesWithInvalidScores);

    // Should still process but with clamped values
    // clientProjectRelevance: 10 -> 6 (auto-qualifies)
    expect(result.includedOpportunities).toHaveLength(1);
    expect(result.filterMetrics.gatingMetrics.autoQualified).toBe(1);
  });

  test('should provide detailed gating metrics', () => {
    const result = filterOpportunities(mockOpportunities);

    expect(result.filterMetrics.gatingMetrics).toMatchObject({
      failedPrimaryGate: expect.any(Number),
      autoQualified: expect.any(Number), 
      secondaryFiltered: expect.any(Number)
    });

    // Verify counts add up correctly
    const { gatingMetrics } = result.filterMetrics;
    expect(gatingMetrics.failedPrimaryGate + gatingMetrics.autoQualified + gatingMetrics.secondaryFiltered)
      .toBe(mockOpportunities.length);
  });

  test('should track exclusion reasons correctly', () => {
    const result = filterOpportunities(mockOpportunities);

    const { exclusionReasons } = result.filterMetrics;
    
    // Should have various exclusion reasons
    expect(Object.keys(exclusionReasons).length).toBeGreaterThan(0);
    
    // Check for specific expected reasons
    const reasonKeys = Object.keys(exclusionReasons);
    expect(reasonKeys.some(key => key.includes('failed_primary_gate'))).toBe(true);
    expect(reasonKeys.some(key => key.includes('opportunity_closed'))).toBe(true);
  });

  test('should handle missing scoring gracefully', () => {
    const opportunityWithoutScoring = [{
      id: 'no-scoring',
      title: 'No Scoring Object',
      status: 'open'
    }];

    const result = filterOpportunities(opportunityWithoutScoring);

    expect(result.excludedOpportunities).toHaveLength(1);
    expect(result.excludedOpportunities[0].filterResult.reason).toBe('missing_new_scoring_fields');
    expect(result.excludedOpportunities[0].filterResult.gateType).toBe('validation_failed');
  });

  test('should create and get filter configurations', () => {
    const defaultConfig = getDefaultFilterConfig();
    expect(defaultConfig).toMatchObject({
      minimumClientProjectRelevance: 2,
      autoQualificationThreshold: 5,
      minimumFundingAttractiveness: 1,
      excludeClosedOpportunities: true
    });

    const customConfig = createFilterConfig({
      minimumClientProjectRelevance: 4,
      minimumFundingAttractiveness: 2
    });

    expect(customConfig.minimumClientProjectRelevance).toBe(4);
    expect(customConfig.minimumFundingAttractiveness).toBe(2);
    expect(customConfig.autoQualificationThreshold).toBe(5); // Should inherit default
  });
}); 