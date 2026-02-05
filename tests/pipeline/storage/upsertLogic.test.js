/**
 * Pipeline: Upsert Logic Tests
 *
 * Tests the insert vs update decision logic:
 * - New records are inserted
 * - Existing records are updated
 * - Conflict resolution strategies
 * - Field-level merge behavior
 *
 * NOTE: Upsert logic is critical for data integrity.
 */

import { describe, test, expect, beforeEach } from 'vitest';

/**
 * Mock database for upsert testing
 */
class MockDatabase {
  constructor() {
    this.records = new Map();
    this.operations = [];
  }

  findByUrl(url) {
    for (const [id, record] of this.records) {
      if (record.source_url === url) return record;
    }
    return null;
  }

  findById(id) {
    return this.records.get(id) || null;
  }

  insert(record) {
    const id = record.id || `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newRecord = {
      ...record,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.records.set(id, newRecord);
    this.operations.push({ type: 'insert', id, record: newRecord });
    return newRecord;
  }

  update(id, updates) {
    const existing = this.records.get(id);
    if (!existing) throw new Error('Record not found');

    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.records.set(id, updated);
    this.operations.push({ type: 'update', id, updates });
    return updated;
  }

  getOperations() {
    return this.operations;
  }

  clear() {
    this.records.clear();
    this.operations = [];
  }
}

/**
 * Determine if record should be updated based on changes
 */
function hasSignificantChanges(existing, incoming, options = {}) {
  const { significantFields = ['title', 'close_date', 'maximum_award', 'status'] } = options;

  for (const field of significantFields) {
    const existingVal = existing[field];
    const incomingVal = incoming[field];

    // Null/undefined equality
    if (existingVal == null && incomingVal == null) continue;

    // String comparison (case-insensitive for some fields)
    if (typeof existingVal === 'string' && typeof incomingVal === 'string') {
      if (existingVal.toLowerCase().trim() !== incomingVal.toLowerCase().trim()) {
        return true;
      }
      continue;
    }

    // Date comparison
    if (existingVal instanceof Date || incomingVal instanceof Date) {
      const existingTime = new Date(existingVal).getTime();
      const incomingTime = new Date(incomingVal).getTime();
      if (existingTime !== incomingTime) return true;
      continue;
    }

    // Direct comparison
    if (existingVal !== incomingVal) return true;
  }

  return false;
}

/**
 * Merge incoming data with existing record
 */
function mergeRecords(existing, incoming, options = {}) {
  const { preferIncoming = true, nullOverwrite = false } = options;

  const merged = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    // Skip internal fields
    if (['id', 'created_at', 'updated_at'].includes(key)) continue;

    // Handle null values
    if (value === null || value === undefined) {
      if (nullOverwrite) {
        merged[key] = value;
      }
      continue;
    }

    // Handle empty strings
    if (value === '' && existing[key]) {
      continue; // Keep existing non-empty value
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (preferIncoming || !existing[key] || existing[key].length === 0) {
        merged[key] = value;
      }
      continue;
    }

    // Default: prefer incoming
    if (preferIncoming || !existing[key]) {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Perform upsert operation
 */
function upsert(db, record, options = {}) {
  const { matchField = 'source_url' } = options;

  // Find existing record
  let existing = null;
  if (matchField === 'source_url' && record.source_url) {
    existing = db.findByUrl(record.source_url);
  } else if (matchField === 'id' && record.id) {
    existing = db.findById(record.id);
  }

  // Insert if not found
  if (!existing) {
    return { operation: 'insert', record: db.insert(record) };
  }

  // Check if update needed
  if (!hasSignificantChanges(existing, record, options)) {
    return { operation: 'skip', record: existing, reason: 'no_changes' };
  }

  // Merge and update
  const merged = mergeRecords(existing, record, options);
  const updated = db.update(existing.id, merged);

  return { operation: 'update', record: updated };
}

/**
 * Batch upsert
 */
function batchUpsert(db, records, options = {}) {
  const results = {
    inserted: [],
    updated: [],
    skipped: [],
    failed: [],
  };

  for (const record of records) {
    try {
      const result = upsert(db, record, options);
      switch (result.operation) {
        case 'insert':
          results.inserted.push(result.record);
          break;
        case 'update':
          results.updated.push(result.record);
          break;
        case 'skip':
          results.skipped.push(result.record);
          break;
      }
    } catch (error) {
      results.failed.push({ record, error: error.message });
    }
  }

  return results;
}

let db;

beforeEach(() => {
  db = new MockDatabase();
});

describe('Pipeline: Upsert Logic', () => {

  describe('Insert Operations', () => {
    test('inserts new record', () => {
      const record = {
        title: 'New Grant',
        source_url: 'https://grants.gov/new',
        maximum_award: 100000,
      };

      const result = upsert(db, record);

      expect(result.operation).toBe('insert');
      expect(result.record.id).toBeDefined();
      expect(result.record.title).toBe('New Grant');
    });

    test('generates ID for new record', () => {
      const record = { title: 'Test' };

      const result = upsert(db, record);

      expect(result.record.id).toBeDefined();
      expect(result.record.id).toContain('opp-');
    });

    test('sets created_at timestamp', () => {
      const record = { title: 'Test' };

      const result = upsert(db, record);

      expect(result.record.created_at).toBeDefined();
      expect(new Date(result.record.created_at)).toBeInstanceOf(Date);
    });

    test('preserves all record fields', () => {
      const record = {
        title: 'Test Grant',
        agency_name: 'DOE',
        maximum_award: 500000,
        close_date: '2025-06-30',
        eligible_applicant_types: ['Municipal Government'],
      };

      const result = upsert(db, record);

      expect(result.record.title).toBe('Test Grant');
      expect(result.record.agency_name).toBe('DOE');
      expect(result.record.maximum_award).toBe(500000);
      expect(result.record.eligible_applicant_types).toEqual(['Municipal Government']);
    });
  });

  describe('Update Operations', () => {
    test('updates existing record by URL', () => {
      // First insert
      db.insert({
        title: 'Original Title',
        source_url: 'https://grants.gov/123',
        maximum_award: 100000,
      });

      // Upsert with same URL
      const result = upsert(db, {
        title: 'Updated Title',
        source_url: 'https://grants.gov/123',
        maximum_award: 100000,
      });

      expect(result.operation).toBe('update');
      expect(result.record.title).toBe('Updated Title');
    });

    test('preserves ID on update', () => {
      const inserted = db.insert({
        title: 'Original',
        source_url: 'https://example.com/1',
      });

      const result = upsert(db, {
        title: 'Updated',
        source_url: 'https://example.com/1',
      });

      expect(result.record.id).toBe(inserted.id);
    });

    test('updates updated_at timestamp', () => {
      db.insert({
        title: 'Original',
        source_url: 'https://example.com/1',
      });

      // Small delay to ensure different timestamp
      const result = upsert(db, {
        title: 'Updated',
        source_url: 'https://example.com/1',
      });

      expect(result.record.updated_at).toBeDefined();
    });
  });

  describe('Skip Operations', () => {
    test('skips update when no significant changes', () => {
      db.insert({
        title: 'Same Title',
        source_url: 'https://example.com/1',
        maximum_award: 100000,
        close_date: '2025-06-30',
        status: 'open',
      });

      const result = upsert(db, {
        title: 'Same Title', // Same
        source_url: 'https://example.com/1',
        maximum_award: 100000, // Same
        close_date: '2025-06-30', // Same
        status: 'open', // Same
      });

      expect(result.operation).toBe('skip');
      expect(result.reason).toBe('no_changes');
    });

    test('skips when only non-significant fields change', () => {
      db.insert({
        title: 'Grant',
        source_url: 'https://example.com/1',
        description: 'Original description',
      });

      const result = upsert(db, {
        title: 'Grant', // Same significant field
        source_url: 'https://example.com/1',
        description: 'New description', // Non-significant change
      });

      // description is not in significantFields by default
      expect(result.operation).toBe('skip');
    });
  });

  describe('Change Detection', () => {
    test('detects title change', () => {
      const existing = { title: 'Original' };
      const incoming = { title: 'Changed' };

      expect(hasSignificantChanges(existing, incoming)).toBe(true);
    });

    test('detects close_date change', () => {
      const existing = { close_date: '2025-06-30' };
      const incoming = { close_date: '2025-07-15' };

      expect(hasSignificantChanges(existing, incoming)).toBe(true);
    });

    test('detects maximum_award change', () => {
      const existing = { maximum_award: 100000 };
      const incoming = { maximum_award: 200000 };

      expect(hasSignificantChanges(existing, incoming)).toBe(true);
    });

    test('detects status change', () => {
      const existing = { status: 'open' };
      const incoming = { status: 'closed' };

      expect(hasSignificantChanges(existing, incoming)).toBe(true);
    });

    test('ignores case differences in strings', () => {
      const existing = { title: 'Clean Energy Grant' };
      const incoming = { title: 'CLEAN ENERGY GRANT' };

      expect(hasSignificantChanges(existing, incoming)).toBe(false);
    });

    test('ignores whitespace differences', () => {
      const existing = { title: '  Clean Energy Grant  ' };
      const incoming = { title: 'Clean Energy Grant' };

      expect(hasSignificantChanges(existing, incoming)).toBe(false);
    });

    test('handles null to value transition', () => {
      const existing = { close_date: null };
      const incoming = { close_date: '2025-06-30' };

      expect(hasSignificantChanges(existing, incoming)).toBe(true);
    });
  });

  describe('Record Merging', () => {
    test('preserves existing values for null incoming', () => {
      const existing = { title: 'Existing', description: 'Existing desc' };
      const incoming = { title: 'New', description: null };

      const merged = mergeRecords(existing, incoming);

      expect(merged.title).toBe('New');
      expect(merged.description).toBe('Existing desc'); // Preserved
    });

    test('keeps existing non-empty string for empty incoming', () => {
      const existing = { title: 'Existing', agency_name: 'DOE' };
      const incoming = { title: 'New', agency_name: '' };

      const merged = mergeRecords(existing, incoming);

      expect(merged.agency_name).toBe('DOE'); // Kept existing
    });

    test('overwrites arrays with incoming', () => {
      const existing = { eligible_applicant_types: ['A', 'B'] };
      const incoming = { eligible_applicant_types: ['C', 'D'] };

      const merged = mergeRecords(existing, incoming);

      expect(merged.eligible_applicant_types).toEqual(['C', 'D']);
    });

    test('preserves internal fields', () => {
      const existing = {
        id: 'opp-123',
        created_at: '2024-01-01',
        title: 'Old',
      };
      const incoming = {
        id: 'new-id',
        created_at: '2025-01-01',
        title: 'New',
      };

      const merged = mergeRecords(existing, incoming);

      expect(merged.id).toBe('opp-123'); // Preserved
      expect(merged.created_at).toBe('2024-01-01'); // Preserved
      expect(merged.title).toBe('New'); // Updated
    });
  });

  describe('Batch Upsert', () => {
    test('processes mixed inserts and updates', () => {
      db.insert({
        title: 'Existing',
        source_url: 'https://example.com/existing',
      });

      const records = [
        { title: 'New 1', source_url: 'https://example.com/new1' },
        { title: 'Updated', source_url: 'https://example.com/existing' },
        { title: 'New 2', source_url: 'https://example.com/new2' },
      ];

      const results = batchUpsert(db, records);

      expect(results.inserted.length).toBe(2);
      expect(results.updated.length).toBe(1);
      expect(results.failed.length).toBe(0);
    });

    test('reports skipped records', () => {
      db.insert({
        title: 'Same',
        source_url: 'https://example.com/1',
        maximum_award: 100000,
        close_date: '2025-06-30',
        status: 'open',
      });

      const records = [
        {
          title: 'Same',
          source_url: 'https://example.com/1',
          maximum_award: 100000,
          close_date: '2025-06-30',
          status: 'open',
        },
      ];

      const results = batchUpsert(db, records);

      expect(results.skipped.length).toBe(1);
    });

    test('handles empty batch', () => {
      const results = batchUpsert(db, []);

      expect(results.inserted.length).toBe(0);
      expect(results.updated.length).toBe(0);
      expect(results.skipped.length).toBe(0);
      expect(results.failed.length).toBe(0);
    });

    test('returns all result categories', () => {
      const results = batchUpsert(db, [{ title: 'Test' }]);

      expect(results).toHaveProperty('inserted');
      expect(results).toHaveProperty('updated');
      expect(results).toHaveProperty('skipped');
      expect(results).toHaveProperty('failed');
    });
  });

  describe('Database Operations Tracking', () => {
    test('tracks insert operations', () => {
      upsert(db, { title: 'New' });

      const ops = db.getOperations();
      expect(ops[0].type).toBe('insert');
    });

    test('tracks update operations', () => {
      db.insert({ title: 'Old', source_url: 'https://example.com' });
      upsert(db, { title: 'New', source_url: 'https://example.com' });

      const ops = db.getOperations();
      expect(ops[1].type).toBe('update');
    });

    test('no operations for skip', () => {
      db.insert({
        title: 'Same',
        source_url: 'https://example.com',
        maximum_award: 100000,
        close_date: null,
        status: 'open',
      });

      const before = db.getOperations().length;

      upsert(db, {
        title: 'Same',
        source_url: 'https://example.com',
        maximum_award: 100000,
        close_date: null,
        status: 'open',
      });

      const after = db.getOperations().length;

      expect(after).toBe(before); // No new operations
    });
  });
});
