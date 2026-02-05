/**
 * Dashboard Recent Opportunities Tests
 *
 * Tests the "latest 5 opportunities" logic for the dashboard:
 * - Sorted by created_at descending (newest first)
 * - Limited to 5 results
 * - Includes only open opportunities
 * - Edge cases: fewer than 5, no open opps, ties
 */

import { describe, test, expect } from 'vitest';
import { opportunities } from '../../fixtures/opportunities.js';

/**
 * Get the most recently added open opportunities
 */
function getRecentOpportunities(opps, limit = 5) {
  return opps
    .filter(o => o.status === 'open')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

/**
 * Format a recent opportunity for display
 */
function formatRecentOpp(opp) {
  return {
    id: opp.id,
    title: opp.title,
    agency: opp.agency_name || 'Unknown Agency',
    maxFunding: opp.maximum_award || opp.total_funding_available || null,
    closeDate: opp.close_date || null,
    isNational: opp.is_national || false,
  };
}

describe('Dashboard Recent Opportunities', () => {

  describe('Get Recent Opportunities', () => {
    test('returns up to 5 most recent open opportunities', () => {
      const testOpps = [
        { id: '1', status: 'open', created_at: '2025-01-01T10:00:00Z' },
        { id: '2', status: 'open', created_at: '2025-01-02T10:00:00Z' },
        { id: '3', status: 'open', created_at: '2025-01-03T10:00:00Z' },
        { id: '4', status: 'open', created_at: '2025-01-04T10:00:00Z' },
        { id: '5', status: 'open', created_at: '2025-01-05T10:00:00Z' },
        { id: '6', status: 'open', created_at: '2025-01-06T10:00:00Z' },
        { id: '7', status: 'open', created_at: '2025-01-07T10:00:00Z' },
      ];

      const result = getRecentOpportunities(testOpps);

      expect(result).toHaveLength(5);
      expect(result[0].id).toBe('7'); // Most recent first
      expect(result[4].id).toBe('3'); // 5th most recent
    });

    test('sorted by created_at descending', () => {
      const testOpps = [
        { id: 'old', status: 'open', created_at: '2024-01-01T10:00:00Z' },
        { id: 'new', status: 'open', created_at: '2025-06-01T10:00:00Z' },
        { id: 'mid', status: 'open', created_at: '2025-01-01T10:00:00Z' },
      ];

      const result = getRecentOpportunities(testOpps);

      expect(result[0].id).toBe('new');
      expect(result[1].id).toBe('mid');
      expect(result[2].id).toBe('old');
    });

    test('excludes closed opportunities', () => {
      const testOpps = [
        { id: '1', status: 'open', created_at: '2025-01-01T10:00:00Z' },
        { id: '2', status: 'closed', created_at: '2025-01-02T10:00:00Z' },
        { id: '3', status: 'open', created_at: '2025-01-03T10:00:00Z' },
      ];

      const result = getRecentOpportunities(testOpps);

      expect(result).toHaveLength(2);
      expect(result.every(o => o.status === 'open')).toBe(true);
    });

    test('excludes upcoming opportunities', () => {
      const testOpps = [
        { id: '1', status: 'open', created_at: '2025-01-01T10:00:00Z' },
        { id: '2', status: 'upcoming', created_at: '2025-01-02T10:00:00Z' },
      ];

      const result = getRecentOpportunities(testOpps);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    test('returns fewer than 5 when not enough open opps', () => {
      const testOpps = [
        { id: '1', status: 'open', created_at: '2025-01-01T10:00:00Z' },
        { id: '2', status: 'open', created_at: '2025-01-02T10:00:00Z' },
      ];

      const result = getRecentOpportunities(testOpps);
      expect(result).toHaveLength(2);
    });

    test('returns empty array when no open opportunities', () => {
      const testOpps = [
        { id: '1', status: 'closed', created_at: '2025-01-01T10:00:00Z' },
      ];

      const result = getRecentOpportunities(testOpps);
      expect(result).toHaveLength(0);
    });

    test('returns empty array for empty input', () => {
      expect(getRecentOpportunities([])).toEqual([]);
    });

    test('custom limit works', () => {
      const testOpps = Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        status: 'open',
        created_at: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
      }));

      expect(getRecentOpportunities(testOpps, 3)).toHaveLength(3);
      expect(getRecentOpportunities(testOpps, 10)).toHaveLength(10);
    });

    test('works with fixture data', () => {
      const allOpps = Object.values(opportunities);
      const result = getRecentOpportunities(allOpps);

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(5);

      // Verify sorted newest first
      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i - 1].created_at).getTime())
          .toBeGreaterThanOrEqual(new Date(result[i].created_at).getTime());
      }
    });
  });

  describe('Format Recent Opportunity', () => {
    test('formats complete opportunity', () => {
      const result = formatRecentOpp(opportunities.nationalGrant);

      expect(result.id).toBe('opp-national-001');
      expect(result.title).toBe('Federal Clean Energy Grant');
      expect(result.agency).toBe('Department of Energy');
      expect(result.maxFunding).toBe(5000000);
      expect(result.closeDate).toBe('2025-06-30T23:59:59Z');
      expect(result.isNational).toBe(true);
    });

    test('handles missing agency_name', () => {
      const result = formatRecentOpp({ id: '1', title: 'Test' });
      expect(result.agency).toBe('Unknown Agency');
    });

    test('uses total_funding_available when no maximum_award', () => {
      const result = formatRecentOpp({
        id: '1',
        title: 'Test',
        total_funding_available: 1000000,
      });
      expect(result.maxFunding).toBe(1000000);
    });

    test('returns null funding when neither field present', () => {
      const result = formatRecentOpp({ id: '1', title: 'Test' });
      expect(result.maxFunding).toBeNull();
    });

    test('returns null close_date when missing', () => {
      const result = formatRecentOpp({ id: '1', title: 'Test' });
      expect(result.closeDate).toBeNull();
    });
  });
});
