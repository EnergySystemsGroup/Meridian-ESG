/**
 * Map API Contract Tests
 *
 * Validates the response structure for map-related endpoints:
 * - State data response shape
 * - Scope breakdown response shape
 * - Opportunity list response shape for state drill-down
 */

import { describe, test, expect } from 'vitest';

const mapStateSchema = {
  stateCode: 'string',
  stateName: 'string',
  opportunityCount: 'number',
  totalFunding: 'number',
};

const scopeBreakdownSchema = {
  national: 'number',
  statewide: 'number',
  county: 'number',
  utility: 'number',
};

const mapOpportunitySchema = {
  id: 'string',
  title: 'string',
  is_national: 'boolean',
  status: 'string',
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

describe('Map API Contracts', () => {

  describe('State Data Response', () => {
    const validStateData = {
      stateCode: 'CA',
      stateName: 'California',
      opportunityCount: 15,
      totalFunding: 50000000,
    };

    test('validates complete state data', () => {
      const errors = validateSchema(validStateData, mapStateSchema);
      expect(errors).toHaveLength(0);
    });

    test('rejects missing stateCode', () => {
      const { stateCode, ...incomplete } = validStateData;
      const errors = validateSchema(incomplete, mapStateSchema);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('stateCode');
    });

    test('rejects string opportunityCount', () => {
      const invalid = { ...validStateData, opportunityCount: '15' };
      const errors = validateSchema(invalid, mapStateSchema);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('validates zero values', () => {
      const zeroData = { ...validStateData, opportunityCount: 0, totalFunding: 0 };
      const errors = validateSchema(zeroData, mapStateSchema);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Scope Breakdown Response', () => {
    const validBreakdown = {
      national: 5,
      statewide: 10,
      county: 8,
      utility: 12,
    };

    test('validates complete breakdown', () => {
      const errors = validateSchema(validBreakdown, scopeBreakdownSchema);
      expect(errors).toHaveLength(0);
    });

    test('all fields are numbers', () => {
      for (const field of Object.keys(scopeBreakdownSchema)) {
        expect(typeof validBreakdown[field]).toBe('number');
      }
    });

    test('rejects missing utility field', () => {
      const { utility, ...incomplete } = validBreakdown;
      const errors = validateSchema(incomplete, scopeBreakdownSchema);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('validates all-zero breakdown', () => {
      const zeros = { national: 0, statewide: 0, county: 0, utility: 0 };
      const errors = validateSchema(zeros, scopeBreakdownSchema);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Map Opportunity List Response', () => {
    const validMapOpp = {
      id: 'opp-001',
      title: 'Federal Clean Energy Grant',
      is_national: true,
      status: 'open',
    };

    test('validates map opportunity item', () => {
      const errors = validateSchema(validMapOpp, mapOpportunitySchema);
      expect(errors).toHaveLength(0);
    });

    test('rejects missing title', () => {
      const { title, ...incomplete } = validMapOpp;
      const errors = validateSchema(incomplete, mapOpportunitySchema);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('is_national must be boolean', () => {
      const invalid = { ...validMapOpp, is_national: 'true' };
      const errors = validateSchema(invalid, mapOpportunitySchema);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('validates array of opportunities', () => {
      const oppList = [
        { id: '1', title: 'Grant A', is_national: true, status: 'open' },
        { id: '2', title: 'Grant B', is_national: false, status: 'open' },
      ];

      oppList.forEach(opp => {
        const errors = validateSchema(opp, mapOpportunitySchema);
        expect(errors).toHaveLength(0);
      });
    });
  });

  describe('Response Metadata', () => {
    test('pagination metadata shape', () => {
      const metadata = {
        total: 25,
        page: 1,
        pageSize: 10,
        totalPages: 3,
      };

      expect(typeof metadata.total).toBe('number');
      expect(typeof metadata.page).toBe('number');
      expect(typeof metadata.pageSize).toBe('number');
      expect(typeof metadata.totalPages).toBe('number');
      expect(metadata.totalPages).toBe(Math.ceil(metadata.total / metadata.pageSize));
    });
  });
});
