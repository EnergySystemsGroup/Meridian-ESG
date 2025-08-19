/**
 * Centralized logging utility for consistent log levels and formatting
 */

export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

class Logger {
  constructor(component = 'System') {
    this.component = component;
    this.logLevel = process.env.LOG_LEVEL ? 
      LogLevel[process.env.LOG_LEVEL.toUpperCase()] || LogLevel.INFO : 
      LogLevel.INFO;
  }

  /**
   * Log error messages
   */
  error(message, error = null, metadata = {}) {
    if (this.logLevel >= LogLevel.ERROR) {
      const prefix = `[${this.component}] ❌`;
      if (error) {
        console.error(prefix, message, error.message || error, metadata);
        if (error.stack && this.logLevel >= LogLevel.DEBUG) {
          console.error('Stack trace:', error.stack);
        }
      } else {
        console.error(prefix, message, metadata);
      }
    }
  }

  /**
   * Log warning messages
   */
  warn(message, metadata = {}) {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(`[${this.component}] ⚠️`, message, metadata);
    }
  }

  /**
   * Log info messages
   */
  info(message, metadata = {}) {
    if (this.logLevel >= LogLevel.INFO) {
      console.log(`[${this.component}] ✅`, message, metadata);
    }
  }

  /**
   * Log debug messages
   */
  debug(message, metadata = {}) {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(`[${this.component}] 🔍`, message, metadata);
    }
  }

  /**
   * Log trace messages (very detailed)
   */
  trace(message, metadata = {}) {
    if (this.logLevel >= LogLevel.TRACE) {
      console.log(`[${this.component}] 📝`, message, metadata);
    }
  }

  /**
   * Log performance metrics
   */
  perf(operation, duration, metadata = {}) {
    if (this.logLevel >= LogLevel.INFO) {
      console.log(`[${this.component}] ⏱️`, `${operation} completed in ${duration}ms`, metadata);
    }
  }

  /**
   * Create a child logger with a sub-component name
   */
  child(subComponent) {
    return new Logger(`${this.component}:${subComponent}`);
  }
}

/**
 * Factory function to create a logger for a component
 */
export function createLogger(component) {
  return new Logger(component);
}

// Export default logger for general use
export const logger = new Logger('DataExtractionAgent');