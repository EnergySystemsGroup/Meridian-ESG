/**
 * Funding Stats Critical Tests
 *
 * Tests the business logic for funding statistics routes:
 * - Coverage counts aggregation (coverage-counts route)
 * - Project type summary transformation (project-type-summary route)
 * - Total available funding calculation with per-applicant cap (total-available route)
 */

import { describe, test, expect } from 'vitest';
import { opportunities } from '../../fixtures/opportunities.js';

// --- Inline functions mirroring production logic ---

/**
 * Convert coverage count rows (from RPC) to object keyed by coverage_type.
 * Mirrors: app/api/funding/coverage-counts/route.js lines 23-26
 */
function buildCoverageCountsMap(rows) {
  const counts = {};
  rows.forEach(row => {
    counts[row.coverage_type] = parseInt(row.opportunity_count);
  });
  return counts;
}

/**
 * Transform RPC results into top-10 chart-ready format.
 * Mirrors: app/api/funding/project-type-summary/route.js lines 40-44
 */
function transformProjectTypeSummary(rawResults) {
  if (!Array.isArray(rawResults)) return [];

  return rawResults.slice(0, 10).map(item => ({
    category: item.project_type,
    total_funding: Number(item.total_funding || 0),
    opportunity_count: Number(item.opportunity_count || 0),
  }));
}

/**
 * Calculate total available funding with per-applicant cap.
 * Mirrors: app/api/funding/total-available/route.js lines 59-64
 */
const PER_APPLICANT_CAP = 30000000;

function calculateTotalAvailableFunding(opps) {
  return opps.reduce((sum, opp) => {
    const awardAmount = opp.maximum_award ?? opp.minimum_award ?? 0;
    if (awardAmount === 0) return sum;
    const cappedAmount = Math.min(awardAmount, PER_APPLICANT_CAP);
    return sum + cappedAmount;
  }, 0);
}

/**
 * Filter visible opportunities for total-available route.
 * Mirrors: app/api/funding/total-available/route.js lines 46-47
 */
function filterVisibleOpenOrUpcoming(opps) {
  return opps.filter(
    o =>
      ['Open', 'Upcoming'].includes(o.status) &&
      (o.promotion_status === null ||
        o.promotion_status === undefined ||
        o.promotion_status === 'promoted')
  );
}

// --- Tests ---

describe('Funding Stats', () => {

  describe('Coverage Counts Aggregation', () => {
    test('converts RPC rows to keyed object', () => {
      const rows = [
        { coverage_type: 'national', opportunity_count: '15' },
        { coverage_type: 'statewide', opportunity_count: '23' },
        { coverage_type: 'county', opportunity_count: '8' },
        { coverage_type: 'utility', opportunity_count: '12' },
      ];

      const result = buildCoverageCountsMap(rows);

      expect(result).toEqual({
        national: 15,
        statewide: 23,
        county: 8,
        utility: 12,
      });
    });

    test('parses string counts to integers', () => {
      const rows = [
        { coverage_type: 'national', opportunity_count: '100' },
      ];

      const result = buildCoverageCountsMap(rows);

      expect(result.national).toBe(100);
      expect(typeof result.national).toBe('number');
    });

    test('handles zero counts', () => {
      const rows = [
        { coverage_type: 'utility', opportunity_count: '0' },
      ];

      const result = buildCoverageCountsMap(rows);

      expect(result.utility).toBe(0);
    });

    test('handles empty array', () => {
      const result = buildCoverageCountsMap([]);
      expect(result).toEqual({});
    });

    test('handles single coverage type', () => {
      const rows = [
        { coverage_type: 'national', opportunity_count: '5' },
      ];

      const result = buildCoverageCountsMap(rows);

      expect(Object.keys(result)).toHaveLength(1);
      expect(result.national).toBe(5);
    });

    test('overwrites duplicate coverage types (last wins)', () => {
      const rows = [
        { coverage_type: 'national', opportunity_count: '5' },
        { coverage_type: 'national', opportunity_count: '10' },
      ];

      const result = buildCoverageCountsMap(rows);

      expect(result.national).toBe(10);
    });
  });

  describe('Project Type Summary Transformation', () => {
    test('transforms RPC results to chart format', () => {
      const rawResults = [
        { project_type: 'Solar Panels', total_funding: 50000000, opportunity_count: 12 },
        { project_type: 'HVAC Systems', total_funding: 30000000, opportunity_count: 8 },
      ];

      const result = transformProjectTypeSummary(rawResults);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        category: 'Solar Panels',
        total_funding: 50000000,
        opportunity_count: 12,
      });
    });

    test('limits to top 10 results', () => {
      const rawResults = Array.from({ length: 15 }, (_, i) => ({
        project_type: `Type ${i}`,
        total_funding: (15 - i) * 1000000,
        opportunity_count: 15 - i,
      }));

      const result = transformProjectTypeSummary(rawResults);

      expect(result).toHaveLength(10);
      expect(result[0].category).toBe('Type 0');
      expect(result[9].category).toBe('Type 9');
    });

    test('uses "category" key for chart compatibility', () => {
      const rawResults = [
        { project_type: 'Roofing', total_funding: 1000000, opportunity_count: 3 },
      ];

      const result = transformProjectTypeSummary(rawResults);

      expect(result[0]).toHaveProperty('category');
      expect(result[0].category).toBe('Roofing');
      expect(result[0]).not.toHaveProperty('project_type');
    });

    test('coerces null/undefined funding to 0', () => {
      const rawResults = [
        { project_type: 'Solar', total_funding: null, opportunity_count: 2 },
        { project_type: 'Wind', total_funding: undefined, opportunity_count: 1 },
      ];

      const result = transformProjectTypeSummary(rawResults);

      expect(result[0].total_funding).toBe(0);
      expect(result[1].total_funding).toBe(0);
    });

    test('coerces string numbers to actual numbers', () => {
      const rawResults = [
        { project_type: 'Solar', total_funding: '5000000', opportunity_count: '3' },
      ];

      const result = transformProjectTypeSummary(rawResults);

      expect(result[0].total_funding).toBe(5000000);
      expect(result[0].opportunity_count).toBe(3);
    });

    test('returns empty array for non-array input', () => {
      expect(transformProjectTypeSummary(null)).toEqual([]);
      expect(transformProjectTypeSummary(undefined)).toEqual([]);
      expect(transformProjectTypeSummary('not an array')).toEqual([]);
      expect(transformProjectTypeSummary(42)).toEqual([]);
    });

    test('returns empty array for empty input', () => {
      expect(transformProjectTypeSummary([])).toEqual([]);
    });

    test('fewer than 10 results returns all', () => {
      const rawResults = [
        { project_type: 'Solar', total_funding: 5000000, opportunity_count: 3 },
      ];

      const result = transformProjectTypeSummary(rawResults);

      expect(result).toHaveLength(1);
    });
  });

  describe('Total Available Funding Calculation', () => {
    test('sums capped award amounts', () => {
      const opps = [
        { maximum_award: 5000000, minimum_award: 100000 },
        { maximum_award: 10000000, minimum_award: 500000 },
      ];

      const total = calculateTotalAvailableFunding(opps);

      expect(total).toBe(15000000);
    });

    test('caps individual awards at $30M', () => {
      const opps = [
        { maximum_award: 50000000, minimum_award: 100000 },
        { maximum_award: 100000000, minimum_award: 1000000 },
      ];

      const total = calculateTotalAvailableFunding(opps);

      // Both capped at 30M
      expect(total).toBe(60000000);
    });

    test('falls back to minimum_award when maximum_award is null', () => {
      const opps = [
        { maximum_award: null, minimum_award: 500000 },
      ];

      const total = calculateTotalAvailableFunding(opps);

      expect(total).toBe(500000);
    });

    test('treats both null awards as 0 (skipped)', () => {
      const opps = [
        { maximum_award: null, minimum_award: null },
      ];

      const total = calculateTotalAvailableFunding(opps);

      expect(total).toBe(0);
    });

    test('skips zero-value awards', () => {
      const opps = [
        { maximum_award: 0, minimum_award: 0 },
        { maximum_award: 1000000, minimum_award: 50000 },
      ];

      const total = calculateTotalAvailableFunding(opps);

      expect(total).toBe(1000000);
    });

    test('handles empty array', () => {
      expect(calculateTotalAvailableFunding([])).toBe(0);
    });

    test('uses maximum_award over minimum_award when both present', () => {
      const opps = [
        { maximum_award: 5000000, minimum_award: 100000 },
      ];

      const total = calculateTotalAvailableFunding(opps);

      // Should use maximum_award (5M), not minimum_award (100K)
      expect(total).toBe(5000000);
    });

    test('handles mixed null and present awards', () => {
      const opps = [
        { maximum_award: 5000000, minimum_award: 100000 },
        { maximum_award: null, minimum_award: 200000 },
        { maximum_award: null, minimum_award: null },
        { maximum_award: 10000000, minimum_award: null },
      ];

      const total = calculateTotalAvailableFunding(opps);

      // 5M + 200K + 0 + 10M = 15,200,000
      expect(total).toBe(15200000);
    });

    test('boundary: award exactly at cap ($30M)', () => {
      const opps = [
        { maximum_award: 30000000, minimum_award: 0 },
      ];

      const total = calculateTotalAvailableFunding(opps);

      expect(total).toBe(30000000);
    });

    test('boundary: award just over cap ($30M + 1)', () => {
      const opps = [
        { maximum_award: 30000001, minimum_award: 0 },
      ];

      const total = calculateTotalAvailableFunding(opps);

      expect(total).toBe(30000000);
    });

    test('calculates with fixture data', () => {
      const testOpps = [
        opportunities.nationalGrant,
        opportunities.californiaStateGrant,
        opportunities.pgeUtilityGrant,
      ];

      const total = calculateTotalAvailableFunding(testOpps);

      // 5M + 2M + 500K = 7,500,000
      expect(total).toBe(7500000);
    });
  });

  describe('Visible Opportunity Filtering (total-available)', () => {
    test('includes Open with null promotion_status', () => {
      const opps = [{ status: 'Open', promotion_status: null }];
      expect(filterVisibleOpenOrUpcoming(opps)).toHaveLength(1);
    });

    test('includes Open with promoted status', () => {
      const opps = [{ status: 'Open', promotion_status: 'promoted' }];
      expect(filterVisibleOpenOrUpcoming(opps)).toHaveLength(1);
    });

    test('includes Upcoming opportunities', () => {
      const opps = [{ status: 'Upcoming', promotion_status: null }];
      expect(filterVisibleOpenOrUpcoming(opps)).toHaveLength(1);
    });

    test('excludes pending_review', () => {
      const opps = [{ status: 'Open', promotion_status: 'pending_review' }];
      expect(filterVisibleOpenOrUpcoming(opps)).toHaveLength(0);
    });

    test('excludes rejected', () => {
      const opps = [{ status: 'Open', promotion_status: 'rejected' }];
      expect(filterVisibleOpenOrUpcoming(opps)).toHaveLength(0);
    });

    test('excludes closed status', () => {
      const opps = [{ status: 'closed', promotion_status: null }];
      expect(filterVisibleOpenOrUpcoming(opps)).toHaveLength(0);
    });

    test('filters mixed set correctly', () => {
      const opps = [
        { status: 'Open', promotion_status: null },
        { status: 'Open', promotion_status: 'promoted' },
        { status: 'Open', promotion_status: 'pending_review' },
        { status: 'Upcoming', promotion_status: null },
        { status: 'closed', promotion_status: null },
      ];

      const visible = filterVisibleOpenOrUpcoming(opps);

      expect(visible).toHaveLength(3);
    });
  });
});
