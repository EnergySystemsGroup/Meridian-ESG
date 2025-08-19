/**
 * Performance Optimizer Utility
 * Provides performance monitoring and optimization utilities
 */

/**
 * Memoization decorator for expensive functions
 */
export function memoize(fn, keyGenerator = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  const maxCacheSize = 100;
  
  return function(...args) {
    const key = keyGenerator(...args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn.apply(this, args);
    
    // LRU cache - remove oldest entries if cache is too large
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, result);
    return result;
  };
}

/**
 * Debounce function calls
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  
  return function(...args) {
    clearTimeout(timeoutId);
    
    return new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(fn.apply(this, args));
      }, delay);
    });
  };
}

/**
 * Throttle function calls
 */
export function throttle(fn, limit = 300) {
  let lastRun;
  let lastFunc;
  let lastRan;
  
  return function(...args) {
    const context = this;
    
    if (!lastRan) {
      fn.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if ((Date.now() - lastRan) >= limit) {
          fn.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Batch async operations for better performance
 */
export class BatchProcessor {
  constructor(processFn, batchSize = 10, delay = 100) {
    this.processFn = processFn;
    this.batchSize = batchSize;
    this.delay = delay;
    this.queue = [];
    this.processing = false;
  }
  
  async add(item) {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    
    // Take a batch from the queue
    const batch = this.queue.splice(0, this.batchSize);
    const items = batch.map(b => b.item);
    
    try {
      const results = await this.processFn(items);
      
      // Resolve individual promises
      batch.forEach((b, index) => {
        b.resolve(results[index]);
      });
    } catch (error) {
      // Reject all promises in the batch
      batch.forEach(b => {
        b.reject(error);
      });
    }
    
    // Add delay between batches
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), this.delay);
    } else {
      this.processing = false;
    }
  }
}

/**
 * Performance monitoring wrapper
 */
export function measurePerformance(name) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const start = performance.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - start;
        
        console.log(`[Performance] ${name || propertyKey} completed in ${duration.toFixed(2)}ms`);
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        console.error(`[Performance] ${name || propertyKey} failed after ${duration.toFixed(2)}ms`);
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Resource pool for managing limited resources
 */
export class ResourcePool {
  constructor(createResource, maxSize = 5) {
    this.createResource = createResource;
    this.maxSize = maxSize;
    this.available = [];
    this.inUse = new Set();
  }
  
  async acquire() {
    // If there's an available resource, use it
    if (this.available.length > 0) {
      const resource = this.available.pop();
      this.inUse.add(resource);
      return resource;
    }
    
    // If we haven't reached max size, create new resource
    if (this.inUse.size < this.maxSize) {
      const resource = await this.createResource();
      this.inUse.add(resource);
      return resource;
    }
    
    // Wait for a resource to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.available.length > 0) {
          clearInterval(checkInterval);
          const resource = this.available.pop();
          this.inUse.add(resource);
          resolve(resource);
        }
      }, 100);
    });
  }
  
  release(resource) {
    if (this.inUse.has(resource)) {
      this.inUse.delete(resource);
      this.available.push(resource);
    }
  }
  
  async destroy() {
    // Clean up all resources
    for (const resource of this.inUse) {
      if (resource.destroy) {
        await resource.destroy();
      }
    }
    
    for (const resource of this.available) {
      if (resource.destroy) {
        await resource.destroy();
      }
    }
    
    this.available = [];
    this.inUse.clear();
  }
}