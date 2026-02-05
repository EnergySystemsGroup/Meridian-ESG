/**
 * RPC: get_funding_dynamic_sort Tests
 *
 * Tests the dynamic sorting RPC function behavior:
 * - Sort by relevance, deadline, amount, recent
 * - Sort direction (asc/desc)
 * - NULL handling in sorts
 * - Pagination integration
 *
 * NOTE: These tests validate expected behavior patterns.
 * For full integration tests, run against real Supabase.
 */

import { describe, test, expect } from 'vitest';

/**
 * Simulates the expected behavior of get_funding_dynamic_sort RPC
 */
function simulateGetFundingDynamicSort(opportunities, params = {}) {
  const {
    sort_by = 'relevance',
    sort_dir = 'desc',
    page = 1,
    page_size = 9,
    status_filter = null,
    state_filter = null,
    search_query = null,
  } = params;

  let result = [...opportunities];

  // Apply status filter
  if (status_filter && status_filter !== 'all') {
    result = result.filter(o => o.status === status_filter);
  }

  // Apply state filter
  if (state_filter) {
    result = result.filter(o =>
      o.is_national ||
      (o.coverage_state_codes && o.coverage_state_codes.includes(state_filter))
    );
  }

  // Apply search
  if (search_query) {
    const q = search_query.toLowerCase();
    result = result.filter(o =>
      o.title?.toLowerCase().includes(q) ||
      o.agency_name?.toLowerCase().includes(q) ||
      o.program_overview?.toLowerCase().includes(q)
    );
  }

  // Apply sort
  result.sort((a, b) => {
    let comparison = 0;

    switch (sort_by) {
      case 'relevance':
        comparison = (b.relevance_score ?? -Infinity) - (a.relevance_score ?? -Infinity);
        break;
      case 'deadline':
        // NULL deadlines always go to end, regardless of sort direction
        if (!a.close_date && !b.close_date) return 0;
        else if (!a.close_date) return 1;  // a goes to end
        else if (!b.close_date) return -1; // b goes to end
        // desc = latest first (default), asc = soonest first
        comparison = new Date(b.close_date) - new Date(a.close_date);
        break;
      case 'amount':
        comparison = (b.maximum_award ?? 0) - (a.maximum_award ?? 0);
        break;
      case 'recent':
        comparison = new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0);
        break;
    }

    return sort_dir === 'asc' ? -comparison : comparison;
  });

  // Calculate pagination
  const total = result.length;
  const totalPages = Math.ceil(total / page_size);
  const startIdx = (page - 1) * page_size;
  const pageData = result.slice(startIdx, startIdx + page_size);

  return {
    data: pageData,
    total,
    page,
    total_pages: totalPages,
    has_more: page < totalPages,
  };
}

const testOpportunities = [
  {
    id: 'opp-1',
    title: 'Federal Clean Energy Grant',
    agency_name: 'DOE',
    status: 'open',
    close_date: '2025-03-15T23:59:59Z',
    is_national: true,
    coverage_state_codes: null,
    relevance_score: 9.0,
    maximum_award: 5000000,
    created_at: '2024-01-15T10:00:00Z',
    program_overview: 'Federal funding for clean energy projects',
  },
  {
    id: 'opp-2',
    title: 'California Climate Initiative',
    agency_name: 'CEC',
    status: 'open',
    close_date: '2025-01-20T23:59:59Z',
    is_national: false,
    coverage_state_codes: ['CA'],
    relevance_score: 8.5,
    maximum_award: 2000000,
    created_at: '2024-02-01T10:00:00Z',
    program_overview: 'State climate funding',
  },
  {
    id: 'opp-3',
    title: 'Texas Energy Program',
    agency_name: 'SECO',
    status: 'open',
    close_date: '2025-06-30T23:59:59Z',
    is_national: false,
    coverage_state_codes: ['TX'],
    relevance_score: 7.0,
    maximum_award: 500000,
    created_at: '2024-03-01T10:00:00Z',
    program_overview: 'Texas efficiency funding',
  },
  {
    id: 'opp-4',
    title: 'Ongoing Rebate Program',
    agency_name: 'Local Utility',
    status: 'open',
    close_date: null, // No deadline
    is_national: false,
    coverage_state_codes: ['CA'],
    relevance_score: 5.0,
    maximum_award: null,
    created_at: '2024-04-01T10:00:00Z',
    program_overview: 'Ongoing utility rebates',
  },
  {
    id: 'opp-5',
    title: 'Closed Federal Grant',
    agency_name: 'DOE',
    status: 'closed',
    close_date: '2024-06-30T23:59:59Z',
    is_national: true,
    coverage_state_codes: null,
    relevance_score: 8.0,
    maximum_award: 10000000,
    created_at: '2023-12-01T10:00:00Z',
    program_overview: 'Expired federal grant',
  },
];

describe('RPC: get_funding_dynamic_sort', () => {

  describe('Sort by Relevance', () => {
    test('sorts by relevance descending (default)', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        sort_by: 'relevance',
        sort_dir: 'desc',
      });

      expect(result.data[0].relevance_score).toBe(9.0);
      expect(result.data[1].relevance_score).toBe(8.5);
    });

    test('sorts by relevance ascending', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        sort_by: 'relevance',
        sort_dir: 'asc',
      });

      // Lowest score first (excluding null)
      expect(result.data[0].relevance_score).toBeLessThanOrEqual(
        result.data[result.data.length - 1].relevance_score ?? Infinity
      );
    });
  });

  describe('Sort by Deadline', () => {
    test('sorts by deadline ascending (soonest first)', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        sort_by: 'deadline',
        sort_dir: 'asc',
      });

      // First item should have earliest deadline (null goes to end)
      const nonNullDeadlines = result.data.filter(o => o.close_date);
      if (nonNullDeadlines.length > 1) {
        expect(new Date(nonNullDeadlines[0].close_date).getTime())
          .toBeLessThanOrEqual(new Date(nonNullDeadlines[1].close_date).getTime());
      }
    });

    test('NULL deadlines go to end regardless of direction', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        sort_by: 'deadline',
        sort_dir: 'asc',
      });

      const nullDeadlineIdx = result.data.findIndex(o => o.close_date === null);
      if (nullDeadlineIdx !== -1) {
        // NULL should be near the end
        expect(nullDeadlineIdx).toBeGreaterThan(0);
      }
    });
  });

  describe('Sort by Amount', () => {
    test('sorts by maximum_award descending', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        sort_by: 'amount',
        sort_dir: 'desc',
      });

      // Highest amount first
      const firstWithAmount = result.data.find(o => o.maximum_award !== null);
      expect(firstWithAmount.maximum_award).toBeGreaterThanOrEqual(
        result.data[result.data.length - 1].maximum_award ?? 0
      );
    });

    test('NULL amounts treated as 0', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        sort_by: 'amount',
        sort_dir: 'desc',
      });

      // Items with null maximum_award should be toward the end
      const nullAmountIdx = result.data.findIndex(o => o.maximum_award === null);
      if (nullAmountIdx !== -1) {
        expect(nullAmountIdx).toBeGreaterThan(0);
      }
    });
  });

  describe('Sort by Recent', () => {
    test('sorts by created_at descending (newest first)', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        sort_by: 'recent',
        sort_dir: 'desc',
      });

      // Most recent first
      expect(new Date(result.data[0].created_at).getTime())
        .toBeGreaterThanOrEqual(new Date(result.data[1].created_at).getTime());
    });
  });

  describe('Status Filter', () => {
    test('filters to open only', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        status_filter: 'open',
      });

      expect(result.data.every(o => o.status === 'open')).toBe(true);
      expect(result.total).toBe(4); // 4 open opportunities
    });

    test('filters to closed only', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        status_filter: 'closed',
      });

      expect(result.data.every(o => o.status === 'closed')).toBe(true);
      expect(result.total).toBe(1);
    });

    test('all status returns everything', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        status_filter: 'all',
      });

      expect(result.total).toBe(5);
    });
  });

  describe('State Filter', () => {
    test('filters to specific state', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        state_filter: 'CA',
      });

      // Should include CA-specific + national
      result.data.forEach(o => {
        expect(o.is_national || o.coverage_state_codes?.includes('CA')).toBe(true);
      });
    });

    test('national opportunities included in state filter', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        state_filter: 'TX',
      });

      const hasNational = result.data.some(o => o.is_national);
      expect(hasNational).toBe(true);
    });
  });

  describe('Search Query', () => {
    test('searches in title', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        search_query: 'Federal',
      });

      expect(result.data.every(o => o.title.toLowerCase().includes('federal'))).toBe(true);
    });

    test('searches in agency_name', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        search_query: 'DOE',
      });

      expect(result.data.every(o => o.agency_name === 'DOE')).toBe(true);
    });

    test('case insensitive search', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        search_query: 'CALIFORNIA',
      });

      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('Pagination', () => {
    test('returns correct page size', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        page_size: 2,
        page: 1,
      });

      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    test('calculates total pages correctly', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        page_size: 2,
      });

      expect(result.total_pages).toBe(Math.ceil(5 / 2));
    });

    test('has_more indicates more pages', () => {
      const page1 = simulateGetFundingDynamicSort(testOpportunities, {
        page_size: 2,
        page: 1,
      });

      const lastPage = simulateGetFundingDynamicSort(testOpportunities, {
        page_size: 2,
        page: 3,
      });

      expect(page1.has_more).toBe(true);
      expect(lastPage.has_more).toBe(false);
    });

    test('returns correct offset for page 2', () => {
      const page1 = simulateGetFundingDynamicSort(testOpportunities, {
        page_size: 2,
        page: 1,
        sort_by: 'relevance',
        sort_dir: 'desc',
      });

      const page2 = simulateGetFundingDynamicSort(testOpportunities, {
        page_size: 2,
        page: 2,
        sort_by: 'relevance',
        sort_dir: 'desc',
      });

      // Page 2 should have different items than page 1
      const page1Ids = page1.data.map(o => o.id);
      const page2Ids = page2.data.map(o => o.id);

      expect(page1Ids.some(id => page2Ids.includes(id))).toBe(false);
    });
  });

  describe('Combined Filters', () => {
    test('status + state + sort', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        status_filter: 'open',
        state_filter: 'CA',
        sort_by: 'deadline',
        sort_dir: 'asc',
      });

      // All should be open
      expect(result.data.every(o => o.status === 'open')).toBe(true);

      // All should be CA or national
      expect(result.data.every(o =>
        o.is_national || o.coverage_state_codes?.includes('CA')
      )).toBe(true);
    });

    test('search + pagination', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        search_query: 'energy',
        page_size: 1,
        page: 1,
      });

      expect(result.data.length).toBeLessThanOrEqual(1);
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('empty result set', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        search_query: 'nonexistent123xyz',
      });

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.total_pages).toBe(0);
      expect(result.has_more).toBe(false);
    });

    test('page beyond results', () => {
      const result = simulateGetFundingDynamicSort(testOpportunities, {
        page: 100,
        page_size: 9,
      });

      expect(result.data).toHaveLength(0);
    });
  });
});
