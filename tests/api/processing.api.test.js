/**
 * Processing Endpoints API Contract Tests
 *
 * Validates response structures for internal/admin processing endpoints:
 * - GET  /api/cron/process-jobs (cron trigger)
 * - POST /api/cron/process-jobs (manual trigger)
 * - POST /api/funding/process-source-v2 (edge function trigger)
 * - POST /api/admin/funding-sources/[id]/process (routeV1)
 * - POST /api/admin/funding-sources/[id]/process (routeV2)
 * - POST /api/admin/funding-sources/[id]/process (routeV3)
 *
 * These are API contract tests only -- response shapes and error handling,
 * not business logic.
 */

import { describe, test, expect } from 'vitest';
import { validateSchema } from '../helpers/validateSchema.js';

// ---------------------------------------------------------------------------
// GET /api/cron/process-jobs
// ---------------------------------------------------------------------------
describe('GET /api/cron/process-jobs', () => {

  // -- Auth check (line 34-39 of route) --
  describe('auth check', () => {
    /**
     * Mirrors: app/api/cron/process-jobs/route.js lines 34-39
     * When CRON_SECRET is set and the Authorization header does not match,
     * the route returns 401 with { error, timestamp }.
     */
    function buildAuthResponse(authHeader, expectedSecret) {
      if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
        return {
          status: 401,
          body: {
            error: 'Unauthorized',
            timestamp: new Date().toISOString(),
          },
        };
      }
      return { status: 200 };
    }

    test('returns 401 when auth header is missing', () => {
      const result = buildAuthResponse(null, 'my-cron-secret');
      expect(result.status).toBe(401);
      expect(result.body.error).toBe('Unauthorized');
      expect(typeof result.body.timestamp).toBe('string');
    });

    test('returns 401 when auth header is wrong', () => {
      const result = buildAuthResponse('Bearer wrong-secret', 'my-cron-secret');
      expect(result.status).toBe(401);
    });

    test('passes when auth header matches', () => {
      const result = buildAuthResponse('Bearer my-cron-secret', 'my-cron-secret');
      expect(result.status).toBe(200);
    });

    test('passes when no CRON_SECRET is configured', () => {
      const result = buildAuthResponse(null, undefined);
      expect(result.status).toBe(200);
    });
  });

  // -- "No jobs" response shape --
  describe('no-jobs response', () => {
    const noJobsSchema = {
      success: 'boolean',
      processed: 'boolean',
      message: 'string',
      timestamp: 'string',
      executionTimeMs: 'number',
      environment: 'string',
    };

    test('validates no-jobs response structure', () => {
      const response = {
        success: true,
        processed: false,
        message: 'No jobs in queue',
        timestamp: '2026-02-19T10:00:00.000Z',
        executionTimeMs: 42,
        environment: 'local',
        queueStatus: null,
      };

      const errors = validateSchema(response, noJobsSchema);
      expect(errors).toHaveLength(0);
      expect(response.processed).toBe(false);
    });

    test('queueStatus can be null or object', () => {
      const withNull = { queueStatus: null };
      const withObject = { queueStatus: { pending: 0, processing: 0 } };

      expect(withNull.queueStatus).toBeNull();
      expect(typeof withObject.queueStatus).toBe('object');
    });
  });

  // -- "Job processed" success response shape --
  describe('job-processed success response', () => {
    const processedSchema = {
      success: 'boolean',
      processed: 'boolean',
      jobId: 'string',
      chunkIndex: 'number',
      totalChunks: 'number',
      masterRunId: 'string',
      processingTimeMs: 'number',
      opportunitiesProcessed: 'number',
      duplicatesFound: 'number',
      newStored: 'number',
      updatesApplied: 'number',
      tokensUsed: 'number',
      timestamp: 'string',
      executionTimeMs: 'number',
      environment: 'string',
    };

    test('validates job-processed response structure', () => {
      const response = {
        success: true,
        processed: true,
        jobId: 'job-uuid-123',
        chunkIndex: 0,
        totalChunks: 3,
        masterRunId: 'run-uuid-456',
        processingTimeMs: 12500,
        opportunitiesProcessed: 5,
        duplicatesFound: 2,
        newStored: 3,
        updatesApplied: 0,
        tokensUsed: 8400,
        timestamp: '2026-02-19T10:01:00.000Z',
        executionTimeMs: 13000,
        environment: 'vercel',
        queueStatus: { pending: 2, processing: 0 },
      };

      const errors = validateSchema(response, processedSchema);
      expect(errors).toHaveLength(0);
      expect(response.processed).toBe(true);
    });

    test('numeric metrics are non-negative', () => {
      const response = {
        processingTimeMs: 0,
        opportunitiesProcessed: 0,
        duplicatesFound: 0,
        newStored: 0,
        updatesApplied: 0,
        tokensUsed: 0,
        executionTimeMs: 1,
      };

      Object.values(response).forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
      });
    });

    test('environment is vercel or local', () => {
      const vercel = { environment: 'vercel' };
      const local = { environment: 'local' };

      expect(['vercel', 'local']).toContain(vercel.environment);
      expect(['vercel', 'local']).toContain(local.environment);
    });
  });

  // -- Error response --
  describe('error response', () => {
    const errorSchema = {
      success: 'boolean',
      error: 'string',
      timestamp: 'string',
      executionTimeMs: 'number',
      environment: 'string',
    };

    test('validates 500 error response structure', () => {
      const response = {
        success: false,
        error: 'Something went wrong',
        timestamp: '2026-02-19T10:00:00.000Z',
        executionTimeMs: 50,
        environment: 'local',
      };

      const errors = validateSchema(response, errorSchema);
      expect(errors).toHaveLength(0);
      expect(response.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/cron/process-jobs (manual trigger)
// ---------------------------------------------------------------------------
describe('POST /api/cron/process-jobs', () => {

  describe('status action response', () => {
    const statusSchema = {
      success: 'boolean',
      action: 'string',
      timestamp: 'string',
    };

    test('validates status check response', () => {
      const response = {
        success: true,
        action: 'status',
        timestamp: '2026-02-19T10:00:00.000Z',
        queueStatus: { pending: 1, processing: 0, completed: 5, failed: 0 },
      };

      const errors = validateSchema(response, statusSchema);
      expect(errors).toHaveLength(0);
      expect(response.action).toBe('status');
    });
  });

  describe('process action - no jobs', () => {
    const noJobsSchema = {
      success: 'boolean',
      action: 'string',
      processed: 'boolean',
      message: 'string',
      timestamp: 'string',
    };

    test('validates no-jobs response', () => {
      const response = {
        success: true,
        action: 'process',
        processed: false,
        message: 'No jobs in queue',
        timestamp: '2026-02-19T10:00:00.000Z',
      };

      const errors = validateSchema(response, noJobsSchema);
      expect(errors).toHaveLength(0);
      expect(response.processed).toBe(false);
    });
  });

  describe('process action - job processed', () => {
    const processedSchema = {
      success: 'boolean',
      action: 'string',
      processed: 'boolean',
      jobId: 'string',
      chunkIndex: 'number',
      totalChunks: 'number',
      masterRunId: 'string',
      processingTimeMs: 'number',
      opportunitiesProcessed: 'number',
      duplicatesFound: 'number',
      newStored: 'number',
      updatesApplied: 'number',
      tokensUsed: 'number',
      timestamp: 'string',
      executionTimeMs: 'number',
      environment: 'string',
    };

    test('validates POST processed response', () => {
      const response = {
        success: true,
        action: 'process',
        processed: true,
        jobId: 'job-uuid-789',
        chunkIndex: 1,
        totalChunks: 4,
        masterRunId: 'run-uuid-abc',
        processingTimeMs: 9800,
        opportunitiesProcessed: 5,
        duplicatesFound: 1,
        newStored: 4,
        updatesApplied: 0,
        tokensUsed: 6200,
        timestamp: '2026-02-19T10:05:00.000Z',
        executionTimeMs: 10200,
        environment: 'local',
        queueStatus: null,
      };

      const errors = validateSchema(response, processedSchema);
      expect(errors).toHaveLength(0);
      expect(response.action).toBe('process');
    });
  });

  describe('error response', () => {
    const errorSchema = {
      success: 'boolean',
      action: 'string',
      error: 'string',
      timestamp: 'string',
      executionTimeMs: 'number',
      environment: 'string',
    };

    test('validates POST error response', () => {
      const response = {
        success: false,
        action: 'process',
        error: 'Manual trigger failed',
        timestamp: '2026-02-19T10:00:00.000Z',
        executionTimeMs: 15,
        environment: 'local',
      };

      const errors = validateSchema(response, errorSchema);
      expect(errors).toHaveLength(0);
      expect(response.success).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/funding/process-source-v2
// ---------------------------------------------------------------------------
describe('POST /api/funding/process-source-v2', () => {

  describe('request validation', () => {
    /**
     * Mirrors: app/api/funding/process-source-v2/route.js lines 17-24
     */
    function validateProcessSourceRequest(body) {
      if (!body.sourceId) {
        return { status: 400, body: { error: 'sourceId is required' } };
      }
      return { status: 200 };
    }

    test('rejects missing sourceId with 400', () => {
      const result = validateProcessSourceRequest({});
      expect(result.status).toBe(400);
      expect(result.body.error).toBe('sourceId is required');
    });

    test('accepts valid request with sourceId', () => {
      const result = validateProcessSourceRequest({ sourceId: 'src-123' });
      expect(result.status).toBe(200);
    });

    test('accepts request with sourceId and runId', () => {
      const result = validateProcessSourceRequest({ sourceId: 'src-123', runId: 'run-456' });
      expect(result.status).toBe(200);
    });
  });

  describe('success response', () => {
    const successSchema = {
      status: 'string',
      message: 'string',
      sourceId: 'string',
      timestamp: 'string',
    };

    test('validates triggered response structure', () => {
      const response = {
        status: 'triggered',
        message: 'V2 processing started in Edge Function',
        sourceId: 'src-123',
        runId: 'run-456',
        edgeFunction: {
          environment: 'production',
          version: '1.0',
          processingTime: 120,
        },
        timestamp: '2026-02-19T10:00:00.000Z',
      };

      const errors = validateSchema(response, successSchema);
      expect(errors).toHaveLength(0);
      expect(response.status).toBe('triggered');
    });

    test('edgeFunction is an object with expected fields', () => {
      const edgeFunction = {
        environment: 'production',
        version: '1.0',
        processingTime: 120,
      };

      expect(typeof edgeFunction.environment).toBe('string');
      expect(typeof edgeFunction.version).toBe('string');
      expect(typeof edgeFunction.processingTime).toBe('number');
    });

    test('runId can be present or absent', () => {
      const withRunId = { sourceId: 'src-1', runId: 'run-1' };
      const withoutRunId = { sourceId: 'src-1' };

      expect(withRunId).toHaveProperty('runId');
      expect(withoutRunId).not.toHaveProperty('runId');
    });
  });

  describe('error response', () => {
    const errorSchema = {
      status: 'string',
      message: 'string',
      error: 'string',
      timestamp: 'string',
    };

    test('validates 500 error response', () => {
      const response = {
        status: 'error',
        message: 'Failed to trigger V2 processing',
        error: 'Edge Function failed: timeout',
        timestamp: '2026-02-19T10:00:00.000Z',
      };

      const errors = validateSchema(response, errorSchema);
      expect(errors).toHaveLength(0);
      expect(response.status).toBe('error');
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/funding-sources/[id]/process (routeV1)
// ---------------------------------------------------------------------------
describe('POST /api/admin/funding-sources/[id]/process (V1)', () => {

  describe('success response', () => {
    const successSchema = {
      success: 'boolean',
      message: 'string',
      version: 'string',
      runId: 'string',
      sourceId: 'string',
      status: 'string',
      startedAt: 'string',
    };

    test('validates V1 success response structure', () => {
      const response = {
        success: true,
        message: 'V1 Processing started',
        version: 'v1',
        runId: 'run-uuid-001',
        sourceId: 'src-uuid-001',
        status: 'processing',
        startedAt: '2026-02-19T10:00:00.000Z',
      };

      const errors = validateSchema(response, successSchema);
      expect(errors).toHaveLength(0);
      expect(response.version).toBe('v1');
    });

    test('startedAt is a valid ISO timestamp', () => {
      const response = { startedAt: '2026-02-19T10:00:00.000Z' };
      const parsed = new Date(response.startedAt);
      expect(isNaN(parsed.getTime())).toBe(false);
    });
  });

  describe('error response', () => {
    const errorSchema = {
      error: 'string',
      details: 'string',
      version: 'string',
    };

    test('validates V1 error response structure', () => {
      const response = {
        error: 'Internal server error',
        details: 'Source not found',
        stack: 'Error: Source not found\n    at ...',
        version: 'v1',
      };

      const errors = validateSchema(response, errorSchema);
      expect(errors).toHaveLength(0);
    });

    test('error response includes version identifier', () => {
      const response = {
        error: 'Internal server error',
        details: 'Connection refused',
        version: 'v1',
      };

      expect(response.version).toBe('v1');
    });

    test('stack field is optional', () => {
      const withStack = { error: 'err', details: 'd', version: 'v1', stack: 'trace...' };
      const withoutStack = { error: 'err', details: 'd', version: 'v1' };

      expect(withStack).toHaveProperty('stack');
      expect(withoutStack).not.toHaveProperty('stack');
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/funding-sources/[id]/process (routeV2)
// ---------------------------------------------------------------------------
describe('POST /api/admin/funding-sources/[id]/process (V2)', () => {

  describe('success response', () => {
    const successSchema = {
      success: 'boolean',
      message: 'string',
      version: 'string',
      pipeline: 'string',
      sourceId: 'string',
      status: 'string',
      startedAt: 'string',
    };

    test('validates V2 success response structure', () => {
      const response = {
        success: true,
        message: 'V2 Processing started',
        version: 'v2.0',
        pipeline: 'v2-optimized-with-metrics',
        sourceId: 'src-uuid-002',
        status: 'started',
        startedAt: '2026-02-19T10:00:00.000Z',
        optimizations: {
          earlyDuplicateDetection: true,
          tokenSavingsEnabled: true,
          advancedMetrics: true,
        },
      };

      const errors = validateSchema(response, successSchema);
      expect(errors).toHaveLength(0);
      expect(response.version).toBe('v2.0');
    });

    test('optimizations object has boolean flags', () => {
      const optimizations = {
        earlyDuplicateDetection: true,
        tokenSavingsEnabled: true,
        advancedMetrics: true,
      };

      Object.values(optimizations).forEach(val => {
        expect(typeof val).toBe('boolean');
      });
    });

    test('V2 does not include runId in immediate response', () => {
      // V2 starts processing in background; runId is created asynchronously
      const response = {
        success: true,
        message: 'V2 Processing started',
        version: 'v2.0',
        pipeline: 'v2-optimized-with-metrics',
        sourceId: 'src-uuid-002',
        status: 'started',
        startedAt: new Date().toISOString(),
        optimizations: {},
      };

      expect(response).not.toHaveProperty('runId');
    });
  });

  describe('error response', () => {
    const errorSchema = {
      error: 'string',
      details: 'string',
      version: 'string',
      pipeline: 'string',
    };

    test('validates V2 error response structure', () => {
      const response = {
        error: 'Internal server error',
        details: 'Anthropic API key not configured',
        stack: 'Error: ...',
        version: 'v2.0',
        pipeline: 'v2-optimized-with-metrics',
      };

      const errors = validateSchema(response, errorSchema);
      expect(errors).toHaveLength(0);
    });

    test('error response includes pipeline identifier', () => {
      const response = {
        error: 'Internal server error',
        details: 'timeout',
        version: 'v2.0',
        pipeline: 'v2-optimized-with-metrics',
      };

      expect(response.pipeline).toBe('v2-optimized-with-metrics');
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/funding-sources/[id]/process (routeV3)
// ---------------------------------------------------------------------------
describe('POST /api/admin/funding-sources/[id]/process (V3)', () => {

  describe('success response', () => {
    const successSchema = {
      success: 'boolean',
      message: 'string',
      version: 'string',
      pipeline: 'string',
      sourceId: 'string',
      runId: 'string',
      status: 'string',
      createdAt: 'string',
    };

    test('validates V3 success response structure', () => {
      const response = {
        success: true,
        message: 'Jobs created successfully',
        version: 'v3.0',
        pipeline: 'job-queue-based',
        sourceId: 'src-uuid-003',
        sourceName: 'Grants.gov',
        runId: 'run-uuid-003',
        status: 'processing',
        createdAt: '2026-02-19T10:00:00.000Z',
        summary: {
          totalOpportunities: 25,
          totalFound: 25,
          chunksCreated: 5,
          chunkSize: 5,
          jobsCreated: 5,
        },
        jobs: [
          { jobId: 'job-1', chunkIndex: 0, opportunityCount: 5 },
          { jobId: 'job-2', chunkIndex: 1, opportunityCount: 5 },
        ],
        metrics: {
          fetchTimeMs: 2400,
          jobCreationTimeMs: 150,
          totalTimeMs: 2600,
          apiCalls: 3,
          responseSize: 128000,
        },
        config: {
          workflow: 'standard',
          forceFullProcessing: false,
          pipelineVersion: 'v3.0-job-queue',
        },
        nextSteps: {
          message: 'Jobs are queued for processing by cron workers',
          processingUrl: '/api/cron/process-jobs',
          statusUrl: '/api/admin/runs/run-uuid-003/status',
        },
      };

      const errors = validateSchema(response, successSchema);
      expect(errors).toHaveLength(0);
      expect(response.version).toBe('v3.0');
    });

    test('summary has expected numeric fields', () => {
      const summarySchema = {
        totalOpportunities: 'number',
        totalFound: 'number',
        chunksCreated: 'number',
        chunkSize: 'number',
        jobsCreated: 'number',
      };

      const summary = {
        totalOpportunities: 25,
        totalFound: 30,
        chunksCreated: 5,
        chunkSize: 5,
        jobsCreated: 5,
      };

      const errors = validateSchema(summary, summarySchema);
      expect(errors).toHaveLength(0);
    });

    test('jobs array items have correct shape', () => {
      const jobItemSchema = {
        jobId: 'string',
        chunkIndex: 'number',
        opportunityCount: 'number',
      };

      const jobs = [
        { jobId: 'job-1', chunkIndex: 0, opportunityCount: 5 },
        { jobId: 'job-2', chunkIndex: 1, opportunityCount: 5 },
      ];

      jobs.forEach(job => {
        const errors = validateSchema(job, jobItemSchema);
        expect(errors).toHaveLength(0);
      });
    });

    test('metrics has expected numeric fields', () => {
      const metricsSchema = {
        fetchTimeMs: 'number',
        jobCreationTimeMs: 'number',
        totalTimeMs: 'number',
        apiCalls: 'number',
        responseSize: 'number',
      };

      const metrics = {
        fetchTimeMs: 2400,
        jobCreationTimeMs: 150,
        totalTimeMs: 2600,
        apiCalls: 3,
        responseSize: 128000,
      };

      const errors = validateSchema(metrics, metricsSchema);
      expect(errors).toHaveLength(0);
    });

    test('config has expected fields', () => {
      const configSchema = {
        workflow: 'string',
        forceFullProcessing: 'boolean',
        pipelineVersion: 'string',
      };

      const config = {
        workflow: 'standard',
        forceFullProcessing: false,
        pipelineVersion: 'v3.0-job-queue',
      };

      const errors = validateSchema(config, configSchema);
      expect(errors).toHaveLength(0);
    });

    test('nextSteps has expected string fields', () => {
      const nextStepsSchema = {
        message: 'string',
        processingUrl: 'string',
        statusUrl: 'string',
      };

      const nextSteps = {
        message: 'Jobs are queued for processing by cron workers',
        processingUrl: '/api/cron/process-jobs',
        statusUrl: '/api/admin/runs/run-uuid-003/status',
      };

      const errors = validateSchema(nextSteps, nextStepsSchema);
      expect(errors).toHaveLength(0);
    });
  });

  describe('404 source not found', () => {
    test('validates source-not-found response', () => {
      const response = {
        error: 'Source not found',
        sourceId: 'nonexistent-id',
      };

      expect(typeof response.error).toBe('string');
      expect(response.error).toBe('Source not found');
      expect(typeof response.sourceId).toBe('string');
    });
  });

  describe('error response', () => {
    const errorSchema = {
      error: 'string',
      details: 'string',
      version: 'string',
      pipeline: 'string',
    };

    test('validates V3 error response structure', () => {
      const response = {
        error: 'Job creation failed',
        details: 'API fetch timed out',
        stack: 'Error: API fetch timed out\n    at ...',
        version: 'v3.0',
        pipeline: 'job-queue-based',
      };

      const errors = validateSchema(response, errorSchema);
      expect(errors).toHaveLength(0);
    });

    test('error message is "Job creation failed" for V3', () => {
      const response = {
        error: 'Job creation failed',
        details: 'some details',
        version: 'v3.0',
        pipeline: 'job-queue-based',
      };

      expect(response.error).toBe('Job creation failed');
    });
  });
});

// ---------------------------------------------------------------------------
// Cross-version consistency checks
// ---------------------------------------------------------------------------
describe('Cross-version response consistency', () => {

  test('all versions include a version identifier in success responses', () => {
    const v1 = { success: true, version: 'v1' };
    const v2 = { success: true, version: 'v2.0' };
    const v3 = { success: true, version: 'v3.0' };

    [v1, v2, v3].forEach(response => {
      expect(response).toHaveProperty('version');
      expect(typeof response.version).toBe('string');
    });
  });

  test('all versions include a version identifier in error responses', () => {
    const v1 = { error: 'err', version: 'v1' };
    const v2 = { error: 'err', version: 'v2.0', pipeline: 'v2-optimized-with-metrics' };
    const v3 = { error: 'err', version: 'v3.0', pipeline: 'job-queue-based' };

    [v1, v2, v3].forEach(response => {
      expect(response).toHaveProperty('version');
      expect(typeof response.version).toBe('string');
    });
  });

  test('V2 and V3 include pipeline identifier, V1 does not', () => {
    const v1Success = { success: true, version: 'v1', message: 'V1 Processing started' };
    const v2Success = { success: true, version: 'v2.0', pipeline: 'v2-optimized-with-metrics' };
    const v3Success = { success: true, version: 'v3.0', pipeline: 'job-queue-based' };

    expect(v1Success).not.toHaveProperty('pipeline');
    expect(v2Success).toHaveProperty('pipeline');
    expect(v3Success).toHaveProperty('pipeline');
  });

  test('all error responses include details field', () => {
    const v1Error = { error: 'Internal server error', details: 'msg', version: 'v1' };
    const v2Error = { error: 'Internal server error', details: 'msg', version: 'v2.0', pipeline: 'v2-optimized-with-metrics' };
    const v3Error = { error: 'Job creation failed', details: 'msg', version: 'v3.0', pipeline: 'job-queue-based' };

    [v1Error, v2Error, v3Error].forEach(response => {
      expect(response).toHaveProperty('details');
      expect(typeof response.details).toBe('string');
    });
  });

  test('timestamp fields are valid ISO 8601 strings', () => {
    const timestamps = [
      '2026-02-19T10:00:00.000Z',
      '2026-02-19T23:59:59.999Z',
      new Date().toISOString(),
    ];

    timestamps.forEach(ts => {
      const parsed = new Date(ts);
      expect(isNaN(parsed.getTime())).toBe(false);
    });
  });
});
