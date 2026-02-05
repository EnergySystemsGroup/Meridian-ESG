/**
 * Pipeline: Staging State Machine Tests
 *
 * Tests the staging record lifecycle:
 * - Valid state transitions (pending → complete → stored)
 * - Invalid transition rejection
 * - Batch state management
 * - Error state handling
 */

import { describe, test, expect } from 'vitest';

const VALID_STATUSES = ['pending', 'in_progress', 'complete', 'failed', 'skipped'];

const VALID_TRANSITIONS = {
  pending: ['in_progress', 'skipped'],
  in_progress: ['complete', 'failed'],
  complete: [],
  failed: ['pending'], // retry
  skipped: [],
};

/**
 * Check if a state transition is valid
 */
function isValidTransition(from, to) {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Staging record state manager
 */
class StagingRecord {
  constructor(id) {
    this.id = id;
    this.extraction_status = 'pending';
    this.analysis_status = 'pending';
    this.storage_status = 'pending';
    this.error_message = null;
    this.history = [];
  }

  transition(stage, newStatus) {
    const field = `${stage}_status`;
    const currentStatus = this[field];

    if (!VALID_STATUSES.includes(newStatus)) {
      return { success: false, error: `Invalid status: ${newStatus}` };
    }

    if (!isValidTransition(currentStatus, newStatus)) {
      return {
        success: false,
        error: `Invalid transition: ${currentStatus} → ${newStatus} for ${stage}`,
      };
    }

    this.history.push({ stage, from: currentStatus, to: newStatus, at: Date.now() });
    this[field] = newStatus;

    if (newStatus === 'failed') {
      this.error_message = `${stage} failed`;
    }

    return { success: true };
  }

  getOverallStatus() {
    if (this.storage_status === 'complete') return 'done';
    if ([this.extraction_status, this.analysis_status, this.storage_status].includes('failed')) return 'failed';
    if (this.extraction_status === 'pending') return 'pending_extraction';
    if (this.analysis_status === 'pending') return 'pending_analysis';
    if (this.storage_status === 'pending') return 'pending_storage';
    return 'in_progress';
  }

  canProceedToStage(stage) {
    if (stage === 'extraction') return this.extraction_status === 'pending';
    if (stage === 'analysis') return this.extraction_status === 'complete' && this.analysis_status === 'pending';
    if (stage === 'storage') return this.analysis_status === 'complete' && this.storage_status === 'pending';
    return false;
  }
}

/**
 * Batch status calculator
 */
function calculateBatchStatus(records) {
  return {
    total: records.length,
    pending_extraction: records.filter(r => r.extraction_status === 'pending').length,
    pending_analysis: records.filter(r =>
      r.extraction_status === 'complete' && r.analysis_status === 'pending'
    ).length,
    pending_storage: records.filter(r =>
      r.analysis_status === 'complete' && r.storage_status === 'pending'
    ).length,
    complete: records.filter(r => r.storage_status === 'complete').length,
    failed: records.filter(r =>
      [r.extraction_status, r.analysis_status, r.storage_status].includes('failed')
    ).length,
  };
}

describe('Staging State Machine', () => {

  describe('State Transitions', () => {
    test('pending → in_progress is valid', () => {
      expect(isValidTransition('pending', 'in_progress')).toBe(true);
    });

    test('in_progress → complete is valid', () => {
      expect(isValidTransition('in_progress', 'complete')).toBe(true);
    });

    test('in_progress → failed is valid', () => {
      expect(isValidTransition('in_progress', 'failed')).toBe(true);
    });

    test('failed → pending (retry) is valid', () => {
      expect(isValidTransition('failed', 'pending')).toBe(true);
    });

    test('pending → complete is invalid (must go through in_progress)', () => {
      expect(isValidTransition('pending', 'complete')).toBe(false);
    });

    test('complete → pending is invalid (no going back)', () => {
      expect(isValidTransition('complete', 'pending')).toBe(false);
    });

    test('skipped is terminal', () => {
      expect(isValidTransition('skipped', 'pending')).toBe(false);
      expect(isValidTransition('skipped', 'complete')).toBe(false);
    });
  });

  describe('Staging Record Lifecycle', () => {
    test('happy path: pending → in_progress → complete for all stages', () => {
      const record = new StagingRecord('test-1');

      // Extraction
      expect(record.transition('extraction', 'in_progress').success).toBe(true);
      expect(record.transition('extraction', 'complete').success).toBe(true);

      // Analysis
      expect(record.transition('analysis', 'in_progress').success).toBe(true);
      expect(record.transition('analysis', 'complete').success).toBe(true);

      // Storage
      expect(record.transition('storage', 'in_progress').success).toBe(true);
      expect(record.transition('storage', 'complete').success).toBe(true);

      expect(record.getOverallStatus()).toBe('done');
    });

    test('failed extraction blocks analysis', () => {
      const record = new StagingRecord('test-2');

      record.transition('extraction', 'in_progress');
      record.transition('extraction', 'failed');

      expect(record.canProceedToStage('analysis')).toBe(false);
      expect(record.getOverallStatus()).toBe('failed');
    });

    test('retry after failure', () => {
      const record = new StagingRecord('test-3');

      record.transition('extraction', 'in_progress');
      record.transition('extraction', 'failed');

      // Retry
      expect(record.transition('extraction', 'pending').success).toBe(true);
      expect(record.canProceedToStage('extraction')).toBe(true);
    });

    test('invalid transition is rejected', () => {
      const record = new StagingRecord('test-4');

      const result = record.transition('extraction', 'complete');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    test('transition history is tracked', () => {
      const record = new StagingRecord('test-5');

      record.transition('extraction', 'in_progress');
      record.transition('extraction', 'complete');

      expect(record.history).toHaveLength(2);
      expect(record.history[0].from).toBe('pending');
      expect(record.history[0].to).toBe('in_progress');
      expect(record.history[1].from).toBe('in_progress');
      expect(record.history[1].to).toBe('complete');
    });
  });

  describe('Stage Readiness', () => {
    test('new record can proceed to extraction', () => {
      const record = new StagingRecord('test-6');
      expect(record.canProceedToStage('extraction')).toBe(true);
      expect(record.canProceedToStage('analysis')).toBe(false);
      expect(record.canProceedToStage('storage')).toBe(false);
    });

    test('extracted record can proceed to analysis', () => {
      const record = new StagingRecord('test-7');
      record.extraction_status = 'complete';
      expect(record.canProceedToStage('analysis')).toBe(true);
      expect(record.canProceedToStage('storage')).toBe(false);
    });

    test('analyzed record can proceed to storage', () => {
      const record = new StagingRecord('test-8');
      record.extraction_status = 'complete';
      record.analysis_status = 'complete';
      expect(record.canProceedToStage('storage')).toBe(true);
    });
  });

  describe('Batch Status', () => {
    test('calculates batch status correctly', () => {
      const records = [
        Object.assign(new StagingRecord('r1'), { extraction_status: 'pending' }),
        Object.assign(new StagingRecord('r2'), { extraction_status: 'complete', analysis_status: 'pending' }),
        Object.assign(new StagingRecord('r3'), { extraction_status: 'complete', analysis_status: 'complete', storage_status: 'pending' }),
        Object.assign(new StagingRecord('r4'), { extraction_status: 'complete', analysis_status: 'complete', storage_status: 'complete' }),
        Object.assign(new StagingRecord('r5'), { extraction_status: 'failed' }),
      ];

      const status = calculateBatchStatus(records);

      expect(status.total).toBe(5);
      expect(status.pending_extraction).toBe(1);
      expect(status.pending_analysis).toBe(1);
      expect(status.pending_storage).toBe(1);
      expect(status.complete).toBe(1);
      expect(status.failed).toBe(1);
    });

    test('empty batch', () => {
      const status = calculateBatchStatus([]);
      expect(status.total).toBe(0);
      expect(status.complete).toBe(0);
    });
  });
});
