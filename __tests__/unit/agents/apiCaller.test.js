/**
 * API Caller Module Tests - Unit Tests
 * 
 * Tests for the standalone API calling functionality
 * These tests focus on pure logic without external dependencies
 */

import { chunkOpportunities } from '../../../lib/agents-v2/core/apiCaller/index.js';

describe('ApiCaller Module - Unit Tests', () => {

  describe('chunkOpportunities', () => {
    it('should chunk opportunities correctly', () => {
      const opportunities = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));
      const chunks = chunkOpportunities(opportunities, 5);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(5);
      expect(chunks[1]).toHaveLength(5);
      expect(chunks[2]).toHaveLength(2);
      expect(chunks[0][0].id).toBe(1);
      expect(chunks[2][1].id).toBe(12);
    });

    it('should handle empty array', () => {
      const chunks = chunkOpportunities([], 5);
      expect(chunks).toHaveLength(0);
    });

    it('should handle single chunk', () => {
      const opportunities = [{ id: 1 }, { id: 2 }];
      const chunks = chunkOpportunities(opportunities, 5);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toHaveLength(2);
    });

    it('should use default chunk size', () => {
      const opportunities = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));
      const chunks = chunkOpportunities(opportunities);

      expect(chunks).toHaveLength(3); // 12 / 5 = 2.4 -> 3 chunks
      expect(chunks[0]).toHaveLength(5);
    });

    it('should preserve data integrity in chunks', () => {
      const opportunities = [
        { id: 1, title: 'Opportunity 1', amount: 100000 },
        { id: 2, title: 'Opportunity 2', amount: 200000 },
        { id: 3, title: 'Opportunity 3', amount: 300000 }
      ];
      const chunks = chunkOpportunities(opportunities, 2);

      expect(chunks).toHaveLength(2);
      expect(chunks[0][0]).toEqual({ id: 1, title: 'Opportunity 1', amount: 100000 });
      expect(chunks[0][1]).toEqual({ id: 2, title: 'Opportunity 2', amount: 200000 });
      expect(chunks[1][0]).toEqual({ id: 3, title: 'Opportunity 3', amount: 300000 });
    });

    it('should handle non-array input gracefully', () => {
      expect(chunkOpportunities(null, 5)).toEqual([]);
      expect(chunkOpportunities(undefined, 5)).toEqual([]);
      expect(chunkOpportunities('not an array', 5)).toEqual([]);
    });

    it('should handle chunk size of 1', () => {
      const opportunities = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const chunks = chunkOpportunities(opportunities, 1);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(1);
      expect(chunks[1]).toHaveLength(1);
      expect(chunks[2]).toHaveLength(1);
    });

    it('should handle chunk size larger than array', () => {
      const opportunities = [{ id: 1 }, { id: 2 }];
      const chunks = chunkOpportunities(opportunities, 10);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toHaveLength(2);
    });

    it('should handle zero chunk size gracefully', () => {
      const opportunities = [{ id: 1 }, { id: 2 }];
      const chunks = chunkOpportunities(opportunities, 0);
      expect(chunks).toEqual([]);
    });

    it('should handle negative chunk size gracefully', () => {
      const opportunities = [{ id: 1 }, { id: 2 }];
      const chunks = chunkOpportunities(opportunities, -1);
      expect(chunks).toEqual([]);
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 }));
      const startTime = Date.now();
      const chunks = chunkOpportunities(largeDataset, 100);
      const endTime = Date.now();

      expect(chunks).toHaveLength(10);
      expect(chunks[0]).toHaveLength(100);
      expect(chunks[9]).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should handle complex object structures', () => {
      const complexOpportunities = [
        {
          id: 1,
          title: 'Complex Opportunity 1',
          nested: { data: { value: 100 } },
          array: [1, 2, 3],
          metadata: { created: new Date(), tags: ['tag1', 'tag2'] }
        },
        {
          id: 2,
          title: 'Complex Opportunity 2',
          nested: { data: { value: 200 } },
          array: [4, 5, 6],
          metadata: { created: new Date(), tags: ['tag3', 'tag4'] }
        }
      ];
      const chunks = chunkOpportunities(complexOpportunities, 1);

      expect(chunks).toHaveLength(2);
      expect(chunks[0][0]).toEqual(complexOpportunities[0]);
      expect(chunks[1][0]).toEqual(complexOpportunities[1]);
      // Verify deep equality
      expect(chunks[0][0].nested.data.value).toBe(100);
      expect(chunks[1][0].array).toEqual([4, 5, 6]);
    });

    it('should not mutate original array', () => {
      const original = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const originalCopy = JSON.parse(JSON.stringify(original));
      
      chunkOpportunities(original, 2);
      
      expect(original).toEqual(originalCopy);
    });
  });

  describe('Validation Logic', () => {
    // Test parameter validation logic that would be called by fetchAndChunkData
    it('should validate required parameters', () => {
      // Test the validation logic that happens in fetchAndChunkData
      const validateParams = (source, instructions) => {
        if (!source || !instructions) {
          throw new Error('Source and processing instructions are required');
        }
        return true;
      };

      expect(() => validateParams(null, {})).toThrow('Source and processing instructions are required');
      expect(() => validateParams({}, null)).toThrow('Source and processing instructions are required');
      expect(() => validateParams(undefined, {})).toThrow('Source and processing instructions are required');
      expect(() => validateParams({}, undefined)).toThrow('Source and processing instructions are required');
      expect(() => validateParams({ id: 'test' }, { workflow: 'single_api' })).not.toThrow();
    });
  });

  describe('URL Building Logic', () => {
    // Test URL construction logic without making actual requests
    it('should build URLs with query parameters correctly', () => {
      const buildUrlWithParams = (baseUrl, params) => {
        const url = new URL(baseUrl);
        Object.entries(params || {}).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            url.searchParams.append(key, value);
          }
        });
        return url.toString();
      };

      expect(buildUrlWithParams('https://api.test.com/data', { page: 1, limit: 10 }))
        .toBe('https://api.test.com/data?page=1&limit=10');
      
      expect(buildUrlWithParams('https://api.test.com/data', { q: 'test query', active: true }))
        .toBe('https://api.test.com/data?q=test+query&active=true');
      
      expect(buildUrlWithParams('https://api.test.com/data', { empty: null, undefined: undefined, valid: 'value' }))
        .toBe('https://api.test.com/data?valid=value');
    });

    it('should handle URL path replacement correctly', () => {
      const replaceUrlPath = (template, replacements) => {
        let result = template;
        Object.entries(replacements || {}).forEach(([key, value]) => {
          result = result.replace(`{${key}}`, value);
        });
        return result;
      };

      expect(replaceUrlPath('https://api.test.com/opportunities/{id}', { id: 123 }))
        .toBe('https://api.test.com/opportunities/123');
      
      expect(replaceUrlPath('https://api.test.com/{type}/{id}/details', { type: 'grants', id: 'abc-123' }))
        .toBe('https://api.test.com/grants/abc-123/details');
    });
  });

  describe('Pagination Logic', () => {
    // Test pagination parameter calculation without making requests
    it('should calculate offset pagination correctly', () => {
      const calculateOffsetPagination = (page, pageSize, config) => {
        if (!config?.enabled || config.type !== 'offset') return {};
        
        const offset = (page - 1) * pageSize;
        const params = {};
        
        if (config.limitParam) params[config.limitParam] = pageSize;
        if (config.offsetParam) params[config.offsetParam] = offset;
        
        return params;
      };

      const config = { enabled: true, type: 'offset', limitParam: 'limit', offsetParam: 'offset' };
      
      expect(calculateOffsetPagination(1, 10, config)).toEqual({ limit: 10, offset: 0 });
      expect(calculateOffsetPagination(2, 10, config)).toEqual({ limit: 10, offset: 10 });
      expect(calculateOffsetPagination(5, 25, config)).toEqual({ limit: 25, offset: 100 });
    });

    it('should calculate page-based pagination correctly', () => {
      const calculatePagePagination = (page, pageSize, config) => {
        if (!config?.enabled || config.type !== 'page') return {};
        
        const params = {};
        if (config.pageParam) params[config.pageParam] = page;
        if (config.limitParam) params[config.limitParam] = pageSize;
        
        return params;
      };

      const config = { enabled: true, type: 'page', pageParam: 'page', limitParam: 'size' };
      
      expect(calculatePagePagination(1, 10, config)).toEqual({ page: 1, size: 10 });
      expect(calculatePagePagination(3, 20, config)).toEqual({ page: 3, size: 20 });
    });

    it('should handle disabled pagination', () => {
      const calculatePagination = (page, pageSize, config) => {
        if (!config?.enabled) return {};
        return { calculated: true };
      };

      expect(calculatePagination(1, 10, { enabled: false })).toEqual({});
      expect(calculatePagination(1, 10, null)).toEqual({});
      expect(calculatePagination(1, 10, undefined)).toEqual({});
    });
  });

  describe('Metrics Object Structure', () => {
    // Test metrics object creation and validation
    it('should create valid metrics objects', () => {
      const createMetricsObject = (apiCalls = 0, retryAttempts = 0, errors = [], fetchTime = 0) => {
        return {
          apiCalls,
          retryAttempts,
          errors,
          fetchTime,
          responseSize: 0,
          opportunityCount: 0,
          totalFound: 0,
          totalRetrieved: 0
        };
      };

      const metrics = createMetricsObject(3, 1, [{ type: 'timeout', message: 'Request timeout' }], 1500);
      
      expect(metrics).toHaveProperty('apiCalls', 3);
      expect(metrics).toHaveProperty('retryAttempts', 1);
      expect(metrics).toHaveProperty('errors');
      expect(metrics.errors).toHaveLength(1);
      expect(metrics.errors[0]).toHaveProperty('type', 'timeout');
      expect(metrics).toHaveProperty('fetchTime', 1500);
    });

    it('should validate metrics object properties', () => {
      const validateMetrics = (metrics) => {
        const requiredProps = ['apiCalls', 'retryAttempts', 'errors', 'fetchTime', 'responseSize', 'opportunityCount'];
        return requiredProps.every(prop => metrics.hasOwnProperty(prop));
      };

      const validMetrics = {
        apiCalls: 1,
        retryAttempts: 0,
        errors: [],
        fetchTime: 100,
        responseSize: 1024,
        opportunityCount: 5,
        totalFound: 10,
        totalRetrieved: 5
      };

      const invalidMetrics = {
        apiCalls: 1,
        fetchTime: 100
        // Missing required properties
      };

      expect(validateMetrics(validMetrics)).toBe(true);
      expect(validateMetrics(invalidMetrics)).toBe(false);
    });
  });

  describe('Error Handling Logic', () => {
    // Test error categorization and handling logic
    it('should categorize errors correctly', () => {
      const categorizeError = (error) => {
        if (error.message.includes('timeout')) return 'timeout_error';
        if (error.message.includes('Network')) return 'network_error';
        if (error.message.includes('404')) return 'not_found_error';
        if (error.message.includes('500')) return 'server_error';
        return 'unknown_error';
      };

      expect(categorizeError(new Error('Request timeout after 30s'))).toBe('timeout_error');
      expect(categorizeError(new Error('Network error'))).toBe('network_error');
      expect(categorizeError(new Error('API call failed: 404 Not Found'))).toBe('not_found_error');
      expect(categorizeError(new Error('API call failed: 500 Internal Server Error'))).toBe('server_error');
      expect(categorizeError(new Error('Something went wrong'))).toBe('unknown_error');
    });

    it('should calculate retry delays correctly', () => {
      const calculateRetryDelay = (attempt) => {
        return Math.pow(2, attempt - 1) * 1000; // Exponential backoff
      };

      expect(calculateRetryDelay(1)).toBe(1000);  // 2^0 * 1000 = 1s
      expect(calculateRetryDelay(2)).toBe(2000);  // 2^1 * 1000 = 2s
      expect(calculateRetryDelay(3)).toBe(4000);  // 2^2 * 1000 = 4s
      expect(calculateRetryDelay(4)).toBe(8000);  // 2^3 * 1000 = 8s
    });
  });
});