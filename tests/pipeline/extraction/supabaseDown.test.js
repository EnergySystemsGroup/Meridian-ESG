/**
 * Pipeline: Supabase Down / Error Resilience Tests
 *
 * Tests behavior when the database is unavailable or returns errors.
 * Ensures pipeline stages handle failures gracefully.
 */

import { describe, test, expect } from 'vitest';

/**
 * Simulate database error responses
 */
function createDbError(code, message, hint = null) {
  return {
    data: null,
    error: {
      code,
      message,
      hint,
    },
  };
}

const DB_ERRORS = {
  connectionRefused: createDbError('PGRST000', 'Connection refused'),
  timeout: createDbError('57014', 'Query cancelled due to timeout'),
  tableNotFound: createDbError('42P01', 'relation "funding_opportunities" does not exist'),
  permissionDenied: createDbError('42501', 'permission denied for table funding_opportunities'),
  uniqueViolation: createDbError('23505', 'duplicate key value violates unique constraint'),
  rlsPolicyViolation: createDbError('42501', 'new row violates row-level security policy'),
};

/**
 * Classify a database error for pipeline handling
 */
function classifyDbError(error) {
  if (!error) return { type: 'unknown', retryable: false };

  const code = error.code || '';

  if (code === 'PGRST000' || code === '57014' || code === '08000' || code === '08006') {
    return { type: 'connection', retryable: true, maxRetries: 3 };
  }

  if (code === '23505') {
    return { type: 'duplicate', retryable: false, action: 'skip' };
  }

  if (code.startsWith('42')) {
    return { type: 'permission_or_schema', retryable: false, action: 'abort' };
  }

  if (code === '23503') {
    return { type: 'foreign_key', retryable: false, action: 'log_and_skip' };
  }

  return { type: 'unknown', retryable: false };
}

/**
 * Retry logic for pipeline operations
 */
async function withRetry(fn, maxRetries = 3, delayMs = 100) {
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

/**
 * Process a batch with error handling
 */
function processBatchWithErrors(records, processOne) {
  const results = { succeeded: [], failed: [], skipped: [] };

  for (const record of records) {
    const outcome = processOne(record);
    if (outcome.error) {
      const classification = classifyDbError(outcome.error);
      if (classification.action === 'skip' || classification.type === 'duplicate') {
        results.skipped.push({ id: record.id, reason: classification.type });
      } else {
        results.failed.push({ id: record.id, error: outcome.error.message });
      }
    } else {
      results.succeeded.push(record.id);
    }
  }

  return results;
}

describe('Database Error Resilience', () => {

  describe('Error Classification', () => {
    test('connection errors are retryable', () => {
      const result = classifyDbError(DB_ERRORS.connectionRefused.error);
      expect(result.type).toBe('connection');
      expect(result.retryable).toBe(true);
    });

    test('timeout errors are retryable', () => {
      const result = classifyDbError(DB_ERRORS.timeout.error);
      expect(result.type).toBe('connection');
      expect(result.retryable).toBe(true);
    });

    test('duplicate errors are not retryable', () => {
      const result = classifyDbError(DB_ERRORS.uniqueViolation.error);
      expect(result.type).toBe('duplicate');
      expect(result.retryable).toBe(false);
      expect(result.action).toBe('skip');
    });

    test('permission errors cause abort', () => {
      const result = classifyDbError(DB_ERRORS.permissionDenied.error);
      expect(result.type).toBe('permission_or_schema');
      expect(result.retryable).toBe(false);
      expect(result.action).toBe('abort');
    });

    test('schema errors cause abort', () => {
      const result = classifyDbError(DB_ERRORS.tableNotFound.error);
      expect(result.type).toBe('permission_or_schema');
      expect(result.action).toBe('abort');
    });

    test('null error classified as unknown', () => {
      const result = classifyDbError(null);
      expect(result.type).toBe('unknown');
    });
  });

  describe('Batch Error Handling', () => {
    test('successful batch has all records in succeeded', () => {
      const records = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const results = processBatchWithErrors(records, () => ({ data: true, error: null }));

      expect(results.succeeded).toHaveLength(3);
      expect(results.failed).toHaveLength(0);
      expect(results.skipped).toHaveLength(0);
    });

    test('duplicates are skipped, not failed', () => {
      const records = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const results = processBatchWithErrors(records, (r) => {
        if (r.id === '2') return DB_ERRORS.uniqueViolation;
        return { data: true, error: null };
      });

      expect(results.succeeded).toHaveLength(2);
      expect(results.skipped).toHaveLength(1);
      expect(results.skipped[0].reason).toBe('duplicate');
      expect(results.failed).toHaveLength(0);
    });

    test('permission errors go to failed', () => {
      const records = [{ id: '1' }];
      const results = processBatchWithErrors(records, () => DB_ERRORS.permissionDenied);

      expect(results.failed).toHaveLength(1);
      expect(results.succeeded).toHaveLength(0);
    });

    test('mixed results tracked correctly', () => {
      const records = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
      const results = processBatchWithErrors(records, (r) => {
        if (r.id === '2') return DB_ERRORS.uniqueViolation;
        if (r.id === '4') return DB_ERRORS.permissionDenied;
        return { data: true, error: null };
      });

      expect(results.succeeded).toEqual(['1', '3']);
      expect(results.skipped).toHaveLength(1);
      expect(results.failed).toHaveLength(1);
    });
  });

  describe('Retry Logic', () => {
    test('succeeds on first try', async () => {
      let calls = 0;
      const result = await withRetry(() => { calls++; return 'ok'; }, 3, 1);

      expect(result).toBe('ok');
      expect(calls).toBe(1);
    });

    test('retries on failure', async () => {
      let calls = 0;
      const result = await withRetry(() => {
        calls++;
        if (calls < 3) throw new Error('retry');
        return 'ok';
      }, 3, 1);

      expect(result).toBe('ok');
      expect(calls).toBe(3);
    });

    test('throws after max retries', async () => {
      let calls = 0;
      await expect(
        withRetry(() => { calls++; throw new Error('always fail'); }, 3, 1)
      ).rejects.toThrow('always fail');
      expect(calls).toBe(3);
    });
  });

  describe('Error Response Shapes', () => {
    test('all predefined errors have correct structure', () => {
      for (const [name, errResponse] of Object.entries(DB_ERRORS)) {
        expect(errResponse.data).toBeNull();
        expect(errResponse.error).toHaveProperty('code');
        expect(errResponse.error).toHaveProperty('message');
        expect(typeof errResponse.error.message).toBe('string');
      }
    });
  });
});
