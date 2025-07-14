/**
 * Anthropic Model Configurations
 * 
 * This file contains the latest model specifications from Anthropic's API.
 * Used to dynamically adjust batch sizes and token limits based on the model being used.
 * 
 * Source: https://docs.anthropic.com/en/docs/about-claude/models/overview
 * Last updated: Based on search results from current Anthropic documentation
 */

export const ANTHROPIC_MODELS = {
  // Claude 4 Models (Latest Generation)
  'claude-opus-4-20250514': {
    name: 'Claude Opus 4',
    family: 'claude-4',
    tier: 'opus',
    maxOutputTokens: 32000,
    contextWindow: 200000,
    description: 'Our most capable and intelligent model yet',
    capabilities: ['text', 'vision', 'extended-thinking'],
    pricing: {
      inputPerMTok: 15,
      outputPerMTok: 75
    },
    trainingCutoff: '2025-03',
    latency: 'moderately-fast'
  },
  
  'claude-sonnet-4-20250514': {
    name: 'Claude Sonnet 4', 
    family: 'claude-4',
    tier: 'sonnet',
    maxOutputTokens: 64000,
    contextWindow: 200000,
    description: 'High-performance model with exceptional reasoning capabilities',
    capabilities: ['text', 'vision', 'extended-thinking'],
    pricing: {
      inputPerMTok: 3,
      outputPerMTok: 15
    },
    trainingCutoff: '2025-03',
    latency: 'fast'
  },

  // Claude 3.7 Models
  'claude-3-7-sonnet-20250219': {
    name: 'Claude Sonnet 3.7',
    family: 'claude-3.7', 
    tier: 'sonnet',
    maxOutputTokens: 64000,
    contextWindow: 200000,
    description: 'High-performance model with early extended thinking',
    capabilities: ['text', 'vision', 'extended-thinking'],
    pricing: {
      inputPerMTok: 3,
      outputPerMTok: 15
    },
    trainingCutoff: '2024-11',
    latency: 'fast'
  },

  // Claude 3.5 Models  
  'claude-3-5-sonnet-20241022': {
    name: 'Claude Sonnet 3.5 v2',
    family: 'claude-3.5',
    tier: 'sonnet', 
    maxOutputTokens: 8192,
    contextWindow: 200000,
    description: 'Our previous intelligent model (upgraded version)',
    capabilities: ['text', 'vision'],
    pricing: {
      inputPerMTok: 3,
      outputPerMTok: 15
    },
    trainingCutoff: '2024-04',
    latency: 'fast'
  },

  'claude-3-5-sonnet-20240620': {
    name: 'Claude Sonnet 3.5',
    family: 'claude-3.5',
    tier: 'sonnet',
    maxOutputTokens: 8192, 
    contextWindow: 200000,
    description: 'Our previous intelligent model (original version)',
    capabilities: ['text', 'vision'],
    pricing: {
      inputPerMTok: 3,
      outputPerMTok: 15
    },
    trainingCutoff: '2024-04',
    latency: 'fast'
  },

  'claude-3-5-haiku-20241022': {
    name: 'Claude Haiku 3.5',
    family: 'claude-3.5',
    tier: 'haiku',
    maxOutputTokens: 8192,
    contextWindow: 200000, 
    description: 'Our fastest model',
    capabilities: ['text', 'vision'],
    pricing: {
      inputPerMTok: 0.8,
      outputPerMTok: 4
    },
    trainingCutoff: '2024-07',
    latency: 'fastest'
  },

  // Claude 3 Models (Legacy)
  'claude-3-opus-20240229': {
    name: 'Claude Opus 3',
    family: 'claude-3',
    tier: 'opus',
    maxOutputTokens: 4096,
    contextWindow: 200000,
    description: 'Powerful model for complex tasks',
    capabilities: ['text', 'vision'],
    pricing: {
      inputPerMTok: 15,
      outputPerMTok: 75
    },
    trainingCutoff: '2023-08',
    latency: 'moderately-fast'
  },

  'claude-3-haiku-20240307': {
    name: 'Claude Haiku 3',
    family: 'claude-3',
    tier: 'haiku', 
    maxOutputTokens: 4096,
    contextWindow: 200000,
    description: 'Fast and compact model for near-instant responsiveness',
    capabilities: ['text', 'vision'],
    pricing: {
      inputPerMTok: 0.25,
      outputPerMTok: 1.25
    },
    trainingCutoff: '2023-08',
    latency: 'fast'
  }
};

// Model aliases for convenience
export const MODEL_ALIASES = {
  'claude-opus-4-0': 'claude-opus-4-20250514',
  'claude-sonnet-4-0': 'claude-sonnet-4-20250514', 
  'claude-3-7-sonnet-latest': 'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-latest': 'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-latest': 'claude-3-5-haiku-20241022'
};

/**
 * Get model configuration by model ID or alias
 * @param {string} modelId - The model ID or alias
 * @returns {Object|null} Model configuration object or null if not found
 */
export function getModelConfig(modelId) {
  // Check if it's an alias first
  const actualModelId = MODEL_ALIASES[modelId] || modelId;
  
  // Return the configuration
  return ANTHROPIC_MODELS[actualModelId] || null;
}

/**
 * Calculate optimal batch size based on model capabilities and content complexity
 * @param {string} modelId - The model ID or alias
 * @param {number} avgDescriptionLength - Average description length in characters
 * @param {number} tokensPerOpportunity - Base tokens needed per opportunity
 * @param {number} baseTokens - Base overhead tokens
 * @returns {Object} Batch configuration with size and max tokens
 */
export function calculateOptimalBatchSize(modelId, avgDescriptionLength, tokensPerOpportunity = 1500, baseTokens = 1000) {
  const modelConfig = getModelConfig(modelId);
  
  if (!modelConfig) {
    console.warn(`[ModelConfig] ⚠️  Unknown model ${modelId}, using Haiku 3.5 defaults`);
    return {
      batchSize: 2,
      maxTokens: 8192,
      modelName: 'Unknown',
      reason: 'fallback-to-haiku-defaults'
    };
  }

  const maxOutputTokens = modelConfig.maxOutputTokens;
  const modelName = modelConfig.name;
  
  // Calculate base batch size from model capacity
  const maxPossibleBatchSize = Math.floor((maxOutputTokens - baseTokens) / tokensPerOpportunity);
  
  // Apply complexity-based adjustments that scale with model capacity
  let optimalBatchSize;
  let reason;
  
  // Scale complexity caps based on model capacity (Haiku baseline: 8K tokens)
  const capacityMultiplier = maxOutputTokens / 8192; // Sonnet 4: 64K/8K = 8x multiplier
  
  if (avgDescriptionLength > 2000) {
    // Very complex content - conservative batch size
    const scaledCap = Math.floor(3 * capacityMultiplier); // Haiku: 3, Sonnet 4: 24
    optimalBatchSize = Math.min(maxPossibleBatchSize, scaledCap);
    reason = 'very-long-descriptions';
  } else if (avgDescriptionLength > 1500) {
    // Long content - moderate batch size  
    const scaledCap = Math.floor(5 * capacityMultiplier); // Haiku: 5, Sonnet 4: 40
    optimalBatchSize = Math.min(maxPossibleBatchSize, scaledCap);
    reason = 'long-descriptions';
  } else if (avgDescriptionLength > 800) {
    // Medium content - good batch size
    const scaledCap = Math.floor(8 * capacityMultiplier); // Haiku: 8, Sonnet 4: 64
    optimalBatchSize = Math.min(maxPossibleBatchSize, scaledCap);
    reason = 'medium-descriptions';
  } else {
    // Short content - maximize batch size
    const scaledCap = Math.floor(15 * capacityMultiplier); // Haiku: 15, Sonnet 4: 120
    optimalBatchSize = Math.min(maxPossibleBatchSize, scaledCap);
    reason = 'short-descriptions';
  }
  
  // Ensure minimum batch size of 1
  optimalBatchSize = Math.max(1, optimalBatchSize);
  
  // Apply practical time limit to avoid 10-minute timeout
  // ~15K tokens should keep generation well under 10 minutes while maximizing batch size
  const PRACTICAL_TOKEN_LIMIT = 15000;
  
  // Recalculate batch size if we exceed practical limit
  const requestedTokens = (optimalBatchSize * tokensPerOpportunity) + baseTokens;
  if (requestedTokens > PRACTICAL_TOKEN_LIMIT) {
    const practicalBatchSize = Math.floor((PRACTICAL_TOKEN_LIMIT - baseTokens) / tokensPerOpportunity);
    optimalBatchSize = Math.max(1, practicalBatchSize);
    reason += '-time-limited';
  }
  
  // Calculate actual token allocation with practical limits
  const actualMaxTokens = Math.min(
    maxOutputTokens,
    PRACTICAL_TOKEN_LIMIT,
    (optimalBatchSize * tokensPerOpportunity) + baseTokens
  );
  
  return {
    batchSize: optimalBatchSize,
    maxTokens: actualMaxTokens,
    modelName,
    modelCapacity: maxOutputTokens,
    reason,
    tokensPerOpportunity,
    baseTokens,
    avgDescriptionLength
  };
}

/**
 * Get all models by family or tier
 * @param {Object} filters - Filters to apply
 * @param {string} filters.family - Model family (e.g., 'claude-4')
 * @param {string} filters.tier - Model tier (e.g., 'sonnet')
 * @returns {Array} Array of model configurations
 */
export function getModelsByFilter(filters = {}) {
  return Object.entries(ANTHROPIC_MODELS)
    .filter(([id, config]) => {
      if (filters.family && config.family !== filters.family) return false;
      if (filters.tier && config.tier !== filters.tier) return false;
      return true;
    })
    .map(([id, config]) => ({ id, ...config }));
}

/**
 * Get the latest model in a family/tier
 * @param {string} family - Model family
 * @param {string} tier - Model tier  
 * @returns {Object|null} Latest model configuration or null
 */
export function getLatestModel(family, tier) {
  const models = getModelsByFilter({ family, tier });
  
  if (models.length === 0) return null;
  
  // Sort by training cutoff date (newest first)
  models.sort((a, b) => {
    const dateA = new Date(a.trainingCutoff);
    const dateB = new Date(b.trainingCutoff);
    return dateB - dateA;
  });
  
  return models[0];
}

export default {
  ANTHROPIC_MODELS,
  MODEL_ALIASES,
  getModelConfig,
  calculateOptimalBatchSize,
  getModelsByFilter,
  getLatestModel
}; 