import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.24.2"

// Import V2 ProcessCoordinator service
import { processApiSourceV2 } from "../../../lib/services/processCoordinatorV2.js";

/**
 * ProcessCoordinator V2 Optimized - Edge Function Implementation
 * 
 * Thin HTTP wrapper around ProcessCoordinatorV2 optimized service.
 * 
 * NEW OPTIMIZED PIPELINE with early duplicate detection:
 * 1. SourceOrchestrator - Source analysis and configuration
 * 2. DataExtractionAgent - API data collection and standardization
 * 3. EarlyDuplicateDetector - Categorize opportunities (new/update/skip)
 * 4. Pipeline Branching:
 *    - NEW opportunities → AnalysisAgent → Filter → StorageAgent
 *    - DUPLICATE with changes → DirectUpdateHandler (bypass expensive stages)
 *    - DUPLICATE without changes → Skip entirely
 * 
 * Benefits:
 * - 15+ minute execution vs Vercel 60s timeout
 * - 60-80% token reduction by preventing duplicates from reaching LLM stages
 * - 60-80% faster processing through optimized flow
 * - Direct database updates for critical fields only
 * - No timeout constraints for large datasets
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const { sourceId, runId } = await req.json()
    console.log(`[Edge Function] Processing request for source: ${sourceId}`)

    if (!sourceId) {
      return new Response(JSON.stringify({
        status: 'error',
        message: 'sourceId is required',
        version: 'v2.0',
        environment: 'supabase-edge-function'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient()

    // Delegate to ProcessCoordinatorV2 service
    const result = await processApiSourceV2(sourceId, runId, supabase, anthropic)
    
    // Update environment in result
    if (result.environment) {
      result.environment = 'supabase-edge-function'
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error(`[Edge Function] Unhandled error:`, error)
    
    return new Response(JSON.stringify({
      status: 'error',
      version: 'v2.0',
      environment: 'supabase-edge-function',
      message: 'Edge Function failed',
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}) 