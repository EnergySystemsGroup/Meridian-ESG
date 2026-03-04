/**
 * Counts API Contract Tests
 *
 * Validates the response structure for count/aggregation endpoints:
 * - Dashboard summary counts
 * - Filter result counts
 * - Client match counts
 */

import { describe, test, expect } from 'vitest';
import { opportunities } from '../fixtures/opportunities.js';

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
    test('validates complete counts', () => {
      const validCounts = {
        openOpportunities: 45,
        upcomingDeadlines: 12,
        totalClients: 20,
        clientsWithMatches: 15,
      };

      const errors = validateSchema(validCounts, dashboardCountsSchema);
      expect(errors).toHaveLength(0);
    });

    test('rejects missing openOpportunities', () => {
      const incomplete = {
        upcomingDeadlines: 12,
        totalClients: 20,
        clientsWithMatches: 15,
      };
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
    test('validates filter counts', () => {
      const validFilterCounts = {
        total: 100,
        filtered: 25,
        byStatus: { open: 20, upcoming: 3, closed: 2 },
      };

      const errors = validateSchema(validFilterCounts, filterCountsSchema);
      expect(errors).toHaveLength(0);
    });

  });

  describe('Promotion Status Filter (open_opportunities count)', () => {
    // Inline filter replicating: .ilike('status', 'open').or('promotion_status.is.null,promotion_status.eq.promoted')
    function countOpenVisible(opps) {
      return opps.filter(
        (o) =>
          o.status?.toLowerCase() === 'open' &&
          (o.promotion_status === null || o.promotion_status === 'promoted')
      ).length;
    }

    const fixtures = [
      { ...opportunities.nationalGrant, status: 'open', promotion_status: null },
      { ...opportunities.nationalGrant, status: 'open', promotion_status: 'promoted' },
      { ...opportunities.nationalGrant, status: 'open', promotion_status: 'pending_review' },
      { ...opportunities.nationalGrant, status: 'open', promotion_status: 'rejected' },
      { ...opportunities.nationalGrant, status: 'closed', promotion_status: null },
      { ...opportunities.nationalGrant, status: 'closed', promotion_status: 'promoted' },
    ];

    test('includes open records with null promotion_status', () => {
      const count = countOpenVisible([{ ...opportunities.nationalGrant, status: 'open', promotion_status: null }]);
      expect(count).toBe(1);
    });

    test('includes open records with promoted status', () => {
      const count = countOpenVisible([{ ...opportunities.nationalGrant, status: 'open', promotion_status: 'promoted' }]);
      expect(count).toBe(1);
    });

    test('excludes open records with pending_review status', () => {
      const count = countOpenVisible([{ ...opportunities.nationalGrant, status: 'open', promotion_status: 'pending_review' }]);
      expect(count).toBe(0);
    });

    test('excludes closed records even if promoted', () => {
      const count = countOpenVisible([{ ...opportunities.nationalGrant, status: 'closed', promotion_status: 'promoted' }]);
      expect(count).toBe(0);
    });

    test('counts correctly across mixed fixture set (2 of 6 visible)', () => {
      expect(countOpenVisible(fixtures)).toBe(2);
    });
  });
});
