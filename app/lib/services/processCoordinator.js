import { RunManager } from './runManager';
import { processNextSource } from '../agents/sourceManagerAgent';
import { apiHandlerAgent } from '../agents/apiHandlerAgent';
import { processDetailedInfo } from '../agents/detailProcessorAgent';
import { processUnprocessedOpportunities } from '../agents/dataProcessorAgent';
import { createSupabaseClient, logApiActivity } from '../supabase';

/**
 * Coordinates the complete processing pipeline for an API source
 * @param {string} sourceId - Optional specific source ID to process
 * @returns {Promise<Object>} - The complete processing results
 */
export async function processApiSource(sourceId = null) {
	const startTime = Date.now();
	const supabase = createSupabaseClient();
	let runManager = null;

	try {
		// Step 1: Get the next source to process (or use the provided sourceId)
		let sourceResult;
		if (sourceId) {
			// Get the specific source
			const { data: source, error } = await supabase
				.from('api_sources')
				.select('*')
				.eq('id', sourceId)
				.single();

			if (error) throw error;

			// Create a new run manager
			runManager = new RunManager();
			await runManager.startRun(source.id);

			// Process the source with the Source Manager Agent
			const processingDetails = await sourceManagerAgent(source, runManager);

			sourceResult = {
				source,
				processingDetails,
				runManager,
			};
		} else {
			// Get the next source from the queue
			sourceResult = await processNextSource();

			if (!sourceResult) {
				console.log('No sources to process');
				return {
					status: 'no_sources',
					message: 'No sources available to process',
				};
			}

			runManager = sourceResult.runManager;
		}

		const { source, processingDetails } = sourceResult;

		// Step 2: Process the source with the API Handler Agent
		console.log(`Processing source: ${source.name} (${source.id})`);
		const handlerResult = await apiHandlerAgent(
			source,
			processingDetails,
			runManager
		);

		// Step 3: Process the opportunities with the Detail Processor Agent
		console.log(
			`Processing ${handlerResult.opportunities.length} opportunities with Detail Processor`
		);
		const detailResult = await processDetailedInfo(
			handlerResult.opportunities,
			source,
			runManager
		);

		// Step 4: Process the filtered opportunities with the Data Processor Agent
		console.log(
			`Processing ${detailResult.opportunities.length} filtered opportunities with Data Processor`
		);
		const storageResult = await processUnprocessedOpportunities(
			source.id,
			runManager
		);

		// Calculate total execution time
		const executionTime = Date.now() - startTime;

		// Complete the run
		await runManager.completeRun(executionTime);

		// Log the successful processing
		await logApiActivity(
			supabase,
			source.id,
			'complete_processing',
			'success',
			{
				initialCount: handlerResult.totalCount,
				firstStageCount: handlerResult.opportunities.length,
				secondStageCount: detailResult.opportunities.length,
				storedCount: storageResult.metrics.storedCount,
				updatedCount: storageResult.metrics.updatedCount,
				skippedCount: storageResult.metrics.skippedCount,
				executionTime,
			}
		);

		// Return the complete results
		return {
			status: 'success',
			source: {
				id: source.id,
				name: source.name,
			},
			metrics: {
				initialApiMetrics: handlerResult.initialApiMetrics,
				firstStageMetrics: handlerResult.firstStageMetrics,
				detailApiMetrics: handlerResult.detailApiMetrics,
				secondStageMetrics: detailResult.processingMetrics,
				storageMetrics: storageResult.metrics,
				totalExecutionTime: executionTime,
			},
			runId: runManager.runId,
		};
	} catch (error) {
		console.error('Error in process coordinator:', error);

		// Update run with error if runManager exists
		if (runManager) {
			await runManager.updateRunError(error);
		}

		// Log the error
		if (sourceId) {
			await logApiActivity(
				supabase,
				sourceId,
				'complete_processing',
				'failure',
				{
					error: String(error),
				}
			);
		}

		return {
			status: 'error',
			message: 'Error processing API source',
			error: String(error),
		};
	}
}

/**
 * Processes all active API sources
 * @param {number} limit - Maximum number of sources to process
 * @returns {Promise<Object>} - The processing results
 */
export async function processAllActiveSources(limit = 5) {
	const results = {
		processed: [],
		errors: [],
		total: 0,
	};

	for (let i = 0; i < limit; i++) {
		const result = await processApiSource();

		if (result.status === 'no_sources') {
			break;
		}

		results.total++;

		if (result.status === 'success') {
			results.processed.push(result);
		} else {
			results.errors.push(result);
		}
	}

	return results;
}
