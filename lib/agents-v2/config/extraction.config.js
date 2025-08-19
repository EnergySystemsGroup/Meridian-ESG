/**
 * Configuration for Data Extraction Agent
 * 
 * All values can be overridden with environment variables
 */

export const ExtractionConfig = {
  // Chunk processing configuration
  CHUNK_SIZE: parseInt(process.env.EXTRACTION_CHUNK_SIZE || '8000'),
  
  // Memory management
  MEMORY_THRESHOLD_MB: parseInt(process.env.EXTRACTION_MEMORY_THRESHOLD_MB || '1024'),
  
  // Retry configuration
  INDIVIDUAL_RETRY_DELAY_MS: parseInt(process.env.EXTRACTION_RETRY_DELAY_MS || '200'),
  MAX_EXTRACTION_RETRIES: parseInt(process.env.EXTRACTION_MAX_RETRIES || '2'),
  RETRY_TEMPERATURE_REDUCTION: parseFloat(process.env.EXTRACTION_RETRY_TEMP_REDUCTION || '0.05'),
  
  // Circuit breaker thresholds
  MAX_ANOMALOUS_CHUNKS_RATIO: parseFloat(process.env.EXTRACTION_MAX_ANOMALOUS_RATIO || '0.3'), // 30%
  MAX_FAILED_CHUNKS_RATIO: parseFloat(process.env.EXTRACTION_MAX_FAILED_RATIO || '0.5'), // 50%
  ANOMALY_DETECTION_RATIO: parseInt(process.env.EXTRACTION_ANOMALY_RATIO || '20'), // 20x expected
  
  // Parallel processing
  DEFAULT_CONCURRENCY: parseInt(process.env.EXTRACTION_CONCURRENCY || '6'),
  
  // LLM configuration
  MAX_TOKENS: parseInt(process.env.EXTRACTION_MAX_TOKENS || '8000'),
  DEFAULT_TEMPERATURE: parseFloat(process.env.EXTRACTION_TEMPERATURE || '0.1'),
  
  // Storage/caching configuration
  HASH_CACHE_SIZE: parseInt(process.env.EXTRACTION_CACHE_SIZE || '100'),
  LARGE_RESPONSE_THRESHOLD: parseInt(process.env.EXTRACTION_LARGE_RESPONSE_KB || '50') * 1024, // Convert KB to bytes
  
  // Timeout configuration
  INDIVIDUAL_PROCESSING_TIMEOUT_MS: parseInt(process.env.EXTRACTION_INDIVIDUAL_TIMEOUT_MS || '30000'), // 30 seconds
  
  // Debug configuration
  DEBUG_FIRST_N_CHUNKS: parseInt(process.env.EXTRACTION_DEBUG_CHUNKS || '3'),
  OPPORTUNITY_TITLE_PREVIEW_LENGTH: parseInt(process.env.EXTRACTION_TITLE_PREVIEW || '50'),
  DESCRIPTION_SNIPPET_LENGTH: parseInt(process.env.EXTRACTION_DESC_SNIPPET || '100'),
  DESCRIPTION_TRIM_LENGTH: parseInt(process.env.EXTRACTION_DESC_TRIM || '10000'),
  
  // Token tracking
  TRACK_RETRY_TOKENS: process.env.EXTRACTION_TRACK_RETRY_TOKENS !== 'false', // Default true
};

/**
 * Validation to ensure configuration values are reasonable
 */
export function validateConfig() {
  const errors = [];
  
  if (ExtractionConfig.CHUNK_SIZE < 1000 || ExtractionConfig.CHUNK_SIZE > 50000) {
    errors.push('CHUNK_SIZE must be between 1000 and 50000');
  }
  
  if (ExtractionConfig.MEMORY_THRESHOLD_MB < 256) {
    errors.push('MEMORY_THRESHOLD_MB must be at least 256');
  }
  
  if (ExtractionConfig.MAX_ANOMALOUS_CHUNKS_RATIO < 0.1 || ExtractionConfig.MAX_ANOMALOUS_CHUNKS_RATIO > 1) {
    errors.push('MAX_ANOMALOUS_CHUNKS_RATIO must be between 0.1 and 1.0');
  }
  
  if (ExtractionConfig.MAX_FAILED_CHUNKS_RATIO < 0.1 || ExtractionConfig.MAX_FAILED_CHUNKS_RATIO > 1) {
    errors.push('MAX_FAILED_CHUNKS_RATIO must be between 0.1 and 1.0');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
  
  return true;
}

// Validate on load
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}