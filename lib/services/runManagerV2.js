/**
 * RunManagerV2 - Enhanced run tracking for Agent Architecture V2
 * 
 * ENHANCED WITH CLEAN V2 METRICS SYSTEM:
 * - Uses semantic database tables (pipeline_runs, pipeline_stages, etc.)
 * - Captures optimization insights and token savings
 * - Tracks opportunity processing paths (NEW/UPDATE/SKIP)
 * - Records detailed duplicate detection analytics
 * - Maintains V1 compatibility for backward support
 * 
 * Supports the new V2 pipeline stages:
 * - SourceOrchestrator
 * - ApiFetch (new: raw data collection and chunking)
 * - DataExtractionAgent (LLM-powered extraction)
 * - EarlyDuplicateDetector
 * - AnalysisAgent
 * - FilterFunction
 * - StorageAgent
 * - DirectUpdateHandler
 * 
 * Features:
 * - Clean semantic metrics optimized for dashboard analytics
 * - Real-time optimization impact tracking
 * - Stage-by-stage performance monitoring
 * - Opportunity flow path analytics
 * - Duplicate detection effectiveness measurement
 * - V1 backward compatibility layer
 * - Compatible with Edge Functions and Vercel deployments
 */

// Conditional import - only in non-test environments
let createSupabaseClient = null;
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
  try {
    const supabaseModule = require('@/utils/supabase.js');
    createSupabaseClient = supabaseModule.createSupabaseClient;
  } catch (error) {
    // If import fails, leave as null
  }
}

// Import enhanced metrics calculator
import { 
  calculateSuccessRate, 
  calculateSLACompliance, 
  initializeFailureTracking, 
  recordFailure,
  FAILURE_CATEGORIES,
  SLA_TARGETS 
} from '@/lib/utils/metricsCalculator.js';

export class RunManagerV2 {
  constructor(existingRunId = null, supabaseClient = null) {
    // Use injected client or create one if available
    this.supabase = supabaseClient || (createSupabaseClient ? createSupabaseClient() : null);
    this.runId = existingRunId;
    this.v2RunId = existingRunId; // Use same ID for V2 metrics when provided
    this.startTime = Date.now();
    
    // Timeout configuration
    this.timeoutMs = 30 * 60 * 1000; // 30 minutes default
    this.timeoutTimer = null;
    this.isCompleted = false;
    this.isUpdating = false; // Mutex to prevent concurrent status updates
    
    // Stage tracking for V2 metrics
    this.stageOrder = {
      'source_orchestrator': 1,
      'api_fetch': 2,
      'data_extraction': 3,
      'early_duplicate_detector': 4,
      'analysis': 5,
      'filter': 6,
      'storage': 7,
      'direct_update': 8,
      'job_queue': 9
    };
    
    // Enhanced failure tracking for realistic metrics
    this.failureTracking = initializeFailureTracking();
    
    // Track current run configuration
    this.runConfiguration = {
      pipeline_version: 'v2.0',
      optimization_enabled: true,
      early_duplicate_detection: true
    };
  }

  /**
   * Start a new run for V2 processing
   * Creates both V1 (backward compatibility) and V2 (clean metrics) run records
   * @param {string} sourceId - The API source ID
   * @param {Object} configuration - Optional run configuration
   * @returns {Promise<string>} - The created run ID (V1 for compatibility)
   */
  async startRun(sourceId, configuration = {}) {
    // If we already have a run ID, return it instead of creating a new one
    if (this.runId) {
      console.log(`[RunManagerV2] ✅ Using existing run: ${this.runId}`);
      return this.runId;
    }
    
    if (!this.supabase) {
      throw new Error('Supabase client is required to start a run');
    }
    
    // Merge configuration
    this.runConfiguration = { ...this.runConfiguration, ...configuration };
    
    try {
      // Create V2 clean metrics run record only
      const { data: v2Data, error: v2Error } = await this.supabase
        .from('pipeline_runs')
        .insert({
          api_source_id: sourceId,
          status: 'started',
          pipeline_version: this.runConfiguration.pipeline_version,
          run_configuration: this.runConfiguration,
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (v2Error) throw v2Error;
      
      this.runId = v2Data.id;
      this.v2RunId = v2Data.id;
      
      // Start timeout protection
      this.startTimeoutProtection();
      
      console.log(`[RunManagerV2] ✅ Created V2 pipeline run: ${this.runId}`);
      return this.runId;
      
    } catch (error) {
      console.error('[RunManagerV2] ❌ Failed to start run:', error);
      throw error;
    }
  }

  /**
   * Start timeout protection for the run
   * Automatically marks run as failed if it exceeds timeout
   */
  startTimeoutProtection() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }
    
    this.timeoutTimer = setTimeout(async () => {
      // Use atomic boolean swap to prevent races
      const wasUpdating = this.isUpdating;
      if (wasUpdating) return; // Skip if already updating
      
      this.isUpdating = true;
      try {
        // Double-check completion status
        if (!this.isCompleted && !wasUpdating) {
          console.error(`[RunManagerV2] ⏰ Run ${this.runId} timed out after ${this.timeoutMs}ms`);
          await this.updateRunError(
            new Error(`Pipeline run timed out after ${this.timeoutMs / 1000 / 60} minutes`),
            'timeout'
          );
        }
      } finally {
        this.isUpdating = false;
        // Clear the timer reference after execution
        this.timeoutTimer = null;
      }
    }, this.timeoutMs);
    
    console.log(`[RunManagerV2] ⏰ Started timeout protection: ${this.timeoutMs / 1000 / 60} minutes`);
  }

  /**
   * Clear timeout protection (called when run completes or fails)
   */
  clearTimeoutProtection() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.isCompleted = true;
  }
  
  /**
   * Cleanup method to prevent memory leaks
   * Should be called when RunManager is no longer needed
   */
  cleanup() {
    this.clearTimeoutProtection();
    this.isCompleted = true;
    this.supabase = null;
    this.anthropic = null;
    this.runData = null;
  }

  /**
   * V2 Clean Metrics Stage Helper Methods
   * These update V2 semantic database tables only
   */
  
  async updateV2SourceOrchestrator(status, analysisResult = null, metrics = null, tokensUsed = 0, apiCalls = 0, inputCount = 0, outputCount = 0) {
    // V2 clean metrics only
    await this.updateV2Stage('source_orchestrator', status, analysisResult, metrics, tokensUsed, apiCalls, inputCount, outputCount);
  }
  
  async updateV2ApiFetch(status, apiResult = null, metrics = null, tokensUsed = 0, apiCalls = 0, inputCount = 0, outputCount = 0) {
    // V2 clean metrics for API fetching and chunking stage
    // Used for raw data collection from external APIs (pre-LLM processing)
    await this.updateV2Stage('api_fetch', status, apiResult, metrics, tokensUsed, apiCalls, inputCount, outputCount);
  }
  
  async updateV2DataExtraction(status, extractionResult = null, metrics = null, tokensUsed = 0, apiCalls = 0, inputCount = 0, outputCount = 0, jobId = null) {
    // V2 clean metrics only - ensure execution time is properly handled
    const performanceMetrics = metrics ? { executionTime: metrics.execution_time_ms || metrics.executionTime || 0 } : {};
    await this.updateV2Stage('data_extraction', status, extractionResult, performanceMetrics, tokensUsed, apiCalls, inputCount, outputCount, jobId);
  }

  async updateV2EarlyDuplicateDetector(status, detectionResult = null, metrics = null, inputCount = 0, outputCount = 0, jobId = null) {
    // V2 only - no V1 equivalent
    // Extract executionTime from metrics and format as performanceMetrics
    const performanceMetrics = metrics ? { executionTime: metrics.execution_time_ms || metrics.executionTime || 0 } : {};
    await this.updateV2Stage('early_duplicate_detector', status, detectionResult, performanceMetrics, 0, 0, inputCount, outputCount, jobId);
    
    // Record duplicate detection session if completed
    if (status === 'completed' && detectionResult) {
      await this.recordDuplicateDetectionSession(detectionResult, metrics);
    }
  }
  
  async updateV2Analysis(status, analysisResult = null, metrics = null, tokensUsed = 0, apiCalls = 0, inputCount = 0, outputCount = 0) {
    // V2 clean metrics only
    await this.updateV2Stage('analysis', status, analysisResult, metrics, tokensUsed, apiCalls, inputCount, outputCount);
  }
  
  async updateV2Filter(status, filterResult = null, metrics = null, inputCount = 0, outputCount = 0) {
    // V2 clean metrics only
    await this.updateV2Stage('filter', status, filterResult, metrics, 0, 0, inputCount, outputCount);
  }
  
  async updateV2Storage(status, storageResult = null, metrics = null, tokensUsed = 0, inputCount = 0, outputCount = 0) {
    // V2 clean metrics only
    await this.updateV2Stage('storage', status, storageResult, metrics, tokensUsed, 0, inputCount, outputCount);
  }

  async updateV2DirectUpdate(status, updateResult = null, metrics = null, inputCount = 0, outputCount = 0, jobId = null) {
    // V2 only - no V1 equivalent
    const performanceMetrics = metrics ? { executionTime: metrics.execution_time_ms || metrics.executionTime || 0 } : {};
    await this.updateV2Stage('direct_update', status, updateResult, performanceMetrics, 0, 0, inputCount, outputCount, jobId);
  }


  /**
   * Get job metrics for master run aggregation
   * @param {string} masterRunId - Master run ID to get metrics for
   * @returns {Promise<Array>} - Array of job metrics
   */
  async getJobMetrics(masterRunId) {
    if (!this.supabase) {
      const error = new Error('[RunManagerV2] No Supabase client available for job metrics');
      console.error(error.message);
      throw error;
    }

    try {
      const { data: jobs, error } = await this.supabase
        .from('processing_jobs')
        .select('status, processing_time_ms, tokens_used, estimated_cost_usd')
        .eq('master_run_id', masterRunId);

      if (error) {
        console.error('[RunManagerV2] ❌ Database error fetching job metrics:', error);
        throw new Error(`Failed to fetch job metrics: ${error.message}`);
      }

      return jobs || [];
    } catch (error) {
      console.error('[RunManagerV2] ❌ Failed to get job metrics:', error);
      throw error; // Re-throw for proper error handling upstream
    }
  }

  /**
   * Update run status through RunManagerV2 instead of direct database calls
   * @param {string} status - New status for the run
   * @param {Object} additionalUpdates - Additional fields to update
   */
  async updateRunStatus(status, additionalUpdates = {}) {
    if (!this.runId) {
      console.warn('[RunManagerV2] ⚠️ No active run ID, skipping status update');
      return;
    }

    if (!this.supabase) {
      console.warn('[RunManagerV2] ⚠️ No Supabase client available, skipping database update');
      return;
    }

    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString(),
        ...additionalUpdates
      };

      const { error } = await this.supabase
        .from('pipeline_runs')
        .update(updateData)
        .eq('id', this.runId);

      if (error) {
        console.error(`[RunManagerV2] ❌ Error updating run status to ${status}:`, error);
      } else {
        console.log(`[RunManagerV2] ✅ Updated run ${this.runId} status to ${status}`);
      }
    } catch (error) {
      console.error(`[RunManagerV2] ❌ Failed to update run status:`, error);
    }
  }

  /**
   * Legacy V1 compatibility methods (map to V2 equivalents)
   */
  async updateApiHandler(status, data = null, metrics = null) {
    return this.updateDataExtraction(status, data, metrics);
  }
  
  async updateDetailProcessor(status, data = null, metrics = null) {
    return this.updateFilter(status, data, metrics);
  }
  
  async updateDataProcessor(status, data = null, metrics = null) {
    return this.updateStorage(status, data, metrics);
  }

  /**
   * V1 Pipeline-Specific Methods (for full backward compatibility)
   */
  async updateInitialApiCall(stats) {
    if (!this.runId || !this.supabase) {
      console.warn('[RunManagerV2] ⚠️ Cannot update initial API call - missing run ID or client');
      return;
    }

    // Process stats to ensure backward compatibility with responseSamples
    const processedStats = { ...stats };
    if (processedStats.responseSamples) {
      processedStats._responseSamplesMetadataOnly = true;
    } else if (processedStats.sampleOpportunities) {
      processedStats.responseSamples = processedStats.sampleOpportunities.map(
        (sample, i) => ({
          ...sample,
          _metadataOnly: true,
          _debugSample: true,
          _sampleIndex: i,
          _convertedFromLegacyFormat: true,
        })
      );
      processedStats._responseSamplesMetadataOnly = true;
      processedStats._legacySampleOpportunities = processedStats.sampleOpportunities;
      delete processedStats.sampleOpportunities;
    }

    return await this.supabase
      .from('api_source_runs')
      .update({
        initial_api_call: processedStats,
        status: 'processing',
        source_manager_status: 'completed',
        api_handler_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.runId);
  }

  async updateFirstStageFilter(stats) {
    if (!this.runId || !this.supabase) {
      console.warn('[RunManagerV2] ⚠️ Cannot update first stage filter - missing run ID or client');
      return;
    }

    // Process stats for backward compatibility
    const processedStats = { ...stats };
    if (processedStats.responseSamples) {
      processedStats._responseSamplesMetadataOnly = true;
    } else if (processedStats.sampleOpportunities) {
      processedStats.responseSamples = processedStats.sampleOpportunities.map(
        (sample, i) => ({
          ...sample,
          _metadataOnly: true,
          _debugSample: true,
          _sampleIndex: i,
          _filterStage: 'first',
          _convertedFromLegacyFormat: true,
        })
      );
      processedStats._responseSamplesMetadataOnly = true;
      processedStats._legacySampleOpportunities = processedStats.sampleOpportunities;
      delete processedStats.sampleOpportunities;
    }

    return await this.supabase
      .from('api_source_runs')
      .update({
        first_stage_filter: processedStats,
        api_handler_status: 'completed',
        detail_processor_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.runId);
  }

  async updateDetailApiCalls(stats) {
    if (!this.runId || !this.supabase) {
      console.warn('[RunManagerV2] ⚠️ Cannot update detail API calls - missing run ID or client');
      return;
    }

    return await this.supabase
      .from('api_source_runs')
      .update({
        detail_api_calls: stats,
        detail_processor_status: 'completed',
        data_processor_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.runId);
  }

  async updateSecondStageFilter(stats) {
    if (!this.runId || !this.supabase) {
      console.warn('[RunManagerV2] ⚠️ Cannot update second stage filter - missing run ID or client');
      return;
    }

    return await this.supabase
      .from('api_source_runs')
      .update({
        second_stage_filter: stats,
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.runId);
  }

  async updateStorageResults(stats) {
    if (!this.runId || !this.supabase) {
      console.warn('[RunManagerV2] ⚠️ Cannot update storage results - missing run ID or client');
      return;
    }

    return await this.supabase
      .from('api_source_runs')
      .update({
        storage_results: stats,
        data_processor_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.runId);
  }

  // =============================================================================
  // V2 CLEAN METRICS SYSTEM METHODS
  // =============================================================================

  /**
   * Update a V2 pipeline stage with clean metrics
   * @param {string} stageName - Clean stage name (e.g., 'data_extraction', 'early_duplicate_detector')
   * @param {string} status - Stage status
   * @param {Object} stageResults - Stage execution results
   * @param {Object} performanceMetrics - Performance metrics for the stage
   * @param {number} tokensUsed - Tokens consumed by this stage
   * @param {number} apiCalls - API calls made by this stage
   * @param {number} inputCount - Number of inputs to this stage
   * @param {number} outputCount - Number of outputs from this stage
   * @param {string} jobId - Optional job ID to create separate stage records per job
   */
  async updateV2Stage(stageName, status, stageResults = {}, performanceMetrics = {}, tokensUsed = 0, apiCalls = 0, inputCount = 0, outputCount = 0, jobId = null) {
    if (!this.v2RunId || !this.supabase) {
      console.warn(`[RunManagerV2] ⚠️ Cannot update V2 stage ${stageName} - missing V2 run ID or client`);
      return;
    }

    const stageOrder = this.stageOrder[stageName] || 0;
    const executionTime = performanceMetrics?.executionTime || null;
    const now = new Date().toISOString();

    try {
      let existingStage = null;
      
      // Check for existing stage based on whether jobId is provided
      if (jobId) {
        // When jobId is provided, look for existing stage for this specific job
        const { data } = await this.supabase
          .from('pipeline_stages')
          .select('id, started_at, completed_at')
          .eq('run_id', this.v2RunId)
          .eq('stage_name', stageName)
          .eq('job_id', jobId)
          .single();
        existingStage = data;
      } else {
        // Legacy behavior: look for existing stage without job_id
        const { data } = await this.supabase
          .from('pipeline_stages')
          .select('id, started_at, completed_at')
          .eq('run_id', this.v2RunId)
          .eq('stage_name', stageName)
          .single();
        existingStage = data;
      }

      if (existingStage) {
        // Calculate estimated cost based on tokens used
        const estimatedCost = tokensUsed > 0 ? (tokensUsed / 1000) * 0.01 : 0; // $0.01 per 1000 tokens
        
        // Update existing stage
        const updateData = {
          status,
          stage_results: this.sanitizeJsonData(stageResults),
          performance_metrics: this.sanitizeJsonData(performanceMetrics),
          tokens_used: this.sanitizeInteger(tokensUsed),
          api_calls_made: this.sanitizeInteger(apiCalls),
          input_count: this.sanitizeInteger(inputCount),
          output_count: this.sanitizeInteger(outputCount),
          estimated_cost_usd: parseFloat(estimatedCost.toFixed(6)),
          updated_at: now
        };

        // Set started_at when transitioning to 'processing' if not already set
        if (status === 'processing' && !existingStage.started_at) {
          updateData.started_at = now;
        }

        if (status === 'completed' && !existingStage.completed_at) {
          updateData.completed_at = now;
          if (executionTime && existingStage.started_at) {
            updateData.execution_time_ms = this.sanitizeInteger(executionTime);
          }
        }

        const { error } = await this.supabase
          .from('pipeline_stages')
          .update(updateData)
          .eq('id', existingStage.id);

        if (error) {
          console.error(`[RunManagerV2] ❌ Failed to update V2 stage ${stageName}:`, error);
        } else {
          console.log(`[RunManagerV2] 📊 Updated V2 stage ${stageName}: ${status}`);
        }
      } else {
        // Calculate estimated cost for new stage record
        const estimatedCost = tokensUsed > 0 ? (tokensUsed / 1000) * 0.01 : 0; // $0.01 per 1000 tokens
        
        // Create new stage record
        const { error } = await this.supabase
          .from('pipeline_stages')
          .insert({
            run_id: this.v2RunId,
            stage_name: stageName,
            stage_order: stageOrder,
            status,
            job_id: jobId, // Include job_id for separate records per job
            started_at: status === 'processing' ? now : null,
            completed_at: status === 'completed' ? now : null,
            execution_time_ms: status === 'completed' ? this.sanitizeInteger(executionTime) : null,
            api_calls_made: this.sanitizeInteger(apiCalls),
            tokens_used: this.sanitizeInteger(tokensUsed),
            estimated_cost_usd: parseFloat(estimatedCost.toFixed(6)),
            input_count: this.sanitizeInteger(inputCount),
            output_count: this.sanitizeInteger(outputCount),
            stage_results: this.sanitizeJsonData(stageResults),
            performance_metrics: this.sanitizeJsonData(performanceMetrics)
          });

        if (error) {
          console.error(`[RunManagerV2] ❌ Failed to create V2 stage ${stageName}:`, error);
        } else {
          console.log(`[RunManagerV2] 📊 Created V2 stage ${stageName}: ${status}`);
        }
      }
    } catch (error) {
      console.error(`[RunManagerV2] ❌ Error updating V2 stage ${stageName}:`, error);
    }
  }

  /**
   * Record opportunity processing path
   * @param {Object} opportunity - The opportunity being processed
   * @param {string} pathType - 'NEW', 'UPDATE', or 'SKIP'
   * @param {string} pathReason - Reason for the path taken
   * @param {Array} stagesProcessed - Array of stage names the opportunity went through
   * @param {string} finalOutcome - Final outcome ('stored', 'updated', 'skipped', 'filtered_out', 'failed')
   * @param {Object} analytics - Analytics data (tokens used, processing time, etc.)
   */
  async recordOpportunityPath(opportunity, pathType, pathReason, stagesProcessed = [], finalOutcome, analytics = {}) {
    if (!this.v2RunId || !this.supabase) {
      console.warn('[RunManagerV2] ⚠️ Cannot record opportunity path - missing V2 run ID or client');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('opportunity_processing_paths')
        .insert({
          run_id: this.v2RunId,
          api_opportunity_id: opportunity.api_opportunity_id || opportunity.id,
          opportunity_title: opportunity.title,
          funding_source_id: opportunity.funding_source_id,
          path_type: pathType,
          path_reason: pathReason,
          stages_processed: stagesProcessed,
          final_outcome: finalOutcome,
          tokens_used: analytics.tokensUsed || 0,
          processing_time_ms: analytics.processingTimeMs || 0,
          cost_usd: analytics.costUsd || 0,
          duplicate_detected: analytics.duplicateDetected || false,
          existing_opportunity_id: analytics.existingOpportunityId || null,
          changes_detected: analytics.changesDetected || [],
          duplicate_detection_method: analytics.duplicateDetectionMethod || null,
          processing_quality_score: analytics.qualityScore || null
        });

      if (error) {
        console.error('[RunManagerV2] ❌ Failed to record opportunity path:', error);
      } else {
        console.log(`[RunManagerV2] 📈 Recorded ${pathType} path for opportunity: ${opportunity.title || opportunity.id}`);
      }
    } catch (error) {
      console.error('[RunManagerV2] ❌ Error recording opportunity path:', error);
    }
  }

  /**
   * Record duplicate detection session analytics
   * @param {Object} detectionResults - Results from EarlyDuplicateDetector
   * @param {Object} performanceMetrics - Performance metrics for the detection session
   * @param {Object} qualityMetrics - Quality metrics (accuracy, false positives, etc.)
   */
  async recordDuplicateDetectionSession(detectionResults, performanceMetrics = {}, qualityMetrics = {}) {
    if (!this.v2RunId || !this.supabase) {
      console.warn('[RunManagerV2] ⚠️ Cannot record duplicate detection session - missing V2 run ID or client');
      return;
    }

    try {
      const metrics = detectionResults.metrics || {};
      const { error } = await this.supabase
        .from('duplicate_detection_sessions')
        .insert({
          run_id: this.v2RunId,
          api_source_id: await this.getApiSourceId(),
          total_opportunities_checked: metrics.totalProcessed || 0,
          new_opportunities: metrics.newOpportunities || 0,
          duplicates_to_update: metrics.opportunitiesToUpdate || 0,
          duplicates_to_skip: metrics.opportunitiesToSkip || 0,
          detection_time_ms: metrics.executionTime || 0,
          database_queries_made: performanceMetrics.databaseQueries || 0,
          llm_processing_bypassed: (metrics.opportunitiesToUpdate || 0) + (metrics.opportunitiesToSkip || 0),
          id_matches: performanceMetrics.idMatches || 0,
          title_matches: performanceMetrics.titleMatches || 0,
          validation_failures: performanceMetrics.validationFailures || 0,
          freshness_skips: performanceMetrics.freshnessSkips || 0
        });

      if (error) {
        console.error('[RunManagerV2] ❌ Failed to record duplicate detection session:', error);
      } else {
        console.log(`[RunManagerV2] 🔍 Recorded duplicate detection session: ${metrics.totalProcessed} opportunities checked`);
      }
    } catch (error) {
      console.error('[RunManagerV2] ❌ Error recording duplicate detection session:', error);
    }
  }

  /**
   * Update overall run optimization metrics
   * @param {Object} optimizationMetrics - Overall optimization impact metrics
   */
  async updateOptimizationMetrics(optimizationMetrics) {
    if (!this.v2RunId || !this.supabase) {
      console.warn('[RunManagerV2] ⚠️ Cannot update optimization metrics - missing V2 run ID or client');
      return;
    }

    // Calculate enhanced absolute performance metrics
    const totalOpportunities = this.sanitizeInteger(optimizationMetrics.totalOpportunities) || 0;
    const totalTokens = this.sanitizeInteger(optimizationMetrics.totalTokens) || 0;
    const totalCost = parseFloat(optimizationMetrics.estimatedCost) || 0;
    const totalTimeMs = optimizationMetrics.totalExecutionTime || (this.startTime ? (Date.now() - this.startTime) : null);
    
    const absoluteMetrics = {};
    
    // Calculate opportunities per minute (throughput)
    if (totalTimeMs && totalTimeMs > 0 && totalOpportunities > 0) {
      const minutes = totalTimeMs / (1000 * 60);
      absoluteMetrics.opportunities_per_minute = Math.round((totalOpportunities / minutes) * 100) / 100;
    }
    
    // Calculate tokens per opportunity (efficiency)
    if (totalOpportunities > 0 && totalTokens > 0) {
      absoluteMetrics.tokens_per_opportunity = Math.round((totalTokens / totalOpportunities) * 100) / 100;
    }
    
    // Calculate cost per opportunity (cost efficiency)
    if (totalOpportunities > 0 && totalCost > 0) {
      absoluteMetrics.cost_per_opportunity_usd = Math.round((totalCost / totalOpportunities) * 10000) / 10000;
    }
    
    // Enhanced success rate calculation using failure tracking
    const successRateMetrics = {
      totalOpportunities,
      failures: this.failureTracking
    };
    absoluteMetrics.success_rate_percentage = calculateSuccessRate(successRateMetrics);
    
    // Enhanced SLA compliance calculation
    const slaMetrics = {
      totalExecutionTime: totalTimeMs,
      successRate: absoluteMetrics.success_rate_percentage,
      costPerOpportunity: absoluteMetrics.cost_per_opportunity_usd || 0,
      throughput: absoluteMetrics.opportunities_per_minute || 0
    };
    
    const slaCompliance = calculateSLACompliance(slaMetrics);
    absoluteMetrics.sla_compliance_percentage = slaCompliance.overall;
    
    // Store failure breakdown and SLA details for analysis
    absoluteMetrics.failure_breakdown = this.failureTracking;
    absoluteMetrics.sla_breakdown = slaCompliance.breakdown;
    absoluteMetrics.sla_grade = slaCompliance.grade;

    try {
      const { error } = await this.supabase
        .from('pipeline_runs')
        .update({
          total_opportunities_processed: totalOpportunities,
          opportunities_bypassed_llm: this.sanitizeInteger(optimizationMetrics.bypassedLLM) || 0,
          total_tokens_used: totalTokens,
          total_api_calls: this.sanitizeInteger(optimizationMetrics.totalApiCalls) || 0,
          estimated_cost_usd: totalCost,
          ...absoluteMetrics, // Add the calculated absolute metrics
          updated_at: new Date().toISOString()
        })
        .eq('id', this.v2RunId);

      if (error) {
        console.error('[RunManagerV2] ❌ Failed to update optimization metrics:', error);
      } else {
        console.log(`[RunManagerV2] 📊 Updated optimization metrics: ${absoluteMetrics.opportunities_per_minute || 'N/A'} opp/min, ${absoluteMetrics.success_rate_percentage || 'N/A'}% success rate`);
      }
    } catch (error) {
      console.error('[RunManagerV2] ❌ Error updating optimization metrics:', error);
    }
  }

  /**
   * Helper method to get API source ID from V1 run
   */
  async getApiSourceId() {
    if (!this.runId || !this.supabase) return null;
    
    try {
      const { data } = await this.supabase
        .from('pipeline_runs')
        .select('api_source_id')
        .eq('id', this.runId)
        .single();
      
      return data?.api_source_id || null;
    } catch (error) {
      console.warn('[RunManagerV2] ⚠️ Could not retrieve API source ID:', error);
      return null;
    }
  }

  /**
   * Complete the run successfully
   * @param {number} totalTime - Total execution time in milliseconds (V1 compatibility)
   * @param {Object} finalResults - Final processing results (V2 enhancement)
   */
  async completeRun(totalTime = null, finalResults = null) {
    if (!this.runId) {
      console.warn('[RunManagerV2] ⚠️ No active run ID, skipping completion');
      return;
    }
    
    if (!this.supabase) {
      console.warn('[RunManagerV2] ⚠️ No Supabase client available, skipping database update');
      return;
    }
    
    // Prevent concurrent updates using mutex
    if (this.isUpdating) {
      console.warn(`[RunManagerV2] ⚠️ Update already in progress for run ${this.runId}`);
      return;
    }
    
    this.isUpdating = true;
    
    try {
      const executionTime = totalTime || (Date.now() - this.startTime);
      
      console.log(`[RunManagerV2] 🏁 Completing run ${this.runId} (${executionTime}ms)`);
    
    // Calculate final absolute metrics at completion
    const finalAbsoluteMetrics = {};
    
    // Use aggregated metrics from finalResults if available, otherwise get from run data
    let totalOpportunities = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let totalApiCalls = 0;
    let opportunitiesBypassed = 0;
    
    if (finalResults && finalResults.total_opportunities_processed > 0) {
      // Use the aggregated metrics from pipeline stages
      totalOpportunities = finalResults.total_opportunities_processed;
      totalTokens = finalResults.total_tokens_used || 0;
      totalApiCalls = finalResults.total_api_calls || 0;
      opportunitiesBypassed = finalResults.opportunities_bypassed_llm || 0;
      
      // Calculate cost if not provided
      if (finalResults.estimated_cost_usd) {
        totalCost = finalResults.estimated_cost_usd;
      } else {
        // Estimate cost from tokens (rough estimate: $0.01 per 1000 tokens)
        totalCost = (totalTokens / 1000) * 0.01;
      }
      
      console.log(`[RunManagerV2] 📊 Using aggregated stage metrics: ${totalOpportunities} opportunities, ${totalTokens} tokens`);
    } else {
      // Fallback to current run data
      const { data: completionRunData } = await this.supabase
        .from('pipeline_runs')
        .select('total_opportunities_processed, total_tokens_used, estimated_cost_usd, total_api_calls')
        .eq('id', this.runId)
        .single();
        
      if (completionRunData) {
        totalOpportunities = completionRunData.total_opportunities_processed || 0;
        totalTokens = completionRunData.total_tokens_used || 0;
        totalCost = completionRunData.estimated_cost_usd || 0;
        totalApiCalls = completionRunData.total_api_calls || 0;
      }
      
      console.log(`[RunManagerV2] 📊 Using fallback run data: ${totalOpportunities} opportunities, ${totalTokens} tokens`);
    }
    
    if (totalOpportunities > 0) {
      
      // Final opportunities per minute calculation
      if (executionTime > 0) {
        const minutes = executionTime / (1000 * 60);
        finalAbsoluteMetrics.opportunities_per_minute = Math.round((totalOpportunities / minutes) * 100) / 100;
      }
      
      // Final tokens per opportunity calculation  
      if (totalTokens > 0) {
        finalAbsoluteMetrics.tokens_per_opportunity = Math.round((totalTokens / totalOpportunities) * 100) / 100;
      }
      
      // Final cost per opportunity calculation
      if (totalCost > 0) {
        finalAbsoluteMetrics.cost_per_opportunity_usd = Math.round((totalCost / totalOpportunities) * 10000) / 10000;
      }
      
      // Calculate realistic success rate and SLA compliance for completed runs
      const successRateMetrics = {
        totalOpportunities,
        failures: this.failureTracking
      };
      finalAbsoluteMetrics.success_rate_percentage = calculateSuccessRate(successRateMetrics);
      
      // Calculate SLA compliance based on actual performance
      const slaMetrics = {
        totalExecutionTime: executionTime,
        successRate: finalAbsoluteMetrics.success_rate_percentage,
        costPerOpportunity: finalAbsoluteMetrics.cost_per_opportunity_usd || 0,
        throughput: finalAbsoluteMetrics.opportunities_per_minute || 0
      };
      
      const slaCompliance = calculateSLACompliance(slaMetrics);
      finalAbsoluteMetrics.sla_compliance_percentage = slaCompliance.overall;
      finalAbsoluteMetrics.failure_breakdown = this.failureTracking;
      finalAbsoluteMetrics.sla_breakdown = slaCompliance.breakdown;
      finalAbsoluteMetrics.sla_grade = slaCompliance.grade;
    }

    // V2 clean metrics with absolute performance tracking
    const updateData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      total_execution_time_ms: executionTime,
      
      // Update run-level totals with aggregated stage metrics
      total_opportunities_processed: totalOpportunities,
      total_tokens_used: totalTokens,
      total_api_calls: totalApiCalls,
      estimated_cost_usd: totalCost,
      opportunities_bypassed_llm: opportunitiesBypassed,
      
      // Calculate success_rate_percentage from finalResults or fall back to calculation
      success_rate_percentage: finalResults?.success_rate_percentage != null 
        ? finalResults.success_rate_percentage 
        : 100, // Default to 100% if no failures recorded
      
      final_results: finalResults || {},
      ...finalAbsoluteMetrics, // Include calculated absolute metrics
      updated_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('pipeline_runs')
      .update(updateData)
      .eq('id', this.runId);

    if (error) {
      console.error('[RunManagerV2] ❌ Failed to complete V2 run:', error);
    } else {
      console.log(`[RunManagerV2] ✅ Completed V2 run: ${this.runId}`);
    }
    
    } finally {
      this.isUpdating = false;
      // Clear timeout protection
      this.clearTimeoutProtection();
    }
  }

  /**
   * Mark the run as failed with error details
   * @param {Error} error - The error that caused the failure
   * @param {string} failedStage - Which stage failed
   */
  async updateRunError(error, failedStage = null) {
    if (!this.runId) {
      console.warn('[RunManagerV2] ⚠️ No active run ID, skipping error update');
      return;
    }
    
    if (!this.supabase) {
      console.warn('[RunManagerV2] ⚠️ No Supabase client available, skipping database update');
      return;
    }
    
    // Prevent concurrent updates using mutex
    if (this.isUpdating) {
      console.warn(`[RunManagerV2] ⚠️ Update already in progress for run ${this.runId}`);
      return;
    }
    
    this.isUpdating = true;
    
    try {
      // Check current status first to prevent overwriting terminal states
      const { data: statusCheckRun } = await this.supabase
        .from('pipeline_runs')
        .select('status')
        .eq('id', this.runId)
        .single();
      
      if (statusCheckRun?.status === 'failed' || statusCheckRun?.status === 'completed') {
        console.warn(`[RunManagerV2] ⚠️ Run ${this.runId} already in terminal state: ${statusCheckRun.status}`);
        return;
      }
      
      const totalTime = Date.now() - this.startTime;
      
      console.log(`[RunManagerV2] ❌ Run ${this.runId} failed: ${error.message}`);
      
      const errorDetails = error instanceof Error 
        ? {
            message: error.message,
            stack: error.stack,
            failedStage: failedStage,
            ...(error.cause && { cause: String(error.cause) })
          }
        : String(error);
      
      // Get current run data to calculate meaningful failure metrics
      const { data: failureRunData } = await this.supabase
        .from('pipeline_runs')
        .select('total_opportunities_processed, total_tokens_used, estimated_cost_usd, total_api_calls')
        .eq('id', this.runId)
        .single();
      
      // Calculate failure-specific metrics
      const failureMetrics = {};
      const totalOpportunities = failureRunData?.total_opportunities_processed || 0;
      const totalTokens = failureRunData?.total_tokens_used || 0;
      const totalCost = failureRunData?.estimated_cost_usd || 0;
      
      // Calculate meaningful failure metrics
      if (totalTime > 0) {
        const minutes = totalTime / (1000 * 60);
        // Even for failures, show throughput of what was attempted
        failureMetrics.opportunities_per_minute = totalOpportunities > 0 ? 
          Math.round((totalOpportunities / minutes) * 100) / 100 : 0;
      }
      
      // Show token efficiency for what was processed
      if (totalOpportunities > 0 && totalTokens > 0) {
        failureMetrics.tokens_per_opportunity = Math.round((totalTokens / totalOpportunities) * 100) / 100;
      }
      
      // Show cost per opportunity for what was processed  
      if (totalOpportunities > 0 && totalCost > 0) {
        failureMetrics.cost_per_opportunity_usd = Math.round((totalCost / totalOpportunities) * 10000) / 10000;
      }
      
      // Set success rate to 0% for complete failures
      failureMetrics.success_rate_percentage = 0;
      
      // Record the specific failure in breakdown
      this.recordFailure(this.determineFailureCategory(error, failedStage), 1);
      
      // Calculate SLA compliance for the failure
      const slaMetrics = {
        totalExecutionTime: totalTime,
        successRate: 0,
        costPerOpportunity: failureMetrics.cost_per_opportunity_usd || 0,
        throughput: failureMetrics.opportunities_per_minute || 0
      };
      
      const slaCompliance = calculateSLACompliance(slaMetrics);
      failureMetrics.sla_compliance_percentage = slaCompliance.overall;
      failureMetrics.failure_breakdown = this.failureTracking;
      failureMetrics.sla_breakdown = slaCompliance.breakdown;
      failureMetrics.sla_targets = SLA_TARGETS;
      failureMetrics.sla_grade = slaCompliance.grade;
      
      // V2 clean metrics with meaningful failure data
      const updateData = {
        status: 'failed',
        completed_at: new Date().toISOString(),
        total_execution_time_ms: totalTime,
        error_details: errorDetails,
        ...failureMetrics, // Include calculated failure metrics
        updated_at: new Date().toISOString()
      };
      
      const { error: updateError } = await this.supabase
        .from('pipeline_runs')
        .update(updateData)
        .eq('id', this.runId);
      
      if (updateError) {
        console.error('[RunManagerV2] ❌ Failed to update error:', updateError);
      }
      
    } finally {
      this.isUpdating = false;
      // Clear timeout protection
      this.clearTimeoutProtection();
    }
  }

  /**
   * Helper method to categorize failures based on error message and failed stage
   * @param {Error} error - The error that occurred
   * @param {string} failedStage - Which pipeline stage failed
   * @returns {string} - Failure category from FAILURE_CATEGORIES
   */
  determineFailureCategory(error, failedStage) {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('validation') || message.includes('missing content') || message.includes('missing scoring')) {
      return FAILURE_CATEGORIES.VALIDATION_ERRORS;
    }
    if (message.includes('api') || message.includes('network') || message.includes('fetch')) {
      return FAILURE_CATEGORIES.API_ERRORS;
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return FAILURE_CATEGORIES.TIMEOUT_ERRORS;
    }
    if (message.includes('duplicate')) {
      return FAILURE_CATEGORIES.DUPLICATE_REJECTIONS;
    }
    if (message.includes('storage') || message.includes('database')) {
      return FAILURE_CATEGORIES.STORAGE_ERRORS;
    }
    if (failedStage === 'analysis' || failedStage === 'v2_pipeline' || message.includes('processing')) {
      return FAILURE_CATEGORIES.PROCESSING_ERRORS;
    }
    
    return FAILURE_CATEGORIES.PROCESSING_ERRORS; // Default fallback
  }

  /**
   * Get the current run data
   * @returns {Promise<Object>} - The run record
   */
  async getRun() {
    if (!this.runId) return null;
    
    if (!this.supabase) {
      console.warn('[RunManagerV2] ⚠️ No Supabase client available, cannot retrieve run data');
      return null;
    }
    
    const { data, error } = await this.supabase
      .from('pipeline_runs')
      .select('*')
      .eq('id', this.runId)
      .single();
    
    if (error) {
      console.error('[RunManagerV2] ❌ Failed to get run:', error);
      return null;
    }
    
    return data;
  }

  /**
   * Record a failure in the current run for realistic success rate tracking
   * @param {string} category - Failure category from FAILURE_CATEGORIES
   * @param {number} count - Number of failures to record (default: 1)
   */
  recordFailure(category, count = 1) {
    this.failureTracking = recordFailure(this.failureTracking, category, count);
    console.log(`[RunManagerV2] 📊 Recorded ${count} ${category} failure(s). Total failures:`, 
                Object.values(this.failureTracking).reduce((sum, val) => sum + val, 0));
  }

  /**
   * Get current failure statistics
   * @returns {Object} Current failure tracking data
   */
  getFailureStats() {
    return { ...this.failureTracking };
  }

  /**
   * Get SLA targets for this run
   * @returns {Object} SLA targets
   */
  getSLATargets() {
    return { ...SLA_TARGETS };
  }

  /**
   * Sanitize integer values to prevent database errors and SQL injection
   * @param {any} value - Value to sanitize
   * @returns {number|null} - Safe integer or null
   */
  sanitizeInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    
    // Use Number.isInteger for validation instead of regex
    if (typeof value === 'number') {
      return Number.isInteger(value) && Number.isFinite(value) ? value : null;
    }
    
    if (typeof value === 'string') {
      // Trim whitespace first
      const trimmed = value.trim();
      // Use strict parsing
      const parsed = parseInt(trimmed, 10);
      // Validate the result
      return (!isNaN(parsed) && Number.isFinite(parsed) && parsed.toString() === trimmed) ? parsed : null;
    }
    
    return null;
  }

  /**
   * Sanitize JSON data for database storage
   * @param {any} data - Data to sanitize
   * @returns {object} - Safe JSON object
   */
  sanitizeJsonData(data) {
    if (data === null || data === undefined) return {};
    
    try {
      // Ensure data is serializable and safe by round-tripping through JSON
      // This removes functions, undefined values, and other non-JSON types
      const sanitized = JSON.parse(JSON.stringify(data));
      
      // Additional validation for object type
      if (typeof sanitized === 'object' && !Array.isArray(sanitized)) {
        return sanitized;
      }
      
      // If it's an array, wrap it in an object
      if (Array.isArray(sanitized)) {
        return { items: sanitized, count: sanitized.length };
      }
      
      // If it's a primitive, wrap it
      return { value: sanitized };
    } catch (error) {
      console.warn('[RunManagerV2] ⚠️ JSON sanitization failed:', error);
      return { sanitizationError: 'Invalid data structure' };
    }
  }

  /**
   * Static method to cleanup orphaned runs
   * Finds runs stuck in 'started' or 'processing' status for too long and marks them as failed
   * @param {Object} supabaseClient - Supabase client instance
   * @param {number} timeoutMs - How long a run can be stuck before being considered orphaned (default: 30 minutes)
   */
  static async cleanupOrphanedRuns(supabaseClient, timeoutMs = 30 * 60 * 1000) {
    if (!supabaseClient) {
      console.warn('[RunManagerV2] ⚠️ No Supabase client provided for cleanup');
      return { cleaned: 0, errors: [] };
    }

    const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();
    
    try {
      // Find runs stuck in started/processing status for too long
      const { data: orphanedRuns, error: selectError } = await supabaseClient
        .from('pipeline_runs')
        .select('id, started_at, api_source_id')
        .in('status', ['started', 'processing'])
        .lt('started_at', cutoffTime);

      if (selectError) {
        console.error('[RunManagerV2] ❌ Error finding orphaned runs:', selectError);
        return { cleaned: 0, errors: [selectError] };
      }

      if (!orphanedRuns || orphanedRuns.length === 0) {
        console.log('[RunManagerV2] ✅ No orphaned runs found');
        return { cleaned: 0, errors: [] };
      }

      console.log(`[RunManagerV2] 🧹 Found ${orphanedRuns.length} orphaned runs to cleanup`);
      
      const errors = [];
      let cleanedCount = 0;

      // Mark each orphaned run as failed
      for (const run of orphanedRuns) {
        try {
          const elapsedMs = Date.now() - new Date(run.started_at).getTime();
          const elapsedMinutes = Math.round(elapsedMs / 1000 / 60);
          
          const { error: updateError } = await supabaseClient
            .from('pipeline_runs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              total_execution_time_ms: elapsedMs,
              error_details: {
                message: `Run cleanup: Orphaned run timed out after ${elapsedMinutes} minutes`,
                reason: 'orphaned_run_cleanup',
                original_started_at: run.started_at,
                cleanup_performed_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', run.id);

          if (updateError) {
            console.error(`[RunManagerV2] ❌ Failed to cleanup run ${run.id}:`, updateError);
            errors.push({ runId: run.id, error: updateError });
          } else {
            console.log(`[RunManagerV2] 🧹 Cleaned up orphaned run: ${run.id} (${elapsedMinutes} minutes old)`);
            cleanedCount++;
          }
        } catch (error) {
          console.error(`[RunManagerV2] ❌ Error cleaning up run ${run.id}:`, error);
          errors.push({ runId: run.id, error });
        }
      }

      console.log(`[RunManagerV2] ✅ Cleanup complete: ${cleanedCount} runs cleaned, ${errors.length} errors`);
      return { cleaned: cleanedCount, errors };

    } catch (error) {
      console.error('[RunManagerV2] ❌ Error during cleanup:', error);
      return { cleaned: 0, errors: [error] };
    }
  }

  /**
   * Add retry attempt information for a stage
   * @param {string} stageName - Name of the stage being retried
   * @param {Object} retryInfo - Information about the retry attempt
   */
  async addRetryAttempt(stageName, retryInfo) {
    if (!this.runId || !this.supabase) return;
    
    try {
      // Get current stage record
      const { data: stage } = await this.supabase
        .from('pipeline_stages')
        .select('performance_metrics')
        .eq('run_id', this.runId)
        .eq('stage_name', stageName)
        .single();
      
      const currentMetrics = stage?.performance_metrics || {};
      const retryHistory = currentMetrics.retry_history || [];
      
      // Add new retry attempt
      retryHistory.push({
        ...retryInfo,
        timestamp: new Date().toISOString()
      });
      
      // Update stage with retry information
      await this.supabase
        .from('pipeline_stages')
        .update({
          performance_metrics: {
            ...currentMetrics,
            retry_count: retryHistory.length,
            retry_history: retryHistory
          },
          updated_at: new Date().toISOString()
        })
        .eq('run_id', this.runId)
        .eq('stage_name', stageName);
      
      console.log(`[RunManagerV2] Added retry attempt ${retryHistory.length} for stage ${stageName}`);
    } catch (error) {
      console.error(`[RunManagerV2] Failed to add retry attempt:`, error);
    }
  }

  /**
   * Record a stage failure with detailed error information
   * @param {string} stageName - Name of the failed stage
   * @param {Object} failureInfo - Detailed failure information
   */
  async recordStageFailure(stageName, failureInfo) {
    if (!this.runId || !this.supabase) return;
    
    try {
      // Update stage status to failed
      await this.supabase
        .from('pipeline_stages')
        .update({
          status: 'failed',
          error_details: failureInfo,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('run_id', this.runId)
        .eq('stage_name', stageName);
      
      // Also update the run's error tracking
      const { data: errorTrackingRun } = await this.supabase
        .from('pipeline_runs')
        .select('error_details')
        .eq('id', this.runId)
        .single();
      
      const errorHistory = errorTrackingRun?.error_details?.history || [];
      errorHistory.push({
        stage: stageName,
        ...failureInfo,
        timestamp: new Date().toISOString()
      });
      
      await this.supabase
        .from('pipeline_runs')
        .update({
          error_details: {
            last_error: failureInfo,
            history: errorHistory,
            failed_stage: stageName
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', this.runId);
      
      console.error(`[RunManagerV2] Recorded failure for stage ${stageName}`);
    } catch (error) {
      console.error(`[RunManagerV2] Failed to record stage failure:`, error);
    }
  }

  /**
   * Track error recovery attempts
   * @param {string} stageName - Stage that recovered
   * @param {Object} recoveryInfo - Recovery details
   */
  async recordRecovery(stageName, recoveryInfo) {
    if (!this.runId || !this.supabase) return;
    
    try {
      const { data: stage } = await this.supabase
        .from('pipeline_stages')
        .select('performance_metrics')
        .eq('run_id', this.runId)
        .eq('stage_name', stageName)
        .single();
      
      const currentMetrics = stage?.performance_metrics || {};
      
      await this.supabase
        .from('pipeline_stages')
        .update({
          performance_metrics: {
            ...currentMetrics,
            recovered: true,
            recovery_info: recoveryInfo,
            recovery_time: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('run_id', this.runId)
        .eq('stage_name', stageName);
      
      console.log(`[RunManagerV2] Recorded recovery for stage ${stageName}`);
    } catch (error) {
      console.error(`[RunManagerV2] Failed to record recovery:`, error);
    }
  }

}

/**
 * Create a new RunManagerV2 instance
 * @param {string} existingRunId - Optional existing run ID
 * @returns {RunManagerV2} - New RunManager instance
 */
export function createRunManagerV2(existingRunId = null) {
  return new RunManagerV2(existingRunId);
}