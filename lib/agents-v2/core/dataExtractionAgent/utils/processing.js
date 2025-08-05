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
 * Process chunks in parallel with controlled concurrency using semaphore-style control
 */
export async function processChunksInParallel(chunks, processFunction, maxConcurrency = 1) {
  console.log(`[ProcessChunksInParallel] 🚀 Starting parallel processing of ${chunks.length} chunks with concurrency ${maxConcurrency}`);
  
  if (maxConcurrency === 1) {
    // Sequential processing
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const result = await processFunction(chunks[i], i);
      results.push(result);
    }
    return results;
  } else {
    // Semaphore-controlled parallel processing to prevent API rate limiting
    let runningTasks = 0;
    let currentIndex = 0;
    let completedTasks = 0; // Track completed tasks properly
    const resultArray = new Array(chunks.length);
    
    return new Promise((resolve, reject) => {
      console.log(`[ProcessChunksInParallel] 📊 Queuing ${chunks.length} chunks for parallel processing`);
      
      function processNext() {
        while (runningTasks < maxConcurrency && currentIndex < chunks.length) {
          const index = currentIndex++;
          runningTasks++;
          
          processFunction(chunks[index], index)
            .then(result => {
              resultArray[index] = result;
              runningTasks--;
              completedTasks++; // Increment completed counter
              
              console.log(`[ProcessChunksInParallel] ✅ Chunk ${index + 1}/${chunks.length} completed (${completedTasks} total completed, ${runningTasks} still running)`);
              
              // Check if all chunks are complete
              if (completedTasks === chunks.length) {
                console.log(`[ProcessChunksInParallel] 🎉 All ${chunks.length} chunks completed successfully!`);
                resolve(resultArray);
              } else {
                processNext(); // Start next task if available
              }
            })
            .catch(error => {
              console.error(`[ProcessChunksInParallel] ❌ Error in chunk ${index}:`, error);
              // Store error result instead of failing entire batch
              resultArray[index] = {
                success: false,
                error: error.message,
                data: { opportunities: [], challenges: [] }
              };
              runningTasks--;
              completedTasks++; // Count errors as completed too
              
              console.log(`[ProcessChunksInParallel] ⚠️  Chunk ${index + 1}/${chunks.length} failed (${completedTasks} total completed, ${runningTasks} still running)`);
              
              // Continue processing even after errors
              if (completedTasks === chunks.length) {
                console.log(`[ProcessChunksInParallel] 🎉 All ${chunks.length} chunks processed (with some errors)`);
                resolve(resultArray);
              } else {
                processNext();
              }
            });
        }
      }
      
      processNext();
    });
  }
} 