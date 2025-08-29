/**
 * Job Queue Aggregation Utilities
 * 
 * Utilities for processing and aggregating job-based pipeline data
 * for display in V3 UI components.
 */

/**
 * Detect if a run is job-based or legacy
 * @param {Object} run - Pipeline run object
 * @returns {boolean} True if run uses job queue processing
 */
export function isJobBasedRun(run) {
  // Check pipeline version for job queue indicators since job-specific columns don't exist yet
  return run.pipeline_version && (
    run.pipeline_version.includes('job-queue') || 
    run.pipeline_version.includes('v3') ||
    run.pipeline_version === 'v3.0'
  );
}

/**
 * Extract unique jobs from pipeline stages
 * @param {Array} stages - Pipeline stages array
 * @param {Array} jobs - Optional processing jobs array with chunk info
 * @returns {Array} Array of job objects with metadata
 */
export function extractJobList(stages, jobs = []) {
  // Get unique job IDs
  const uniqueJobIds = [...new Set(
    stages
      .map(stage => stage.job_id)
      .filter(jobId => jobId !== null && jobId !== undefined)
  )];

  if (uniqueJobIds.length === 0) {
    return [];
  }

  // Build job metadata
  return uniqueJobIds.map(jobId => {
    const jobStages = stages.filter(stage => stage.job_id === jobId);
    const firstStage = jobStages[0];
    
    // Get chunk info from jobs data if available, otherwise fallback to stage data
    const jobData = jobs.find(job => job.id === jobId);
    
    return {
      jobId,
      chunkIndex: jobData?.chunk_index ?? firstStage?.chunk_index ?? 0,
      totalChunks: jobData?.total_chunks ?? firstStage?.total_chunks ?? 1,
      status: jobData?.status || getJobStatus(jobStages),
      createdAt: jobData?.created_at ? new Date(jobData.created_at).getTime() : Math.min(...jobStages.map(s => new Date(s.created_at).getTime())),
      completedAt: jobData?.completed_at ? new Date(jobData.completed_at).getTime() : getJobCompletedAt(jobStages),
      stageCount: jobStages.length
    };
  }).sort((a, b) => a.chunkIndex - b.chunkIndex); // Sort by chunk index (earliest first)
}

/**
 * Determine job status from its stages
 * @param {Array} jobStages - Pipeline stages for a single job
 * @returns {string} Job status
 */
export function getJobStatus(jobStages) {
  if (jobStages.some(stage => stage.status === 'failed')) {
    return 'failed';
  }
  if (jobStages.some(stage => stage.status === 'processing')) {
    return 'processing';
  }
  if (jobStages.every(stage => stage.status === 'completed')) {
    return 'completed';
  }
  if (jobStages.some(stage => stage.status === 'pending')) {
    return 'pending';
  }
  return 'unknown';
}

/**
 * Get job completion time
 * @param {Array} jobStages - Pipeline stages for a single job
 * @returns {Date|null} Completion time or null if not completed
 */
export function getJobCompletedAt(jobStages) {
  const completedStages = jobStages.filter(stage => 
    stage.status === 'completed' && stage.completed_at
  );
  
  if (completedStages.length === 0) {
    return null;
  }
  
  // Return latest completion time
  return new Date(Math.max(...completedStages.map(s => new Date(s.completed_at).getTime())));
}

/**
 * Aggregate pipeline stages by stage name for master run view
 * @param {Array} stages - All pipeline stages for a run
 * @returns {Array} Aggregated stages grouped by stage_name
 */
export function aggregateStagesByName(stages) {
  // Group stages by stage_name
  const stageGroups = stages.reduce((acc, stage) => {
    const stageName = stage.stage_name;
    if (!acc[stageName]) {
      acc[stageName] = [];
    }
    acc[stageName].push(stage);
    return acc;
  }, {});

  // Aggregate each stage group
  return Object.keys(stageGroups).map(stageName => {
    const stageRecords = stageGroups[stageName];
    
    return {
      stage_name: stageName,
      stage_order: stageRecords[0]?.stage_order || 0,
      status: getAggregatedStageStatus(stageRecords),
      
      // Aggregate numeric metrics
      tokens_used: stageRecords.reduce((sum, s) => sum + (s.tokens_used || 0), 0),
      api_calls_made: stageRecords.reduce((sum, s) => sum + (s.api_calls_made || 0), 0),
      execution_time_ms: stageRecords.reduce((sum, s) => sum + (s.execution_time_ms || 0), 0),
      estimated_cost_usd: stageRecords.reduce((sum, s) => sum + parseFloat(s.estimated_cost_usd || 0), 0),
      input_count: stageRecords.reduce((sum, s) => sum + (s.input_count || 0), 0),
      output_count: stageRecords.reduce((sum, s) => sum + (s.output_count || 0), 0),
      
      // Time ranges
      started_at: getEarliestTime(stageRecords, 'started_at'),
      completed_at: getLatestTime(stageRecords, 'completed_at'),
      
      // Merge JSONB results
      stage_results: mergeStageResults(stageRecords),
      performance_metrics: mergePerformanceMetrics(stageRecords),
      
      // Metadata
      job_count: stageRecords.length,
      job_ids: stageRecords.map(s => s.job_id).filter(Boolean)
    };
  }).sort((a, b) => a.stage_order - b.stage_order);
}

/**
 * Determine aggregated status for a stage across multiple jobs
 * @param {Array} stageRecords - Stage records for the same stage_name
 * @returns {string} Aggregated status
 */
function getAggregatedStageStatus(stageRecords) {
  const statuses = stageRecords.map(s => s.status);
  
  // If any failed, overall is failed
  if (statuses.includes('failed')) {
    return 'failed';
  }
  
  // If any processing, overall is processing
  if (statuses.includes('processing')) {
    return 'processing';
  }
  
  // If all completed, overall is completed
  if (statuses.every(s => s === 'completed')) {
    return 'completed';
  }
  
  // If any pending, overall is pending
  if (statuses.includes('pending')) {
    return 'pending';
  }
  
  return 'unknown';
}

/**
 * Get earliest time from stage records
 * @param {Array} stageRecords - Stage records
 * @param {string} timeField - Time field name
 * @returns {string|null} Earliest time or null
 */
function getEarliestTime(stageRecords, timeField) {
  const times = stageRecords
    .map(s => s[timeField])
    .filter(t => t !== null && t !== undefined);
  
  if (times.length === 0) return null;
  
  return new Date(Math.min(...times.map(t => new Date(t).getTime()))).toISOString();
}

/**
 * Get latest time from stage records
 * @param {Array} stageRecords - Stage records
 * @param {string} timeField - Time field name
 * @returns {string|null} Latest time or null
 */
function getLatestTime(stageRecords, timeField) {
  const times = stageRecords
    .map(s => s[timeField])
    .filter(t => t !== null && t !== undefined);
  
  if (times.length === 0) return null;
  
  return new Date(Math.max(...times.map(t => new Date(t).getTime()))).toISOString();
}

/**
 * Merge stage_results JSONB from multiple job stages
 * @param {Array} stageRecords - Stage records to merge
 * @returns {Object} Merged stage results
 */
export function mergeStageResults(stageRecords) {
  const merged = {};
  
  stageRecords.forEach(record => {
    const results = record.stage_results || {};
    
    Object.keys(results).forEach(key => {
      const value = results[key];
      
      if (typeof value === 'number') {
        merged[key] = (merged[key] || 0) + value;
      } else if (Array.isArray(value)) {
        merged[key] = [...(merged[key] || []), ...value];
      } else if (value && typeof value === 'object') {
        merged[key] = { ...(merged[key] || {}), ...value };
      } else if (value !== null && value !== undefined) {
        // For strings and other types, take the last non-null value
        merged[key] = value;
      }
    });
  });
  
  return merged;
}

/**
 * Merge performance_metrics JSONB from multiple job stages
 * @param {Array} stageRecords - Stage records to merge
 * @returns {Object} Merged performance metrics
 */
function mergePerformanceMetrics(stageRecords) {
  const merged = {};
  
  stageRecords.forEach(record => {
    const metrics = record.performance_metrics || {};
    
    Object.keys(metrics).forEach(key => {
      const value = metrics[key];
      
      if (typeof value === 'number') {
        merged[key] = (merged[key] || 0) + value;
      } else if (Array.isArray(value)) {
        merged[key] = [...(merged[key] || []), ...value];
      } else if (value && typeof value === 'object') {
        merged[key] = { ...(merged[key] || {}), ...value };
      } else if (value !== null && value !== undefined) {
        merged[key] = value;
      }
    });
  });
  
  return merged;
}

/**
 * Filter stages by job ID
 * @param {Array} stages - All pipeline stages
 * @param {string} jobId - Job ID to filter by
 * @returns {Array} Stages for the specified job
 */
export function getStagesForJob(stages, jobId) {
  return stages.filter(stage => stage.job_id === jobId);
}

/**
 * Get job progress summary
 * @param {Object} run - Pipeline run object
 * @returns {Object} Job progress information
 */
export function getJobProgress(run) {
  if (!isJobBasedRun(run)) {
    return null;
  }
  
  // Since job-specific columns don't exist yet, return placeholder data
  // This can be updated once the database schema includes job columns
  const total = 0;
  const successful = 0;
  const failed = 0;
  const completed = successful + failed;
  const pending = Math.max(0, total - completed);
  
  return {
    total,
    completed,
    successful,
    failed,
    pending,
    isComplete: completed >= total,
    successRate: total > 0 ? Math.round((successful / total) * 100) : 0
  };
}

/**
 * Format job progress for display
 * @param {Object} progress - Job progress from getJobProgress
 * @returns {string} Formatted progress string
 */
export function formatJobProgress(progress) {
  if (!progress) {
    return '';
  }
  
  return `Jobs: ${progress.completed}/${progress.total} complete`;
}

/**
 * Check if stages data is from legacy (non-job) processing
 * @param {Array} stages - Pipeline stages
 * @returns {boolean} True if all stages are legacy (no job_id)
 */
export function isLegacyStages(stages) {
  return stages.length > 0 && stages.every(stage => !stage.job_id);
}

/**
 * Filter stages to show only those belonging to a specific job
 * @param {Array} stages - All pipeline stages
 * @param {string} jobId - Job ID to filter by
 * @returns {Array} Stages filtered for the specific job
 */
export function filterStagesByJob(stages, jobId) {
  if (!jobId) {
    return stages;
  }
  
  return stages.filter(stage => stage.job_id === jobId);
}

/**
 * Aggregate job data for master view - combines stages with same name across jobs
 * @param {Array} stages - All pipeline stages from job-based run
 * @returns {Array} Aggregated stages with combined metrics
 */
export function aggregateJobData(stages) {
  if (!stages?.length) {
    return [];
  }

  // Single pass aggregation using Map for O(1) lookups
  const stageMap = new Map();
  
  stages.forEach(stage => {
    const stageName = stage.stage_name;
    
    if (!stageMap.has(stageName)) {
      // Initialize aggregated stage
      stageMap.set(stageName, {
        stage_name: stageName,
        execution_time_ms: 0,
        tokens_used: 0,
        api_calls_made: 0,
        input_count: 0,
        output_count: 0,
        rate_limit_delay_ms: 0,
        records: [],
        // Copy non-aggregatable fields from first record
        id: stage.id,
        run_id: stage.run_id,
        created_at: stage.created_at,
        stage_results: stage.stage_results
      });
    }
    
    // Get existing aggregated stage and update in place
    const aggregated = stageMap.get(stageName);
    aggregated.execution_time_ms += stage.execution_time_ms || 0;
    aggregated.tokens_used += stage.tokens_used || 0;
    aggregated.api_calls_made += stage.api_calls_made || 0;
    aggregated.input_count += stage.input_count || 0;
    aggregated.output_count += stage.output_count || 0;
    aggregated.rate_limit_delay_ms += stage.rate_limit_delay_ms || 0;
    aggregated.records.push(stage);
  });

  // Convert to array and determine status for each
  return Array.from(stageMap.values()).map(aggregated => {
    // Determine overall status using helper function
    const overallStatus = getJobStatus(aggregated.records);

    // Get earliest created_at and latest completed_at
    const earliestCreatedAt = getEarliestTime(aggregated.records, 'created_at');
    const latestCompletedAt = getLatestTime(aggregated.records, 'completed_at');

    return {
      id: `aggregated-${aggregated.stage_name}`,
      stage_name: aggregated.stage_name,
      status: overallStatus,
      stage_order: aggregated.records[0]?.stage_order,
      execution_time_ms: aggregated.execution_time_ms,
      tokens_used: aggregated.tokens_used,
      api_calls_made: aggregated.api_calls_made,
      input_count: aggregated.input_count,
      output_count: aggregated.output_count,
      rate_limit_delay_ms: aggregated.rate_limit_delay_ms,
      created_at: earliestCreatedAt,
      completed_at: latestCompletedAt,
      stage_results: mergeStageResults(aggregated.records),
      performance_metrics: mergePerformanceMetrics(aggregated.records),
      // Add job count for display
      job_count: aggregated.records.length,
      // Keep reference to original stages for debugging
      _aggregated_from: aggregated.records.map(s => s.id)
    };
  }).sort((a, b) => a.stage_order - b.stage_order);
}