/**
 * RPC: get_scope_breakdown Tests
 *
 * Tests the scope breakdown RPC for map view:
 * - Counts opportunities by scope (national, state, county, utility)
 * - Handles state-specific filtering
 * - Aggregates funding amounts
 *
 * NOTE: These tests validate expected behavior patterns.
 * For full integration tests, run against real Supabase.
 */

import { describe, test, expect } from 'vitest';

/**
 * Simulates the get_scope_breakdown RPC function
 */
function getScopeBreakdown(opportunities, stateCode = null) {
  // Filter by state if provided
  let filtered = opportunities;
  if (stateCode) {
    filtered = opportunities.filter(opp =>
      opp.is_national ||
      (opp.coverage_state_codes && opp.coverage_state_codes.includes(stateCode))
    );
  }

  // Group by scope
  const breakdown = {
    national: { count: 0, funding: 0 },
    state_wide: { count: 0, funding: 0 },
    county: { count: 0, funding: 0 },
    utility: { count: 0, funding: 0 },
    local: { count: 0, funding: 0 },
  };

  filtered.forEach(opp => {
    const funding = opp.total_funding_available ?? opp.maximum_award ?? 0;

    if (opp.is_national) {
      breakdown.national.count++;
      breakdown.national.funding += funding;
    } else if (opp.scope === 'state_wide' || opp.coverage_scope === 'state') {
      breakdown.state_wide.count++;
      breakdown.state_wide.funding += funding;
    } else if (opp.scope === 'county' || opp.coverage_scope === 'county') {
      breakdown.county.count++;
      breakdown.county.funding += funding;
    } else if (opp.scope === 'utility' || opp.coverage_scope === 'utility') {
      breakdown.utility.count++;
      breakdown.utility.funding += funding;
    } else {
      // Default to local if no specific scope
      breakdown.local.count++;
      breakdown.local.funding += funding;
    }
  });

  return {
    data: breakdown,
    error: null,
  };
}

const testOpportunities = [
  {
    id: 'opp-1',
    title: 'Federal Energy Grant',
    is_national: true,
    coverage_state_codes: null,
    scope: null,
    coverage_scope: 'national',
    total_funding_available: 10000000,
  },
  {
    id: 'opp-2',
    title: 'California State Grant',
    is_national: false,
    coverage_state_codes: ['CA'],
    scope: 'state_wide',
    coverage_scope: 'state',
    total_funding_available: 5000000,
  },
  {
    id: 'opp-3',
    title: 'PG&E Rebate',
    is_national: false,
    coverage_state_codes: ['CA'],
    scope: 'utility',
    coverage_scope: 'utility',
    total_funding_available: 500000,
  },
  {
    id: 'opp-4',
    title: 'SF County Grant',
    is_national: false,
    coverage_state_codes: ['CA'],
    scope: 'county',
    coverage_scope: 'county',
    total_funding_available: 250000,
  },
  {
    id: 'opp-5',
    title: 'Texas State Program',
    is_national: false,
    coverage_state_codes: ['TX'],
    scope: 'state_wide',
    coverage_scope: 'state',
    total_funding_available: 3000000,
  },
  {
    id: 'opp-6',
    title: 'Multi-State Grant',
    is_national: false,
    coverage_state_codes: ['CA', 'TX', 'NY'],
    scope: 'state_wide',
    coverage_scope: 'state',
    total_funding_available: 8000000,
  },
  {
    id: 'opp-7',
    title: 'Another Federal Grant',
    is_national: true,
    coverage_state_codes: null,
    scope: null,
    coverage_scope: 'national',
    total_funding_available: 20000000,
  },
];

describe('RPC: get_scope_breakdown', () => {

  describe('All Opportunities (No State Filter)', () => {
    test('counts all national opportunities', () => {
      const result = getScopeBreakdown(testOpportunities);

      expect(result.error).toBeNull();
      expect(result.data.national.count).toBe(2);
    });

    test('sums national funding correctly', () => {
      const result = getScopeBreakdown(testOpportunities);

      expect(result.data.national.funding).toBe(30000000); // 10M + 20M
    });

    test('counts state-wide opportunities', () => {
      const result = getScopeBreakdown(testOpportunities);

      // CA state, TX state, Multi-state
      expect(result.data.state_wide.count).toBe(3);
    });

    test('counts utility opportunities', () => {
      const result = getScopeBreakdown(testOpportunities);

      expect(result.data.utility.count).toBe(1);
      expect(result.data.utility.funding).toBe(500000);
    });

    test('counts county opportunities', () => {
      const result = getScopeBreakdown(testOpportunities);

      expect(result.data.county.count).toBe(1);
      expect(result.data.county.funding).toBe(250000);
    });
  });

  describe('State-Filtered Breakdown', () => {
    test('includes national in state filter results', () => {
      const result = getScopeBreakdown(testOpportunities, 'CA');

      // National opportunities should be included
      expect(result.data.national.count).toBe(2);
    });

    test('filters to state-specific opportunities', () => {
      const result = getScopeBreakdown(testOpportunities, 'CA');

      // Should include: national (2), CA state (1), Multi-state (1), PG&E (1), SF County (1)
      const totalCount =
        result.data.national.count +
        result.data.state_wide.count +
        result.data.utility.count +
        result.data.county.count +
        result.data.local.count;

      expect(totalCount).toBe(6);
    });

    test('excludes opportunities from other states', () => {
      const result = getScopeBreakdown(testOpportunities, 'TX');

      // TX should have: national (2) + TX state (1) + Multi-state (1) = 4
      // Should NOT include CA-only opportunities
      const totalCount =
        result.data.national.count +
        result.data.state_wide.count +
        result.data.utility.count +
        result.data.county.count +
        result.data.local.count;

      expect(totalCount).toBe(4);
    });

    test('handles state with no specific opportunities', () => {
      const result = getScopeBreakdown(testOpportunities, 'FL');

      // FL should only see national opportunities
      expect(result.data.national.count).toBe(2);
      expect(result.data.state_wide.count).toBe(0);
      expect(result.data.utility.count).toBe(0);
      expect(result.data.county.count).toBe(0);
    });
  });

  describe('Funding Calculations', () => {
    test('calculates total funding across scopes', () => {
      const result = getScopeBreakdown(testOpportunities);

      const totalFunding =
        result.data.national.funding +
        result.data.state_wide.funding +
        result.data.utility.funding +
        result.data.county.funding +
        result.data.local.funding;

      // 30M + 16M + 0.5M + 0.25M = 46.75M
      expect(totalFunding).toBe(46750000);
    });

    test('handles opportunities with null funding', () => {
      const oppsWithNull = [
        ...testOpportunities,
        {
          id: 'opp-null',
          is_national: true,
          total_funding_available: null,
          maximum_award: null,
        },
      ];

      const result = getScopeBreakdown(oppsWithNull);

      expect(result.data.national.count).toBe(3);
      // Funding should not throw error with null
      expect(typeof result.data.national.funding).toBe('number');
    });

    test('uses maximum_award as fallback', () => {
      const oppsWithMaxAward = [
        {
          id: 'opp-fallback',
          is_national: true,
          total_funding_available: null,
          maximum_award: 1000000,
        },
      ];

      const result = getScopeBreakdown(oppsWithMaxAward);

      expect(result.data.national.funding).toBe(1000000);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty opportunities array', () => {
      const result = getScopeBreakdown([]);

      expect(result.data.national.count).toBe(0);
      expect(result.data.state_wide.count).toBe(0);
      expect(result.data.national.funding).toBe(0);
    });

    test('handles null state code', () => {
      const result = getScopeBreakdown(testOpportunities, null);

      // Should return all opportunities (same as no filter)
      const totalCount =
        result.data.national.count +
        result.data.state_wide.count +
        result.data.utility.count +
        result.data.county.count +
        result.data.local.count;

      expect(totalCount).toBe(7);
    });

    test('handles opportunity with no scope', () => {
      const oppsNoScope = [
        {
          id: 'opp-no-scope',
          is_national: false,
          coverage_state_codes: ['CA'],
          scope: null,
          coverage_scope: null,
          total_funding_available: 100000,
        },
      ];

      const result = getScopeBreakdown(oppsNoScope);

      // Should fall into 'local' bucket
      expect(result.data.local.count).toBe(1);
    });
  });

  describe('Return Structure', () => {
    test('returns expected structure', () => {
      const result = getScopeBreakdown(testOpportunities);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result.data).toHaveProperty('national');
      expect(result.data).toHaveProperty('state_wide');
      expect(result.data).toHaveProperty('county');
      expect(result.data).toHaveProperty('utility');
      expect(result.data).toHaveProperty('local');
    });

    test('each scope has count and funding', () => {
      const result = getScopeBreakdown(testOpportunities);

      ['national', 'state_wide', 'county', 'utility', 'local'].forEach(scope => {
        expect(result.data[scope]).toHaveProperty('count');
        expect(result.data[scope]).toHaveProperty('funding');
        expect(typeof result.data[scope].count).toBe('number');
        expect(typeof result.data[scope].funding).toBe('number');
      });
    });
  });

  describe('Map Integration Patterns', () => {
    test('breakdown for summary panel display', () => {
      const result = getScopeBreakdown(testOpportunities, 'CA');

      // Summary panel needs counts for each scope
      const summaryData = {
        national: result.data.national.count,
        stateWide: result.data.state_wide.count,
        county: result.data.county.count,
        utility: result.data.utility.count,
      };

      expect(Object.values(summaryData).every(v => typeof v === 'number')).toBe(true);
    });

    test('calculates percentage breakdown', () => {
      const result = getScopeBreakdown(testOpportunities);

      const total =
        result.data.national.count +
        result.data.state_wide.count +
        result.data.county.count +
        result.data.utility.count +
        result.data.local.count;

      const nationalPct = (result.data.national.count / total) * 100;

      expect(nationalPct).toBeCloseTo(28.57, 1); // 2/7 ≈ 28.57%
    });
  });
});
