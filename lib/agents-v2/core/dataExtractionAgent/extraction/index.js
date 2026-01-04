/**
 * Extraction Module
 * 
 * Handles LLM-based data extraction and schema processing
 */

import { schemas } from '../../../utils/anthropicClient.js';
import { PIPELINE_MODELS } from '../../../utils/modelConfigs.js';
import {
  generateTaxonomyInstruction,
  generateLocationEligibilityInstruction
} from '../../../../constants/taxonomies.js';
import { splitDataIntoChunks, processChunksInParallel } from '../utils/index.js';
import { createLogger } from '../../../utils/logger.js';
import { ExtractionConfig } from '../../../config/extraction.config.js';

const logger = createLogger('DataExtractionAgent:Extraction');

/**
 * Standardized error wrapper for extraction operations
 * @param {Error} error - Original error
 * @param {string} context - Context description
 * @param {Object} metadata - Additional error metadata
 * @returns {Error} Enhanced error with context
 */
function wrapExtractionError(error, context, metadata = {}) {
  const enhancedError = new Error(`[${context}]: ${error.message}`);
  enhancedError.originalError = error;
  enhancedError.context = context;
  enhancedError.metadata = metadata;
  enhancedError.stack = error.stack;
  return enhancedError;
}

/**
 * Coerce opportunities to always be an array
 * Simple fallback for edge cases - main string detection handled by chunk splitting
 */
function coerceOpportunities(opps) {
  if (Array.isArray(opps)) return opps;
  
  // Simple string parsing for edge cases
  if (typeof opps === 'string') {
    logger.warn(`String opportunities detected (${opps.length} chars) - attempting simple parse`);
    try {
      const parsed = JSON.parse(opps.replace(/\s+/g, ' '));
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      logger.error('Failed simple JSON.parse - chunk splitting should handle this');
      return [];
    }
  }
  
  // Handle null/undefined or unexpected types
  return [];
}

/**
 * Trim opportunity data to reduce payload size and prevent API overload
 */
function trimOpportunityData(opportunity) {
  const trimmed = { ...opportunity };
  
  // Remove large unnecessary fields that might bloat the payload
  const fieldsToTrim = [
    'fullText', 'rawHtml', 'attachments', 'documents', 'fileList',
    'metadata', 'debugInfo', 'internalNotes', 'systemFields',
    'auditTrail', 'versionHistory', 'backup', 'cache'
  ];
  
  fieldsToTrim.forEach(field => {
    if (trimmed[field]) {
      delete trimmed[field];
    }
  });
  
  // Trim excessively long description fields (keep first 10,000 chars as fallback)
  const descriptionFields = ['description', 'synopsis', 'details', 'summary'];
  descriptionFields.forEach(field => {
    if (trimmed[field] && typeof trimmed[field] === 'string') {
      if (trimmed[field].length > 10000) {
        trimmed[field] = trimmed[field].substring(0, 10000) + '... [trimmed for processing]';
      }
      // Remove control characters that could cause JSON issues
      trimmed[field] = trimmed[field]
        .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
        .replace(/\u2028|\u2029/g, ' '); // Replace line/paragraph separators
    }
  });
  
  // If opportunity has nested data arrays, limit their size
  if (trimmed.nestedData && Array.isArray(trimmed.nestedData) && trimmed.nestedData.length > 50) {
    trimmed.nestedData = trimmed.nestedData.slice(0, 50);
  }
  
  return trimmed;
}

/**
 * Extract opportunities using the proper dataExtraction schema
 */
export async function extractOpportunitiesWithSchema(rawData, source, anthropic, processingInstructions) {
  // ⚡ DEBUG: Track input data flow
  logger.debug('Input rawData structure', {
    rawDataType: typeof rawData,
    hasData: !!rawData.data,
    dataType: typeof rawData.data,
    dataIsArray: Array.isArray(rawData.data),
    rawDataKeys: Object.keys(rawData || {}),
    totalFoundInRawData: rawData.totalFound,
    apiCallCount: rawData.apiCallCount
  });
  
  const opportunities = Array.isArray(rawData.data) ? rawData.data : [rawData.data];
  
  // ⚡ DEBUG: Log input count details
  logger.debug('Input opportunities', {
    opportunitiesLength: opportunities.length,
    firstOpportunityKeys: opportunities[0] ? Object.keys(opportunities[0]) : 'none',
    sampleOpportunitySize: opportunities[0] ? JSON.stringify(opportunities[0]).length : 0
  });
  
  if (opportunities.length === 0) {
    logger.warn('No opportunities to process, returning empty result');
    return {
      opportunities: [],
      extractionMetrics: {
        totalFound: 0,
        successfullyExtracted: 0,
        challenges: []
      },
      totalExtracted: 0
    };
  }
  
  logger.info(`Starting schema-based extraction for ${opportunities.length} opportunities`);
  
  // Trim opportunity data to reduce payload size and prevent API overload
  const trimmedOpportunities = opportunities.map(trimOpportunityData);
  logger.debug('Trimmed opportunity data to prevent API overload');
  
  // Split into smaller chunks for processing
  const chunks = splitDataIntoChunks(trimmedOpportunities, ExtractionConfig.CHUNK_SIZE);
  logger.info(`Split into ${chunks.length} chunks`);
  
  // Create shared state for thread-safe circuit breaker tracking
  const circuitBreakerState = {
    anomalousChunks: 0,
    failedChunks: 0,
    stringParsingIssues: 0,
    // Use a simple lock mechanism for atomic updates
    updateAnomalous: function(increment = 1) {
      this.anomalousChunks += increment;
      return this.anomalousChunks;
    },
    updateFailed: function(increment = 1) {
      this.failedChunks += increment;
      return this.failedChunks;
    },
    updateStringIssues: function(increment = 1) {
      this.stringParsingIssues += increment;
      return this.stringParsingIssues;
    }
  };
  
  // Process chunks with adaptive concurrency - start high, reduce on errors
  const processFunction = (chunk, index) => processExtractionChunk(
    chunk, source, anthropic, index, chunks.length, processingInstructions, circuitBreakerState
  );
  logger.info('Starting parallel chunk processing...');
  const chunkResults = await processChunksInParallel(chunks, processFunction, ExtractionConfig.DEFAULT_CONCURRENCY);
  logger.info('Parallel processing complete, combining results...');
  
  // Enhanced results combination with circuit breaker pattern
  const allOpportunities = [];
  const allChallenges = [];
  let totalExtracted = 0;
  
  // Track token usage across all chunks
  let totalTokensUsed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalApiCalls = 0;
  
  // Get final counts from shared state
  const failedChunks = circuitBreakerState.failedChunks;
  const anomalousChunks = circuitBreakerState.anomalousChunks;
  const stringParsingIssues = circuitBreakerState.stringParsingIssues;
  
  // Circuit breaker thresholds
  const MAX_ANOMALOUS_CHUNKS = Math.ceil(chunks.length * ExtractionConfig.MAX_ANOMALOUS_CHUNKS_RATIO);
  const MAX_FAILED_CHUNKS = Math.ceil(chunks.length * ExtractionConfig.MAX_FAILED_CHUNKS_RATIO);
  
  for (const [index, result] of chunkResults.entries()) {
    if (result.success) {
      const chunkOpportunityCount = result.data.opportunities.length;
      logger.debug(`Chunk ${index + 1}/${chunks.length}: ${chunkOpportunityCount} opportunities extracted`);
      
      // Enhanced anomaly detection with ratio-based checks
      const inputCount = chunks[index].length;
      const countRatio = chunkOpportunityCount / inputCount;
      
      // Flag as anomalous if count is significantly higher than expected
      if (countRatio > ExtractionConfig.ANOMALY_DETECTION_RATIO) {
        // Use shared state for thread-safe updates
        const currentAnomalous = circuitBreakerState ? circuitBreakerState.updateAnomalous() : ++anomalousChunks;
        const currentStringIssues = circuitBreakerState ? circuitBreakerState.updateStringIssues() : ++stringParsingIssues;
        
        logger.error(`SEVERE ANOMALY: Chunk ${index + 1} returned ${chunkOpportunityCount} opportunities from ${inputCount} inputs (${countRatio.toFixed(1)}x ratio)`);
        logger.error('This strongly suggests string length was mistaken for array length');
        
        // Apply circuit breaker if too many anomalies
        if (currentAnomalous > MAX_ANOMALOUS_CHUNKS) {
          logger.error(`CIRCUIT BREAKER ACTIVATED: Too many anomalous chunks (${currentAnomalous}/${MAX_ANOMALOUS_CHUNKS})`);
          logger.error('This indicates systematic parsing failure. Aborting to prevent data corruption.');
          
          return {
            opportunities: allOpportunities,
            extractionMetrics: {
              totalFound: opportunities.length,
              successfullyExtracted: totalExtracted,
              challenges: [
                ...allChallenges, 
                `Circuit breaker activated: ${anomalousChunks} anomalous chunks detected`,
                `${stringParsingIssues} chunks had string parsing issues`,
                `Extraction halted to prevent data corruption`
              ]
            },
            totalExtracted,
            circuitBreakerActivated: true
          };
        }
        
        // For anomalous chunks, use fallback: return empty results to avoid corruption
        logger.warn(`FALLBACK: Ignoring anomalous chunk ${index + 1} to prevent data corruption`);
        allChallenges.push(`Chunk ${index + 1}: Anomalous count detected, ignored for data integrity`);
        continue;
      }
      
      // If chunk looks reasonable, include it
      allOpportunities.push(...result.data.opportunities);
      allChallenges.push(...(result.data.challenges || []));

      totalExtracted += result.data.opportunities.length;
      
      // Accumulate token usage from successful chunks
      if (result.usage) {
        totalInputTokens += result.usage.input_tokens || 0;
        totalOutputTokens += result.usage.output_tokens || 0;
        totalTokensUsed += (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0);
        totalApiCalls += 1;
      } else if (result.performance) {
        totalTokensUsed += result.performance.totalTokens || 0;
        totalInputTokens += result.performance.inputTokens || 0;
        totalOutputTokens += result.performance.outputTokens || 0;
        totalApiCalls += 1;
      }
      
    } else {
      // Use shared state for thread-safe updates
      const currentFailed = circuitBreakerState ? circuitBreakerState.updateFailed() : ++failedChunks;
      logger.error(`Chunk ${index + 1} processing failed: ${result.error}`);
      
      // Apply circuit breaker for excessive failures
      if (currentFailed > MAX_FAILED_CHUNKS) {
        logger.error(`CIRCUIT BREAKER ACTIVATED: Too many failed chunks (${currentFailed}/${MAX_FAILED_CHUNKS})`);
        
        return {
          opportunities: allOpportunities,
          extractionMetrics: {
            totalFound: opportunities.length,
            successfullyExtracted: totalExtracted,
            challenges: [
              ...allChallenges,
              `Circuit breaker activated: ${failedChunks} chunks failed`,
              `Processing halted due to excessive failures`
            ]
          },
          totalExtracted,
          circuitBreakerActivated: true
        };
      }
    }
  }
  
  logger.info(`Schema-based extraction complete: ${totalExtracted} opportunities extracted from ${chunks.length} chunks (${failedChunks} chunks failed)`);
  
  // Enhanced logging with issue tracking and recovery statistics
  const successfulChunks = chunks.length - failedChunks;
  const issuesSummary = {
    anomalousChunks,
    stringParsingIssues,
    failedChunks,
    successfulChunks,
    processingSuccessRate: ((successfulChunks / chunks.length) * 100).toFixed(1),
    circuitBreakerActivated: anomalousChunks > MAX_ANOMALOUS_CHUNKS || failedChunks > MAX_FAILED_CHUNKS,
    recoveryAttempts: 0,
    recoveredOpportunities: 0
  };
  
  // Count recovery statistics from challenges
  allChallenges.forEach(challenge => {
    if (typeof challenge === 'string' && challenge.includes('RECOVERY SUCCESS')) {
      const match = challenge.match(/Salvaged (\d+)\/\d+ opportunities/);
      if (match) {
        issuesSummary.recoveredOpportunities += parseInt(match[1]);
        issuesSummary.recoveryAttempts++;
      }
    }
  });
  
  if (stringParsingIssues > 0 || issuesSummary.recoveryAttempts > 0) {
    logger.warn('SMART RECOVERY SUMMARY:', {
      stringParsingIssues: `${stringParsingIssues} chunks`,
      recoveryAttempts: issuesSummary.recoveryAttempts,
      opportunitiesRecovered: issuesSummary.recoveredOpportunities,
      anomalousChunks: `${anomalousChunks}/${chunks.length}`,
      circuitBreakerStatus: issuesSummary.circuitBreakerActivated ? 'ACTIVATED' : 'Normal',
      processingSuccessRate: `${issuesSummary.processingSuccessRate}%`
    });
  }
  
  // ⚡ DEBUG: Track output data flow with issue detection
  logger.debug('Final extraction result', {
    inputOpportunitiesCount: opportunities.length,
    outputOpportunitiesCount: allOpportunities.length,
    totalExtractedCount: totalExtracted,
    chunksProcessed: chunks.length,
    issuesDetected: issuesSummary,
    extractionRatio: `${opportunities.length} → ${allOpportunities.length}`,
    dataIntegrityCheck: totalExtracted <= opportunities.length ? 'PASS' : 'FAIL',
    metricsReported: {
      totalFound: opportunities.length,
      successfullyExtracted: totalExtracted
    }
  });
  
  return {
    opportunities: allOpportunities,
    extractionMetrics: {
      totalFound: opportunities.length,
      successfullyExtracted: totalExtracted,
      challenges: allChallenges,
      // Token usage metrics
      totalTokens: totalTokensUsed,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalApiCalls: totalApiCalls,
      // Add issue tracking and recovery metrics
      processingStats: {
        chunksProcessed: chunks.length,
        chunksSuccessful: successfulChunks,
        chunksFailed: failedChunks,
        chunksAnomalous: anomalousChunks,
        stringParsingIssues,
        recoveryAttempts: issuesSummary.recoveryAttempts,
        opportunitiesRecovered: issuesSummary.recoveredOpportunities,
        successRate: issuesSummary.processingSuccessRate,
        circuitBreakerActivated: issuesSummary.circuitBreakerActivated
      }
    },
    totalExtracted
  };
}

/**
 * Process failed chunk as individual opportunities for smart recovery
 * @param {Array} chunk - Array of opportunities that failed as a chunk
 * @param {Object} source - The source object for context
 * @param {Object} anthropic - Anthropic client instance
 * @param {number} chunkIndex - Original chunk index
 * @param {number} totalChunks - Total number of chunks
 * @param {Object} processingInstructions - Processing configuration
 * @returns {Promise<Object>} - Recovery result with salvaged opportunities
 */
async function processChunkAsIndividualOpportunities(chunk, source, anthropic, chunkIndex, totalChunks, processingInstructions) {
  logger.info(`🔧 INDIVIDUAL RECOVERY: Processing ${chunk.length} opportunities separately for chunk ${chunkIndex + 1}`);
  
  const recoveredOpportunities = [];
  const recoveryCharlenges = [];
  let successCount = 0;
  let failureCount = 0;
  
  // Set up timeout for entire recovery operation
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Individual recovery timeout after ${ExtractionConfig.INDIVIDUAL_PROCESSING_TIMEOUT_MS}ms`));
    }, ExtractionConfig.INDIVIDUAL_PROCESSING_TIMEOUT_MS);
  });
  
  // Process each opportunity individually with timeout
  const processingPromise = (async () => {
    for (let i = 0; i < chunk.length; i++) {
    const singleOpportunity = [chunk[i]];
    const oppTitle = chunk[i].title || chunk[i].name || `Opportunity ${i + 1}`;
    
    try {
      logger.info(`🔍 INDIVIDUAL RETRY ${i + 1}/${chunk.length}: Processing "${oppTitle.substring(0, 50)}..."`);
      
      // Use direct extraction logic without recovery to prevent recursion
      const individualResult = await processExtractionChunkDirect(
        singleOpportunity, 
        source, 
        anthropic, 
        chunkIndex * 1000 + i, // Unique index for individual processing
        totalChunks, 
        processingInstructions
      );
      
      if (individualResult.success && individualResult.data.opportunities.length > 0) {
        recoveredOpportunities.push(...individualResult.data.opportunities);
        successCount++;
        logger.info(`✅ INDIVIDUAL SUCCESS ${i + 1}/${chunk.length}: Recovered "${oppTitle.substring(0, 50)}..."`);
      } else {
        failureCount++;
        recoveryCharlenges.push(`Individual processing failed for: ${oppTitle.substring(0, 100)}`);
        logger.warn(` ⚠️ INDIVIDUAL FAILURE ${i + 1}/${chunk.length}: Could not recover "${oppTitle.substring(0, 50)}..."`);
      }
      
    } catch (error) {
      const wrappedError = wrapExtractionError(error, 'Individual Processing Error', {
        opportunityIndex: i,
        opportunityTitle: oppTitle,
        chunkIndex
      });
      failureCount++;
      recoveryCharlenges.push(`Individual processing error for "${oppTitle}": ${wrappedError.message}`);
      logger.error(` ❌ INDIVIDUAL ERROR ${i + 1}/${chunk.length}: ${wrappedError.message}`);
    }
    
      // Small delay between individual processing to avoid rate limits
      if (i < chunk.length - 1) {
        await new Promise(resolve => setTimeout(resolve, ExtractionConfig.INDIVIDUAL_RETRY_DELAY_MS));
      }
    }
    
    return { successCount, failureCount };
  })();
  
  // Race between processing and timeout
  try {
    const result = await Promise.race([processingPromise, timeoutPromise]);
    successCount = result.successCount;
    failureCount = result.failureCount;
  } catch (timeoutError) {
    logger.error(`RECOVERY TIMEOUT: ${timeoutError.message}`);
    recoveryCharlenges.push(`Recovery timeout: Only processed ${successCount + failureCount}/${chunk.length} opportunities`);
  }
  
  logger.info(`📊 RECOVERY SUMMARY: ${successCount}/${chunk.length} opportunities recovered, ${failureCount} failed`);
  
  const originalChunkSize = chunk.length;
  
  // Clean up large objects to help garbage collection
  chunk = null;
  
  return {
    success: recoveredOpportunities.length > 0,
    opportunities: recoveredOpportunities,
    challenges: recoveryCharlenges,
    recoveryStats: {
      originalChunkSize: originalChunkSize,
      recovered: successCount,
      failed: failureCount,
      recoveryRate: ((successCount / originalChunkSize) * 100).toFixed(1) + '%'
    }
  };
}

/**
 * Direct processing function without smart recovery (used for individual retries)
 * @param {Array} chunk - Single opportunity array
 * @param {Object} source - The source object for context
 * @param {Object} anthropic - Anthropic client instance
 * @param {number} chunkIndex - Chunk index
 * @param {number} totalChunks - Total number of chunks
 * @param {Object} processingInstructions - Processing configuration
 * @returns {Promise<Object>} - Extraction result
 */
async function processExtractionChunkDirect(chunk, source, anthropic, chunkIndex, totalChunks, processingInstructions) {
  logger.info(`📄 Direct processing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} opportunities)`);
  
  try {
    const chunkText = JSON.stringify(chunk, null, 2);
    const systemPrompt = buildExtractionPrompt(source, processingInstructions);
    const userPrompt = `Extract and standardize the following opportunities data. 
IMPORTANT: This chunk contains exactly ${chunk.length} funding opportunit${chunk.length === 1 ? 'y' : 'ies'}. 
You should extract and return exactly ${chunk.length} normalized opportunit${chunk.length === 1 ? 'y' : 'ies'} (no more, no less).

${chunkText}`;
    
    const startTime = Date.now();
    
    // Make LLM call with proper schema using Haiku for extraction
    const extractionResult = await anthropic.callWithSchema(
      `${systemPrompt}\n\n${userPrompt}`,
      schemas.dataExtraction,
      {
        model: PIPELINE_MODELS.extraction,
        maxTokens: 8000,
        temperature: 0.05  // Lower temperature for individual processing
      }
    );
    
    // Extract the result without smart recovery
    let extractedData = { opportunities: [], challenges: [] };
    if (extractionResult.data) {
      extractedData = extractionResult.data;
      extractedData.opportunities = coerceOpportunities(extractedData.opportunities);
    }
    
    const executionTime = Date.now() - startTime;
    const extractedCount = extractedData.opportunities?.length || 0;
    
    logger.info(`📊 Direct processing: ${extractedCount}/${chunk.length} opportunities extracted (${executionTime}ms)`);
    
    return {
      success: true,
      data: extractedData
    };
    
  } catch (error) {
    const wrappedError = wrapExtractionError(
      error, 
      'Direct Processing Failed',
      { chunkIndex, chunkSize: chunk.length }
    );
    logger.error(` ❌ ${wrappedError.message}`);
    return {
      success: false,
      error: wrappedError.message,
      data: { opportunities: [], challenges: [`Direct processing error: ${error.message}`] }
    };
  }
}

/**
 * Process a single chunk of opportunities for extraction (with smart recovery)
 * @param {Object} circuitBreakerState - Shared state for thread-safe circuit breaker tracking
 */
async function processExtractionChunk(chunk, source, anthropic, chunkIndex, totalChunks, processingInstructions, circuitBreakerState = null) {
  logger.info(`📄 Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length} opportunities)`);
  
  // Add detailed debugging for first few chunks
  if (chunkIndex < 3) {
    logger.info(`🔍 DEBUG - Chunk ${chunkIndex + 1} opportunity titles:`, 
      chunk.map(opp => opp.title || opp.name || 'No title').slice(0, 5));
  }
  
  try {
    const chunkText = JSON.stringify(chunk, null, 2);
    logger.info(`🔍 DEBUG - Chunk size: ${chunkText.length} characters`);
    
    // Build the extraction prompt
    const systemPrompt = buildExtractionPrompt(source, processingInstructions);
    logger.info(`🔍 DEBUG - Prompt length: ${systemPrompt.length} characters`);
    
    const userPrompt = `Extract and standardize the following opportunities data. 
IMPORTANT: This chunk contains exactly ${chunk.length} funding opportunit${chunk.length === 1 ? 'y' : 'ies'}. 
You should extract and return exactly ${chunk.length} normalized opportunit${chunk.length === 1 ? 'y' : 'ies'} (no more, no less).

${chunkText}`;
    
    logger.info(`🚀 Starting LLM call...`);
    const startTime = Date.now();
    
    // Make LLM call with proper schema using our AnthropicClient wrapper
    let extractionResult;
    let attemptCount = 0;
    const maxRetries = ExtractionConfig.MAX_EXTRACTION_RETRIES;
    
    while (attemptCount <= maxRetries) {
      try {
        extractionResult = await anthropic.callWithSchema(
          `${systemPrompt}\n\n${userPrompt}`,
          schemas.dataExtraction,
          {
            model: PIPELINE_MODELS.extraction,
            maxTokens: 8000,
            temperature: attemptCount > 0 ? 0.05 : 0.1  // Lower temperature on retry
          }
        );
        
        // If we got a result, break out of retry loop
        if (extractionResult && extractionResult.data) {
          break;
        }
        
      } catch (error) {
        attemptCount++;
        if (attemptCount > maxRetries) {
          throw wrapExtractionError(error, 'LLM Call Failed After Retries', {
            chunkIndex, 
            attempts: attemptCount,
            lastError: error.message
          });
        }
        
        logger.warn(` 🔄 Chunk ${chunkIndex + 1} attempt ${attemptCount} failed with ${error.message}, retrying with lower temperature...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attemptCount)); // Progressive delay
      }
    }
    
    logger.info(`✅ LLM call completed successfully`);
    
    // Extract the result from our wrapper response
    let extractedData = { opportunities: [], challenges: [] };
    
    if (extractionResult.data) {
      extractedData = extractionResult.data;
      
      // SMART RECOVERY: Check for malformed string and trigger individual retry
      let shouldRetryIndividually = false;
      if (extractedData.opportunities && typeof extractedData.opportunities === 'string') {
        logger.error(` 🚨 MALFORMED JSON DETECTED: Chunk ${chunkIndex + 1} - LLM returned opportunities as STRING instead of array`);
        logger.error(` 🚨 String length: ${extractedData.opportunities.length} characters`);
        logger.error(` 🚨 Expected ${chunk.length} opportunities, got string. Triggering individual retry...`);
        shouldRetryIndividually = true;
        
        // Update shared state for string parsing issues
        if (circuitBreakerState) {
          circuitBreakerState.updateStringIssues();
        }
      }
      
      // Ensure opportunities is always an array (this will now use enhanced normalization from AnthropicClient)
      extractedData.opportunities = coerceOpportunities(extractedData.opportunities);
      
      logger.debug(`LLM returned ${extractedData.opportunities.length} opportunities from ${chunk.length} input`);
      
      // FAILURE DETECTION: Check if we lost opportunities and should retry individually
      const extractedCount = extractedData.opportunities?.length || 0;
      if (extractedCount === 0 && chunk.length > 0) {
        logger.warn(` 🔄 ZERO EXTRACTION DETECTED: Chunk ${chunkIndex + 1} returned 0/${chunk.length} opportunities`);
        shouldRetryIndividually = true;
      }
      
      // SMART RECOVERY: Retry failed chunk as individual opportunities
      if (shouldRetryIndividually && chunk.length > 1) {
        // Memory safety check before triggering individual processing
        const memoryUsage = process.memoryUsage();
        const memoryThresholdMB = ExtractionConfig.MEMORY_THRESHOLD_MB;
        const currentMemoryMB = memoryUsage.heapUsed / (1024 * 1024);
        
        if (currentMemoryMB > memoryThresholdMB) {
          logger.error(`HIGH MEMORY WARNING: ${currentMemoryMB.toFixed(0)}MB used, skipping individual retry to prevent memory exhaustion`, null, { memoryUsage: memoryUsage });
          extractedData.challenges = [
            ...(extractedData.challenges || []),
            `Memory threshold exceeded (${currentMemoryMB.toFixed(0)}MB/${memoryThresholdMB}MB) - skipped individual retry for chunk ${chunkIndex + 1}`
          ];
          shouldRetryIndividually = false;
        }
        
        logger.warn(` 🛠️ SMART RECOVERY: Splitting chunk ${chunkIndex + 1} into ${chunk.length} individual opportunities for retry`);
        
        const recoveryResult = await processChunkAsIndividualOpportunities(
          chunk, 
          source, 
          anthropic, 
          chunkIndex, 
          totalChunks, 
          processingInstructions
        );
        
        if (recoveryResult.success && recoveryResult.opportunities.length > 0) {
          logger.info(`✅ RECOVERY SUCCESS: Salvaged ${recoveryResult.opportunities.length}/${chunk.length} opportunities from chunk ${chunkIndex + 1}`);
          extractedData.opportunities = recoveryResult.opportunities;
          extractedData.challenges = [
            ...(extractedData.challenges || []), 
            ...recoveryResult.challenges,
            `RECOVERY SUCCESS: Salvaged ${recoveryResult.opportunities.length}/${chunk.length} opportunities from chunk ${chunkIndex + 1} (${recoveryResult.recoveryStats.recoveryRate} recovery rate)`
          ];
        } else {
          logger.error(` ❌ RECOVERY FAILED: Could not salvage opportunities from chunk ${chunkIndex + 1}`);
          extractedData.challenges = [
            ...(extractedData.challenges || []),
            `RECOVERY FAILED: Chunk ${chunkIndex + 1} could not be salvaged through individual processing`
          ];
        }
      }
    }
    
    const executionTime = Date.now() - startTime;
    const extractedCount = extractedData.opportunities?.length || 0;
    logger.info(`✅ Chunk ${chunkIndex + 1}: ${extractedCount}/${chunk.length} opportunities extracted (${executionTime}ms)`);
    
    // Log anomaly but don't block
    if (extractedCount > chunk.length * 10) {
      logger.error(` ❌ ANOMALY DETECTED in Chunk ${chunkIndex + 1}: ${extractedCount} opportunities from ${chunk.length} input!`);
      logger.error(` ❌ Expected ~${chunk.length}, got ${extractedCount} (${Math.round(extractedCount/chunk.length)}x multiplication)`);
      
      // Log the entire chunk content when anomaly detected
      logger.error(` ❌ CHUNK CONTENT for debugging:`);
      logger.error('Chunk content', chunk);
      
      // Log the extracted opportunities to see what LLM created
      logger.error(` ❌ EXTRACTED DATA TYPE:`, typeof extractedData.opportunities);
      logger.error(` ❌ IS ARRAY:`, Array.isArray(extractedData.opportunities));
      
      if (Array.isArray(extractedData.opportunities)) {
        logger.error(` ❌ EXTRACTED OPPORTUNITIES (first 5):`);
        logger.error('First 5 opportunities', extractedData.opportunities.slice(0, 5));
        
        // Log opportunity titles to see pattern
        logger.error(` ❌ ALL OPPORTUNITY TITLES (first 20):`);
        logger.error('First 20 titles', extractedData.opportunities.slice(0, 20).map((opp, i) => `${i + 1}. ${opp.title || 'NO TITLE'}`));
      } else {
        logger.error(` ❌ EXTRACTED OPPORTUNITIES RAW VALUE:`);
        logger.error('Raw opportunities value', extractedData.opportunities);
      }
    }
    
    return {
      success: true,
      data: extractedData,
      usage: extractionResult.usage || {},
      performance: extractionResult.performance || {}
    };
    
  } catch (error) {
    const wrappedError = wrapExtractionError(
      error,
      `Chunk Processing Failed (${chunkIndex + 1}/${totalChunks})`,
      { chunkIndex, chunkSize: chunk.length, totalChunks }
    );
    logger.error(` ❌ ${wrappedError.message}`);
    return {
      success: false,
      error: wrappedError.message,
      data: { opportunities: [], challenges: [`Chunk ${chunkIndex + 1} error: ${error.message}`] }
    };
  }
}

/**
 * Build the extraction prompt with taxonomies and response mapping
 */
function buildExtractionPrompt(source, processingInstructions) {
  // Generate taxonomy instructions for each field
  const projectTypesInstruction = generateTaxonomyInstruction('ELIGIBLE_PROJECT_TYPES', 'eligible project types');
  const applicantsInstruction = generateTaxonomyInstruction('ELIGIBLE_APPLICANTS', 'eligible applicants');
  const categoriesInstruction = generateTaxonomyInstruction('CATEGORIES', 'funding categories');
  const activitiesInstruction = generateTaxonomyInstruction('ELIGIBLE_ACTIVITIES', 'eligible activities');
  const fundingTypesInstruction = generateTaxonomyInstruction('FUNDING_TYPES', 'funding types');
  const locationInstructions = generateLocationEligibilityInstruction();
  
  // Build response mapping guidance if available
  let responseMappingGuidance = '';
  if (processingInstructions?.responseMapping && Object.keys(processingInstructions.responseMapping).length > 0) {
    const mappings = Object.entries(processingInstructions.responseMapping)
      .filter(([key, value]) => value && value.trim())
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
    
    if (mappings) {
      responseMappingGuidance = `
RESPONSE MAPPING GUIDANCE:
The following field mappings have been configured for this source:
${mappings}

Use these mappings as guidance for where to find specific information in the API response data.`;
    }
  }
  
  return `You are an expert data extraction agent. Extract funding opportunities from API response data and standardize them according to our schema.

KEY REQUIREMENTS:
- Extract ALL opportunities from the provided data
- Use intelligent field extraction from ANY available fields including structured fields, descriptions, summaries, and narrative text
- Extract funding amounts from wherever they appear - dedicated funding fields, descriptions, or program summaries
- If funding amounts are mentioned in text, parse and extract them intelligently
- Ensure all required fields are present and properly formatted
- Apply proper taxonomies for consistent categorization

SOURCE INFORMATION:
- Source: ${source.name}
- Type: ${source.type || 'Unknown'}
- Organization: ${source.organization || 'Unknown'}

${responseMappingGuidance}

COMPREHENSIVE DESCRIPTION EXTRACTION STRATEGY:
For the 'description' field, provide the most complete and comprehensive description possible by:

1. SCAN FOR ALL DESCRIPTIVE FIELDS throughout the entire API response including (but not limited to):
   description, summary, abstract, overview, programSummary, synopsis, details, backgroundInfo, programDescription, opportunityDescription, fundingDescription, projectDescription, notes, additionalInfo, remarks, commentary, guidance, applicationProcess, eligibilityCriteria, evaluationCriteria, programGoals, objectives, purpose, background, and any other fields containing narrative or descriptive content

2. CRITICAL: SCAN FOR MULTIPLE INSTANCES OF SAME FIELD NAMES:
   - The same field name may appear MULTIPLE times (e.g., description, description, synopsis, synopsis)
   - Capture EVERY occurrence, even if the field name is repeated
   - Do not assume field names are unique - each instance may contain different content
   - When you find "description" in one place, keep looking for more "description" fields elsewhere
   - When you find "synopsis" in one place, keep looking for more "synopsis" fields elsewhere
   - Scan the ENTIRE response structure, including nested objects and arrays

3. NATURAL MELDING APPROACH:
   - Combine all unique descriptive content into one flowing, natural narrative
   - Preserve ALL content verbatim - do not modify, enhance, or interpret the original text
   - Intelligently remove duplicate sentences/phrases that appear across different field instances
   - Organize content logically but let it flow naturally without forced section breaks or labels
   - Prioritize completeness - include every unique piece of descriptive information found
   - Create a coherent, comprehensive description that reads naturally

FUNDING EXTRACTION APPROACH:
1. Look for structured funding fields first (totalFunding, estimatedFunding, award amounts, etc.). Use the response mapping rules, if available.
2. If structured fields are missing or contain "N/A"/"none", extract from description text
3. Parse dollar amounts from any text that mentions funding levels, award ranges, or budget information
4. Use context clues to determine minimum, maximum, and total funding amounts
5. If no funding information is available anywhere, set funding amounts to null

API TIMESTAMP EXTRACTION:
For the 'api_updated_at' field, extract the API's last modification timestamp:
1. Look for timestamp fields like: lastModified, updated_at, dateModified, modifiedDate, lastUpdated, updatedOn, revisionDate, dateUpdated, or similar
2. Extract the most recent modification timestamp from the API response
3. Convert to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ) if possible
4. If no timestamp is available in the API response, leave null
5. Do NOT use posted_date, created_date, or application deadlines - only use actual modification/update timestamps

FUNDING SOURCE EXTRACTION:
Extract the organization providing this funding into the funding_source object:
1. Name: The official organization name (e.g., "U.S. Department of Energy", "California Energy Commission")
2. Type: Federal, State, Utility, Foundation, County, Municipality, or Other
3. Contact info: website, email, phone if available in the response

TAXONOMY FRAMEWORK DEFINITIONS:

CATEGORIES = The broad domain/sector the opportunity belongs to
- Examples: Energy, Infrastructure, Education, Healthcare, Transportation
- Purpose: High-level organization and filtering

ELIGIBLE_PROJECT_TYPES = The WHAT - specific components/equipment/systems being funded
- Examples: HVAC Systems, Solar Panels, Water Treatment Plants, Playgrounds
- Purpose: Primary matching field for client capabilities - THE STAR of our taxonomy

ELIGIBLE_ACTIVITIES = The HOW - actions/uses of funding
- Examples: Installation, Equipment Purchase, Research, Training, New Construction
- Purpose: Defines what can be done with the funding

TAXONOMY GUIDELINES:

${projectTypesInstruction}

${applicantsInstruction}

${categoriesInstruction}

${activitiesInstruction}

${fundingTypesInstruction}

${locationInstructions}

RESPONSE FORMAT - CRITICAL INSTRUCTIONS:
- Respond ONLY using the structured_response tool
- Do NOT add any explanatory text before or after the tool response  
- Do NOT include commentary, analysis, or additional information
- Your entire response must consist solely of the tool call with structured data
- Any text outside the tool response will cause processing errors

CRITICAL RESPONSE FORMAT REQUIREMENTS:
- You MUST respond using the structured_response tool with the exact schema provided
- DO NOT return JSON as a string - use the tool's structured format directly
- The opportunities field must be an array of objects, not a JSON string
- Each opportunity must be a properly formatted object with all required fields

Return all extracted opportunities using the dataExtraction tool.`;
} 