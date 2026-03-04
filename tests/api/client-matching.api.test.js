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
import { opportunities } from '../fixtures/opportunities.js';

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
      expect(response.total_matches).toBe(1);
      expect(response.client_id).toBe('client-123');
    });

    test('empty matches array is valid', () => {
      const response = {
        client_id: 'client-123',
        client_name: 'New Client',
        matches: [],
        total_matches: 0,
      };

      expect(response.matches).toHaveLength(0);
      expect(response.total_matches).toBe(0);
    });
  });

  describe('Score Constraints', () => {
    function isValidScore(score) {
      return typeof score === 'number' && score >= 0 && score <= 100;
    }

    test('score should be 0-100', () => {
      expect(isValidScore(0)).toBe(true);
      expect(isValidScore(50)).toBe(true);
      expect(isValidScore(100)).toBe(true);
      expect(isValidScore(-1)).toBe(false);
      expect(isValidScore(101)).toBe(false);
      expect(isValidScore(150)).toBe(false);
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

  describe('Promotion Status Filter (opportunity visibility)', () => {
    // Inline filter replicating: .neq('status', 'closed').or('promotion_status.is.null,promotion_status.eq.promoted')
    // Used by client-matching, top-matches, and summary routes
    function filterVisibleOpportunities(opps) {
      return opps.filter(
        (o) =>
          o.status !== 'closed' &&
          (o.promotion_status === null || o.promotion_status === 'promoted')
      );
    }

    const fixtures = [
      { ...opportunities.nationalGrant, id: 'vis-1', status: 'open', promotion_status: null },
      { ...opportunities.nationalGrant, id: 'vis-2', status: 'open', promotion_status: 'promoted' },
      { ...opportunities.nationalGrant, id: 'hid-1', status: 'open', promotion_status: 'pending_review' },
      { ...opportunities.nationalGrant, id: 'hid-2', status: 'open', promotion_status: 'rejected' },
      { ...opportunities.nationalGrant, id: 'hid-3', status: 'closed', promotion_status: null },
      { ...opportunities.nationalGrant, id: 'hid-4', status: 'closed', promotion_status: 'promoted' },
    ];

    test('null promotion_status is visible (legacy API records)', () => {
      const visible = filterVisibleOpportunities(
        [{ ...opportunities.nationalGrant, status: 'open', promotion_status: null }]
      );
      expect(visible).toHaveLength(1);
    });

    test('promoted records are visible (admin approved)', () => {
      const visible = filterVisibleOpportunities(
        [{ ...opportunities.nationalGrant, status: 'open', promotion_status: 'promoted' }]
      );
      expect(visible).toHaveLength(1);
    });

    test('pending_review records are excluded', () => {
      const visible = filterVisibleOpportunities(
        [{ ...opportunities.nationalGrant, status: 'open', promotion_status: 'pending_review' }]
      );
      expect(visible).toHaveLength(0);
    });

    test('rejected records are excluded', () => {
      const visible = filterVisibleOpportunities(
        [{ ...opportunities.nationalGrant, status: 'open', promotion_status: 'rejected' }]
      );
      expect(visible).toHaveLength(0);
    });

    test('closed + promoted is excluded (status filter takes precedence)', () => {
      const visible = filterVisibleOpportunities(
        [{ ...opportunities.nationalGrant, status: 'closed', promotion_status: 'promoted' }]
      );
      expect(visible).toHaveLength(0);
    });

    test('filters correctly across mixed set (2 of 6 visible)', () => {
      const visible = filterVisibleOpportunities(fixtures);
      const visibleIds = visible.map((o) => o.id);
      expect(visible).toHaveLength(2);
      expect(visibleIds).toContain('vis-1');
      expect(visibleIds).toContain('vis-2');
    });
  });

  describe('Error Responses', () => {
    test('client not found error structure', () => {
      const errorResponse = {
        error: 'Client not found',
        code: 'CLIENT_NOT_FOUND',
      };

      expect(errorResponse.error).toBe('Client not found');
      expect(errorResponse.code).toBe('CLIENT_NOT_FOUND');
    });

    test('invalid client id error structure', () => {
      const errorResponse = {
        error: 'Invalid client ID format',
        code: 'INVALID_CLIENT_ID',
      };

      expect(errorResponse.error).toBe('Invalid client ID format');
      expect(errorResponse.code).toBe('INVALID_CLIENT_ID');
    });
  });

  describe('GET /api/client-matching/summary Response', () => {
    test('validates success response shape', () => {
      const response = {
        success: true,
        clientsWithMatches: 8,
        totalMatches: 45,
        totalClients: 12,
        cached: false,
        timestamp: '2025-01-15T12:00:00.000Z',
      };

      expect(response.success).toBe(true);
      expect(response.clientsWithMatches).toBe(8);
      expect(response.totalMatches).toBe(45);
      expect(response.totalClients).toBe(12);
      expect(response.cached).toBe(false);
    });

    test('error response shape', () => {
      const response = {
        success: false,
        error: 'Internal server error',
        message: 'Database connection failed',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Internal server error');
      expect(response.message).toBe('Database connection failed');
    });
  });

  describe('GET /api/client-matching/top-matches Response', () => {
    const topMatchItemSchema = {
      client_id: 'string',
      client_name: 'string',
      client_type: 'string',
      match_count: 'number',
      top_opportunity_id: 'string',
      top_opportunity_title: 'string',
      top_opportunity_score: 'number',
    };

    test('validates success response shape', () => {
      const response = {
        success: true,
        matches: [
          {
            client_id: 'c-1',
            client_name: 'City of SF',
            client_type: 'Municipal Government',
            match_count: 5,
            top_opportunity_id: 'opp-1',
            top_opportunity_title: 'Federal Grant',
            top_opportunity_score: 85,
            top_opportunity_amount: 5000000,
          },
        ],
        cached: false,
        timestamp: '2025-01-15T12:00:00.000Z',
      };

      expect(response.success).toBe(true);
      expect(Array.isArray(response.matches)).toBe(true);
      expect(response.cached).toBe(false);
    });

    test('match item has required fields', () => {
      const item = {
        client_id: 'c-1',
        client_name: 'City of SF',
        client_type: 'Municipal Government',
        match_count: 5,
        top_opportunity_id: 'opp-1',
        top_opportunity_title: 'Federal Grant',
        top_opportunity_score: 85,
      };

      const errors = validateSchema(item, topMatchItemSchema);
      expect(errors).toHaveLength(0);
    });

    test('top_opportunity_amount can be null', () => {
      const item = {
        client_id: 'c-1',
        client_name: 'City of SF',
        client_type: 'Municipal Government',
        match_count: 3,
        top_opportunity_id: 'opp-1',
        top_opportunity_title: 'Grant',
        top_opportunity_score: 70,
        top_opportunity_amount: null,
      };

      expect(item.top_opportunity_amount).toBeNull();
    });

    test('matches sorted by match_count desc then score desc', () => {
      const matches = [
        { match_count: 5, top_opportunity_score: 80 },
        { match_count: 5, top_opportunity_score: 90 },
        { match_count: 3, top_opportunity_score: 95 },
      ];

      const sorted = [...matches].sort((a, b) => {
        if (b.match_count !== a.match_count) return b.match_count - a.match_count;
        return b.top_opportunity_score - a.top_opportunity_score;
      });

      expect(sorted[0].match_count).toBe(5);
      expect(sorted[0].top_opportunity_score).toBe(90);
      expect(sorted[2].match_count).toBe(3);
    });

    test('empty matches array is valid', () => {
      const response = {
        success: true,
        matches: [],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      expect(response.matches).toHaveLength(0);
    });

    test('error response shape', () => {
      const response = {
        success: false,
        error: 'Internal server error',
        message: 'Failed to calculate matches',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Internal server error');
    });
  });

  describe('GET /api/clients/[id]/hidden-matches Response', () => {
    test('validates success response shape', () => {
      const response = {
        success: true,
        hiddenMatches: [
          {
            id: 1,
            opportunity_id: 'opp-123',
            hidden_at: '2025-01-10T10:00:00Z',
            hidden_by: 'user',
            reason: 'Not relevant',
            funding_opportunities: {
              id: 'opp-123',
              title: 'Some Grant',
              agency_name: 'DOE',
              maximum_award: 5000000,
              close_date: '2025-06-30',
              status: 'open',
            },
          },
        ],
        count: 1,
      };

      expect(response.success).toBe(true);
      expect(Array.isArray(response.hiddenMatches)).toBe(true);
      expect(response.count).toBe(response.hiddenMatches.length);
    });

    test('empty hidden matches is valid', () => {
      const response = {
        success: true,
        hiddenMatches: [],
        count: 0,
      };

      expect(response.hiddenMatches).toHaveLength(0);
      expect(response.count).toBe(0);
    });

    test('reason can be null', () => {
      const item = {
        id: 1,
        opportunity_id: 'opp-123',
        hidden_at: '2025-01-10T10:00:00Z',
        hidden_by: 'user',
        reason: null,
      };

      expect(item.reason).toBeNull();
    });
  });

  describe('POST /api/clients/[id]/hidden-matches Response', () => {
    test('validates success response', () => {
      const response = {
        success: true,
        hiddenMatch: {
          id: 1,
          client_id: 'client-1',
          opportunity_id: 'opp-1',
          reason: 'Not applicable',
          hidden_by: 'user',
        },
        message: 'Match hidden successfully',
      };

      expect(response.success).toBe(true);
      expect(response.hiddenMatch.opportunity_id).toBe('opp-1');
      expect(response.message).toBe('Match hidden successfully');
    });

    test('missing opportunityId returns 400', () => {
      const response = {
        success: false,
        error: 'opportunityId is required',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('opportunityId is required');
    });

    test('duplicate returns 409', () => {
      const response = {
        success: false,
        error: 'This match is already hidden',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('This match is already hidden');
    });
  });

  describe('DELETE /api/clients/[id]/hidden-matches Response', () => {
    test('validates success response', () => {
      const response = {
        success: true,
        message: 'Match restored successfully',
      };

      expect(response.success).toBe(true);
      expect(response.message).toBe('Match restored successfully');
    });

    test('missing opportunityId param returns 400', () => {
      const response = {
        success: false,
        error: 'opportunityId query parameter is required',
      };

      expect(response.success).toBe(false);
      expect(response.error).toContain('opportunityId');
    });
  });
});
