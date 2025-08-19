/**
 * Unit Tests for ProcessCoordinatorV2 Service
 * 
 * Tests the orchestration of the V2 agent pipeline.
 * Simplified version that focuses on key functionality.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { processApiSourceV2 } from '../processCoordinatorV2.js';
import { RunManagerV2 } from '../runManagerV2.js';

// Mock all the V2 agents
vi.mock('../../agents-v2/core/sourceOrchestrator.js', () => ({
  analyzeSource: vi.fn()
}));

vi.mock('../../agents-v2/core/dataExtractionAgent/index.js', () => ({
  extractFromSource: vi.fn()
}));

vi.mock('../../agents-v2/core/analysisAgent.js', () => ({
  enhanceOpportunities: vi.fn()
}));

vi.mock('../../agents-v2/core/filterFunction.js', () => ({
  filterOpportunities: vi.fn()
}));

vi.mock('../../agents-v2/core/storageAgent/index.js', () => ({
  storeOpportunities: vi.fn()
}));

import { analyzeSource } from '../../agents-v2/core/sourceOrchestrator.js';
import { extractFromSource } from '../../agents-v2/core/dataExtractionAgent.js';
import { enhanceOpportunities } from '../../agents-v2/core/analysisAgent.js';
import { filterOpportunities } from '../../agents-v2/core/filterFunction.js';
import { storeOpportunities } from '../../agents-v2/core/storageAgent/index.js';

describe('ProcessCoordinatorV2', () => {
  let mockSupabase;
  let mockAnthropic;
  let mockSource;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock data
    mockSource = {
      id: 'test-source-123',
      name: 'Test Energy Program',
      type: 'government',
      api_endpoint: 'https://api.energy.test.gov/grants'
    };

    // Mock Anthropic client
    mockAnthropic = {
      messages: {
        create: vi.fn()
      }
    };

    // Create a working Supabase mock that handles the actual query patterns used
    mockSupabase = {
      from: vi.fn((table) => {
        const mockChain = {
          select: vi.fn(() => mockChain),
          insert: vi.fn(() => mockChain),
          update: vi.fn(() => mockChain),
          eq: vi.fn(() => mockChain),
          single: vi.fn()
        };

        // Configure specific responses based on table
        if (table === 'api_sources') {
          mockChain.single.mockResolvedValue({ data: mockSource, error: null });
        } else if (table === 'api_source_configurations') {
          mockChain.eq.mockResolvedValue({ 
            data: [
              { config_type: 'request', configuration: { method: 'GET' } },
              { config_type: 'auth', configuration: { method: 'none' } }
            ], 
            error: null 
          });
        } else if (table === 'api_source_runs') {
          mockChain.single.mockResolvedValue({ data: { id: 'run-123' }, error: null });
          mockChain.eq.mockResolvedValue({ data: null, error: null });
        } else if (table === 'api_activities') {
          mockChain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
        }

        return mockChain;
      })
    };
  });

  describe('RunManagerV2', () => {
    test('should initialize with proper parameters', () => {
      const runManager = new RunManagerV2('test-run-id', mockSupabase);
      
      expect(runManager.runId).toBe('test-run-id');
      expect(runManager.supabase).toBe(mockSupabase);
      expect(runManager.startTime).toBeGreaterThan(0);
    });

    test('should handle missing supabase client gracefully', async () => {
      const runManager = new RunManagerV2('test-run-id', null);
      
      // These should not throw errors when supabase is null
      await runManager.updateSourceOrchestrator('processing');
      await runManager.completeRun(1000);
      await runManager.updateRunError(new Error('test'));
      
      // Just verify it doesn't crash
      expect(runManager.runId).toBe('test-run-id');
    });
  });

  describe('processApiSourceV2 - Basic Integration', () => {
    test('should complete full V2 pipeline successfully', async () => {
      // Mock successful agent responses
      analyzeSource.mockResolvedValue({
        executionTime: 500,
        apiEndpoint: 'https://api.test.gov/grants'
      });

      extractFromSource.mockResolvedValue({
        opportunities: [{ id: 'opp-1', title: 'Test Grant' }],
        extractionMetrics: { totalFound: 1 }
      });

      enhanceOpportunities.mockResolvedValue({
        opportunities: [{ id: 'opp-1', title: 'Test Grant', scoring: { overallScore: 8 } }],
        analysisMetrics: { totalAnalyzed: 1, averageScore: 8 }
      });

      filterOpportunities.mockResolvedValue({
        includedOpportunities: [{ id: 'opp-1', scoring: { overallScore: 8 } }],
        filterMetrics: { included: 1, excluded: 0 }
      });

      storeOpportunities.mockResolvedValue({
        metrics: { newOpportunities: 1, updatedOpportunities: 0 }
      });

      const result = await processApiSourceV2('test-source-123', null, mockSupabase, mockAnthropic);

      // Verify successful result
      expect(result.status).toBe('success');
      expect(result.version).toBe('v2.0');
      expect(result.source.id).toBe('test-source-123');
      
      // Verify all agents were called
      expect(analyzeSource).toHaveBeenCalled();
      expect(extractFromSource).toHaveBeenCalled();
      expect(enhanceOpportunities).toHaveBeenCalled();
      expect(filterOpportunities).toHaveBeenCalled();
      expect(storeOpportunities).toHaveBeenCalled();
      
      // Verify metrics structure
      expect(result.metrics.sourceAnalysis).toBeDefined();
      expect(result.metrics.totalExecutionTime).toBeGreaterThan(0);
    });

    test('should handle source not found error', async () => {
      // Mock source not found
      const mockSupabaseWithError = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: 'Not found' })
            }))
          })),
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      };

      const result = await processApiSourceV2('nonexistent-source', null, mockSupabaseWithError, mockAnthropic);

      expect(result.status).toBe('error');
      expect(result.version).toBe('v2.0');
      expect(result.error).toBe('Source not found: nonexistent-source');
    });

    test('should handle agent failure gracefully', async () => {
      // Mock first agent failing
      analyzeSource.mockRejectedValue(new Error('SourceOrchestrator failed'));

      const result = await processApiSourceV2('test-source-123', null, mockSupabase, mockAnthropic);

      expect(result.status).toBe('error');
      expect(result.version).toBe('v2.0');
      expect(result.error).toBe('SourceOrchestrator failed');
      
      // Verify only the first agent was called
      expect(analyzeSource).toHaveBeenCalled();
      expect(extractFromSource).not.toHaveBeenCalled();
    });

    test('should return V1-compatible metrics format', async () => {
      // Mock simple successful responses
      analyzeSource.mockResolvedValue({ executionTime: 500 });
      extractFromSource.mockResolvedValue({ 
        opportunities: [],
        extractionMetrics: { totalFound: 5 }
      });
      enhanceOpportunities.mockResolvedValue({ 
        opportunities: [],
        analysisMetrics: { totalAnalyzed: 0 }
      });
      filterOpportunities.mockResolvedValue({ 
        includedOpportunities: [],
        filterMetrics: { included: 0 }
      });
      storeOpportunities.mockResolvedValue({ 
        metrics: { newOpportunities: 0 }
      });

      const result = await processApiSourceV2('test-source-123', null, mockSupabase, mockAnthropic);

      expect(result.status).toBe('success');
      
      // Check V1 compatibility metrics
      expect(result.metrics.initialApiMetrics.totalHitCount).toBe(5);
      expect(result.metrics.firstStageMetrics).toBeNull(); // V2 doesn't have first stage
      expect(result.metrics.totalExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      // Mock supabase to reject the promise instead of throwing synchronously
      const mockSupabaseWithError = {
        from: vi.fn((table) => {
          if (table === 'api_sources') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockRejectedValue(new Error('Database connection failed'))
                }))
              }))
            };
          }
          // For api_activities (error logging), return a working mock
          if (table === 'api_activities') {
            return {
              insert: vi.fn().mockResolvedValue({ data: null, error: null })
            };
          }
          // Default mock for any other tables
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              }))
            }))
          };
        })
      };

      const result = await processApiSourceV2('test-source-123', null, mockSupabaseWithError, mockAnthropic);

      expect(result.status).toBe('error');
      expect(result.version).toBe('v2.0');
      expect(result.error).toBe('Database connection failed');
    });
  });
}); 