/**
 * Map Coverage Areas Critical Tests
 *
 * Tests the business logic for:
 * - GET /api/map/coverage-areas/[stateCode] — kind validation, counts map building
 * - GET /api/map/national — pagination parsing, countOnly mode
 */

import { describe, test, expect } from 'vitest';

// --- Inline functions mirroring production logic ---

/**
 * Validate the "kind" query parameter.
 * Mirrors: app/api/map/coverage-areas/[stateCode]/route.js line 24
 */
function isValidKind(kind) {
  return ['county', 'utility'].includes(kind);
}

/**
 * Build counts lookup map from RPC result array.
 * Mirrors: app/api/map/coverage-areas/[stateCode]/route.js lines 69-74
 */
function buildCountsMap(countsData) {
  const counts = {};
  countsData.forEach(item => {
    counts[item.area_id] = {
      opportunity_count: item.opportunity_count,
      total_funding: item.total_funding,
    };
  });
  return counts;
}

/**
 * Parse comma-separated status string into array or null.
 * Mirrors: app/api/map/coverage-areas/[stateCode]/route.js line 59
 * and app/api/map/national/route.js line 22-25
 */
function parseCommaSeparated(param) {
  return param ? param.split(',') : null;
}

/**
 * Parse pagination parameters with defaults.
 * Mirrors: app/api/map/national/route.js lines 24-25
 */
function parsePagination(pageStr, pageSizeStr) {
  const page = parseInt(pageStr || '1', 10);
  const pageSize = parseInt(pageSizeStr || '10', 10);
  return { page, pageSize };
}

/**
 * Normalize stateCode to uppercase.
 * Mirrors: app/api/map/coverage-areas/[stateCode]/route.js line 35
 */
function normalizeStateCode(stateCode) {
  return stateCode.toUpperCase();
}

/**
 * Determine if countOnly mode is requested.
 * Mirrors: app/api/map/national/route.js line 27
 */
function isCountOnly(param) {
  return param === 'true';
}

// --- Tests ---

describe('Map Coverage Areas Logic', () => {

  describe('Kind Parameter Validation', () => {
    test('county is valid', () => {
      expect(isValidKind('county')).toBe(true);
    });

    test('utility is valid', () => {
      expect(isValidKind('utility')).toBe(true);
    });

    test('state is invalid', () => {
      expect(isValidKind('state')).toBe(false);
    });

    test('empty string is invalid', () => {
      expect(isValidKind('')).toBe(false);
    });

    test('null is invalid', () => {
      expect(isValidKind(null)).toBe(false);
    });

    test('uppercase County is invalid (case-sensitive)', () => {
      expect(isValidKind('County')).toBe(false);
    });

    test('arbitrary string is invalid', () => {
      expect(isValidKind('region')).toBe(false);
    });
  });

  describe('Counts Map Building', () => {
    test('builds map from RPC data', () => {
      const data = [
        { area_id: 'area-1', opportunity_count: 5, total_funding: 1000000 },
        { area_id: 'area-2', opportunity_count: 12, total_funding: 5000000 },
      ];

      const result = buildCountsMap(data);

      expect(result['area-1']).toEqual({
        opportunity_count: 5,
        total_funding: 1000000,
      });
      expect(result['area-2']).toEqual({
        opportunity_count: 12,
        total_funding: 5000000,
      });
    });

    test('empty array yields empty map', () => {
      expect(buildCountsMap([])).toEqual({});
    });

    test('preserves numeric types', () => {
      const data = [
        { area_id: 'a1', opportunity_count: 0, total_funding: 0 },
      ];

      const result = buildCountsMap(data);

      expect(typeof result['a1'].opportunity_count).toBe('number');
      expect(typeof result['a1'].total_funding).toBe('number');
    });

    test('handles large count sets', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        area_id: `area-${i}`,
        opportunity_count: i,
        total_funding: i * 100000,
      }));

      const result = buildCountsMap(data);

      expect(Object.keys(result)).toHaveLength(100);
      expect(result['area-50'].opportunity_count).toBe(50);
    });

    test('last entry wins for duplicate area_ids', () => {
      const data = [
        { area_id: 'a1', opportunity_count: 5, total_funding: 100 },
        { area_id: 'a1', opportunity_count: 10, total_funding: 200 },
      ];

      const result = buildCountsMap(data);

      expect(result['a1'].opportunity_count).toBe(10);
    });
  });

  describe('State Code Normalization', () => {
    test('lowercases to uppercase', () => {
      expect(normalizeStateCode('ca')).toBe('CA');
    });

    test('mixed case to uppercase', () => {
      expect(normalizeStateCode('cA')).toBe('CA');
    });

    test('already uppercase stays same', () => {
      expect(normalizeStateCode('TX')).toBe('TX');
    });
  });

  describe('Comma-Separated Parameter Parsing', () => {
    test('parses single value', () => {
      expect(parseCommaSeparated('Open')).toEqual(['Open']);
    });

    test('parses multiple values', () => {
      expect(parseCommaSeparated('Open,Upcoming')).toEqual(['Open', 'Upcoming']);
    });

    test('returns null for empty string', () => {
      expect(parseCommaSeparated('')).toEqual(null);
    });

    test('returns null for null', () => {
      expect(parseCommaSeparated(null)).toEqual(null);
    });

    test('returns null for undefined', () => {
      expect(parseCommaSeparated(undefined)).toEqual(null);
    });

    test('preserves whitespace (no trimming)', () => {
      expect(parseCommaSeparated('Open, Upcoming')).toEqual(['Open', ' Upcoming']);
    });
  });
});

describe('Map National Opportunities Logic', () => {

  describe('Pagination Parsing', () => {
    test('default values (no params)', () => {
      const result = parsePagination(null, null);
      expect(result).toEqual({ page: 1, pageSize: 10 });
    });

    test('explicit values', () => {
      const result = parsePagination('3', '25');
      expect(result).toEqual({ page: 3, pageSize: 25 });
    });

    test('string zero parses to 0', () => {
      const result = parsePagination('0', '0');
      expect(result).toEqual({ page: 0, pageSize: 0 });
    });

    test('non-numeric strings become NaN', () => {
      const result = parsePagination('abc', 'def');
      expect(isNaN(result.page)).toBe(true);
      expect(isNaN(result.pageSize)).toBe(true);
    });

    test('partial params use defaults', () => {
      const result = parsePagination('5', null);
      expect(result).toEqual({ page: 5, pageSize: 10 });
    });
  });

  describe('Count-Only Mode', () => {
    test('"true" string enables countOnly', () => {
      expect(isCountOnly('true')).toBe(true);
    });

    test('"false" string does not enable countOnly', () => {
      expect(isCountOnly('false')).toBe(false);
    });

    test('null does not enable countOnly', () => {
      expect(isCountOnly(null)).toBe(false);
    });

    test('empty string does not enable countOnly', () => {
      expect(isCountOnly('')).toBe(false);
    });

    test('undefined does not enable countOnly', () => {
      expect(isCountOnly(undefined)).toBe(false);
    });
  });
});
