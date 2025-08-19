/**
 * Storage Agent Configuration
 * Centralized configuration for all StorageAgent constants
 */

export const StorageConfig = {
  // Batch processing configuration
  BATCH_SIZE: parseInt(process.env.STORAGE_BATCH_SIZE || '10'),
  
  // Database connection settings
  PERSIST_SESSION: false,
  AUTO_REFRESH_TOKEN: false,
  
  // Retry configuration  
  MAX_RETRIES: parseInt(process.env.STORAGE_MAX_RETRIES || '3'),
  RETRY_DELAY: parseInt(process.env.STORAGE_RETRY_DELAY || '1000'),
  
  // Timeout configuration
  DEFAULT_TIMEOUT: parseInt(process.env.STORAGE_TIMEOUT || '30000'),
  
  // Performance tuning
  PARALLEL_BATCH_PROCESSING: process.env.STORAGE_PARALLEL_BATCHES === 'true',
  
  // Feature flags
  ENABLE_DUPLICATE_DETECTION: process.env.STORAGE_ENABLE_DUPLICATE_DETECTION !== 'false',
  ENABLE_STATE_ELIGIBILITY: process.env.STORAGE_ENABLE_STATE_ELIGIBILITY !== 'false',
};