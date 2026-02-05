/**
 * Map Scope Breakdown Tests
 *
 * Tests the count calculations for the map's scope breakdown panel:
 * - National count
 * - State-wide count (per state)
 * - County count (per state)
 * - Utility count (per state)
 *
 * IMPORTANT: Opportunities can be in multiple categories simultaneously.
 */

import { describe, test, expect } from 'vitest';

/**
 * Calculate scope breakdown for a given state
 *
 * @param {Array} opportunities - All opportunities
 * @param {string|null} stateCode - State to calculate for (null = all states)
 * @param {Object} coverageAreas - Map of area IDs to area details
 */
function calculateScopeBreakdown(opportunities, stateCode, coverageAreas = {}) {
  const breakdown = {
    national: 0,
    statewide: 0,
    county: 0,
    utility: 0,
  };

  for (const opp of opportunities) {
    if (opp.status !== 'open') continue;

    // National opportunities
    if (opp.is_national) {
      breakdown.national++;
      continue; // National opps don't count toward state/county/utility
    }

    // Skip if filtering by state and opp doesn't cover this state
    if (stateCode && !opportunityCoversState(opp, stateCode, coverageAreas)) {
      continue;
    }

    // Categorize by coverage type
    const coverageTypes = getCoverageTypes(opp, coverageAreas);

    if (coverageTypes.has('state')) breakdown.statewide++;
    if (coverageTypes.has('county')) breakdown.county++;
    if (coverageTypes.has('utility')) breakdown.utility++;
  }

  return breakdown;
}

/**
 * Check if opportunity covers a specific state
 */
function opportunityCoversState(opp, stateCode, coverageAreas) {
  if (opp.is_national) return true;

  return (opp.coverage_area_ids || []).some(areaId => {
    const area = coverageAreas[areaId];
    return area && area.state_code === stateCode;
  });
}

/**
 * Get the types of coverage for an opportunity
 */
function getCoverageTypes(opp, coverageAreas) {
  const types = new Set();

  for (const areaId of (opp.coverage_area_ids || [])) {
    const area = coverageAreas[areaId];
    if (area?.kind) {
      types.add(area.kind);
    }
  }

  return types;
}

// Test coverage areas fixture
const testCoverageAreas = {
  1: { id: 1, name: 'California', kind: 'state', state_code: 'CA' },
  2: { id: 2, name: 'PG&E', kind: 'utility', state_code: 'CA' },
  3: { id: 3, name: 'SCE', kind: 'utility', state_code: 'CA' },
  4: { id: 4, name: 'Los Angeles County', kind: 'county', state_code: 'CA' },
  5: { id: 5, name: 'San Francisco County', kind: 'county', state_code: 'CA' },
  6: { id: 6, name: 'Texas', kind: 'state', state_code: 'TX' },
  7: { id: 7, name: 'Harris County', kind: 'county', state_code: 'TX' },
  8: { id: 8, name: 'Oncor', kind: 'utility', state_code: 'TX' },
};

describe('Map Scope Breakdown', () => {

  describe('National Opportunities', () => {
    test('counts national opportunities', () => {
      const opps = [
        { id: 1, is_national: true, status: 'open', coverage_area_ids: [] },
        { id: 2, is_national: true, status: 'open', coverage_area_ids: [] },
        { id: 3, is_national: false, status: 'open', coverage_area_ids: [1] },
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      expect(result.national).toBe(2);
    });

    test('excludes closed national opportunities', () => {
      const opps = [
        { id: 1, is_national: true, status: 'open', coverage_area_ids: [] },
        { id: 2, is_national: true, status: 'closed', coverage_area_ids: [] },
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      expect(result.national).toBe(1);
    });

    test('national count same regardless of state filter', () => {
      const opps = [
        { id: 1, is_national: true, status: 'open', coverage_area_ids: [] },
        { id: 2, is_national: true, status: 'open', coverage_area_ids: [] },
      ];

      const allStates = calculateScopeBreakdown(opps, null, testCoverageAreas);
      const caOnly = calculateScopeBreakdown(opps, 'CA', testCoverageAreas);

      expect(allStates.national).toBe(2);
      expect(caOnly.national).toBe(2);
    });
  });

  describe('State-Wide Opportunities', () => {
    test('counts state-wide opportunities', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [1] }, // CA state
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [6] }, // TX state
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      expect(result.statewide).toBe(2);
    });

    test('filters state-wide by state code', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [1] }, // CA state
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [6] }, // TX state
      ];

      const caResult = calculateScopeBreakdown(opps, 'CA', testCoverageAreas);
      const txResult = calculateScopeBreakdown(opps, 'TX', testCoverageAreas);

      expect(caResult.statewide).toBe(1);
      expect(txResult.statewide).toBe(1);
    });
  });

  describe('County-Level Opportunities', () => {
    test('counts county opportunities', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [4] }, // LA County
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [5] }, // SF County
        { id: 3, is_national: false, status: 'open', coverage_area_ids: [7] }, // Harris County TX
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      expect(result.county).toBe(3);
    });

    test('filters county by state', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [4] }, // LA County (CA)
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [7] }, // Harris County (TX)
      ];

      const caResult = calculateScopeBreakdown(opps, 'CA', testCoverageAreas);

      expect(caResult.county).toBe(1);
    });
  });

  describe('Utility-Level Opportunities', () => {
    test('counts utility opportunities', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [2] }, // PG&E
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [3] }, // SCE
        { id: 3, is_national: false, status: 'open', coverage_area_ids: [8] }, // Oncor TX
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      expect(result.utility).toBe(3);
    });

    test('filters utility by state', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [2] }, // PG&E (CA)
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [8] }, // Oncor (TX)
      ];

      const caResult = calculateScopeBreakdown(opps, 'CA', testCoverageAreas);

      expect(caResult.utility).toBe(1);
    });
  });

  describe('Multi-Coverage Opportunities', () => {
    test('opportunity covering multiple counties counts once per type', () => {
      const opps = [
        {
          id: 1,
          is_national: false,
          status: 'open',
          coverage_area_ids: [4, 5], // LA + SF counties
        },
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      // Should only count once even though it covers 2 counties
      expect(result.county).toBe(1);
    });

    test('opportunity covering state + utility counts in both', () => {
      const opps = [
        {
          id: 1,
          is_national: false,
          status: 'open',
          coverage_area_ids: [1, 2], // CA state + PG&E utility
        },
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      expect(result.statewide).toBe(1);
      expect(result.utility).toBe(1);
    });

    test('opportunity covering county + utility counts in both', () => {
      const opps = [
        {
          id: 1,
          is_national: false,
          status: 'open',
          coverage_area_ids: [4, 2], // LA County + PG&E
        },
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      expect(result.county).toBe(1);
      expect(result.utility).toBe(1);
    });
  });

  describe('Status Filtering', () => {
    test('only counts open opportunities', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [1] },
        { id: 2, is_national: false, status: 'closed', coverage_area_ids: [1] },
        { id: 3, is_national: false, status: 'upcoming', coverage_area_ids: [1] },
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      expect(result.statewide).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('empty opportunities array', () => {
      const result = calculateScopeBreakdown([], null, testCoverageAreas);

      expect(result.national).toBe(0);
      expect(result.statewide).toBe(0);
      expect(result.county).toBe(0);
      expect(result.utility).toBe(0);
    });

    test('opportunities with empty coverage_area_ids', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [] },
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      expect(result.statewide).toBe(0);
      expect(result.county).toBe(0);
      expect(result.utility).toBe(0);
    });

    test('opportunities with unknown coverage area IDs', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: [999, 1000] },
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      // Unknown IDs should be ignored
      expect(result.statewide).toBe(0);
      expect(result.county).toBe(0);
      expect(result.utility).toBe(0);
    });

    test('handles null coverage_area_ids', () => {
      const opps = [
        { id: 1, is_national: false, status: 'open', coverage_area_ids: null },
      ];

      const result = calculateScopeBreakdown(opps, null, testCoverageAreas);

      expect(result.statewide).toBe(0);
    });
  });

  describe('Total Counts Validation', () => {
    test('totals add up correctly for a state', () => {
      const opps = [
        { id: 1, is_national: true, status: 'open', coverage_area_ids: [] },
        { id: 2, is_national: false, status: 'open', coverage_area_ids: [1] }, // CA state
        { id: 3, is_national: false, status: 'open', coverage_area_ids: [2] }, // PG&E
        { id: 4, is_national: false, status: 'open', coverage_area_ids: [4] }, // LA County
        { id: 5, is_national: false, status: 'open', coverage_area_ids: [1, 2] }, // CA + PG&E
      ];

      const result = calculateScopeBreakdown(opps, 'CA', testCoverageAreas);

      expect(result.national).toBe(1);
      expect(result.statewide).toBe(2); // opps 2 and 5
      expect(result.utility).toBe(2);   // opps 3 and 5
      expect(result.county).toBe(1);    // opp 4
    });
  });
});
