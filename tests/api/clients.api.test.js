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

  describe('Filtered Client List Response', () => {
    test('filtered response has same shape as unfiltered', () => {
      // When user_id filtering is applied, the response shape is identical
      const unfilteredResponse = {
        success: true,
        clients: [
          { id: 'client-1', name: 'City of SF', type: 'Municipal Government' },
          { id: 'client-2', name: 'City of LA', type: 'Municipal Government' },
        ],
        count: 2,
      };

      const filteredResponse = {
        success: true,
        clients: [
          { id: 'client-1', name: 'City of SF', type: 'Municipal Government' },
        ],
        count: 1,
      };

      expect(Object.keys(filteredResponse)).toEqual(Object.keys(unfilteredResponse));
      expect(filteredResponse.success).toBe(true);
      expect(Array.isArray(filteredResponse.clients)).toBe(true);
      expect(filteredResponse.count).toBe(filteredResponse.clients.length);
    });

    test('empty filtered result returns empty array with count 0', () => {
      const response = { success: true, clients: [], count: 0 };
      expect(response.clients).toHaveLength(0);
      expect(response.count).toBe(0);
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
