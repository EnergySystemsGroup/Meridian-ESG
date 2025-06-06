import { getAnthropicClient, schemas } from '../utils/anthropicClient.js';
import { createSupabaseClient, logAgentExecution, logApiActivity } from '../../supabase.js';

/**
 * SourceOrchestrator V2 - Analyzes API sources and determines processing configuration
 * 
 * Replaces the old sourceManagerAgent with:
 * - Direct AnthropicClient usage (no LangChain)
 * - Cleaner, more focused prompts
 * - Better error handling
 * - Improved performance tracking
 */

/**
 * Optimized configuration formatting - only includes relevant, non-empty configs
 * @param {Object} source - The API source with configurations
 * @returns {String} - Formatted configurations for AI analysis
 */
function formatConfigurations(source) {
  if (!source.configurations || Object.keys(source.configurations).length === 0) {
    return 'No configurations found for this source.';
  }

  // Configuration types in order of importance for AI analysis
  const configTypes = [
    'request_config',      // Most important - HTTP method, headers
    'query_params',        // Query parameters and keywords
    'pagination_config',   // Pagination strategy
    'detail_config',       // Two-step processing config
    'response_mapping',    // Field mapping
    'request_body',        // POST body data
  ];

  const formattedConfigs = [];
  
  for (const type of configTypes) {
    const config = source.configurations[type];
    
    // Skip empty, null, or trivial configurations
    if (!config || 
        Object.keys(config).length === 0 ||
        (typeof config === 'object' && isEmptyConfiguration(config))) {
      continue;
    }
    
    // Format with cleaner presentation
    formattedConfigs.push(`${type.toUpperCase().replace('_', ' ')}:
${JSON.stringify(config, null, 2)}`);
  }

  return formattedConfigs.length > 0 
    ? formattedConfigs.join('\n\n')
    : 'No meaningful configurations found for this source.';
}

/**
 * Checks if a configuration object is effectively empty
 * @param {Object} config - Configuration object to check
 * @returns {Boolean} - True if configuration is empty or contains only null/undefined values
 */
function isEmptyConfiguration(config) {
  return Object.values(config).every(value => 
    value === null || 
    value === undefined || 
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );
}

/**
 * Prepares source data for AI analysis - strips unnecessary fields and optimizes structure
 * @param {Object} source - Raw source object from database
 * @returns {Object} - Optimized source object for AI prompt
 */
function prepareSourceForAI(source) {
  // Extract only AI-relevant fields, excluding internal database metadata
  return {
    name: source.name,
    organization: source.organization,
    type: source.type,
    url: source.url,
    api_endpoint: source.api_endpoint,
    api_documentation_url: source.api_documentation_url,
    auth_type: source.auth_type,
    update_frequency: source.update_frequency,
    handler_type: source.handler_type, // Existing classification if any
    notes: source.notes,
    // Only include meaningful auth details
    ...(source.auth_details && Object.keys(source.auth_details).length > 0 && {
      auth_details: source.auth_details
    })
  };
}

/**
 * Main SourceOrchestrator function
 * @param {Object} source - The API source to analyze
 * @param {Object} runManager - Optional RunManager instance for tracking
 * @returns {Promise<Object>} - The processing configuration
 */
export async function sourceOrchestrator(source, runManager = null) {
  const supabase = createSupabaseClient();
  const startTime = Date.now();
  
  try {
    console.log(`🎯 SourceOrchestrator analyzing source: ${source.name} (${source.id})`);
    
    // Format configurations for the prompt
    const formattedConfigurations = formatConfigurations(source);
    
    // Create the prompt
    const prompt = `
You are the Source Orchestrator for a funding intelligence system that collects energy infrastructure funding opportunities.

Analyze this API source and determine the optimal approach for retrieving funding opportunities.

SOURCE INFORMATION:
${JSON.stringify(source, null, 2)}

EXISTING CONFIGURATIONS:
${formattedConfigurations}

Based on this information, determine the best processing configuration considering:
- Organization type (federal, state, local, utility, private)
- Typical funding programs they offer
- API structure and capabilities
- Update frequency and data volume
- Relevance to energy infrastructure funding

Important API considerations to document:
- Rate limits and throttling requirements
- Authentication details and token management
- Multi-step API processes (list + detail calls)
- Pagination strategy for large datasets
- Response structure and data extraction paths
- Known API limitations or quirks
- Best practices for this specific API

Use existing configurations as a starting point but suggest improvements where needed.
    `;

    // Get AI analysis using our new AnthropicClient
    const client = getAnthropicClient();
    const result = await client.callWithSchema(prompt, schemas.sourceAnalysis, {
      maxTokens: 2000
    });

    const processingConfig = result.data;
    const executionTime = Date.now() - startTime;

    console.log(`✅ SourceOrchestrator completed for ${source.name}`);
    console.log(`   Handler type: ${processingConfig.handlerType}`);
    console.log(`   Detail processing: ${processingConfig.detailConfig?.enabled ? 'enabled' : 'disabled'}`);
    console.log(`   Execution time: ${executionTime}ms`);
    console.log(`   Tokens used: ${result.performance.totalTokens}`);

    // Log the agent execution
    await logAgentExecution(
      supabase,
      'source_orchestrator_v2',
      { source },
      processingConfig,
      executionTime,
      {
        promptTokens: result.performance.inputTokens,
        completionTokens: result.performance.outputTokens,
        totalTokens: result.performance.totalTokens
      }
    );

    // Log API activity
    await logApiActivity(supabase, source.id, 'source_analysis', 'success', {
      handlerType: processingConfig.handlerType,
      detailEnabled: processingConfig.detailConfig?.enabled,
      executionTime
    });

    // Update last checked timestamp
    await supabase
      .from('api_sources')
      .update({ last_checked: new Date().toISOString() })
      .eq('id', source.id);

    return processingConfig;

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    console.error(`❌ SourceOrchestrator failed for ${source.name}:`, error.message);

    // Log the error execution
    await logAgentExecution(
      supabase,
      'source_orchestrator_v2',
      { source },
      null,
      executionTime,
      {},
      error
    );

    // Log API activity error
    await logApiActivity(supabase, source.id, 'source_analysis', 'failure', {
      error: error.message,
      executionTime
    });

    // Update run with error if runManager provided
    if (runManager) {
      await runManager.updateRunError(error);
    }

    throw new Error(`SourceOrchestrator failed: ${error.message}`);
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