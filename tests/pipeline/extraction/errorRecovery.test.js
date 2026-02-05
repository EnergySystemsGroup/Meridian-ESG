/**
 * Pipeline: Extraction Error Recovery Tests
 *
 * Tests error handling and recovery in extraction:
 * - Network timeout handling
 * - Rate limiting and backoff
 * - Partial failure recovery
 * - Error classification
 *
 * NOTE: Error recovery is critical for pipeline reliability.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Error types for classification
 */
const ERROR_TYPES = {
  NETWORK: 'network',
  RATE_LIMIT: 'rate_limit',
  AUTH: 'auth',
  NOT_FOUND: 'not_found',
  SERVER: 'server',
  PARSE: 'parse',
  UNKNOWN: 'unknown',
};

/**
 * Classify error for appropriate handling
 */
function classifyError(error) {
  const message = error?.message?.toLowerCase() || '';
  const code = error?.code;
  const status = error?.status || error?.statusCode;

  // Network errors
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') {
    return ERROR_TYPES.NETWORK;
  }
  if (message.includes('network') || message.includes('timeout') || message.includes('socket')) {
    return ERROR_TYPES.NETWORK;
  }

  // Rate limiting
  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return ERROR_TYPES.RATE_LIMIT;
  }

  // Auth errors
  if (status === 401 || status === 403) {
    return ERROR_TYPES.AUTH;
  }

  // Not found
  if (status === 404) {
    return ERROR_TYPES.NOT_FOUND;
  }

  // Server errors
  if (status >= 500 && status < 600) {
    return ERROR_TYPES.SERVER;
  }

  // Parse errors
  if (message.includes('json') || message.includes('parse') || message.includes('syntax')) {
    return ERROR_TYPES.PARSE;
  }

  return ERROR_TYPES.UNKNOWN;
}

/**
 * Determine if error is retryable
 */
function isRetryable(errorType) {
  const retryableTypes = [
    ERROR_TYPES.NETWORK,
    ERROR_TYPES.RATE_LIMIT,
    ERROR_TYPES.SERVER,
  ];
  return retryableTypes.includes(errorType);
}

/**
 * Calculate backoff delay for retry
 */
function calculateBackoff(attempt, errorType, options = {}) {
  const { baseDelay = 1000, maxDelay = 60000 } = options;

  // Rate limit errors get longer base delay
  const multiplier = errorType === ERROR_TYPES.RATE_LIMIT ? 2 : 1;

  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt) * multiplier;
  const jitter = Math.random() * 0.3 * exponentialDelay;

  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Mock extraction with retry logic
 */
async function extractWithRetry(fetchFn, url, options = {}) {
  const { maxRetries = 3, onRetry = () => {} } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn(url);
    } catch (error) {
      lastError = error;
      const errorType = classifyError(error);

      if (!isRetryable(errorType) || attempt === maxRetries) {
        throw error;
      }

      const delay = calculateBackoff(attempt, errorType, options);
      onRetry({ attempt, error, errorType, delay });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Process batch with partial failure handling
 */
async function processBatchWithRecovery(items, processFn) {
  const results = {
    successful: [],
    failed: [],
  };

  for (const item of items) {
    try {
      const result = await processFn(item);
      results.successful.push({ item, result });
    } catch (error) {
      results.failed.push({
        item,
        error: error.message,
        errorType: classifyError(error),
      });
    }
  }

  return results;
}

describe('Pipeline: Extraction Error Recovery', () => {

  describe('Error Classification', () => {
    test('classifies network timeout', () => {
      const error = { code: 'ETIMEDOUT', message: 'Connection timed out' };
      expect(classifyError(error)).toBe(ERROR_TYPES.NETWORK);
    });

    test('classifies connection refused', () => {
      const error = { code: 'ECONNREFUSED' };
      expect(classifyError(error)).toBe(ERROR_TYPES.NETWORK);
    });

    test('classifies DNS not found', () => {
      const error = { code: 'ENOTFOUND' };
      expect(classifyError(error)).toBe(ERROR_TYPES.NETWORK);
    });

    test('classifies rate limit by status', () => {
      const error = { status: 429 };
      expect(classifyError(error)).toBe(ERROR_TYPES.RATE_LIMIT);
    });

    test('classifies rate limit by message', () => {
      const error = { message: 'Rate limit exceeded' };
      expect(classifyError(error)).toBe(ERROR_TYPES.RATE_LIMIT);
    });

    test('classifies auth errors', () => {
      expect(classifyError({ status: 401 })).toBe(ERROR_TYPES.AUTH);
      expect(classifyError({ status: 403 })).toBe(ERROR_TYPES.AUTH);
    });

    test('classifies not found', () => {
      const error = { status: 404 };
      expect(classifyError(error)).toBe(ERROR_TYPES.NOT_FOUND);
    });

    test('classifies server errors', () => {
      expect(classifyError({ status: 500 })).toBe(ERROR_TYPES.SERVER);
      expect(classifyError({ status: 502 })).toBe(ERROR_TYPES.SERVER);
      expect(classifyError({ status: 503 })).toBe(ERROR_TYPES.SERVER);
    });

    test('classifies parse errors', () => {
      const error = { message: 'Unexpected token in JSON' };
      expect(classifyError(error)).toBe(ERROR_TYPES.PARSE);
    });

    test('classifies unknown errors', () => {
      const error = { message: 'Something weird happened' };
      expect(classifyError(error)).toBe(ERROR_TYPES.UNKNOWN);
    });

    test('handles null/undefined error', () => {
      expect(classifyError(null)).toBe(ERROR_TYPES.UNKNOWN);
      expect(classifyError(undefined)).toBe(ERROR_TYPES.UNKNOWN);
    });
  });

  describe('Retryability', () => {
    test('network errors are retryable', () => {
      expect(isRetryable(ERROR_TYPES.NETWORK)).toBe(true);
    });

    test('rate limit errors are retryable', () => {
      expect(isRetryable(ERROR_TYPES.RATE_LIMIT)).toBe(true);
    });

    test('server errors are retryable', () => {
      expect(isRetryable(ERROR_TYPES.SERVER)).toBe(true);
    });

    test('auth errors are NOT retryable', () => {
      expect(isRetryable(ERROR_TYPES.AUTH)).toBe(false);
    });

    test('not found errors are NOT retryable', () => {
      expect(isRetryable(ERROR_TYPES.NOT_FOUND)).toBe(false);
    });

    test('parse errors are NOT retryable', () => {
      expect(isRetryable(ERROR_TYPES.PARSE)).toBe(false);
    });

    test('unknown errors are NOT retryable', () => {
      expect(isRetryable(ERROR_TYPES.UNKNOWN)).toBe(false);
    });
  });

  describe('Backoff Calculation', () => {
    test('increases delay with attempts', () => {
      const delay0 = calculateBackoff(0, ERROR_TYPES.NETWORK, { baseDelay: 1000 });
      const delay1 = calculateBackoff(1, ERROR_TYPES.NETWORK, { baseDelay: 1000 });
      const delay2 = calculateBackoff(2, ERROR_TYPES.NETWORK, { baseDelay: 1000 });

      // Remove jitter for comparison (delays should trend upward)
      expect(delay1).toBeGreaterThan(delay0 * 0.7);
      expect(delay2).toBeGreaterThan(delay1 * 0.7);
    });

    test('respects max delay', () => {
      const delay = calculateBackoff(10, ERROR_TYPES.NETWORK, {
        baseDelay: 1000,
        maxDelay: 60000,
      });

      expect(delay).toBeLessThanOrEqual(60000);
    });

    test('rate limit errors have longer delays', () => {
      const networkDelay = calculateBackoff(1, ERROR_TYPES.NETWORK, { baseDelay: 1000 });
      const rateLimitDelay = calculateBackoff(1, ERROR_TYPES.RATE_LIMIT, { baseDelay: 1000 });

      // Rate limit should be ~2x (with some jitter tolerance)
      expect(rateLimitDelay).toBeGreaterThan(networkDelay * 1.3);
    });

    test('includes jitter for distributed retry', () => {
      const delays = Array(10)
        .fill(0)
        .map(() => calculateBackoff(1, ERROR_TYPES.NETWORK, { baseDelay: 1000 }));

      // Not all delays should be identical (jitter added)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('Retry Logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('succeeds on first try without retry', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ data: 'success' });

      const resultPromise = extractWithRetry(mockFetch, 'https://api.example.com');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.data).toBe('success');
    });

    test('retries on network error', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValue({ data: 'success' });

      const resultPromise = extractWithRetry(mockFetch, 'https://api.example.com', {
        baseDelay: 10,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toBe('success');
    });

    test('gives up after max retries', async () => {
      const mockFetch = vi.fn().mockRejectedValue({ status: 500 });

      let caughtError = null;
      const resultPromise = extractWithRetry(mockFetch, 'https://api.example.com', {
        maxRetries: 2,
        baseDelay: 10,
      }).catch(err => {
        caughtError = err;
      });

      await vi.runAllTimersAsync();
      await resultPromise;

      expect(caughtError).toEqual({ status: 500 });
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test('does not retry non-retryable errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue({ status: 404 });

      let caughtError = null;
      const resultPromise = extractWithRetry(mockFetch, 'https://api.example.com', {
        maxRetries: 3,
        baseDelay: 10,
      }).catch(err => {
        caughtError = err;
      });

      await resultPromise;

      expect(caughtError).toEqual({ status: 404 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('calls onRetry callback', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValue({ data: 'success' });

      const onRetry = vi.fn();

      const resultPromise = extractWithRetry(mockFetch, 'https://api.example.com', {
        baseDelay: 10,
        onRetry,
      });

      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 0,
          errorType: ERROR_TYPES.NETWORK,
        })
      );
    });
  });

  describe('Batch Recovery', () => {
    test('processes successful items', async () => {
      const items = ['a', 'b', 'c'];
      const processFn = vi.fn().mockImplementation(item => `processed-${item}`);

      const results = await processBatchWithRecovery(items, processFn);

      expect(results.successful.length).toBe(3);
      expect(results.failed.length).toBe(0);
    });

    test('continues after failures', async () => {
      const items = ['a', 'b', 'c'];
      const processFn = vi.fn().mockImplementation(item => {
        if (item === 'b') throw new Error('Failed on b');
        return `processed-${item}`;
      });

      const results = await processBatchWithRecovery(items, processFn);

      expect(results.successful.length).toBe(2);
      expect(results.failed.length).toBe(1);
      expect(results.failed[0].item).toBe('b');
    });

    test('captures error details for failed items', async () => {
      const items = ['a'];
      const processFn = vi.fn().mockRejectedValue({ status: 429, message: 'Rate limit exceeded' });

      const results = await processBatchWithRecovery(items, processFn);

      expect(results.failed[0].errorType).toBe(ERROR_TYPES.RATE_LIMIT);
    });

    test('handles empty batch', async () => {
      const results = await processBatchWithRecovery([], vi.fn());

      expect(results.successful.length).toBe(0);
      expect(results.failed.length).toBe(0);
    });

    test('handles all failures', async () => {
      const items = ['a', 'b', 'c'];
      const processFn = vi.fn().mockRejectedValue(new Error('All fail'));

      const results = await processBatchWithRecovery(items, processFn);

      expect(results.successful.length).toBe(0);
      expect(results.failed.length).toBe(3);
    });
  });

  describe('Error Response Structure', () => {
    test('failed result includes item reference', async () => {
      const items = [{ id: 'item-1', url: 'https://example.com' }];
      const processFn = vi.fn().mockRejectedValue(new Error('Failed'));

      const results = await processBatchWithRecovery(items, processFn);

      expect(results.failed[0].item).toEqual(items[0]);
    });

    test('failed result includes error message', async () => {
      const items = ['a'];
      const processFn = vi.fn().mockRejectedValue(new Error('Specific error message'));

      const results = await processBatchWithRecovery(items, processFn);

      expect(results.failed[0].error).toBe('Specific error message');
    });

    test('successful result includes original item and processed result', async () => {
      const items = [{ id: 1 }];
      const processFn = vi.fn().mockResolvedValue({ processed: true });

      const results = await processBatchWithRecovery(items, processFn);

      expect(results.successful[0].item).toEqual({ id: 1 });
      expect(results.successful[0].result).toEqual({ processed: true });
    });
  });
});
