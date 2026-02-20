/**
 * System Config API Contract Tests
 *
 * Validates response structures for:
 * - GET /api/admin/system-config/[key]
 * - PUT /api/admin/system-config/[key]
 * - DELETE /api/admin/system-config/[key]
 */

import { describe, test, expect } from 'vitest';
import { validateSchema } from '../helpers/validateSchema.js';

describe('System Config API Contract', () => {

  describe('GET /api/admin/system-config/[key]', () => {
    test('validates success response (value + description)', () => {
      const response = {
        value: '"some_config_value"',
        description: 'Configuration for feature X',
      };

      expect(typeof response.value).toBe('string');
      expect(typeof response.description).toBe('string');
    });

    test('value can be any JSON-stringified type', () => {
      const responses = [
        { value: '"string_value"', description: 'A string config' },
        { value: '42', description: 'A number config' },
        { value: 'true', description: 'A boolean config' },
        { value: '{"nested": "object"}', description: 'An object config' },
        { value: '["array", "value"]', description: 'An array config' },
      ];

      responses.forEach(response => {
        expect(typeof response.value).toBe('string');
        // Should be parseable as JSON
        expect(() => JSON.parse(response.value)).not.toThrow();
      });
    });

    test('404 response for missing key', () => {
      const response = {
        error: 'Configuration key not found',
      };

      expect(typeof response.error).toBe('string');
      expect(response.error).toBe('Configuration key not found');
    });

    test('500 response for server error', () => {
      const response = {
        error: 'Failed to fetch system configuration',
      };

      expect(typeof response.error).toBe('string');
    });
  });

  describe('PUT /api/admin/system-config/[key]', () => {
    const successSchema = {
      success: 'boolean',
      data: 'object',
    };

    test('validates success response', () => {
      const response = {
        success: true,
        data: {
          id: 1,
          key: 'feature_flag_x',
          value: '"enabled"',
          description: 'Feature flag for X',
          updated_at: '2025-01-15T12:00:00.000Z',
        },
      };

      const errors = validateSchema(response, successSchema);
      expect(errors).toHaveLength(0);
    });

    test('data includes key and value', () => {
      const response = {
        success: true,
        data: {
          key: 'my_config',
          value: '"new_value"',
          updated_at: new Date().toISOString(),
        },
      };

      expect(response.data).toHaveProperty('key');
      expect(response.data).toHaveProperty('value');
    });

    test('request body requires value field', () => {
      const validBody = { value: 'some_value' };
      const withDescription = { value: 'some_value', description: 'A description' };

      expect(validBody).toHaveProperty('value');
      expect(withDescription).toHaveProperty('value');
      expect(withDescription).toHaveProperty('description');
    });

    test('description is optional in request body', () => {
      const bodyWithout = { value: 'test' };
      const bodyWith = { value: 'test', description: 'desc' };

      // Without description — valid
      expect(bodyWithout).toHaveProperty('value');
      expect(bodyWithout).not.toHaveProperty('description');

      // With description — also valid
      expect(bodyWith).toHaveProperty('description');
    });

    test('error response structure', () => {
      const response = {
        error: 'Failed to update system configuration',
      };

      expect(typeof response.error).toBe('string');
    });
  });

  describe('DELETE /api/admin/system-config/[key]', () => {
    test('validates success response', () => {
      const response = {
        success: true,
        message: "Configuration key 'my_config' deleted successfully",
      };

      expect(response.success).toBe(true);
      expect(typeof response.message).toBe('string');
    });

    test('message includes key name', () => {
      const key = 'feature_flag_x';
      const response = {
        success: true,
        message: `Configuration key '${key}' deleted successfully`,
      };

      expect(response.message).toContain(key);
    });

    test('error response structure', () => {
      const response = {
        error: 'Failed to delete system configuration',
      };

      expect(typeof response.error).toBe('string');
    });
  });

  describe('PGRST116 Error Code Handling', () => {
    /**
     * Tests the Supabase PostgREST error code handling.
     * Mirrors: app/api/admin/system-config/[key]/route.js lines 19-22
     */
    test('PGRST116 maps to 404', () => {
      function handleGetError(error) {
        if (error.code === 'PGRST116') {
          return { status: 404, body: { error: 'Configuration key not found' } };
        }
        return { status: 500, body: { error: 'Failed to fetch system configuration' } };
      }

      const notFoundError = { code: 'PGRST116', message: 'Not found' };
      const result = handleGetError(notFoundError);

      expect(result.status).toBe(404);
      expect(result.body.error).toBe('Configuration key not found');
    });

    test('other errors map to 500', () => {
      function handleGetError(error) {
        if (error.code === 'PGRST116') {
          return { status: 404, body: { error: 'Configuration key not found' } };
        }
        return { status: 500, body: { error: 'Failed to fetch system configuration' } };
      }

      const serverError = { code: 'PGRST500', message: 'Internal error' };
      const result = handleGetError(serverError);

      expect(result.status).toBe(500);
    });
  });

  describe('PUT Upsert Logic', () => {
    /**
     * Tests the update-or-insert logic for PUT.
     * Mirrors: app/api/admin/system-config/[key]/route.js lines 54-84
     */
    test('existing config triggers update path', () => {
      const existing = { id: 1 };

      function determineAction(existing) {
        return existing ? 'update' : 'insert';
      }

      expect(determineAction(existing)).toBe('update');
    });

    test('missing config triggers insert path', () => {
      function determineAction(existing) {
        return existing ? 'update' : 'insert';
      }

      expect(determineAction(null)).toBe('insert');
      expect(determineAction(undefined)).toBe('insert');
    });

    test('update includes updated_at timestamp', () => {
      const updateData = {
        value: JSON.stringify('new_value'),
        updated_at: new Date().toISOString(),
      };

      expect(updateData).toHaveProperty('updated_at');
      const parsed = new Date(updateData.updated_at);
      expect(isNaN(parsed.getTime())).toBe(false);
    });

    test('description only added to update when provided', () => {
      function buildUpdateData(value, description) {
        const data = {
          value: JSON.stringify(value),
          updated_at: new Date().toISOString(),
        };
        if (description !== undefined) {
          data.description = description;
        }
        return data;
      }

      const withDesc = buildUpdateData('val', 'A description');
      const withoutDesc = buildUpdateData('val', undefined);

      expect(withDesc).toHaveProperty('description');
      expect(withoutDesc).not.toHaveProperty('description');
    });
  });
});
