import { RunManager } from './runManager';
import { sourceManagerAgent } from '@/app/lib/agents/sourceManagerAgent';
import { apiHandlerAgent } from '@/app/lib/agents/apiHandlerAgent';
import { processDetailedInfo } from '@/app/lib/agents/detailProcessorAgent';
import { processUnprocessedOpportunities } from '@/app/lib/agents/dataProcessorAgent';
import { createSupabaseClient, logApiActivity } from '@/app/lib/supabase';

/**
 * Coordinates the complete processing pipeline for an API source
 * @param {string} sourceId - Optional specific source ID to process
 * @param {string} runId - Optional existing run ID to use
 * @returns {Promise<Object>} - The complete processing results
 */
export async function processApiSource(sourceId = null, runId = null) {
	const startTime = Date.now();
	const supabase = createSupabaseClient();
	let runManager = null;

	try {
		console.log(
			`Starting processApiSource with sourceId: ${sourceId}, runId: ${runId}`
		);

		// Step 1: Get the next source to process (or use the provided sourceId)
		let sourceResult;
		if (sourceId) {
			// Get the specific source
			console.log(`Fetching source with ID: ${sourceId}`);
			const { data: source, error } = await supabase
				.from('api_sources')
				.select('*')
				.eq('id', sourceId)
				.single();

			if (error) {
				console.error(`Error fetching source: ${error.message}`);
				throw error;
			}

			// Create or use existing run manager
			runManager = new RunManager(runId);
			if (!runId) {
				console.log(`Creating new run for source: ${sourceId}`);
				await runManager.startRun(source.id);
				console.log(`Created run with ID: ${runManager.runId}`);
			} else {
				console.log(`Using existing run with ID: ${runId}`);
			}

			// Update source manager status to processing
			await runManager.updateStageStatus('source_manager_status', 'processing');

			// Process the source with the Source Manager Agent
			console.log(
				`Running sourceManagerAgent for source: ${source.name} (${source.id})`
			);
			console.time('sourceManagerAgent');
			const processingDetails = await sourceManagerAgent(source, runManager);
			console.timeEnd('sourceManagerAgent');
			console.log(
				`sourceManagerAgent completed with result:`,
				processingDetails
			);

			sourceResult = {
				source,
				processingDetails,
				runManager,
			};
		} else {
			// Get the next source from the queue
			console.log('Getting next source from queue');
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
		console.log(
			`Processing source with API Handler: ${source.name} (${source.id})`
		);
		await runManager.updateStageStatus('api_handler_status', 'processing');
		console.time('apiHandlerAgent');
		const handlerResult = await apiHandlerAgent(
			source,
			processingDetails,
			runManager
		);
		console.timeEnd('apiHandlerAgent');
		console.log(
			`API Handler completed with ${handlerResult.opportunities.length} opportunities`
		);

		// Step 3: Process the opportunities with the Detail Processor Agent
		console.log(
			`Processing ${handlerResult.opportunities.length} opportunities with Detail Processor`
		);
		await runManager.updateStageStatus('detail_processor_status', 'processing');
		console.time('processDetailedInfo');
		const detailResult = await processDetailedInfo(
			handlerResult.opportunities,
			source,
			runManager
		);
		console.timeEnd('processDetailedInfo');
		console.log(
			`Detail Processor completed with ${detailResult.opportunities.length} filtered opportunities`
		);

		// Step 4: Process the filtered opportunities with the Data Processor Agent
		console.log(
			`Processing ${detailResult.opportunities.length} filtered opportunities with Data Processor`
		);
		await runManager.updateStageStatus('data_processor_status', 'processing');
		console.time('processUnprocessedOpportunities');
		const storageResult = await processUnprocessedOpportunities(
			source.id,
			handlerResult.rawApiResponse,
			handlerResult.requestDetails,
			runManager
		);
		console.timeEnd('processUnprocessedOpportunities');
		console.log(
			`Data Processor completed with ${storageResult.metrics.storedCount} stored opportunities`
		);

		// Calculate total execution time
		const executionTime = Date.now() - startTime;
		console.log(`Total execution time: ${executionTime}ms`);

		// Complete the run
		await runManager.completeRun(executionTime);
		console.log(`Run completed successfully: ${runManager.runId}`);

		// Log the successful processing
		await logApiActivity(
			supabase,
			source.id,
			'complete_processing',
			'success',
			{
				initialCount: handlerResult.initialApiMetrics.totalHitCount,
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
			console.log(
				`Updated run ${runManager.runId} with error: ${error.message}`
			);
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
			stack: error.stack,
		};
	}
}

/**
 * Processes all active API sources
 * @param {number} limit - Maximum number of sources to process
 * @returns {Promise<Object>} - The processing results
 */
export async function processAllActiveSources(limit = 5) {
	console.log(`Processing up to ${limit} active sources`);
	const results = {
		processed: [],
		errors: [],
		total: 0,
	};

	for (let i = 0; i < limit; i++) {
		console.log(`Processing source ${i + 1} of ${limit}`);
		const result = await processApiSource();

		if (result.status === 'no_sources') {
			console.log('No more sources to process');
			break;
		}

		results.total++;

		if (result.status === 'success') {
			console.log(`Successfully processed source: ${result.source.name}`);
			results.processed.push(result);
		} else {
			console.error(`Error processing source: ${result.error}`);
			results.errors.push(result);
		}
	}

	console.log(`Completed processing ${results.total} sources`);
	console.log(
		`Success: ${results.processed.length}, Errors: ${results.errors.length}`
	);

	return results;
}
