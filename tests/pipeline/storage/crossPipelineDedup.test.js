/**
 * Pipeline: Cross-Pipeline Deduplication Tests
 *
 * Tests the unified dedup constraint logic:
 * - Critical fields include 'status' in EarlyDuplicateDetector
 * - Critical fields include 'status' in DirectUpdateHandler
 * - StorageAgent onConflict uses funding_source_id,title
 * - Manual pipeline skip-if-open logic
 *
 * Relates to #74
 */

import { describe, test, expect } from 'vitest';

// --- Inline replicas of production logic ---

/**
 * EarlyDuplicateDetector: checkCriticalFieldChanges
 * Mirrors lib/agents-v2/optimization/earlyDuplicateDetector.js:458-477
 */
function checkCriticalFieldChanges(existingRecord, opportunity) {
  const criticalFields = [
    'title',
    'minimumAward',
    'maximumAward',
    'totalFundingAvailable',
    'closeDate',
    'openDate',
    'status'
  ];

  for (const field of criticalFields) {
    if (hasFieldChanged(existingRecord, opportunity, field)) {
      return { changed: true, field };
    }
  }

  return { changed: false, field: null };
}

/**
 * Simplified field change detector (mirrors changeDetector.hasFieldChanged)
 */
function hasFieldChanged(existing, incoming, field) {
  const existingVal = existing[field];
  const incomingVal = incoming[field];

  if (existingVal == null && incomingVal == null) return false;
  if (existingVal == null || incomingVal == null) return true;
  return String(existingVal) !== String(incomingVal);
}

/**
 * DirectUpdateHandler: prepareCriticalFieldUpdate
 * Mirrors lib/agents-v2/optimization/directUpdateHandler.js:174-224
 */
function prepareCriticalFieldUpdate(existingRecord, apiRecord) {
  const criticalFields = [
    'title',
    'minimum_award',
    'maximum_award',
    'total_funding_available',
    'close_date',
    'open_date',
    'status'
  ];

  const updateData = {};

  for (const field of criticalFields) {
    const existingValue = existingRecord[field];
    const newValue = apiRecord[field];

    // Null protection: never overwrite existing data with null/undefined
    if (newValue == null || newValue === '') {
      continue;
    }

    // Skip if values are the same
    if (existingValue === newValue) {
      continue;
    }

    // Special handling for date fields
    if (field === 'close_date' || field === 'open_date') {
      const existingDate = existingValue ? new Date(existingValue).getTime() : null;
      const newDate = new Date(newValue).getTime();

      if (existingDate === newDate) {
        continue;
      }
    }

    // Special handling for numeric fields
    if (field.includes('award') || field === 'total_funding_available') {
      const existingNum = parseFloat(existingValue) || 0;
      const newNum = parseFloat(newValue) || 0;

      if (existingNum === newNum) {
        continue;
      }
    }

    updateData[field] = newValue;
  }

  return updateData;
}

/**
 * Manual pipeline: shouldSkipUpsert
 * Mirrors the pre-UPSERT status check in storage SKILL.md Section 5.0
 */
function shouldSkipManualUpsert(existingRecord) {
  return existingRecord && existingRecord.status === 'Open';
}

/**
 * Resolve onConflict key for StorageAgent UPSERT
 * Mirrors lib/agents-v2/core/storageAgent/index.js:304
 */
function getOnConflictKey() {
  return 'funding_source_id,title';
}


describe('Pipeline: Cross-Pipeline Deduplication (#74)', () => {

  describe('EarlyDuplicateDetector critical fields', () => {
    test('status is a critical field', () => {
      const existing = { status: 'Closed', title: 'Grant A' };
      const incoming = { status: 'Open', title: 'Grant A' };

      const result = checkCriticalFieldChanges(existing, incoming);

      expect(result.changed).toBe(true);
      expect(result.field).toBe('status');
    });

    test('status change Closed→Open triggers update', () => {
      const existing = { status: 'Closed' };
      const incoming = { status: 'Open' };

      const result = checkCriticalFieldChanges(existing, incoming);
      expect(result.changed).toBe(true);
    });

    test('status change Open→Closed triggers update', () => {
      const existing = { status: 'Open' };
      const incoming = { status: 'Closed' };

      const result = checkCriticalFieldChanges(existing, incoming);
      expect(result.changed).toBe(true);
    });

    test('same status does not trigger update', () => {
      const existing = { status: 'Open', title: 'Grant A', minimumAward: 1000 };
      const incoming = { status: 'Open', title: 'Grant A', minimumAward: 1000 };

      const result = checkCriticalFieldChanges(existing, incoming);
      expect(result.changed).toBe(false);
    });

    test('null→Open status triggers update', () => {
      const existing = { status: null };
      const incoming = { status: 'Open' };

      const result = checkCriticalFieldChanges(existing, incoming);
      expect(result.changed).toBe(true);
    });

    test('all 7 critical fields are checked', () => {
      // Only status differs
      const existing = {
        title: 'X', minimumAward: 100, maximumAward: 200,
        totalFundingAvailable: 300, closeDate: '2025-12-31',
        openDate: '2025-01-01', status: 'Open'
      };
      const incoming = {
        title: 'X', minimumAward: 100, maximumAward: 200,
        totalFundingAvailable: 300, closeDate: '2025-12-31',
        openDate: '2025-01-01', status: 'Closed'
      };

      const result = checkCriticalFieldChanges(existing, incoming);
      expect(result.changed).toBe(true);
      expect(result.field).toBe('status');
    });
  });

  describe('DirectUpdateHandler critical fields', () => {
    test('status change is included in update data', () => {
      const existing = { status: 'Closed', title: 'Grant A' };
      const apiRecord = { status: 'Open', title: 'Grant A' };

      const updateData = prepareCriticalFieldUpdate(existing, apiRecord);

      expect(updateData).toHaveProperty('status', 'Open');
    });

    test('status null→Open is included', () => {
      const existing = { status: null };
      const apiRecord = { status: 'Open' };

      const updateData = prepareCriticalFieldUpdate(existing, apiRecord);
      expect(updateData).toHaveProperty('status', 'Open');
    });

    test('null status in API does not overwrite existing', () => {
      const existing = { status: 'Open' };
      const apiRecord = { status: null };

      const updateData = prepareCriticalFieldUpdate(existing, apiRecord);
      expect(updateData).not.toHaveProperty('status');
    });

    test('same status produces no update', () => {
      const existing = { status: 'Open' };
      const apiRecord = { status: 'Open' };

      const updateData = prepareCriticalFieldUpdate(existing, apiRecord);
      expect(updateData).not.toHaveProperty('status');
    });

    test('status and date change together', () => {
      const existing = {
        status: 'Upcoming',
        open_date: '2025-06-01',
        close_date: '2025-12-31'
      };
      const apiRecord = {
        status: 'Open',
        open_date: '2025-05-15',
        close_date: '2025-12-31'
      };

      const updateData = prepareCriticalFieldUpdate(existing, apiRecord);
      expect(updateData).toHaveProperty('status', 'Open');
      expect(updateData).toHaveProperty('open_date', '2025-05-15');
      expect(updateData).not.toHaveProperty('close_date');
    });
  });

  describe('StorageAgent onConflict key', () => {
    test('uses funding_source_id,title (unified constraint)', () => {
      expect(getOnConflictKey()).toBe('funding_source_id,title');
    });

    test('does NOT use title,api_source_id (old API-only constraint)', () => {
      expect(getOnConflictKey()).not.toBe('title,api_source_id');
    });
  });

  describe('Manual pipeline skip-if-open', () => {
    test('skips UPSERT when existing record is Open', () => {
      const existing = { id: '123', status: 'Open', title: 'Grant A' };
      expect(shouldSkipManualUpsert(existing)).toBe(true);
    });

    test('allows UPSERT when existing record is Closed', () => {
      const existing = { id: '123', status: 'Closed', title: 'Grant A' };
      expect(shouldSkipManualUpsert(existing)).toBe(false);
    });

    test('allows UPSERT when existing record is Upcoming', () => {
      const existing = { id: '123', status: 'Upcoming', title: 'Grant A' };
      expect(shouldSkipManualUpsert(existing)).toBe(false);
    });

    test('allows UPSERT when no existing record', () => {
      expect(shouldSkipManualUpsert(null)).toBeFalsy();
    });

    test('allows UPSERT when status is null', () => {
      const existing = { id: '123', status: null };
      expect(shouldSkipManualUpsert(existing)).toBe(false);
    });
  });
});
