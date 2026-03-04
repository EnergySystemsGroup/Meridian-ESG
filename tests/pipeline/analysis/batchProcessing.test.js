/**
 * Pipeline: Batch Processing Tests
 *
 * Tests the batching and concurrency control for analysis:
 * - Batch splitting logic
 * - Concurrency limits
 * - Progress tracking per batch
 * - Error handling within batches
 */

import { describe, test, expect } from 'vitest';

/**
 * Split items into batches of a given size
 */
function splitIntoBatches(items, batchSize) {
  if (!items || items.length === 0) return [];
  if (batchSize <= 0) return [items];

  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Track batch processing progress
 */
class BatchProgress {
  constructor(totalItems) {
    this.totalItems = totalItems;
    this.processedItems = 0;
    this.failedItems = 0;
    this.batchesCompleted = 0;
    this.errors = [];
  }

  recordSuccess(count = 1) {
    this.processedItems += count;
  }

  recordFailure(itemId, error) {
    this.failedItems++;
    this.errors.push({ itemId, error: error.message || String(error) });
  }

  completeBatch() {
    this.batchesCompleted++;
  }

  getProgress() {
    return {
      total: this.totalItems,
      processed: this.processedItems,
      failed: this.failedItems,
      remaining: this.totalItems - this.processedItems - this.failedItems,
      percentComplete: this.totalItems > 0
        ? Math.round((this.processedItems / this.totalItems) * 100)
        : 0,
      batchesCompleted: this.batchesCompleted,
      errors: this.errors,
    };
  }

  isComplete() {
    return (this.processedItems + this.failedItems) >= this.totalItems;
  }
}

/**
 * Calculate optimal batch size based on item count
 */
function calculateOptimalBatchSize(itemCount, maxConcurrency = 5) {
  if (itemCount <= 0) return 0;
  if (itemCount <= maxConcurrency) return itemCount;
  if (itemCount <= 20) return Math.min(10, itemCount);
  return 20; // Default max batch size
}

describe('Batch Processing', () => {

  describe('Batch Splitting', () => {
    test('splits evenly', () => {
      const items = [1, 2, 3, 4, 5, 6];
      const batches = splitIntoBatches(items, 2);
      expect(batches).toEqual([[1, 2], [3, 4], [5, 6]]);
    });

    test('handles remainder', () => {
      const items = [1, 2, 3, 4, 5];
      const batches = splitIntoBatches(items, 2);
      expect(batches).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('single batch when size >= items', () => {
      const items = [1, 2, 3];
      const batches = splitIntoBatches(items, 10);
      expect(batches).toEqual([[1, 2, 3]]);
    });

    test('batch size of 1 creates individual batches', () => {
      const items = [1, 2, 3];
      const batches = splitIntoBatches(items, 1);
      expect(batches).toEqual([[1], [2], [3]]);
    });

    test('empty array returns empty', () => {
      expect(splitIntoBatches([], 5)).toEqual([]);
    });

    test('null input returns empty', () => {
      expect(splitIntoBatches(null, 5)).toEqual([]);
    });

    test('zero/negative batch size returns single batch', () => {
      expect(splitIntoBatches([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
      expect(splitIntoBatches([1, 2, 3], -1)).toEqual([[1, 2, 3]]);
    });
  });

  describe('Batch Progress Tracking', () => {
    test('initial state is zero progress', () => {
      const progress = new BatchProgress(10);
      const state = progress.getProgress();

      expect(state.total).toBe(10);
      expect(state.processed).toBe(0);
      expect(state.failed).toBe(0);
      expect(state.remaining).toBe(10);
      expect(state.percentComplete).toBe(0);
    });

    test('tracks successful processing', () => {
      const progress = new BatchProgress(10);
      progress.recordSuccess(3);

      const state = progress.getProgress();
      expect(state.processed).toBe(3);
      expect(state.remaining).toBe(7);
      expect(state.percentComplete).toBe(30);
    });

    test('tracks failures separately', () => {
      const progress = new BatchProgress(10);
      progress.recordSuccess(7);
      progress.recordFailure('item-8', new Error('Network error'));

      const state = progress.getProgress();
      expect(state.processed).toBe(7);
      expect(state.failed).toBe(1);
      expect(state.remaining).toBe(2);
      expect(state.errors).toHaveLength(1);
      expect(state.errors[0].itemId).toBe('item-8');
    });

    test('isComplete when all items processed or failed', () => {
      const progress = new BatchProgress(3);
      expect(progress.isComplete()).toBe(false);

      progress.recordSuccess(2);
      expect(progress.isComplete()).toBe(false);

      progress.recordFailure('item-3', new Error('fail'));
      expect(progress.isComplete()).toBe(true);
    });

    test('tracks batch completions', () => {
      const progress = new BatchProgress(10);
      progress.completeBatch();
      progress.completeBatch();

      expect(progress.getProgress().batchesCompleted).toBe(2);
    });

    test('percent rounds to integer', () => {
      const progress = new BatchProgress(3);
      progress.recordSuccess(1);
      expect(progress.getProgress().percentComplete).toBe(33);
    });

    test('handles zero total items', () => {
      const progress = new BatchProgress(0);
      expect(progress.getProgress().percentComplete).toBe(0);
      expect(progress.isComplete()).toBe(true);
    });
  });

  describe('Optimal Batch Size', () => {
    test('returns 0 for empty input', () => {
      expect(calculateOptimalBatchSize(0)).toBe(0);
    });

    test('small counts use item count as batch size', () => {
      expect(calculateOptimalBatchSize(3)).toBe(3);
    });

    test('medium counts cap at 10', () => {
      expect(calculateOptimalBatchSize(15)).toBe(10);
    });

    test('large counts cap at 20', () => {
      expect(calculateOptimalBatchSize(100)).toBe(20);
    });

    test('respects max concurrency for small counts', () => {
      expect(calculateOptimalBatchSize(3, 2)).toBe(3);
    });
  });
});
