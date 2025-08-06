/**
 * Analysis Agent Configuration
 * Centralized configuration for all AnalysisAgent constants
 */

export const AnalysisConfig = {
  // Batch processing configuration
  DEFAULT_BATCH_SIZE: parseInt(process.env.ANALYSIS_DEFAULT_BATCH_SIZE || '5'),
  MAX_BATCH_SIZE: parseInt(process.env.ANALYSIS_MAX_BATCH_SIZE || '10'),
  MIN_BATCH_SIZE: parseInt(process.env.ANALYSIS_MIN_BATCH_SIZE || '1'),
  
  // Retry configuration
  MAX_RETRIES: parseInt(process.env.ANALYSIS_MAX_RETRIES || '3'),
  RETRY_DELAY: parseInt(process.env.ANALYSIS_RETRY_DELAY || '200'),
  BATCH_DELAY: parseInt(process.env.ANALYSIS_BATCH_DELAY || '100'),
  
  // Scoring thresholds
  HIGH_SCORE_THRESHOLD: parseFloat(process.env.ANALYSIS_HIGH_SCORE_THRESHOLD || '7'),
  MEDIUM_SCORE_THRESHOLD: parseFloat(process.env.ANALYSIS_MEDIUM_SCORE_THRESHOLD || '4'),
  
  // Token limits
  MAX_TOKENS_PER_BATCH: parseInt(process.env.ANALYSIS_MAX_TOKENS_PER_BATCH || '4000'),
  BASE_TOKENS: parseInt(process.env.ANALYSIS_BASE_TOKENS || '500'),
  
  // Performance tuning
  PARALLEL_PROCESSING: process.env.ANALYSIS_PARALLEL_PROCESSING !== 'false',
  
  // Content complexity thresholds (for dynamic batch sizing)
  SHORT_CONTENT_THRESHOLD: parseInt(process.env.ANALYSIS_SHORT_CONTENT_THRESHOLD || '500'),
  MEDIUM_CONTENT_THRESHOLD: parseInt(process.env.ANALYSIS_MEDIUM_CONTENT_THRESHOLD || '2000'),
  LONG_CONTENT_THRESHOLD: parseInt(process.env.ANALYSIS_LONG_CONTENT_THRESHOLD || '5000'),
  
  // Cost calculation
  COST_PER_TOKEN: parseFloat(process.env.ANALYSIS_COST_PER_TOKEN || '0.00001'),
};