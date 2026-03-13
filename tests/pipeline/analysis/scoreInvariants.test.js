/**
 * Pipeline: Score Invariants Tests
 *
 * Property-based tests ensuring scores maintain invariants:
 * - Scores always in valid range (0-10)
 * - No NaN or undefined values
 * - Deterministic results for same inputs
 * - Monotonic relationships where expected
 * - Activity multiplier calibration (weak=0.15x)
 *
 * NOTE: These tests use property-based patterns to catch edge cases.
 */

import { describe, test, expect } from 'vitest';

/**
 * Score calculation functions (same as scoring.test.js)
 */
function calculateTierScore(eligibleApplicantTypes = []) {
  if (!eligibleApplicantTypes || eligibleApplicantTypes.length === 0) return 0;

  const tierScores = {
    'Municipal Government': 10, 'City Government': 10,
    'County Government': 9, 'State Government': 9, 'Tribal Government': 9,
    'Public Housing Authority': 8, 'School District': 8,
    'University': 7, 'Utility': 7, 'Non-Profit Organization': 6,
    'Commercial Entity': 4, 'Small Business': 5,
  };

  let maxScore = 0;
  for (const type of eligibleApplicantTypes) {
    const score = tierScores[type?.trim?.()] || 3;
    maxScore = Math.max(maxScore, score);
  }
  return maxScore;
}

function calculateFundingScore(maxAward = null, totalFunding = null) {
  const amount = maxAward || totalFunding || 0;
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

function calculateActivityScore(projectTypes = []) {
  if (!projectTypes || projectTypes.length === 0) return 0;

  const hotActivities = ['Solar', 'Wind', 'Battery', 'EV', 'HVAC', 'Weatherization', 'Efficiency'];
  const moderateActivities = ['Audit', 'Assessment', 'Planning', 'Feasibility', 'Training'];

  let hasHot = false, hasModerate = false;
  for (const type of projectTypes) {
    // Safely convert to string and normalize
    const norm = String(type || '').toLowerCase();
    if (hotActivities.some(h => norm.includes(h.toLowerCase()))) hasHot = true;
    if (moderateActivities.some(m => norm.includes(m.toLowerCase()))) hasModerate = true;
  }

  if (hasHot) return 10;
  if (hasModerate) return 6;
  if (projectTypes.length > 0) return 4;
  return 0;
}

function calculateRelevanceScore(opp) {
  const tier = calculateTierScore(opp.eligible_applicant_types);
  const funding = calculateFundingScore(opp.maximum_award, opp.total_funding_available);
  const activity = calculateActivityScore(opp.eligible_project_types);
  return Math.round((tier * 0.4 + funding * 0.3 + activity * 0.3) * 10) / 10;
}

/**
 * Taxonomy-based activity multiplier (mirrors production - calibrated values)
 */
function calculateActivityMultiplier(activities, taxonomy) {
  if (!activities || activities.length === 0) return 0.15;
  if (activities.some(a => taxonomy.hot.includes(a))) return 1.0;
  if (activities.some(a => taxonomy.strong.includes(a))) return 0.75;
  if (activities.some(a => taxonomy.mild.includes(a))) return 0.5;
  return 0.15;
}

const ACTIVITIES_TAXONOMY = {
  hot: ['New Construction', 'Renovation', 'Installation', 'Replacement', 'Upgrade', 'Repair', 'Modernization'],
  strong: ['Design', 'Engineering', 'Planning', 'Feasibility Studies'],
  mild: ['Equipment Purchase', 'Materials Purchase', 'Land Acquisition'],
  weak: ['Training', 'Education', 'Technical Assistance', 'Capacity Building', 'Research', 'Program Administration'],
};

/**
 * Generate random test data
 */
function randomApplicantTypes(count = 5) {
  const types = [
    'Municipal Government', 'County Government', 'State Government',
    'Utility', 'Non-Profit', 'Commercial Entity', 'Unknown Type',
    null, undefined, '', '  ', 12345, { invalid: true },
  ];
  return Array(count).fill(0).map(() => types[Math.floor(Math.random() * types.length)]);
}

function randomProjectTypes(count = 5) {
  const types = [
    'Solar', 'Wind', 'Battery Storage', 'HVAC', 'Planning',
    'Energy Audit', 'Unknown', null, undefined, '', 12345,
  ];
  return Array(count).fill(0).map(() => types[Math.floor(Math.random() * types.length)]);
}

function randomFundingAmount() {
  const amounts = [
    0, -100, 1000, 50000, 100000, 1000000, 10000000, 100000000,
    null, undefined, NaN, Infinity, -Infinity, 'not a number',
  ];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

describe('Pipeline: Score Invariants', () => {

  describe('Tier Score Invariants', () => {
    test('always returns number in range [0, 10]', () => {
      // Run 100 random tests
      for (let i = 0; i < 100; i++) {
        const types = randomApplicantTypes(Math.floor(Math.random() * 10));
        const score = calculateTierScore(types);

        expect(typeof score).toBe('number');
        expect(isNaN(score)).toBe(false);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      }
    });

    test('empty input always returns 0', () => {
      expect(calculateTierScore([])).toBe(0);
      expect(calculateTierScore(null)).toBe(0);
      expect(calculateTierScore(undefined)).toBe(0);
    });

    test('is deterministic - same input gives same output', () => {
      const input = ['Municipal Government', 'Utility'];

      const results = Array(10).fill(0).map(() => calculateTierScore(input));

      expect(new Set(results).size).toBe(1); // All results identical
    });

    test('more types never decreases score (monotonic)', () => {
      const base = ['Commercial Entity']; // Low score
      const extended = [...base, 'Municipal Government']; // Add high score type

      expect(calculateTierScore(extended)).toBeGreaterThanOrEqual(calculateTierScore(base));
    });
  });

  describe('Funding Score Invariants', () => {
    test('always returns number in range [0, 10]', () => {
      for (let i = 0; i < 100; i++) {
        const amount = randomFundingAmount();
        const score = calculateFundingScore(amount);

        expect(typeof score).toBe('number');
        expect(isNaN(score)).toBe(false);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      }
    });

    test('zero or negative input always returns 0', () => {
      expect(calculateFundingScore(0)).toBe(0);
      expect(calculateFundingScore(-1000)).toBe(0);
      expect(calculateFundingScore(-Infinity)).toBe(0);
    });

    test('null/undefined input returns 0', () => {
      expect(calculateFundingScore(null)).toBe(0);
      expect(calculateFundingScore(undefined)).toBe(0);
      expect(calculateFundingScore(null, null)).toBe(0);
    });

    test('is monotonically increasing with amount', () => {
      const amounts = [0, 1000, 10000, 100000, 1000000, 10000000, 100000000];
      const scores = amounts.map(a => calculateFundingScore(a));

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });

    test('maximum_award takes precedence over total_funding', () => {
      // max_award should be used if both provided
      const score1 = calculateFundingScore(100000, 10000000);
      const score2 = calculateFundingScore(100000, null);

      expect(score1).toBe(score2);
    });
  });

  describe('Activity Score Invariants', () => {
    test('always returns number in range [0, 10]', () => {
      for (let i = 0; i < 100; i++) {
        const types = randomProjectTypes(Math.floor(Math.random() * 10));
        const score = calculateActivityScore(types);

        expect(typeof score).toBe('number');
        expect(isNaN(score)).toBe(false);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      }
    });

    test('empty input always returns 0', () => {
      expect(calculateActivityScore([])).toBe(0);
      expect(calculateActivityScore(null)).toBe(0);
      expect(calculateActivityScore(undefined)).toBe(0);
    });

    test('hot activities always score higher than moderate', () => {
      const hotScore = calculateActivityScore(['Solar']);
      const moderateScore = calculateActivityScore(['Planning']);

      expect(hotScore).toBeGreaterThan(moderateScore);
    });

    test('any non-empty input scores > 0', () => {
      expect(calculateActivityScore(['Unknown'])).toBeGreaterThan(0);
      expect(calculateActivityScore(['Random Category'])).toBeGreaterThan(0);
    });
  });

  describe('Relevance Score Invariants', () => {
    test('always returns number in range [0, 10]', () => {
      for (let i = 0; i < 100; i++) {
        const opp = {
          eligible_applicant_types: randomApplicantTypes(Math.floor(Math.random() * 5)),
          maximum_award: randomFundingAmount(),
          eligible_project_types: randomProjectTypes(Math.floor(Math.random() * 5)),
        };

        const score = calculateRelevanceScore(opp);

        expect(typeof score).toBe('number');
        expect(isNaN(score)).toBe(false);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      }
    });

    test('empty opportunity returns 0', () => {
      expect(calculateRelevanceScore({})).toBe(0);
      expect(calculateRelevanceScore({ title: 'Test' })).toBe(0);
    });

    test('is deterministic', () => {
      const opp = {
        eligible_applicant_types: ['Municipal Government'],
        maximum_award: 1000000,
        eligible_project_types: ['Solar'],
      };

      const results = Array(10).fill(0).map(() => calculateRelevanceScore(opp));

      expect(new Set(results).size).toBe(1);
    });

    test('score is rounded to 1 decimal place', () => {
      const opp = {
        eligible_applicant_types: ['Non-Profit Organization'],
        maximum_award: 100000,
        eligible_project_types: ['Energy Audit'],
      };

      const score = calculateRelevanceScore(opp);
      const decimals = (score.toString().split('.')[1] || '').length;

      expect(decimals).toBeLessThanOrEqual(1);
    });

    test('better inputs produce higher or equal scores', () => {
      const baseOpp = {
        eligible_applicant_types: ['Commercial Entity'],
        maximum_award: 10000,
        eligible_project_types: ['Planning'],
      };

      const betterOpp = {
        eligible_applicant_types: ['Municipal Government'],
        maximum_award: 10000000,
        eligible_project_types: ['Solar'],
      };

      expect(calculateRelevanceScore(betterOpp)).toBeGreaterThan(calculateRelevanceScore(baseOpp));
    });
  });

  describe('Extreme Input Handling', () => {
    test('handles very large arrays', () => {
      const largeArray = Array(10000).fill('Municipal Government');

      expect(() => calculateTierScore(largeArray)).not.toThrow();
      expect(calculateTierScore(largeArray)).toBe(10);
    });

    test('handles arrays with all null/undefined', () => {
      const nullArray = [null, undefined, null, undefined];

      const score = calculateTierScore(nullArray);

      // null/undefined -> tierScores[undefined] || 3 = 3
      expect(score).toBe(3);
    });

    test('handles very large funding amounts', () => {
      expect(calculateFundingScore(Number.MAX_SAFE_INTEGER)).toBe(10);
      expect(calculateFundingScore(1e15)).toBe(10);
    });

    test('handles floating point edge cases', () => {
      // Just under threshold
      expect(calculateFundingScore(9999.99)).toBe(2);
      expect(calculateFundingScore(10000.01)).toBe(3);
    });

    test('handles special string values in arrays', () => {
      const weird = ['', '   ', '\n\t', 'null', 'undefined'];

      expect(() => calculateTierScore(weird)).not.toThrow();
      expect(() => calculateActivityScore(weird)).not.toThrow();
    });
  });

  describe('Score Distribution Sanity', () => {
    test('typical federal grant scores high', () => {
      const federalGrant = {
        eligible_applicant_types: ['State Government', 'Municipal Government', 'Tribal Government'],
        maximum_award: 10000000,
        eligible_project_types: ['Solar Installation', 'Battery Storage'],
      };

      // tier: 10 (Municipal), funding: 9 ($10M), activity: 10 (Solar)
      // (10 * 0.4) + (9 * 0.3) + (10 * 0.3) = 9.7
      expect(calculateRelevanceScore(federalGrant)).toBe(9.7);
    });

    test('typical utility rebate scores medium', () => {
      const utilityRebate = {
        eligible_applicant_types: ['Commercial Entity'],
        maximum_award: 25000,
        eligible_project_types: ['HVAC Upgrades'],
      };

      // tier: 4 (Commercial), funding: 3 ($25k), activity: 10 (HVAC=hot)
      // (4 * 0.4) + (3 * 0.3) + (10 * 0.3) = 5.5
      expect(calculateRelevanceScore(utilityRebate)).toBe(5.5);
    });

    test('minimal opportunity scores low', () => {
      const minimal = {
        eligible_applicant_types: ['Unknown'],
        maximum_award: 1000,
        eligible_project_types: ['Other'],
      };

      // tier: 3 (default), funding: 2 ($1k), activity: 4 (unknown non-empty)
      // (3 * 0.4) + (2 * 0.3) + (4 * 0.3) = 3
      expect(calculateRelevanceScore(minimal)).toBe(3);
    });
  });

  describe('Activity Multiplier Invariants (Calibrated)', () => {
    test('multiplier is always in valid range [0.15, 1.0]', () => {
      const testCases = [
        ['New Construction'],
        ['Design'],
        ['Equipment Purchase'],
        ['Training'],
        ['Research'],
        [],
        null,
      ];

      testCases.forEach(activities => {
        const mult = calculateActivityMultiplier(activities, ACTIVITIES_TAXONOMY);
        expect(typeof mult).toBe('number');
        expect(isNaN(mult)).toBe(false);
        expect(mult).toBeGreaterThanOrEqual(0.15);
        expect(mult).toBeLessThanOrEqual(1.0);
      });
    });

    test('construction always beats non-construction', () => {
      const hotMult = calculateActivityMultiplier(['Installation'], ACTIVITIES_TAXONOMY);
      const weakMult = calculateActivityMultiplier(['Training'], ACTIVITIES_TAXONOMY);
      expect(hotMult).toBeGreaterThan(weakMult);
    });

    test('highest tier wins when mixed', () => {
      const mixed = calculateActivityMultiplier(['Training', 'Installation'], ACTIVITIES_TAXONOMY);
      expect(mixed).toBe(1.0); // Installation (hot) wins
    });

    test('weak multiplier is 0.15 (calibrated from 0.25)', () => {
      expect(calculateActivityMultiplier(['Training'], ACTIVITIES_TAXONOMY)).toBe(0.15);
      expect(calculateActivityMultiplier(['Research'], ACTIVITIES_TAXONOMY)).toBe(0.15);
      expect(calculateActivityMultiplier([], ACTIVITIES_TAXONOMY)).toBe(0.15);
    });

    test('tier ordering is preserved: hot > strong > mild > weak', () => {
      const hot = calculateActivityMultiplier(['Installation'], ACTIVITIES_TAXONOMY);
      const strong = calculateActivityMultiplier(['Design'], ACTIVITIES_TAXONOMY);
      const mild = calculateActivityMultiplier(['Equipment Purchase'], ACTIVITIES_TAXONOMY);
      const weak = calculateActivityMultiplier(['Training'], ACTIVITIES_TAXONOMY);

      expect(hot).toBeGreaterThan(strong);
      expect(strong).toBeGreaterThan(mild);
      expect(mild).toBeGreaterThan(weak);
    });
  });

  describe('LLM Adjusted Score Invariants', () => {
    /**
     * Mirrors parallelCoordinator.js mergeAnalysisResults() adjustedScore computation
     */
    function computeAdjustedScore(finalScore, llmAdjustment) {
      const adj = llmAdjustment || 0;
      return Math.round(
        Math.max(0, Math.min(10, finalScore + adj)) * 10
      ) / 10;
    }

    test('adjustedScore is always in range [0, 10] for any valid inputs', () => {
      const finalScores = [0, 1, 2.5, 5, 7.5, 10];
      const adjustments = [-3, -2, -1, 0, 1, 2, 3];

      for (const fs of finalScores) {
        for (const adj of adjustments) {
          const result = computeAdjustedScore(fs, adj);
          expect(typeof result).toBe('number');
          expect(isNaN(result)).toBe(false);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(10);
        }
      }
    });

    test('adjustedScore is always in range [0, 10] even with extreme inputs', () => {
      // finalScore already at bounds + max adjustment
      expect(computeAdjustedScore(0, -3)).toBe(0);
      expect(computeAdjustedScore(0, 3)).toBe(3);
      expect(computeAdjustedScore(10, -3)).toBe(7);
      expect(computeAdjustedScore(10, 3)).toBe(10);
    });

    test('adjustedScore is deterministic', () => {
      const results = Array(10).fill(0).map(() => computeAdjustedScore(7.5, -2));
      expect(new Set(results).size).toBe(1);
    });

    test('zero adjustment preserves finalScore exactly', () => {
      const scores = [0, 1.5, 3.3, 5.0, 7.5, 10.0];
      for (const score of scores) {
        expect(computeAdjustedScore(score, 0)).toBe(score);
      }
    });

    test('null/undefined adjustment treated as zero', () => {
      expect(computeAdjustedScore(7.5, null)).toBe(7.5);
      expect(computeAdjustedScore(7.5, undefined)).toBe(7.5);
    });

    test('adjustment direction is correct: positive increases, negative decreases', () => {
      const base = 5.0;
      expect(computeAdjustedScore(base, 2)).toBeGreaterThan(base);
      expect(computeAdjustedScore(base, -2)).toBeLessThan(base);
    });

    test('clamping works at both bounds', () => {
      // Lower bound
      expect(computeAdjustedScore(1, -3)).toBe(0);
      expect(computeAdjustedScore(0, -1)).toBe(0);

      // Upper bound
      expect(computeAdjustedScore(9, 3)).toBe(10);
      expect(computeAdjustedScore(10, 1)).toBe(10);
    });
  });
});
