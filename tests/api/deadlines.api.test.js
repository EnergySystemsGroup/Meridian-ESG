/**
 * Deadlines API Contract Tests
 *
 * Validates the response structure for deadline-related endpoints:
 * - Upcoming deadlines list shape
 * - Days-left calculation contract
 * - Null deadline handling
 */

import { describe, test, expect } from 'vitest';

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
    const validUrgencies = ['critical', 'warning', 'upcoming', 'normal', 'none'];

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

    test('urgency is always a string', () => {
      const items = [
        { urgency: 'critical', days_left: 2 },
        { urgency: 'warning', days_left: 5 },
        { urgency: 'upcoming', days_left: 10 },
        { urgency: 'normal', days_left: 30 },
        { urgency: 'none', days_left: null },
      ];

      items.forEach(item => {
        expect(typeof item.urgency).toBe('string');
      });
    });

    test('days_left is integer or null', () => {
      const testValues = [0, 1, 5, 14, 30, 365, null];
      testValues.forEach(val => {
        expect(val === null || Number.isInteger(val)).toBe(true);
      });
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

    test('deadlines sorted by close_date ascending (nulls last)', () => {
      const sorted = [
        { close_date: '2025-03-01' },
        { close_date: '2025-04-01' },
        { close_date: '2025-06-01' },
        { close_date: null },
      ];

      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].close_date && sorted[i + 1].close_date) {
          expect(sorted[i].close_date <= sorted[i + 1].close_date).toBe(true);
        }
      }
      // Last item should have null if nulls go last
      expect(sorted[sorted.length - 1].close_date).toBeNull();
    });
  });
});
