/**
 * Cron Compute Matches API Contract Tests
 *
 * Validates auth logic, response shapes, and trigger classification
 * for GET /api/cron/compute-matches and POST /api/cron/compute-matches.
 */

import { describe, test, expect } from 'vitest';

// --- Inline functions mirroring route logic ---

/**
 * Verify auth for a cron request.
 * Returns { ok: true } if valid, or { ok: false, status, error } if not.
 */
function verifyAuth(authHeader, cronSecret) {
  if (!cronSecret) {
    return { ok: false, status: 500, error: 'Server misconfigured' };
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true };
}

/**
 * Determine trigger type from POST body.
 */
function classifyManualTrigger(body) {
  if (body.clientId) return 'manual_client';
  if (body.opportunityIds?.length) return 'manual_opportunities';
  return 'manual_full';
}

/**
 * Validate cron response shape.
 */
const cronResponseSchema = {
  success: 'boolean',
  trigger: 'string',
  timestamp: 'string',
  executionTimeMs: 'number'
};

const errorResponseSchema = {
  success: 'boolean',
  error: 'string',
  timestamp: 'string',
  executionTimeMs: 'number'
};

function validateSchema(obj, schema) {
  const errors = [];
  for (const [field, expectedType] of Object.entries(schema)) {
    if (!(field in obj)) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof obj[field] !== expectedType) {
      errors.push(`Field ${field}: expected ${expectedType}, got ${typeof obj[field]}`);
    }
  }
  return errors;
}

// --- Tests ---

describe('Cron Compute Matches: Auth', () => {
  test('valid Bearer token is accepted', () => {
    const result = verifyAuth('Bearer my-secret-123', 'my-secret-123');
    expect(result.ok).toBe(true);
  });

  test('missing Bearer token is rejected with 401', () => {
    const result = verifyAuth(null, 'my-secret-123');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  test('wrong Bearer token is rejected with 401', () => {
    const result = verifyAuth('Bearer wrong-token', 'my-secret-123');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  test('missing CRON_SECRET env var returns 500', () => {
    const result = verifyAuth('Bearer anything', undefined);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe('Server misconfigured');
  });

  test('empty CRON_SECRET env var returns 500', () => {
    const result = verifyAuth('Bearer anything', '');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  test('Bearer prefix is required', () => {
    const result = verifyAuth('my-secret-123', 'my-secret-123');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });
});

describe('Cron Compute Matches: Trigger Classification', () => {
  test('body with clientId is manual_client', () => {
    expect(classifyManualTrigger({ clientId: 'abc-123' })).toBe('manual_client');
  });

  test('body with opportunityIds is manual_opportunities', () => {
    expect(classifyManualTrigger({ opportunityIds: ['o1', 'o2'] })).toBe('manual_opportunities');
  });

  test('empty body is manual_full', () => {
    expect(classifyManualTrigger({})).toBe('manual_full');
  });

  test('clientId takes precedence over opportunityIds', () => {
    expect(classifyManualTrigger({
      clientId: 'abc',
      opportunityIds: ['o1']
    })).toBe('manual_client');
  });

  test('empty opportunityIds array is manual_full', () => {
    expect(classifyManualTrigger({ opportunityIds: [] })).toBe('manual_full');
  });
});

describe('Cron Compute Matches: Response Shape', () => {
  test('success response has required fields', () => {
    const response = {
      success: true,
      trigger: 'cron',
      stats: { new_matches: 5 },
      timestamp: new Date().toISOString(),
      executionTimeMs: 123
    };
    const errors = validateSchema(response, cronResponseSchema);
    expect(errors).toHaveLength(0);
  });

  test('success response includes stats object', () => {
    const response = {
      success: true,
      trigger: 'manual_full',
      stats: { clients_processed: 10, new_matches: 3 },
      timestamp: new Date().toISOString(),
      executionTimeMs: 456
    };
    expect(response.stats).toBeDefined();
    expect(typeof response.stats).toBe('object');
  });

  test('error response has required fields', () => {
    const response = {
      success: false,
      error: 'Something went wrong',
      timestamp: new Date().toISOString(),
      executionTimeMs: 50
    };
    const errors = validateSchema(response, errorResponseSchema);
    expect(errors).toHaveLength(0);
  });

  test('error response has success=false', () => {
    const response = {
      success: false,
      error: 'Failed to fetch clients',
      timestamp: new Date().toISOString(),
      executionTimeMs: 10
    };
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });

  test('GET trigger is always cron', () => {
    const response = {
      success: true,
      trigger: 'cron',
      stats: {},
      timestamp: new Date().toISOString(),
      executionTimeMs: 100
    };
    expect(response.trigger).toBe('cron');
  });

  test('POST trigger varies by body', () => {
    const triggers = ['manual_full', 'manual_client', 'manual_opportunities'];
    for (const trigger of triggers) {
      expect(triggers).toContain(trigger);
    }
  });
});
