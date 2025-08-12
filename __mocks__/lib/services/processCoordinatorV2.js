// Mock implementation of processCoordinatorV2
import { detectDuplicates } from '../../lib/agents-v2/optimization/earlyDuplicateDetector.js'
import { enhanceOpportunities } from '../../lib/agents-v2/core/analysisAgent/index.js'
import { filterOpportunities } from '../../lib/agents-v2/core/filterFunction.js'
import { storeOpportunities } from '../../lib/agents-v2/core/storageAgent/index.js'
import { extractFromSource } from '../../lib/agents-v2/core/dataExtractionAgent/extraction/index.js'
import { updateDuplicateOpportunities } from '../../lib/agents-v2/optimization/directUpdateHandler.js'

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
    opportunityPaths: []
  }
  
  let opportunities = []
  let newOpportunities = []
  let opportunitiesToUpdate = []
  let opportunitiesToSkip = []
  
  try {
    // 1. Extraction Stage
    if (extractFromSource.mock) {
      const extraction = await extractFromSource(sourceId, supabase)
      opportunities = extraction.opportunities || []
      metrics.totalOpportunities = opportunities.length
      metrics.optimizationImpact.totalOpportunities = opportunities.length
      metrics.totalTokensUsed += extraction.extractionMetrics?.tokenUsage || 0
      metrics.totalApiCalls += extraction.extractionMetrics?.apiCalls || 0
      metrics.stageMetrics.data_extraction = extraction.extractionMetrics
    }
    
    // 2. Duplicate Detection Stage
    if (detectDuplicates.mock) {
      const detection = await detectDuplicates(opportunities, sourceId, supabase)
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
      metrics.stageMetrics.early_duplicate_detector = detection.detectionMetrics
    }
    
    // 3. Analysis Stage (only for NEW opportunities)
    let enhancedOpportunities = []
    if (enhanceOpportunities.mock && newOpportunities.length > 0) {
      const analysis = await enhanceOpportunities(newOpportunities)
      enhancedOpportunities = analysis.opportunities || analysis.enhancedOpportunities || []
      metrics.totalTokensUsed += (analysis.analysisMetrics?.tokenUsage || analysis.analysisMetrics?.totalTokens) || 0
      metrics.totalApiCalls += (analysis.analysisMetrics?.apiCalls || analysis.analysisMetrics?.totalApiCalls) || 0
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
    if (filterOpportunities.mock && enhancedOpportunities.length > 0) {
      const filterResult = await filterOpportunities(enhancedOpportunities)
      filteredOpportunities = filterResult.includedOpportunities || []
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
    if (storeOpportunities.mock && filteredOpportunities.length > 0) {
      const storage = await storeOpportunities(filteredOpportunities, sourceId, supabase, options.forceFullProcessing)
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
    if (updateDuplicateOpportunities.mock && opportunitiesToUpdate.length > 0) {
      const updateResult = await updateDuplicateOpportunities(opportunitiesToUpdate, supabase)
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
  }
})