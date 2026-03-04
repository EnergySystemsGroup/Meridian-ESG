/**
 * Map Funding By State Tests
 *
 * Tests the aggregation logic for the choropleth map:
 * - Total funding per state
 * - Opportunity count per state
 * - National opportunities included in all states
 * - Color scale calculations (by amount vs by count)
 */

import { describe, test, expect } from 'vitest';

/**
 * Calculate funding statistics by state
 *
 * @param {Array} opportunities - All opportunities
 * @param {Object} coverageAreas - Map of area IDs to area details
 * @returns {Object} Map of state code to funding stats
 */
function calculateFundingByState(opportunities, coverageAreas = {}) {
  const stateFunding = {};

  // Initialize all states that have coverage areas
  const allStates = new Set();
  Object.values(coverageAreas).forEach(area => {
    if (area.state_code) {
      allStates.add(area.state_code);
    }
  });

  allStates.forEach(stateCode => {
    stateFunding[stateCode] = {
      count: 0,
      totalFunding: 0,
      maxAward: 0,
      opportunities: [],
    };
  });

  for (const opp of opportunities) {
    if (opp.status !== 'open') continue;

    const funding = opp.maximum_award || opp.total_funding_available || 0;

    if (opp.is_national) {
      // National opportunities count for ALL states
      allStates.forEach(stateCode => {
        stateFunding[stateCode].count++;
        stateFunding[stateCode].totalFunding += funding;
        stateFunding[stateCode].maxAward = Math.max(
          stateFunding[stateCode].maxAward,
          funding
        );
        stateFunding[stateCode].opportunities.push(opp.id);
      });
    } else {
      // State-specific opportunities
      const oppStates = getStatesForOpportunity(opp, coverageAreas);
      oppStates.forEach(stateCode => {
        if (!stateFunding[stateCode]) {
          stateFunding[stateCode] = {
            count: 0,
            totalFunding: 0,
            maxAward: 0,
            opportunities: [],
          };
        }
        stateFunding[stateCode].count++;
        stateFunding[stateCode].totalFunding += funding;
        stateFunding[stateCode].maxAward = Math.max(
          stateFunding[stateCode].maxAward,
          funding
        );
        stateFunding[stateCode].opportunities.push(opp.id);
      });
    }
  }

  return stateFunding;
}

/**
 * Get all states an opportunity covers
 */
function getStatesForOpportunity(opp, coverageAreas) {
  const states = new Set();

  for (const areaId of (opp.coverage_area_ids || [])) {
    const area = coverageAreas[areaId];
    if (area?.state_code) {
      states.add(area.state_code);
    }
  }

  return states;
}

/**
 * Calculate color value for choropleth
 */
function calculateColorValue(stateStats, mode = 'amount') {
  if (mode === 'count') {
    return stateStats.count;
  }
  return stateStats.totalFunding;
}

// Test coverage areas
const testCoverageAreas = {
  1: { id: 1, name: 'California', kind: 'state', state_code: 'CA' },
  2: { id: 2, name: 'PG&E', kind: 'utility', state_code: 'CA' },
  3: { id: 3, name: 'Texas', kind: 'state', state_code: 'TX' },
  4: { id: 4, name: 'New York', kind: 'state', state_code: 'NY' },
  5: { id: 5, name: 'ConEd', kind: 'utility', state_code: 'NY' },
};

describe('Map Funding By State', () => {

  describe('Basic Aggregation', () => {
    test('aggregates funding per state', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [1], maximum_award: 1000000 },
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [1], maximum_award: 2000000 },
        { id: 3, is_national: false, status: 'open', coverage_area_ids: [3], maximum_award: 500000 },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      expect(result['CA'].totalFunding).toBe(3000000);
      expect(result['CA'].count).toBe(2);
      expect(result['TX'].totalFunding).toBe(500000);
      expect(result['TX'].count).toBe(1);
    });

    test('tracks max award per state', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [1], maximum_award: 1000000 },
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [1], maximum_award: 5000000 },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      expect(result['CA'].maxAward).toBe(5000000);
    });

    test('tracks opportunity IDs per state', () => {
      const opps = [
        { id: 'opp-1', is_national: false, status: 'open', coverage_area_ids: [1], maximum_award: 1000000 },
        { id: 'opp-2', is_national: false, status: 'open', coverage_area_ids: [1], maximum_award: 2000000 },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      expect(result['CA'].opportunities).toContain('opp-1');
      expect(result['CA'].opportunities).toContain('opp-2');
    });
  });

  describe('National Opportunities', () => {
    test('national opportunities count for all states', () => {
      const opps = [
        { id: 1, is_national: true, status: 'open', coverage_area_ids: [], maximum_award: 10000000 },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      // National opp should be in all states
      expect(result['CA'].count).toBe(1);
      expect(result['TX'].count).toBe(1);
      expect(result['NY'].count).toBe(1);
    });

    test('national funding adds to all states', () => {
      const opps = [
        { id: 1, is_national: true, status: 'open', coverage_area_ids: [], maximum_award: 10000000 },
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [1], maximum_award: 1000000 }, // CA only
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      // CA gets national + state-specific
      expect(result['CA'].totalFunding).toBe(11000000);
      expect(result['CA'].count).toBe(2);

      // TX only gets national
      expect(result['TX'].totalFunding).toBe(10000000);
      expect(result['TX'].count).toBe(1);
    });
  });

  describe('Multi-State Opportunities', () => {
    test('opportunity covering multiple areas counts once per state', () => {
      const opps = [
        {
          id: 1,
          is_national: false,
          status: 'open',
          coverage_area_ids: [1, 2], // CA state + PG&E (both CA)
          maximum_award: 1000000,
        },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      // Should only count once for CA
      expect(result['CA'].count).toBe(1);
      expect(result['CA'].totalFunding).toBe(1000000);
    });

    test('opportunity covering different states counts in each', () => {
      const multiStateCoverage = {
        1: { id: 1, name: 'California', kind: 'state', state_code: 'CA' },
        2: { id: 2, name: 'Texas', kind: 'state', state_code: 'TX' },
      };

      const opps = [
        {
          id: 1,
          is_national: false,
          status: 'open',
          coverage_area_ids: [1, 2], // CA + TX
          maximum_award: 1000000,
        },
      ];

      const result = calculateFundingByState(opps, multiStateCoverage);

      expect(result['CA'].count).toBe(1);
      expect(result['TX'].count).toBe(1);
      // Funding counts in both but represents same opportunity
      expect(result['CA'].totalFunding).toBe(1000000);
      expect(result['TX'].totalFunding).toBe(1000000);
    });
  });

  describe('Status Filtering', () => {
    test('only includes open opportunities', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [1], maximum_award: 1000000 },
        { id: 2, is_national: false, status: 'closed', coverage_area_ids: [1], maximum_award: 5000000 },
        { id: 3, is_national: false, status: 'upcoming', coverage_area_ids: [1], maximum_award: 2000000 },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      expect(result['CA'].count).toBe(1);
      expect(result['CA'].totalFunding).toBe(1000000);
    });
  });

  describe('Funding Value Selection', () => {
    test('uses maximum_award when available', () => {
      const opps = [
        {
          id: 1,
          is_national: false,
          status: 'open',
          coverage_area_ids: [1],
          maximum_award: 1000000,
          total_funding_available: 50000000,
        },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      expect(result['CA'].totalFunding).toBe(1000000); // Uses max_award
    });

    test('falls back to total_funding_available', () => {
      const opps = [
        {
          id: 1,
          is_national: false,
          status: 'open',
          coverage_area_ids: [1],
          maximum_award: null,
          total_funding_available: 50000000,
        },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      expect(result['CA'].totalFunding).toBe(50000000);
    });

    test('treats null funding as 0', () => {
      const opps = [
        {
          id: 1,
          is_national: false,
          status: 'open',
          coverage_area_ids: [1],
          maximum_award: null,
          total_funding_available: null,
        },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      expect(result['CA'].totalFunding).toBe(0);
      expect(result['CA'].count).toBe(1); // Still counts!
    });
  });

  describe('Color Value Calculation', () => {
    test('calculates color by amount', () => {
      const stats = { count: 5, totalFunding: 10000000, maxAward: 5000000 };

      expect(calculateColorValue(stats, 'amount')).toBe(10000000);
    });

    test('calculates color by count', () => {
      const stats = { count: 5, totalFunding: 10000000, maxAward: 5000000 };

      expect(calculateColorValue(stats, 'count')).toBe(5);
    });

    test('defaults to amount mode', () => {
      const stats = { count: 5, totalFunding: 10000000 };

      expect(calculateColorValue(stats)).toBe(10000000);
    });
  });

  describe('Edge Cases', () => {
    test('empty opportunities array', () => {
      const result = calculateFundingByState([], testCoverageAreas);

      // All states should exist but have 0 counts
      expect(result['CA'].count).toBe(0);
      expect(result['CA'].totalFunding).toBe(0);
    });

    test('opportunity with no coverage areas', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [], maximum_award: 1000000 },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      // Should not affect any state
      expect(result['CA'].count).toBe(0);
    });

    test('opportunity with unknown coverage area IDs', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [999], maximum_award: 1000000 },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      // Unknown IDs should be ignored
      expect(result['CA'].count).toBe(0);
    });
  });

  describe('Summary Statistics', () => {
    test('can calculate total across all states', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [1], maximum_award: 1000000 },
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [3], maximum_award: 2000000 },
        { id: 3, is_national: false, status: 'open', coverage_area_ids: [4], maximum_award: 3000000 },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      // Sum unique opportunities (not double-counted from national)
      const totalOpps = 3;
      const uniqueOppIds = new Set();
      Object.values(result).forEach(state => {
        state.opportunities.forEach(id => uniqueOppIds.add(id));
      });

      expect(uniqueOppIds.size).toBe(totalOpps);
    });

    test('states with funding vs states without', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [1], maximum_award: 1000000 },
      ];

      const result = calculateFundingByState(opps, testCoverageAreas);

      const statesWithFunding = Object.entries(result)
        .filter(([, stats]) => stats.count > 0)
        .map(([code]) => code);

      expect(statesWithFunding).toEqual(['CA']);
    });
  });
});
