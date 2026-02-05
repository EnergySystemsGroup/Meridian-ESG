/**
 * Pipeline: Staging Import Tests
 *
 * Tests the discovery file → staging table import process:
 * - Discovery file parsing
 * - Source ID resolution
 * - Duplicate URL detection
 * - Import record building
 */

import { describe, test, expect } from 'vitest';

/**
 * Parse a discovery file into importable records
 */
function parseDiscoveryFile(fileContent) {
  if (!fileContent || !Array.isArray(fileContent)) {
    return { records: [], errors: ['Invalid file content: expected array'] };
  }

  const records = [];
  const errors = [];

  for (let i = 0; i < fileContent.length; i++) {
    const program = fileContent[i];
    const validation = validateDiscoveryRecord(program, i);

    if (validation.valid) {
      records.push({
        title: program.title.trim(),
        url: normalizeUrl(program.url),
        content_type: program.content_type || 'html',
        utility_name: program.utility_name || null,
        state_code: program.state_code || null,
        discovery_method: 'cc_agent',
        discovered_by: 'discovery_agent',
      });
    } else {
      errors.push(...validation.errors.map(e => `Record ${i}: ${e}`));
    }
  }

  return { records, errors };
}

function validateDiscoveryRecord(record, index) {
  const errors = [];

  if (!record.title || typeof record.title !== 'string' || record.title.trim() === '') {
    errors.push('Missing or empty title');
  }

  if (!record.url || typeof record.url !== 'string') {
    errors.push('Missing URL');
  } else if (!record.url.startsWith('http')) {
    errors.push('Invalid URL format');
  }

  return { valid: errors.length === 0, errors };
}

function normalizeUrl(url) {
  if (!url) return url;
  // Remove trailing slash, fragment, normalize to lowercase host
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    let normalized = parsed.toString();
    if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Resolve utility name to source_id
 */
function resolveSourceId(utilityName, sourceLookup) {
  if (!utilityName) return null;

  // Strip parenthetical suffix: "PG&E (Pacific Gas & Electric)" → "PG&E"
  const cleanName = utilityName.replace(/\s*\(.*\)\s*$/, '').trim();

  // Look up by exact match first
  if (sourceLookup[cleanName]) return sourceLookup[cleanName];

  // Case-insensitive match
  const lowerName = cleanName.toLowerCase();
  for (const [name, id] of Object.entries(sourceLookup)) {
    if (name.toLowerCase() === lowerName) return id;
  }

  return null;
}

/**
 * Deduplicate by URL
 */
function deduplicateByUrl(records, existingUrls = new Set()) {
  const seen = new Set(existingUrls);
  const unique = [];
  const duplicates = [];

  for (const record of records) {
    if (seen.has(record.url)) {
      duplicates.push(record);
    } else {
      seen.add(record.url);
      unique.push(record);
    }
  }

  return { unique, duplicates };
}

/**
 * Build staging insert records
 */
function buildStagingInserts(records, sourceResolver) {
  return records.map(r => ({
    source_id: sourceResolver(r.utility_name) || null,
    title: r.title,
    url: r.url,
    content_type: r.content_type,
    discovery_method: r.discovery_method,
    discovered_by: r.discovered_by,
    extraction_status: 'pending',
    analysis_status: 'pending',
    storage_status: 'pending',
  }));
}

describe('Staging Import', () => {

  describe('Discovery File Parsing', () => {
    test('parses valid discovery file', () => {
      const file = [
        { title: 'Program A', url: 'https://example.com/a', utility_name: 'PG&E' },
        { title: 'Program B', url: 'https://example.com/b', utility_name: 'SCE' },
      ];

      const result = parseDiscoveryFile(file);
      expect(result.records).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects null input', () => {
      const result = parseDiscoveryFile(null);
      expect(result.records).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('rejects records with missing title', () => {
      const file = [{ url: 'https://example.com/a' }];
      const result = parseDiscoveryFile(file);
      expect(result.records).toHaveLength(0);
      expect(result.errors[0]).toContain('title');
    });

    test('rejects records with missing URL', () => {
      const file = [{ title: 'Program A' }];
      const result = parseDiscoveryFile(file);
      expect(result.records).toHaveLength(0);
      expect(result.errors[0]).toContain('URL');
    });

    test('rejects invalid URL format', () => {
      const file = [{ title: 'Program A', url: 'not-a-url' }];
      const result = parseDiscoveryFile(file);
      expect(result.records).toHaveLength(0);
    });

    test('defaults content_type to html', () => {
      const file = [{ title: 'Program A', url: 'https://example.com/a' }];
      const result = parseDiscoveryFile(file);
      expect(result.records[0].content_type).toBe('html');
    });

    test('preserves specified content_type', () => {
      const file = [{ title: 'Program A', url: 'https://example.com/a.pdf', content_type: 'pdf' }];
      const result = parseDiscoveryFile(file);
      expect(result.records[0].content_type).toBe('pdf');
    });

    test('trims whitespace from title', () => {
      const file = [{ title: '  Program A  ', url: 'https://example.com/a' }];
      const result = parseDiscoveryFile(file);
      expect(result.records[0].title).toBe('Program A');
    });

    test('mixed valid/invalid records', () => {
      const file = [
        { title: 'Good', url: 'https://example.com/good' },
        { title: '', url: 'https://example.com/bad' },
        { title: 'Also Good', url: 'https://example.com/also-good' },
      ];

      const result = parseDiscoveryFile(file);
      expect(result.records).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('URL Normalization', () => {
    test('removes trailing slash', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    });

    test('removes fragment', () => {
      expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
    });

    test('preserves path and query', () => {
      const url = 'https://example.com/path?key=value';
      expect(normalizeUrl(url)).toBe(url);
    });

    test('handles null', () => {
      expect(normalizeUrl(null)).toBeNull();
    });
  });

  describe('Source ID Resolution', () => {
    const sourceLookup = {
      'PG&E': 'src-pge',
      'SCE': 'src-sce',
      'SDG&E': 'src-sdge',
    };

    test('resolves exact match', () => {
      expect(resolveSourceId('PG&E', sourceLookup)).toBe('src-pge');
    });

    test('case-insensitive match', () => {
      expect(resolveSourceId('pg&e', sourceLookup)).toBe('src-pge');
    });

    test('strips parenthetical suffix', () => {
      expect(resolveSourceId('PG&E (Pacific Gas & Electric)', sourceLookup)).toBe('src-pge');
    });

    test('returns null for unknown utility', () => {
      expect(resolveSourceId('Unknown Utility', sourceLookup)).toBeNull();
    });

    test('returns null for null input', () => {
      expect(resolveSourceId(null, sourceLookup)).toBeNull();
    });
  });

  describe('URL Deduplication', () => {
    test('removes duplicate URLs within batch', () => {
      const records = [
        { title: 'A', url: 'https://example.com/a' },
        { title: 'B', url: 'https://example.com/b' },
        { title: 'A dup', url: 'https://example.com/a' },
      ];

      const { unique, duplicates } = deduplicateByUrl(records);
      expect(unique).toHaveLength(2);
      expect(duplicates).toHaveLength(1);
    });

    test('removes URLs already in database', () => {
      const records = [
        { title: 'A', url: 'https://example.com/a' },
        { title: 'B', url: 'https://example.com/b' },
      ];

      const existingUrls = new Set(['https://example.com/a']);
      const { unique, duplicates } = deduplicateByUrl(records, existingUrls);

      expect(unique).toHaveLength(1);
      expect(unique[0].url).toBe('https://example.com/b');
      expect(duplicates).toHaveLength(1);
    });

    test('all unique returns all', () => {
      const records = [
        { title: 'A', url: 'https://example.com/a' },
        { title: 'B', url: 'https://example.com/b' },
      ];

      const { unique } = deduplicateByUrl(records);
      expect(unique).toHaveLength(2);
    });
  });

  describe('Staging Insert Building', () => {
    test('builds correct insert records', () => {
      const records = [
        { title: 'Program A', url: 'https://example.com/a', content_type: 'html', utility_name: 'PG&E', discovery_method: 'cc_agent', discovered_by: 'discovery_agent' },
      ];

      const resolver = (name) => name === 'PG&E' ? 'src-pge' : null;
      const inserts = buildStagingInserts(records, resolver);

      expect(inserts).toHaveLength(1);
      expect(inserts[0].source_id).toBe('src-pge');
      expect(inserts[0].extraction_status).toBe('pending');
      expect(inserts[0].analysis_status).toBe('pending');
      expect(inserts[0].storage_status).toBe('pending');
    });

    test('null source_id when utility not found', () => {
      const records = [
        { title: 'Program A', url: 'https://example.com/a', content_type: 'html', utility_name: 'Unknown', discovery_method: 'cc_agent', discovered_by: 'discovery_agent' },
      ];

      const resolver = () => null;
      const inserts = buildStagingInserts(records, resolver);

      expect(inserts[0].source_id).toBeNull();
    });
  });
});
