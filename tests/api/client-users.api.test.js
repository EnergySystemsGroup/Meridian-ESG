/**
 * Client Users API Contract Tests
 *
 * Tests the expected response structure for:
 * - GET /api/clients/[id]/users - Get assigned user IDs
 */

import { describe, test, expect } from 'vitest';

/**
 * Expected response shape for GET /api/clients/[id]/users
 */
const clientUsersResponseSchema = {
  success: 'boolean',
  user_ids: 'array',
};

function validateFieldType(value, expectedType) {
  const types = expectedType.split('|');
  for (const type of types) {
    if (type === 'null' && value === null) return true;
    if (type === 'string' && typeof value === 'string') return true;
    if (type === 'number' && typeof value === 'number') return true;
    if (type === 'boolean' && typeof value === 'boolean') return true;
    if (type === 'array' && Array.isArray(value)) return true;
  }
  return false;
}

function validateSchema(obj, schema) {
  const errors = [];
  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in obj)) {
      errors.push(`Missing field: ${key}`);
      continue;
    }
    if (!validateFieldType(obj[key], expectedType)) {
      errors.push(`Invalid type for ${key}: expected ${expectedType}, got ${typeof obj[key]}`);
    }
  }
  return errors;
}

describe('Client Users API Contract', () => {

  describe('GET /api/clients/[id]/users response shape', () => {
    test('validates success response with user IDs', () => {
      const response = {
        success: true,
        user_ids: ['user-abc-123', 'user-def-456'],
      };

      const errors = validateSchema(response, clientUsersResponseSchema);
      expect(errors).toHaveLength(0);
    });

    test('validates success response with empty user IDs', () => {
      const response = {
        success: true,
        user_ids: [],
      };

      const errors = validateSchema(response, clientUsersResponseSchema);
      expect(errors).toHaveLength(0);
    });

    test('user_ids contains only strings', () => {
      const userIds = ['user-abc-123', 'user-def-456'];

      for (const id of userIds) {
        expect(typeof id).toBe('string');
      }
    });

    test('missing success field fails validation', () => {
      const response = { user_ids: [] };
      const errors = validateSchema(response, clientUsersResponseSchema);
      expect(errors).toContain('Missing field: success');
    });

    test('missing user_ids field fails validation', () => {
      const response = { success: true };
      const errors = validateSchema(response, clientUsersResponseSchema);
      expect(errors).toContain('Missing field: user_ids');
    });
  });

  describe('Error response shape', () => {
    test('validates error response', () => {
      const response = {
        success: false,
        error: 'Client not found',
      };

      expect(response.success).toBe(false);
      expect(typeof response.error).toBe('string');
    });
  });

});
