// Test Metrics Data Generators

export function generateStageMetrics(stage, overrides = {}) {
  const baseMetrics = {
    stage_name: stage,
    stage_order: 1,
    execution_time_ms: 1000,
    success: true,
    items_processed: 10,
    error_message: null,
    metadata: {}
  }

  const stageSpecificMetrics = {
    data_extraction: {
      stage_order: 1,
      metadata: {
        api_calls: 2,
        pages_fetched: 2,
        raw_opportunities: 10
      }
    },
    early_duplicate_detector: {
      stage_order: 2,
      metadata: {
        new_opportunities: 4,
        opportunities_to_update: 3,
        opportunities_to_skip: 3,
        detection_accuracy: 0.95
      }
    },
    analysis_agent: {
      stage_order: 3,
      metadata: {
        tokens_used: 5000,
        opportunities_enhanced: 4,
        average_score: 85
      }
    },
    filter_function: {
      stage_order: 4,
      metadata: {
        passed: 3,
        failed: 1,
        pass_rate: 0.75
      }
    },
    storage_agent: {
      stage_order: 5,
      metadata: {
        inserted: 3,
        updated: 0,
        failed: 0,
        transaction_time_ms: 500
      }
    },
    direct_update_handler: {
      stage_order: 3,
      metadata: {
        fields_updated: 5,
        opportunities_updated: 3,
        preserved_fields: 10
      }
    }
  }

  return {
    ...baseMetrics,
    ...stageSpecificMetrics[stage] || {},
    ...overrides
  }
}

export function generateRunMetrics(runId = 'run-test-1') {
  return {
    run_id: runId,
    stages: [
      generateStageMetrics('data_extraction'),
      generateStageMetrics('early_duplicate_detector'),
      generateStageMetrics('analysis_agent'),
      generateStageMetrics('filter_function'),
      generateStageMetrics('storage_agent')
    ],
    summary: {
      total_execution_time_ms: 5000,
      total_opportunities_processed: 10,
      new_opportunities: 3,
      updated_opportunities: 3,
      skipped_opportunities: 4,
      tokens_used: 5000,
      tokens_saved: 3000,
      optimization_percentage: 37.5,
      success_rate: 1.0
    }
  }
}

export function generatePerformanceMetrics() {
  return {
    v1_baseline: {
      average_execution_time_ms: 10000,
      average_tokens_used: 8000,
      average_memory_mb: 512
    },
    v2_current: {
      average_execution_time_ms: 5000,
      average_tokens_used: 5000,
      average_memory_mb: 256
    },
    improvement: {
      time_reduction_percentage: 50,
      token_reduction_percentage: 37.5,
      memory_reduction_percentage: 50
    }
  }
}

export function generateTokenMetrics(opportunities) {
  const newCount = opportunities.filter(o => o.isNew).length
  const updateCount = opportunities.filter(o => o.hasChanges && !o.isNew).length
  const skipCount = opportunities.filter(o => !o.hasChanges && !o.isNew).length
  
  const tokensPerNew = 500
  const tokensUsed = newCount * tokensPerNew
  const tokensSaved = (updateCount + skipCount) * tokensPerNew
  
  return {
    opportunities_analyzed: newCount,
    opportunities_skipped: updateCount + skipCount,
    tokens_used: tokensUsed,
    tokens_saved: tokensSaved,
    optimization_percentage: tokensSaved / (tokensUsed + tokensSaved) * 100,
    cost_saved: (tokensSaved * 0.00001).toFixed(2) // Example cost calculation
  }
}