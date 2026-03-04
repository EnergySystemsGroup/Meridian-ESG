/**
 * RPC: get_funding_by_state Tests
 *
 * Tests the state aggregation RPC for map choropleth:
 * - Aggregates opportunity counts per state
 * - Aggregates funding amounts per state
 * - Handles national opportunities across all states
 *
 * NOTE: These tests validate expected behavior patterns.
 * For full integration tests, run against real Supabase.
 */

import { describe, test, expect } from 'vitest';

// US state codes for testing
const ALL_US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

/**
 * Simulates the get_funding_by_state RPC function
 */
function getFundingByState(opportunities, options = {}) {
  const { includeNational = true, colorBy = 'count' } = options;

  // Initialize state data
  const stateData = {};
  ALL_US_STATES.forEach(state => {
    stateData[state] = {
      state_code: state,
      opportunity_count: 0,
      total_funding: 0,
      opportunities: [],
    };
  });

  // Count national opportunities separately
  let nationalCount = 0;
  let nationalFunding = 0;

  opportunities.forEach(opp => {
    const funding = opp.total_funding_available ?? opp.maximum_award ?? 0;

    if (opp.is_national) {
      nationalCount++;
      nationalFunding += funding;

      // If including national, add to all states
      if (includeNational) {
        ALL_US_STATES.forEach(state => {
          stateData[state].opportunity_count++;
          stateData[state].total_funding += funding;
          stateData[state].opportunities.push(opp.id);
        });
      }
    } else if (opp.coverage_state_codes) {
      // Add to specific states
      opp.coverage_state_codes.forEach(state => {
        if (stateData[state]) {
          stateData[state].opportunity_count++;
          stateData[state].total_funding += funding;
          stateData[state].opportunities.push(opp.id);
        }
      });
    }
  });

  return {
    data: {
      states: Object.values(stateData),
      national_count: nationalCount,
      national_funding: nationalFunding,
      total_states_with_funding: Object.values(stateData).filter(s => s.opportunity_count > 0).length,
    },
    error: null,
  };
}

const testOpportunities = [
  {
    id: 'opp-1',
    title: 'Federal Energy Grant',
    is_national: true,
    coverage_state_codes: null,
    total_funding_available: 10000000,
  },
  {
    id: 'opp-2',
    title: 'California State Grant',
    is_national: false,
    coverage_state_codes: ['CA'],
    total_funding_available: 5000000,
  },
  {
    id: 'opp-3',
    title: 'Texas Program',
    is_national: false,
    coverage_state_codes: ['TX'],
    total_funding_available: 3000000,
  },
  {
    id: 'opp-4',
    title: 'West Coast Multi-State',
    is_national: false,
    coverage_state_codes: ['CA', 'OR', 'WA'],
    total_funding_available: 8000000,
  },
  {
    id: 'opp-5',
    title: 'Another National Grant',
    is_national: true,
    coverage_state_codes: null,
    total_funding_available: 20000000,
  },
];

describe('RPC: get_funding_by_state', () => {

  describe('Count Aggregation', () => {
    test('counts opportunities per state', () => {
      const result = getFundingByState(testOpportunities);

      const caData = result.data.states.find(s => s.state_code === 'CA');

      // CA should have: 2 national + 1 CA-specific + 1 multi-state = 4
      expect(caData.opportunity_count).toBe(4);
    });

    test('counts multi-state opportunities in each state', () => {
      const result = getFundingByState(testOpportunities);

      const orData = result.data.states.find(s => s.state_code === 'OR');
      const waData = result.data.states.find(s => s.state_code === 'WA');

      // OR and WA should have: 2 national + 1 multi-state = 3
      expect(orData.opportunity_count).toBe(3);
      expect(waData.opportunity_count).toBe(3);
    });

    test('national opportunities counted in all states', () => {
      const result = getFundingByState(testOpportunities);

      // Every state should have at least the 2 national opportunities
      result.data.states.forEach(state => {
        expect(state.opportunity_count).toBeGreaterThanOrEqual(2);
      });
    });

    test('tracks national count separately', () => {
      const result = getFundingByState(testOpportunities);

      expect(result.data.national_count).toBe(2);
    });
  });

  describe('Funding Aggregation', () => {
    test('sums funding per state', () => {
      const result = getFundingByState(testOpportunities);

      const caData = result.data.states.find(s => s.state_code === 'CA');

      // CA: 10M + 20M (national) + 5M (CA) + 8M (multi-state) = 43M
      expect(caData.total_funding).toBe(43000000);
    });

    test('national funding distributed to all states', () => {
      const result = getFundingByState(testOpportunities);

      // Every state should have at least national funding (30M)
      result.data.states.forEach(state => {
        expect(state.total_funding).toBeGreaterThanOrEqual(30000000);
      });
    });

    test('tracks national funding separately', () => {
      const result = getFundingByState(testOpportunities);

      expect(result.data.national_funding).toBe(30000000);
    });

    test('handles null funding values', () => {
      const oppsWithNull = [
        {
          id: 'opp-null',
          is_national: false,
          coverage_state_codes: ['CA'],
          total_funding_available: null,
          maximum_award: null,
        },
      ];

      const result = getFundingByState(oppsWithNull);

      const caData = result.data.states.find(s => s.state_code === 'CA');
      expect(caData.opportunity_count).toBe(1);
      expect(caData.total_funding).toBe(0);
    });
  });

  describe('Option: includeNational', () => {
    test('excludes national when includeNational=false', () => {
      const result = getFundingByState(testOpportunities, { includeNational: false });

      // CA should have: 1 CA-specific + 1 multi-state = 2 (no national)
      const caData = result.data.states.find(s => s.state_code === 'CA');
      expect(caData.opportunity_count).toBe(2);
    });

    test('states with no regional opportunities are empty when includeNational=false', () => {
      const result = getFundingByState(testOpportunities, { includeNational: false });

      // Florida has no regional opportunities
      const flData = result.data.states.find(s => s.state_code === 'FL');
      expect(flData.opportunity_count).toBe(0);
      expect(flData.total_funding).toBe(0);
    });
  });

  describe('States with Funding Count', () => {
    test('counts states with any opportunities', () => {
      const result = getFundingByState(testOpportunities);

      // With national included, all 51 states have opportunities
      expect(result.data.total_states_with_funding).toBe(51);
    });

    test('counts states with regional opportunities only', () => {
      const result = getFundingByState(testOpportunities, { includeNational: false });

      // CA, TX, OR, WA have regional opportunities = 4 states
      expect(result.data.total_states_with_funding).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty opportunities array', () => {
      const result = getFundingByState([]);

      expect(result.data.states.length).toBe(51);
      expect(result.data.states.every(s => s.opportunity_count === 0)).toBe(true);
      expect(result.data.national_count).toBe(0);
      expect(result.data.total_states_with_funding).toBe(0);
    });

    test('handles opportunities with empty coverage_state_codes', () => {
      const oppsEmptyCoverage = [
        {
          id: 'opp-empty',
          is_national: false,
          coverage_state_codes: [],
          total_funding_available: 1000000,
        },
      ];

      const result = getFundingByState(oppsEmptyCoverage);

      // Should not count in any state
      expect(result.data.states.every(s => s.opportunity_count === 0)).toBe(true);
    });

    test('handles invalid state codes', () => {
      const oppsInvalidState = [
        {
          id: 'opp-invalid',
          is_national: false,
          coverage_state_codes: ['XX', 'YY', 'CA'], // XX and YY are invalid
          total_funding_available: 1000000,
        },
      ];

      const result = getFundingByState(oppsInvalidState);

      // Only CA should get the count
      const caData = result.data.states.find(s => s.state_code === 'CA');
      expect(caData.opportunity_count).toBe(1);

      // Invalid state codes should be ignored
      expect(result.data.states.find(s => s.state_code === 'XX')).toBeUndefined();
    });
  });

  describe('Return Structure', () => {
    test('returns expected structure', () => {
      const result = getFundingByState(testOpportunities);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result.data).toHaveProperty('states');
      expect(result.data).toHaveProperty('national_count');
      expect(result.data).toHaveProperty('national_funding');
      expect(result.data).toHaveProperty('total_states_with_funding');
    });

    test('each state has required fields', () => {
      const result = getFundingByState(testOpportunities);

      result.data.states.forEach(state => {
        expect(state).toHaveProperty('state_code');
        expect(state).toHaveProperty('opportunity_count');
        expect(state).toHaveProperty('total_funding');
        expect(typeof state.state_code).toBe('string');
        expect(typeof state.opportunity_count).toBe('number');
        expect(typeof state.total_funding).toBe('number');
      });
    });

    test('includes all 50 states plus DC', () => {
      const result = getFundingByState(testOpportunities);

      expect(result.data.states.length).toBe(51);

      const stateCodes = result.data.states.map(s => s.state_code);
      expect(stateCodes).toContain('CA');
      expect(stateCodes).toContain('TX');
      expect(stateCodes).toContain('NY');
      expect(stateCodes).toContain('DC');
    });
  });

  describe('Map Choropleth Patterns', () => {
    test('provides data for color by count', () => {
      const result = getFundingByState(testOpportunities);

      // Can calculate min/max for color scale
      const counts = result.data.states.map(s => s.opportunity_count);
      const minCount = Math.min(...counts);
      const maxCount = Math.max(...counts);

      expect(minCount).toBe(2);
      expect(maxCount).toBe(4);
    });

    test('provides data for color by funding', () => {
      const result = getFundingByState(testOpportunities);

      // Can calculate min/max for funding color scale
      const funding = result.data.states.map(s => s.total_funding);
      const minFunding = Math.min(...funding);
      const maxFunding = Math.max(...funding);

      expect(minFunding).toBe(30000000);
      expect(maxFunding).toBe(43000000);
    });

    test('state data can be converted to lookup object', () => {
      const result = getFundingByState(testOpportunities);

      // Convert to lookup for fast map rendering
      const stateDataLookup = {};
      result.data.states.forEach(state => {
        stateDataLookup[state.state_code] = state;
      });

      expect(stateDataLookup['CA'].opportunity_count).toBe(4);
      expect(stateDataLookup['TX'].opportunity_count).toBe(3);
    });
  });

  describe('Opportunity ID Tracking', () => {
    test('tracks which opportunities apply to each state', () => {
      const result = getFundingByState(testOpportunities);

      const caData = result.data.states.find(s => s.state_code === 'CA');

      expect(caData.opportunities).toContain('opp-1'); // national
      expect(caData.opportunities).toContain('opp-2'); // CA-specific
      expect(caData.opportunities).toContain('opp-4'); // multi-state
      expect(caData.opportunities).toContain('opp-5'); // national
    });

    test('TX-specific opportunity not in CA list', () => {
      const result = getFundingByState(testOpportunities);

      const caData = result.data.states.find(s => s.state_code === 'CA');

      expect(caData.opportunities).not.toContain('opp-3'); // TX-only
    });
  });
});
