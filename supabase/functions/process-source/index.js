import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.2"

// TODO: Import RunManagerV2 when file path issues are resolved
// For now, use embedded version and extract later

/**
 * ProcessCoordinator V2 - Edge Function (JavaScript)
 * 
 * Modular approach with agents that will be extracted to separate files.
 * For now, embedded to get basic structure working, then refactor.
 * 
 * Benefits over monolithic V1:
 * - 15+ minute execution vs Vercel 60s timeout  
 * - JavaScript (simpler than TypeScript)
 * - Direct Anthropic SDK (no LangChain overhead)
 * - Modular design (will be separate files)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize clients
function createSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
}

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
})

// ========================================
// V2 AGENTS (temporarily embedded)
// ========================================

/**
 * SourceOrchestrator V2 - Focused source analysis
 */
async function analyzeSource(source) {
  console.log(`[SourceOrchestrator] 🎯 Analyzing: ${source.name}`)
  
  const startTime = Date.now()
  
  try {
    // Create analysis based on configurations (simplified for now)
    const analysis = {
      workflow: source.configurations?.detail_config?.enabled ? "two_step_api" : "single_api",
      apiEndpoint: source.api_endpoint,
      requestConfig: source.configurations?.request_config || { method: "GET" },
      queryParameters: source.configurations?.query_parameters || {},
      requestBody: source.configurations?.request_body || null,
      paginationConfig: source.configurations?.pagination_config || { enabled: false },
      authMethod: source.configurations?.auth_method || "none",
      authDetails: source.configurations?.auth_details || {},
      detailConfig: source.configurations?.detail_config || { enabled: false },
      estimatedComplexity: "moderate",
      confidence: 85,
      processingNotes: [`Analysis completed for ${source.name}`]
    }
    
    const executionTime = Date.now() - startTime
    console.log(`[SourceOrchestrator] ✅ Completed in ${executionTime}ms`)
    
    return { ...analysis, executionTime }
    
  } catch (error) {
    console.error(`[SourceOrchestrator] ❌ Error:`, error)
    throw error
  }
}

/**
 * Temporary embedded RunManagerV2 wrapper
 * TODO: Import the real module when import paths are resolved
 */
class RunManagerV2 {
  constructor(runId = null) {
    this.runId = runId
    this.startTime = Date.now()
    this.supabase = createSupabaseClient()
  }
  
  async startRun(sourceId) {
    if (this.runId) return this.runId
    
    const { data, error } = await this.supabase
      .from('api_source_runs')
      .insert({
        source_id: sourceId,
        status: 'running',
        started_at: new Date().toISOString(),
        source_orchestrator_status: 'pending',
        data_extraction_status: 'pending',
        analysis_status: 'pending',
        filter_status: 'pending',
        storage_status: 'pending'
      })
      .select()
      .single()
    
    if (error) throw error
    this.runId = data.id
    console.log(`[RunManagerV2] ✅ Created V2 run: ${this.runId}`)
    return this.runId
  }
  
  async updateSourceOrchestrator(status, data = null, metrics = null) {
    return this.updateStageStatus('source_orchestrator_status', status, data, metrics)
  }
  
  async updateStageStatus(stage, status, data = null, metrics = null) {
    if (!this.runId) return
    
    console.log(`[RunManagerV2] 📊 ${stage}: ${status}`)
    
    const updateData = { [stage]: status, updated_at: new Date().toISOString() }
    if (data) updateData[`${stage}_data`] = data
    if (metrics) updateData[`${stage}_metrics`] = metrics
    
    await this.supabase
      .from('api_source_runs')
      .update(updateData)
      .eq('id', this.runId)
  }
  
  async completeRun(executionTime = null, finalResults = null) {
    if (!this.runId) return
    
    const totalTime = executionTime || (Date.now() - this.startTime)
    console.log(`[RunManagerV2] 🏁 Completing run ${this.runId} (${totalTime}ms)`)
    
    const updateData = {
      status: 'completed',
      ended_at: new Date().toISOString(),
      total_processing_time: totalTime
    }
    if (finalResults) updateData.final_results = finalResults
    
    await this.supabase
      .from('api_source_runs')
      .update(updateData)
      .eq('id', this.runId)
  }
  
  async updateRunError(error, failedStage = null) {
    if (!this.runId) return
    
    const totalTime = Date.now() - this.startTime
    console.log(`[RunManagerV2] ❌ Run ${this.runId} failed: ${error.message}`)
    
    const updateData = {
      status: 'failed',
      ended_at: new Date().toISOString(),
      total_processing_time: totalTime,
      error_message: error.message,
      error_details: error.stack
    }
    if (failedStage) updateData.failed_stage = failedStage
    
    await this.supabase
      .from('api_source_runs')
      .update(updateData)
      .eq('id', this.runId)
  }
}

// ========================================
// MAIN PROCESSING COORDINATOR
// ========================================

async function processApiSourceV2(sourceId, runId = null) {
  const startTime = Date.now()
  const supabase = createSupabaseClient()
  let runManager = null
  
  try {
    console.log(`[ProcessCoordinator] 🚀 V2 processing: ${sourceId}`)
    
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
    
    // Step 2: Initialize RunManager V2
    runManager = new RunManagerV2(runId)
    if (!runId) {
      await runManager.startRun(sourceId)
    }
    
    // Step 3: SourceOrchestrator V2
    console.log(`[ProcessCoordinator] 🎯 SourceOrchestrator V2`)
    await runManager.updateSourceOrchestrator('processing')
    
    const analysisResult = await analyzeSource(source)
    await runManager.updateSourceOrchestrator('completed', analysisResult)
    
    // TODO: Add other V2 agents as separate functions/modules
    // Step 4: DataExtractionAgent V2
    // Step 5: AnalysisAgent V2  
    // Step 6: FilterFunction V2
    // Step 7: StorageAgent V2
    
    // Complete run
    const executionTime = Date.now() - startTime
    await runManager.completeRun(executionTime)
    
    console.log(`[ProcessCoordinator] ✅ Completed in ${executionTime}ms`)
    
    return {
      status: 'success',
      version: 'v2.0',
      environment: 'supabase-edge-function',
      source: { id: source.id, name: source.name },
      metrics: {
        analysisResult,
        totalExecutionTime: executionTime
      },
      runId: runManager.runId
    }
    
  } catch (error) {
    console.error(`[ProcessCoordinator] ❌ Failed:`, error)
    
    if (runManager) {
      await runManager.updateRunError(error)
    }
    
    return {
      status: 'error',
      version: 'v2.0',
      environment: 'supabase-edge-function',
      message: 'V2 processing failed',
      error: error.message
    }
  }
}

// ========================================
// EDGE FUNCTION HANDLER
// ========================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[EdgeFunction] 🚀 ProcessCoordinator V2 started')
    
    const { sourceId, runId } = await req.json()
    
    if (!sourceId) {
      return new Response(
        JSON.stringify({ error: 'sourceId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await processApiSourceV2(sourceId, runId)
    
    console.log(`[EdgeFunction] ✅ Completed: ${result.status}`)

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[EdgeFunction] ❌ Error:', error)
    
    return new Response(
      JSON.stringify({
        status: 'error',
        version: 'v2.0',
        environment: 'supabase-edge-function',
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 