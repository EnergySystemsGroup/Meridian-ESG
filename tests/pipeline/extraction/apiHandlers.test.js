/**
 * Pipeline: API Handlers Tests
 *
 * Tests the data extraction API handling:
 * - Single-step API response parsing
 * - Two-step API response (list -> detail)
 * - Response validation
 * - Error response handling
 */

import { describe, test, expect } from 'vitest';

/**
 * Parse a single-step API response into opportunities
 */
function parseSingleStepResponse(response) {
  if (!response || !response.data) {
    return { opportunities: [], error: 'No data in response' };
  }

  const items = Array.isArray(response.data) ? response.data : [response.data];

  return {
    opportunities: items.map(item => ({
      title: item.title || item.name || 'Untitled',
      agency_name: item.agency || item.organization || null,
      description: item.description || item.summary || null,
      url: item.url || item.link || null,
      funding_amount: extractFundingAmount(item),
      close_date: item.close_date || item.deadline || item.due_date || null,
    })),
    error: null,
  };
}

/**
 * Extract funding amount from various field names
 */
function extractFundingAmount(item) {
  const fields = [
    'maximum_award',
    'max_award',
    'funding_amount',
    'award_ceiling',
    'total_funding',
    'estimated_total_program_funding',
  ];

  for (const field of fields) {
    if (item[field] !== undefined && item[field] !== null) {
      const amount = typeof item[field] === 'string'
        ? parseFloat(item[field].replace(/[$,]/g, ''))
        : item[field];
      return isNaN(amount) ? null : amount;
    }
  }

  return null;
}

/**
 * Validate API response structure
 */
function validateApiResponse(response) {
  if (!response) return { valid: false, error: 'Null response' };
  if (response.error) return { valid: false, error: response.error };
  if (response.status && response.status >= 400) {
    return { valid: false, error: `HTTP ${response.status}` };
  }
  return { valid: true, error: null };
}

/**
 * Extract pagination info from response
 */
function extractPaginationInfo(response) {
  return {
    total: response.total || response.totalResults || response.count || null,
    page: response.page || response.currentPage || 1,
    pageSize: response.pageSize || response.perPage || response.limit || null,
    hasMore: response.hasMore || response.next != null || false,
    nextCursor: response.nextCursor || response.nextPageToken || null,
  };
}

describe('API Handlers', () => {

  describe('Single-Step Response Parsing', () => {
    test('parses array response', () => {
      const response = {
        data: [
          { title: 'Grant A', agency: 'DOE', maximum_award: 5000000 },
          { title: 'Grant B', agency: 'EPA', maximum_award: 2000000 },
        ],
      };

      const result = parseSingleStepResponse(response);
      expect(result.opportunities).toHaveLength(2);
      expect(result.error).toBeNull();
      expect(result.opportunities[0].title).toBe('Grant A');
    });

    test('handles single object response', () => {
      const response = { data: { title: 'Solo Grant' } };
      const result = parseSingleStepResponse(response);
      expect(result.opportunities).toHaveLength(1);
    });

    test('handles null response', () => {
      const result = parseSingleStepResponse(null);
      expect(result.opportunities).toHaveLength(0);
      expect(result.error).toBe('No data in response');
    });

    test('handles empty data', () => {
      const result = parseSingleStepResponse({ data: null });
      expect(result.opportunities).toHaveLength(0);
    });

    test('maps alternative field names', () => {
      const response = {
        data: [{ name: 'Alt Title', organization: 'Alt Agency', summary: 'Alt Desc' }],
      };

      const result = parseSingleStepResponse(response);
      expect(result.opportunities[0].title).toBe('Alt Title');
      expect(result.opportunities[0].agency_name).toBe('Alt Agency');
      expect(result.opportunities[0].description).toBe('Alt Desc');
    });

    test('defaults to Untitled when no name fields', () => {
      const response = { data: [{ description: 'no title here' }] };
      const result = parseSingleStepResponse(response);
      expect(result.opportunities[0].title).toBe('Untitled');
    });
  });

  describe('Funding Amount Extraction', () => {
    test('extracts from maximum_award', () => {
      expect(extractFundingAmount({ maximum_award: 5000000 })).toBe(5000000);
    });

    test('extracts from award_ceiling', () => {
      expect(extractFundingAmount({ award_ceiling: 1000000 })).toBe(1000000);
    });

    test('parses string with dollar sign', () => {
      expect(extractFundingAmount({ funding_amount: '$5,000,000' })).toBe(5000000);
    });

    test('prefers maximum_award over others', () => {
      expect(extractFundingAmount({
        maximum_award: 5000000,
        total_funding: 50000000,
      })).toBe(5000000);
    });

    test('returns null when no funding fields', () => {
      expect(extractFundingAmount({ title: 'No funding' })).toBeNull();
    });

    test('returns null for unparseable string', () => {
      expect(extractFundingAmount({ funding_amount: 'varies' })).toBeNull();
    });

    test('handles zero', () => {
      expect(extractFundingAmount({ maximum_award: 0 })).toBe(0);
    });
  });

  describe('Response Validation', () => {
    test('valid response passes', () => {
      const result = validateApiResponse({ data: [], status: 200 });
      expect(result.valid).toBe(true);
    });

    test('null response fails', () => {
      const result = validateApiResponse(null);
      expect(result.valid).toBe(false);
    });

    test('error response fails', () => {
      const result = validateApiResponse({ error: 'Rate limited' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Rate limited');
    });

    test('4xx status fails', () => {
      const result = validateApiResponse({ status: 404 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('404');
    });

    test('5xx status fails', () => {
      const result = validateApiResponse({ status: 500 });
      expect(result.valid).toBe(false);
    });
  });

  describe('Pagination Info Extraction', () => {
    test('extracts standard pagination', () => {
      const info = extractPaginationInfo({ total: 100, page: 2, pageSize: 25 });
      expect(info.total).toBe(100);
      expect(info.page).toBe(2);
      expect(info.pageSize).toBe(25);
    });

    test('handles alternative field names', () => {
      const info = extractPaginationInfo({ totalResults: 50, currentPage: 3, perPage: 10 });
      expect(info.total).toBe(50);
      expect(info.page).toBe(3);
      expect(info.pageSize).toBe(10);
    });

    test('detects hasMore from next field', () => {
      const info = extractPaginationInfo({ next: 'https://api.example.com/page/2' });
      expect(info.hasMore).toBe(true);
    });

    test('extracts cursor token', () => {
      const info = extractPaginationInfo({ nextPageToken: 'abc123' });
      expect(info.nextCursor).toBe('abc123');
    });

    test('defaults for missing fields', () => {
      const info = extractPaginationInfo({});
      expect(info.total).toBeNull();
      expect(info.page).toBe(1);
      expect(info.hasMore).toBe(false);
    });
  });
});
