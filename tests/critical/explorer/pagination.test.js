/**
 * Explorer Pagination Tests
 *
 * Tests pagination logic for the opportunity explorer:
 * - Page size (9 items per page)
 * - Page navigation (prev/next)
 * - Total pages calculation
 * - Boundary conditions (first page, last page)
 * - Edge cases (empty results, partial last page)
 */

import { describe, test, expect } from 'vitest';

const PAGE_SIZE = 9;

/**
 * Calculate pagination metadata
 */
function calculatePagination(totalItems, currentPage = 1, pageSize = PAGE_SIZE) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const validPage = Math.max(1, Math.min(currentPage, totalPages || 1));

  return {
    currentPage: validPage,
    totalPages,
    totalItems,
    pageSize,
    hasNextPage: validPage < totalPages,
    hasPrevPage: validPage > 1,
    startIndex: (validPage - 1) * pageSize,
    endIndex: Math.min(validPage * pageSize, totalItems),
  };
}

/**
 * Get page of items
 */
function getPage(items, page = 1, pageSize = PAGE_SIZE) {
  const pagination = calculatePagination(items.length, page, pageSize);
  const pageItems = items.slice(pagination.startIndex, pagination.endIndex);

  return {
    items: pageItems,
    pagination,
  };
}

describe('Explorer Pagination', () => {

  describe('Pagination Calculation', () => {
    test('calculates correct total pages', () => {
      expect(calculatePagination(27).totalPages).toBe(3); // Exactly 3 pages
      expect(calculatePagination(28).totalPages).toBe(4); // 1 extra item
      expect(calculatePagination(9).totalPages).toBe(1);  // Exactly 1 page
      expect(calculatePagination(8).totalPages).toBe(1);  // Less than 1 page
      expect(calculatePagination(0).totalPages).toBe(0);  // Empty
    });

    test('calculates start and end indices', () => {
      const page1 = calculatePagination(25, 1);
      expect(page1.startIndex).toBe(0);
      expect(page1.endIndex).toBe(9);

      const page2 = calculatePagination(25, 2);
      expect(page2.startIndex).toBe(9);
      expect(page2.endIndex).toBe(18);

      const page3 = calculatePagination(25, 3);
      expect(page3.startIndex).toBe(18);
      expect(page3.endIndex).toBe(25); // Partial page
    });

    test('has correct next/prev page flags', () => {
      const page1 = calculatePagination(27, 1);
      expect(page1.hasPrevPage).toBe(false);
      expect(page1.hasNextPage).toBe(true);

      const page2 = calculatePagination(27, 2);
      expect(page2.hasPrevPage).toBe(true);
      expect(page2.hasNextPage).toBe(true);

      const page3 = calculatePagination(27, 3);
      expect(page3.hasPrevPage).toBe(true);
      expect(page3.hasNextPage).toBe(false);
    });
  });

  describe('Page Retrieval', () => {
    const testItems = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

    test('returns correct items for page 1', () => {
      const result = getPage(testItems, 1);

      expect(result.items).toHaveLength(9);
      expect(result.items[0].id).toBe(1);
      expect(result.items[8].id).toBe(9);
    });

    test('returns correct items for page 2', () => {
      const result = getPage(testItems, 2);

      expect(result.items).toHaveLength(9);
      expect(result.items[0].id).toBe(10);
      expect(result.items[8].id).toBe(18);
    });

    test('returns correct items for last page (partial)', () => {
      const result = getPage(testItems, 3);

      expect(result.items).toHaveLength(7); // 25 - 18 = 7
      expect(result.items[0].id).toBe(19);
      expect(result.items[6].id).toBe(25);
    });

    test('includes pagination metadata', () => {
      const result = getPage(testItems, 2);

      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.totalItems).toBe(25);
    });
  });

  describe('Page Navigation', () => {
    test('validates page is within bounds', () => {
      const lowPage = calculatePagination(27, 0);
      expect(lowPage.currentPage).toBe(1); // Clamped to 1

      const highPage = calculatePagination(27, 10);
      expect(highPage.currentPage).toBe(3); // Clamped to max
    });

    test('handles negative page numbers', () => {
      const result = calculatePagination(27, -5);
      expect(result.currentPage).toBe(1);
    });

    test('sequential navigation visits all items', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      const allIds = new Set();

      for (let page = 1; page <= 3; page++) {
        const result = getPage(items, page);
        result.items.forEach(item => allIds.add(item.id));
      }

      expect(allIds.size).toBe(25);
    });
  });

  describe('Empty Results', () => {
    test('handles empty array', () => {
      const result = getPage([], 1);

      expect(result.items).toHaveLength(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(false);
    });

    test('handles page beyond empty results', () => {
      const result = getPage([], 5);

      expect(result.items).toHaveLength(0);
      expect(result.pagination.currentPage).toBe(1); // Clamped
    });
  });

  describe('Single Page', () => {
    test('handles exactly one page', () => {
      const items = Array.from({ length: 9 }, (_, i) => ({ id: i + 1 }));
      const result = getPage(items, 1);

      expect(result.items).toHaveLength(9);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(false);
    });

    test('handles less than one page', () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
      const result = getPage(items, 1);

      expect(result.items).toHaveLength(5);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    test('handles single item', () => {
      const items = [{ id: 1 }];
      const result = getPage(items, 1);

      expect(result.items).toHaveLength(1);
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe('Custom Page Size', () => {
    test('respects custom page size', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      const result = getPage(items, 1, 10);

      expect(result.items).toHaveLength(10);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.totalPages).toBe(3);
    });

    test('handles page size of 1', () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
      const result = getPage(items, 3, 1);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(3);
      expect(result.pagination.totalPages).toBe(5);
    });

    test('handles page size larger than total items', () => {
      const items = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
      const result = getPage(items, 1, 100);

      expect(result.items).toHaveLength(5);
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe('Boundary Conditions', () => {
    test('last item is on correct page', () => {
      const items = Array.from({ length: 27 }, (_, i) => ({ id: i + 1 }));

      // 27 items / 9 per page = 3 pages
      // Page 3 should have items 19-27 (9 items)
      const page3 = getPage(items, 3);
      expect(page3.items.find(i => i.id === 27)).toBeDefined();
    });

    test('first item of each page is correct', () => {
      const items = Array.from({ length: 27 }, (_, i) => ({ id: i + 1 }));

      expect(getPage(items, 1).items[0].id).toBe(1);
      expect(getPage(items, 2).items[0].id).toBe(10);
      expect(getPage(items, 3).items[0].id).toBe(19);
    });

    test('page count matches item count', () => {
      const items = Array.from({ length: 27 }, (_, i) => ({ id: i + 1 }));
      let totalItemsReturned = 0;

      for (let page = 1; page <= 3; page++) {
        totalItemsReturned += getPage(items, page).items.length;
      }

      expect(totalItemsReturned).toBe(27);
    });
  });

  describe('Real-World Scenarios', () => {
    test('handles large dataset', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 }));
      const result = getPage(items, 50);

      expect(result.pagination.totalPages).toBe(112); // ceil(1000/9)
      expect(result.items).toHaveLength(9);
      expect(result.items[0].id).toBe(442); // (50-1)*9 + 1
    });

    test('pagination state changes correctly on navigation', () => {
      const items = Array.from({ length: 27 }, (_, i) => ({ id: i + 1 }));

      // Start on page 1
      let state = getPage(items, 1);
      expect(state.pagination.currentPage).toBe(1);
      expect(state.pagination.hasPrevPage).toBe(false);
      expect(state.pagination.hasNextPage).toBe(true);

      // Navigate to page 2
      state = getPage(items, state.pagination.currentPage + 1);
      expect(state.pagination.currentPage).toBe(2);
      expect(state.pagination.hasPrevPage).toBe(true);
      expect(state.pagination.hasNextPage).toBe(true);

      // Navigate to last page
      state = getPage(items, state.pagination.currentPage + 1);
      expect(state.pagination.currentPage).toBe(3);
      expect(state.pagination.hasPrevPage).toBe(true);
      expect(state.pagination.hasNextPage).toBe(false);
    });

    test('filtering reduces pagination', () => {
      const items = Array.from({ length: 27 }, (_, i) => ({
        id: i + 1,
        category: i % 3 === 0 ? 'A' : 'B',
      }));

      // All items: 3 pages
      const allResult = getPage(items, 1);
      expect(allResult.pagination.totalPages).toBe(3);

      // Filtered items (category A): 1 page
      const filtered = items.filter(i => i.category === 'A');
      const filteredResult = getPage(filtered, 1);
      expect(filteredResult.pagination.totalPages).toBe(1);
      expect(filteredResult.items).toHaveLength(9);
    });
  });
});
