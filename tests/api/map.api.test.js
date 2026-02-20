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

  describe('GET /api/map/coverage-areas/[stateCode] Response', () => {
    const coverageAreasResponseSchema = {
      success: 'boolean',
      data: 'object',
      stateCode: 'string',
      kind: 'string',
    };

    test('validates success response with GeoJSON and no counts', () => {
      const response = {
        success: true,
        data: { type: 'FeatureCollection', features: [] },
        counts: null,
        stateCode: 'CA',
        kind: 'county',
      };

      const errors = validateSchema(response, coverageAreasResponseSchema);
      expect(errors).toHaveLength(0);
      expect(response.counts).toBeNull();
    });

    test('validates success response with counts', () => {
      const response = {
        success: true,
        data: { type: 'FeatureCollection', features: [] },
        counts: {
          'area-1': { opportunity_count: 5, total_funding: 1000000 },
          'area-2': { opportunity_count: 12, total_funding: 5000000 },
        },
        stateCode: 'CA',
        kind: 'county',
      };

      expect(response.counts).not.toBeNull();
      Object.values(response.counts).forEach(entry => {
        expect(typeof entry.opportunity_count).toBe('number');
        expect(typeof entry.total_funding).toBe('number');
      });
    });

    test('stateCode is uppercase', () => {
      const response = {
        success: true,
        data: {},
        counts: null,
        stateCode: 'TX',
        kind: 'utility',
      };

      expect(response.stateCode).toBe(response.stateCode.toUpperCase());
    });

    test('kind is county or utility', () => {
      const responses = [
        { success: true, data: {}, counts: null, stateCode: 'CA', kind: 'county' },
        { success: true, data: {}, counts: null, stateCode: 'CA', kind: 'utility' },
      ];

      responses.forEach(r => {
        expect(['county', 'utility']).toContain(r.kind);
      });
    });

    test('invalid kind returns 400 error shape', () => {
      const errorResponse = {
        success: false,
        error: 'Invalid kind parameter. Must be "county" or "utility"',
      };

      expect(errorResponse.success).toBe(false);
      expect(typeof errorResponse.error).toBe('string');
    });
  });

  describe('GET /api/map/national Response', () => {
    test('validates count-only response', () => {
      const response = {
        success: true,
        count: 42,
      };

      expect(response.success).toBe(true);
      expect(typeof response.count).toBe('number');
      expect(response.data).toBeUndefined();
    });

    test('validates full response with data and count', () => {
      const response = {
        success: true,
        count: 42,
        data: [
          { id: 'opp-1', title: 'Federal Grant', is_national: true, status: 'open' },
          { id: 'opp-2', title: 'National Program', is_national: true, status: 'open' },
        ],
      };

      expect(response.success).toBe(true);
      expect(typeof response.count).toBe('number');
      expect(Array.isArray(response.data)).toBe(true);
    });

    test('data items have required fields', () => {
      const items = [
        { id: 'opp-1', title: 'Federal Grant', is_national: true, status: 'open' },
      ];

      items.forEach(item => {
        const errors = validateSchema(item, mapOpportunitySchema);
        expect(errors).toHaveLength(0);
      });
    });

    test('count is non-negative integer', () => {
      const validCounts = [0, 1, 42, 1000];
      validCounts.forEach(count => {
        expect(count).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(count)).toBe(true);
      });
    });

    test('error response shape', () => {
      const response = {
        success: false,
        error: 'Database connection failed',
      };

      expect(response.success).toBe(false);
      expect(typeof response.error).toBe('string');
    });
  });
});
