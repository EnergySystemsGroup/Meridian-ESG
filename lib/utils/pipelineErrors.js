/**
 * Pipeline Error Classification System
 * 
 * Provides structured error handling for the V2 pipeline with:
 * - Error classification and categorization
 * - Retry strategies based on error types
 * - Contextual error information
 * - Error recovery suggestions
 */

/**
 * Base class for all pipeline errors
 */
export class PipelineError extends Error {
  constructor(message, code, category, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.category = category;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.retryable = false;
    this.retryAfterMs = null;
    this.severity = 'error';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      retryAfterMs: this.retryAfterMs,
      severity: this.severity,
      stack: this.stack
    };
  }
}

/**
 * Transient errors that should be retried
 */
export class TransientError extends PipelineError {
  constructor(message, code, context = {}, retryAfterMs = 5000) {
    super(message, code, 'TRANSIENT', context);
    this.retryable = true;
    this.retryAfterMs = retryAfterMs;
    this.severity = 'warning';
  }
}

/**
 * Permanent errors that should not be retried
 */
export class PermanentError extends PipelineError {
  constructor(message, code, context = {}) {
    super(message, code, 'PERMANENT', context);
    this.retryable = false;
    this.severity = 'error';
  }
}

/**
 * Rate limit errors with specific retry timing
 */
export class RateLimitError extends TransientError {
  constructor(message, retryAfterMs, context = {}) {
    super(message, 'RATE_LIMIT', context, retryAfterMs);
    this.category = 'RATE_LIMIT';
  }
}

/**
 * Data validation errors
 */
export class ValidationError extends PermanentError {
  constructor(message, context = {}) {
    super(message, 'VALIDATION_ERROR', context);
    this.category = 'VALIDATION';
    this.severity = 'warning';
  }
}

/**
 * Database connection or query errors
 */
export class DatabaseError extends TransientError {
  constructor(message, context = {}, retryable = true) {
    // Check for non-retryable conditions first
    const isDuplicateKey = context.code === '23505' || // PostgreSQL duplicate key
                          context.code === '23000' || // MySQL duplicate key 
                          context.code === 'ER_DUP_ENTRY' || // MySQL variant
                          message.toLowerCase().includes('duplicate key') ||
                          message.toLowerCase().includes('unique constraint') ||
                          message.toLowerCase().includes('violates unique_constraint');
    
    const isConnectionIssue = context.code === 'ECONNREFUSED' ||
                             context.code === 'ENOTFOUND' ||
                             context.code === 'ETIMEDOUT' ||
                             message.toLowerCase().includes('connection refused') ||
                             message.toLowerCase().includes('connection timeout');
    
    // Connection issues are transient, constraint violations are not
    const shouldRetry = !isDuplicateKey && (isConnectionIssue || retryable);
    
    super(message, 'DATABASE_ERROR', context);
    this.category = 'DATABASE';
    this.retryable = shouldRetry;
    this.severity = isDuplicateKey ? 'warning' : (isConnectionIssue ? 'error' : 'error');
    
    // Add specific error classification
    if (isDuplicateKey) {
      this.subCategory = 'CONSTRAINT_VIOLATION';
    } else if (isConnectionIssue) {
      this.subCategory = 'CONNECTION_ERROR';
    }
  }
}

/**
 * API communication errors
 */
export class ApiError extends TransientError {
  constructor(message, statusCode, context = {}) {
    const retryable = statusCode >= 500 || statusCode === 429;
    super(message, `API_ERROR_${statusCode}`, context);
    this.category = 'API';
    this.statusCode = statusCode;
    this.retryable = retryable;
    
    // 4xx errors (except 429) are usually permanent
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
      this.retryable = false;
      this.severity = 'error';
    }
  }
}

/**
 * LLM/AI service errors
 */
export class AIServiceError extends TransientError {
  constructor(message, context = {}) {
    super(message, 'AI_SERVICE_ERROR', context);
    this.category = 'AI_SERVICE';
    // Most AI errors are transient (model overload, temporary unavailability)
    this.retryAfterMs = 10000; // Wait longer for AI services
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends TransientError {
  constructor(message, operation, timeoutMs, context = {}) {
    super(message, 'TIMEOUT', { ...context, operation, timeoutMs });
    this.category = 'TIMEOUT';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends PermanentError {
  constructor(message, context = {}) {
    super(message, 'CONFIG_ERROR', context);
    this.category = 'CONFIGURATION';
    this.severity = 'critical';
  }
}

/**
 * Error classification utility
 */
export function classifyError(error) {
  // Already classified
  if (error instanceof PipelineError) {
    return error;
  }

  const message = error.message || String(error);
  const errorStr = message.toLowerCase();

  // Database errors - improved detection logic
  if ((error.code && (error.code.startsWith('P') || error.code.startsWith('23') || error.code === '23505' || error.code === '23000')) || 
      error.code === 'ECONNREFUSED' || 
      error.code === 'ER_DUP_ENTRY' ||
      errorStr.includes('duplicate key') ||
      errorStr.includes('unique constraint') ||
      errorStr.includes('violates unique_constraint')) {
    return new DatabaseError(message, { originalError: error });
  }

  // Rate limiting
  if (errorStr.includes('rate limit') || errorStr.includes('too many requests')) {
    const retryAfter = error.retryAfter || 60000;
    return new RateLimitError(message, retryAfter, { originalError: error });
  }

  // Timeout
  if (errorStr.includes('timeout') || error.code === 'ETIMEDOUT') {
    return new TimeoutError(message, 'unknown', null, { originalError: error });
  }

  // API errors
  if (error.response && error.response.status) {
    return new ApiError(message, error.response.status, { 
      originalError: error,
      response: error.response.data 
    });
  }

  // AI/LLM errors
  if (errorStr.includes('anthropic') || errorStr.includes('claude') || 
      errorStr.includes('model') || errorStr.includes('token')) {
    return new AIServiceError(message, { originalError: error });
  }

  // Validation
  if (errorStr.includes('invalid') || errorStr.includes('validation') || 
      errorStr.includes('required')) {
    return new ValidationError(message, { originalError: error });
  }

  // Network errors are usually transient
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || 
      error.code === 'EPIPE') {
    return new TransientError(message, error.code, { originalError: error });
  }

  // Default to permanent error for unknown cases
  return new PermanentError(message, 'UNKNOWN', { originalError: error });
}

/**
 * Retry policy configuration
 */
export const RetryPolicy = {
  DEFAULT: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterMs: 500
  },
  AGGRESSIVE: {
    maxAttempts: 5,
    initialDelayMs: 500,
    maxDelayMs: 60000,
    backoffMultiplier: 1.5,
    jitterMs: 1000
  },
  CONSERVATIVE: {
    maxAttempts: 2,
    initialDelayMs: 5000,
    maxDelayMs: 30000,
    backoffMultiplier: 3,
    jitterMs: 0
  },
  NO_RETRY: {
    maxAttempts: 1,
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitterMs: 0
  }
};

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(attempt, policy = RetryPolicy.DEFAULT) {
  if (attempt >= policy.maxAttempts) {
    return null; // No more retries
  }

  // Cap exponent to prevent overflow (2^20 = ~1 million, reasonable upper bound)
  const exponent = Math.min(attempt - 1, 20);
  const baseDelay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, exponent);
  const delay = Math.min(baseDelay, policy.maxDelayMs);
  const jitter = policy.jitterMs ? (Math.random() - 0.5) * policy.jitterMs : 0;
  
  return Math.max(0, delay + jitter);
}

/**
 * Error recovery suggestions based on error type
 */
export function getRecoverySuggestion(error) {
  const classified = error instanceof PipelineError ? error : classifyError(error);
  
  switch (classified.category) {
    case 'TRANSIENT':
      return 'This is a temporary error. The system will automatically retry.';
    case 'RATE_LIMIT':
      return `Rate limit reached. Waiting ${classified.retryAfterMs}ms before retry.`;
    case 'DATABASE':
      return classified.retryable 
        ? 'Database connection issue. Retrying with backoff.'
        : 'Database constraint violation. Check data integrity.';
    case 'API':
      return classified.retryable
        ? 'External API error. Will retry automatically.'
        : 'API request failed. Check API credentials and request format.';
    case 'TIMEOUT':
      return 'Operation timed out. Consider increasing timeout or optimizing the operation.';
    case 'VALIDATION':
      return 'Data validation failed. Review and correct the input data.';
    case 'CONFIGURATION':
      return 'Configuration error. Check environment variables and settings.';
    case 'AI_SERVICE':
      return 'AI service temporarily unavailable. Will retry with longer delay.';
    default:
      return 'An unexpected error occurred. Manual intervention may be required.';
  }
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error, includeStack = false) {
  const classified = error instanceof PipelineError ? error : classifyError(error);
  
  const log = {
    timestamp: classified.timestamp,
    severity: classified.severity,
    category: classified.category,
    code: classified.code,
    message: classified.message,
    retryable: classified.retryable,
    suggestion: getRecoverySuggestion(classified)
  };

  if (classified.context && Object.keys(classified.context).length > 0) {
    log.context = classified.context;
  }

  if (includeStack && classified.stack) {
    log.stack = classified.stack;
  }

  return log;
}