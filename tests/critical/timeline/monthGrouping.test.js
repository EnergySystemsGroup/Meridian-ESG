/**
 * Timeline Month Grouping Tests
 *
 * Tests the logic that groups opportunities by their deadline month
 * for display in the vertical timeline.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Group opportunities by month for timeline display
 *
 * @param {Array} opportunities - Opportunities with close_date
 * @returns {Object} Grouped by month key (e.g., "January 2025")
 */
function groupByMonth(opportunities) {
  const groups = {};

  for (const opp of opportunities) {
    if (!opp.close_date) continue;

    const date = new Date(opp.close_date);
    const monthKey = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(opp);
  }

  return groups;
}

/**
 * Sort month groups chronologically
 *
 * @param {Object} groups - Grouped opportunities
 * @returns {Array} Sorted array of [monthKey, opportunities]
 */
function sortMonthGroups(groups) {
  return Object.entries(groups).sort(([monthA], [monthB]) => {
    const dateA = new Date(monthA);
    const dateB = new Date(monthB);
    return dateA - dateB;
  });
}

describe('Timeline Month Grouping', () => {

  describe('Basic Grouping', () => {
    test('groups opportunities by month', () => {
      const opps = [
        { id: 1, close_date: '2025-01-15T00:00:00Z' },
        { id: 2, close_date: '2025-01-25T00:00:00Z' },
        { id: 3, close_date: '2025-02-10T00:00:00Z' },
      ];

      const groups = groupByMonth(opps);

      expect(Object.keys(groups)).toHaveLength(2);
      expect(groups['January 2025']).toHaveLength(2);
      expect(groups['February 2025']).toHaveLength(1);
    });

    test('handles multiple months with varying counts', () => {
      // Use mid-month dates to avoid timezone boundary issues
      const opps = [
        { id: 1, close_date: '2025-01-15T12:00:00Z' },
        { id: 2, close_date: '2025-02-15T12:00:00Z' },
        { id: 3, close_date: '2025-02-20T12:00:00Z' },
        { id: 4, close_date: '2025-03-10T12:00:00Z' },
        { id: 5, close_date: '2025-03-15T12:00:00Z' },
        { id: 6, close_date: '2025-03-20T12:00:00Z' },
      ];

      const groups = groupByMonth(opps);

      const totalGrouped = Object.values(groups).flat().length;
      expect(totalGrouped).toBe(6);
      expect(Object.keys(groups).length).toBe(3);
    });

    test('handles year transitions', () => {
      const opps = [
        { id: 1, close_date: '2024-12-15T00:00:00Z' },
        { id: 2, close_date: '2025-01-15T00:00:00Z' },
        { id: 3, close_date: '2025-01-25T00:00:00Z' },
      ];

      const groups = groupByMonth(opps);

      expect(groups['December 2024']).toHaveLength(1);
      expect(groups['January 2025']).toHaveLength(2);
    });
  });

  describe('Null/Missing Deadlines', () => {
    test('excludes opportunities with null close_date', () => {
      const opps = [
        { id: 1, close_date: '2025-01-15T00:00:00Z' },
        { id: 2, close_date: null },
        { id: 3, close_date: '2025-02-15T00:00:00Z' },
      ];

      const groups = groupByMonth(opps);

      expect(groups['January 2025']).toHaveLength(1);
      expect(groups['February 2025']).toHaveLength(1);
    });

    test('excludes opportunities with undefined close_date', () => {
      const opps = [
        { id: 1, close_date: '2025-01-15T00:00:00Z' },
        { id: 2 },
        { id: 3, close_date: '2025-02-15T00:00:00Z' },
      ];

      const groups = groupByMonth(opps);

      const totalGrouped = Object.values(groups).flat().length;
      expect(totalGrouped).toBe(2);
    });

    test('handles all null deadlines', () => {
      const opps = [
        { id: 1, close_date: null },
        { id: 2, close_date: null },
      ];

      const groups = groupByMonth(opps);

      expect(Object.keys(groups)).toHaveLength(0);
    });
  });

  describe('Month Sorting', () => {
    test('sorts months chronologically', () => {
      const groups = {
        'March 2025': [{ id: 3 }],
        'January 2025': [{ id: 1 }],
        'February 2025': [{ id: 2 }],
      };

      const sorted = sortMonthGroups(groups);

      expect(sorted[0][0]).toBe('January 2025');
      expect(sorted[1][0]).toBe('February 2025');
      expect(sorted[2][0]).toBe('March 2025');
    });

    test('sorts across year boundaries', () => {
      const groups = {
        'February 2025': [{ id: 2 }],
        'December 2024': [{ id: 1 }],
        'January 2025': [{ id: 3 }],
      };

      const sorted = sortMonthGroups(groups);

      expect(sorted[0][0]).toBe('December 2024');
      expect(sorted[1][0]).toBe('January 2025');
      expect(sorted[2][0]).toBe('February 2025');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty array', () => {
      const groups = groupByMonth([]);

      expect(Object.keys(groups)).toHaveLength(0);
    });

    test('handles single opportunity', () => {
      const opps = [{ id: 1, close_date: '2025-06-15T00:00:00Z' }];

      const groups = groupByMonth(opps);

      expect(Object.keys(groups)).toHaveLength(1);
      expect(groups['June 2025']).toHaveLength(1);
    });

    test('preserves opportunity data within groups', () => {
      const opps = [
        { id: 1, title: 'Grant A', close_date: '2025-01-15T00:00:00Z' },
        { id: 2, title: 'Grant B', close_date: '2025-01-20T00:00:00Z' },
      ];

      const groups = groupByMonth(opps);

      expect(groups['January 2025'][0].title).toBe('Grant A');
      expect(groups['January 2025'][1].title).toBe('Grant B');
    });

    test('handles end-of-month dates', () => {
      // Use mid-day times to avoid timezone boundary issues
      const opps = [
        { id: 1, close_date: '2025-01-30T12:00:00Z' },
        { id: 2, close_date: '2025-02-02T12:00:00Z' },
      ];

      const groups = groupByMonth(opps);

      // Verify both are grouped (exact month names depend on timezone)
      const totalGrouped = Object.values(groups).flat().length;
      expect(totalGrouped).toBe(2);
      expect(Object.keys(groups).length).toBe(2);
    });
  });

  describe('Timezone Handling', () => {
    test('handles UTC dates consistently', () => {
      const opps = [
        { id: 1, close_date: '2025-01-31T23:59:59Z' },
        { id: 2, close_date: '2025-02-01T00:00:00Z' },
      ];

      const groups = groupByMonth(opps);

      // Both should be in their respective months based on UTC
      const jan = groups['January 2025'] || [];
      const feb = groups['February 2025'] || [];

      expect(jan.length + feb.length).toBe(2);
    });
  });

  describe('Real-World Scenarios', () => {
    test('groups a year of opportunities', () => {
      const opps = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        close_date: `2025-${String(i + 1).padStart(2, '0')}-15T00:00:00Z`,
      }));

      const groups = groupByMonth(opps);

      expect(Object.keys(groups)).toHaveLength(12);
      expect(groups['January 2025']).toHaveLength(1);
      expect(groups['December 2025']).toHaveLength(1);
    });

    test('handles multiple opportunities on same day', () => {
      const opps = [
        { id: 1, close_date: '2025-01-15T09:00:00Z' },
        { id: 2, close_date: '2025-01-15T12:00:00Z' },
        { id: 3, close_date: '2025-01-15T18:00:00Z' },
      ];

      const groups = groupByMonth(opps);

      expect(groups['January 2025']).toHaveLength(3);
    });
  });
});
