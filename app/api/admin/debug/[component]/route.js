import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/api';
import { sourceManagerAgent } from '@/lib/agents/sourceManagerAgent';
import { apiHandlerAgent } from '@/lib/agents/apiHandlerAgent';
import { processDetailedInfo } from '@/lib/agents/detailProcessorAgent';
import { processOpportunitiesBatch } from '@/lib/agents/dataProcessorAgent';
import { RunManager } from '@/lib/services/runManager';
import { processApiSource } from '@/lib/services/processCoordinator';
import { POST as processSourceRoute } from '@/app/api/admin/funding-sources/[id]/process/route';

// Start of Selection
/**
 * Debug controller for testing individual components of the API processing pipeline
 * POST /api/admin/debug/[component]
 *
 * Expected Input:
 * {
 *   sourceId: string, // The ID of the source to be processed
 *   runId?: string,   // Optional ID for the run manager
 *   skipLLM?: boolean // Optional flag to skip LLM processing
 * }
 */
export async function POST(request, { params }) {
	try {
		params = await params;
		const { component } = params;
		const body = await request.json();
		
		// Create Supabase client with secret key for admin operations
		const { supabase } = createAdminClient(request);

		console.log(`Debug request for component: ${component}`, body);

		// Common parameters
		const { sourceId, runId, skipLLM = false } = body;
		let result = null;
		let source = null;
		let runManager = null;

		// Get the source if sourceId is provided
		if (sourceId) {
			const { data, error } = await supabase
				.from('api_sources')
				.select('*')
				.eq('id', sourceId)
				.single();

			if (error) throw error;
			source = data;

			// Get the source configurations
			const { data: configurations, error: configError } = await supabase
				.from('api_source_configurations')
				.select('*')
				.eq('source_id', sourceId);

			if (configError) throw configError;

			// Format configurations as an object
			const configObject = {};
			configurations.forEach((config) => {
				configObject[config.config_type] = config.configuration;
			});

			// Add configurations to the source
			source.configurations = configObject;
		}

		// Create or use existing run manager
		if (runId) {
			runManager = new RunManager(runId);
		} else if (
			sourceId &&
			component !== 'initial-route' &&
			component !== 'run-manager'
		) {
			runManager = new RunManager();
			await runManager.startRun(sourceId);
		}

		// Process the requested component
		switch (component) {
			case 'initial-route':
				if (!sourceId) {
					throw new Error('Source ID is required for initial-route test');
				}

				// Create a new run manager to test just the initial part
				const newRunManager = new RunManager();
				const newRunId = await newRunManager.startRun(sourceId);

				// Get the run details
				const { data: runData, error: runError } = await supabase
					.from('api_source_runs')
					.select('*')
					.eq('id', newRunId)
					.single();

				if (runError) throw runError;

				// Immediately update the run to indicate it was a test
				await supabase
					.from('api_source_runs')
					.update({
						status: 'completed',
						completed_at: new Date().toISOString(),
						error_details: JSON.stringify({
							message: 'This was a test run from the debug interface',
							testOnly: true,
						}),
					})
					.eq('id', newRunId);

				// Return a response similar to what the actual route would return
				// Note: We're not updating the run status to completed, so it stays as "started"
				result = {
					success: true,
					message: 'Processing started',
					runId: newRunId,
					sourceId: sourceId,
					status: runData.status, // This should be "started"
					startedAt: runData.started_at,
				};
				break;

			case 'process-coordinator':
				// Test the processApiSource function
				if (!sourceId)
					throw new Error('Source ID is required for process-coordinator test');

				// Use the provided runId or create a new one
				const coordinatorResult = await processApiSource(sourceId, runId);

				result = coordinatorResult;
				break;

			case 'run-manager':
				// Test the RunManager
				if (!sourceId)
					throw new Error('Source ID is required for run-manager test');

				// Create a new run manager and test its methods
				const testRunManager = new RunManager();
				const testRunId = await testRunManager.startRun(sourceId);

				// Test updating different stages
				await testRunManager.updateInitialApiCall({
					totalHitCount: 100,
					apiCallCount: 4,
					totalItemsRetrieved: 50,
					firstPageCount: 25,
					totalPages: 4,
					sampleOpportunities: [],
					apiEndpoint: 'https://test-api.example.com',
					responseTime: 1500,
					apiCallTime: 1500,
				});

				await testRunManager.updateFirstStageFilter({
					inputCount: 50,
					passedCount: 30,
					processingTime: 2000,
					filterReasoning: 'Test filtering',
					sampleOpportunities: [],
				});

				await testRunManager.updateDetailApiCalls({
					opportunitiesRequiringDetails: 30,
					successfulDetailCalls: 28,
					failedDetailCalls: 2,
					totalDetailCallTime: 5000,
					averageDetailResponseTime: 178,
					detailCallErrors: [],
				});

				await testRunManager.updateSecondStageFilter({
					inputCount: 28,
					passedCount: 20,
					rejectedCount: 8,
					processingTime: 3000,
					filterReasoning: 'Test second stage filtering',
					rejectionReasons: ['Low relevance', 'Out of scope'],
					sampleOpportunities: [],
					averageScoreAfterFiltering: 8.5,
				});

				await testRunManager.updateStorageResults({
					attemptedCount: 20,
					storedCount: 15,
					updatedCount: 3,
					skippedCount: 2,
					processingTime: 1000,
				});

				// Get the final run state
				const { data: finalRunData, error: finalRunError } = await supabase
					.from('api_source_runs')
					.select('*')
					.eq('id', testRunId)
					.single();

				if (finalRunError) throw finalRunError;

				result = {
					runId: testRunId,
					runData: finalRunData,
					message: 'Run manager test completed successfully',
				};
				break;

			case 'source-manager':
				// Test sourceManagerAgent in isolation
				if (!source)
					throw new Error('Source ID is required for source-manager test');

				result = await sourceManagerAgent(source, runManager);
				break;

			case 'api-handler':
				// Test apiHandlerAgent in isolation
				if (!source)
					throw new Error('Source ID is required for api-handler test');

				const processingDetails =
					body.processingDetails ||
					(await sourceManagerAgent(source, runManager));

				result = await apiHandlerAgent(source, processingDetails, runManager);
				break;

			case 'detail-processor':
				// Test detailProcessorAgent in isolation
				if (!source)
					throw new Error('Source ID is required for detail-processor test');

				const opportunities = body.opportunities;
				console.log(
					`Detail processor received ${
						opportunities?.length || 0
					} opportunities`
				);
				if (
					!opportunities ||
					!Array.isArray(opportunities) ||
					opportunities.length === 0
				)
					throw new Error(
						'Opportunities are required for detail-processor test and must be a non-empty array'
					);

				console.log(
					'Running processDetailedInfo with opportunities and source...'
				);
				result = await processDetailedInfo(opportunities, source, runManager);
				console.log('processDetailedInfo completed successfully');
				break;

			case 'data-processor':
				// Test dataProcessorAgent in isolation
				if (!sourceId)
					throw new Error('Source ID is required for data-processor test');

				const { opportunities: dataProcessorOpportunities, rawResponseId } =
					body;

				if (
					!dataProcessorOpportunities ||
					!Array.isArray(dataProcessorOpportunities) ||
					dataProcessorOpportunities.length === 0
				)
					throw new Error(
						'Opportunities are required for data-processor test and must be a non-empty array'
					);

				if (!rawResponseId)
					throw new Error(
						'Raw response ID is required for data-processor test'
					);

				result = await processOpportunitiesBatch(
					dataProcessorOpportunities,
					sourceId,
					rawResponseId,
					runManager
				);
				break;

			case 'api-endpoint':
				// Test direct API call
				if (!body.endpoint) throw new Error('API endpoint is required');

				const {
					endpoint,
					method = 'GET',
					headers = {},
					queryParams = {},
					body: requestBody,
				} = body;

				// Construct URL with query parameters
				const url = new URL(endpoint);
				Object.entries(queryParams).forEach(([key, value]) => {
					url.searchParams.append(key, value);
				});

				// Make the API request
				const apiResponse = await fetch(url.toString(), {
					method,
					headers,
					...(method !== 'GET' && requestBody
						? { body: JSON.stringify(requestBody) }
						: {}),
				});

				const apiResponseData = await apiResponse.json();

				result = {
					status: apiResponse.status,
					statusText: apiResponse.statusText,
					headers: Object.fromEntries(apiResponse.headers.entries()),
					data: apiResponseData,
				};
				break;

			case 'db-schema':
				// Test database schema
				const tables = [
					'api_sources',
					'api_source_configurations',
					'api_source_runs',
					'funding_opportunities',
					'api_raw_responses',
				];

				const schemaResults = {};

				for (const table of tables) {
					const { data, error } = await supabase
						.from('information_schema.columns')
						.select('column_name, data_type, is_nullable')
						.eq('table_name', table);

					if (error) {
						schemaResults[table] = { error: error.message };
					} else {
						schemaResults[table] = data;
					}
				}

				result = schemaResults;
				break;

			default:
				return NextResponse.json(
					{ error: `Unknown component: ${component}` },
					{ status: 400 }
				);
		}

		return NextResponse.json({
			success: true,
			component,
			sourceId,
			runId: runManager?.runId || (result?.runId ? result.runId : null),
			result,
		});
	} catch (error) {
		let componentName = 'unknown';
		try {
			componentName = params.component;
		} catch (e) {
			// Ignore error if params.component is not available
		}

		console.error(`Error in debug controller (${componentName}):`, error);

		return NextResponse.json(
			{
				error: 'Debug operation failed',
				component: componentName,
				details: error.message,
				stack: error.stack,
			},
			{ status: 500 }
		);
	}
}
