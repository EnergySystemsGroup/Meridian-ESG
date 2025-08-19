/**
 * Pipeline Checkpoint System
 * 
 * Enables partial recovery and resume capability for pipeline processing
 * Stores intermediate results to allow pipeline to continue from failure points
 */

export class PipelineCheckpoint {
  constructor(runId, supabase) {
    this.runId = runId;
    this.supabase = supabase;
    this.checkpoints = new Map();
    this.lastCheckpoint = null;
    this.maxCheckpoints = 10; // Limit checkpoint storage
  }

  /**
   * Summarize result data to prevent memory bloat
   * @param {Object} result - Full result object
   * @returns {Object} - Summarized result
   */
  summarizeResult(result) {
    if (!result || typeof result !== 'object') return result;
    
    // Keep only essential data
    const summary = {
      status: result.status,
      timestamp: result.timestamp || new Date().toISOString(),
      itemCount: Array.isArray(result.opportunities) ? result.opportunities.length : 
                 Array.isArray(result.items) ? result.items.length : 
                 result.count || 0,
      executionTime: result.executionTime || result.metrics?.executionTime,
      hasData: !!result.opportunities || !!result.items || !!result.data
    };
    
    // Keep small metadata objects
    if (result.metrics && Object.keys(result.metrics).length < 20) {
      summary.metrics = result.metrics;
    }
    
    return summary;
  }

  /**
   * Clean up old checkpoints to prevent memory leaks
   */
  cleanupOldCheckpoints() {
    if (this.checkpoints.size <= this.maxCheckpoints) return;
    
    // Convert to array, sort by timestamp, keep most recent
    const entries = Array.from(this.checkpoints.entries());
    entries.sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
    
    // Keep only the most recent checkpoints
    this.checkpoints.clear();
    entries.slice(0, this.maxCheckpoints).forEach(([key, value]) => {
      this.checkpoints.set(key, value);
    });
    
    console.log(`[PipelineCheckpoint] Cleaned up old checkpoints, keeping ${this.maxCheckpoints} most recent`);
  }

  /**
   * Save a checkpoint for a completed stage
   * @param {string} stageName - Name of the completed stage
   * @param {Object} stageResult - Result data from the stage
   * @param {Object} metrics - Current metrics state
   */
  async saveCheckpoint(stageName, stageResult, metrics) {
    const checkpoint = {
      stageName,
      timestamp: new Date().toISOString(),
      result: this.summarizeResult(stageResult), // Prevent memory bloat
      metrics: { ...metrics },
      runId: this.runId
    };
    
    this.checkpoints.set(stageName, checkpoint);
    this.lastCheckpoint = stageName;
    
    // Clean up old checkpoints to prevent memory leaks
    this.cleanupOldCheckpoints();
    
    // Persist to database for crash recovery
    if (this.supabase && this.runId) {
      try {
        await this.supabase
          .from('pipeline_runs')
          .update({
            checkpoint_data: {
              lastStage: stageName,
              checkpoints: Array.from(this.checkpoints.entries()).map(([key, value]) => ({
                stage: key,
                timestamp: value.timestamp,
                hasResult: !!value.result
              })),
              canResume: true
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', this.runId);
        
        console.log(`[PipelineCheckpoint] ✅ Saved checkpoint for stage: ${stageName}`);
      } catch (error) {
        // Use proper error classification
        const { classifyError, formatErrorForLogging } = await import('./pipelineErrors.js');
        const classified = classifyError(error);
        
        console.error(`[PipelineCheckpoint] ⚠️ Failed to persist checkpoint:`, {
          error: formatErrorForLogging(classified),
          stageName,
          runId: this.runId
        });
        
        // Critical database issues should bubble up
        if (!classified.retryable) {
          throw new Error(`Critical checkpoint persistence failure: ${classified.message}`);
        }
      }
    }
  }

  /**
   * Load checkpoints from a previous run
   * @param {string} runId - The run ID to load checkpoints from
   * @returns {Object} - Checkpoint data or null
   */
  async loadCheckpoints(runId) {
    if (!this.supabase) return null;
    
    try {
      const { data, error } = await this.supabase
        .from('pipeline_runs')
        .select('checkpoint_data, stage_results')
        .eq('id', runId)
        .single();
      
      if (error || !data?.checkpoint_data) {
        console.log(`[PipelineCheckpoint] No checkpoints found for run: ${runId}`);
        return null;
      }
      
      // Restore checkpoint data
      const checkpointData = data.checkpoint_data;
      this.lastCheckpoint = checkpointData.lastStage;
      
      // Try to restore stage results from stage_results field
      if (data.stage_results) {
        Object.entries(data.stage_results).forEach(([stage, result]) => {
          this.checkpoints.set(stage, {
            stageName: stage,
            result: result,
            timestamp: checkpointData.checkpoints?.find(c => c.stage === stage)?.timestamp
          });
        });
      }
      
      console.log(`[PipelineCheckpoint] ✅ Loaded ${this.checkpoints.size} checkpoints from run: ${runId}`);
      return {
        lastStage: this.lastCheckpoint,
        checkpoints: this.checkpoints,
        canResume: checkpointData.canResume
      };
    } catch (error) {
      console.error(`[PipelineCheckpoint] ❌ Failed to load checkpoints:`, error);
      return null;
    }
  }

  /**
   * Get the last successful checkpoint
   * @returns {Object} - Last checkpoint data or null
   */
  getLastCheckpoint() {
    if (!this.lastCheckpoint) return null;
    return this.checkpoints.get(this.lastCheckpoint);
  }

  /**
   * Get checkpoint for a specific stage
   * @param {string} stageName - Stage name
   * @returns {Object} - Checkpoint data or null
   */
  getCheckpoint(stageName) {
    return this.checkpoints.get(stageName) || null;
  }

  /**
   * Check if a stage has a valid checkpoint
   * @param {string} stageName - Stage name
   * @returns {boolean} - True if checkpoint exists
   */
  hasCheckpoint(stageName) {
    return this.checkpoints.has(stageName);
  }

  /**
   * Get list of completed stages
   * @returns {Array} - List of completed stage names
   */
  getCompletedStages() {
    return Array.from(this.checkpoints.keys());
  }

  /**
   * Clear all checkpoints
   */
  clearCheckpoints() {
    this.checkpoints.clear();
    this.lastCheckpoint = null;
    console.log(`[PipelineCheckpoint] Cleared all checkpoints`);
  }

  /**
   * Get resume point based on checkpoints
   * @returns {Object} - Resume information
   */
  getResumePoint() {
    const stages = [
      'SourceOrchestrator',
      'DataExtractionAgent',
      'EarlyDuplicateDetector',
      'AnalysisAgent',
      'FilterFunction',
      'StorageAgent'
    ];
    
    const completedStages = this.getCompletedStages();
    const lastCompleted = this.lastCheckpoint;
    
    if (!lastCompleted) {
      return {
        canResume: false,
        nextStage: stages[0],
        completedCount: 0
      };
    }
    
    const lastIndex = stages.indexOf(lastCompleted);
    if (lastIndex === -1 || lastIndex === stages.length - 1) {
      return {
        canResume: false,
        nextStage: null,
        completedCount: completedStages.length,
        isComplete: lastIndex === stages.length - 1
      };
    }
    
    return {
      canResume: true,
      nextStage: stages[lastIndex + 1],
      lastCompleted: lastCompleted,
      completedCount: completedStages.length,
      checkpointData: this.getLastCheckpoint()
    };
  }
}

/**
 * Create a checkpoint manager for a run
 * @param {string} runId - Run ID
 * @param {Object} supabase - Supabase client
 * @returns {PipelineCheckpoint} - Checkpoint manager instance
 */
export function createCheckpointManager(runId, supabase) {
  return new PipelineCheckpoint(runId, supabase);
}