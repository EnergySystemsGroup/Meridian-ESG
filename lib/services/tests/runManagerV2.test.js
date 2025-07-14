import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { RunManagerV2, createRunManagerV2, getNextStage } from '../runManagerV2.js';

/**
 * Unit Tests for RunManagerV2 - Enhanced run tracking for Agent Architecture V2
 * 
 * Tests cover:
 * 1. Run creation and initialization
 * 2. Stage status updates and tracking  
 * 3. V2 pipeline stage helpers
 * 4. Error handling and recovery
 * 5. Performance metrics and data storage
 * 6. Utility functions
 */

let mockSupabaseClient;
let mockChain;

// Mock the supabase import
vi.mock('@/utils/supabase.js', () => ({
  createSupabaseClient: () => mockSupabaseClient
}));

describe('RunManagerV2', () => {
  let runManager;
  let mockRunData;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create fresh chainable mock for each test
    mockChain = {
      insert: vi.fn(() => mockChain),
      update: vi.fn(() => mockChain),
      select: vi.fn(() => mockChain),
      eq: vi.fn((field, value) => {
        // For SELECT operations, return the chain so single() can be called
        // For UPDATE operations, return a promise with the result
        if (mockChain._lastOperation === 'select') {
          return mockChain;
        } else {
          return Promise.resolve({ error: null });
        }
      }),
      single: vi.fn(() => Promise.resolve({ data: mockRunData, error: null }))
    };
    
    // Track the last operation to determine eq() behavior
    const originalSelect = mockChain.select;
    const originalUpdate = mockChain.update;
    
    mockChain.select = vi.fn((...args) => {
      mockChain._lastOperation = 'select';
      return originalSelect.apply(mockChain, args);
    });
    
    mockChain.update = vi.fn((...args) => {
      mockChain._lastOperation = 'update';
      return originalUpdate.apply(mockChain, args);
    });
    
    // Create fresh mock client
    mockSupabaseClient = {
      from: vi.fn(() => mockChain)
    };
    
    // Setup default mock responses (using V1 database columns)
    mockRunData = {
      id: 'run-test-123',
      api_source_id: 'source-abc',
      status: 'processing',
      started_at: new Date().toISOString(),
      source_manager_status: 'pending',
      api_handler_status: 'pending',
      detail_processor_status: 'pending',
      data_processor_status: 'pending'
    };
    
    // Set up default chain mock to return proper responses
    // Note: eq() should return the chain, single() should return the promise
    
    runManager = new RunManagerV2(null, mockSupabaseClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should create RunManagerV2 with no existing run ID', () => {
      const rm = new RunManagerV2(null, mockSupabaseClient);
      expect(rm.runId).toBe(null);
      expect(rm.startTime).toBeGreaterThan(Date.now() - 1000);
    });

    test('should create RunManagerV2 with existing run ID', () => {
      const existingRunId = 'existing-run-456';
      const rm = new RunManagerV2(existingRunId, mockSupabaseClient);
      expect(rm.runId).toBe(existingRunId);
    });

    test('should create via factory function', () => {
      const rm = createRunManagerV2('factory-run-789');
      expect(rm).toBeInstanceOf(RunManagerV2);
      expect(rm.runId).toBe('factory-run-789');
    });
  });

  describe('Run Creation', () => {
    test('should create new run successfully', async () => {
      const sourceId = 'test-source-123';
      
      // Create a fresh runManager instance for this test to avoid the existing id
      const testRunManager = new RunManagerV2(null, mockSupabaseClient);

      const runId = await testRunManager.startRun(sourceId);

      // Verify that a run ID was returned and set on the manager
      expect(runId).toBe(mockRunData.id);
      expect(testRunManager.runId).toBe(mockRunData.id);
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('api_source_runs');
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          api_source_id: sourceId,
          status: 'processing',
          // V2 stages mapped to V1 database columns
          source_manager_status: 'pending',
          api_handler_status: 'pending',
          detail_processor_status: 'pending',
          data_processor_status: 'pending'
        })
      );
    });

    test('should handle existing run ID gracefully', async () => {
      runManager.runId = 'existing-run';
      
      const result = await runManager.startRun('test-source');
      expect(result).toBe('existing-run');
      expect(mockChain.insert).not.toHaveBeenCalled();
    });

    test('should handle run creation errors', async () => {
      mockChain.single.mockResolvedValueOnce({ 
        data: null, 
        error: new Error('Database connection failed') 
      });

      await expect(runManager.startRun('test-source')).rejects.toThrow('Database connection failed');
    });
  });

  describe('Stage Status Updates', () => {
    beforeEach(() => {
      runManager.runId = 'test-run-123';
    });

    test('should update stage status with basic data', async () => {
      await runManager.updateStageStatus('source_manager_status', 'completed');

      expect(mockChain.update).toHaveBeenCalledWith({
        source_manager_status: 'completed',
        updated_at: expect.any(String)
      });
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'test-run-123');
    });

    test('should update stage status with result data', async () => {
      const resultData = { confidence: 85, workflow: 'two_step_api' };
      
      await runManager.updateStageStatus('source_manager_status', 'completed', resultData);

      expect(mockChain.update).toHaveBeenCalledWith({
        source_manager_status: 'completed',
        source_manager_data: resultData,
        updated_at: expect.any(String)
      });
    });

    test('should update stage status with metrics', async () => {
      const metrics = { executionTime: 1500, tokensUsed: 245 };
      
      await runManager.updateStageStatus('api_handler_status', 'completed', null, metrics);

      expect(mockChain.update).toHaveBeenCalledWith({
        api_handler_status: 'completed',
        api_handler_metrics: metrics,
        updated_at: expect.any(String)
      });
    });

    test('should handle missing run ID gracefully', async () => {
      runManager.runId = null;
      
      await runManager.updateStageStatus('source_manager_status', 'completed');
      
      expect(mockChain.update).not.toHaveBeenCalled();
    });

    test('should handle update errors gracefully', async () => {
      mockChain.eq.mockResolvedValue({ 
        error: new Error('Update failed') 
      });

      // Should not throw, just log error
      await expect(
        runManager.updateStageStatus('source_manager_status', 'completed')
      ).resolves.toBeUndefined();
    });
  });

  describe('V2 Stage Helper Methods', () => {
    beforeEach(() => {
      runManager.runId = 'test-run-123';
    });

    test('should update SourceOrchestrator status', async () => {
      const analysisResult = { workflow: 'single_api', confidence: 90 };
      const metrics = { executionTime: 1200 };
      
      await runManager.updateSourceOrchestrator('completed', analysisResult, metrics);

      expect(mockChain.update).toHaveBeenCalledWith({
        source_manager_status: 'completed',
        source_manager_data: analysisResult,
        source_manager_metrics: metrics,
        updated_at: expect.any(String)
      });
    });

    test('should update DataExtraction status', async () => {
      const extractionResult = { opportunitiesFound: 25, standardized: 23 };
      
      await runManager.updateDataExtraction('processing', extractionResult);

      expect(mockChain.update).toHaveBeenCalledWith({
        api_handler_status: 'processing',
        api_handler_data: extractionResult,
        updated_at: expect.any(String)
      });
    });

    test('should update Analysis status', async () => {
      const analysisResult = { totalAnalyzed: 25, enhanced: 23 };
      
      await runManager.updateAnalysis('completed', analysisResult);

      expect(mockChain.update).toHaveBeenCalledWith({
        api_handler_status: 'completed',
        api_handler_data: analysisResult,
        updated_at: expect.any(String)
      });
    });

    test('should update Filter status', async () => {
      const filterResult = { totalAnalyzed: 23, included: 15, excluded: 8 };
      
      await runManager.updateFilter('completed', filterResult);

      expect(mockChain.update).toHaveBeenCalledWith({
        detail_processor_status: 'completed',
        detail_processor_data: filterResult,
        updated_at: expect.any(String)
      });
    });

    test('should update Storage status', async () => {
      const storageResult = { stored: 15, updated: 3, duplicates: 2 };
      
      await runManager.updateStorage('completed', storageResult);

      expect(mockChain.update).toHaveBeenCalledWith({
        data_processor_status: 'completed',
        data_processor_data: storageResult,
        updated_at: expect.any(String)
      });
    });
  });

  describe('Run Completion', () => {
    beforeEach(() => {
      runManager.runId = 'test-run-123';
      runManager.startTime = Date.now() - 5000; // 5 seconds ago
    });

    test('should complete run with calculated execution time', async () => {
      await runManager.completeRun();

      expect(mockChain.update).toHaveBeenCalledWith({
        status: 'completed',
        completed_at: expect.any(String),
        updated_at: expect.any(String),
        source_manager_status: 'completed',
        api_handler_status: 'completed',
        detail_processor_status: 'completed',
        data_processor_status: 'completed',
        total_processing_time: expect.any(Number)
      });

      const updateCall = mockChain.update.mock.calls[0][0];
      expect(updateCall.total_processing_time).toBeGreaterThan(4000);
      expect(updateCall.total_processing_time).toBeLessThan(6000);
    });

    test('should complete run with provided execution time', async () => {
      const providedTime = 12345;
      
      await runManager.completeRun(providedTime);

      expect(mockChain.update).toHaveBeenCalledWith({
        status: 'completed',
        completed_at: expect.any(String),
        updated_at: expect.any(String),
        source_manager_status: 'completed',
        api_handler_status: 'completed',
        detail_processor_status: 'completed',
        data_processor_status: 'completed',
        total_processing_time: providedTime
      });
    });

    test('should complete run with final results', async () => {
      const finalResults = { 
        opportunitiesProcessed: 25, 
        opportunitiesStored: 15, 
        version: 'v2.0' 
      };
      
      await runManager.completeRun(8000, finalResults);

      expect(mockChain.update).toHaveBeenCalledWith({
        status: 'completed',
        completed_at: expect.any(String),
        updated_at: expect.any(String),
        source_manager_status: 'completed',
        api_handler_status: 'completed',
        detail_processor_status: 'completed',
        data_processor_status: 'completed',
        total_processing_time: 8000,
        final_results: finalResults
      });
    });

    test('should handle missing run ID gracefully', async () => {
      runManager.runId = null;
      
      await runManager.completeRun();
      
      expect(mockChain.update).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      runManager.runId = 'test-run-123';
      runManager.startTime = Date.now() - 3000;
    });

    test('should handle error with Error object', async () => {
      const error = new Error('Processing failed');
      error.stack = 'Error: Processing failed\n    at test';
      
      await runManager.updateRunError(error, 'analysis_status');

      expect(mockChain.update).toHaveBeenCalledWith({
        status: 'failed',
        ended_at: expect.any(String),
        total_processing_time: expect.any(Number),
        error_message: 'Processing failed',
        error_details: expect.stringContaining('"message": "Processing failed"'),
        failed_stage: 'analysis_status',
        updated_at: expect.any(String)
      });
    });

    test('should handle error with string', async () => {
      await runManager.updateRunError('Simple error message');

      expect(mockChain.update).toHaveBeenCalledWith({
        status: 'failed',
        ended_at: expect.any(String),
        total_processing_time: expect.any(Number),
        error_message: 'Simple error message',
        error_details: '"Simple error message"',
        updated_at: expect.any(String)
      });
    });

    test('should handle error with cause', async () => {
      const error = new Error('Wrapper error');
      error.cause = 'Root cause issue';
      
      await runManager.updateRunError(error);

      expect(mockChain.update).toHaveBeenCalled();
      const updateCall = mockChain.update.mock.calls[0][0];
      const errorDetails = JSON.parse(updateCall.error_details);
      expect(errorDetails.cause).toBe('Root cause issue');
    });

    test('should handle missing run ID gracefully', async () => {
      runManager.runId = null;
      
      await runManager.updateRunError(new Error('Test error'));
      
      expect(mockChain.update).not.toHaveBeenCalled();
    });
  });

  describe('Run Retrieval and Status', () => {
    beforeEach(() => {
      runManager.runId = 'test-run-123';
    });

    test('should get run data successfully', async () => {
      const result = await runManager.getRun();

      expect(result).toEqual(mockRunData);
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'test-run-123');
    });

    test('should handle get run errors', async () => {
      mockChain.single.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      const result = await runManager.getRun();
      expect(result).toBe(null);
    });

    test('should get stage status', async () => {
      const status = await runManager.getStageStatus('source_manager_status');
      expect(status).toBe('pending');
    });

    test('should handle missing run for stage status', async () => {
      runManager.runId = null;
      const status = await runManager.getStageStatus('source_manager_status');
      expect(status).toBe(null);
    });
  });

  describe('Resume Functionality', () => {
    beforeEach(() => {
      runManager.runId = 'test-run-123';
    });

    test('should detect resumable run with pending stages', async () => {
      const canResume = await runManager.canResume();
      expect(canResume).toBe(true);
    });

    test('should detect non-resumable completed run', async () => {
      mockChain.single.mockResolvedValue({ 
        data: { ...mockRunData, status: 'completed' }, 
        error: null 
      });

      const canResume = await runManager.canResume();
      expect(canResume).toBe(false);
    });

    test('should detect non-resumable run with failed stages', async () => {
      mockChain.single.mockResolvedValue({ 
        data: { 
          ...mockRunData, 
          source_manager_status: 'completed',
          api_handler_status: 'failed',
          detail_processor_status: 'pending',
          data_processor_status: 'pending'
        }, 
        error: null 
      });

      const canResume = await runManager.canResume();
      expect(canResume).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  describe('getNextStage', () => {
    test('should return first pending stage', () => {
      const run = {
        source_manager_status: 'completed',
        api_handler_status: 'pending',
        detail_processor_status: 'pending',
        data_processor_status: 'pending'
      };

      expect(getNextStage(run)).toBe('api_handler_status');
    });

    test('should return processing stage', () => {
      const run = {
        source_manager_status: 'completed',
        api_handler_status: 'processing',
        detail_processor_status: 'pending',
        data_processor_status: 'pending'
      };

      expect(getNextStage(run)).toBe('api_handler_status');
    });

    test('should return null when all stages completed', () => {
      const run = {
        source_manager_status: 'completed',
        api_handler_status: 'completed',
        detail_processor_status: 'completed',
        data_processor_status: 'completed'
      };

      expect(getNextStage(run)).toBe(null);
    });

    test('should return null when a stage failed', () => {
      const run = {
        source_manager_status: 'completed',
        api_handler_status: 'failed',
        detail_processor_status: 'pending',
        data_processor_status: 'pending'
      };

      expect(getNextStage(run)).toBe(null);
    });
  });
}); 