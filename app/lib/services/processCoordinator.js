import { RunManager } from './runManager';
import { sourceManagerAgent } from '@/app/lib/agents/sourceManagerAgent';
import { apiHandlerAgent } from '@/app/lib/agents/apiHandlerAgent';
import { processDetailedInfo } from '@/app/lib/agents/detailProcessorAgent';
import { processOpportunitiesBatch } from '@/app/lib/agents/dataProcessorAgent';
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

			if (!source) {
				console.error(`No source found with ID: ${sourceId}`);
				throw new Error(`No source found with ID: ${sourceId}`);
			}

			if (error) {
				console.error(`Error fetching source: ${error.message}`);
				throw error;
			}

			// Fetch the configurations for this source
			console.log(`Fetching configurations for source: ${sourceId}`);
			const { data: configData, error: configError } = await supabase
				.from('api_source_configurations')
				.select('*')
				.eq('source_id', sourceId);

			if (configError) {
				console.error(`Error fetching configurations: ${configError.message}`);
				throw configError;
			}

			// Group configurations by type
			const configurations = {};
			configData.forEach((config) => {
				configurations[config.config_type] = config.configuration;
			});

			// Add configurations to the source
			source.configurations = configurations;

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

		// Check if detail processing is enabled for this source
		const isDetailEnabled = processingDetails.detailConfig?.enabled;
		let detailResult = {
			opportunities: handlerResult.opportunities,
			processingMetrics: null,
		};

		if (isDetailEnabled) {
			// Step 3: Process the opportunities with the Detail Processor Agent
			console.log(
				`Processing ${handlerResult.opportunities.length} opportunities with Detail Processor`
			);
			await runManager.updateStageStatus(
				'detail_processor_status',
				'processing'
			);
			console.time('processDetailedInfo');
			detailResult = await processDetailedInfo(
				handlerResult.opportunities,
				source,
				runManager
			);
			console.timeEnd('processDetailedInfo');
			console.log(
				`Detail Processor completed with ${detailResult.opportunities.length} filtered opportunities`
			);
		} else {
			console.log(
				'Detail processing is disabled for this source, skipping detail processor'
			);
			await runManager.updateStageStatus('detail_processor_status', 'skipped');
		}

		// Step 4: Process the filtered opportunities with the Data Processor Agent
		console.log(
			`Processing ${detailResult.opportunities.length} filtered opportunities with Data Processor`
		);
		await runManager.updateStageStatus('data_processor_status', 'processing');
		console.time('processOpportunitiesBatch');

		// Create a map of opportunity IDs to their raw response IDs
		const rawResponseIdMap = new Map();

		console.log(
			'Debug - handlerResult.rawResponseIds:',
			handlerResult.rawResponseIds
		);
		console.log(
			'Debug - handlerResult.singleRawResponseId:',
			handlerResult.singleRawResponseId
		);

		if (
			handlerResult.rawResponseIds &&
			handlerResult.rawResponseIds.length > 0
		) {
			// Use the new rawResponseIds array which maps each opportunity to its raw response
			handlerResult.rawResponseIds.forEach((item) => {
				if (item.itemId && item.rawResponseId) {
					// Convert itemId to string to ensure consistent format
					const itemIdString = String(item.itemId);
					rawResponseIdMap.set(itemIdString, item.rawResponseId);
					console.log(
						`Debug - Mapping opportunity ID ${itemIdString} to raw response ID ${item.rawResponseId}`
					);
				}
			});

			console.log(
				`Created raw response ID map for ${rawResponseIdMap.size} opportunities`
			);
		} else if (handlerResult.singleRawResponseId) {
			// Fallback to the legacy single rawResponseId for all opportunities
			console.log(
				`Using single raw response ID for all opportunities: ${handlerResult.singleRawResponseId}`
			);
		}

		// For each opportunity, find its corresponding raw response ID
		const opportunitiesWithRawIds = detailResult.opportunities.map(
			(opportunity) => {
				// Ensure opportunity.id is converted to string for consistent matching
				const opportunityIdString = opportunity.id
					? String(opportunity.id)
					: null;
				const rawResponseId = opportunityIdString
					? rawResponseIdMap.get(opportunityIdString) ||
					  handlerResult.singleRawResponseId
					: handlerResult.singleRawResponseId;

				console.log(
					`Debug - Opportunity ID ${opportunityIdString} mapped to raw response ID ${rawResponseId}`
				);

				return {
					opportunity,
					rawResponseId,
				};
			}
		);

		// Log the first few opportunities with their raw IDs
		console.log(
			'Debug - First 3 opportunitiesWithRawIds:',
			opportunitiesWithRawIds.slice(0, 3).map((o) => ({
				id: o.opportunity.id,
				title: o.opportunity.title,
				rawResponseId: o.rawResponseId,
			}))
		);

		// Process the opportunities with their specific raw response IDs
		const storageResult = await processOpportunitiesBatch(
			opportunitiesWithRawIds,
			source.id,
			handlerResult.singleRawResponseId, // For backwards compatibility
			runManager
		);
		console.timeEnd('processOpportunitiesBatch');
		console.log(
			`Data Processor completed with ${storageResult.metrics.new} new opportunities and ${storageResult.metrics.updated} updated opportunities`
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
				secondStageCount: isDetailEnabled
					? detailResult.opportunities.length
					: handlerResult.opportunities.length,
				newCount: storageResult.metrics.new,
				updatedCount: storageResult.metrics.updated,
				ignoredCount: storageResult.metrics.ignored,
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
				detailApiMetrics: isDetailEnabled
					? handlerResult.detailApiMetrics
					: null,
				secondStageMetrics: isDetailEnabled
					? detailResult.processingMetrics
					: null,
				storageMetrics: {
					new: storageResult.metrics.new,
					updated: storageResult.metrics.updated,
					ignored: storageResult.metrics.ignored,
					total: storageResult.metrics.total,
					processingTime: storageResult.metrics.processingTime,
				},
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
