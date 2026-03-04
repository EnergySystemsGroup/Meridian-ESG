/**
 * Funding Stats API Contract Tests
 *
 * Validates response structures for:
 * - GET /api/funding/coverage-counts
 * - GET /api/funding/project-type-summary
 * - GET /api/funding/total-available
 */

import { describe, test, expect } from 'vitest';
import { validateSchema } from '../helpers/validateSchema.js';

describe('Funding Stats API Contracts', () => {

  describe('GET /api/funding/coverage-counts', () => {
    const successSchema = {
      success: 'boolean',
      counts: 'object',
    };

    const errorSchema = {
      success: 'boolean',
      error: 'string',
    };

    test('validates success response structure', () => {
      const response = {
        success: true,
        counts: {
          national: 15,
          statewide: 23,
          county: 8,
          utility: 12,
        },
      };

      const errors = validateSchema(response, successSchema);
      expect(errors).toHaveLength(0);
    });

    test('empty counts object is valid', () => {
      const response = {
        success: true,
        counts: {},
      };

      const errors = validateSchema(response, successSchema);
      expect(errors).toHaveLength(0);
    });

    test('error response structure', () => {
      const response = {
        success: false,
        error: 'Database error message',
      };

      const errors = validateSchema(response, errorSchema);
      expect(errors).toHaveLength(0);
      expect(response.success).toBe(false);
    });
  });

  describe('GET /api/funding/project-type-summary', () => {
    const itemSchema = {
      category: 'string',
      total_funding: 'number',
      opportunity_count: 'number',
    };

    test('validates array of project type items', () => {
      const response = [
        { category: 'Solar Panels', total_funding: 50000000, opportunity_count: 12 },
        { category: 'HVAC Systems', total_funding: 30000000, opportunity_count: 8 },
      ];

      expect(Array.isArray(response)).toBe(true);
      response.forEach(item => {
        const errors = validateSchema(item, itemSchema);
        expect(errors).toHaveLength(0);
      });
    });


    test('error response has error field', () => {
      const errorResponse = {
        error: 'Failed to fetch funding data by project type',
        details: 'Database function not found',
      };

      expect(errorResponse.error).toBe('Failed to fetch funding data by project type');
      expect(errorResponse.details).toBe('Database function not found');
    });
  });

  describe('GET /api/funding/total-available', () => {
    const successSchema = {
      success: 'boolean',
      total: 'number',
      cached: 'boolean',
      timestamp: 'string',
    };

    const freshResponseSchema = {
      success: 'boolean',
      total: 'number',
      opportunityCount: 'number',
      cached: 'boolean',
      timestamp: 'string',
    };

    test('validates cached response structure', () => {
      const response = {
        success: true,
        total: 125000000,
        cached: true,
        timestamp: '2025-01-15T12:00:00.000Z',
      };

      const errors = validateSchema(response, successSchema);
      expect(errors).toHaveLength(0);
    });

    test('validates fresh response with opportunityCount', () => {
      const response = {
        success: true,
        total: 125000000,
        opportunityCount: 45,
        cached: false,
        timestamp: '2025-01-15T12:00:00.000Z',
      };

      const errors = validateSchema(response, freshResponseSchema);
      expect(errors).toHaveLength(0);
    });

    test('timestamp is valid ISO 8601', () => {
      const response = {
        success: true,
        total: 125000000,
        cached: false,
        timestamp: '2025-01-15T12:00:00.000Z',
      };

      const parsed = new Date(response.timestamp);
      expect(isNaN(parsed.getTime())).toBe(false);
    });

    test('error response structure', () => {
      const response = {
        success: false,
        error: 'Failed to fetch funding data',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed to fetch funding data');
    });
  });
});
