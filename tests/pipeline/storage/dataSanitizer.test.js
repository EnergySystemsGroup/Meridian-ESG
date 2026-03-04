/**
 * Pipeline: Data Sanitizer Tests
 *
 * Tests data sanitization before storage:
 * - String cleanup (trim, normalize whitespace)
 * - Date normalization
 * - Number parsing
 * - Array deduplication
 * - XSS prevention
 *
 * NOTE: Data sanitization is deterministic.
 */

import { describe, test, expect } from 'vitest';

/**
 * Sanitize string field
 */
function sanitizeString(value, options = {}) {
  const { maxLength = 10000, allowHtml = false } = options;

  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return String(value);

  let sanitized = value;

  // Trim whitespace
  sanitized = sanitized.trim();

  // Normalize internal whitespace (multiple spaces -> single space)
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Strip HTML tags if not allowed
  if (!allowHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized || null; // Return null for empty strings
}

/**
 * Sanitize date field to ISO format
 */
function sanitizeDate(value) {
  if (value === null || value === undefined || value === '') return null;

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(value)) {
    return value;
  }

  // Try to parse various date formats
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return null; // Invalid date
  }

  return date.toISOString();
}

/**
 * Sanitize number field
 */
function sanitizeNumber(value, options = {}) {
  const { min = null, max = null, allowFloat = true } = options;

  if (value === null || value === undefined || value === '') return null;

  // Parse string numbers
  let num;
  if (typeof value === 'string') {
    // Remove currency symbols, commas
    const cleaned = value.replace(/[$,]/g, '').trim();
    num = parseFloat(cleaned);
  } else {
    num = Number(value);
  }

  // Check validity
  if (isNaN(num)) return null;
  if (!isFinite(num)) return null;

  // Apply constraints
  if (min !== null && num < min) return min;
  if (max !== null && num > max) return max;

  // Integer conversion if needed
  if (!allowFloat) {
    num = Math.floor(num);
  }

  return num;
}

/**
 * Sanitize array field
 */
function sanitizeArray(value, options = {}) {
  const { dedup = true, filterEmpty = true, maxItems = 100 } = options;

  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return [value];

  let arr = value;

  // Filter empty/null values
  if (filterEmpty) {
    arr = arr.filter(item => item !== null && item !== undefined && item !== '');
  }

  // Sanitize each item if string
  arr = arr.map(item => (typeof item === 'string' ? sanitizeString(item) : item));

  // Filter null items after sanitization
  arr = arr.filter(item => item !== null);

  // Deduplicate
  if (dedup) {
    arr = [...new Set(arr)];
  }

  // Limit items
  if (arr.length > maxItems) {
    arr = arr.slice(0, maxItems);
  }

  return arr;
}

/**
 * Sanitize URL field
 */
function sanitizeUrl(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  // Basic URL validation
  try {
    const url = new URL(trimmed);
    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.href;
  } catch {
    // Try adding https if missing protocol
    if (!trimmed.startsWith('http')) {
      try {
        const url = new URL('https://' + trimmed);
        return url.href;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Sanitize full opportunity object
 */
function sanitizeOpportunity(opp) {
  return {
    title: sanitizeString(opp.title, { maxLength: 500 }),
    agency_name: sanitizeString(opp.agency_name, { maxLength: 200 }),
    program_overview: sanitizeString(opp.program_overview, { maxLength: 5000 }),
    description: sanitizeString(opp.description, { maxLength: 10000 }),
    open_date: sanitizeDate(opp.open_date),
    close_date: sanitizeDate(opp.close_date),
    minimum_award: sanitizeNumber(opp.minimum_award, { min: 0 }),
    maximum_award: sanitizeNumber(opp.maximum_award, { min: 0 }),
    total_funding_available: sanitizeNumber(opp.total_funding_available, { min: 0 }),
    expected_awards: sanitizeNumber(opp.expected_awards, { min: 0, allowFloat: false }),
    eligible_applicant_types: sanitizeArray(opp.eligible_applicant_types),
    eligible_project_types: sanitizeArray(opp.eligible_project_types),
    application_url: sanitizeUrl(opp.application_url),
    source_url: sanitizeUrl(opp.source_url),
  };
}

describe('Pipeline: Data Sanitizer', () => {

  describe('String Sanitization', () => {
    test('trims whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
      expect(sanitizeString('\n\thello\t\n')).toBe('hello');
    });

    test('normalizes internal whitespace', () => {
      expect(sanitizeString('hello   world')).toBe('hello world');
      expect(sanitizeString('a\t\nb\nc')).toBe('a b c');
    });

    test('removes control characters', () => {
      expect(sanitizeString('hello\x00world')).toBe('helloworld');
      expect(sanitizeString('test\x1Fdata')).toBe('testdata');
    });

    test('strips HTML tags by default', () => {
      expect(sanitizeString('<b>hello</b>')).toBe('hello');
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    test('allows HTML when specified', () => {
      expect(sanitizeString('<b>hello</b>', { allowHtml: true })).toBe('<b>hello</b>');
    });

    test('enforces max length', () => {
      const long = 'a'.repeat(1000);
      expect(sanitizeString(long, { maxLength: 100 }).length).toBe(100);
    });

    test('returns null for empty string after trim', () => {
      expect(sanitizeString('   ')).toBeNull();
      expect(sanitizeString('\n\t')).toBeNull();
    });

    test('returns null for null input', () => {
      expect(sanitizeString(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(sanitizeString(undefined)).toBeNull();
    });

    test('converts non-strings to strings', () => {
      expect(sanitizeString(12345)).toBe('12345');
      expect(sanitizeString(true)).toBe('true');
    });
  });

  describe('Date Sanitization', () => {
    test('passes through ISO date', () => {
      expect(sanitizeDate('2025-03-15')).toBe('2025-03-15');
    });

    test('passes through ISO datetime', () => {
      expect(sanitizeDate('2025-03-15T23:59:59Z')).toBe('2025-03-15T23:59:59Z');
    });

    test('converts human readable dates', () => {
      const result = sanitizeDate('March 15, 2025');
      expect(result).toContain('2025');
      expect(result).toContain('03');
    });

    test('converts other date formats', () => {
      const result = sanitizeDate('03/15/2025');
      expect(result).toMatch(/^2025-03-15/);
    });

    test('returns null for invalid date', () => {
      expect(sanitizeDate('not a date')).toBeNull();
      expect(sanitizeDate('13/45/2025')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(sanitizeDate('')).toBeNull();
    });

    test('returns null for null', () => {
      expect(sanitizeDate(null)).toBeNull();
    });
  });

  describe('Number Sanitization', () => {
    test('passes through valid numbers', () => {
      expect(sanitizeNumber(12345)).toBe(12345);
      expect(sanitizeNumber(123.45)).toBe(123.45);
    });

    test('parses string numbers', () => {
      expect(sanitizeNumber('12345')).toBe(12345);
      expect(sanitizeNumber('123.45')).toBe(123.45);
    });

    test('removes currency formatting', () => {
      expect(sanitizeNumber('$1,000,000')).toBe(1000000);
      expect(sanitizeNumber('$5,000.50')).toBe(5000.50);
    });

    test('enforces minimum', () => {
      expect(sanitizeNumber(-100, { min: 0 })).toBe(0);
    });

    test('enforces maximum', () => {
      expect(sanitizeNumber(1000, { max: 100 })).toBe(100);
    });

    test('converts to integer when specified', () => {
      expect(sanitizeNumber(123.99, { allowFloat: false })).toBe(123);
    });

    test('returns null for NaN', () => {
      expect(sanitizeNumber(NaN)).toBeNull();
    });

    test('returns null for Infinity', () => {
      expect(sanitizeNumber(Infinity)).toBeNull();
    });

    test('returns null for invalid string', () => {
      expect(sanitizeNumber('not a number')).toBeNull();
    });

    test('returns null for null', () => {
      expect(sanitizeNumber(null)).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(sanitizeNumber('')).toBeNull();
    });
  });

  describe('Array Sanitization', () => {
    test('returns array unchanged', () => {
      expect(sanitizeArray(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    });

    test('deduplicates by default', () => {
      expect(sanitizeArray(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
    });

    test('filters empty values by default', () => {
      expect(sanitizeArray(['a', '', null, 'b', undefined])).toEqual(['a', 'b']);
    });

    test('sanitizes string items', () => {
      expect(sanitizeArray(['  hello  ', 'world  '])).toEqual(['hello', 'world']);
    });

    test('limits array length', () => {
      // Create unique items so dedup doesn't reduce the count
      const long = Array(200).fill(0).map((_, i) => `item-${i}`);
      expect(sanitizeArray(long, { maxItems: 100 }).length).toBe(100);
    });

    test('returns empty array for null', () => {
      expect(sanitizeArray(null)).toEqual([]);
    });

    test('wraps non-array in array', () => {
      expect(sanitizeArray('single')).toEqual(['single']);
    });

    test('can disable deduplication', () => {
      expect(sanitizeArray(['a', 'a', 'a'], { dedup: false })).toEqual(['a', 'a', 'a']);
    });
  });

  describe('URL Sanitization', () => {
    test('passes valid http URL', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
    });

    test('passes valid https URL', () => {
      expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
    });

    test('adds https to bare domain', () => {
      expect(sanitizeUrl('example.com')).toBe('https://example.com/');
    });

    test('trims whitespace', () => {
      expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com/');
    });

    test('rejects javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    });

    test('rejects ftp URLs', () => {
      expect(sanitizeUrl('ftp://example.com')).toBeNull();
    });

    test('returns null for invalid URL', () => {
      expect(sanitizeUrl('not a url')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(sanitizeUrl('')).toBeNull();
    });

    test('returns null for null', () => {
      expect(sanitizeUrl(null)).toBeNull();
    });
  });

  describe('Full Opportunity Sanitization', () => {
    test('sanitizes all fields', () => {
      const dirty = {
        title: '  <b>Test Grant</b>  ',
        agency_name: '  Department   of   Energy  ',
        program_overview: 'Overview\n\nwith\x00control\x1Fchars',
        open_date: 'March 15, 2025',
        close_date: '2025-06-30',
        minimum_award: '$10,000',
        maximum_award: '$1,000,000',
        eligible_applicant_types: ['Municipal', 'Municipal', '  State  ', ''],
        application_url: 'grants.gov/opportunity',
        source_url: 'https://grants.gov/search',
      };

      const clean = sanitizeOpportunity(dirty);

      expect(clean.title).toBe('Test Grant');
      expect(clean.agency_name).toBe('Department of Energy');
      expect(clean.program_overview).not.toContain('\x00');
      expect(clean.open_date).toContain('2025');
      expect(clean.close_date).toBe('2025-06-30');
      expect(clean.minimum_award).toBe(10000);
      expect(clean.maximum_award).toBe(1000000);
      expect(clean.eligible_applicant_types).toEqual(['Municipal', 'State']);
      expect(clean.application_url).toBe('https://grants.gov/opportunity');
      expect(clean.source_url).toBe('https://grants.gov/search');
    });

    test('handles missing fields', () => {
      const minimal = {
        title: 'Test Grant',
      };

      const clean = sanitizeOpportunity(minimal);

      expect(clean.title).toBe('Test Grant');
      expect(clean.agency_name).toBeNull();
      expect(clean.close_date).toBeNull();
      expect(clean.maximum_award).toBeNull();
      expect(clean.eligible_applicant_types).toEqual([]);
    });

    test('enforces field length limits', () => {
      const oversize = {
        title: 'a'.repeat(1000),
        program_overview: 'b'.repeat(10000),
      };

      const clean = sanitizeOpportunity(oversize);

      expect(clean.title.length).toBeLessThanOrEqual(500);
      expect(clean.program_overview.length).toBeLessThanOrEqual(5000);
    });

    test('enforces non-negative funding amounts', () => {
      const negative = {
        title: 'Test',
        minimum_award: -1000,
        maximum_award: -5000,
      };

      const clean = sanitizeOpportunity(negative);

      expect(clean.minimum_award).toBe(0);
      expect(clean.maximum_award).toBe(0);
    });
  });

  describe('XSS Prevention', () => {
    test('removes script tags', () => {
      const xss = '<script>alert("xss")</script>Important info';
      expect(sanitizeString(xss)).toBe('alert("xss")Important info');
    });

    test('removes event handlers', () => {
      const xss = '<img src=x onerror=alert(1)>test';
      expect(sanitizeString(xss)).toBe('test');
    });

    test('removes javascript: in URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    });

    test('removes data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    });
  });
});
