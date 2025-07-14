/**
 * Unit Tests for DataSanitizer
 * 
 * Comprehensive test suite covering data sanitization, field mapping,
 * and validation logic for opportunity data preparation.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { dataSanitizer } from '../../core/storageAgent/dataSanitizer.js';

// Mock the fieldMapping utility
vi.mock('../../core/storageAgent/utils/fieldMapping.js', () => ({
  fieldMapping: {
    getFieldMappings: vi.fn(() => ({
      'sourceField1': 'dbField1',
      'sourceField2': 'dbField2'
    }))
  }
}));

describe('DataSanitizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('prepareForInsert', () => {
    test('should prepare opportunity data for insertion', () => {
      const opportunity = {
        id: 'test-id',
        title: 'Test Opportunity',
        description: 'Test Description'
      };

      const result = dataSanitizer.prepareForInsert(opportunity, 'source-1', 'funding-1');

      expect(result.api_source_id).toBe('source-1');
      expect(result.funding_source_id).toBe('funding-1');
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
      expect(result.api_opportunity_id).toBe('test-id');
      expect(result.title).toBe('Test Opportunity');
      expect(result.description).toBe('Test Description');
    });

    test('should handle null funding source ID', () => {
      const opportunity = { id: 'test-id' };

      const result = dataSanitizer.prepareForInsert(opportunity, 'source-1', null);

      expect(result.funding_source_id).toBeNull();
    });

    test('should include timestamps', () => {
      const opportunity = { id: 'test-id' };
      const beforeTime = new Date().toISOString();

      const result = dataSanitizer.prepareForInsert(opportunity, 'source-1', 'funding-1');

      const afterTime = new Date().toISOString();
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
      expect(result.created_at >= beforeTime).toBe(true);
      expect(result.created_at <= afterTime).toBe(true);
    });
  });

  describe('prepareForUpdate', () => {
    test('should prepare opportunity data for update', () => {
      const opportunity = {
        id: 'test-id',
        title: 'Updated Title',
        description: 'Updated Description'
      };

      const result = dataSanitizer.prepareForUpdate(opportunity, 'funding-2');

      expect(result.funding_source_id).toBe('funding-2');
      expect(result.updated_at).toBeDefined();
      expect(result.created_at).toBeUndefined();
      expect(result.title).toBe('Updated Title');
      expect(result.description).toBe('Updated Description');
    });

    test('should not include created_at timestamp', () => {
      const opportunity = { id: 'test-id', created_at: '2023-01-01T00:00:00Z' };

      const result = dataSanitizer.prepareForUpdate(opportunity, 'funding-1');

      expect(result.created_at).toBeUndefined();
    });
  });

  describe('sanitizeOpportunityId', () => {
    test('should sanitize valid opportunity IDs', () => {
      expect(dataSanitizer.sanitizeOpportunityId('test-id')).toBe('test-id');
      expect(dataSanitizer.sanitizeOpportunityId('  test-id  ')).toBe('test-id');
      expect(dataSanitizer.sanitizeOpportunityId(123)).toBe('123');
    });

    test('should handle invalid opportunity IDs', () => {
      expect(dataSanitizer.sanitizeOpportunityId(null)).toBeNull();
      expect(dataSanitizer.sanitizeOpportunityId(undefined)).toBeNull();
      expect(dataSanitizer.sanitizeOpportunityId('')).toBeNull();
      expect(dataSanitizer.sanitizeOpportunityId('   ')).toBeNull();
    });
  });

  describe('sanitizeTitle', () => {
    test('should sanitize valid titles', () => {
      expect(dataSanitizer.sanitizeTitle('Test Title')).toBe('Test Title');
      expect(dataSanitizer.sanitizeTitle('  Test Title  ')).toBe('Test Title');
    });

    test('should handle invalid titles', () => {
      expect(dataSanitizer.sanitizeTitle(null)).toBeNull();
      expect(dataSanitizer.sanitizeTitle(undefined)).toBeNull();
      expect(dataSanitizer.sanitizeTitle('')).toBeNull();
      expect(dataSanitizer.sanitizeTitle('   ')).toBeNull();
    });

    test('should truncate long titles', () => {
      const longTitle = 'A'.repeat(600);
      const result = dataSanitizer.sanitizeTitle(longTitle);
      
      expect(result).toBe('A'.repeat(500));
      expect(result.length).toBe(500);
    });
  });

  describe('sanitizeDescription', () => {
    test('should sanitize valid descriptions', () => {
      expect(dataSanitizer.sanitizeDescription('Test Description')).toBe('Test Description');
      expect(dataSanitizer.sanitizeDescription('  Test Description  ')).toBe('Test Description');
    });

    test('should handle invalid descriptions', () => {
      expect(dataSanitizer.sanitizeDescription(null)).toBeNull();
      expect(dataSanitizer.sanitizeDescription(undefined)).toBeNull();
      expect(dataSanitizer.sanitizeDescription('')).toBeNull();
      expect(dataSanitizer.sanitizeDescription('   ')).toBeNull();
    });

    test('should preserve long descriptions', () => {
      const longDescription = 'A'.repeat(1000);
      const result = dataSanitizer.sanitizeDescription(longDescription);
      
      expect(result).toBe(longDescription);
      expect(result.length).toBe(1000);
    });
  });

  describe('sanitizeUrl', () => {
    test('should sanitize valid URLs', () => {
      expect(dataSanitizer.sanitizeUrl('https://example.com')).toBe('https://example.com');
      expect(dataSanitizer.sanitizeUrl('http://example.com')).toBe('http://example.com');
      expect(dataSanitizer.sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
    });

    test('should add protocol to URLs without one', () => {
      expect(dataSanitizer.sanitizeUrl('example.com')).toBe('https://example.com');
      expect(dataSanitizer.sanitizeUrl('www.example.com')).toBe('https://www.example.com');
    });

    test('should handle invalid URLs', () => {
      expect(dataSanitizer.sanitizeUrl(null)).toBeNull();
      expect(dataSanitizer.sanitizeUrl(undefined)).toBeNull();
      expect(dataSanitizer.sanitizeUrl('')).toBeNull();
      expect(dataSanitizer.sanitizeUrl('   ')).toBeNull();
      // 'not-a-url' gets protocol added since it's treated as a hostname
      expect(dataSanitizer.sanitizeUrl('not-a-url')).toBe('https://not-a-url');
      // URL constructor accepts custom schemes as valid
      expect(dataSanitizer.sanitizeUrl('invalid://url')).toBe('invalid://url');
    });
  });

  describe('sanitizeStatus', () => {
    test('should normalize status values', () => {
      expect(dataSanitizer.sanitizeStatus('open')).toBe('open');
      expect(dataSanitizer.sanitizeStatus('active')).toBe('open');
      expect(dataSanitizer.sanitizeStatus('available')).toBe('open');
      expect(dataSanitizer.sanitizeStatus('closed')).toBe('closed');
      expect(dataSanitizer.sanitizeStatus('inactive')).toBe('closed');
      expect(dataSanitizer.sanitizeStatus('expired')).toBe('closed');
      expect(dataSanitizer.sanitizeStatus('upcoming')).toBe('upcoming');
      expect(dataSanitizer.sanitizeStatus('pending')).toBe('upcoming');
      expect(dataSanitizer.sanitizeStatus('future')).toBe('upcoming');
    });

    test('should handle case-insensitive status values', () => {
      expect(dataSanitizer.sanitizeStatus('OPEN')).toBe('open');
      expect(dataSanitizer.sanitizeStatus('Active')).toBe('open');
      expect(dataSanitizer.sanitizeStatus('  CLOSED  ')).toBe('closed');
    });

    test('should handle unknown status values', () => {
      expect(dataSanitizer.sanitizeStatus('unknown')).toBe('unknown');
      expect(dataSanitizer.sanitizeStatus('custom-status')).toBe('custom-status');
    });

    test('should handle invalid status values', () => {
      expect(dataSanitizer.sanitizeStatus(null)).toBeNull();
      expect(dataSanitizer.sanitizeStatus(undefined)).toBeNull();
      expect(dataSanitizer.sanitizeStatus('')).toBeNull();
    });
  });

  describe('sanitizeAmount', () => {
    test('should sanitize numeric amounts', () => {
      expect(dataSanitizer.sanitizeAmount(1000)).toBe(1000);
      expect(dataSanitizer.sanitizeAmount(1000.50)).toBe(1000.50);
      expect(dataSanitizer.sanitizeAmount(0)).toBeNull();
    });

    test('should sanitize string amounts', () => {
      expect(dataSanitizer.sanitizeAmount('1000')).toBe(1000);
      expect(dataSanitizer.sanitizeAmount('$1,000')).toBe(1000);
      expect(dataSanitizer.sanitizeAmount('$1,000.50')).toBe(1000.50);
      expect(dataSanitizer.sanitizeAmount('  $1,000  ')).toBe(1000);
    });

    test('should handle zero and empty amounts', () => {
      expect(dataSanitizer.sanitizeAmount('0')).toBeNull();
      expect(dataSanitizer.sanitizeAmount('')).toBeNull();
      expect(dataSanitizer.sanitizeAmount('   ')).toBeNull();
    });

    test('should handle invalid amounts', () => {
      expect(dataSanitizer.sanitizeAmount(null)).toBeNull();
      expect(dataSanitizer.sanitizeAmount(undefined)).toBeNull();
      expect(dataSanitizer.sanitizeAmount('invalid')).toBeNull();
      expect(dataSanitizer.sanitizeAmount(NaN)).toBeNull();
    });
  });

  describe('sanitizeDate', () => {
    test('should sanitize valid dates', () => {
      const date = new Date('2023-01-01T00:00:00Z');
      expect(dataSanitizer.sanitizeDate(date)).toBe('2023-01-01T00:00:00.000Z');
      expect(dataSanitizer.sanitizeDate('2023-01-01')).toBe('2023-01-01T00:00:00.000Z');
      expect(dataSanitizer.sanitizeDate('2023-01-01T12:00:00Z')).toBe('2023-01-01T12:00:00.000Z');
    });

    test('should handle invalid dates', () => {
      expect(dataSanitizer.sanitizeDate(null)).toBeNull();
      expect(dataSanitizer.sanitizeDate(undefined)).toBeNull();
      expect(dataSanitizer.sanitizeDate('')).toBeNull();
      expect(dataSanitizer.sanitizeDate('invalid-date')).toBeNull();
      expect(dataSanitizer.sanitizeDate('2023-13-01')).toBeNull(); // Invalid month
    });
  });

  describe('sanitizeArray', () => {
    test('should sanitize valid arrays', () => {
      expect(dataSanitizer.sanitizeArray(['item1', 'item2'])).toEqual(['item1', 'item2']);
      expect(dataSanitizer.sanitizeArray([1, 2, 3])).toEqual(['1', '2', '3']);
      expect(dataSanitizer.sanitizeArray(['  item1  ', 'item2'])).toEqual(['item1', 'item2']);
    });

    test('should filter out invalid items', () => {
      expect(dataSanitizer.sanitizeArray(['item1', null, 'item2'])).toEqual(['item1', 'item2']);
      expect(dataSanitizer.sanitizeArray(['item1', undefined, 'item2'])).toEqual(['item1', 'item2']);
      expect(dataSanitizer.sanitizeArray(['item1', '', 'item2'])).toEqual(['item1', 'item2']);
      expect(dataSanitizer.sanitizeArray(['item1', '   ', 'item2'])).toEqual(['item1', 'item2']);
    });

    test('should handle empty arrays', () => {
      expect(dataSanitizer.sanitizeArray([])).toBeNull();
      expect(dataSanitizer.sanitizeArray([null, undefined, ''])).toBeNull();
    });

    test('should handle non-arrays', () => {
      expect(dataSanitizer.sanitizeArray(null)).toBeNull();
      expect(dataSanitizer.sanitizeArray(undefined)).toBeNull();
      expect(dataSanitizer.sanitizeArray('not-an-array')).toBeNull();
    });
  });

  describe('sanitizeBoolean', () => {
    test('should sanitize boolean values', () => {
      expect(dataSanitizer.sanitizeBoolean(true)).toBe(true);
      expect(dataSanitizer.sanitizeBoolean(false)).toBe(false);
    });

    test('should sanitize string boolean values', () => {
      expect(dataSanitizer.sanitizeBoolean('true')).toBe(true);
      expect(dataSanitizer.sanitizeBoolean('yes')).toBe(true);
      expect(dataSanitizer.sanitizeBoolean('1')).toBe(true);
      expect(dataSanitizer.sanitizeBoolean('false')).toBe(false);
      expect(dataSanitizer.sanitizeBoolean('no')).toBe(false);
      expect(dataSanitizer.sanitizeBoolean('0')).toBe(false);
    });

    test('should handle case-insensitive string values', () => {
      expect(dataSanitizer.sanitizeBoolean('TRUE')).toBe(true);
      expect(dataSanitizer.sanitizeBoolean('Yes')).toBe(true);
      expect(dataSanitizer.sanitizeBoolean('FALSE')).toBe(false);
      expect(dataSanitizer.sanitizeBoolean('No')).toBe(false);
      expect(dataSanitizer.sanitizeBoolean('  true  ')).toBe(true);
    });

    test('should handle invalid boolean values', () => {
      expect(dataSanitizer.sanitizeBoolean(null)).toBeNull();
      expect(dataSanitizer.sanitizeBoolean(undefined)).toBeNull();
      expect(dataSanitizer.sanitizeBoolean('invalid')).toBeNull();
      expect(dataSanitizer.sanitizeBoolean(123)).toBeNull();
    });
  });

  describe('sanitizePercentage', () => {
    test('should sanitize valid percentages', () => {
      expect(dataSanitizer.sanitizePercentage(50)).toBe(50);
      expect(dataSanitizer.sanitizePercentage(25.5)).toBe(25.5);
      expect(dataSanitizer.sanitizePercentage('75')).toBe(75);
      expect(dataSanitizer.sanitizePercentage('50.5')).toBe(50.5);
    });

    test('should clamp percentages to 0-100 range', () => {
      expect(dataSanitizer.sanitizePercentage(-10)).toBe(0);
      expect(dataSanitizer.sanitizePercentage(110)).toBe(100);
      expect(dataSanitizer.sanitizePercentage(0)).toBe(0);
      expect(dataSanitizer.sanitizePercentage(100)).toBe(100);
    });

    test('should handle invalid percentages', () => {
      expect(dataSanitizer.sanitizePercentage(null)).toBeNull();
      expect(dataSanitizer.sanitizePercentage(undefined)).toBeNull();
      expect(dataSanitizer.sanitizePercentage('invalid')).toBeNull();
      expect(dataSanitizer.sanitizePercentage(NaN)).toBeNull();
    });
  });

  describe('sanitizeValue', () => {
    test('should sanitize string values', () => {
      expect(dataSanitizer.sanitizeValue('test', 'field')).toBe('test');
      expect(dataSanitizer.sanitizeValue('  test  ', 'field')).toBe('test');
      expect(dataSanitizer.sanitizeValue('', 'field')).toBeNull();
      expect(dataSanitizer.sanitizeValue('   ', 'field')).toBeNull();
    });

    test('should sanitize array values', () => {
      expect(dataSanitizer.sanitizeValue(['item1', 'item2'], 'field')).toEqual(['item1', 'item2']);
      expect(dataSanitizer.sanitizeValue(['item1', null, 'item2'], 'field')).toEqual(['item1', 'item2']);
      expect(dataSanitizer.sanitizeValue(['item1', '', 'item2'], 'field')).toEqual(['item1', 'item2']);
    });

    test('should handle null and undefined values', () => {
      expect(dataSanitizer.sanitizeValue(null, 'field')).toBeNull();
      expect(dataSanitizer.sanitizeValue(undefined, 'field')).toBeNull();
    });

    test('should pass through other value types', () => {
      expect(dataSanitizer.sanitizeValue(123, 'field')).toBe(123);
      expect(dataSanitizer.sanitizeValue(true, 'field')).toBe(true);
      expect(dataSanitizer.sanitizeValue({}, 'field')).toEqual({});
    });
  });

  describe('sanitizeFields', () => {
    test('should sanitize all opportunity fields', () => {
      const opportunity = {
        id: 'test-id',
        title: 'Test Title',
        description: 'Test Description',
        url: 'https://example.com',
        status: 'open',
        minimumAward: 1000,
        maximumAward: 5000,
        totalFundingAvailable: 10000,
        openDate: '2023-01-01',
        closeDate: '2023-12-31',
        eligibleApplicants: ['nonprofits', 'governments'],
        eligibleProjectTypes: ['renewable energy'],
        categories: ['energy', 'environment'],
        tags: ['solar', 'wind'],
        matchingRequired: true,
        isNational: false,
        matchingPercentage: 25,
        api_updated_at: '2023-06-01T00:00:00Z'
      };

      const result = dataSanitizer.sanitizeFields(opportunity);

      expect(result.api_opportunity_id).toBe('test-id');
      expect(result.title).toBe('Test Title');
      expect(result.description).toBe('Test Description');
      expect(result.url).toBe('https://example.com');
      expect(result.status).toBe('open');
      expect(result.minimum_award).toBe(1000);
      expect(result.maximum_award).toBe(5000);
      expect(result.total_funding_available).toBe(10000);
      expect(result.open_date).toBe('2023-01-01T00:00:00.000Z');
      expect(result.close_date).toBe('2023-12-31T00:00:00.000Z');
      expect(result.eligible_applicants).toEqual(['nonprofits', 'governments']);
      expect(result.eligible_project_types).toEqual(['renewable energy']);
      expect(result.categories).toEqual(['energy', 'environment']);
      expect(result.tags).toEqual(['solar', 'wind']);
      expect(result.matching_required).toBe(true);
      expect(result.is_national).toBe(false);
      expect(result.matching_percentage).toBe(25);
      expect(result.api_updated_at).toBe('2023-06-01T00:00:00.000Z');
    });

    test('should handle empty opportunity object', () => {
      const opportunity = {};
      const result = dataSanitizer.sanitizeFields(opportunity);

      expect(result.api_opportunity_id).toBeNull();
      expect(result.title).toBeNull();
      expect(result.description).toBeNull();
      expect(result.url).toBeNull();
      expect(result.status).toBeNull();
    });
  });

  describe('edge cases and error scenarios', () => {
    test('should handle mixed data types gracefully', () => {
      expect(dataSanitizer.sanitizeTitle(123)).toBe('123');
      expect(dataSanitizer.sanitizeDescription(456)).toBe('456');
      expect(dataSanitizer.sanitizeOpportunityId({ id: 'test' })).toBe('[object Object]');
    });

    test('should handle extremely large numbers', () => {
      const largeNumber = Number.MAX_SAFE_INTEGER;
      expect(dataSanitizer.sanitizeAmount(largeNumber)).toBe(largeNumber);
      expect(dataSanitizer.sanitizePercentage(largeNumber)).toBe(100);
    });

    test('should handle special characters in strings', () => {
      const specialChars = 'Title with émojis 🎉 & symbols @#$%';
      expect(dataSanitizer.sanitizeTitle(specialChars)).toBe(specialChars);
      expect(dataSanitizer.sanitizeDescription(specialChars)).toBe(specialChars);
    });

    test('should handle arrays with mixed types', () => {
      const mixedArray = ['string', 123, true, null, undefined, '', '  '];
      const result = dataSanitizer.sanitizeArray(mixedArray);
      expect(result).toEqual(['string', '123', 'true']);
    });

    test('should handle complex URL edge cases', () => {
      expect(dataSanitizer.sanitizeUrl('ftp://example.com')).toBe('ftp://example.com');
      expect(dataSanitizer.sanitizeUrl('https://example.com/path?query=value')).toBe('https://example.com/path?query=value');
      // URL constructor treats this as a valid URL (scheme:path format)
      expect(dataSanitizer.sanitizeUrl('example.com:8080')).toBe('example.com:8080');
    });
  });
});