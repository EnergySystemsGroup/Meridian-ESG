'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/app/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	CardFooter,
} from '@/app/components/ui/card';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@/app/components/ui/tabs';
import { toast } from 'sonner';

// Component descriptions and expected outputs
const componentInfo = {
	'initial-route': {
		title: 'Initial Route',
		description: 'Tests the API endpoint that starts the processing pipeline',
		functions: [
			'POST /api/admin/funding-sources/[id]/process',
			'RunManager.startRun()',
		],
		input: 'Source ID',
		expectedOutput: `{
  "success": true,
  "component": "initial-route",
  "sourceId": "source-id",
  "runId": "uuid-of-new-run",
  "result": {
    "success": true,
    "message": "Processing started",
    "runId": "uuid-of-new-run",
    "sourceId": "source-id",
    "status": "started",
    "startedAt": "timestamp"
  }
}`,
	},
	'process-coordinator': {
		title: 'Process Coordinator',
		description:
			'Orchestrates the entire processing pipeline, calling each agent in sequence',
		functions: [
			'processApiSource(sourceId, runId)',
			'processAllActiveSources(limit)',
		],
		input: 'Source ID, Optional Run ID',
		expectedOutput: `{
  "status": "success",
  "source": {
    "id": "source-id",
    "name": "Source Name"
  },
  "metrics": {
    "initialApiMetrics": { /* metrics from initial API call */ },
    "firstStageMetrics": { /* metrics from first stage filtering */ },
    "detailApiMetrics": { /* metrics from detail API calls */ },
    "secondStageMetrics": { /* metrics from second stage filtering */ },
    "storageMetrics": { /* metrics from storage operations */ },
    "totalExecutionTime": 12345
  },
  "runId": "uuid-of-run"
}`,
	},
	'run-manager': {
		title: 'Run Manager',
		description:
			'Manages the state of a processing run and tracks the status of each stage',
		functions: [
			'startRun(sourceId)',
			'updateInitialApiCall(stats)',
			'updateFirstStageFilter(stats)',
			'updateDetailApiCalls(stats)',
			'updateSecondStageFilter(stats)',
			'updateStorageResults(stats)',
			'completeRun(totalTime)',
			'updateRunError(error)',
			'updateStageStatus(stage, status)',
		],
		input: 'Source ID',
		expectedOutput: `{
  "runId": "uuid-of-test-run",
  "runData": {
    "id": "uuid-of-test-run",
    "source_id": "source-id",
    "status": "completed",
    "source_manager_status": "completed",
    "api_handler_status": "completed",
    "detail_processor_status": "completed",
    "data_processor_status": "completed",
    "initial_api_call": { /* stats */ },
    "first_stage_filter": { /* stats */ },
    "detail_api_calls": { /* stats */ },
    "second_stage_filter": { /* stats */ },
    "storage_results": { /* stats */ }
  },
  "message": "Run manager test completed successfully"
}`,
	},
	'source-manager': {
		title: 'Source Manager',
		description:
			'Determines how to process an API source and configures the API request',
		functions: [
			'sourceManagerAgent(source, runManager)',
			'getNextSourceToProcess()',
			'processNextSource()',
		],
		input: 'Source with configurations',
		expectedOutput: `{
  "apiEndpoint": "https://api.example.com/opportunities",
  "requestConfig": {
    "method": "GET",
    "headers": { /* headers */ }
  },
  "queryParameters": { /* query parameters */ },
  "requestBody": { /* request body */ },
  "paginationConfig": { /* pagination configuration */ },
  "firstStageFilterConfig": { /* first stage filter configuration */ },
  "detailConfig": { /* detail configuration */ },
  "secondStageFilterConfig": { /* second stage filter configuration */ },
  "responseMapping": { /* response mapping */ },
  "authMethod": "apikey",
  "authDetails": { /* authentication details */ },
  "handlerType": "standard",
  "reasoning": "Explanation of choices"
}`,
	},
	'api-handler': {
		title: 'API Handler',
		description:
			'Makes API requests, handles pagination, and performs first-stage filtering',
		functions: [
			'apiHandlerAgent(source, processingDetails, runManager)',
			'processPaginatedApi(source, processingDetails, runManager)',
			'performFirstStageFiltering(apiResults, source, processingDetails, runManager)',
			'fetchDetailedInformation(filteredItems, source, processingDetails, runManager)',
		],
		input: 'Source and processing details from Source Manager',
		expectedOutput: `{
  "success": true,
  "component": "api-handler",
  "sourceId": "example-source-id",
  "runId": "example-run-id",
  "result": {
    "firstStageMetrics": {
      "totalOpportunitiesAnalyzed": 100,
      "opportunitiesPassingFilter": 50,
      "rejectedCount": 50,
      "rejectionReasons": ["Low relevance", "Out of scope"],
      "averageScoreBeforeFiltering": 5.2,
      "averageScoreAfterFiltering": 7.8,
      "filteringTime": 15000,
      "filterReasoning": "Filtered based on relevance criteria",
      "chunkMetrics": [
        {
          "chunkIndex": 1,
          "processedOpportunities": 50,
          "passedCount": 25,
          "timeSeconds": "7.5"
        }
      ]
    },
    "opportunities": [ /* filtered opportunities */ ],
    "initialApiMetrics": {
      "totalHitCount": 500,
      "apiCallCount": 10,
      "totalItemsRetrieved": 100,
      "firstPageCount": 50,
      "totalPages": 10,
      "apiEndpoint": "https://api.example.com/opportunities",
      "responseTime": 1500
    },
    "detailApiMetrics": {
      "opportunitiesRequiringDetails": 50,
      "successfulDetailCalls": 48,
      "failedDetailCalls": 2,
      "totalDetailCallTime": 5000,
      "averageDetailResponseTime": 104
    },
    "rawApiResponse": { /* raw API response */ },
    "requestDetails": {
      "source": { /* source info */ },
      "processingDetails": { /* processing details */ }
    }
  }
}`,
	},
	'detail-processor': {
		title: 'Detail Processor',
		description:
			'Processes detailed opportunity information and performs second-stage filtering',
		functions: [
			'detailProcessorAgent(detailedOpportunities, source, runManager, config)',
			'processDetailedInfo(detailedOpportunities, source, runManager, config)',
		],
		input: 'Opportunities from API Handler',
		expectedOutput: `{
  "opportunities": [ /* filtered opportunities with details */ ],
  "filteredCount": 20,
  "processingMetrics": {
    "inputCount": 50,
    "passedCount": 30,
    "rejectedCount": 20,
    "rejectionReasons": [ /* reasons for rejection */ ],
    "averageScoreBeforeFiltering": 6.5,
    "averageScoreAfterFiltering": 8.2,
    "processingTime": 3000,
    "tokenUsage": 15000
  }
}`,
	},
	'data-processor': {
		title: 'Data Processor',
		description:
			'Stores filtered opportunities in the database, handling duplicates and updates',
		functions: [
			'processOpportunitiesBatch(opportunities, sourceId, rawResponseId, runManager)',
		],
		input: 'Array of Opportunities, Source ID, Raw Response ID',
		expectedOutput: `{
  "newOpportunities": [ /* array of newly inserted opportunities */ ],
  "updatedOpportunities": [ /* array of updated opportunities */ ],
  "ignoredOpportunities": [ /* array of unchanged/ignored opportunities */ ],
  "metrics": {
    "total": 30,
    "new": 25,
    "updated": 3,
    "ignored": 2,
    "processingTime": 2000
  }
}`,
	},
	'api-endpoint': {
		title: 'API Endpoint',
		description:
			'Makes a direct call to an API endpoint to test connectivity and response',
		functions: ['fetch(url, options)'],
		input: 'API Endpoint URL, Method, Headers, Query Parameters, Request Body',
		expectedOutput: `{
  "status": 200,
  "statusText": "OK",
  "headers": { /* response headers */ },
  "data": { /* response data */ }
}`,
	},
	'db-schema': {
		title: 'Database Schema',
		description: 'Examine the database schema for the API integration system.',
		functions: ['Retrieve table schemas from the database'],
		input: 'None',
		expectedOutput: `{
  "api_sources": [ /* column definitions */ ],
  "api_source_configurations": [ /* column definitions */ ],
  "api_source_runs": [ /* column definitions */ ],
  "funding_opportunities": [ /* column definitions */ ],
  "api_raw_responses": [ /* column definitions */ ]
}`,
	},
};

export default function DebugPage() {
	const supabase = createClientComponentClient();
	const [sources, setSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState(null);
	const [activeTab, setActiveTab] = useState('initial-route');
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState(null);
	const [loadingSources, setLoadingSources] = useState(true);
	const [apiHandlerResults, setApiHandlerResults] = useState(null);
	const [detailProcessorResults, setDetailProcessorResults] = useState(null);

	useEffect(() => {
		fetchSources();
	}, []);

	// Clear results when switching tabs
	useEffect(() => {
		setApiHandlerResults(null);
		setDetailProcessorResults(null);
	}, [activeTab]);

	async function fetchSources() {
		try {
			setLoadingSources(true);
			const { data, error } = await supabase
				.from('api_sources')
				.select('id, name, organization, type')
				.order('name');

			if (error) throw error;
			setSources(data || []);
		} catch (error) {
			console.error('Error fetching sources:', error);
			toast.error('Failed to load API sources');
		} finally {
			setLoadingSources(false);
		}
	}

	async function runDebugTest() {
		if (!selectedSource) {
			toast.error('Please select a source first');
			return;
		}

		setLoading(true);
		setResult(null);
		console.log(`Running debug test for ${activeTab}`);

		try {
			// Special handling for detail-processor
			if (activeTab === 'detail-processor') {
				// Step 1: Run API Handler if needed to get opportunities
				let opportunities = [];
				if (!apiHandlerResults) {
					console.log(
						'Step 1: Running API Handler first to get opportunities...'
					);
					toast.info('Running API Handler first to get opportunities...');

					const apiResponse = await fetch('/api/admin/debug/api-handler', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ sourceId: selectedSource }),
					});

					if (!apiResponse.ok) {
						const errorData = await apiResponse.json();
						throw new Error(errorData.error || 'API Handler test failed');
					}

					const apiData = await apiResponse.json();
					console.log('API Handler response:', apiData);

					// Get the actual opportunities from the API Handler response
					if (!apiData.result || !apiData.result.opportunities) {
						console.error(
							'API Handler response is missing the opportunities array:',
							apiData
						);
						throw new Error(
							'API Handler response is missing the opportunities array. Check console for details.'
						);
					}

					opportunities = apiData.result.opportunities;
					console.log('Opportunities from API Handler:', {
						count: opportunities.length,
						isArray: Array.isArray(opportunities),
						sample: opportunities.length > 0 ? opportunities[0] : 'none',
					});

					// Store these opportunities and rawResponseId for future use
					setApiHandlerResults({
						opportunities: [...opportunities],
						rawResponseId: apiData.result.rawResponseId,
					});

					console.log(
						'Saved apiHandlerResults with rawResponseId:',
						apiData.result.rawResponseId
					);

					toast.success(
						`API Handler completed with ${opportunities.length} opportunities, now running Detail Processor...`
					);
				} else {
					// Use existing apiHandlerResults
					console.log('Using existing API Handler results');

					// Debug the apiHandlerResults value
					console.log('Debug existing apiHandlerResults:', {
						type: typeof apiHandlerResults,
						keys: apiHandlerResults ? Object.keys(apiHandlerResults) : 'null',
						opportunitiesType: apiHandlerResults.opportunities
							? typeof apiHandlerResults.opportunities
							: 'null',
						opportunitiesIsArray: apiHandlerResults.opportunities
							? Array.isArray(apiHandlerResults.opportunities)
							: 'null',
						opportunitiesValue: apiHandlerResults.opportunities
							? JSON.stringify(apiHandlerResults.opportunities).substring(
									0,
									100
							  ) + '...'
							: 'null',
					});

					if (
						!apiHandlerResults.opportunities ||
						!Array.isArray(apiHandlerResults.opportunities)
					) {
						throw new Error(
							'Existing API Handler results do not contain a valid opportunities array.'
						);
					}

					opportunities = [...apiHandlerResults.opportunities];
				}

				// Step 2: Run Detail Processor with the opportunities
				console.log('Step 2: Running Detail Processor with opportunities...');

				const opportunitiesCount = opportunities.length;
				console.log(`Adding ${opportunitiesCount} opportunities to request`);

				if (opportunitiesCount === 0) {
					throw new Error(
						'No opportunities available to process. The Detail Processor requires at least one opportunity.'
					);
				}

				// Create request body for Detail Processor
				const detailProcessorRequest = {
					sourceId: selectedSource,
					opportunities: opportunities,
				};

				console.log('Sending request to detail-processor:', {
					sourceId: selectedSource,
					opportunitiesCount: opportunities.length,
					firstOpportunity: opportunities[0]
						? {
								id: opportunities[0].id,
								title: opportunities[0].title,
						  }
						: 'none',
				});

				const detailResponse = await fetch(
					'/api/admin/debug/detail-processor',
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(detailProcessorRequest),
					}
				);

				if (!detailResponse.ok) {
					const errorData = await detailResponse.json();
					throw new Error(errorData.error || 'Detail Processor test failed');
				}

				const detailData = await detailResponse.json();
				setResult(detailData);
				setDetailProcessorResults(detailData.result);
				toast.success('Detail Processor test completed successfully');
				setLoading(false);
				return;
			}

			// Special handling for data-processor
			if (activeTab === 'data-processor') {
				// Step 1: Get opportunities from Detail Processor or API Handler
				let opportunities = [];
				let rawResponseId;

				// First try to get from detail processor results
				if (
					detailProcessorResults &&
					detailProcessorResults.opportunities &&
					Array.isArray(detailProcessorResults.opportunities) &&
					detailProcessorResults.opportunities.length > 0
				) {
					opportunities = [...detailProcessorResults.opportunities];
					console.log(
						`Using ${opportunities.length} opportunities from Detail Processor results`
					);

					// Need to get a raw response ID - run API Handler if it doesn't exist
					if (!apiHandlerResults || !apiHandlerResults.rawResponseId) {
						console.log('Need to run API Handler to get a rawResponseId');
						const apiResponse = await fetch('/api/admin/debug/api-handler', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ sourceId: selectedSource }),
						});

						if (!apiResponse.ok) {
							const errorData = await apiResponse.json();
							throw new Error(errorData.error || 'API Handler test failed');
						}

						const apiData = await apiResponse.json();
						rawResponseId = apiData.result.rawResponseId;

						// Store results for future use
						setApiHandlerResults({
							...apiHandlerResults,
							rawResponseId,
						});
					} else {
						rawResponseId = apiHandlerResults.rawResponseId;
					}
				}
				// Otherwise use API Handler results
				else if (
					apiHandlerResults &&
					apiHandlerResults.opportunities &&
					Array.isArray(apiHandlerResults.opportunities) &&
					apiHandlerResults.opportunities.length > 0
				) {
					opportunities = [...apiHandlerResults.opportunities];
					rawResponseId = apiHandlerResults.rawResponseId;
					console.log(
						`Using ${opportunities.length} opportunities from API Handler results`
					);
				}

				// Neither Detail Processor nor API Handler results available
				else {
					throw new Error(
						'Data Processor testing requires running either API Handler or Detail Processor first to provide data'
					);
				}

				if (!opportunities || opportunities.length === 0) {
					throw new Error(
						'No opportunities available to process. The Data Processor requires at least one opportunity.'
					);
				}

				if (!rawResponseId) {
					console.warn(
						'No rawResponseId found, generating a mock ID for testing purposes'
					);
					// Generate a mock UUID for testing purposes
					rawResponseId = crypto.randomUUID
						? crypto.randomUUID()
						: 'test-' + Math.random().toString(36).substring(2, 15);

					console.log('Using mock rawResponseId:', rawResponseId);
				}

				// Log opportunity structure to help debug issues
				if (opportunities && opportunities.length > 0) {
					const sample = opportunities[0];
					console.log('Data Processor opportunity structure:', {
						keys: Object.keys(sample).join(', '),
						id: sample.id,
						title: sample.title?.substring(0, 30) + '...',
					});
				}

				// Step 2: Run Data Processor with the opportunities
				console.log(
					`Running Data Processor with ${opportunities.length} opportunities and rawResponseId: ${rawResponseId}`
				);

				const dataProcessorRequest = {
					sourceId: selectedSource,
					opportunities: opportunities,
					rawResponseId: rawResponseId,
				};

				console.log('Sending request to data-processor:', dataProcessorRequest);
				const dataResponse = await fetch('/api/admin/debug/data-processor', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(dataProcessorRequest),
				});

				if (!dataResponse.ok) {
					const errorData = await dataResponse.json();
					throw new Error(errorData.error || 'Data Processor test failed');
				}

				const dataResult = await dataResponse.json();
				setResult(dataResult);
				toast.success('Data Processor test completed successfully');
			}

			// For other components, prepare a standard request
			const requestBody = {
				sourceId: selectedSource,
			};

			console.log(`Sending request to ${activeTab}:`, requestBody);
			const response = await fetch(`/api/admin/debug/${activeTab}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Debug test failed');
			}

			const data = await response.json();
			setResult(data);
			// Add this code to save API Handler results if this is the API Handler tab
			if (
				activeTab === 'api-handler' &&
				data.result &&
				data.result.opportunities
			) {
				console.log('Storing API Handler results for future use:', {
					opportunitiesCount: data.result.opportunities.length,
					rawResponseId: data.result.rawResponseId,
				});
				setApiHandlerResults({
					opportunities: [...data.result.opportunities],
					rawResponseId: data.result.rawResponseId,
				});
			}
			toast.success(`${activeTab} test completed successfully`);
		} catch (error) {
			console.error(`Error running ${activeTab} test:`, error);
			toast.error(error.message || 'Debug test failed');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className='container py-8'>
			<h1 className='text-3xl font-bold mb-6'>API Processing Debug</h1>

			<div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
				<Card>
					<CardHeader>
						<CardTitle>Select API Source</CardTitle>
						<CardDescription>
							Choose a source to debug its processing
						</CardDescription>
					</CardHeader>
					<CardContent>
						{loadingSources ? (
							<div className='text-center py-4'>Loading sources...</div>
						) : (
							<div className='space-y-2'>
								{sources.map((source) => (
									<div
										key={source.id}
										className={`p-3 border rounded cursor-pointer ${
											selectedSource === source.id
												? 'border-blue-500 bg-blue-50'
												: 'border-gray-200 hover:bg-gray-50'
										}`}
										onClick={() => setSelectedSource(source.id)}>
										<div className='font-medium'>{source.name}</div>
										<div className='text-sm text-gray-500'>
											{source.organization} ({source.type})
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className='md:col-span-2'>
					<CardHeader>
						<CardTitle>Debug Components</CardTitle>
						<CardDescription>
							Test individual components of the API processing pipeline
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Tabs
							value={activeTab}
							onValueChange={setActiveTab}
							className='space-y-4'>
							<TabsList className='grid grid-cols-3 md:grid-cols-5 gap-2'>
								<TabsTrigger value='initial-route'>Initial Route</TabsTrigger>
								<TabsTrigger value='process-coordinator'>
									Process Coordinator
								</TabsTrigger>
								<TabsTrigger value='run-manager'>Run Manager</TabsTrigger>
								<TabsTrigger value='source-manager'>Source Manager</TabsTrigger>
								<TabsTrigger value='api-handler'>API Handler</TabsTrigger>
								<TabsTrigger value='detail-processor'>
									Detail Processor
								</TabsTrigger>
								<TabsTrigger value='data-processor'>Data Processor</TabsTrigger>
								<TabsTrigger value='api-endpoint'>API Endpoint</TabsTrigger>
								<TabsTrigger value='db-schema'>DB Schema</TabsTrigger>
							</TabsList>

							{/* Component Information */}
							<div className='bg-gray-50 p-4 rounded-md'>
								<h3 className='text-lg font-semibold mb-2'>
									{componentInfo[activeTab].title}
								</h3>
								<p className='mb-4'>{componentInfo[activeTab].description}</p>

								<div className='mb-4'>
									<h4 className='font-medium mb-1'>Major Functions:</h4>
									<ul className='list-disc pl-5 space-y-1'>
										{componentInfo[activeTab].functions.map((func, index) => (
											<li key={index} className='text-sm font-mono'>
												{func}
											</li>
										))}
									</ul>
								</div>

								<div className='mb-4'>
									<h4 className='font-medium mb-1'>Test Input:</h4>
									<p className='text-sm'>{componentInfo[activeTab].input}</p>
								</div>

								<div>
									<h4 className='font-medium mb-1'>Expected Output:</h4>
									<pre className='text-xs bg-gray-100 p-3 rounded overflow-auto max-h-[200px]'>
										{componentInfo[activeTab].expectedOutput}
									</pre>
								</div>
							</div>

							<div className='pt-4'>
								<Button
									onClick={runDebugTest}
									disabled={loading || !selectedSource}>
									{loading
										? 'Running Test...'
										: `Run ${componentInfo[activeTab].title} Test`}
								</Button>
							</div>
						</Tabs>
					</CardContent>
				</Card>
			</div>

			{result && (
				<Card>
					<CardHeader>
						<CardTitle>Test Results</CardTitle>
						<CardDescription>
							Results from the {componentInfo[activeTab].title} test
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='bg-gray-50 p-4 rounded-md overflow-auto max-h-[600px]'>
							<pre className='text-sm'>{JSON.stringify(result, null, 2)}</pre>
						</div>
					</CardContent>
					<CardFooter>
						<div className='w-full'>
							<h4 className='font-medium mb-2'>
								Compare with Expected Output:
							</h4>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<h5 className='text-sm font-medium mb-1'>Expected:</h5>
									<pre className='text-xs bg-gray-100 p-3 rounded overflow-auto max-h-[200px]'>
										{componentInfo[activeTab].expectedOutput}
									</pre>
								</div>
								<div>
									<h5 className='text-sm font-medium mb-1'>Actual:</h5>
									<pre className='text-xs bg-gray-100 p-3 rounded overflow-auto max-h-[200px]'>
										{JSON.stringify(result, null, 2)}
									</pre>
								</div>
							</div>
						</div>
					</CardFooter>
				</Card>
			)}
		</div>
	);
}
