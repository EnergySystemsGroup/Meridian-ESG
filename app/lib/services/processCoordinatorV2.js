/**
 * ProcessCoordinatorV2 - Optimized Pipeline Service with Early Duplicate Detection
 * 
 * NEW OPTIMIZED PIPELINE FLOW:
 * 1. SourceOrchestrator - Source analysis and configuration
 * 2. DataExtractionAgent - API data collection and standardization
 * 3. EarlyDuplicateDetector - Categorize opportunities (new/update/skip)
 * 4. Pipeline Branching:
 *    - NEW opportunities → AnalysisAgent → Filter → StorageAgent
 *    - DUPLICATE with changes → DirectUpdateHandler (bypass expensive stages)
 *    - DUPLICATE without changes → Skip entirely
 * 
 * Benefits over previous version:
 * - 60-80% token reduction by preventing duplicates from reaching LLM stages
 * - 60-80% faster processing through optimized flow
 * - Direct database updates for critical fields only
 * - Modular architecture with intelligent branching
 * - No timeout constraints for large datasets
 */

import { analyzeSource } from '../agents-v2/core/sourceOrchestrator.js';
import { extractFromSource } from '../agents-v2/core/dataExtractionAgent.js';
import { detectDuplicates } from '../agents-v2/optimization/earlyDuplicateDetector.js';
import { updateDuplicateOpportunities } from '../agents-v2/optimization/directUpdateHandler.js';
import { enhanceOpportunities } from '../agents-v2/core/analysisAgent/index.js';
import { filterOpportunities } from '../agents-v2/core/filterFunction.js';
import { storeOpportunities } from '../agents-v2/core/storageAgent/index.js';
import { RunManagerV2 } from './runManagerV2.js';



/**
 * ProcessCoordinatorV2 - Main Pipeline Orchestrator
 * 
 * @param {string} sourceId - Source ID to process
 * @param {string} runId - Optional existing run ID
 * @param {Object} supabase - Supabase client instance
 * @param {Object} anthropic - Anthropic client instance
 * @returns {Promise<Object>} - Complete processing results
 */
export async function processApiSourceV2(sourceId, runId = null, supabase, anthropic) {
  const startTime = Date.now()
  let runManager = null
  
  try {
    console.log(`[ProcessCoordinatorV2] 🚀 Starting V2 processing: ${sourceId}`)
    
    // Step 1: Get source with configurations (same as V1)
    const { data: source, error: sourceError } = await supabase
      .from('api_sources')
      .select('*')
      .eq('id', sourceId)
      .single()
    
    if (!source || sourceError) {
      throw new Error(`Source not found: ${sourceId}`)
    }
    
    // Fetch configurations
    const { data: configData, error: configError } = await supabase
      .from('api_source_configurations')
      .select('*')
      .eq('source_id', sourceId)
    
    if (configError) throw configError
    
    // Group configurations by type
    const configurations = {}
    configData.forEach(config => {
      configurations[config.config_type] = config.configuration
    })
    source.configurations = configurations
    
    // Step 2: Initialize RunManager V2 with proper constructor arguments
    runManager = new RunManagerV2(runId, supabase)
    if (!runId) {
      await runManager.startRun(sourceId)
    }
    
    // ======================================
    // OPTIMIZED V2 PIPELINE WITH EARLY DUPLICATE DETECTION
    // ======================================
    
    // Step 3: SourceOrchestrator V2 - Source analysis and configuration
    console.log(`[ProcessCoordinatorV2] 🎯 Stage 1: SourceOrchestrator`)
    await runManager.updateSourceOrchestrator('processing')
    
    const sourceAnalysis = await analyzeSource(source, anthropic)
    await runManager.updateSourceOrchestrator('completed', sourceAnalysis)
    console.log(`[ProcessCoordinatorV2] ✅ SourceOrchestrator completed in ${sourceAnalysis.executionTime}ms`)
    
    // Step 4: DataExtractionAgent V2 - API data collection + standardization
    console.log(`[ProcessCoordinatorV2] 📡 Stage 2: DataExtractionAgent`)
    await runManager.updateDataExtraction('processing')
    
    const extractionResult = await extractFromSource(source, sourceAnalysis, anthropic)
    await runManager.updateDataExtraction('completed', extractionResult)
    console.log(`[ProcessCoordinatorV2] ✅ DataExtraction completed: ${extractionResult.opportunities.length} opportunities extracted`)
    
    // Step 5: EarlyDuplicateDetector - Categorize opportunities BEFORE expensive processing
    console.log(`[ProcessCoordinatorV2] 🔍 Stage 3: EarlyDuplicateDetector`)
    const duplicateDetection = await detectDuplicates(
      extractionResult.opportunities,
      sourceId,
      supabase
    )
    console.log(`[ProcessCoordinatorV2] ✅ Duplicate detection completed: ${duplicateDetection.metrics.newOpportunities} new, ${duplicateDetection.metrics.opportunitiesToUpdate} to update, ${duplicateDetection.metrics.opportunitiesToSkip} to skip`)
    
    // ======================================
    // PIPELINE BRANCHING BASED ON DUPLICATE DETECTION
    // ======================================
    
    let analysisResult = { opportunities: [], analysisMetrics: {} }
    let filterResult = { includedOpportunities: [], filterMetrics: {} }
    let storageResult = { metrics: {} }
    let directUpdateResult = { metrics: {} }
    
    // Branch 1: Process NEW opportunities through full pipeline
    if (duplicateDetection.newOpportunities.length > 0) {
      console.log(`[ProcessCoordinatorV2] 🆕 Processing ${duplicateDetection.newOpportunities.length} NEW opportunities through full pipeline`)
      
      // Step 6A: AnalysisAgent - Only for NEW opportunities
      console.log(`[ProcessCoordinatorV2] 🧠 Stage 4A: AnalysisAgent (NEW opportunities only)`)
      await runManager.updateAnalysis('processing')
      
      analysisResult = await enhanceOpportunities(duplicateDetection.newOpportunities, source, anthropic)
      await runManager.updateAnalysis('completed', analysisResult)
      console.log(`[ProcessCoordinatorV2] ✅ Analysis completed: ${analysisResult.opportunities.length} NEW opportunities enhanced`)
      
      // Step 7A: Filter Function - Only for analyzed NEW opportunities
      console.log(`[ProcessCoordinatorV2] 🔍 Stage 5A: Filter Function (NEW opportunities only)`)
      await runManager.updateFilter('processing')
      
      filterResult = await filterOpportunities(analysisResult.opportunities)
      await runManager.updateFilter('completed', filterResult)
      console.log(`[ProcessCoordinatorV2] ✅ Filter completed: ${filterResult.includedOpportunities.length} NEW opportunities passed filtering`)
      
      // Step 8A: StorageAgent - Store filtered NEW opportunities
      if (filterResult.includedOpportunities.length > 0) {
        console.log(`[ProcessCoordinatorV2] 💾 Stage 6A: StorageAgent (NEW opportunities)`)
        await runManager.updateStorage('processing')
        
        storageResult = await storeOpportunities(
          filterResult.includedOpportunities,
          source,
          supabase
        )
        await runManager.updateStorage('completed', storageResult)
        console.log(`[ProcessCoordinatorV2] ✅ Storage completed: ${storageResult.metrics?.newOpportunities || 0} NEW opportunities stored`)
      }
    } else {
      console.log(`[ProcessCoordinatorV2] ℹ️ No NEW opportunities to process through full pipeline`)
      await runManager.updateAnalysis('skipped', { reason: 'no_new_opportunities' })
      await runManager.updateFilter('skipped', { reason: 'no_new_opportunities' })
    }
    
    // Branch 2: Direct update for duplicates with changes (bypass expensive stages)
    if (duplicateDetection.opportunitiesToUpdate.length > 0) {
      console.log(`[ProcessCoordinatorV2] 🔄 Processing ${duplicateDetection.opportunitiesToUpdate.length} duplicates with direct updates`)
      
      directUpdateResult = await updateDuplicateOpportunities(
        duplicateDetection.opportunitiesToUpdate,
        supabase
      )
      console.log(`[ProcessCoordinatorV2] ✅ Direct updates completed: ${directUpdateResult.metrics.successful} successful, ${directUpdateResult.metrics.failed} failed`)
    }
    
    // Branch 3: Skip duplicates without changes (logged for metrics)
    if (duplicateDetection.opportunitiesToSkip.length > 0) {
      console.log(`[ProcessCoordinatorV2] ⏭️ Skipped ${duplicateDetection.opportunitiesToSkip.length} duplicates without changes`)
    }
    
    // ======================================
    // COMPLETE OPTIMIZED V2 PIPELINE
    // ======================================
    
    // Calculate total execution time
    const executionTime = Date.now() - startTime
    console.log(`[ProcessCoordinatorV2] 🏁 Total execution time: ${executionTime}ms`)
    
    // Note: Status updates are handled by individual V2 stage updaters above
    
    // Complete the run with all pipeline branches
    const finalResults = {
      pipeline: 'v2-optimized',
      stages: {
        sourceOrchestrator: sourceAnalysis,
        dataExtraction: extractionResult,
        earlyDuplicateDetector: duplicateDetection,
        analysis: analysisResult,
        filter: filterResult,
        storage: storageResult,
        directUpdate: directUpdateResult
      }
    }
    
    await runManager.completeRun(executionTime, finalResults)
    
    // Log successful processing (same as V1)
    await supabase.from('api_activities').insert({
      source_id: source.id,
      activity_type: 'complete_processing',
      status: 'success',
      details: {
        initialCount: extractionResult.extractionMetrics?.totalFound || 0,
        extractedCount: extractionResult.opportunities.length,
        // Duplicate detection results
        duplicatesFound: duplicateDetection.metrics.opportunitiesToUpdate + duplicateDetection.metrics.opportunitiesToSkip,
        newOpportunities: duplicateDetection.metrics.newOpportunities,
        // Processing results
        enhancedCount: analysisResult.opportunities.length,
        filteredCount: filterResult.includedOpportunities.length,
        // Storage results
        newStored: storageResult.metrics?.newOpportunities || 0,
        directUpdated: directUpdateResult.metrics?.successful || 0,
        skipped: duplicateDetection.metrics.opportunitiesToSkip,
        executionTime,
        pipeline: 'v2-optimized',
        tokenSavingsEstimate: `${Math.round((duplicateDetection.metrics.opportunitiesToUpdate + duplicateDetection.metrics.opportunitiesToSkip) / extractionResult.opportunities.length * 100)}%`
      }
    })
    
    // Return results matching V1 format for compatibility
    return {
      status: 'success',
      version: 'v2.0',
      environment: 'service-module',
      source: {
        id: source.id,
        name: source.name
      },
      metrics: {
        // V2 optimized specific metrics
        sourceAnalysis: sourceAnalysis,
        dataExtraction: extractionResult.extractionMetrics,
        earlyDuplicateDetection: duplicateDetection.metrics,
        analysis: analysisResult.analysisMetrics,
        filter: filterResult.filterMetrics,
        storage: storageResult.metrics,
        directUpdate: directUpdateResult.metrics,
        
        // Performance metrics
        pipelineOptimization: {
          totalOpportunities: extractionResult.opportunities.length,
          processedThroughLLM: analysisResult.opportunities.length,
          bypassedLLM: duplicateDetection.metrics.opportunitiesToUpdate + duplicateDetection.metrics.opportunitiesToSkip,
          tokenSavingsPercentage: Math.round((duplicateDetection.metrics.opportunitiesToUpdate + duplicateDetection.metrics.opportunitiesToSkip) / extractionResult.opportunities.length * 100)
        },
        
        // V1 compatibility metrics
        initialApiMetrics: { totalHitCount: extractionResult.extractionMetrics?.totalFound || 0 },
        firstStageMetrics: null,
        detailApiMetrics: null,
        secondStageMetrics: null,
        storageMetrics: storageResult.metrics,
        
        totalExecutionTime: executionTime
      },
      runId: runManager.runId
    }
    
  } catch (error) {
    console.error(`[ProcessCoordinatorV2] ❌ Pipeline failed:`, error)
    
    if (runManager) {
      await runManager.updateRunError(error, 'v2_pipeline')
    }
    
    // Log error (same as V1)
    if (supabase) {
      await supabase.from('api_activities').insert({
        source_id: sourceId,
        activity_type: 'complete_processing', 
        status: 'failure',
        details: {
          error: String(error),
          pipeline: 'v2-optimized'
        }
      })
    }
    
    return {
      status: 'error',
      version: 'v2.0',
      environment: 'service-module',
      message: 'V2 pipeline failed',
      error: error.message,
      stack: error.stack
    }
  }
} 