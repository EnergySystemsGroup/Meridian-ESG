/**
 * Job Processor Unit Tests
 * 
 * Tests for pure logic functions in jobProcessor.js without external dependencies.
 * Focuses on validation, calculations, and data transformations.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { validateJobData } from '../../../lib/services/jobProcessor.js';

describe('JobProcessor - Unit Tests', () => {

  describe('validateJobData', () => {
    it('should validate required fields correctly', () => {
      const validJobData = {
        sourceId: 'test-source-123',
        chunkedData: [
          { id: 'opp1', title: 'Test Opportunity 1' },
          { id: 'opp2', title: 'Test Opportunity 2' }
        ],
        processingInstructions: {
          workflow: 'single_api',
          sourceName: 'Test Source'
        },
        rawResponseId: 'raw-response-123'
      };

      const result = validateJobData(validJobData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null or undefined job data', () => {
      const nullResult = validateJobData(null);
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.errors).toContain('Job data is required');

      const undefinedResult = validateJobData(undefined);
      expect(undefinedResult.isValid).toBe(false);
      expect(undefinedResult.errors).toContain('Job data is required');
    });

    it('should validate sourceId field', () => {
      const testCases = [
        { sourceId: null, expectedError: 'sourceId is required and must be a string' },
        { sourceId: undefined, expectedError: 'sourceId is required and must be a string' },
        { sourceId: '', expectedError: 'sourceId is required and must be a string' },
        { sourceId: 123, expectedError: 'sourceId is required and must be a string' },
        { sourceId: {}, expectedError: 'sourceId is required and must be a string' }
      ];

      testCases.forEach(({ sourceId, expectedError }) => {
        const jobData = {
          sourceId,
          chunkedData: [{ id: 'test' }],
          processingInstructions: { workflow: 'single_api' },
          rawResponseId: 'test-raw-id'
        };

        const result = validateJobData(jobData);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
    });

    it('should validate chunkedData field', () => {
      const baseJobData = {
        sourceId: 'test-source',
        processingInstructions: { workflow: 'single_api' },
        rawResponseId: 'test-raw-id'
      };

      // Test null/undefined
      expect(validateJobData({ ...baseJobData, chunkedData: null }).isValid).toBe(false);
      expect(validateJobData({ ...baseJobData, chunkedData: undefined }).isValid).toBe(false);
      
      // Test non-array
      expect(validateJobData({ ...baseJobData, chunkedData: 'not-array' }).isValid).toBe(false);
      expect(validateJobData({ ...baseJobData, chunkedData: {} }).isValid).toBe(false);
      
      // Test empty array
      const emptyResult = validateJobData({ ...baseJobData, chunkedData: [] });
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.errors).toContain('chunkedData cannot be empty');
      
      // Test too many items (> 5)
      const tooManyItems = Array.from({ length: 6 }, (_, i) => ({ id: `opp${i}` }));
      const tooManyResult = validateJobData({ ...baseJobData, chunkedData: tooManyItems });
      expect(tooManyResult.isValid).toBe(false);
      expect(tooManyResult.errors).toContain('chunkedData cannot contain more than 5 opportunities per job');
    });

    it('should validate processingInstructions field', () => {
      const baseJobData = {
        sourceId: 'test-source',
        chunkedData: [{ id: 'test' }],
        rawResponseId: 'test-raw-id'
      };

      // Test null/undefined
      expect(validateJobData({ ...baseJobData, processingInstructions: null }).isValid).toBe(false);
      expect(validateJobData({ ...baseJobData, processingInstructions: undefined }).isValid).toBe(false);
      
      // Test non-object
      expect(validateJobData({ ...baseJobData, processingInstructions: 'not-object' }).isValid).toBe(false);
      expect(validateJobData({ ...baseJobData, processingInstructions: 123 }).isValid).toBe(false);
    });

    it('should validate rawResponseId field', () => {
      const baseJobData = {
        sourceId: 'test-source',
        chunkedData: [{ id: 'test' }],
        processingInstructions: { workflow: 'single_api' }
      };

      const testCases = [
        { rawResponseId: null, expectedError: 'rawResponseId is required and must be a string' },
        { rawResponseId: undefined, expectedError: 'rawResponseId is required and must be a string' },
        { rawResponseId: '', expectedError: 'rawResponseId is required and must be a string' },
        { rawResponseId: 123, expectedError: 'rawResponseId is required and must be a string' },
        { rawResponseId: {}, expectedError: 'rawResponseId is required and must be a string' }
      ];

      testCases.forEach(({ rawResponseId, expectedError }) => {
        const result = validateJobData({ ...baseJobData, rawResponseId });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
    });

    it('should accumulate multiple validation errors', () => {
      const invalidJobData = {
        sourceId: null,
        chunkedData: 'not-array',
        processingInstructions: null,
        rawResponseId: 123
      };

      const result = validateJobData(invalidJobData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.errors).toContain('sourceId is required and must be a string');
      expect(result.errors).toContain('chunkedData is required and must be an array');
      expect(result.errors).toContain('processingInstructions is required and must be an object');
      expect(result.errors).toContain('rawResponseId is required and must be a string');
    });

    it('should handle edge cases for chunk size validation', () => {
      const baseJobData = {
        sourceId: 'test-source',
        processingInstructions: { workflow: 'single_api' },
        rawResponseId: 'test-raw-id'
      };

      // Test exactly 5 items (should be valid)
      const exactlyFive = Array.from({ length: 5 }, (_, i) => ({ id: `opp${i}` }));
      const exactlyFiveResult = validateJobData({ ...baseJobData, chunkedData: exactlyFive });
      expect(exactlyFiveResult.isValid).toBe(true);

      // Test exactly 1 item (should be valid)
      const exactlyOne = [{ id: 'opp1' }];
      const exactlyOneResult = validateJobData({ ...baseJobData, chunkedData: exactlyOne });
      expect(exactlyOneResult.isValid).toBe(true);
    });
  });

  describe('Metrics Calculation Logic', () => {
    it('should calculate extraction efficiency correctly', () => {
      const calculateExtractionEfficiency = (extracted, total) => {
        return total > 0 ? ((extracted / total) * 100).toFixed(1) : '0';
      };

      expect(calculateExtractionEfficiency(5, 10)).toBe('50.0');
      expect(calculateExtractionEfficiency(10, 10)).toBe('100.0');
      expect(calculateExtractionEfficiency(0, 10)).toBe('0.0');
      expect(calculateExtractionEfficiency(5, 0)).toBe('0');
      expect(calculateExtractionEfficiency(3, 7)).toBe('42.9');
    });

    it('should calculate percentage with proper rounding', () => {
      const calculatePercentage = (numerator, denominator) => {
        return denominator > 0 ? (numerator / denominator * 100) : 0;
      };

      expect(calculatePercentage(1, 3)).toBeCloseTo(33.333, 2);
      expect(calculatePercentage(2, 3)).toBeCloseTo(66.667, 2);
      expect(calculatePercentage(0, 5)).toBe(0);
      expect(calculatePercentage(5, 0)).toBe(0);
    });

    it('should handle operator precedence in calculations', () => {
      // Test the specific bug we fixed in jobProcessor.js
      const calculateTotal = (newCount, updateCount) => {
        // This was the buggy version: newCount || 0 + updateCount || 0
        // Fixed version: (newCount || 0) + (updateCount || 0)
        return (newCount || 0) + (updateCount || 0);
      };

      expect(calculateTotal(5, 3)).toBe(8);
      expect(calculateTotal(null, 3)).toBe(3);
      expect(calculateTotal(5, null)).toBe(5);
      expect(calculateTotal(null, null)).toBe(0);
      expect(calculateTotal(undefined, 3)).toBe(3);
    });
  });

  describe('Data Structure Validation', () => {
    it('should validate job data structure consistency', () => {
      const validateStructure = (jobData) => {
        const requiredFields = ['sourceId', 'chunkedData', 'processingInstructions', 'rawResponseId'];
        const missingFields = requiredFields.filter(field => !jobData || !(field in jobData));
        return {
          isValid: missingFields.length === 0,
          missingFields
        };
      };

      const validJobData = {
        sourceId: 'test',
        chunkedData: [],
        processingInstructions: {},
        rawResponseId: 'test-id'
      };

      const result = validateStructure(validJobData);
      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);

      const incompleteJobData = {
        sourceId: 'test',
        chunkedData: []
        // Missing processingInstructions and rawResponseId
      };

      const incompleteResult = validateStructure(incompleteJobData);
      expect(incompleteResult.isValid).toBe(false);
      expect(incompleteResult.missingFields).toEqual(['processingInstructions', 'rawResponseId']);
    });

    it('should validate opportunity structure in chunks', () => {
      const validateOpportunityStructure = (opportunity) => {
        const requiredFields = ['id', 'title'];
        const hasRequiredFields = requiredFields.every(field => 
          opportunity && typeof opportunity[field] === 'string' && opportunity[field].length > 0
        );
        return hasRequiredFields;
      };

      // Valid opportunity
      expect(validateOpportunityStructure({ id: 'opp1', title: 'Test Opportunity' })).toBe(true);
      
      // Invalid opportunities
      expect(validateOpportunityStructure({ title: 'Test Opportunity' })).toBe(false); // Missing id
      expect(validateOpportunityStructure({ id: 'opp1' })).toBe(false); // Missing title
      expect(validateOpportunityStructure({ id: '', title: 'Test' })).toBe(false); // Empty id
      expect(validateOpportunityStructure({ id: 'opp1', title: '' })).toBe(false); // Empty title
      expect(validateOpportunityStructure(null)).toBe(false); // Null opportunity
    });
  });

  describe('Error Categorization Logic', () => {
    it('should categorize errors correctly', () => {
      const categorizeError = (error) => {
        const message = error.message || '';
        
        if (message.includes('timeout')) return 'timeout_error';
        if (message.includes('Network') || message.includes('network')) return 'network_error';
        if (message.includes('404')) return 'not_found_error';
        if (message.includes('500')) return 'server_error';
        if (message.includes('validation') || message.includes('Invalid')) return 'validation_error';
        if (message.includes('database') || message.includes('Database')) return 'database_error';
        return 'unknown_error';
      };

      expect(categorizeError(new Error('Request timeout after 30s'))).toBe('timeout_error');
      expect(categorizeError(new Error('Network error occurred'))).toBe('network_error');
      expect(categorizeError(new Error('API call failed: 404 Not Found'))).toBe('not_found_error');
      expect(categorizeError(new Error('API call failed: 500 Internal Server Error'))).toBe('server_error');
      expect(categorizeError(new Error('Invalid job data: sourceId is required'))).toBe('validation_error');
      expect(categorizeError(new Error('Database connection failed'))).toBe('database_error');
      expect(categorizeError(new Error('Something went wrong'))).toBe('unknown_error');
    });

    it('should handle edge cases in error categorization', () => {
      const categorizeError = (error) => {
        if (!error || !error.message) return 'unknown_error';
        // Same logic as above test
        const message = error.message;
        if (message.includes('timeout')) return 'timeout_error';
        return 'unknown_error';
      };

      expect(categorizeError(null)).toBe('unknown_error');
      expect(categorizeError({})).toBe('unknown_error');
      expect(categorizeError({ message: '' })).toBe('unknown_error');
      expect(categorizeError(new Error(''))).toBe('unknown_error');
    });
  });

  describe('Force Full Processing Logic', () => {
    it('should handle force full processing flag correctly', () => {
      const applyForceFullProcessing = (opportunities, forceFullProcessing) => {
        if (forceFullProcessing) {
          // When force full processing is enabled, treat all as new
          return {
            newOpportunities: opportunities,
            opportunitiesToUpdate: [],
            opportunitiesToSkip: [],
            bypassedDuplicateDetection: true
          };
        }
        
        // Normal processing would involve actual duplicate detection
        return {
          newOpportunities: opportunities,
          opportunitiesToUpdate: [],
          opportunitiesToSkip: [],
          bypassedDuplicateDetection: false
        };
      };

      const testOpportunities = [
        { id: 'opp1', title: 'Test 1' },
        { id: 'opp2', title: 'Test 2' }
      ];

      // With force full processing enabled
      const forceResult = applyForceFullProcessing(testOpportunities, true);
      expect(forceResult.newOpportunities).toHaveLength(2);
      expect(forceResult.opportunitiesToUpdate).toHaveLength(0);
      expect(forceResult.opportunitiesToSkip).toHaveLength(0);
      expect(forceResult.bypassedDuplicateDetection).toBe(true);

      // With force full processing disabled
      const normalResult = applyForceFullProcessing(testOpportunities, false);
      expect(normalResult.bypassedDuplicateDetection).toBe(false);
    });
  });

  describe('Time and Performance Calculations', () => {
    it('should calculate execution time correctly', () => {
      const calculateExecutionTime = (startTime, endTime) => {
        return Math.max(1, endTime - startTime);
      };

      const start = 1000;
      const end = 2500;
      
      expect(calculateExecutionTime(start, end)).toBe(1500);
      expect(calculateExecutionTime(start, start)).toBe(1); // Minimum 1ms
      expect(calculateExecutionTime(end, start)).toBe(1); // Handle negative (edge case)
    });

    it('should calculate average processing time per opportunity', () => {
      const calculateAverageTime = (totalTime, opportunityCount) => {
        return opportunityCount > 0 ? Math.round(totalTime / opportunityCount) : 0;
      };

      expect(calculateAverageTime(1000, 5)).toBe(200);
      expect(calculateAverageTime(1337, 3)).toBe(446); // Rounded
      expect(calculateAverageTime(1000, 0)).toBe(0);
      expect(calculateAverageTime(0, 5)).toBe(0);
    });
  });

  describe('Job Data Transformation Logic', () => {
    it('should transform raw API data structure for extraction', () => {
      const transformForExtraction = (chunkedData) => {
        return {
          data: chunkedData,
          totalFound: chunkedData.length,
          totalRetrieved: chunkedData.length,
          apiCallCount: 1,
          rawResponse: chunkedData
        };
      };

      const testChunkedData = [
        { id: 'opp1', title: 'Test 1' },
        { id: 'opp2', title: 'Test 2' }
      ];

      const result = transformForExtraction(testChunkedData);
      
      expect(result.data).toBe(testChunkedData);
      expect(result.totalFound).toBe(2);
      expect(result.totalRetrieved).toBe(2);
      expect(result.apiCallCount).toBe(1);
      expect(result.rawResponse).toBe(testChunkedData);
    });

    it('should add source tracking to opportunities', () => {
      const addSourceTracking = (opportunities, sourceId, sourceName, rawResponseId) => {
        return opportunities.map(opportunity => ({
          ...opportunity,
          sourceId,
          sourceName,
          rawResponseId
        }));
      };

      const opportunities = [
        { id: 'opp1', title: 'Test 1' },
        { id: 'opp2', title: 'Test 2' }
      ];

      const result = addSourceTracking(opportunities, 'source-123', 'Test Source', 'raw-456');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'opp1',
        title: 'Test 1',
        sourceId: 'source-123',
        sourceName: 'Test Source',
        rawResponseId: 'raw-456'
      });
      expect(result[1]).toMatchObject({
        id: 'opp2',
        title: 'Test 2',
        sourceId: 'source-123',
        sourceName: 'Test Source',
        rawResponseId: 'raw-456'
      });
    });
  });

  describe('Results Object Construction', () => {
    it('should construct valid results object structure', () => {
      const createJobResults = (jobData, metrics) => {
        return {
          status: 'success',
          pipeline: 'v2-job-queue',
          sourceId: jobData.sourceId,
          jobExecutionTime: metrics.totalTime,
          totalRawItemsProcessed: jobData.chunkedData.length,
          totalOpportunitiesExtracted: metrics.extractedCount,
          
          extraction: {
            rawItems: jobData.chunkedData.length,
            extractedOpportunities: metrics.extractedCount,
            extractionEfficiency: ((metrics.extractedCount / jobData.chunkedData.length) * 100).toFixed(1),
            tokensUsed: metrics.extractionTokens
          },
          
          totalProcessed: metrics.totalProcessed,
          totalErrors: metrics.totalErrors
        };
      };

      const testJobData = {
        sourceId: 'test-source',
        chunkedData: new Array(5).fill({}).map((_, i) => ({ id: `opp${i}` }))
      };

      const testMetrics = {
        totalTime: 5000,
        extractedCount: 4,
        extractionTokens: 1200,
        totalProcessed: 3,
        totalErrors: 1
      };

      const result = createJobResults(testJobData, testMetrics);
      
      expect(result.status).toBe('success');
      expect(result.pipeline).toBe('v2-job-queue');
      expect(result.sourceId).toBe('test-source');
      expect(result.jobExecutionTime).toBe(5000);
      expect(result.totalRawItemsProcessed).toBe(5);
      expect(result.totalOpportunitiesExtracted).toBe(4);
      expect(result.extraction.extractionEfficiency).toBe('80.0');
      expect(result.extraction.tokensUsed).toBe(1200);
    });
  });

  describe('Input Sanitization', () => {
    it('should handle malformed input gracefully', () => {
      const sanitizeJobData = (jobData) => {
        if (!jobData || typeof jobData !== 'object') {
          return null;
        }

        return {
          sourceId: typeof jobData.sourceId === 'string' ? jobData.sourceId.trim() : null,
          chunkedData: Array.isArray(jobData.chunkedData) ? jobData.chunkedData : [],
          processingInstructions: typeof jobData.processingInstructions === 'object' && jobData.processingInstructions !== null 
            ? jobData.processingInstructions 
            : {},
          rawResponseId: typeof jobData.rawResponseId === 'string' ? jobData.rawResponseId.trim() : null
        };
      };

      expect(sanitizeJobData(null)).toBe(null);
      expect(sanitizeJobData('not-object')).toBe(null);
      expect(sanitizeJobData(123)).toBe(null);

      const malformedInput = {
        sourceId: '  test-source  ',
        chunkedData: 'not-array',
        processingInstructions: null,
        rawResponseId: '  raw-id  '
      };

      const sanitized = sanitizeJobData(malformedInput);
      expect(sanitized.sourceId).toBe('test-source');
      expect(sanitized.chunkedData).toEqual([]);
      expect(sanitized.processingInstructions).toEqual({});
      expect(sanitized.rawResponseId).toBe('raw-id');
    });
  });
});