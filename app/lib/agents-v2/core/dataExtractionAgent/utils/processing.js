/**
 * Processing Utilities
 * 
 * Functions for chunking data and managing parallel execution
 */

/**
 * Split data into chunks based on token threshold
 */
export function splitDataIntoChunks(data, tokenThreshold = 30000) {
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;
  
  for (const item of data) {
    const itemSize = JSON.stringify(item).length;
    
    // If adding this item would exceed threshold, start new chunk
    if (currentSize + itemSize > tokenThreshold && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [item];
      currentSize = itemSize;
    } else {
      currentChunk.push(item);
      currentSize += itemSize;
    }
  }
  
  // Add final chunk if it has items
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Process chunks in parallel with controlled concurrency
 */
export async function processChunksInParallel(chunks, processFunction, maxConcurrency = 1) {
  const results = [];
  
  if (maxConcurrency === 1) {
    // Sequential processing
    for (let i = 0; i < chunks.length; i++) {
      const result = await processFunction(chunks[i], i);
      results.push(result);
    }
  } else {
    // Parallel processing with concurrency limit
    const processingPromises = chunks.map((chunk, index) => 
      processFunction(chunk, index)
    );
    
    // Process in batches based on maxConcurrency
    for (let i = 0; i < processingPromises.length; i += maxConcurrency) {
      const batch = processingPromises.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }
  }
  
  return results;
} 