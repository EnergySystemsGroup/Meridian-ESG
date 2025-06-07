import { createSupabaseClient } from '../supabase.js';

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

export class RunManagerV2 {
  constructor(existingRunId = null) {
    this.supabase = createSupabaseClient();
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
    
    const { data, error } = await this.supabase
      .from('api_source_runs')
      .insert({
        source_id: sourceId,
        status: 'running',
        started_at: new Date().toISOString(),
        // V2 Pipeline stages
        source_orchestrator_status: 'pending',
        data_extraction_status: 'pending', 
        analysis_status: 'pending',
        filter_status: 'pending',
        storage_status: 'pending',
        // Legacy V1 compatibility (set to skipped)
        source_manager_status: 'skipped',
        api_handler_status: 'skipped', 
        detail_processor_status: 'skipped',
        data_processor_status: 'skipped'
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
   * @param {string} stage - Stage name (e.g., 'source_orchestrator_status')
   * @param {string} status - Status value ('processing', 'completed', 'failed', 'skipped')
   * @param {Object} data - Optional stage result data
   * @param {Object} metrics - Optional performance metrics
   */
  async updateStageStatus(stage, status, data = null, metrics = null) {
    if (!this.runId) {
      console.warn('[RunManagerV2] ⚠️ No active run ID, skipping status update');
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
    
    const { error } = await this.supabase
      .from('api_source_runs')
      .update(updateData)
      .eq('id', this.runId);
    
    if (error) {
      console.error(`[RunManagerV2] ❌ Failed to update ${stage}:`, error);
    }
  }

  /**
   * V2 Stage-specific helper methods
   */
  
  async updateSourceOrchestrator(status, analysisResult = null, metrics = null) {
    return this.updateStageStatus('source_orchestrator_status', status, analysisResult, metrics);
  }
  
  async updateDataExtraction(status, extractionResult = null, metrics = null) {
    return this.updateStageStatus('data_extraction_status', status, extractionResult, metrics);
  }
  
  async updateAnalysis(status, analysisResult = null, metrics = null) {
    return this.updateStageStatus('analysis_status', status, analysisResult, metrics);
  }
  
  async updateFilter(status, filterResult = null, metrics = null) {
    return this.updateStageStatus('filter_status', status, filterResult, metrics);
  }
  
  async updateStorage(status, storageResult = null, metrics = null) {
    return this.updateStageStatus('storage_status', status, storageResult, metrics);
  }

  /**
   * Complete the run successfully
   * @param {number} executionTime - Total execution time in milliseconds
   * @param {Object} finalResults - Final processing results
   */
  async completeRun(executionTime = null, finalResults = null) {
    if (!this.runId) {
      console.warn('[RunManagerV2] ⚠️ No active run ID, skipping completion');
      return;
    }
    
    const totalTime = executionTime || (Date.now() - this.startTime);
    
    console.log(`[RunManagerV2] 🏁 Completing run ${this.runId} (${totalTime}ms)`);
    
    const updateData = {
      status: 'completed',
      ended_at: new Date().toISOString(),
      total_processing_time: totalTime,
      updated_at: new Date().toISOString()
    };
    
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
    
    // Cannot resume if any stage has failed
    const stages = [
      'source_orchestrator_status',
      'data_extraction_status', 
      'analysis_status',
      'filter_status',
      'storage_status'
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
    'source_orchestrator_status',
    'data_extraction_status',
    'analysis_status', 
    'filter_status',
    'storage_status'
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