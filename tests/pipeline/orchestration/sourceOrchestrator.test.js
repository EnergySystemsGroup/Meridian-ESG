/**
 * Pipeline: Source Orchestrator Tests
 *
 * Tests the coordination of pipeline stages:
 * - Source configuration validation
 * - Stage sequencing (extraction -> analysis -> storage)
 * - Skipping stages when no work to do
 * - Final report generation
 */

import { describe, test, expect } from 'vitest';

const PIPELINE_STAGES = ['extraction', 'analysis', 'storage'];

/**
 * Validate source configuration before processing
 */
function validateSourceConfig(source) {
  const errors = [];

  if (!source.id) errors.push('Missing source ID');
  if (!source.name) errors.push('Missing source name');
  if (!source.api_url && !source.content_type) {
    errors.push('Source must have api_url or content_type');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Determine which stages need to run
 */
function determineStages(pendingCounts) {
  const stages = [];

  if (pendingCounts.extraction > 0) stages.push('extraction');
  if (pendingCounts.analysis > 0) stages.push('analysis');
  if (pendingCounts.storage > 0) stages.push('storage');

  return stages;
}

/**
 * Generate pipeline report from stage results
 */
function generatePipelineReport(stageResults) {
  const report = {
    stages: {},
    totalProcessed: 0,
    totalFailed: 0,
    duration: 0,
    success: true,
  };

  for (const [stage, result] of Object.entries(stageResults)) {
    report.stages[stage] = {
      processed: result.processed || 0,
      failed: result.failed || 0,
      skipped: result.skipped || false,
      duration: result.duration || 0,
    };
    report.totalProcessed += result.processed || 0;
    report.totalFailed += result.failed || 0;
    report.duration += result.duration || 0;

    if (result.failed > 0) report.success = false;
  }

  return report;
}

/**
 * Calculate pipeline ETA based on progress
 */
function calculateETA(processed, total, elapsedMs) {
  if (processed === 0 || total === 0) return null;
  const msPerItem = elapsedMs / processed;
  const remaining = total - processed;
  return Math.round(msPerItem * remaining);
}

describe('Source Orchestrator', () => {

  describe('Source Configuration Validation', () => {
    test('valid source passes', () => {
      const result = validateSourceConfig({
        id: 'src-001',
        name: 'Grants.gov',
        api_url: 'https://api.grants.gov/v2',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('source with content_type is valid', () => {
      const result = validateSourceConfig({
        id: 'src-002',
        name: 'PG&E Manual',
        content_type: 'html',
      });
      expect(result.valid).toBe(true);
    });

    test('missing id fails', () => {
      const result = validateSourceConfig({ name: 'Test', api_url: 'http://test.com' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing source ID');
    });

    test('missing both api_url and content_type fails', () => {
      const result = validateSourceConfig({ id: 'src', name: 'Test' });
      expect(result.valid).toBe(false);
    });

    test('multiple errors collected', () => {
      const result = validateSourceConfig({});
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Stage Determination', () => {
    test('all stages when all have pending work', () => {
      const stages = determineStages({
        extraction: 10,
        analysis: 5,
        storage: 3,
      });
      expect(stages).toEqual(['extraction', 'analysis', 'storage']);
    });

    test('only analysis and storage when extraction done', () => {
      const stages = determineStages({
        extraction: 0,
        analysis: 5,
        storage: 0,
      });
      expect(stages).toEqual(['analysis']);
    });

    test('empty when nothing pending', () => {
      const stages = determineStages({
        extraction: 0,
        analysis: 0,
        storage: 0,
      });
      expect(stages).toEqual([]);
    });

    test('storage only', () => {
      const stages = determineStages({
        extraction: 0,
        analysis: 0,
        storage: 8,
      });
      expect(stages).toEqual(['storage']);
    });
  });

  describe('Pipeline Report Generation', () => {
    test('generates report from stage results', () => {
      const report = generatePipelineReport({
        extraction: { processed: 47, failed: 2, duration: 30000 },
        analysis: { processed: 45, failed: 0, duration: 60000 },
        storage: { processed: 45, failed: 0, duration: 10000 },
      });

      expect(report.totalProcessed).toBe(137);
      expect(report.totalFailed).toBe(2);
      expect(report.duration).toBe(100000);
      expect(report.success).toBe(false); // 2 failures
    });

    test('marks success when no failures', () => {
      const report = generatePipelineReport({
        extraction: { processed: 10, failed: 0, duration: 5000 },
        analysis: { processed: 10, failed: 0, duration: 5000 },
      });

      expect(report.success).toBe(true);
    });

    test('handles skipped stages', () => {
      const report = generatePipelineReport({
        extraction: { processed: 0, failed: 0, skipped: true, duration: 0 },
        analysis: { processed: 10, failed: 0, duration: 5000 },
      });

      expect(report.stages.extraction.skipped).toBe(true);
      expect(report.totalProcessed).toBe(10);
    });

    test('handles empty stage results', () => {
      const report = generatePipelineReport({});
      expect(report.totalProcessed).toBe(0);
      expect(report.success).toBe(true);
    });
  });

  describe('ETA Calculation', () => {
    test('calculates correct ETA', () => {
      // 10 items in 5000ms = 500ms/item, 40 remaining = 20000ms
      const eta = calculateETA(10, 50, 5000);
      expect(eta).toBe(20000);
    });

    test('returns null when no progress', () => {
      expect(calculateETA(0, 50, 0)).toBeNull();
    });

    test('returns null when total is 0', () => {
      expect(calculateETA(5, 0, 1000)).toBeNull();
    });

    test('returns 0 when all done', () => {
      expect(calculateETA(50, 50, 10000)).toBe(0);
    });
  });
});
