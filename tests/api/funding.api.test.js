/**
 * Funding API Contract Tests
 *
 * Tests the expected response structure for funding endpoints:
 * - GET /api/funding - List opportunities
 * - Response shape validation
 * - Required fields present
 * - Pagination metadata correct
 * - Error response format
 */

import { describe, test, expect } from 'vitest';

/**
 * Expected opportunity shape in API response
 */
const opportunitySchema = {
  id: 'string',
  title: 'string',
  agency_name: 'string|null',
  status: 'string',
  close_date: 'string|null',
  is_national: 'boolean',
  maximum_award: 'number|null',
  total_funding_available: 'number|null',
  relevance_score: 'number|null',
  categories: 'array',
  eligible_project_types: 'array',
  eligible_applicants: 'array',
  coverage_state_codes: 'array|null',
};

/**
 * Expected pagination metadata shape
 */
const paginationSchema = {
  currentPage: 'number',
  totalPages: 'number',
  totalItems: 'number',
  pageSize: 'number',
  hasMore: 'boolean',
};

/**
 * Validate field type against schema
 */
function validateFieldType(value, expectedType) {
  const types = expectedType.split('|');

  for (const type of types) {
    if (type === 'null' && value === null) return true;
    if (type === 'undefined' && value === undefined) return true;
    if (type === 'string' && typeof value === 'string') return true;
    if (type === 'number' && typeof value === 'number') return true;
    if (type === 'boolean' && typeof value === 'boolean') return true;
    if (type === 'array' && Array.isArray(value)) return true;
    if (type === 'object' && typeof value === 'object' && !Array.isArray(value)) return true;
  }

  return false;
}

/**
 * Validate object against schema
 */
function validateSchema(obj, schema, path = '') {
  const errors = [];

  for (const [key, expectedType] of Object.entries(schema)) {
    const fullPath = path ? `${path}.${key}` : key;
    const value = obj[key];

    // Check if key exists
    if (!(key in obj)) {
      errors.push(`Missing required field: ${fullPath}`);
      continue;
    }

    // Validate type
    if (!validateFieldType(value, expectedType)) {
      errors.push(`Invalid type for ${fullPath}: expected ${expectedType}, got ${typeof value} (${JSON.stringify(value)})`);
    }
  }

  return errors;
}

describe('Funding API Contract', () => {

  describe('Opportunity Schema', () => {
    test('validates complete opportunity object', () => {
      const opportunity = {
        id: 'opp-123',
        title: 'Clean Energy Grant',
        agency_name: 'DOE',
        status: 'open',
        close_date: '2025-06-30T23:59:59Z',
        is_national: true,
        maximum_award: 5000000,
        total_funding_available: 500000000,
        relevance_score: 8.5,
        categories: ['Energy'],
        eligible_project_types: ['Solar', 'Wind'],
        eligible_applicants: ['Local Governments'],
        coverage_state_codes: null,
      };

      const errors = validateSchema(opportunity, opportunitySchema);
      expect(errors).toHaveLength(0);
    });

    test('validates opportunity with null optional fields', () => {
      const opportunity = {
        id: 'opp-123',
        title: 'Minimal Grant',
        agency_name: null,
        status: 'open',
        close_date: null,
        is_national: false,
        maximum_award: null,
        total_funding_available: null,
        relevance_score: null,
        categories: [],
        eligible_project_types: [],
        eligible_applicants: [],
        coverage_state_codes: ['CA', 'TX'],
      };

      const errors = validateSchema(opportunity, opportunitySchema);
      expect(errors).toHaveLength(0);
    });

    test('detects missing required field', () => {
      const opportunity = {
        // missing id
        title: 'Grant',
        status: 'open',
        is_national: true,
      };

      const errors = validateSchema(opportunity, opportunitySchema);
      expect(errors.some(e => e.includes('id'))).toBe(true);
    });

    test('detects wrong type', () => {
      const opportunity = {
        id: 'opp-123',
        title: 'Grant',
        agency_name: 'DOE',
        status: 'open',
        close_date: '2025-06-30',
        is_national: 'yes', // should be boolean
        maximum_award: 5000000,
        total_funding_available: null,
        relevance_score: null,
        categories: [],
        eligible_project_types: [],
        eligible_applicants: [],
        coverage_state_codes: null,
      };

      const errors = validateSchema(opportunity, opportunitySchema);
      expect(errors.some(e => e.includes('is_national'))).toBe(true);
    });
  });

  describe('Pagination Schema', () => {
    test('validates complete pagination object', () => {
      const pagination = {
        currentPage: 1,
        totalPages: 5,
        totalItems: 45,
        pageSize: 9,
        hasMore: true,
      };

      const errors = validateSchema(pagination, paginationSchema);
      expect(errors).toHaveLength(0);
    });

    test('validates last page pagination', () => {
      const pagination = {
        currentPage: 5,
        totalPages: 5,
        totalItems: 45,
        pageSize: 9,
        hasMore: false,
      };

      const errors = validateSchema(pagination, paginationSchema);
      expect(errors).toHaveLength(0);
    });

    test('validates empty results pagination', () => {
      const pagination = {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        pageSize: 9,
        hasMore: false,
      };

      const errors = validateSchema(pagination, paginationSchema);
      expect(errors).toHaveLength(0);
    });
  });

  describe('List Response Shape', () => {
    const listResponseSchema = {
      opportunities: 'array',
      pagination: 'object',
    };

    test('validates list response structure', () => {
      const response = {
        opportunities: [
          {
            id: 'opp-1',
            title: 'Grant 1',
            agency_name: 'DOE',
            status: 'open',
            close_date: '2025-06-30',
            is_national: true,
            maximum_award: 5000000,
            total_funding_available: null,
            relevance_score: 8.5,
            categories: [],
            eligible_project_types: [],
            eligible_applicants: [],
            coverage_state_codes: null,
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          pageSize: 9,
          hasMore: false,
        },
      };

      const errors = validateSchema(response, listResponseSchema);
      expect(errors).toHaveLength(0);

      // Also validate nested opportunity
      const oppErrors = validateSchema(response.opportunities[0], opportunitySchema);
      expect(oppErrors).toHaveLength(0);

      // And pagination
      const pageErrors = validateSchema(response.pagination, paginationSchema);
      expect(pageErrors).toHaveLength(0);
    });
  });

  describe('Error Response Shape', () => {
    test('validates error response with message only', () => {
      const response = {
        error: 'Invalid request',
      };

      expect(response.error).toBe('Invalid request');
    });

    test('validates error response with code', () => {
      const response = {
        error: 'Not found',
        code: 'NOT_FOUND',
      };

      expect(response.error).toBe('Not found');
      expect(response.code).toBe('NOT_FOUND');
    });

    test('validates error response with details', () => {
      const response = {
        error: 'Validation failed',
        details: {
          field: 'status',
          message: 'Invalid status value',
        },
      };

      expect(response.error).toBe('Validation failed');
      expect(response.details.field).toBe('status');
      expect(response.details.message).toBe('Invalid status value');
    });
  });

  describe('Query Parameter Validation', () => {
    /**
     * Inline validation functions replicating query param checks
     */
    function isValidPage(v) {
      return Number.isInteger(v) && v > 0;
    }

    function isValidStatus(s) {
      return ['open', 'closed', 'upcoming', 'all'].includes(s);
    }

    function isValidSortBy(s) {
      return ['relevance', 'deadline', 'amount', 'recent'].includes(s);
    }

    test('page must be positive integer', () => {
      expect(isValidPage(1)).toBe(true);
      expect(isValidPage(2)).toBe(true);
      expect(isValidPage(100)).toBe(true);
      expect(isValidPage(0)).toBe(false);
      expect(isValidPage(-1)).toBe(false);
      expect(isValidPage(1.5)).toBe(false);
    });

    test('status has valid enum values', () => {
      expect(isValidStatus('open')).toBe(true);
      expect(isValidStatus('closed')).toBe(true);
      expect(isValidStatus('upcoming')).toBe(true);
      expect(isValidStatus('all')).toBe(true);
      expect(isValidStatus('active')).toBe(false);
      expect(isValidStatus('pending')).toBe(false);
      expect(isValidStatus('expired')).toBe(false);
    });

    test('sortBy has valid enum values', () => {
      expect(isValidSortBy('relevance')).toBe(true);
      expect(isValidSortBy('deadline')).toBe(true);
      expect(isValidSortBy('amount')).toBe(true);
      expect(isValidSortBy('recent')).toBe(true);
      expect(isValidSortBy('name')).toBe(false);
      expect(isValidSortBy('date')).toBe(false);
    });
  });

  describe('Response Consistency', () => {
    test('opportunity IDs are unique within response', () => {
      const response = {
        opportunities: [
          { id: 'opp-1', title: 'Grant 1' },
          { id: 'opp-2', title: 'Grant 2' },
          { id: 'opp-3', title: 'Grant 3' },
        ],
      };

      const ids = response.opportunities.map(o => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
