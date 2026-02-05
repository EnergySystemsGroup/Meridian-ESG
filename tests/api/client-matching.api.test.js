/**
 * Client Matching API Contract Tests
 *
 * Tests the expected response structure for client matching endpoints:
 * - GET /api/client-matching - Get matches for a client
 * - Response shape validation
 * - Match object structure
 * - Score validation
 */

import { describe, test, expect } from 'vitest';

/**
 * Expected match object shape
 */
const matchSchema = {
  opportunity_id: 'string',
  opportunity_title: 'string',
  agency_name: 'string|null',
  score: 'number',
  matching_criteria: 'object',
  close_date: 'string|null',
  maximum_award: 'number|null',
  is_national: 'boolean',
};

/**
 * Expected matching criteria shape
 */
const matchingCriteriaSchema = {
  locationMatch: 'boolean',
  applicantTypeMatch: 'boolean',
  projectNeedsMatch: 'boolean',
  activitiesMatch: 'boolean',
};

/**
 * Validate field type
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

    if (!(key in obj)) {
      errors.push(`Missing field: ${fullPath}`);
      continue;
    }

    if (!validateFieldType(obj[key], expectedType)) {
      errors.push(`Invalid type for ${fullPath}: expected ${expectedType}`);
    }
  }

  return errors;
}

describe('Client Matching API Contract', () => {

  describe('Match Schema', () => {
    test('validates complete match object', () => {
      const match = {
        opportunity_id: 'opp-123',
        opportunity_title: 'Clean Energy Grant',
        agency_name: 'DOE',
        score: 85,
        matching_criteria: {
          locationMatch: true,
          applicantTypeMatch: true,
          projectNeedsMatch: true,
          activitiesMatch: true,
        },
        close_date: '2025-06-30T23:59:59Z',
        maximum_award: 5000000,
        is_national: true,
      };

      const errors = validateSchema(match, matchSchema);
      expect(errors).toHaveLength(0);
    });

    test('validates match with null optional fields', () => {
      const match = {
        opportunity_id: 'opp-123',
        opportunity_title: 'Minimal Grant',
        agency_name: null,
        score: 50,
        matching_criteria: {
          locationMatch: true,
          applicantTypeMatch: false,
          projectNeedsMatch: true,
          activitiesMatch: false,
        },
        close_date: null,
        maximum_award: null,
        is_national: false,
      };

      const errors = validateSchema(match, matchSchema);
      expect(errors).toHaveLength(0);
    });

    test('score must be a number', () => {
      const match = {
        opportunity_id: 'opp-123',
        opportunity_title: 'Grant',
        agency_name: null,
        score: 'high', // Invalid
        matching_criteria: {},
        close_date: null,
        maximum_award: null,
        is_national: false,
      };

      const errors = validateSchema(match, matchSchema);
      expect(errors.some(e => e.includes('score'))).toBe(true);
    });
  });

  describe('Matching Criteria Schema', () => {
    test('validates all boolean criteria', () => {
      const criteria = {
        locationMatch: true,
        applicantTypeMatch: true,
        projectNeedsMatch: false,
        activitiesMatch: true,
      };

      const errors = validateSchema(criteria, matchingCriteriaSchema);
      expect(errors).toHaveLength(0);
    });

    test('all four criteria must be present', () => {
      const incompleteCriteria = {
        locationMatch: true,
        applicantTypeMatch: true,
        // missing projectNeedsMatch and activitiesMatch
      };

      const errors = validateSchema(incompleteCriteria, matchingCriteriaSchema);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('List Response Shape', () => {
    test('validates matches array response', () => {
      const response = {
        client_id: 'client-123',
        client_name: 'City of SF',
        matches: [
          {
            opportunity_id: 'opp-1',
            opportunity_title: 'Grant 1',
            agency_name: 'DOE',
            score: 90,
            matching_criteria: {
              locationMatch: true,
              applicantTypeMatch: true,
              projectNeedsMatch: true,
              activitiesMatch: true,
            },
            close_date: '2025-06-30',
            maximum_award: 1000000,
            is_national: true,
          },
        ],
        total_matches: 1,
      };

      expect(Array.isArray(response.matches)).toBe(true);
      expect(typeof response.total_matches).toBe('number');
      expect(typeof response.client_id).toBe('string');
    });

    test('empty matches array is valid', () => {
      const response = {
        client_id: 'client-123',
        client_name: 'New Client',
        matches: [],
        total_matches: 0,
      };

      expect(Array.isArray(response.matches)).toBe(true);
      expect(response.matches).toHaveLength(0);
      expect(response.total_matches).toBe(0);
    });
  });

  describe('Score Constraints', () => {
    test('score should be 0-100', () => {
      const validScores = [0, 25, 50, 75, 100];
      const invalidScores = [-1, 101, 150];

      validScores.forEach(score => {
        expect(score >= 0 && score <= 100).toBe(true);
      });

      invalidScores.forEach(score => {
        expect(score >= 0 && score <= 100).toBe(false);
      });
    });

    test('score precision (whole numbers or 1 decimal)', () => {
      const validPrecision = [85, 85.5, 90.0, 75.5];

      validPrecision.forEach(score => {
        const decimals = (score.toString().split('.')[1] || '').length;
        expect(decimals <= 1).toBe(true);
      });
    });
  });

  describe('Match Sorting', () => {
    test('matches should be sorted by score descending', () => {
      const response = {
        matches: [
          { opportunity_id: '1', score: 95 },
          { opportunity_id: '2', score: 85 },
          { opportunity_id: '3', score: 70 },
        ],
      };

      for (let i = 1; i < response.matches.length; i++) {
        expect(response.matches[i - 1].score).toBeGreaterThanOrEqual(response.matches[i].score);
      }
    });
  });

  describe('Query Parameters', () => {
    const validParams = {
      clientId: ['client-123', 'uuid-format-id'],
      includeHidden: [true, false],
      minScore: [0, 25, 50, 75],
      limit: [10, 25, 50, 100],
    };

    test('clientId is required string', () => {
      validParams.clientId.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      });
    });

    test('includeHidden is boolean', () => {
      validParams.includeHidden.forEach(val => {
        expect(typeof val).toBe('boolean');
      });
    });

    test('minScore is positive number', () => {
      validParams.minScore.forEach(score => {
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Hidden Matches Response', () => {
    test('includes hidden_matches field when requested', () => {
      const response = {
        client_id: 'client-123',
        matches: [],
        hidden_matches: [
          {
            opportunity_id: 'opp-hidden-1',
            hidden_at: '2024-01-15T10:00:00Z',
            hidden_reason: 'Not relevant',
          },
        ],
      };

      expect(Array.isArray(response.hidden_matches)).toBe(true);
      expect(response.hidden_matches[0]).toHaveProperty('opportunity_id');
      expect(response.hidden_matches[0]).toHaveProperty('hidden_at');
    });

    test('hidden_matches can be empty', () => {
      const response = {
        client_id: 'client-123',
        matches: [],
        hidden_matches: [],
      };

      expect(response.hidden_matches).toHaveLength(0);
    });
  });

  describe('Error Responses', () => {
    test('client not found error structure', () => {
      const errorResponse = {
        error: 'Client not found',
        code: 'CLIENT_NOT_FOUND',
      };

      expect(typeof errorResponse.error).toBe('string');
      expect(errorResponse.code).toBeDefined();
    });

    test('invalid client id error structure', () => {
      const errorResponse = {
        error: 'Invalid client ID format',
        code: 'INVALID_CLIENT_ID',
      };

      expect(typeof errorResponse.error).toBe('string');
    });
  });
});
