/**
 * Pipeline: Score Invariants Tests
 *
 * Property-based tests ensuring scores maintain invariants:
 * - Scores always in valid range (0-10)
 * - No NaN or undefined values
 * - Deterministic results for same inputs
 * - Monotonic relationships where expected
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

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
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

      expect(calculateRelevanceScore(federalGrant)).toBeGreaterThan(8);
    });

    test('typical utility rebate scores medium', () => {
      const utilityRebate = {
        eligible_applicant_types: ['Commercial Entity'],
        maximum_award: 25000,
        eligible_project_types: ['HVAC Upgrades'],
      };

      const score = calculateRelevanceScore(utilityRebate);
      expect(score).toBeGreaterThan(4);
      expect(score).toBeLessThan(8);
    });

    test('minimal opportunity scores low', () => {
      const minimal = {
        eligible_applicant_types: ['Unknown'],
        maximum_award: 1000,
        eligible_project_types: ['Other'],
      };

      expect(calculateRelevanceScore(minimal)).toBeLessThan(5);
    });
  });
});
