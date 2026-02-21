/**
 * Pipeline: Analysis Scoring Tests
 *
 * Tests the deterministic scoring algorithms:
 * - Tier scoring based on applicant types
 * - Funding scoring based on amounts
 * - Activity scoring based on project types
 * - Combined relevance scoring
 *
 * NOTE: Scoring is 100% deterministic and should have exhaustive coverage.
 */

import { describe, test, expect } from 'vitest';

/**
 * Calculate tier score based on eligible applicant types
 * Higher scores for government/municipal applicants (primary target)
 */
function calculateTierScore(eligibleApplicantTypes = []) {
  if (!eligibleApplicantTypes || eligibleApplicantTypes.length === 0) {
    return 0;
  }

  const tierScores = {
    // Tier 1: Primary targets (highest value)
    'Municipal Government': 10,
    'City Government': 10,
    'County Government': 9,
    'State Government': 9,
    'Tribal Government': 9,

    // Tier 2: Public entities
    'Public Housing Authority': 8,
    'School District': 8,
    'Public School': 8,
    'University': 7,
    'Community College': 7,

    // Tier 3: Utilities and non-profits
    'Utility': 7,
    'Electric Utility': 7,
    'Non-Profit Organization': 6,
    'Non-Profit': 6,

    // Tier 4: Commercial (lower priority)
    'Commercial Entity': 4,
    'Small Business': 5,
    'Business': 4,
  };

  let maxScore = 0;
  for (const applicantType of eligibleApplicantTypes) {
    const normalizedType = applicantType.trim();
    const score = tierScores[normalizedType] || 3; // Default score for unknown types
    maxScore = Math.max(maxScore, score);
  }

  return maxScore;
}

/**
 * Calculate funding score based on award amounts
 * Higher scores for larger funding amounts
 */
function calculateFundingScore(maximumAward = null, totalFunding = null) {
  const amount = maximumAward || totalFunding || 0;

  if (amount <= 0) return 0;
  if (amount < 10000) return 2;
  if (amount < 50000) return 3;
  if (amount < 100000) return 4;
  if (amount < 500000) return 5;
  if (amount < 1000000) return 6;
  if (amount < 5000000) return 7;
  if (amount < 10000000) return 8;
  if (amount < 50000000) return 9;
  return 10;
}

/**
 * Calculate activity score based on project types
 * Higher scores for "hot" activities (construction, implementation)
 */
function calculateActivityScore(eligibleProjectTypes = []) {
  if (!eligibleProjectTypes || eligibleProjectTypes.length === 0) {
    return 0;
  }

  // Hot activities that indicate implementation/construction
  const hotActivities = [
    'Solar', 'Wind', 'Battery Storage', 'EV Charging', 'HVAC',
    'Weatherization', 'Energy Efficiency', 'Building Electrification',
    'Heat Pump', 'LED Lighting', 'Insulation', 'Construction',
    'Installation', 'Implementation', 'Retrofit',
  ];

  // Moderate activities (planning, assessment)
  const moderateActivities = [
    'Energy Audit', 'Assessment', 'Planning', 'Feasibility Study',
    'Technical Assistance', 'Workforce Development', 'Training',
  ];

  let hasHot = false;
  let hasModerate = false;

  for (const projectType of eligibleProjectTypes) {
    const normalized = projectType.toLowerCase();

    if (hotActivities.some(hot => normalized.includes(hot.toLowerCase()))) {
      hasHot = true;
    }
    if (moderateActivities.some(mod => normalized.includes(mod.toLowerCase()))) {
      hasModerate = true;
    }
  }

  if (hasHot) return 10;
  if (hasModerate) return 6;
  if (eligibleProjectTypes.length > 0) return 4;
  return 0;
}

/**
 * Calculate combined relevance score
 */
function calculateRelevanceScore(opportunity) {
  const tierScore = calculateTierScore(opportunity.eligible_applicant_types);
  const fundingScore = calculateFundingScore(
    opportunity.maximum_award,
    opportunity.total_funding_available
  );
  const activityScore = calculateActivityScore(opportunity.eligible_project_types);

  // Weighted average: tier (40%), funding (30%), activity (30%)
  const weighted = (tierScore * 0.4) + (fundingScore * 0.3) + (activityScore * 0.3);

  return Math.round(weighted * 10) / 10; // Round to 1 decimal
}

describe('Pipeline: Analysis Scoring', () => {

  describe('Tier Score Calculation', () => {
    test('municipal government gets highest score', () => {
      const score = calculateTierScore(['Municipal Government']);
      expect(score).toBe(10);
    });

    test('city government gets highest score', () => {
      const score = calculateTierScore(['City Government']);
      expect(score).toBe(10);
    });

    test('county government gets high score', () => {
      const score = calculateTierScore(['County Government']);
      expect(score).toBe(9);
    });

    test('state government gets high score', () => {
      const score = calculateTierScore(['State Government']);
      expect(score).toBe(9);
    });

    test('tribal government gets high score', () => {
      const score = calculateTierScore(['Tribal Government']);
      expect(score).toBe(9);
    });

    test('public entities get medium-high score', () => {
      expect(calculateTierScore(['Public Housing Authority'])).toBe(8);
      expect(calculateTierScore(['School District'])).toBe(8);
      expect(calculateTierScore(['University'])).toBe(7);
    });

    test('utilities get medium score', () => {
      expect(calculateTierScore(['Utility'])).toBe(7);
      expect(calculateTierScore(['Electric Utility'])).toBe(7);
    });

    test('non-profits get medium score', () => {
      expect(calculateTierScore(['Non-Profit Organization'])).toBe(6);
      expect(calculateTierScore(['Non-Profit'])).toBe(6);
    });

    test('commercial entities get lower score', () => {
      expect(calculateTierScore(['Commercial Entity'])).toBe(4);
      expect(calculateTierScore(['Small Business'])).toBe(5);
    });

    test('multiple applicant types returns highest', () => {
      const score = calculateTierScore([
        'Commercial Entity', // 4
        'Municipal Government', // 10
        'Non-Profit', // 6
      ]);
      expect(score).toBe(10);
    });

    test('unknown applicant type gets default score', () => {
      const score = calculateTierScore(['Unknown Entity Type']);
      expect(score).toBe(3);
    });

    test('empty array returns 0', () => {
      expect(calculateTierScore([])).toBe(0);
    });

    test('null returns 0', () => {
      expect(calculateTierScore(null)).toBe(0);
    });

    test('undefined returns 0', () => {
      expect(calculateTierScore(undefined)).toBe(0);
    });
  });

  describe('Funding Score Calculation', () => {
    test.each([
      [0, 0],
      [5000, 2],
      [10000, 3],
      [50000, 4],
      [100000, 5],
      [500000, 6],
      [1000000, 7],
      [5000000, 8],
      [10000000, 9],
      [50000000, 10],
      [100000000, 10],
    ])('$%d returns score %d', (amount, expected) => {
      expect(calculateFundingScore(amount)).toBe(expected);
    });

    test('uses maximum_award first', () => {
      const score = calculateFundingScore(1000000, 5000000);
      expect(score).toBe(7); // Based on maximum_award
    });

    test('falls back to total_funding', () => {
      const score = calculateFundingScore(null, 5000000);
      expect(score).toBe(8); // Based on total_funding
    });

    test('null values return 0', () => {
      expect(calculateFundingScore(null, null)).toBe(0);
    });

    test('negative values return 0', () => {
      expect(calculateFundingScore(-100000)).toBe(0);
    });
  });

  describe('Activity Score Calculation', () => {
    test('solar projects get hot score', () => {
      const score = calculateActivityScore(['Solar']);
      expect(score).toBe(10);
    });

    test('wind projects get hot score', () => {
      const score = calculateActivityScore(['Wind']);
      expect(score).toBe(10);
    });

    test('battery storage gets hot score', () => {
      const score = calculateActivityScore(['Battery Storage']);
      expect(score).toBe(10);
    });

    test('EV charging gets hot score', () => {
      const score = calculateActivityScore(['EV Charging']);
      expect(score).toBe(10);
    });

    test('weatherization gets hot score', () => {
      const score = calculateActivityScore(['Weatherization']);
      expect(score).toBe(10);
    });

    test('energy efficiency gets hot score', () => {
      const score = calculateActivityScore(['Energy Efficiency']);
      expect(score).toBe(10);
    });

    test('planning activities get moderate score', () => {
      const score = calculateActivityScore(['Energy Audit']);
      expect(score).toBe(6);
    });

    test('assessment activities get moderate score', () => {
      const score = calculateActivityScore(['Feasibility Study']);
      expect(score).toBe(6);
    });

    test('training activities get moderate score', () => {
      const score = calculateActivityScore(['Workforce Development']);
      expect(score).toBe(6);
    });

    test('hot activities override moderate', () => {
      const score = calculateActivityScore(['Planning', 'Solar Installation']);
      expect(score).toBe(10);
    });

    test('case insensitive matching', () => {
      expect(calculateActivityScore(['SOLAR'])).toBe(10);
      expect(calculateActivityScore(['solar installation'])).toBe(10);
      expect(calculateActivityScore(['Solar PV'])).toBe(10);
    });

    test('unknown project types get base score', () => {
      const score = calculateActivityScore(['Unknown Category']);
      expect(score).toBe(4);
    });

    test('empty array returns 0', () => {
      expect(calculateActivityScore([])).toBe(0);
    });

    test('null returns 0', () => {
      expect(calculateActivityScore(null)).toBe(0);
    });
  });

  describe('Combined Relevance Score', () => {
    test('calculates weighted average', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government'], // tier: 10
        maximum_award: 5000000, // funding: 8
        eligible_project_types: ['Solar'], // activity: 10
      };

      const score = calculateRelevanceScore(opp);

      // (10 * 0.4) + (8 * 0.3) + (10 * 0.3) = 4 + 2.4 + 3 = 9.4
      expect(score).toBe(9.4);
    });

    test('handles missing fields gracefully', () => {
      const opp = {
        title: 'Test Grant',
        // No scoring fields
      };

      const score = calculateRelevanceScore(opp);

      expect(score).toBe(0);
    });

    test('partial data still calculates', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government'], // tier: 10
        // No funding or project types
      };

      const score = calculateRelevanceScore(opp);

      // (10 * 0.4) + (0 * 0.3) + (0 * 0.3) = 4
      expect(score).toBe(4);
    });

    test('score is rounded to 1 decimal', () => {
      const opp = {
        eligible_applicant_types: ['Non-Profit Organization'], // tier: 6
        maximum_award: 100000, // funding: 5
        eligible_project_types: ['Energy Audit'], // activity: 6
      };

      const score = calculateRelevanceScore(opp);

      // (6 * 0.4) + (5 * 0.3) + (6 * 0.3) = 2.4 + 1.5 + 1.8 = 5.7
      expect(score).toBe(5.7);
    });

    test('maximum possible score is 10', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government'], // 10
        maximum_award: 100000000, // 10
        eligible_project_types: ['Solar'], // 10
      };

      const score = calculateRelevanceScore(opp);

      // (10 * 0.4) + (10 * 0.3) + (10 * 0.3) = 10
      expect(score).toBe(10);
    });

    test('minimum score is 0', () => {
      const opp = {};

      const score = calculateRelevanceScore(opp);

      expect(score).toBe(0);
    });
  });

  describe('Real-World Scoring Examples', () => {
    test('federal solar grant for cities', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government', 'County Government', 'Tribal Government'],
        maximum_award: 10000000,
        eligible_project_types: ['Solar PV Installation', 'Battery Storage', 'Grid Modernization'],
      };

      const score = calculateRelevanceScore(opp);

      // tier: 10, funding: 9 ($10M), activity: 10 (Solar)
      // (10 * 0.4) + (9 * 0.3) + (10 * 0.3) = 4 + 2.7 + 3 = 9.7
      expect(score).toBe(9.7);
    });

    test('small utility rebate program', () => {
      const opp = {
        eligible_applicant_types: ['Commercial Entity'],
        maximum_award: 25000,
        eligible_project_types: ['LED Lighting'],
      };

      const score = calculateRelevanceScore(opp);

      // tier: 4, funding: 3 ($25k), activity: 10 (LED=hot)
      // (4 * 0.4) + (3 * 0.3) + (10 * 0.3) = 1.6 + 0.9 + 3 = 5.5
      expect(score).toBe(5.5);
    });

    test('planning-only grant', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government'],
        maximum_award: 100000,
        eligible_project_types: ['Energy Audit', 'Feasibility Study'],
      };

      const score = calculateRelevanceScore(opp);

      // High tier (10), medium funding (5), moderate activity (6)
      // (10 * 0.4) + (5 * 0.3) + (6 * 0.3) = 4 + 1.5 + 1.8 = 7.3
      expect(score).toBeCloseTo(7.3, 1);
    });

    test('workforce development grant', () => {
      const opp = {
        eligible_applicant_types: ['Non-Profit Organization', 'Community College'],
        maximum_award: 500000,
        eligible_project_types: ['Workforce Development', 'Training'],
      };

      const score = calculateRelevanceScore(opp);

      // tier: 7 (Community College), funding: 6 ($500k), activity: 6 (moderate)
      // (7 * 0.4) + (6 * 0.3) + (6 * 0.3) = 2.8 + 1.8 + 1.8 = 6.4
      expect(score).toBe(6.4);
    });
  });

  describe('Score Invariants', () => {
    test('tier score is always 0-10', () => {
      const testCases = [
        [],
        ['Municipal Government'],
        ['Unknown Type'],
        ['A', 'B', 'C', 'D', 'E'],
      ];

      testCases.forEach(types => {
        const score = calculateTierScore(types);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      });
    });

    test('funding score is always 0-10', () => {
      const amounts = [0, 100, 10000, 1000000, 999999999];

      amounts.forEach(amount => {
        const score = calculateFundingScore(amount);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      });
    });

    test('activity score is always 0-10', () => {
      const testCases = [
        [],
        ['Solar'],
        ['Unknown'],
        ['Planning', 'Solar', 'Wind'],
      ];

      testCases.forEach(types => {
        const score = calculateActivityScore(types);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      });
    });

    test('relevance score is always 0-10', () => {
      const testCases = [
        {},
        { eligible_applicant_types: ['Municipal Government'] },
        { maximum_award: 1000000 },
        {
          eligible_applicant_types: ['Municipal Government'],
          maximum_award: 100000000,
          eligible_project_types: ['Solar'],
        },
      ];

      testCases.forEach(opp => {
        const score = calculateRelevanceScore(opp);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      });
    });
  });
});
