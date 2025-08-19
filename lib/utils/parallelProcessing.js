/**
 * Processes chunks in parallel with controlled concurrency
 * @param {Array} chunks - Array of chunks to process
 * @param {Function} processChunk - Async function to process a single chunk
 * @param {number} maxConcurrent - Maximum number of concurrent processes
 * @returns {Promise<Array>} - Array of processed results
 */
export async function processChunksInParallel(
	chunks,
	processChunk,
	maxConcurrent = 10
) {
	const results = [];

	// Process chunks in batches of maxConcurrent
	for (let i = 0; i < chunks.length; i += maxConcurrent) {
		const batchEndIndex = Math.min(i + maxConcurrent, chunks.length);
		console.log(
			`Processing chunks ${i + 1}-${batchEndIndex} of ${
				chunks.length
			} in parallel`
		);

		// Create an array of promises for concurrent processing
		const promises = [];
		for (let j = i; j < batchEndIndex; j++) {
			const chunk = chunks[j];
			promises.push(processChunk(chunk, j));
		}

		// Wait for all promises in this batch to resolve
		const batchResults = await Promise.all(promises);
		results.push(...batchResults);
	}

	return results;
}
