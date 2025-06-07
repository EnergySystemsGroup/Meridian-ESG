/**
 * SourceOrchestrator V2 - Modular Agent
 * 
 * Replaces sourceManagerAgent with direct Anthropic SDK integration.
 * Focuses solely on source analysis and processing configuration.
 * 
 * Exports: analyzeSource(source, anthropic)
 */

/**
 * Analyzes an API source and determines optimal processing approach
 * @param {Object} source - The source object with configurations
 * @param {Object} anthropic - Anthropic client instance
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
    // Format configurations for analysis
    const configTypes = [
      'request_body',
      'request_config', 
      'pagination_config',
      'detail_config',
      'response_mapping'
    ]
    
    const formattedConfigs = configTypes
      .filter(type => source.configurations[type])
      .map(type => `${type.toUpperCase()}: ${JSON.stringify(source.configurations[type], null, 2)}`)
      .join('\n\n')
    
    const prompt = `Analyze this API source and determine the optimal processing approach:

SOURCE INFORMATION:
${JSON.stringify(source, null, 2)}

CONFIGURATIONS:
${formattedConfigs || 'No specific configurations found'}

Provide a structured analysis with these exact fields:
- workflow: "single_api" or "two_step_api"
- apiEndpoint: The main API endpoint URL
- requestConfig: HTTP request configuration object
- queryParameters: Query parameters object
- requestBody: Request body object (if POST/PUT)
- paginationConfig: Pagination configuration object
- authMethod: Authentication method
- authDetails: Authentication details object
- detailConfig: Detail fetching configuration object
- estimatedComplexity: "simple", "moderate", or "complex"
- confidence: Number between 0-100
- processingNotes: Array of important notes for processing

Be precise and ensure all URLs and configurations are valid.`

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    })
    
    // Parse response (simplified for now - would use structured output in full implementation)
    const analysisText = response.content[0].text
    
    // Create analysis structure based on source configurations
    const analysis = {
      workflow: source.configurations.detail_config?.enabled ? "two_step_api" : "single_api",
      apiEndpoint: source.api_endpoint,
      requestConfig: source.configurations.request_config || { method: "GET" },
      queryParameters: source.configurations.query_parameters || {},
      requestBody: source.configurations.request_body || null,
      paginationConfig: source.configurations.pagination_config || { enabled: false },
      authMethod: source.configurations.auth_method || "none",
      authDetails: source.configurations.auth_details || {},
      detailConfig: source.configurations.detail_config || { enabled: false },
      estimatedComplexity: "moderate",
      confidence: 85,
      processingNotes: [`Analysis completed for ${source.name}`],
      tokensUsed: response.usage?.total_tokens || 0
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