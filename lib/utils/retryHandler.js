/**
 * Retry Handler for Pipeline Operations
 * 
 * Provides intelligent retry logic with:
 * - Exponential backoff
 * - Error-aware retry decisions
 * - Circuit breaker pattern
 * - Retry metrics tracking
 */

import { 
  classifyError, 
  calculateRetryDelay, 
  RetryPolicy,
  formatErrorForLogging 
} from './pipelineErrors.js';

/**
 * Execute a function with retry logic
 * @param {Function} fn - The async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of the function or throws final error
 */
export async function withRetry(fn, options = {}) {
  // Input validation
  if (typeof fn !== 'function') {
    throw new Error('withRetry: fn must be a function');
  }
  
  const {
    maxAttempts = 3,
    policy = RetryPolicy.DEFAULT,
    onRetry = null,
    context = {},
    operation = 'unknown'
  } = options;
  
  if (maxAttempts < 1) {
    throw new Error('withRetry: maxAttempts must be positive');
  }
  
  if (onRetry && typeof onRetry !== 'function') {
    throw new Error('withRetry: onRetry must be a function');
  }

  let lastError;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    
    try {
      // Execute the function
      const result = await fn(attempt);
      
      // Success - return result with metrics
      return {
        success: true,
        result,
        attempts: attempt,
        totalRetryTime: 0
      };
    } catch (error) {
      lastError = error;
      const classified = classifyError(error);
      
      console.error(`[RetryHandler] Attempt ${attempt}/${maxAttempts} failed for ${operation}:`, 
        formatErrorForLogging(classified));
      
      // Check if error is retryable
      if (!classified.retryable) {
        console.error(`[RetryHandler] Error is not retryable: ${classified.code}`);
        throw classified;
      }
      
      // Check if we have more attempts
      if (attempt >= maxAttempts) {
        console.error(`[RetryHandler] Max attempts (${maxAttempts}) reached for ${operation}`);
        classified.context.attempts = attempt;
        throw classified;
      }
      
      // Calculate retry delay
      const delay = classified.retryAfterMs || calculateRetryDelay(attempt, policy);
      
      if (delay === null) {
        console.error(`[RetryHandler] No more retries allowed by policy`);
        throw classified;
      }
      
      console.log(`[RetryHandler] Retrying ${operation} after ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
      
      // Call retry callback if provided
      if (onRetry) {
        await onRetry(error, attempt, delay);
      }
      
      // Wait before retry
      await sleep(delay);
    }
  }
  
  // Should not reach here, but throw last error if we do
  throw classifyError(lastError);
}

/**
 * Retry handler specifically for pipeline stages
 */
export async function retryStage(stageName, stageFunction, runManager, options = {}) {
  const stageOptions = {
    ...options,
    operation: stageName,
    onRetry: async (error, attempt, delay) => {
      // Update run manager with retry information
      if (runManager && runManager.addRetryAttempt) {
        await runManager.addRetryAttempt(stageName, {
          attempt,
          error: formatErrorForLogging(error),
          nextRetryIn: delay
        });
      }
      
      console.log(`[RetryHandler:${stageName}] Retry attempt ${attempt} scheduled in ${delay}ms`);
    }
  };
  
  try {
    return await withRetry(stageFunction, stageOptions);
  } catch (error) {
    // Log final failure to run manager
    if (runManager && runManager.recordStageFailure) {
      await runManager.recordStageFailure(stageName, {
        error: formatErrorForLogging(error, true),
        attempts: error.context?.attempts || 1
      });
    }
    throw error;
  }
}

/**
 * Circuit breaker implementation for protecting against cascading failures
 */
export class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.halfOpenRequests = options.halfOpenRequests || 1;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.nextAttempt = 0;
    this.isTransitioning = false; // Prevent race conditions
  }
  
  async execute(fn) {
    // Check circuit state with atomic transition handling
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.name}. Retry after ${new Date(this.nextAttempt).toISOString()}`);
      }
      
      // Atomic transition to prevent race conditions
      if (this.isTransitioning) {
        throw new Error(`Circuit breaker is transitioning for ${this.name}. Please retry shortly.`);
      }
      
      this.isTransitioning = true;
      try {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.log(`[CircuitBreaker:${this.name}] Moving to HALF_OPEN state`);
      } finally {
        this.isTransitioning = false;
      }
    }
    
    try {
      const result = await fn();
      
      // Success - update circuit state
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= this.halfOpenRequests) {
          this.state = 'CLOSED';
          this.failures = 0;
          console.log(`[CircuitBreaker:${this.name}] Circuit CLOSED after successful recovery`);
        }
      } else if (this.state === 'CLOSED') {
        this.failures = Math.max(0, this.failures - 1); // Decay failures on success
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      // Failed in half-open, go back to open
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.error(`[CircuitBreaker:${this.name}] Circuit OPEN after failure in HALF_OPEN state`);
    } else if (this.failures >= this.failureThreshold) {
      // Threshold reached, open circuit
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.error(`[CircuitBreaker:${this.name}] Circuit OPEN after ${this.failures} failures`);
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.state === 'OPEN' ? this.nextAttempt : null
    };
  }
  
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    console.log(`[CircuitBreaker:${this.name}] Circuit manually RESET`);
  }
}

/**
 * Batch retry handler for multiple operations
 */
export async function retryBatch(items, processFunction, options = {}) {
  const {
    maxAttempts = 3,
    concurrency = 5,
    continueOnError = true,
    onItemError = null,
    onItemSuccess = null
  } = options;
  
  const results = [];
  const errors = [];
  
  // Process items in batches with concurrency control
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(async (item, index) => {
      const itemIndex = i + index;
      
      try {
        const result = await withRetry(
          () => processFunction(item, itemIndex),
          { maxAttempts, operation: `item_${itemIndex}` }
        );
        
        if (onItemSuccess) {
          await onItemSuccess(item, result, itemIndex);
        }
        
        return { success: true, item, result, index: itemIndex };
      } catch (error) {
        const errorInfo = { success: false, item, error, index: itemIndex };
        
        if (onItemError) {
          await onItemError(item, error, itemIndex);
        }
        
        if (!continueOnError) {
          throw error;
        }
        
        errors.push(errorInfo);
        return errorInfo;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return {
    results,
    errors,
    successCount: results.filter(r => r.success).length,
    errorCount: errors.length,
    totalItems: items.length
  };
}

/**
 * Utility function for sleep/delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a timeout wrapper for functions
 */
export function withTimeout(fn, timeoutMs, operation = 'Operation') {
  return Promise.race([
    fn(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

export default {
  withRetry,
  retryStage,
  CircuitBreaker,
  retryBatch,
  withTimeout
};