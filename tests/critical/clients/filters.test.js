/**
 * Clients Filters Tests
 *
 * Tests the filtering logic for the clients list:
 * - Client Type filter (multi-select)
 * - State filter (multi-select)
 * - Match Status filter (All, Has Matches, No Matches)
 * - DAC Status filter
 * - Combined filters
 */

import { describe, test, expect } from 'vitest';

/**
 * Filter clients by type (multi-select)
 */
function filterByType(clients, selectedTypes) {
  if (!selectedTypes || selectedTypes.length === 0) return clients;

  return clients.filter(client =>
    selectedTypes.includes(client.type)
  );
}

/**
 * Filter clients by state (multi-select)
 */
function filterByState(clients, selectedStates) {
  if (!selectedStates || selectedStates.length === 0) return clients;

  return clients.filter(client =>
    selectedStates.includes(client.state)
  );
}

/**
 * Filter clients by match status
 */
function filterByMatchStatus(clients, status) {
  if (!status || status === 'all') return clients;

  switch (status) {
    case 'has_matches':
      return clients.filter(c => (c.match_count || 0) > 0);
    case 'no_matches':
      return clients.filter(c => (c.match_count || 0) === 0);
    default:
      return clients;
  }
}

/**
 * Filter clients by DAC status
 */
function filterByDacStatus(clients, dacOnly) {
  if (!dacOnly) return clients;

  return clients.filter(c => c.is_dac === true);
}

/**
 * Apply all filters
 */
function applyFilters(clients, filters = {}) {
  let result = clients;

  if (filters.types?.length > 0) {
    result = filterByType(result, filters.types);
  }

  if (filters.states?.length > 0) {
    result = filterByState(result, filters.states);
  }

  if (filters.matchStatus) {
    result = filterByMatchStatus(result, filters.matchStatus);
  }

  if (filters.dacOnly) {
    result = filterByDacStatus(result, filters.dacOnly);
  }

  return result;
}

const testClients = [
  { id: 1, name: 'City of SF', type: 'Municipal Government', state: 'CA', match_count: 5, is_dac: false },
  { id: 2, name: 'Oakland USD', type: 'School District', state: 'CA', match_count: 3, is_dac: true },
  { id: 3, name: 'Houston HA', type: 'Public Housing Authority', state: 'TX', match_count: 0, is_dac: true },
  { id: 4, name: 'PG&E', type: 'Utility', state: 'CA', match_count: 8, is_dac: false },
  { id: 5, name: 'Navajo Nation', type: 'Tribal Government', state: 'AZ', match_count: 2, is_dac: true },
  { id: 6, name: 'NYC DOE', type: 'School District', state: 'NY', match_count: 0, is_dac: false },
  { id: 7, name: 'LA County', type: 'Municipal Government', state: 'CA', match_count: 6, is_dac: true },
];

describe('Clients Filters', () => {

  describe('Type Filter', () => {
    test('filters by single type', () => {
      const result = filterByType(testClients, ['School District']);

      expect(result).toHaveLength(2);
      expect(result.every(c => c.type === 'School District')).toBe(true);
    });

    test('filters by multiple types', () => {
      const result = filterByType(testClients, ['School District', 'Utility']);

      expect(result).toHaveLength(3);
    });

    test('returns all when no types selected', () => {
      expect(filterByType(testClients, [])).toHaveLength(7);
      expect(filterByType(testClients, null)).toHaveLength(7);
    });

    test('returns empty when no matching types', () => {
      const result = filterByType(testClients, ['Nonexistent Type']);

      expect(result).toHaveLength(0);
    });

    test('type filter is exact match', () => {
      const result = filterByType(testClients, ['Municipal']);

      // 'Municipal' is not exact match for 'Municipal Government'
      expect(result).toHaveLength(0);
    });
  });

  describe('State Filter', () => {
    test('filters by single state', () => {
      const result = filterByState(testClients, ['CA']);

      expect(result).toHaveLength(4);
      expect(result.every(c => c.state === 'CA')).toBe(true);
    });

    test('filters by multiple states', () => {
      const result = filterByState(testClients, ['CA', 'TX']);

      expect(result).toHaveLength(5);
    });

    test('returns all when no states selected', () => {
      expect(filterByState(testClients, [])).toHaveLength(7);
      expect(filterByState(testClients, null)).toHaveLength(7);
    });

    test('returns empty when no matching states', () => {
      const result = filterByState(testClients, ['FL']);

      expect(result).toHaveLength(0);
    });
  });

  describe('Match Status Filter', () => {
    test('filters to clients with matches', () => {
      const result = filterByMatchStatus(testClients, 'has_matches');

      expect(result).toHaveLength(5);
      expect(result.every(c => c.match_count > 0)).toBe(true);
    });

    test('filters to clients without matches', () => {
      const result = filterByMatchStatus(testClients, 'no_matches');

      expect(result).toHaveLength(2);
      expect(result.every(c => c.match_count === 0)).toBe(true);
    });

    test('returns all when status is "all"', () => {
      const result = filterByMatchStatus(testClients, 'all');

      expect(result).toHaveLength(7);
    });

    test('returns all when status is null/undefined', () => {
      expect(filterByMatchStatus(testClients, null)).toHaveLength(7);
      expect(filterByMatchStatus(testClients, undefined)).toHaveLength(7);
    });

    test('handles null match_count as 0', () => {
      const clients = [
        { id: 1, match_count: null },
        { id: 2, match_count: 5 },
      ];

      const noMatches = filterByMatchStatus(clients, 'no_matches');
      expect(noMatches).toHaveLength(1);
      expect(noMatches[0].id).toBe(1);

      const hasMatches = filterByMatchStatus(clients, 'has_matches');
      expect(hasMatches).toHaveLength(1);
      expect(hasMatches[0].id).toBe(2);
    });

    test('handles undefined match_count as 0', () => {
      const clients = [
        { id: 1 }, // No match_count property
        { id: 2, match_count: 3 },
      ];

      const noMatches = filterByMatchStatus(clients, 'no_matches');
      expect(noMatches).toHaveLength(1);
      expect(noMatches[0].id).toBe(1);
    });
  });

  describe('DAC Status Filter', () => {
    test('filters to DAC communities only', () => {
      const result = filterByDacStatus(testClients, true);

      expect(result).toHaveLength(4);
      expect(result.every(c => c.is_dac === true)).toBe(true);
    });

    test('returns all when DAC filter is false', () => {
      const result = filterByDacStatus(testClients, false);

      expect(result).toHaveLength(7);
    });

    test('handles null is_dac as false', () => {
      const clients = [
        { id: 1, is_dac: null },
        { id: 2, is_dac: true },
      ];

      const result = filterByDacStatus(clients, true);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });
  });

  describe('Combined Filters', () => {
    test('type + state filters', () => {
      const result = applyFilters(testClients, {
        types: ['Municipal Government'],
        states: ['CA'],
      });

      expect(result).toHaveLength(2); // City of SF + LA County
      expect(result.every(c =>
        c.type === 'Municipal Government' && c.state === 'CA'
      )).toBe(true);
    });

    test('type + match status filters', () => {
      const result = applyFilters(testClients, {
        types: ['School District'],
        matchStatus: 'has_matches',
      });

      expect(result).toHaveLength(1); // Oakland USD
      expect(result[0].id).toBe(2);
    });

    test('state + DAC filters', () => {
      const result = applyFilters(testClients, {
        states: ['CA'],
        dacOnly: true,
      });

      expect(result).toHaveLength(2); // Oakland USD + LA County
    });

    test('all filters combined', () => {
      const result = applyFilters(testClients, {
        types: ['Municipal Government', 'School District'],
        states: ['CA'],
        matchStatus: 'has_matches',
        dacOnly: true,
      });

      expect(result).toHaveLength(2); // Oakland USD + LA County
    });

    test('combined filters can result in empty set', () => {
      const result = applyFilters(testClients, {
        types: ['Utility'],
        states: ['TX'],
      });

      expect(result).toHaveLength(0);
    });

    test('empty filters returns all', () => {
      const result = applyFilters(testClients, {});

      expect(result).toHaveLength(7);
    });
  });

  describe('Edge Cases', () => {
    test('empty client array', () => {
      expect(filterByType([], ['School District'])).toHaveLength(0);
      expect(filterByState([], ['CA'])).toHaveLength(0);
      expect(filterByMatchStatus([], 'has_matches')).toHaveLength(0);
      expect(filterByDacStatus([], true)).toHaveLength(0);
    });

    test('filter does not mutate original array', () => {
      const original = [...testClients];
      filterByType(testClients, ['School District']);

      expect(testClients).toEqual(original);
    });

    test('empty filter returns original array (optimization)', () => {
      // Empty filter returns original array as optimization
      // This is acceptable behavior - no filtering needed
      const result = filterByType(testClients, []);

      expect(result).toHaveLength(testClients.length);
    });
  });

  describe('Filter Count Preview', () => {
    test('can calculate filter result counts', () => {
      const typeOptions = ['Municipal Government', 'School District', 'Utility', 'Public Housing Authority', 'Tribal Government'];

      const counts = typeOptions.map(type => ({
        type,
        count: filterByType(testClients, [type]).length,
      }));

      expect(counts.find(c => c.type === 'Municipal Government').count).toBe(2);
      expect(counts.find(c => c.type === 'School District').count).toBe(2);
      expect(counts.find(c => c.type === 'Utility').count).toBe(1);
    });

    test('can calculate state result counts', () => {
      const stateOptions = ['CA', 'TX', 'NY', 'AZ'];

      const counts = stateOptions.map(state => ({
        state,
        count: filterByState(testClients, [state]).length,
      }));

      expect(counts.find(c => c.state === 'CA').count).toBe(4);
      expect(counts.find(c => c.state === 'TX').count).toBe(1);
    });
  });
});
