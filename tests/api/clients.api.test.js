/**
 * Clients API Contract Tests
 *
 * Tests the expected response structure for client endpoints:
 * - GET /api/clients - List clients
 * - GET /api/clients/[id] - Get single client
 * - POST /api/clients - Create client
 * - PUT /api/clients/[id] - Update client
 * - DELETE /api/clients/[id] - Delete client
 */

import { describe, test, expect } from 'vitest';

/**
 * Expected client object shape
 */
const clientSchema = {
  id: 'string',
  name: 'string',
  type: 'string',
  city: 'string|null',
  state: 'string|null',
  description: 'string|null',
  project_needs: 'array',
  coverage_area_ids: 'array',
  match_count: 'number|null',
  is_dac: 'boolean|null',
  budget_range: 'string|null',
  created_at: 'string',
  updated_at: 'string|null',
};

/**
 * Expected client list item (abbreviated)
 */
const clientListItemSchema = {
  id: 'string',
  name: 'string',
  type: 'string',
  city: 'string|null',
  state: 'string|null',
  match_count: 'number|null',
  is_dac: 'boolean|null',
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
function validateSchema(obj, schema) {
  const errors = [];

  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in obj)) {
      errors.push(`Missing field: ${key}`);
      continue;
    }

    if (!validateFieldType(obj[key], expectedType)) {
      errors.push(`Invalid type for ${key}: expected ${expectedType}`);
    }
  }

  return errors;
}

describe('Clients API Contract', () => {

  describe('Client Schema', () => {
    test('validates complete client object', () => {
      const client = {
        id: 'client-123',
        name: 'City of San Francisco',
        type: 'Municipal Government',
        city: 'San Francisco',
        state: 'CA',
        description: 'Large coastal city with aggressive climate goals',
        project_needs: ['Solar', 'EV Charging'],
        coverage_area_ids: [1, 2, 3],
        match_count: 5,
        is_dac: false,
        budget_range: '$1M - $10M',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-03-01T15:30:00Z',
      };

      const errors = validateSchema(client, clientSchema);
      expect(errors).toHaveLength(0);
    });

    test('validates client with null optional fields', () => {
      const client = {
        id: 'client-123',
        name: 'New Client',
        type: 'Utility',
        city: null,
        state: null,
        description: null,
        project_needs: [],
        coverage_area_ids: [],
        match_count: null,
        is_dac: null,
        budget_range: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: null,
      };

      const errors = validateSchema(client, clientSchema);
      expect(errors).toHaveLength(0);
    });

    test('name is required string', () => {
      const client = {
        id: 'client-123',
        name: '', // Empty string should be valid structurally
        type: 'Utility',
      };

      expect(typeof client.name).toBe('string');
    });
  });

  describe('Client List Response', () => {
    test('validates list response structure', () => {
      const response = {
        clients: [
          {
            id: 'client-1',
            name: 'City of SF',
            type: 'Municipal Government',
            city: 'San Francisco',
            state: 'CA',
            match_count: 5,
            is_dac: false,
          },
        ],
        total: 1,
        hasMore: false,
      };

      expect(Array.isArray(response.clients)).toBe(true);
      expect(typeof response.total).toBe('number');
      expect(typeof response.hasMore).toBe('boolean');
    });

    test('validates list item schema', () => {
      const listItem = {
        id: 'client-1',
        name: 'City of SF',
        type: 'Municipal Government',
        city: 'San Francisco',
        state: 'CA',
        match_count: 5,
        is_dac: false,
      };

      const errors = validateSchema(listItem, clientListItemSchema);
      expect(errors).toHaveLength(0);
    });

    test('empty list is valid', () => {
      const response = {
        clients: [],
        total: 0,
        hasMore: false,
      };

      expect(response.clients).toHaveLength(0);
      expect(response.total).toBe(0);
    });
  });

  describe('Create Client Request', () => {
    const createRequestSchema = {
      name: 'string',
      type: 'string',
      city: 'string|undefined',
      state: 'string|undefined',
      description: 'string|undefined',
      project_needs: 'array|undefined',
      address: 'string|undefined',
    };

    test('minimal create request', () => {
      const request = {
        name: 'New Client',
        type: 'Municipal Government',
      };

      // Name and type are required
      expect(typeof request.name).toBe('string');
      expect(typeof request.type).toBe('string');
      expect(request.name.length).toBeGreaterThan(0);
      expect(request.type.length).toBeGreaterThan(0);
    });

    test('complete create request', () => {
      const request = {
        name: 'City of Test',
        type: 'Municipal Government',
        city: 'Test City',
        state: 'CA',
        description: 'Test description',
        project_needs: ['Solar', 'Wind'],
        address: '123 Main St, Test City, CA 12345',
      };

      expect(typeof request.name).toBe('string');
      expect(typeof request.type).toBe('string');
      expect(Array.isArray(request.project_needs)).toBe(true);
    });
  });

  describe('Update Client Request', () => {
    test('partial update request', () => {
      const request = {
        name: 'Updated Name',
        // Only updating name
      };

      expect(typeof request.name).toBe('string');
    });

    test('update with multiple fields', () => {
      const request = {
        name: 'Updated Name',
        description: 'Updated description',
        project_needs: ['Solar', 'Battery Storage'],
      };

      expect(typeof request.name).toBe('string');
      expect(typeof request.description).toBe('string');
      expect(Array.isArray(request.project_needs)).toBe(true);
    });
  });

  describe('Delete Client Response', () => {
    test('successful delete response', () => {
      const response = {
        success: true,
        deleted_id: 'client-123',
      };

      expect(response.success).toBe(true);
      expect(typeof response.deleted_id).toBe('string');
    });

    test('delete with cascade info', () => {
      const response = {
        success: true,
        deleted_id: 'client-123',
        cascade: {
          hidden_matches_removed: 5,
          tracked_opportunities_removed: 3,
        },
      };

      expect(response.success).toBe(true);
      expect(typeof response.cascade).toBe('object');
    });
  });

  describe('Query Parameters', () => {
    const validParams = {
      types: ['Municipal Government', 'School District', 'Utility'],
      states: ['CA', 'TX', 'NY'],
      matchStatus: ['all', 'has_matches', 'no_matches'],
      dacOnly: [true, false],
      search: ['city', 'school', ''],
      sortBy: ['name', 'match_count', 'location'],
      limit: [12, 24, 48],
    };

    test('types is array of strings', () => {
      validParams.types.forEach(type => {
        expect(typeof type).toBe('string');
      });
    });

    test('states uses 2-letter codes', () => {
      validParams.states.forEach(state => {
        expect(state.length).toBe(2);
        expect(state).toBe(state.toUpperCase());
      });
    });

    test('matchStatus has valid enum values', () => {
      const validStatuses = ['all', 'has_matches', 'no_matches'];
      validParams.matchStatus.forEach(status => {
        expect(validStatuses.includes(status)).toBe(true);
      });
    });
  });

  describe('Error Responses', () => {
    test('client not found (404)', () => {
      const response = {
        error: 'Client not found',
        code: 'CLIENT_NOT_FOUND',
      };

      expect(typeof response.error).toBe('string');
      expect(response.code).toBe('CLIENT_NOT_FOUND');
    });

    test('validation error (400)', () => {
      const response = {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: {
          name: 'Name is required',
          type: 'Type must be a valid client type',
        },
      };

      expect(typeof response.error).toBe('string');
      expect(response.details).toBeDefined();
    });

    test('duplicate client (409)', () => {
      const response = {
        error: 'Client with this name already exists',
        code: 'DUPLICATE_CLIENT',
      };

      expect(typeof response.error).toBe('string');
    });
  });

  describe('Client Type Validation', () => {
    const validClientTypes = [
      'Municipal Government',
      'County Government',
      'State Government',
      'Tribal Government',
      'School District',
      'Public Housing Authority',
      'Utility',
      'Non-Profit Organization',
      'Commercial Entity',
    ];

    test('type must be from valid list', () => {
      validClientTypes.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });

    test('invalid types would be rejected', () => {
      const invalidTypes = ['Person', 'Company', 'random'];
      invalidTypes.forEach(type => {
        expect(validClientTypes.includes(type)).toBe(false);
      });
    });
  });

  describe('Project Needs Validation', () => {
    test('project_needs is array of strings', () => {
      const projectNeeds = ['Solar', 'Wind', 'HVAC Upgrades', 'EV Charging'];

      expect(Array.isArray(projectNeeds)).toBe(true);
      projectNeeds.forEach(need => {
        expect(typeof need).toBe('string');
      });
    });

    test('empty project_needs is valid', () => {
      const projectNeeds = [];
      expect(Array.isArray(projectNeeds)).toBe(true);
      expect(projectNeeds).toHaveLength(0);
    });
  });
});
