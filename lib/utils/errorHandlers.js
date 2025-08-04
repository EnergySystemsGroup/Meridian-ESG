/**
 * Global Error Handlers for Pipeline Processing
 * 
 * Prevents silent failures by capturing unhandled promise rejections
 * and uncaught exceptions that could cause runs to get stuck in 'started' status
 */

/**
 * Initialize global error handlers to prevent silent failures
 * Should be called once during application startup
 */
export function initializeGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[GlobalErrorHandler] ❌ Unhandled Promise Rejection:', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise,
      timestamp: new Date().toISOString()
    });
    
    // Don't exit the process, just log the error for investigation
    // In production, you might want to report this to an error tracking service
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[GlobalErrorHandler] ❌ Uncaught Exception:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Only exit in development - avoid taking down production servers
    if (process.env.NODE_ENV === 'development') {
      console.error('[GlobalErrorHandler] 🔄 Process will exit due to uncaught exception (development mode)');
      process.exit(1);
    } else {
      console.error('[GlobalErrorHandler] ⚠️ Continuing execution in production mode');
      // In production, log but don't exit - let the platform handle restarts
      // TODO: Report to error tracking service (Sentry, etc.)
    }
  });

  // Handle process warnings (optional, for debugging)
  process.on('warning', (warning) => {
    console.warn('[GlobalErrorHandler] ⚠️ Process Warning:', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
      timestamp: new Date().toISOString()
    });
  });

  console.log('[GlobalErrorHandler] ✅ Global error handlers initialized');
}

/**
 * Wrap async functions with enhanced error handling
 * Use this for critical pipeline functions to ensure errors are properly caught
 * 
 * @param {Function} asyncFn - The async function to wrap
 * @param {string} context - Context description for logging
 * @returns {Function} - Wrapped function with enhanced error handling
 */
export function wrapWithErrorHandling(asyncFn, context = 'Unknown') {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      console.error(`[ErrorWrapper:${context}] ❌ Function failed:`, {
        error: error.message,
        stack: error.stack,
        context,
        args: args.length,
        timestamp: new Date().toISOString()
      });
      throw error; // Re-throw to maintain error propagation
    }
  };
}

/**
 * Create a timeout promise that rejects after specified time
 * Useful for preventing indefinite hangs
 * 
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operation - Description of the operation for error message
 * @returns {Promise} - Promise that rejects after timeout
 */
export function createTimeoutPromise(timeoutMs, operation = 'Operation') {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

/**
 * Race a promise against a timeout
 * Prevents functions from hanging indefinitely
 * 
 * @param {Promise} promise - The promise to race
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operation - Description of the operation
 * @returns {Promise} - The original promise or timeout rejection
 */
export function withTimeout(promise, timeoutMs, operation = 'Operation') {
  return Promise.race([
    promise,
    createTimeoutPromise(timeoutMs, operation)
  ]);
}