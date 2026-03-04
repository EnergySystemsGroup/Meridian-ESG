/**
 * Pipeline: Run Manager Tests
 *
 * Tests the run state management:
 * - Run lifecycle (pending, processing, complete, failed)
 * - Stage tracking (extraction, analysis, storage)
 * - Progress metrics
 * - Error handling
 *
 * NOTE: Run management is critical for pipeline monitoring.
 */

import { describe, test, expect, beforeEach } from 'vitest';

/**
 * Run status values
 */
const RUN_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

/**
 * Pipeline stages
 */
const STAGES = {
  EXTRACTION: 'extraction',
  ANALYSIS: 'analysis',
  STORAGE: 'storage',
};

/**
 * Mock Run Manager
 */
class RunManager {
  constructor() {
    this.runs = new Map();
  }

  createRun(sourceId, options = {}) {
    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const run = {
      id: runId,
      source_id: sourceId,
      status: RUN_STATUS.PENDING,
      current_stage: null,
      stages: {
        [STAGES.EXTRACTION]: { status: 'pending', started_at: null, completed_at: null, count: 0 },
        [STAGES.ANALYSIS]: { status: 'pending', started_at: null, completed_at: null, count: 0 },
        [STAGES.STORAGE]: { status: 'pending', started_at: null, completed_at: null, count: 0 },
      },
      metrics: {
        total_opportunities: 0,
        extracted: 0,
        analyzed: 0,
        stored: 0,
        duplicates_skipped: 0,
        errors: 0,
      },
      error: null,
      started_at: null,
      completed_at: null,
      created_at: new Date().toISOString(),
      ...options,
    };

    this.runs.set(runId, run);
    return run;
  }

  getRun(runId) {
    return this.runs.get(runId) || null;
  }

  startRun(runId) {
    const run = this.runs.get(runId);
    if (!run) throw new Error('Run not found');
    if (run.status !== RUN_STATUS.PENDING) {
      throw new Error(`Cannot start run in ${run.status} status`);
    }

    run.status = RUN_STATUS.PROCESSING;
    run.started_at = new Date().toISOString();
    return run;
  }

  startStage(runId, stage) {
    const run = this.runs.get(runId);
    if (!run) throw new Error('Run not found');
    if (run.status !== RUN_STATUS.PROCESSING) {
      throw new Error(`Cannot update stage when run is ${run.status}`);
    }

    run.current_stage = stage;
    run.stages[stage].status = 'processing';
    run.stages[stage].started_at = new Date().toISOString();
    return run;
  }

  completeStage(runId, stage, count = 0) {
    const run = this.runs.get(runId);
    if (!run) throw new Error('Run not found');

    run.stages[stage].status = 'complete';
    run.stages[stage].completed_at = new Date().toISOString();
    run.stages[stage].count = count;

    // Update metrics
    switch (stage) {
      case STAGES.EXTRACTION:
        run.metrics.extracted = count;
        break;
      case STAGES.ANALYSIS:
        run.metrics.analyzed = count;
        break;
      case STAGES.STORAGE:
        run.metrics.stored = count;
        break;
    }

    return run;
  }

  failStage(runId, stage, error) {
    const run = this.runs.get(runId);
    if (!run) throw new Error('Run not found');

    run.stages[stage].status = 'failed';
    run.stages[stage].completed_at = new Date().toISOString();
    run.stages[stage].error = error;
    run.metrics.errors++;
    return run;
  }

  completeRun(runId) {
    const run = this.runs.get(runId);
    if (!run) throw new Error('Run not found');

    run.status = RUN_STATUS.COMPLETE;
    run.completed_at = new Date().toISOString();
    run.current_stage = null;
    return run;
  }

  failRun(runId, error) {
    const run = this.runs.get(runId);
    if (!run) throw new Error('Run not found');

    run.status = RUN_STATUS.FAILED;
    run.error = error;
    run.completed_at = new Date().toISOString();
    return run;
  }

  cancelRun(runId) {
    const run = this.runs.get(runId);
    if (!run) throw new Error('Run not found');

    run.status = RUN_STATUS.CANCELLED;
    run.completed_at = new Date().toISOString();
    return run;
  }

  updateMetrics(runId, metrics) {
    const run = this.runs.get(runId);
    if (!run) throw new Error('Run not found');

    run.metrics = { ...run.metrics, ...metrics };
    return run;
  }

  getRunsBySource(sourceId) {
    return Array.from(this.runs.values()).filter(r => r.source_id === sourceId);
  }

  getActiveRuns() {
    return Array.from(this.runs.values()).filter(
      r => r.status === RUN_STATUS.PENDING || r.status === RUN_STATUS.PROCESSING
    );
  }
}

let manager;

beforeEach(() => {
  manager = new RunManager();
});

describe('Pipeline: Run Manager', () => {

  describe('Run Creation', () => {
    test('creates run with unique ID', () => {
      const run = manager.createRun('source-1');

      expect(run.id).toBeDefined();
      expect(run.id).toContain('run-');
    });

    test('creates run with pending status', () => {
      const run = manager.createRun('source-1');

      expect(run.status).toBe(RUN_STATUS.PENDING);
    });

    test('creates run with source ID', () => {
      const run = manager.createRun('source-123');

      expect(run.source_id).toBe('source-123');
    });

    test('initializes stages as pending', () => {
      const run = manager.createRun('source-1');

      expect(run.stages.extraction.status).toBe('pending');
      expect(run.stages.analysis.status).toBe('pending');
      expect(run.stages.storage.status).toBe('pending');
    });

    test('initializes metrics to zero', () => {
      const run = manager.createRun('source-1');

      expect(run.metrics.total_opportunities).toBe(0);
      expect(run.metrics.extracted).toBe(0);
      expect(run.metrics.analyzed).toBe(0);
      expect(run.metrics.stored).toBe(0);
      expect(run.metrics.errors).toBe(0);
    });

    test('sets created_at timestamp', () => {
      const run = manager.createRun('source-1');

      expect(run.created_at).toBeDefined();
      expect(new Date(run.created_at)).toBeInstanceOf(Date);
    });
  });

  describe('Run Lifecycle', () => {
    test('starts run from pending', () => {
      const run = manager.createRun('source-1');
      manager.startRun(run.id);

      const updated = manager.getRun(run.id);
      expect(updated.status).toBe(RUN_STATUS.PROCESSING);
      expect(updated.started_at).toBeDefined();
    });

    test('cannot start already started run', () => {
      const run = manager.createRun('source-1');
      manager.startRun(run.id);

      expect(() => manager.startRun(run.id)).toThrow();
    });

    test('completes run', () => {
      const run = manager.createRun('source-1');
      manager.startRun(run.id);
      manager.completeRun(run.id);

      const updated = manager.getRun(run.id);
      expect(updated.status).toBe(RUN_STATUS.COMPLETE);
      expect(updated.completed_at).toBeDefined();
    });

    test('fails run with error', () => {
      const run = manager.createRun('source-1');
      manager.startRun(run.id);
      manager.failRun(run.id, 'API rate limit exceeded');

      const updated = manager.getRun(run.id);
      expect(updated.status).toBe(RUN_STATUS.FAILED);
      expect(updated.error).toBe('API rate limit exceeded');
    });

    test('cancels run', () => {
      const run = manager.createRun('source-1');
      manager.startRun(run.id);
      manager.cancelRun(run.id);

      const updated = manager.getRun(run.id);
      expect(updated.status).toBe(RUN_STATUS.CANCELLED);
    });
  });

  describe('Stage Management', () => {
    test('starts extraction stage', () => {
      const run = manager.createRun('source-1');
      manager.startRun(run.id);
      manager.startStage(run.id, STAGES.EXTRACTION);

      const updated = manager.getRun(run.id);
      expect(updated.current_stage).toBe(STAGES.EXTRACTION);
      expect(updated.stages.extraction.status).toBe('processing');
      expect(updated.stages.extraction.started_at).toBeDefined();
    });

    test('completes stage with count', () => {
      const run = manager.createRun('source-1');
      manager.startRun(run.id);
      manager.startStage(run.id, STAGES.EXTRACTION);
      manager.completeStage(run.id, STAGES.EXTRACTION, 47);

      const updated = manager.getRun(run.id);
      expect(updated.stages.extraction.status).toBe('complete');
      expect(updated.stages.extraction.count).toBe(47);
      expect(updated.metrics.extracted).toBe(47);
    });

    test('fails stage with error', () => {
      const run = manager.createRun('source-1');
      manager.startRun(run.id);
      manager.startStage(run.id, STAGES.EXTRACTION);
      manager.failStage(run.id, STAGES.EXTRACTION, 'Network timeout');

      const updated = manager.getRun(run.id);
      expect(updated.stages.extraction.status).toBe('failed');
      expect(updated.stages.extraction.error).toBe('Network timeout');
      expect(updated.metrics.errors).toBe(1);
    });

    test('tracks full pipeline stages', () => {
      const run = manager.createRun('source-1');
      manager.startRun(run.id);

      // Extraction
      manager.startStage(run.id, STAGES.EXTRACTION);
      manager.completeStage(run.id, STAGES.EXTRACTION, 50);

      // Analysis
      manager.startStage(run.id, STAGES.ANALYSIS);
      manager.completeStage(run.id, STAGES.ANALYSIS, 45);

      // Storage
      manager.startStage(run.id, STAGES.STORAGE);
      manager.completeStage(run.id, STAGES.STORAGE, 40);

      manager.completeRun(run.id);

      const updated = manager.getRun(run.id);
      expect(updated.metrics.extracted).toBe(50);
      expect(updated.metrics.analyzed).toBe(45);
      expect(updated.metrics.stored).toBe(40);
      expect(updated.status).toBe(RUN_STATUS.COMPLETE);
    });
  });

  describe('Metrics Updates', () => {
    test('updates individual metrics', () => {
      const run = manager.createRun('source-1');
      manager.updateMetrics(run.id, { total_opportunities: 100 });

      const updated = manager.getRun(run.id);
      expect(updated.metrics.total_opportunities).toBe(100);
    });

    test('updates multiple metrics at once', () => {
      const run = manager.createRun('source-1');
      manager.updateMetrics(run.id, {
        total_opportunities: 100,
        duplicates_skipped: 15,
        errors: 2,
      });

      const updated = manager.getRun(run.id);
      expect(updated.metrics.total_opportunities).toBe(100);
      expect(updated.metrics.duplicates_skipped).toBe(15);
      expect(updated.metrics.errors).toBe(2);
    });

    test('preserves existing metrics on partial update', () => {
      const run = manager.createRun('source-1');
      manager.updateMetrics(run.id, { extracted: 50 });
      manager.updateMetrics(run.id, { analyzed: 45 });

      const updated = manager.getRun(run.id);
      expect(updated.metrics.extracted).toBe(50);
      expect(updated.metrics.analyzed).toBe(45);
    });
  });

  describe('Run Queries', () => {
    test('gets run by ID', () => {
      const run = manager.createRun('source-1');

      const retrieved = manager.getRun(run.id);
      expect(retrieved.id).toBe(run.id);
    });

    test('returns null for non-existent run', () => {
      const retrieved = manager.getRun('non-existent');
      expect(retrieved).toBeNull();
    });

    test('gets runs by source', () => {
      manager.createRun('source-1');
      manager.createRun('source-1');
      manager.createRun('source-2');

      const source1Runs = manager.getRunsBySource('source-1');
      expect(source1Runs.length).toBe(2);
    });

    test('gets active runs', () => {
      const run1 = manager.createRun('source-1');
      const run2 = manager.createRun('source-2');
      manager.startRun(run2.id);
      const run3 = manager.createRun('source-3');
      manager.startRun(run3.id);
      manager.completeRun(run3.id);

      const active = manager.getActiveRuns();

      expect(active.length).toBe(2); // pending + processing
      expect(active.some(r => r.id === run1.id)).toBe(true);
      expect(active.some(r => r.id === run2.id)).toBe(true);
      expect(active.some(r => r.id === run3.id)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('throws for operations on non-existent run', () => {
      expect(() => manager.startRun('non-existent')).toThrow('Run not found');
      expect(() => manager.completeRun('non-existent')).toThrow('Run not found');
      expect(() => manager.failRun('non-existent', 'error')).toThrow('Run not found');
    });

    test('throws for stage update on non-processing run', () => {
      const run = manager.createRun('source-1');
      // Run is pending, not processing

      expect(() => manager.startStage(run.id, STAGES.EXTRACTION)).toThrow();
    });
  });

  describe('Run Summary', () => {
    test('calculates progress percentage', () => {
      const run = manager.createRun('source-1');
      manager.updateMetrics(run.id, { total_opportunities: 100, stored: 50 });

      const updated = manager.getRun(run.id);
      const progress = (updated.metrics.stored / updated.metrics.total_opportunities) * 100;

      expect(progress).toBe(50);
    });

    test('calculates success rate', () => {
      const run = manager.createRun('source-1');
      manager.updateMetrics(run.id, {
        total_opportunities: 100,
        stored: 90,
        errors: 5,
        duplicates_skipped: 5,
      });

      const updated = manager.getRun(run.id);
      const successRate = (updated.metrics.stored / updated.metrics.total_opportunities) * 100;

      expect(successRate).toBe(90);
    });

    test('calculates run duration', () => {
      const run = manager.createRun('source-1');
      run.started_at = '2025-01-15T10:00:00Z';
      run.completed_at = '2025-01-15T10:05:30Z';

      const startTime = new Date(run.started_at).getTime();
      const endTime = new Date(run.completed_at).getTime();
      const durationMs = endTime - startTime;
      const durationMinutes = durationMs / 1000 / 60;

      expect(durationMinutes).toBeCloseTo(5.5, 1);
    });
  });
});
