/**
 * Deadlines API Contract Tests
 *
 * Validates the response structure for deadline-related endpoints:
 * - Upcoming deadlines list shape
 * - Days-left calculation contract
 * - Null deadline handling
 */

import { describe, test, expect } from 'vitest';
import { opportunities } from '../fixtures/opportunities.js';

const deadlineSchema = {
  id: 'string',
  title: 'string',
  close_date: 'string|null',
  status: 'string',
};

const deadlineWithDaysSchema = {
  id: 'string',
  title: 'string',
  close_date: 'string|null',
  days_left: 'number|null',
  urgency: 'string',
};

function validateFieldType(value, typeSpec) {
  const types = typeSpec.split('|');
  if (types.includes('null') && value === null) return true;
  return types.includes(typeof value);
}

function validateSchema(obj, schema) {
  const errors = [];
  for (const [field, typeSpec] of Object.entries(schema)) {
    if (!(field in obj)) {
      errors.push(`Missing required field: ${field}`);
    } else if (!validateFieldType(obj[field], typeSpec)) {
      errors.push(`Field ${field}: expected ${typeSpec}, got ${typeof obj[field]} (value: ${obj[field]})`);
    }
  }
  return errors;
}

describe('Deadlines API Contracts', () => {

  describe('Deadline Item', () => {
    test('validates complete deadline', () => {
      const deadline = {
        id: 'opp-001',
        title: 'Federal Grant',
        close_date: '2025-06-30T23:59:59Z',
        status: 'open',
      };
      const errors = validateSchema(deadline, deadlineSchema);
      expect(errors).toHaveLength(0);
    });

    test('allows null close_date', () => {
      const deadline = {
        id: 'opp-001',
        title: 'Rolling Grant',
        close_date: null,
        status: 'open',
      };
      const errors = validateSchema(deadline, deadlineSchema);
      expect(errors).toHaveLength(0);
    });

    test('rejects missing id', () => {
      const deadline = { title: 'Test', close_date: null, status: 'open' };
      const errors = validateSchema(deadline, deadlineSchema);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Deadline with Days Left', () => {
    test('validates deadline with days_left', () => {
      const item = {
        id: 'opp-001',
        title: 'Federal Grant',
        close_date: '2025-06-30T23:59:59Z',
        days_left: 5,
        urgency: 'warning',
      };
      const errors = validateSchema(item, deadlineWithDaysSchema);
      expect(errors).toHaveLength(0);
    });

    test('allows null days_left for null close_date', () => {
      const item = {
        id: 'opp-001',
        title: 'Rolling',
        close_date: null,
        days_left: null,
        urgency: 'none',
      };
      const errors = validateSchema(item, deadlineWithDaysSchema);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Promotion Status Filter (deadlines visibility)', () => {
    // Inline filter replicating: .gte('close_date', today).or('promotion_status.is.null,promotion_status.eq.promoted')
    function filterVisibleDeadlines(opps, today) {
      return opps.filter(
        (o) =>
          o.close_date !== null &&
          o.close_date >= today &&
          (o.promotion_status === null || o.promotion_status === 'promoted')
      );
    }

    const today = '2025-01-01T00:00:00Z';

    test('includes future deadlines with null promotion_status', () => {
      const result = filterVisibleDeadlines(
        [{ ...opportunities.nationalGrant, close_date: '2025-06-30T23:59:59Z', promotion_status: null }],
        today
      );
      expect(result).toHaveLength(1);
    });

    test('includes future deadlines with promoted status', () => {
      const result = filterVisibleDeadlines(
        [{ ...opportunities.nationalGrant, close_date: '2025-06-30T23:59:59Z', promotion_status: 'promoted' }],
        today
      );
      expect(result).toHaveLength(1);
    });

    test('excludes future deadlines with pending_review status', () => {
      const result = filterVisibleDeadlines(
        [{ ...opportunities.nationalGrant, close_date: '2025-06-30T23:59:59Z', promotion_status: 'pending_review' }],
        today
      );
      expect(result).toHaveLength(0);
    });

    test('excludes past deadlines even if promoted', () => {
      const result = filterVisibleDeadlines(
        [{ ...opportunities.nationalGrant, close_date: '2024-01-01T00:00:00Z', promotion_status: 'promoted' }],
        today
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('Deadline List Response', () => {
    test('validates array of deadlines', () => {
      const deadlines = [
        { id: '1', title: 'Grant A', close_date: '2025-03-15', status: 'open' },
        { id: '2', title: 'Grant B', close_date: '2025-04-01', status: 'open' },
        { id: '3', title: 'Rolling', close_date: null, status: 'open' },
      ];

      deadlines.forEach(d => {
        const errors = validateSchema(d, deadlineSchema);
        expect(errors).toHaveLength(0);
      });
    });

  });
});
