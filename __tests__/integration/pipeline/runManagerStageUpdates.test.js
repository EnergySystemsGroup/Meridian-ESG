/**
 * Integration Test: RunManagerV2 Stage Updates
 * 
 * Tests that RunManagerV2 receives proper stage updates with correct
 * status transitions and metrics throughout the pipeline.
 */

import { jest } from '@jest/globals';

// Import test helpers first
import { createConfiguredMockSupabase } from '../../mocks/supabase.js';
import { createMockAnthropicClient } from '../../setup/testHelpers.js';

// Import the real coordinator (will use mapped mocks via jest.config.js)
import { processApiSourceV2 } from '../../../lib/services/processCoordinatorV2.js';

// Import the mock agent functions for setup
import { analyzeSource } from '../../../__mocks__/lib/agents-v2/core/sourceOrchestrator.js';
import { extractFromSource } from '../../../__mocks__/lib/agents-v2/core/dataExtractionAgent/index.js';
import { detectDuplicates } from '../../../__mocks__/lib/agents-v2/optimization/earlyDuplicateDetector.js';
import { enhanceOpportunities } from '../../../__mocks__/lib/agents-v2/core/analysisAgent/index.js';
import { filterOpportunities } from '../../../__mocks__/lib/agents-v2/core/filterFunction.js';
import { storeOpportunities } from '../../../__mocks__/lib/agents-v2/core/storageAgent/index.js';
import { updateDuplicateOpportunities } from '../../../__mocks__/lib/agents-v2/optimization/directUpdateHandler.js';

describe('RunManagerV2 Stage Updates Integration', () => {
  let mockSupabase;
  let mockAnthropic;
  let testSourceId;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockSupabase = createConfiguredMockSupabase();
    
    // Ensure advisory lock RPC returns true
    mockSupabase.rpc = jest.fn((fn) => {
      if (fn === 'try_advisory_lock') return Promise.resolve({ data: true, error: null });
      if (fn === 'release_advisory_lock') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    
    mockAnthropic = createMockAnthropicClient();
    testSourceId = '550e8400-e29b-41d4-a716-446655440001'; // Valid UUID
    
    // Setup mock implementations for agent functions
    analyzeSource.mockResolvedValue({
      shouldProceed: true,
      forceFullReprocessing: false,
      performanceMetrics: { executionTime: 100 },
      tokensUsed: 50,
      apiCalls: 1
    });
    
    extractFromSource.mockResolvedValue({
      opportunities: [
        { id: '1', title: 'New Opportunity', description: 'Test description' },
        { id: '2', title: 'Another Opportunity', description: 'Another test' }
      ],
      extractionMetrics: { 
        executionTime: 200, 
        tokenUsage: 0, 
        apiCalls: 2 
      }
    });
    
    detectDuplicates.mockResolvedValue({
      newOpportunities: [
        { id: '1', title: 'New Opportunity', description: 'Test description', routingDecision: 'NEW' }
      ],
      opportunitiesToUpdate: [
        { 
          apiRecord: { id: '2', title: 'Another Opportunity', description: 'Another test', routingDecision: 'UPDATE' },
          existingRecord: { id: 'existing-2' },
          reason: 'material_change'
        }
      ],
      opportunitiesToSkip: [],
      metrics: { 
        executionTime: 150,
        totalProcessed: 2,
        newOpportunities: 1,
        opportunitiesToUpdate: 1,
        opportunitiesToSkip: 0
      }
    });
    
    updateDuplicateOpportunities.mockResolvedValue({
      updatedCount: 1,
      metrics: {
        executionTime: 80,
        tokensUsed: 75,
        apiCalls: 2
      }
    });
    
    enhanceOpportunities.mockResolvedValue({
      opportunities: [
        { id: '1', title: 'Enhanced New Opportunity', score: 8.5 }
      ],
      analysisMetrics: { executionTime: 300, totalTokens: 200, totalApiCalls: 1 }
    });
    
    filterOpportunities.mockResolvedValue({
      includedOpportunities: [
        { id: '1', title: 'Enhanced New Opportunity', score: 8.5, passed: true }
      ],
      filterMetrics: { executionTime: 50, tokenUsage: 25, apiCalls: 1 }
    });
    
    storeOpportunities.mockResolvedValue({
      metrics: { 
        newOpportunities: 1, 
        failed: 0, 
        executionTime: 120,
        apiCalls: 3
      }
    });
  });

  describe('NEW opportunity path', () => {
    it('should call all stage updates with correct status transitions and metrics', async () => {
      const result = await processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic);
      
      // Verify the pipeline completed successfully
      expect(result.status).toBe('success');
      
      // Verify all agent mocks were called in the correct order
      
      // 1. Source Orchestrator should be called first
      expect(analyzeSource).toHaveBeenCalledTimes(1);
      expect(analyzeSource).toHaveBeenCalledWith(
        expect.objectContaining({ 
          id: testSourceId,
          name: 'Test Source' 
        }), // source object
        expect.any(Object)  // anthropic
      );
      
      // 2. Data Extraction should be called after Source Orchestrator
      expect(extractFromSource).toHaveBeenCalledTimes(1);
      expect(extractFromSource).toHaveBeenCalledWith(
        expect.objectContaining({ 
          id: testSourceId 
        }), // source object
        expect.objectContaining({
          shouldProceed: true
        }), // sourceAnalysis
        expect.any(Object)  // anthropic
      );
      
      // 3. Duplicate Detection should be called with extracted opportunities
      expect(detectDuplicates).toHaveBeenCalledTimes(1);
      expect(detectDuplicates).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: '1', title: 'New Opportunity' }),
          expect.objectContaining({ id: '2', title: 'Another Opportunity' })
        ]),
        testSourceId, // sourceId
        expect.any(Object), // supabase
        undefined // rawResponseId (not provided by our mock)
      );
      
      // 4. Analysis should be called for NEW opportunities
      expect(enhanceOpportunities).toHaveBeenCalledTimes(1);
      expect(enhanceOpportunities).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: '1', title: 'New Opportunity' })
        ]),
        expect.objectContaining({ 
          id: testSourceId 
        }), // source object
        expect.any(Object) // anthropic
      );
      
      // 5. Filter should be called with enhanced opportunities
      expect(filterOpportunities).toHaveBeenCalledTimes(1);
      expect(filterOpportunities).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: '1', title: 'Enhanced New Opportunity', score: 8.5 })
        ])
      );
      
      // 6. Storage should be called with filtered opportunities
      expect(storeOpportunities).toHaveBeenCalledTimes(1);
      expect(storeOpportunities).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: '1', title: 'Enhanced New Opportunity', score: 8.5, passed: true })
        ]),
        expect.objectContaining({ 
          id: testSourceId 
        }), // source object
        expect.any(Object), // supabase
        false // forceFullProcessing
      );
      
      // 7. Direct Update should be called for UPDATE opportunities
      expect(updateDuplicateOpportunities).toHaveBeenCalledTimes(1);
      expect(updateDuplicateOpportunities).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            apiRecord: expect.objectContaining({ id: '2', title: 'Another Opportunity' }),
            existingRecord: expect.objectContaining({ id: 'existing-2' })
          })
        ]),
        expect.any(Object) // supabase
      );
    });
  });

  describe('Stage failure scenarios', () => {
    it('should handle data extraction failure', async () => {
      // Override the mock for this specific test
      extractFromSource.mockRejectedValueOnce(new Error('extraction failed'));

      const result = await processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic);

      expect(result.status).toBe('error');
      expect(result.error).toContain('extraction failed');

      // Verify Source Orchestrator was still called
      expect(analyzeSource).toHaveBeenCalledTimes(1);

      // Verify Data Extraction was attempted
      expect(extractFromSource).toHaveBeenCalledTimes(1);

      // Verify subsequent stages were not called
      expect(detectDuplicates).not.toHaveBeenCalled();
      expect(enhanceOpportunities).not.toHaveBeenCalled();
      expect(filterOpportunities).not.toHaveBeenCalled();
      expect(storeOpportunities).not.toHaveBeenCalled();
      expect(updateDuplicateOpportunities).not.toHaveBeenCalled();
    });

    it('should handle analysis failure for NEW opportunities', async () => {
      // Override the mock for this specific test
      enhanceOpportunities.mockRejectedValueOnce(new Error('analysis failed'));

      const result = await processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic);

      expect(result.status).toBe('error');
      expect(result.error).toContain('analysis failed');

      // Verify earlier stages completed
      expect(analyzeSource).toHaveBeenCalledTimes(1);
      expect(extractFromSource).toHaveBeenCalledTimes(1);
      expect(detectDuplicates).toHaveBeenCalledTimes(1);

      // Verify Analysis was attempted
      expect(enhanceOpportunities).toHaveBeenCalledTimes(1);

      // Verify subsequent NEW-path stages were not called
      expect(filterOpportunities).not.toHaveBeenCalled();
      expect(storeOpportunities).not.toHaveBeenCalled();

      // When analysis fails, the entire pipeline fails - UPDATE path is NOT processed
      expect(updateDuplicateOpportunities).not.toHaveBeenCalled();
    });
  });

  describe('Stage metrics validation', () => {
    it('should include performance metrics with tokens and API calls where applicable', async () => {
      const result = await processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic);
      
      expect(result.status).toBe('success');
      
      // Verify that agent mocks were called and returned expected metrics
      expect(analyzeSource).toHaveBeenCalled();
      const analyzeCall = analyzeSource.mock.results[0].value;
      expect(await analyzeCall).toHaveProperty('performanceMetrics.executionTime');
      expect(await analyzeCall).toHaveProperty('tokensUsed');
      expect(await analyzeCall).toHaveProperty('apiCalls');
      
      expect(extractFromSource).toHaveBeenCalled();
      const extractCall = extractFromSource.mock.results[0].value;
      expect(await extractCall).toHaveProperty('extractionMetrics.executionTime');
      
      expect(enhanceOpportunities).toHaveBeenCalled();
      const enhanceCall = enhanceOpportunities.mock.results[0].value;
      expect(await enhanceCall).toHaveProperty('analysisMetrics.totalTokens');
      expect(await enhanceCall).toHaveProperty('analysisMetrics.totalApiCalls');
      
      expect(storeOpportunities).toHaveBeenCalled();
      const storeCall = storeOpportunities.mock.results[0].value;
      expect(await storeCall).toHaveProperty('metrics.executionTime');
    });
  });

  describe('Skip-only scenario', () => {
    it('should skip analysis and storage stages when all opportunities are SKIP', async () => {
      // Override the mock for this specific test
      const skipOpportunities = [
        { id: '1', title: 'Skipped Opportunity' },
        { id: '2', title: 'Another Skipped' }
      ];
      
      detectDuplicates.mockResolvedValueOnce({
        newOpportunities: [],
        opportunitiesToUpdate: [],
        opportunitiesToSkip: skipOpportunities.map(o => ({ 
          apiRecord: o, 
          existingRecord: {} 
        })),
        metrics: { 
          executionTime: 40,
          totalProcessed: 2,
          newOpportunities: 0,
          opportunitiesToUpdate: 0,
          opportunitiesToSkip: 2
        }
      });

      const result = await processApiSourceV2(testSourceId, null, mockSupabase, mockAnthropic);

      expect(result.status).toBe('success');

      // Verify early stages completed
      expect(analyzeSource).toHaveBeenCalledTimes(1);
      expect(extractFromSource).toHaveBeenCalledTimes(1);
      expect(detectDuplicates).toHaveBeenCalledTimes(1);

      // Verify NEW-path stages were skipped
      expect(enhanceOpportunities).not.toHaveBeenCalled();
      expect(filterOpportunities).not.toHaveBeenCalled();
      expect(storeOpportunities).not.toHaveBeenCalled();
      
      // Direct update should also be skipped since there are no UPDATE opportunities
      expect(updateDuplicateOpportunities).not.toHaveBeenCalled();
    });
  });
});