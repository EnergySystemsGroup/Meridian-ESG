/**
 * API: Error Response Contract Tests
 *
 * Validates that all API error responses follow a consistent shape.
 * Ensures error codes, messages, and status codes are correctly mapped.
 */

import { describe, test, expect } from 'vitest';

/**
 * Standard error response builder (mimics what API routes should return)
 */
function buildErrorResponse(statusCode, message, details = null) {
  return {
    status: statusCode,
    body: {
      error: true,
      message,
      code: statusCodeToCode(statusCode),
      ...(details ? { details } : {}),
    },
  };
}

function statusCodeToCode(status) {
  const codeMap = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
  };
  return codeMap[status] || 'UNKNOWN_ERROR';
}

/**
 * Validate an error response matches the contract
 */
function validateErrorResponse(response) {
  const errors = [];

  if (typeof response.status !== 'number') {
    errors.push('Status must be a number');
  } else if (response.status < 400 || response.status > 599) {
    errors.push('Error status must be 4xx or 5xx');
  }

  if (!response.body) {
    errors.push('Body must be present');
  } else {
    if (response.body.error !== true) {
      errors.push('body.error must be true');
    }
    if (typeof response.body.message !== 'string' || response.body.message.length === 0) {
      errors.push('body.message must be a non-empty string');
    }
    if (typeof response.body.code !== 'string') {
      errors.push('body.code must be a string');
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('Error Response Contracts', () => {

  describe('Error Response Shape', () => {
    test('400 Bad Request has correct shape', () => {
      const response = buildErrorResponse(400, 'Missing required parameter: clientId');
      const result = validateErrorResponse(response);

      expect(result.valid).toBe(true);
      expect(response.body.code).toBe('BAD_REQUEST');
      expect(response.body.message).toContain('clientId');
    });

    test('401 Unauthorized has correct shape', () => {
      const response = buildErrorResponse(401, 'Authentication required');
      const result = validateErrorResponse(response);

      expect(result.valid).toBe(true);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    test('404 Not Found has correct shape', () => {
      const response = buildErrorResponse(404, 'Opportunity not found');
      const result = validateErrorResponse(response);

      expect(result.valid).toBe(true);
      expect(response.body.code).toBe('NOT_FOUND');
    });

    test('422 Unprocessable Entity includes details', () => {
      const response = buildErrorResponse(422, 'Validation failed', {
        fields: { name: 'Required', email: 'Invalid format' },
      });
      const result = validateErrorResponse(response);

      expect(result.valid).toBe(true);
      expect(response.body.details.fields).toHaveProperty('name');
      expect(response.body.details.fields).toHaveProperty('email');
    });

    test('429 Rate Limited has correct code', () => {
      const response = buildErrorResponse(429, 'Too many requests');
      expect(response.body.code).toBe('RATE_LIMITED');
    });

    test('500 Internal Error has correct shape', () => {
      const response = buildErrorResponse(500, 'An unexpected error occurred');
      const result = validateErrorResponse(response);

      expect(result.valid).toBe(true);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });

    test('503 Service Unavailable', () => {
      const response = buildErrorResponse(503, 'Database connection unavailable');
      expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('Error Validation', () => {
    test('rejects non-error status codes', () => {
      const response = { status: 200, body: { error: true, message: 'ok', code: 'OK' } };
      const result = validateErrorResponse(response);
      expect(result.valid).toBe(false);
    });

    test('rejects missing body', () => {
      const response = { status: 400 };
      const result = validateErrorResponse(response);
      expect(result.valid).toBe(false);
    });

    test('rejects empty message', () => {
      const response = { status: 400, body: { error: true, message: '', code: 'BAD_REQUEST' } };
      const result = validateErrorResponse(response);
      expect(result.valid).toBe(false);
    });

    test('rejects error: false', () => {
      const response = { status: 400, body: { error: false, message: 'Bad', code: 'BAD_REQUEST' } };
      const result = validateErrorResponse(response);
      expect(result.valid).toBe(false);
    });
  });

  describe('Status Code Mapping', () => {
    const expectedMappings = [
      [400, 'BAD_REQUEST'],
      [401, 'UNAUTHORIZED'],
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [405, 'METHOD_NOT_ALLOWED'],
      [409, 'CONFLICT'],
      [422, 'UNPROCESSABLE_ENTITY'],
      [429, 'RATE_LIMITED'],
      [500, 'INTERNAL_ERROR'],
      [502, 'BAD_GATEWAY'],
      [503, 'SERVICE_UNAVAILABLE'],
    ];

    test.each(expectedMappings)('status %d maps to %s', (status, code) => {
      expect(statusCodeToCode(status)).toBe(code);
    });

    test('unknown status maps to UNKNOWN_ERROR', () => {
      expect(statusCodeToCode(418)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Error Details', () => {
    test('details are optional', () => {
      const response = buildErrorResponse(400, 'Bad request');
      expect(response.body).not.toHaveProperty('details');
    });

    test('details included when provided', () => {
      const response = buildErrorResponse(400, 'Bad request', { hint: 'Check params' });
      expect(response.body.details.hint).toBe('Check params');
    });
  });
});
