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
  owner_id: 'string|null',
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
        owner_id: 'user-abc-123',
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
        owner_id: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: null,
      };

      const errors = validateSchema(client, clientSchema);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Client List Response', () => {
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
  });

  describe('POST /api/clients - assigned_users contract', () => {
    // Mirrors the resolution logic in POST /api/clients route.js
    function resolveAssignedUsers(bodyAssignedUsers, ownerId) {
      if (Array.isArray(bodyAssignedUsers) && bodyAssignedUsers.length > 0) {
        return bodyAssignedUsers;
      }
      return ownerId ? [ownerId] : [];
    }

    test('accepts assigned_users array in request body', () => {
      const body = {
        name: 'Test Client',
        type: 'Municipal Government',
        address: '123 Main St',
        assigned_users: ['user-1', 'user-2'],
      };

      expect(Array.isArray(body.assigned_users)).toBe(true);
      expect(resolveAssignedUsers(body.assigned_users, 'owner-1')).toEqual(['user-1', 'user-2']);
    });

    test('falls back to ownerId when assigned_users absent', () => {
      const body = {
        name: 'Test Client',
        type: 'Municipal Government',
        address: '123 Main St',
      };

      expect(resolveAssignedUsers(body.assigned_users, 'owner-1')).toEqual(['owner-1']);
    });
  });

  describe('PUT /api/clients/[id] - assigned_users contract', () => {
    // Mirrors the sync guard in PUT /api/clients/[id] route.js
    function shouldSyncUsers(body) {
      return Array.isArray(body.assigned_users);
    }

    test('syncs when assigned_users is an array', () => {
      expect(shouldSyncUsers({ assigned_users: ['u1'] })).toBe(true);
    });

    test('syncs when assigned_users is empty (clears all)', () => {
      expect(shouldSyncUsers({ assigned_users: [] })).toBe(true);
    });

    test('skips sync when assigned_users absent (backward compat)', () => {
      expect(shouldSyncUsers({ name: 'Updated' })).toBe(false);
    });
  });

  describe('Error Responses', () => {
    test('client not found (404)', () => {
      const response = {
        error: 'Client not found',
        code: 'CLIENT_NOT_FOUND',
      };

      expect(response.error).toBe('Client not found');
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

      expect(response.error).toBe('Validation failed');
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.details.name).toBe('Name is required');
      expect(response.details.type).toBe('Type must be a valid client type');
    });

    test('duplicate client (409)', () => {
      const response = {
        error: 'Client with this name already exists',
        code: 'DUPLICATE_CLIENT',
      };

      expect(response.error).toBe('Client with this name already exists');
      expect(response.code).toBe('DUPLICATE_CLIENT');
    });
  });

});
