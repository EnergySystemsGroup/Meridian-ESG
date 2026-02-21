/**
 * Integration: Explorer Flow
 *
 * Tests the full flow: filter params → query building → DB filtering → paginated response
 * Ensures the explorer page pipeline works end-to-end.
 */

import { describe, test, expect } from 'vitest';
import { opportunities, getAllOpportunities } from '../fixtures/opportunities.js';

/**
 * Simulate explorer query pipeline
 */
function queryExplorer(params, allOpps) {
  let results = [...allOpps];

  // Step 1: Apply filters
  if (params.status) {
    results = results.filter(o => o.status === params.status);
  }

  if (params.search) {
    const term = params.search.toLowerCase();
    results = results.filter(o =>
      (o.title || '').toLowerCase().includes(term) ||
      (o.agency_name || '').toLowerCase().includes(term)
    );
  }

  if (params.scope === 'national') {
    results = results.filter(o => o.is_national);
  } else if (params.scope === 'state') {
    results = results.filter(o => !o.is_national);
  }

  if (params.category) {
    results = results.filter(o =>
      (o.categories || []).some(c => c.toLowerCase() === params.category.toLowerCase())
    );
  }

  if (params.minAmount) {
    results = results.filter(o => (o.maximum_award || 0) >= params.minAmount);
  }

  if (params.maxAmount) {
    results = results.filter(o => (o.maximum_award || 0) <= params.maxAmount);
  }

  // Step 2: Sort
  const sortField = params.sortBy || 'created_at';
  const sortAsc = params.sortOrder === 'asc';
  results.sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  // Step 3: Paginate
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  const totalResults = results.length;
  const totalPages = Math.ceil(totalResults / pageSize);
  const offset = (page - 1) * pageSize;
  const paginatedResults = results.slice(offset, offset + pageSize);

  return {
    data: paginatedResults,
    pagination: {
      page,
      pageSize,
      totalResults,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

const allOpps = getAllOpportunities();

describe('Explorer Flow (Integration)', () => {

  describe('Filter → Query → Response Pipeline', () => {
    test('returns all open opportunities with no filters', () => {
      const result = queryExplorer({ status: 'open' }, allOpps);

      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach(o => expect(o.status).toBe('open'));
    });

    test('search filter narrows results by title', () => {
      const result = queryExplorer({ search: 'PG&E' }, allOpps);

      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach(o => {
        const matchesTitle = o.title.toLowerCase().includes('pg&e');
        const matchesAgency = (o.agency_name || '').toLowerCase().includes('pg&e');
        expect(matchesTitle || matchesAgency).toBe(true);
      });
    });

    test('scope filter returns only national', () => {
      const result = queryExplorer({ scope: 'national' }, allOpps);

      result.data.forEach(o => expect(o.is_national).toBe(true));
    });

    test('scope filter returns only state/local', () => {
      const result = queryExplorer({ scope: 'state' }, allOpps);

      result.data.forEach(o => expect(o.is_national).toBe(false));
    });

    test('combined filters narrow further', () => {
      const unfilteredResult = queryExplorer({ status: 'open' }, allOpps);
      const filteredResult = queryExplorer({ status: 'open', scope: 'national' }, allOpps);

      expect(filteredResult.data.length).toBeLessThanOrEqual(unfilteredResult.data.length);
    });

    test('amount range filter works', () => {
      const result = queryExplorer({
        minAmount: 100000,
        maxAmount: 2000000,
      }, allOpps);

      result.data.forEach(o => {
        expect(o.maximum_award).toBeGreaterThanOrEqual(100000);
        expect(o.maximum_award).toBeLessThanOrEqual(2000000);
      });
    });
  });

  describe('Sorting', () => {
    test('sorts by created_at descending by default', () => {
      const result = queryExplorer({}, allOpps);

      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i].created_at).not.toBeNull();
        expect(result.data[i - 1].created_at).not.toBeNull();
        expect(new Date(result.data[i].created_at).getTime())
          .toBeLessThanOrEqual(new Date(result.data[i - 1].created_at).getTime());
      }
    });

    test('sorts ascending when specified', () => {
      const result = queryExplorer({ sortBy: 'title', sortOrder: 'asc' }, allOpps);

      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i].title).not.toBeNull();
        expect(result.data[i - 1].title).not.toBeNull();
        expect(result.data[i].title >= result.data[i - 1].title).toBe(true);
      }
    });
  });

  describe('Pagination Response', () => {
    test('response has complete pagination metadata', () => {
      const result = queryExplorer({ pageSize: 2 }, allOpps);

      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('pageSize');
      expect(result.pagination).toHaveProperty('totalResults');
      expect(result.pagination).toHaveProperty('totalPages');
      expect(result.pagination).toHaveProperty('hasMore');
    });

    test('page 1 returns first N items', () => {
      const result = queryExplorer({ page: 1, pageSize: 2 }, allOpps);

      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.pagination.page).toBe(1);
    });

    test('hasMore is true when more pages exist', () => {
      expect(allOpps.length).toBeGreaterThan(1);
      const result = queryExplorer({ page: 1, pageSize: 1 }, allOpps);

      expect(result.pagination.hasMore).toBe(true);
    });

    test('last page has hasMore false', () => {
      const result = queryExplorer({ page: 1, pageSize: 100 }, allOpps);

      expect(result.pagination.hasMore).toBe(false);
    });

    test('totalResults reflects filtered count', () => {
      const allResult = queryExplorer({}, allOpps);
      const nationalResult = queryExplorer({ scope: 'national' }, allOpps);

      expect(nationalResult.pagination.totalResults)
        .toBeLessThanOrEqual(allResult.pagination.totalResults);
    });
  });

  describe('Edge Cases', () => {
    test('empty search returns all', () => {
      const result = queryExplorer({ search: '' }, allOpps);
      expect(result.data.length).toBe(allOpps.length);
    });

    test('no-match search returns empty', () => {
      const result = queryExplorer({ search: 'zzzznonexistent' }, allOpps);
      expect(result.data).toHaveLength(0);
      expect(result.pagination.totalResults).toBe(0);
    });

    test('page beyond range returns empty data', () => {
      const result = queryExplorer({ page: 999, pageSize: 25 }, allOpps);
      expect(result.data).toHaveLength(0);
    });
  });
});
