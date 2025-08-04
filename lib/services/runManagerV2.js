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
 * - DataExtractionAgent  
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

export class RunManagerV2 {
  constructor(existingRunId = null, supabaseClient = null) {
    // Use injected client or create one if available
    this.supabase = supabaseClient || (createSupabaseClient ? createSupabaseClient() : null);
    this.runId = existingRunId;
    this.v2RunId = null; // Separate ID for clean V2 metrics
    this.startTime = Date.now();
    
    // Stage tracking for V2 metrics
    this.stageOrder = {
      'source_orchestrator': 1,
      'data_extraction': 2,
      'early_duplicate_detector': 3,
      'analysis': 4,
      'filter': 5,
      'storage': 6,
      'direct_update': 7
    };
    
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
      
      console.log(`[RunManagerV2] ✅ Created V2 pipeline run: ${this.runId}`);
      return this.runId;
      
    } catch (error) {
      console.error('[RunManagerV2] ❌ Failed to start run:', error);
      throw error;
    }
  }

  /**
   * V2 Clean Metrics Stage Helper Methods
   * These update V2 semantic database tables only
   */
  
  async updateV2SourceOrchestrator(status, analysisResult = null, metrics = null, tokensUsed = 0, apiCalls = 0, inputCount = 0, outputCount = 0) {
    // V2 clean metrics only
    await this.updateV2Stage('source_orchestrator', status, analysisResult, metrics, tokensUsed, apiCalls, inputCount, outputCount);
  }
  
  async updateV2DataExtraction(status, extractionResult = null, metrics = null, tokensUsed = 0, apiCalls = 0, inputCount = 0, outputCount = 0) {
    // V2 clean metrics only
    await this.updateV2Stage('data_extraction', status, extractionResult, metrics, tokensUsed, apiCalls, inputCount, outputCount);
  }

  async updateV2EarlyDuplicateDetector(status, detectionResult = null, metrics = null, inputCount = 0, outputCount = 0) {
    // V2 only - no V1 equivalent
    await this.updateV2Stage('early_duplicate_detector', status, detectionResult, metrics, 0, 0, inputCount, outputCount);
    
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

  async updateV2DirectUpdate(status, updateResult = null, metrics = null, inputCount = 0, outputCount = 0) {
    // V2 only - no V1 equivalent
    await this.updateV2Stage('direct_update', status, updateResult, metrics, 0, 0, inputCount, outputCount);
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
   */
  async updateV2Stage(stageName, status, stageResults = {}, performanceMetrics = {}, tokensUsed = 0, apiCalls = 0, inputCount = 0, outputCount = 0) {
    if (!this.v2RunId || !this.supabase) {
      console.warn(`[RunManagerV2] ⚠️ Cannot update V2 stage ${stageName} - missing V2 run ID or client`);
      return;
    }

    const stageOrder = this.stageOrder[stageName] || 0;
    const executionTime = performanceMetrics?.executionTime || null;
    const now = new Date().toISOString();

    try {
      // Check if stage record already exists
      const { data: existingStage } = await this.supabase
        .from('pipeline_stages')
        .select('id, started_at')
        .eq('run_id', this.v2RunId)
        .eq('stage_name', stageName)
        .single();

      if (existingStage) {
        // Update existing stage
        const updateData = {
          status,
          stage_results: this.sanitizeJsonData(stageResults),
          performance_metrics: this.sanitizeJsonData(performanceMetrics),
          tokens_used: this.sanitizeInteger(tokensUsed),
          api_calls_made: this.sanitizeInteger(apiCalls),
          input_count: this.sanitizeInteger(inputCount),
          output_count: this.sanitizeInteger(outputCount),
          updated_at: now
        };

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
        // Create new stage record
        const { error } = await this.supabase
          .from('pipeline_stages')
          .insert({
            run_id: this.v2RunId,
            stage_name: stageName,
            stage_order: stageOrder,
            status,
            started_at: status === 'processing' ? now : null,
            completed_at: status === 'completed' ? now : null,
            execution_time_ms: status === 'completed' ? this.sanitizeInteger(executionTime) : null,
            api_calls_made: this.sanitizeInteger(apiCalls),
            tokens_used: this.sanitizeInteger(tokensUsed),
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

    // Calculate absolute performance metrics
    const totalOpportunities = this.sanitizeInteger(optimizationMetrics.totalOpportunities) || 0;
    const totalTokens = this.sanitizeInteger(optimizationMetrics.totalTokens) || 0;
    const totalCost = parseFloat(optimizationMetrics.estimatedCost) || 0;
    const totalTimeMs = optimizationMetrics.totalExecutionTime || (this.startTime ? (Date.now() - this.startTime) : null);
    const successfulOpportunities = optimizationMetrics.successfulOpportunities || totalOpportunities; // Assume all successful if not specified
    
    const absoluteMetrics = {};
    
    // Calculate opportunities per minute (throughput)
    if (totalTimeMs && totalTimeMs > 0 && totalOpportunities > 0) {
      const minutes = totalTimeMs / (1000 * 60);
      absoluteMetrics.opportunities_per_minute = Math.round((totalOpportunities / minutes) * 100) / 100; // Round to 2 decimal places
    }
    
    // Calculate tokens per opportunity (efficiency)
    if (totalOpportunities > 0 && totalTokens > 0) {
      absoluteMetrics.tokens_per_opportunity = Math.round((totalTokens / totalOpportunities) * 100) / 100;
    }
    
    // Calculate cost per opportunity (cost efficiency)
    if (totalOpportunities > 0 && totalCost > 0) {
      absoluteMetrics.cost_per_opportunity_usd = Math.round((totalCost / totalOpportunities) * 10000) / 10000; // Round to 4 decimal places
    }
    
    // Calculate success rate percentage (quality)
    if (totalOpportunities > 0) {
      absoluteMetrics.success_rate_percentage = Math.round((successfulOpportunities / totalOpportunities) * 10000) / 100; // Convert to percentage and round to 2 decimal places
    }
    
    // SLA compliance - for now, set to 100% if processing completed successfully, null otherwise
    if (optimizationMetrics.status === 'completed' || !optimizationMetrics.hasErrors) {
      absoluteMetrics.sla_compliance_percentage = 100.0;
    }

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
    
    const executionTime = totalTime || (Date.now() - this.startTime);
    
    console.log(`[RunManagerV2] 🏁 Completing run ${this.runId} (${executionTime}ms)`);
    
    // Calculate final absolute metrics at completion
    const finalAbsoluteMetrics = {};
    
    // Get current run data to calculate final metrics
    const { data: currentRun } = await this.supabase
      .from('pipeline_runs')
      .select('total_opportunities_processed, total_tokens_used, estimated_cost_usd')
      .eq('id', this.runId)
      .single();
    
    if (currentRun && currentRun.total_opportunities_processed > 0) {
      const totalOpportunities = currentRun.total_opportunities_processed;
      const totalTokens = currentRun.total_tokens_used || 0;
      const totalCost = currentRun.estimated_cost_usd || 0;
      
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
      
      // Set success rate to 100% for completed runs (can be enhanced later with error tracking)
      finalAbsoluteMetrics.success_rate_percentage = 100.0;
      
      // Set SLA compliance to 100% for completed runs (can be enhanced later with SLA targets)
      finalAbsoluteMetrics.sla_compliance_percentage = 100.0;
    }

    // V2 clean metrics with absolute performance tracking
    const updateData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      total_execution_time_ms: executionTime,
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
    
    const totalTime = Date.now() - this.startTime;
    
    console.log(`[RunManagerV2] ❌ Run ${this.runId} failed: ${error.message}`);
    
    const errorDetails = error instanceof Error 
      ? {
          message: error.message,
          stack: error.stack,
          ...(error.cause && { cause: String(error.cause) })
        }
      : String(error);
    
    // V2 clean metrics only
    const updateData = {
      status: 'failed',
      completed_at: new Date().toISOString(),
      total_execution_time_ms: totalTime,
      error_details: errorDetails,
      updated_at: new Date().toISOString()
    };
    
    const { error: updateError } = await this.supabase
      .from('pipeline_runs')
      .update(updateData)
      .eq('id', this.runId);
    
    if (updateError) {
      console.error('[RunManagerV2] ❌ Failed to update error:', updateError);
    }
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
   * Sanitize integer values to prevent database errors
   * @param {any} value - Value to sanitize
   * @returns {number|null} - Safe integer or null
   */
  sanitizeInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    
    // Handle string values that might contain non-numeric characters
    if (typeof value === 'string') {
      // Extract only numeric characters
      const numericOnly = value.replace(/[^0-9.-]/g, '');
      const parsed = parseInt(numericOnly, 10);
      return isNaN(parsed) ? null : parsed;
    }
    
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Sanitize JSON data for database storage
   * @param {any} data - Data to sanitize
   * @returns {object} - Safe JSON object
   */
  sanitizeJsonData(data) {
    if (data === null || data === undefined) return {};
    
    try {
      // If it's already an object, return it
      if (typeof data === 'object' && !Array.isArray(data)) {
        return data;
      }
      
      // If it's an array, wrap it in an object
      if (Array.isArray(data)) {
        return { items: data, count: data.length };
      }
      
      // If it's a primitive, wrap it
      return { value: data };
    } catch (error) {
      console.warn('[RunManagerV2] ⚠️ Error sanitizing JSON data:', error);
      return {};
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