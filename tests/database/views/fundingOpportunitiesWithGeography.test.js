/**
 * View: funding_opportunities_with_geography Tests
 *
 * Tests the view that joins opportunities with coverage area data:
 * - coverage_state_codes calculation
 * - is_national flag handling
 * - Geographic aggregation
 *
 * NOTE: These tests validate expected behavior patterns.
 * For full integration tests, run against real Supabase.
 */

import { describe, test, expect } from 'vitest';

/**
 * Simulates the coverage_state_codes calculation from the view
 *
 * The real view does:
 * ARRAY_AGG(DISTINCT ca.state_code) FILTER (WHERE ca.state_code IS NOT NULL)
 */
function calculateCoverageStateCodes(opportunityCoverageAreas, coverageAreas) {
  const stateCodes = new Set();

  for (const link of opportunityCoverageAreas) {
    const area = coverageAreas.find(ca => ca.id === link.coverage_area_id);
    if (area?.state_code) {
      stateCodes.add(area.state_code);
    }
  }

  return stateCodes.size > 0 ? Array.from(stateCodes).sort() : null;
}

/**
 * Simulates building the view result for an opportunity
 */
function buildViewResult(opportunity, opportunityCoverageAreas, coverageAreas) {
  return {
    ...opportunity,
    coverage_state_codes: calculateCoverageStateCodes(
      opportunityCoverageAreas.filter(oca => oca.opportunity_id === opportunity.id),
      coverageAreas
    ),
  };
}

// Test data
const coverageAreas = [
  { id: 1, name: 'California', kind: 'state', state_code: 'CA' },
  { id: 2, name: 'PG&E', kind: 'utility', state_code: 'CA' },
  { id: 3, name: 'SCE', kind: 'utility', state_code: 'CA' },
  { id: 4, name: 'Texas', kind: 'state', state_code: 'TX' },
  { id: 5, name: 'Oncor', kind: 'utility', state_code: 'TX' },
  { id: 6, name: 'New York', kind: 'state', state_code: 'NY' },
  { id: 7, name: 'National', kind: 'national', state_code: null }, // National has no state_code
];

const opportunities = [
  { id: 'opp-1', title: 'National Grant', is_national: true },
  { id: 'opp-2', title: 'California Grant', is_national: false },
  { id: 'opp-3', title: 'Multi-State Grant', is_national: false },
  { id: 'opp-4', title: 'Utility Grant', is_national: false },
  { id: 'opp-5', title: 'No Coverage Grant', is_national: false },
];

const opportunityCoverageAreas = [
  // opp-1 (National) - no coverage areas typically
  // opp-2 (California) - state + utilities
  { opportunity_id: 'opp-2', coverage_area_id: 1 }, // CA state
  { opportunity_id: 'opp-2', coverage_area_id: 2 }, // PG&E (CA)
  // opp-3 (Multi-State)
  { opportunity_id: 'opp-3', coverage_area_id: 1 }, // CA
  { opportunity_id: 'opp-3', coverage_area_id: 4 }, // TX
  { opportunity_id: 'opp-3', coverage_area_id: 6 }, // NY
  // opp-4 (Utility only)
  { opportunity_id: 'opp-4', coverage_area_id: 2 }, // PG&E (CA)
  { opportunity_id: 'opp-4', coverage_area_id: 5 }, // Oncor (TX)
  // opp-5 (No coverage areas)
];

describe('View: funding_opportunities_with_geography', () => {

  describe('coverage_state_codes Calculation', () => {
    test('aggregates state codes from coverage areas', () => {
      const result = buildViewResult(opportunities[1], opportunityCoverageAreas, coverageAreas);

      // California grant with CA state + PG&E utility
      expect(result.coverage_state_codes).toEqual(['CA']);
    });

    test('deduplicates state codes', () => {
      const result = buildViewResult(opportunities[1], opportunityCoverageAreas, coverageAreas);

      // Both CA state and PG&E (CA) should result in single 'CA'
      expect(result.coverage_state_codes).toHaveLength(1);
      expect(result.coverage_state_codes).toContain('CA');
    });

    test('handles multiple states', () => {
      const result = buildViewResult(opportunities[2], opportunityCoverageAreas, coverageAreas);

      // Multi-state grant covers CA, TX, NY
      expect(result.coverage_state_codes).toContain('CA');
      expect(result.coverage_state_codes).toContain('TX');
      expect(result.coverage_state_codes).toContain('NY');
      expect(result.coverage_state_codes).toHaveLength(3);
    });

    test('extracts state from utility coverage areas', () => {
      const result = buildViewResult(opportunities[3], opportunityCoverageAreas, coverageAreas);

      // Utility-only grant with PG&E (CA) and Oncor (TX)
      expect(result.coverage_state_codes).toContain('CA');
      expect(result.coverage_state_codes).toContain('TX');
    });

    test('returns null for no coverage areas', () => {
      const result = buildViewResult(opportunities[4], opportunityCoverageAreas, coverageAreas);

      expect(result.coverage_state_codes).toBeNull();
    });

    test('returns null for national opportunities with no coverage areas', () => {
      const result = buildViewResult(opportunities[0], opportunityCoverageAreas, coverageAreas);

      expect(result.coverage_state_codes).toBeNull();
    });
  });

  describe('is_national Flag Handling', () => {
    test('national opportunities have is_national=true', () => {
      const result = buildViewResult(opportunities[0], opportunityCoverageAreas, coverageAreas);

      expect(result.is_national).toBe(true);
    });

    test('regional opportunities have is_national=false', () => {
      const result = buildViewResult(opportunities[1], opportunityCoverageAreas, coverageAreas);

      expect(result.is_national).toBe(false);
    });

    test('national + regional distinction for filtering', () => {
      const results = opportunities.map(opp =>
        buildViewResult(opp, opportunityCoverageAreas, coverageAreas)
      );

      const national = results.filter(r => r.is_national);
      const regional = results.filter(r => !r.is_national);

      expect(national).toHaveLength(1);
      expect(regional).toHaveLength(4);
    });
  });

  describe('Geographic Query Patterns', () => {
    test('filter by state using coverage_state_codes', () => {
      const results = opportunities.map(opp =>
        buildViewResult(opp, opportunityCoverageAreas, coverageAreas)
      );

      // Query pattern: coverage_state_codes @> ARRAY['CA']
      const caOpportunities = results.filter(r =>
        r.is_national || (r.coverage_state_codes && r.coverage_state_codes.includes('CA'))
      );

      // Should include: National (is_national=true) + California + Multi-State + Utility (PG&E)
      expect(caOpportunities.length).toBeGreaterThanOrEqual(3);
    });

    test('national opportunities match all state queries', () => {
      const results = opportunities.map(opp =>
        buildViewResult(opp, opportunityCoverageAreas, coverageAreas)
      );

      const nationalOpp = results.find(r => r.is_national);

      // National should match any state query
      ['CA', 'TX', 'NY', 'FL'].forEach(state => {
        const matches = nationalOpp.is_national ||
          (nationalOpp.coverage_state_codes && nationalOpp.coverage_state_codes.includes(state));
        expect(matches).toBe(true);
      });
    });

    test('filter by multiple states', () => {
      const results = opportunities.map(opp =>
        buildViewResult(opp, opportunityCoverageAreas, coverageAreas)
      );

      // Query pattern: coverage_state_codes && ARRAY['CA', 'TX'] (overlap)
      const caOrTxOpportunities = results.filter(r =>
        r.is_national ||
        (r.coverage_state_codes && (
          r.coverage_state_codes.includes('CA') || r.coverage_state_codes.includes('TX')
        ))
      );

      expect(caOrTxOpportunities.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Data Integrity', () => {
    test('preserves opportunity fields', () => {
      const opp = { id: 'test', title: 'Test', status: 'open', is_national: false };
      const result = buildViewResult(opp, [], coverageAreas);

      expect(result.id).toBe('test');
      expect(result.title).toBe('Test');
      expect(result.status).toBe('open');
    });

    test('coverage_state_codes is sorted', () => {
      const result = buildViewResult(opportunities[2], opportunityCoverageAreas, coverageAreas);

      // Should be alphabetically sorted
      const sorted = [...result.coverage_state_codes].sort();
      expect(result.coverage_state_codes).toEqual(sorted);
    });
  });

  describe('Edge Cases', () => {
    test('coverage area with null state_code excluded', () => {
      const oppWithNationalArea = [
        { opportunity_id: 'opp-test', coverage_area_id: 7 }, // National area (null state_code)
        { opportunity_id: 'opp-test', coverage_area_id: 1 }, // CA state
      ];

      const result = calculateCoverageStateCodes(oppWithNationalArea, coverageAreas);

      // Should only include CA, not null from national area
      expect(result).toEqual(['CA']);
    });

    test('handles unknown coverage_area_id', () => {
      const oppWithUnknownArea = [
        { opportunity_id: 'opp-test', coverage_area_id: 999 }, // Unknown
      ];

      const result = calculateCoverageStateCodes(oppWithUnknownArea, coverageAreas);

      expect(result).toBeNull();
    });
  });
});
