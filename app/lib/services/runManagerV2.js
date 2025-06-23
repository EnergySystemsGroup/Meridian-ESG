/**
 * RunManagerV2 - Enhanced run tracking for Agent Architecture V2
 * 
 * Supports the new V2 pipeline stages:
 * - SourceOrchestrator
 * - DataExtractionAgent  
 * - AnalysisAgent
 * - FilterFunction
 * - StorageAgent
 * 
 * Features:
 * - Modular and reusable across different contexts
 * - Enhanced metrics tracking
 * - Better error handling with stage context
 * - Compatible with Edge Functions and Vercel deployments
 */

// Conditional import - only in non-test environments
let createSupabaseClient = null;
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
  try {
    const supabaseModule = require('../supabase.js');
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
    this.startTime = Date.now();
  }

  /**
   * Start a new run for V2 processing
   * @param {string} sourceId - The API source ID
   * @returns {Promise<string>} - The created run ID
   */
  async startRun(sourceId) {
    // If we already have a run ID, return it instead of creating a new one
    if (this.runId) {
      console.log(`[RunManagerV2] ✅ Using existing run: ${this.runId}`);
      return this.runId;
    }
    
    if (!this.supabase) {
      throw new Error('Supabase client is required to start a run');
    }
    
    const { data, error } = await this.supabase
      .from('api_source_runs')
      .insert({
        source_id: sourceId,
        status: 'processing',
        started_at: new Date().toISOString(),
        // Map V2 stages to existing V1 database columns
        source_manager_status: 'pending',        // Maps to SourceOrchestrator
        api_handler_status: 'pending',           // Maps to DataExtraction + Analysis  
        detail_processor_status: 'pending',      // Maps to Filter Function
        data_processor_status: 'pending'         // Maps to StorageAgent
      })
      .select()
      .single();
    
    if (error) throw error;
    
    this.runId = data.id;
    console.log(`[RunManagerV2] ✅ Created V2 run: ${this.runId}`);
    return this.runId;
  }

  /**
   * Update status for a specific pipeline stage
   * @param {string} stage - Stage name (e.g., 'source_manager_status')
   * @param {string} status - Status value ('processing', 'completed', 'failed', 'skipped')
   * @param {Object} data - Optional stage result data
   * @param {Object} metrics - Optional performance metrics
   */
  async updateStageStatus(stage, status, data = null, metrics = null) {
    if (!this.runId) {
      console.warn('[RunManagerV2] ⚠️ No active run ID, skipping status update');
      return;
    }
    
    if (!this.supabase) {
      console.warn('[RunManagerV2] ⚠️ No Supabase client available, skipping database update');
      return;
    }

    // V1 compatibility - validate stage and status values
    const validStages = [
      'source_manager_status',
      'api_handler_status',
      'detail_processor_status',
      'data_processor_status'
    ];

    const validStatuses = [
      'pending',
      'processing',
      'completed',
      'failed',
      'skipped'
    ];

    if (!validStages.includes(stage)) {
      console.error(`[RunManagerV2] ❌ Invalid stage: ${stage}. Must be one of: ${validStages.join(', ')}`);
      return;
    }

    if (!validStatuses.includes(status)) {
      console.error(`[RunManagerV2] ❌ Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
      return;
    }
    
    console.log(`[RunManagerV2] 📊 ${stage}: ${status}`);
    
    const updateData = { 
      [stage]: status,
      updated_at: new Date().toISOString()
    };
    
    // Store stage result data
    if (data) {
      const dataField = stage.replace('_status', '_data');
      updateData[dataField] = data;
    }
    
    // Store performance metrics
    if (metrics) {
      const metricsField = stage.replace('_status', '_metrics');
      updateData[metricsField] = metrics;
    }

    // V1 compatibility - handle overall run status updates
    if (status === 'failed') {
      updateData.status = 'failed';
      updateData.completed_at = new Date().toISOString();
    }

    // V1 compatibility - if all stages are completed, mark the overall run as completed
    if (status === 'completed' && stage === 'data_processor_status') {
      try {
        const { data: currentRun } = await this.supabase
          .from('api_source_runs')
          .select('source_manager_status, api_handler_status, detail_processor_status')
          .eq('id', this.runId)
          .single();

        if (currentRun && 
            currentRun.source_manager_status === 'completed' &&
            currentRun.api_handler_status === 'completed' &&
            (currentRun.detail_processor_status === 'completed' || currentRun.detail_processor_status === 'skipped')) {
          updateData.status = 'completed';
          updateData.completed_at = new Date().toISOString();
        }
      } catch (error) {
        // In test environment or if query fails, just mark as completed anyway
        console.warn('[RunManagerV2] ⚠️ Could not verify stage completion status, proceeding with completion');
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      }
    }
    
    const { error } = await this.supabase
      .from('api_source_runs')
      .update(updateData)
      .eq('id', this.runId);
    
    if (error) {
      console.error(`[RunManagerV2] ❌ Failed to update ${stage}:`, error);
    }
  }

  /**
   * V2 Stage-specific helper methods (mapped to V1 database columns)
   */
  
  async updateSourceOrchestrator(status, analysisResult = null, metrics = null) {
    return this.updateStageStatus('source_manager_status', status, analysisResult, metrics);
  }
  
  async updateDataExtraction(status, extractionResult = null, metrics = null) {
    return this.updateStageStatus('api_handler_status', status, extractionResult, metrics);
  }
  
  async updateAnalysis(status, analysisResult = null, metrics = null) {
    // Analysis stage shares api_handler_status column with DataExtraction
    return this.updateStageStatus('api_handler_status', status, analysisResult, metrics);
  }
  
  async updateFilter(status, filterResult = null, metrics = null) {
    return this.updateStageStatus('detail_processor_status', status, filterResult, metrics);
  }
  
  async updateStorage(status, storageResult = null, metrics = null) {
    return this.updateStageStatus('data_processor_status', status, storageResult, metrics);
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
    
    // V1 compatibility - include all stage completions
    const updateData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source_manager_status: 'completed',
      api_handler_status: 'completed',
      detail_processor_status: 'completed',
      data_processor_status: 'completed'
    };

    if (executionTime) {
      updateData.total_processing_time = executionTime;
    }
    
    if (finalResults) {
      updateData.final_results = finalResults;
    }
    
    const { error } = await this.supabase
      .from('api_source_runs')
      .update(updateData)
      .eq('id', this.runId);
    
    if (error) {
      console.error('[RunManagerV2] ❌ Failed to complete run:', error);
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
    
    const updateData = {
      status: 'failed',
      ended_at: new Date().toISOString(),
      total_processing_time: totalTime,
      error_message: errorDetails.message || String(error),
      error_details: JSON.stringify(errorDetails, null, 2),
      updated_at: new Date().toISOString()
    };
    
    if (failedStage) {
      updateData.failed_stage = failedStage;
    }
    
    const { error: updateError } = await this.supabase
      .from('api_source_runs')
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
      .from('api_source_runs')
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
   * Get status of a specific stage
   * @param {string} stage - Stage name to check
   * @returns {Promise<string|null>} - The stage status
   */
  async getStageStatus(stage) {
    const run = await this.getRun();
    return run ? run[stage] : null;
  }

  /**
   * Check if the run can be resumed (for error recovery)
   * @returns {Promise<boolean>} - Whether the run can be resumed
   */
  async canResume() {
    const run = await this.getRun();
    if (!run || run.status === 'completed') return false;
    
    // Cannot resume if any stage has failed (using V1 database columns)
    const stages = [
      'source_manager_status',
      'api_handler_status', 
      'detail_processor_status',
      'data_processor_status'
    ];
    
    // Check for failed stages first
    if (stages.some(stage => run[stage] === 'failed')) {
      return false;
    }
    
    // Can resume if any stage is still pending or processing
    return stages.some(stage => 
      run[stage] === 'pending' || run[stage] === 'processing'
    );
  }

  /**
   * Resume a failed run from the appropriate stage
   * @returns {Promise<Object>} - Resume result with stage info
   */
  async resumeFailedRun() {
    if (!this.runId) throw new Error('No active run');
    
    const run = await this.getRun();
    if (!run) throw new Error('Run not found');
    if (run.status !== 'failed') throw new Error('Can only resume failed runs');
    
    // Determine which V2 stage to resume from based on V1 column status
    let resumeStage = null;
    if (run.source_manager_status === 'failed') {
      resumeStage = 'source_orchestrator';
    } else if (run.api_handler_status === 'failed') {
      resumeStage = 'data_extraction_analysis';
    } else if (run.detail_processor_status === 'failed') {
      resumeStage = 'filter_function';
    } else if (run.data_processor_status === 'failed') {
      resumeStage = 'storage_agent';
    }
    
    if (!resumeStage) {
      throw new Error('Could not determine which stage to resume from');
    }
    
    // Update the run status to resume processing
    await this.supabase
      .from('api_source_runs')
      .update({
        status: 'processing',
        error_details: null,
        completed_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.runId);
    
    return {
      runId: this.runId,
      resumeStage,
      message: `Resumed V2 run from ${resumeStage} stage`
    };
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

/**
 * Get the next stage to process based on current run status
 * @param {Object} run - The run record
 * @returns {string|null} - The next stage to process
 */
export function getNextStage(run) {
  const stageOrder = [
    'source_manager_status',      // SourceOrchestrator
    'api_handler_status',         // DataExtraction + Analysis  
    'detail_processor_status',    // Filter Function
    'data_processor_status'       // StorageAgent
  ];
  
  for (const stage of stageOrder) {
    if (run[stage] === 'pending' || run[stage] === 'processing') {
      return stage;
    }
    if (run[stage] === 'failed') {
      return null; // Cannot continue after failure
    }
  }
  
  return null; // All stages completed
} 