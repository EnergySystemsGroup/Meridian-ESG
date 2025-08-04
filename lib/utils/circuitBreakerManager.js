/**
 * Circuit Breaker Manager for Pipeline Sources
 * 
 * Manages circuit breakers per source to prevent cascading failures
 * and protect external services from overload
 */

import { CircuitBreaker } from './retryHandler.js';

class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    this.globalSettings = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenRequests: 2
    };
  }

  /**
   * Get or create a circuit breaker for a source
   * @param {string} sourceId - The source identifier
   * @param {Object} options - Optional circuit breaker options
   * @returns {CircuitBreaker} - The circuit breaker for the source
   */
  getBreaker(sourceId, options = {}) {
    if (!this.breakers.has(sourceId)) {
      const breakerOptions = {
        ...this.globalSettings,
        ...options
      };
      
      const breaker = new CircuitBreaker(`source_${sourceId}`, breakerOptions);
      this.breakers.set(sourceId, breaker);
      
      console.log(`[CircuitBreakerManager] Created circuit breaker for source ${sourceId}`);
    }
    
    return this.breakers.get(sourceId);
  }

  /**
   * Get the state of all circuit breakers
   * @returns {Object} - Map of source IDs to breaker states
   */
  getAllStates() {
    const states = {};
    
    for (const [sourceId, breaker] of this.breakers) {
      states[sourceId] = breaker.getState();
    }
    
    return states;
  }

  /**
   * Check if a source is available (circuit not OPEN)
   * @param {string} sourceId - The source identifier
   * @returns {boolean} - True if source is available
   */
  isSourceAvailable(sourceId) {
    const breaker = this.breakers.get(sourceId);
    if (!breaker) return true; // No breaker means source hasn't failed yet
    
    const state = breaker.getState();
    return state.state !== 'OPEN' || Date.now() >= state.nextAttempt;
  }

  /**
   * Get sources that are currently unavailable
   * @returns {Array} - List of unavailable source IDs
   */
  getUnavailableSources() {
    const unavailable = [];
    
    for (const [sourceId, breaker] of this.breakers) {
      const state = breaker.getState();
      if (state.state === 'OPEN' && Date.now() < state.nextAttempt) {
        unavailable.push({
          sourceId,
          nextRetry: new Date(state.nextAttempt).toISOString(),
          failures: state.failures
        });
      }
    }
    
    return unavailable;
  }

  /**
   * Reset a specific source's circuit breaker
   * @param {string} sourceId - The source identifier
   */
  resetSource(sourceId) {
    const breaker = this.breakers.get(sourceId);
    if (breaker) {
      breaker.reset();
      console.log(`[CircuitBreakerManager] Reset circuit breaker for source ${sourceId}`);
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const [sourceId, breaker] of this.breakers) {
      breaker.reset();
    }
    console.log(`[CircuitBreakerManager] Reset all ${this.breakers.size} circuit breakers`);
  }

  /**
   * Update settings for all future circuit breakers
   * @param {Object} settings - New settings
   */
  updateGlobalSettings(settings) {
    this.globalSettings = {
      ...this.globalSettings,
      ...settings
    };
    console.log(`[CircuitBreakerManager] Updated global settings:`, this.globalSettings);
  }
}

// Singleton instance
const circuitBreakerManager = new CircuitBreakerManager();

export default circuitBreakerManager;