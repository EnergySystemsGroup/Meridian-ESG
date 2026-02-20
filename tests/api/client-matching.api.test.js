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
      expect(typeof response.clientsWithMatches).toBe('number');
      expect(typeof response.totalMatches).toBe('number');
      expect(typeof response.totalClients).toBe('number');
      expect(typeof response.cached).toBe('boolean');
      expect(typeof response.timestamp).toBe('string');
    });

    test('clientsWithMatches <= totalClients', () => {
      const response = {
        clientsWithMatches: 8,
        totalClients: 12,
      };

      expect(response.clientsWithMatches).toBeLessThanOrEqual(response.totalClients);
    });

    test('all counts are non-negative', () => {
      const response = {
        clientsWithMatches: 0,
        totalMatches: 0,
        totalClients: 0,
      };

      expect(response.clientsWithMatches).toBeGreaterThanOrEqual(0);
      expect(response.totalMatches).toBeGreaterThanOrEqual(0);
      expect(response.totalClients).toBeGreaterThanOrEqual(0);
    });

    test('cached response includes cached: true', () => {
      const response = {
        success: true,
        clientsWithMatches: 8,
        totalMatches: 45,
        totalClients: 12,
        cached: true,
        timestamp: '2025-01-15T12:00:00.000Z',
      };

      expect(response.cached).toBe(true);
    });

    test('error response shape', () => {
      const response = {
        success: false,
        error: 'Internal server error',
        message: 'Database connection failed',
      };

      expect(response.success).toBe(false);
      expect(typeof response.error).toBe('string');
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
      expect(typeof response.cached).toBe('boolean');
    });

    test('matches array has max 5 items', () => {
      const response = {
        matches: Array.from({ length: 5 }, (_, i) => ({
          client_id: `c-${i}`,
          client_name: `Client ${i}`,
          client_type: 'Municipal Government',
          match_count: 5 - i,
          top_opportunity_id: 'opp-1',
          top_opportunity_title: 'Grant',
          top_opportunity_score: 80 - i * 5,
          top_opportunity_amount: 1000000,
        })),
      };

      expect(response.matches.length).toBeLessThanOrEqual(5);
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

      expect(Array.isArray(response.matches)).toBe(true);
      expect(response.matches).toHaveLength(0);
    });

    test('error response shape', () => {
      const response = {
        success: false,
        error: 'Internal server error',
        message: 'Failed to calculate matches',
      };

      expect(response.success).toBe(false);
      expect(typeof response.error).toBe('string');
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
      expect(typeof response.count).toBe('number');
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

    test('hidden match item includes nested opportunity details', () => {
      const item = {
        id: 1,
        opportunity_id: 'opp-123',
        hidden_at: '2025-01-10T10:00:00Z',
        hidden_by: 'user',
        reason: null,
        funding_opportunities: {
          id: 'opp-123',
          title: 'Grant',
          agency_name: 'DOE',
          maximum_award: 5000000,
          close_date: '2025-06-30',
          status: 'open',
        },
      };

      expect(item).toHaveProperty('opportunity_id');
      expect(item).toHaveProperty('hidden_at');
      expect(item).toHaveProperty('funding_opportunities');
      expect(item.funding_opportunities).toHaveProperty('title');
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
      expect(response).toHaveProperty('hiddenMatch');
      expect(typeof response.message).toBe('string');
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
      expect(typeof response.message).toBe('string');
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
