// Mock implementation of processCoordinatorV2

export const processApiSourceV2 = jest.fn().mockImplementation(async (
  sourceId,
  stages = {},
  supabase,
  runManager,
  options = {}
) => {
  // Initialize metrics
  const metrics = {
    totalTokensUsed: 0,
    totalApiCalls: 0,
    totalExecutionTime: 0,
    stageMetrics: {},
    optimizationImpact: {
      totalOpportunities: 0,
      bypassedLLM: 0,
      successfulOpportunities: 0
    },
    opportunityPaths: [],
    forceFullProcessingUsed: false
  }
  
  let opportunities = []
  let newOpportunities = []
  let opportunitiesToUpdate = []
  let opportunitiesToSkip = []
  
  // Try to acquire advisory lock
  if (supabase?.rpc) {
    const lockResult = await supabase.rpc('try_advisory_lock')
    if (lockResult?.data === false) {
      throw new Error('advisory lock in progress')
    }
  }
  
  try {
    // 1. Extraction Stage
    if (stages.extractFromSource?.mock) {
      const extraction = await stages.extractFromSource(sourceId, supabase)
      opportunities = extraction.opportunities || []
      metrics.totalOpportunities = opportunities.length
      metrics.optimizationImpact.totalOpportunities = opportunities.length
      metrics.totalTokensUsed += extraction.extractionMetrics?.totalTokens || extraction.extractionMetrics?.tokenUsage || 0
      metrics.totalApiCalls += extraction.extractionMetrics?.apiCalls || 0
      metrics.totalExecutionTime += extraction.extractionMetrics?.executionTime || 0
      metrics.stageMetrics.data_extraction = extraction.extractionMetrics
    }
    
    // 2. Duplicate Detection Stage - Check for FFR first
    if (options.forceFullReprocessing === true) {
      // FFR enabled - bypass duplicate detection
      metrics.forceFullProcessingUsed = true
      newOpportunities = opportunities
      opportunitiesToUpdate = []
      opportunitiesToSkip = []
      
      // Record NEW paths with FFR reason
      newOpportunities.forEach(opp => {
        metrics.opportunityPaths.push({
          opportunity: opp,
          pathType: 'NEW',
          pathReason: 'force_full_processing',
          stagesProcessed: ['data_extraction', 'early_duplicate_detector'],
          analytics: { duplicateDetected: false }
        })
      })
      
      // No duplicate detector metrics when FFR bypasses it
      metrics.optimizationImpact.bypassedLLM = 0
      
    } else if (stages.detectDuplicates?.mock) {
      // Normal duplicate detection
      const detection = await stages.detectDuplicates(opportunities, sourceId, supabase)
      newOpportunities = detection.newOpportunities || []
      opportunitiesToUpdate = detection.opportunitiesToUpdate || []
      opportunitiesToSkip = detection.opportunitiesToSkip || []
      
      // Record paths for each category
      newOpportunities.forEach(opp => {
        metrics.opportunityPaths.push({
          opportunity: opp,
          pathType: 'NEW',
          pathReason: 'no_duplicate_found',
          stagesProcessed: ['data_extraction', 'early_duplicate_detector'],
          analytics: { duplicateDetected: false }
        })
      })
      
      opportunitiesToUpdate.forEach(item => {
        metrics.opportunityPaths.push({
          opportunity: item.apiRecord,
          pathType: 'UPDATE',
          pathReason: item.reason,
          stagesProcessed: ['data_extraction', 'early_duplicate_detector'],
          analytics: { duplicateDetected: true }
        })
      })
      
      opportunitiesToSkip.forEach(item => {
        metrics.opportunityPaths.push({
          opportunity: item.apiRecord,
          pathType: 'SKIP',
          pathReason: item.reason,
          stagesProcessed: ['data_extraction', 'early_duplicate_detector'],
          finalOutcome: 'skipped',
          analytics: { duplicateDetected: true }
        })
      })
      
      metrics.optimizationImpact.bypassedLLM = opportunitiesToUpdate.length + opportunitiesToSkip.length
      metrics.totalExecutionTime += detection.metrics?.executionTime || 0
      metrics.stageMetrics.early_duplicate_detector = detection.metrics || detection.detectionMetrics
    }
    
    // 3. Analysis Stage (only for NEW opportunities)
    let enhancedOpportunities = []
    if (stages.enhanceOpportunities?.mock && newOpportunities.length > 0) {
      const analysis = await stages.enhanceOpportunities(newOpportunities)
      enhancedOpportunities = analysis.opportunities || analysis.enhancedOpportunities || []
      metrics.totalTokensUsed += (analysis.analysisMetrics?.tokenUsage || analysis.analysisMetrics?.totalTokens) || 0
      metrics.totalApiCalls += (analysis.analysisMetrics?.apiCalls || analysis.analysisMetrics?.totalApiCalls) || 0
      metrics.totalExecutionTime += analysis.analysisMetrics?.executionTime || 0
      metrics.stageMetrics.analysis = analysis.analysisMetrics
      
      // Update paths
      metrics.opportunityPaths.forEach(path => {
        if (path.pathType === 'NEW') {
          path.stagesProcessed.push('analysis')
        }
      })
    }
    
    // 4. Filter Stage (only for enhanced opportunities)
    let filteredOpportunities = []
    if (stages.filterOpportunities?.mock && enhancedOpportunities.length > 0) {
      const filterResult = await stages.filterOpportunities(enhancedOpportunities)
      filteredOpportunities = filterResult.includedOpportunities || []
      metrics.totalExecutionTime += filterResult.filterMetrics?.executionTime || 0
      metrics.stageMetrics.filter = filterResult.filterMetrics
      
      // Update paths
      metrics.opportunityPaths.forEach(path => {
        if (path.pathType === 'NEW') {
          path.stagesProcessed.push('filter')
          const passedFilter = filteredOpportunities.some(opp => 
            (opp.api_opportunity_id || opp.id) === (path.opportunity.api_opportunity_id || path.opportunity.id)
          )
          if (!passedFilter) {
            path.finalOutcome = 'filtered_out'
          }
        }
      })
    }
    
    // 5. Storage Stage (only for filtered opportunities)
    if (stages.storeOpportunities?.mock && filteredOpportunities.length > 0) {
      const storage = await stages.storeOpportunities(filteredOpportunities, sourceId, supabase, options.forceFullProcessing)
      metrics.totalExecutionTime += storage.metrics?.executionTime || 0
      metrics.stageMetrics.storage = storage.metrics
      metrics.optimizationImpact.successfulOpportunities += storage.metrics?.newOpportunities || 0
      
      // Update paths
      metrics.opportunityPaths.forEach(path => {
        if (path.pathType === 'NEW' && path.finalOutcome !== 'filtered_out') {
          path.stagesProcessed.push('storage')
          path.finalOutcome = 'stored'
        }
      })
    }
    
    // 6. Direct Update Stage (for UPDATE opportunities)
    if (stages.updateDuplicateOpportunities?.mock && opportunitiesToUpdate.length > 0) {
      const updateResult = await stages.updateDuplicateOpportunities(opportunitiesToUpdate, supabase)
      metrics.totalExecutionTime += updateResult.metrics?.executionTime || 0
      metrics.stageMetrics.direct_update = updateResult.metrics
      metrics.optimizationImpact.successfulOpportunities += (updateResult.metrics?.successful || updateResult.metrics?.successfulUpdates || 0)
      
      // Update paths
      metrics.opportunityPaths.forEach(path => {
        if (path.pathType === 'UPDATE') {
          path.stagesProcessed.push('direct_update')
          path.finalOutcome = 'updated'
        }
      })
    }
    
    return {
      status: 'success',
      version: 'v2.0',
      pipeline: 'v2-optimized-with-metrics',
      enhancedMetrics: metrics,
      optimizationImpact: metrics.optimizationImpact
    }
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      version: 'v2.0',
      pipeline: 'v2-optimized-with-metrics',
      enhancedMetrics: metrics
    }
  } finally {
    // Release advisory lock
    if (supabase?.rpc) {
      await supabase.rpc('release_advisory_lock')
    }
  }
})