/**
 * Pipeline: Extraction Pagination Tests
 *
 * Tests cursor-based and offset-based pagination:
 * - Page tracking
 * - Determining when to stop
 * - Building next-page requests
 * - Deduplication across pages
 */

import { describe, test, expect } from 'vitest';

/**
 * Offset-based pagination tracker
 */
class OffsetPaginator {
  constructor(pageSize = 25, maxPages = 10) {
    this.pageSize = pageSize;
    this.maxPages = maxPages;
    this.currentPage = 0;
    this.totalItems = null;
    this.seenIds = new Set();
  }

  getNextParams() {
    return {
      offset: this.currentPage * this.pageSize,
      limit: this.pageSize,
    };
  }

  processPage(items, totalFromResponse) {
    this.currentPage++;
    if (totalFromResponse != null) {
      this.totalItems = totalFromResponse;
    }

    // Track IDs for deduplication
    const newItems = [];
    for (const item of items) {
      if (item.id && !this.seenIds.has(item.id)) {
        this.seenIds.add(item.id);
        newItems.push(item);
      } else if (!item.id) {
        newItems.push(item); // Can't dedup without ID
      }
    }

    return newItems;
  }

  hasMore() {
    if (this.currentPage >= this.maxPages) return false;
    if (this.totalItems != null) {
      return this.currentPage * this.pageSize < this.totalItems;
    }
    return true; // Assume more if we don't know total
  }
}

/**
 * Cursor-based pagination tracker
 */
class CursorPaginator {
  constructor(maxPages = 10) {
    this.maxPages = maxPages;
    this.currentPage = 0;
    this.nextCursor = null;
    this.seenIds = new Set();
  }

  getNextParams() {
    const params = {};
    if (this.nextCursor) {
      params.cursor = this.nextCursor;
    }
    return params;
  }

  processPage(items, nextCursor) {
    this.currentPage++;
    this.nextCursor = nextCursor || null;

    const newItems = [];
    for (const item of items) {
      if (item.id && !this.seenIds.has(item.id)) {
        this.seenIds.add(item.id);
        newItems.push(item);
      } else if (!item.id) {
        newItems.push(item);
      }
    }

    return newItems;
  }

  hasMore() {
    if (this.currentPage >= this.maxPages) return false;
    return this.nextCursor != null;
  }
}

describe('Extraction Pagination', () => {

  describe('Offset Paginator', () => {
    test('first page starts at offset 0', () => {
      const pag = new OffsetPaginator(25);
      expect(pag.getNextParams()).toEqual({ offset: 0, limit: 25 });
    });

    test('second page has correct offset', () => {
      const pag = new OffsetPaginator(25);
      pag.processPage([{ id: '1' }], 100);
      expect(pag.getNextParams()).toEqual({ offset: 25, limit: 25 });
    });

    test('hasMore when more items exist', () => {
      const pag = new OffsetPaginator(10);
      pag.processPage(Array(10).fill({ id: '1' }), 25);
      expect(pag.hasMore()).toBe(true);
    });

    test('stops when reached total', () => {
      const pag = new OffsetPaginator(10);
      pag.processPage(Array(10).fill({}), 10);
      expect(pag.hasMore()).toBe(false);
    });

    test('stops at maxPages', () => {
      const pag = new OffsetPaginator(10, 2);
      pag.processPage(Array(10).fill({}), 100);
      pag.processPage(Array(10).fill({}), 100);
      expect(pag.hasMore()).toBe(false);
    });

    test('deduplicates items by ID', () => {
      const pag = new OffsetPaginator(10);
      const page1 = pag.processPage([{ id: '1' }, { id: '2' }], 10);
      const page2 = pag.processPage([{ id: '2' }, { id: '3' }], 10);

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1); // id=2 already seen
      expect(page2[0].id).toBe('3');
    });

    test('items without ID are not deduped', () => {
      const pag = new OffsetPaginator(10);
      const page1 = pag.processPage([{ name: 'A' }, { name: 'A' }], 10);
      expect(page1).toHaveLength(2);
    });
  });

  describe('Cursor Paginator', () => {
    test('first page has no cursor', () => {
      const pag = new CursorPaginator();
      expect(pag.getNextParams()).toEqual({});
    });

    test('second page includes cursor', () => {
      const pag = new CursorPaginator();
      pag.processPage([{ id: '1' }], 'cursor-abc');
      expect(pag.getNextParams()).toEqual({ cursor: 'cursor-abc' });
    });

    test('hasMore when cursor provided', () => {
      const pag = new CursorPaginator();
      pag.processPage([], 'next-page');
      expect(pag.hasMore()).toBe(true);
    });

    test('stops when no cursor', () => {
      const pag = new CursorPaginator();
      pag.processPage([], null);
      expect(pag.hasMore()).toBe(false);
    });

    test('stops at maxPages', () => {
      const pag = new CursorPaginator(2);
      pag.processPage([], 'cursor-1');
      pag.processPage([], 'cursor-2');
      expect(pag.hasMore()).toBe(false);
    });

    test('deduplicates across pages', () => {
      const pag = new CursorPaginator();
      const page1 = pag.processPage([{ id: 'a' }, { id: 'b' }], 'next');
      const page2 = pag.processPage([{ id: 'b' }, { id: 'c' }], null);

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
    });
  });
});
