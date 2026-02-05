/**
 * Explorer Sorting Tests
 *
 * Tests the sorting logic for the opportunity explorer:
 * - Sort by Relevance (default)
 * - Sort by Deadline (close_date)
 * - Sort by Amount (maximum_award)
 * - Sort by Recently Added (created_at)
 * - Sort direction toggle (asc/desc)
 * - NULL handling in all sorts
 */

import { describe, test, expect } from 'vitest';

/**
 * Sort opportunities by specified field and direction
 */
function sortOpportunities(opps, sortBy = 'relevance', sortDir = 'desc') {
  const sorted = [...opps];

  const comparators = {
    relevance: (a, b) => {
      const aScore = a.relevance_score ?? -Infinity;
      const bScore = b.relevance_score ?? -Infinity;
      return sortDir === 'desc' ? bScore - aScore : aScore - bScore;
    },

    deadline: (a, b) => {
      // NULL deadlines go to end regardless of direction
      if (a.close_date === null && b.close_date === null) return 0;
      if (a.close_date === null) return 1;
      if (b.close_date === null) return -1;

      const dateA = new Date(a.close_date).getTime();
      const dateB = new Date(b.close_date).getTime();
      return sortDir === 'desc' ? dateB - dateA : dateA - dateB;
    },

    amount: (a, b) => {
      const amountA = a.maximum_award ?? 0;
      const amountB = b.maximum_award ?? 0;
      return sortDir === 'desc' ? amountB - amountA : amountA - amountB;
    },

    recent: (a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return sortDir === 'desc' ? dateB - dateA : dateA - dateB;
    },
  };

  const comparator = comparators[sortBy] || comparators.relevance;
  sorted.sort(comparator);

  return sorted;
}

describe('Explorer Sorting', () => {

  describe('Sort by Relevance', () => {
    const testOpps = [
      { id: 1, relevance_score: 7.5 },
      { id: 2, relevance_score: 9.0 },
      { id: 3, relevance_score: 5.0 },
      { id: 4, relevance_score: 8.5 },
    ];

    test('sorts by relevance descending (default)', () => {
      const result = sortOpportunities(testOpps, 'relevance', 'desc');

      expect(result[0].id).toBe(2); // 9.0
      expect(result[1].id).toBe(4); // 8.5
      expect(result[2].id).toBe(1); // 7.5
      expect(result[3].id).toBe(3); // 5.0
    });

    test('sorts by relevance ascending', () => {
      const result = sortOpportunities(testOpps, 'relevance', 'asc');

      expect(result[0].id).toBe(3); // 5.0
      expect(result[1].id).toBe(1); // 7.5
      expect(result[2].id).toBe(4); // 8.5
      expect(result[3].id).toBe(2); // 9.0
    });

    test('handles null relevance scores', () => {
      const opps = [
        { id: 1, relevance_score: 7.0 },
        { id: 2, relevance_score: null },
        { id: 3, relevance_score: 9.0 },
      ];

      const result = sortOpportunities(opps, 'relevance', 'desc');

      expect(result[0].id).toBe(3); // 9.0
      expect(result[1].id).toBe(1); // 7.0
      expect(result[2].id).toBe(2); // null (at end)
    });
  });

  describe('Sort by Deadline', () => {
    const testOpps = [
      { id: 1, close_date: '2025-03-15T23:59:59Z' },
      { id: 2, close_date: '2025-01-10T23:59:59Z' },
      { id: 3, close_date: '2025-06-30T23:59:59Z' },
      { id: 4, close_date: '2025-02-28T23:59:59Z' },
    ];

    test('sorts by deadline ascending (soonest first)', () => {
      const result = sortOpportunities(testOpps, 'deadline', 'asc');

      expect(result[0].id).toBe(2); // Jan 10
      expect(result[1].id).toBe(4); // Feb 28
      expect(result[2].id).toBe(1); // Mar 15
      expect(result[3].id).toBe(3); // Jun 30
    });

    test('sorts by deadline descending (latest first)', () => {
      const result = sortOpportunities(testOpps, 'deadline', 'desc');

      expect(result[0].id).toBe(3); // Jun 30
      expect(result[1].id).toBe(1); // Mar 15
      expect(result[2].id).toBe(4); // Feb 28
      expect(result[3].id).toBe(2); // Jan 10
    });

    test('null deadlines always at end (ascending)', () => {
      const opps = [
        { id: 1, close_date: '2025-03-15T23:59:59Z' },
        { id: 2, close_date: null },
        { id: 3, close_date: '2025-01-10T23:59:59Z' },
      ];

      const result = sortOpportunities(opps, 'deadline', 'asc');

      expect(result[0].id).toBe(3); // Jan 10 (soonest)
      expect(result[1].id).toBe(1); // Mar 15
      expect(result[2].id).toBe(2); // null (at end)
    });

    test('null deadlines always at end (descending)', () => {
      const opps = [
        { id: 1, close_date: '2025-03-15T23:59:59Z' },
        { id: 2, close_date: null },
        { id: 3, close_date: '2025-06-30T23:59:59Z' },
      ];

      const result = sortOpportunities(opps, 'deadline', 'desc');

      expect(result[0].id).toBe(3); // Jun 30 (latest)
      expect(result[1].id).toBe(1); // Mar 15
      expect(result[2].id).toBe(2); // null (at end)
    });

    test('handles multiple null deadlines', () => {
      const opps = [
        { id: 1, close_date: null },
        { id: 2, close_date: '2025-03-15T23:59:59Z' },
        { id: 3, close_date: null },
      ];

      const result = sortOpportunities(opps, 'deadline', 'asc');

      expect(result[0].id).toBe(2); // Only dated one first
      // Both nulls at end
      expect([result[1].id, result[2].id].sort()).toEqual([1, 3]);
    });
  });

  describe('Sort by Amount', () => {
    const testOpps = [
      { id: 1, maximum_award: 1000000 },
      { id: 2, maximum_award: 5000000 },
      { id: 3, maximum_award: 250000 },
      { id: 4, maximum_award: 10000000 },
    ];

    test('sorts by amount descending (highest first)', () => {
      const result = sortOpportunities(testOpps, 'amount', 'desc');

      expect(result[0].id).toBe(4); // $10M
      expect(result[1].id).toBe(2); // $5M
      expect(result[2].id).toBe(1); // $1M
      expect(result[3].id).toBe(3); // $250K
    });

    test('sorts by amount ascending (lowest first)', () => {
      const result = sortOpportunities(testOpps, 'amount', 'asc');

      expect(result[0].id).toBe(3); // $250K
      expect(result[1].id).toBe(1); // $1M
      expect(result[2].id).toBe(2); // $5M
      expect(result[3].id).toBe(4); // $10M
    });

    test('handles null/undefined amounts as 0', () => {
      const opps = [
        { id: 1, maximum_award: 1000000 },
        { id: 2, maximum_award: null },
        { id: 3, maximum_award: 500000 },
        { id: 4 }, // undefined
      ];

      const result = sortOpportunities(opps, 'amount', 'desc');

      expect(result[0].id).toBe(1); // $1M
      expect(result[1].id).toBe(3); // $500K
      // IDs 2 and 4 both have 0 effective value
      expect([result[2].id, result[3].id].sort()).toEqual([2, 4]);
    });

    test('handles zero amounts', () => {
      const opps = [
        { id: 1, maximum_award: 0 },
        { id: 2, maximum_award: 1000 },
        { id: 3, maximum_award: 0 },
      ];

      const result = sortOpportunities(opps, 'amount', 'desc');

      expect(result[0].id).toBe(2); // $1000
    });
  });

  describe('Sort by Recently Added', () => {
    const testOpps = [
      { id: 1, created_at: '2024-03-15T10:00:00Z' },
      { id: 2, created_at: '2024-01-01T10:00:00Z' },
      { id: 3, created_at: '2024-06-01T10:00:00Z' },
      { id: 4, created_at: '2024-02-14T10:00:00Z' },
    ];

    test('sorts by recent descending (newest first)', () => {
      const result = sortOpportunities(testOpps, 'recent', 'desc');

      expect(result[0].id).toBe(3); // Jun
      expect(result[1].id).toBe(1); // Mar
      expect(result[2].id).toBe(4); // Feb
      expect(result[3].id).toBe(2); // Jan
    });

    test('sorts by recent ascending (oldest first)', () => {
      const result = sortOpportunities(testOpps, 'recent', 'asc');

      expect(result[0].id).toBe(2); // Jan
      expect(result[1].id).toBe(4); // Feb
      expect(result[2].id).toBe(1); // Mar
      expect(result[3].id).toBe(3); // Jun
    });

    test('handles missing created_at', () => {
      const opps = [
        { id: 1, created_at: '2024-03-15T10:00:00Z' },
        { id: 2 }, // No created_at
        { id: 3, created_at: '2024-01-01T10:00:00Z' },
      ];

      const result = sortOpportunities(opps, 'recent', 'desc');

      expect(result[0].id).toBe(1); // Newest dated
      expect(result[1].id).toBe(3); // Older dated
      expect(result[2].id).toBe(2); // No date (treated as epoch 0)
    });
  });

  describe('Default Sort Behavior', () => {
    test('defaults to relevance desc when sort not specified', () => {
      const opps = [
        { id: 1, relevance_score: 5 },
        { id: 2, relevance_score: 8 },
      ];

      const result = sortOpportunities(opps);

      expect(result[0].id).toBe(2); // Higher score first
    });

    test('handles unknown sort field by defaulting to relevance', () => {
      const opps = [
        { id: 1, relevance_score: 5 },
        { id: 2, relevance_score: 8 },
      ];

      const result = sortOpportunities(opps, 'unknown_field', 'desc');

      expect(result[0].id).toBe(2); // Falls back to relevance
    });
  });

  describe('Edge Cases', () => {
    test('empty array returns empty array', () => {
      const result = sortOpportunities([], 'relevance', 'desc');
      expect(result).toHaveLength(0);
    });

    test('single item returns same item', () => {
      const opps = [{ id: 1, relevance_score: 5 }];
      const result = sortOpportunities(opps, 'relevance', 'desc');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('sort does not mutate original array', () => {
      const opps = [
        { id: 1, relevance_score: 5 },
        { id: 2, relevance_score: 8 },
      ];
      const original = [...opps];

      sortOpportunities(opps, 'relevance', 'desc');

      expect(opps).toEqual(original);
    });

    test('stable sort for equal values', () => {
      const opps = [
        { id: 1, relevance_score: 7 },
        { id: 2, relevance_score: 7 },
        { id: 3, relevance_score: 7 },
      ];

      const result = sortOpportunities(opps, 'relevance', 'desc');

      // All have same score, should maintain relative order
      expect(result.map(o => o.id)).toEqual([1, 2, 3]);
    });
  });

  describe('Sort Direction Toggle', () => {
    const opps = [
      { id: 1, relevance_score: 5, maximum_award: 100000 },
      { id: 2, relevance_score: 8, maximum_award: 500000 },
      { id: 3, relevance_score: 3, maximum_award: 250000 },
    ];

    test('toggles relevance direction correctly', () => {
      const desc = sortOpportunities(opps, 'relevance', 'desc');
      const asc = sortOpportunities(opps, 'relevance', 'asc');

      expect(desc[0].id).toBe(2);
      expect(asc[0].id).toBe(3);
    });

    test('toggles amount direction correctly', () => {
      const desc = sortOpportunities(opps, 'amount', 'desc');
      const asc = sortOpportunities(opps, 'amount', 'asc');

      expect(desc[0].maximum_award).toBe(500000);
      expect(asc[0].maximum_award).toBe(100000);
    });
  });
});
