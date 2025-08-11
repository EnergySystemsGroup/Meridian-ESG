/**
 * SourceOrchestrator V2 - Modular Agent
 * 
 * Replaces sourceManagerAgent with direct configuration-based analysis.
 * Focuses solely on source analysis and processing configuration.
 * 
 * Exports: analyzeSource(source, anthropic)
 */

import { createSupabaseClient } from '../../supabase.js';

/**
 * Analyzes an API source and determines optimal processing approach
 * @param {Object} source - The source object with configurations
 * @param {Object} anthropic - Anthropic client instance (not used, for compatibility)
 * @returns {Promise<Object>} - Analysis result with processing details
 */
export async function analyzeSource(source, anthropic) {
  // Input validation
  if (!source) {
    throw new Error('Source is required');
  }
  
  if (!source.name) {
    throw new Error('Source name is required');
  }
  
  if (!source.api_endpoint) {
    throw new Error('Source api_endpoint is required');
  }
  
  // Ensure configurations object exists
  if (!source.configurations) {
    source.configurations = {};
  }

  console.log(`[SourceOrchestrator] 🎯 Analyzing source: ${source.name}`)
  
  const startTime = Date.now()
  
  try {
    // Create analysis structure based on source configurations
    const analysis = {
      workflow: source.configurations.detail_config?.enabled ? "two_step_api" : "single_api",
      apiEndpoint: source.api_endpoint,
      requestConfig: source.configurations.request_config || { method: "GET" },
      queryParameters: source.configurations.query_params || {},
      requestBody: source.configurations.request_body || null,
      responseConfig: source.configurations.response_config || {},
      paginationConfig: source.configurations.pagination_config || { enabled: false },
      detailConfig: source.configurations.detail_config || { enabled: false },
      responseMapping: source.configurations.response_mapping || {},
      authMethod: source.auth_type || "none",
      authDetails: source.auth_details || {},
      handlerType: source.handler_type || "standard",
      apiNotes: source.notes || "",
      processingNotes: [`Analysis completed for ${source.name}`],
    }
    
    const executionTime = Math.max(1, Date.now() - startTime)
    console.log(`[SourceOrchestrator] ✅ Analysis completed in ${executionTime}ms`)
    
    return {
      ...analysis,
      executionTime
    }
    
  } catch (error) {
    console.error(`[SourceOrchestrator] ❌ Error analyzing source:`, error)
    throw error
  }
}

/**
 * Gets the next API source to process from the queue
 * @returns {Promise<Object|null>} - The next source with configurations, or null
 */
export async function getNextSourceToProcess() {
  const supabase = createSupabaseClient();

  try {
    console.log('🔍 Getting next source from processing queue...');
    
    // Use the database function to get the next source
    const { data, error } = await supabase.rpc('get_next_api_source_to_process');

    if (error) {
      throw error;
    }

    if (data.length === 0) {
      console.log('📭 No sources available in processing queue');
      return null;
    }

    const source = data[0];
    console.log(`📋 Found source: ${source.name} (${source.id})`);

    // Fetch configurations for this source
    const { data: configData, error: configError } = await supabase
      .from('api_source_configurations')
      .select('*')
      .eq('source_id', source.id);

    if (configError) {
      throw configError;
    }

    // Group configurations by type
    const configurations = {};
    configData.forEach((config) => {
      configurations[config.config_type] = config.configuration;
    });

    // Add configurations to the source
    source.configurations = configurations;
    
    console.log(`📦 Loaded ${configData.length} configurations for ${source.name}`);
    
    return source;

  } catch (error) {
    console.error('❌ Error getting next source to process:', error);
    return null;
  }
}

/**
 * Gets a specific source by ID with configurations
 * @param {string} sourceId - The source ID to fetch
 * @returns {Promise<Object|null>} - The source with configurations, or null
 */
export async function getSourceById(sourceId) {
  const supabase = createSupabaseClient();

  try {
    console.log(`🔍 Fetching source by ID: ${sourceId}`);
    
    // Get the specific source
    const { data: source, error } = await supabase
      .from('api_sources')
      .select('*')
      .eq('id', sourceId)
      .single();

    if (error) {
      throw error;
    }

    if (!source) {
      console.log(`❌ No source found with ID: ${sourceId}`);
      return null;
    }

    console.log(`📋 Found source: ${source.name} (${source.id})`);

    // Fetch configurations for this source
    const { data: configData, error: configError } = await supabase
      .from('api_source_configurations')
      .select('*')
      .eq('source_id', sourceId);

    if (configError) {
      throw configError;
    }

    // Group configurations by type
    const configurations = {};
    configData.forEach((config) => {
      configurations[config.config_type] = config.configuration;
    });

    // Add configurations to the source
    source.configurations = configurations;
    
    console.log(`📦 Loaded ${configData.length} configurations for ${source.name}`);
    
    return source;

  } catch (error) {
    console.error(`❌ Error fetching source ${sourceId}:`, error);
    return null;
  }
} 