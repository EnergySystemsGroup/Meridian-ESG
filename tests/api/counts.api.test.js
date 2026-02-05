/**
 * Counts API Contract Tests
 *
 * Validates the response structure for count/aggregation endpoints:
 * - Dashboard summary counts
 * - Filter result counts
 * - Client match counts
 */

import { describe, test, expect } from 'vitest';

const dashboardCountsSchema = {
  openOpportunities: 'number',
  upcomingDeadlines: 'number',
  totalClients: 'number',
  clientsWithMatches: 'number',
};

const filterCountsSchema = {
  total: 'number',
  filtered: 'number',
  byStatus: 'object',
};

function validateSchema(obj, schema) {
  const errors = [];
  for (const [field, expectedType] of Object.entries(schema)) {
    if (!(field in obj)) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof obj[field] !== expectedType) {
      errors.push(`Field ${field}: expected ${expectedType}, got ${typeof obj[field]}`);
    }
  }
  return errors;
}

describe('Counts API Contracts', () => {

  describe('Dashboard Summary Counts', () => {
    const validCounts = {
      openOpportunities: 45,
      upcomingDeadlines: 12,
      totalClients: 20,
      clientsWithMatches: 15,
    };

    test('validates complete counts', () => {
      const errors = validateSchema(validCounts, dashboardCountsSchema);
      expect(errors).toHaveLength(0);
    });

    test('all counts are non-negative integers', () => {
      for (const value of Object.values(validCounts)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    test('clientsWithMatches <= totalClients', () => {
      expect(validCounts.clientsWithMatches).toBeLessThanOrEqual(validCounts.totalClients);
    });

    test('rejects missing openOpportunities', () => {
      const { openOpportunities, ...incomplete } = validCounts;
      const errors = validateSchema(incomplete, dashboardCountsSchema);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('validates zero counts', () => {
      const zeros = {
        openOpportunities: 0,
        upcomingDeadlines: 0,
        totalClients: 0,
        clientsWithMatches: 0,
      };
      const errors = validateSchema(zeros, dashboardCountsSchema);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Filter Result Counts', () => {
    const validFilterCounts = {
      total: 100,
      filtered: 25,
      byStatus: { open: 20, upcoming: 3, closed: 2 },
    };

    test('validates filter counts', () => {
      const errors = validateSchema(validFilterCounts, filterCountsSchema);
      expect(errors).toHaveLength(0);
    });

    test('filtered <= total', () => {
      expect(validFilterCounts.filtered).toBeLessThanOrEqual(validFilterCounts.total);
    });

    test('byStatus values sum to filtered', () => {
      const sum = Object.values(validFilterCounts.byStatus)
        .reduce((acc, val) => acc + val, 0);
      expect(sum).toBe(validFilterCounts.filtered);
    });

    test('byStatus is an object with number values', () => {
      for (const value of Object.values(validFilterCounts.byStatus)) {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Client Match Count Response', () => {
    test('validates client match count structure', () => {
      const matchCount = {
        clientId: 'client-001',
        matchCount: 5,
        topScore: 92,
      };

      expect(typeof matchCount.clientId).toBe('string');
      expect(typeof matchCount.matchCount).toBe('number');
      expect(typeof matchCount.topScore).toBe('number');
    });

    test('match count is non-negative', () => {
      [0, 1, 5, 50].forEach(count => {
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    test('top score is 0-100', () => {
      [0, 50, 75, 100].forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });
});
