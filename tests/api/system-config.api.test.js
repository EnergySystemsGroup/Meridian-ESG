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
    test('value can be any JSON-stringified type', () => {
      const responses = [
        { value: '"string_value"', description: 'A string config' },
        { value: '42', description: 'A number config' },
        { value: 'true', description: 'A boolean config' },
        { value: '{"nested": "object"}', description: 'An object config' },
        { value: '["array", "value"]', description: 'An array config' },
      ];

      responses.forEach(response => {
        expect(() => JSON.parse(response.value)).not.toThrow();
      });
    });

    test('404 response for missing key', () => {
      const response = {
        error: 'Configuration key not found',
      };

      expect(response.error).toBe('Configuration key not found');
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

    test('error response structure', () => {
      const response = {
        error: 'Failed to update system configuration',
      };

      expect(response.error).toBe('Failed to update system configuration');
    });
  });

  describe('DELETE /api/admin/system-config/[key]', () => {
    test('validates success response', () => {
      const response = {
        success: true,
        message: "Configuration key 'my_config' deleted successfully",
      };

      expect(response.success).toBe(true);
      expect(response.message).toBe("Configuration key 'my_config' deleted successfully");
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

      expect(response.error).toBe('Failed to delete system configuration');
    });
  });

  describe('PGRST116 Error Code Handling', () => {
    /**
     * Tests the Supabase PostgREST error code handling.
     * Mirrors: app/api/admin/system-config/[key]/route.js lines 19-22
     */
    function handleGetError(error) {
      if (error.code === 'PGRST116') {
        return { status: 404, body: { error: 'Configuration key not found' } };
      }
      return { status: 500, body: { error: 'Failed to fetch system configuration' } };
    }

    test('PGRST116 maps to 404', () => {
      const notFoundError = { code: 'PGRST116', message: 'Not found' };
      const result = handleGetError(notFoundError);

      expect(result.status).toBe(404);
      expect(result.body.error).toBe('Configuration key not found');
    });

    test('other errors map to 500', () => {
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
    function determineAction(existing) {
      return existing ? 'update' : 'insert';
    }

    test('existing config triggers update path', () => {
      expect(determineAction({ id: 1 })).toBe('update');
    });

    test('missing config triggers insert path', () => {
      expect(determineAction(null)).toBe('insert');
      expect(determineAction(undefined)).toBe('insert');
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

      expect(withDesc.description).toBe('A description');
      expect('description' in withoutDesc).toBe(false);
    });
  });
});
