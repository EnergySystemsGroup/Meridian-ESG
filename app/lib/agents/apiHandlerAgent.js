import { ChatAnthropic } from '@langchain/anthropic';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import {
	createSupabaseClient,
	logAgentExecution,
	logApiActivity,
} from '../supabase';
import {
	makeApiRequest as makeExternalApiRequest,
	makePaginatedApiRequest,
	getNestedValue,
} from '../apiRequest';
import { z } from 'zod';
import axios from 'axios';

// Define the funding opportunity schema
const fundingOpportunitySchema = z.object({
	title: z.string().describe('The title of the funding opportunity'),
	description: z.string().describe('A description of the funding opportunity'),
	fundingType: z
		.string()
		.describe('The type of funding (grant, loan, incentive, etc.)'),
	agency: z
		.string()
		.describe('The agency or organization providing the funding'),
	totalFunding: z
		.number()
		.optional()
		.nullable()
		.describe('The total amount of funding available'),
	minAward: z
		.number()
		.optional()
		.nullable()
		.describe('The minimum award amount'),
	maxAward: z
		.number()
		.optional()
		.nullable()
		.describe('The maximum award amount'),
	openDate: z
		.string()
		.optional()
		.nullable()
		.describe('The date when applications open (ISO format if possible)'),
	closeDate: z
		.string()
		.optional()
		.nullable()
		.describe('The date when applications close (ISO format if possible)'),
	eligibility: z.array(z.string()).describe('List of eligible entity types'),
	url: z.string().describe('URL for more information'),
	matchingRequired: z.boolean().describe('Whether matching funds are required'),
	matchingPercentage: z
		.number()
		.optional()
		.nullable()
		.describe('The required matching percentage'),
	categories: z
		.array(z.string())
		.describe('Relevant categories from our taxonomy'),
	status: z.string().describe('Current status (open, upcoming, closed)'),
	confidence: z
		.number()
		.min(0)
		.max(100)
		.describe('Confidence score for this extraction (0-100)'),
});

// Define the output schema for the agent
const apiResponseProcessingSchema = z.object({
	opportunities: z
		.array(
			z.object({
				title: z.string().describe('Title of the funding opportunity'),
				description: z
					.string()
					.optional()
					.nullable()
					.describe('Description of the opportunity'),
				fundingType: z
					.string()
					.optional()
					.nullable()
					.describe('Type of funding (grant, loan, etc.)'),
				agency: z
					.string()
					.optional()
					.nullable()
					.describe('Funding agency or organization'),
				totalFunding: z
					.number()
					.optional()
					.nullable()
					.describe('Total funding amount available'),
				minAward: z
					.number()
					.optional()
					.nullable()
					.describe('Minimum award amount'),
				maxAward: z
					.number()
					.optional()
					.nullable()
					.describe('Maximum award amount'),
				openDate: z
					.string()
					.optional()
					.nullable()
					.describe('Opening date for applications'),
				closeDate: z
					.string()
					.optional()
					.nullable()
					.describe('Closing date for applications'),
				eligibility: z
					.array(z.string())
					.describe('List of eligible entity types'),
				url: z
					.string()
					.optional()
					.nullable()
					.describe('URL for more information'),
				matchingRequired: z
					.boolean()
					.optional()
					.describe('Whether matching funds are required'),
				matchingPercentage: z
					.number()
					.optional()
					.nullable()
					.describe('Required matching percentage'),
				categories: z
					.array(z.string())
					.optional()
					.describe('Relevant categories from our taxonomy'),
				status: z
					.string()
					.optional()
					.describe('Current status (open, upcoming, closed)'),
				relevanceScore: z
					.number()
					.min(1)
					.max(10)
					.describe('Relevance score from 1-10'),
				relevanceReasoning: z
					.string()
					.optional()
					.describe('Reasoning for the relevance score'),
			})
		)
		.describe('List of extracted funding opportunities'),
	totalCount: z
		.number()
		.describe('Total number of opportunities found in the API response'),
	processingMetrics: z
		.object({
			inputCount: z.number().describe('Number of items in the input'),
			passedCount: z.number().describe('Number of items that passed filtering'),
			filterReasoning: z
				.string()
				.describe('Summary of why items were filtered'),
			processingTime: z
				.number()
				.describe('Time spent processing in milliseconds'),
		})
		.describe('Metrics about the processing'),
});

// Define the prompt template

const promptTemplate = PromptTemplate.fromTemplate(
	`You are an expert funding opportunity analyst for energy and infrastructure projects.
Your task is to analyze a list of funding opportunities and identify those most relevant to our organization's focus areas.

SOURCE INFORMATION:
{sourceInfo}

API RESPONSE:
{apiResponse}

Our organization helps the following types of entities secure funding:
- K-12 schools
- Community colleges and universities
- Municipal, county, and state governments
- Federal facilities
- Tribal governments
- Nonprofit organizations
- For-profit businesses
- Special districts
- Healthcare facilities

We focus on funding in these categories:
- Energy & Buildings (e.g., efficiency upgrades, renewable energy, building modernization)
- Transportation & Mobility (e.g., EV infrastructure, public transit, alternative transportation)
- Water & Resources (e.g., water conservation, stormwater management, resource recovery)
- Climate & Resilience (e.g., adaptation, mitigation, carbon reduction)
- Community & Economic Development (e.g., revitalization, workforce development)
- Infrastructure & Planning (e.g., sustainable infrastructure, master planning)

For each opportunity, analyze:
1. Eligibility requirements - Do they match our client types?
2. Funding purpose - Does it align with our focus areas?
3. Award amounts - Is the funding significant enough to pursue?
4. Timeline - Is the opportunity currently active or upcoming?
5. Match requirements - Are the cost-share requirements reasonable?

For each opportunity in the provided list, assign a relevance score from 1-10 based on:
1. Alignment with our focus areas (0-5 points):
   - 0 points: No alignment with any focus area
   - 1 point: Minimal alignment with one focus area
   - 2 points: Moderate alignment with one focus area
   - 3 points: Moderate alignment with multiple focus areas
   - 4 points: Strong alignment with one or more focus areas
   - 5 points: Perfect alignment with one or more focus areas

2. Applicability to our client types (0-3 points):
   - 0 points: Not applicable to any of our client types
   - 3 points: Applicable to any of our client types

3. Funding amount and accessibility (0-2 points):
   - 0 points: Insufficient funding or excessive match requirements
   - 1 point: Moderate funding with reasonable match requirements
   - 2 points: Substantial funding with minimal match requirements

Only include opportunities that score 7 or higher in your final output. In the absense of information, make assumptions to Lean on the side of inclusion.

For each selected opportunity, provide:
1. Opportunity ID and title
2. Relevance score
3. Primary focus area(s)
4. Eligible client types
5. Key benefits (2-3 bullet points)
6. Any notable restrictions or requirements

{formatInstructions}
`
);

/**
 * Makes a configured API request
 * @param {Object} config - The request configuration
 * @returns {Promise<Object>} - The API response
 */
async function makeConfiguredApiRequest(config) {
	try {
		const { method, url, queryParameters, requestBody, headers } = config;

		// Build the full URL with query parameters
		let fullUrl = url;
		if (queryParameters && Object.keys(queryParameters).length > 0) {
			const queryString = Object.entries(queryParameters)
				.map(
					([key, value]) =>
						`${encodeURIComponent(key)}=${encodeURIComponent(value)}`
				)
				.join('&');
			fullUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
		}

		// Make the request
		const response = await axios({
			method,
			url: fullUrl,
			data: requestBody,
			headers,
		});

		return response.data;
	} catch (error) {
		console.error('Error making API request:', error);
		throw error;
	}
}

/**
 * Extracts data from a nested object using a path string
 * @param {Object} obj - The object to extract from
 * @param {String} path - The path to the data (e.g., "data.items")
 * @returns {Any} - The extracted data
 */
function extractDataByPath(obj, path) {
	if (!path) return obj;
	return getNestedValue(obj, path);
}

/**
 * Processes a paginated API response
 * @param {Object} source - The API source
 * @param {Object} processingDetails - The processing details from the source manager
 * @param {Object} runManager - The run manager for tracking
 * @returns {Promise<Object>} - The combined results and metrics
 */
async function processPaginatedApi(source, processingDetails, runManager) {
	const startTime = Date.now();
	const results = [];
	const paginationConfig = processingDetails.paginationConfig;
	const responseConfig = processingDetails.responseConfig || {};

	// Metrics for run tracking
	const initialApiMetrics = {
		totalHitCount: 0,
		retrievedCount: 0,
		firstPageCount: 0,
		totalPages: 0,
		sampleOpportunities: [],
		apiEndpoint: processingDetails.apiEndpoint,
		responseTime: 0,
		apiCallTime: 0,
	};

	if (!paginationConfig || !paginationConfig.enabled) {
		// If pagination is not enabled, make a single request
		const apiCallStartTime = Date.now();
		const response = await makeConfiguredApiRequest({
			method: processingDetails.requestConfig.method,
			url: processingDetails.apiEndpoint,
			queryParameters: processingDetails.queryParameters,
			requestBody: processingDetails.requestBody,
			headers: processingDetails.requestConfig.headers,
		});
		const apiCallEndTime = Date.now();

		// Update metrics
		initialApiMetrics.apiCallTime = apiCallEndTime - apiCallStartTime;
		initialApiMetrics.responseTime = apiCallEndTime - apiCallStartTime;
		initialApiMetrics.retrievedCount = 1;
		initialApiMetrics.totalPages = 1;

		// Extract data from the response
		let items = [];

		// Get the response data path (from responseConfig or fall back to paginationConfig for backward compatibility)
		const responseDataPath =
			responseConfig.responseDataPath ||
			(paginationConfig && paginationConfig.responseDataPath);

		// Get the total count path (from responseConfig or fall back to paginationConfig for backward compatibility)
		const totalCountPath =
			responseConfig.totalCountPath ||
			(paginationConfig && paginationConfig.totalCountPath);

		// First try to extract data using the configured path
		if (responseDataPath) {
			const extractedData = extractDataByPath(response, responseDataPath);
			if (Array.isArray(extractedData)) {
				items = extractedData;
			}
		}

		// If no data was found using the path, fall back to generic approach
		if (items.length === 0) {
			// Generic approach - try to find an array in the response
			if (Array.isArray(response.data)) {
				items = response.data;
			} else if (response.data && typeof response.data === 'object') {
				// Look for the first array property in the response
				const arrayProps = Object.keys(response.data).filter((key) =>
					Array.isArray(response.data[key])
				);
				if (arrayProps.length > 0) {
					items = response.data[arrayProps[0]];
				}
			}
		}

		// Update metrics based on the actual data
		initialApiMetrics.firstPageCount = items.length;

		// Try to extract total count using the configured path
		if (totalCountPath) {
			const totalCount = extractDataByPath(response, totalCountPath);
			if (totalCount !== undefined && totalCount !== null) {
				initialApiMetrics.totalHitCount = totalCount;
			} else {
				initialApiMetrics.totalHitCount = items.length;
			}
		} else {
			initialApiMetrics.totalHitCount = items.length;
		}

		// Extract sample data for monitoring and debugging purposes only
		// These are NOT actual opportunities, just metadata for tracking
		const sampleMetadata = [];
		const sampleSize = Math.min(5, items.length);
		for (let i = 0; i < sampleSize; i++) {
			const item = items[i];
			if (typeof item !== 'object' || item === null) continue;

			// Look for title-like properties in priority order
			let title = null;
			for (const prop of ['title', 'name', 'label', 'id', 'description']) {
				if (item[prop]) {
					title = item[prop];
					break;
				}
			}

			sampleMetadata.push({
				_metadataOnly: true, // Flag to indicate this is not a real opportunity
				_debugSample: true, // Additional flag for clarity
				_sampleIndex: i,
				id: item.id || `sample-${i}`,
				title: title || 'Unknown Title',
				source: source.name,
			});
		}

		// Store samples as metadata, not as actual opportunities
		initialApiMetrics.responseSamples = sampleMetadata;
		initialApiMetrics.isDebugMetadataOnly = true;

		// Update run manager with initial API call metrics
		if (runManager) {
			await runManager.updateInitialApiCall(initialApiMetrics);
		}

		return {
			results: [response],
			metrics: initialApiMetrics,
		};
	}

	// Initialize pagination variables
	let currentPage = 0;
	let hasMorePages = true;
	let offset = 0;
	let cursor = null;
	let totalCount = 0; // Initialize totalCount

	// Get the page size
	const pageSize = paginationConfig.pageSize || 100;
	const maxPages = paginationConfig.maxPages || 20;
	let totalItems = 0;

	while (hasMorePages && currentPage < maxPages) {
		// Start with the original query parameters and request body
		const queryParams = { ...processingDetails.queryParameters };
		const requestBody = processingDetails.requestBody
			? { ...processingDetails.requestBody }
			: {};
		const headers = { ...processingDetails.requestConfig.headers };

		// Determine where pagination parameters should go based on the request method and configuration
		const paginationInBody =
			processingDetails.requestConfig.method === 'POST' &&
			paginationConfig.paginationInBody === true;

		// Add pagination parameters to the appropriate location (query params or request body)
		if (paginationConfig.type === 'offset') {
			if (paginationInBody) {
				requestBody[paginationConfig.limitParam] = pageSize;
				requestBody[paginationConfig.offsetParam] = offset;
			} else {
				queryParams[paginationConfig.limitParam] = pageSize;
				queryParams[paginationConfig.offsetParam] = offset;
			}
		} else if (paginationConfig.type === 'page') {
			if (paginationInBody) {
				requestBody[paginationConfig.limitParam] = pageSize;
				requestBody[paginationConfig.pageParam] = currentPage + 1; // Pages usually start at 1
			} else {
				queryParams[paginationConfig.limitParam] = pageSize;
				queryParams[paginationConfig.pageParam] = currentPage + 1;
			}
		} else if (paginationConfig.type === 'cursor') {
			// For the first page, we might not have a cursor yet
			if (cursor) {
				if (paginationInBody) {
					requestBody[paginationConfig.limitParam] = pageSize;
					requestBody[paginationConfig.cursorParam] = cursor;
				} else {
					queryParams[paginationConfig.limitParam] = pageSize;
					queryParams[paginationConfig.cursorParam] = cursor;
				}
			} else {
				// First page of cursor-based pagination typically just needs the limit
				if (paginationInBody) {
					requestBody[paginationConfig.limitParam] = pageSize;
				} else {
					queryParams[paginationConfig.limitParam] = pageSize;
				}
			}
		}

		// Make the API request
		const apiCallStartTime = Date.now();
		const response = await makeConfiguredApiRequest({
			method: processingDetails.requestConfig.method,
			url: processingDetails.apiEndpoint,
			queryParameters: queryParams,
			requestBody: requestBody,
			headers: headers,
		});
		const apiCallEndTime = Date.now();

		//test

		// Update metrics for the first page
		if (currentPage === 0) {
			initialApiMetrics.apiCallTime = apiCallEndTime - apiCallStartTime;
			initialApiMetrics.responseTime = apiCallEndTime - apiCallStartTime;
		}

		// Add the response to the results
		results.push(response);

		// Extract the data and total count
		// Get the response data path (from responseConfig or fall back to paginationConfig)
		const responseDataPath =
			responseConfig.responseDataPath || paginationConfig.responseDataPath;

		// Get the total count path (from responseConfig or fall back to paginationConfig)
		const totalCountPath =
			responseConfig.totalCountPath || paginationConfig.totalCountPath;

		const data = extractDataByPath(response, responseDataPath);
		const currentTotalCount = extractDataByPath(response, totalCountPath);

		// Update total count if available
		if (currentTotalCount !== undefined && currentTotalCount !== null) {
			totalCount = currentTotalCount;
		}

		// Update metrics
		if (currentPage === 0) {
			initialApiMetrics.firstPageCount = Array.isArray(data) ? data.length : 0;

			// Add sample data for monitoring and debugging purposes only
			// These are NOT actual opportunities, just metadata for tracking
			if (Array.isArray(data)) {
				const sampleMetadata = [];
				const sampleSize = Math.min(5, data.length);

				for (let i = 0; i < sampleSize; i++) {
					const item = data[i];
					if (typeof item !== 'object' || item === null) continue;

					// Look for title-like properties in priority order
					let title = null;
					for (const prop of ['title', 'name', 'label', 'id', 'description']) {
						if (item[prop]) {
							title = item[prop];
							break;
						}
					}

					sampleMetadata.push({
						_metadataOnly: true, // Flag to indicate this is not a real opportunity
						_debugSample: true, // Additional flag for clarity
						_sampleIndex: i,
						id: item.id || `sample-${i}`,
						title: title || 'Unknown Title',
						source: source.name,
					});
				}

				// Store samples as metadata, not as actual opportunities
				initialApiMetrics.responseSamples = sampleMetadata;
				initialApiMetrics.isDebugMetadataOnly = true;
			}
		}

		// Count total items
		if (Array.isArray(data)) {
			totalItems += data.length;
		}

		// Update pagination variables
		currentPage++;

		if (paginationConfig.type === 'offset') {
			offset += pageSize;
			hasMorePages = data && data.length > 0 && offset < totalCount;
		} else if (paginationConfig.type === 'page') {
			hasMorePages =
				data && data.length > 0 && currentPage * pageSize < totalCount;
		} else if (paginationConfig.type === 'cursor') {
			// For cursor-based pagination, extract the next cursor from the response
			if (paginationConfig.nextCursorPath) {
				// Use the configured path to extract the cursor
				cursor = extractDataByPath(response, paginationConfig.nextCursorPath);
			} else {
				// Try common cursor property names
				cursor = response.nextCursor || response.next_cursor;
			}

			// Determine if there are more pages based on cursor and data length
			hasMorePages = !!cursor && data && data.length > 0;
		}
	}

	// Update final metrics
	initialApiMetrics.totalPages = currentPage;
	initialApiMetrics.retrievedCount = results.length;
	initialApiMetrics.totalHitCount = totalCount || totalItems;

	// Update run manager with initial API call metrics
	if (runManager) {
		await runManager.updateInitialApiCall(initialApiMetrics);
	}

	const endTime = Date.now();
	initialApiMetrics.responseTime = endTime - startTime;

	console.log('these are the results from the api call', results);
	console.log('these are the initial metrics', initialApiMetrics);

	return {
		results,
		metrics: initialApiMetrics,
	};
}

/**
 * Performs first-stage filtering on API results
 * @param {Array} apiResults - The results from the API call
 * @param {Object} source - The API source
 * @param {Object} processingDetails - The processing details
 * @param {Object} runManager - The run manager for tracking
 * @returns {Promise<Object>} - The filtered results and metrics
 */
async function performFirstStageFiltering(
	apiResults,
	source,
	processingDetails,
	runManager
) {
	const startTime = Date.now();
	const supabase = createSupabaseClient();

	try {
		// Extract data from all API results
		const allItems = [];
		for (const result of apiResults) {
			const items = extractDataByPath(
				result,
				processingDetails.responseConfig?.responseDataPath ||
					processingDetails.paginationConfig?.responseDataPath ||
					''
			);
			if (Array.isArray(items)) {
				allItems.push(...items);
			}
		}

		// Metrics for first stage filtering
		const filterMetrics = {
			inputCount: allItems.length,
			passedCount: 0,
			filterReasoning: '',
			processingTime: 0,
			sampleOpportunities: [],
		};

		// If no items, return early
		if (allItems.length === 0) {
			const endTime = Date.now();
			filterMetrics.processingTime = endTime - startTime;

			if (runManager) {
				await runManager.updateFirstStageFilter(filterMetrics);
			}

			return {
				filteredItems: [],
				metrics: filterMetrics,
			};
		}

		// Create the output parser
		const parser = StructuredOutputParser.fromZodSchema(
			apiResponseProcessingSchema
		);
		const formatInstructions = parser.getFormatInstructions();

		// Create the model
		const model = new ChatAnthropic({
			temperature: 0,
			modelName: 'claude-3-5-haiku-20241022',
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		});

		// Get the minimum relevance score
		const minRelevanceScore =
			processingDetails.firstStageFilterConfig?.minRelevanceScore || 5;

		// Format the prompt
		const prompt = await promptTemplate.format({
			sourceInfo: JSON.stringify(source, null, 2),
			apiResponse: JSON.stringify(allItems, null, 2),
			minRelevanceScore: minRelevanceScore,
			formatInstructions,
		});

		// Get the LLM response
		const response = await model.invoke(prompt);

		// Parse the response
		const parsedOutput = await parser.parse(response.content);

		// Update metrics
		filterMetrics.passedCount = parsedOutput.opportunities.length;
		filterMetrics.filterReasoning =
			parsedOutput.processingMetrics.filterReasoning;

		// Add sample data for monitoring and debugging purposes only
		// These are NOT actual opportunities, just metadata for tracking
		const sampleMetadata = [];
		const sampleSize = Math.min(5, parsedOutput.opportunities.length);

		for (let i = 0; i < sampleSize; i++) {
			const opp = parsedOutput.opportunities[i];
			if (!opp) continue;

			sampleMetadata.push({
				_metadataOnly: true, // Flag to indicate this is not a real opportunity
				_debugSample: true, // Additional flag for clarity
				_sampleIndex: i,
				_filterStage: 'first',
				title: opp.title || 'Unknown Title',
				relevanceScore: opp.relevanceScore,
				relevanceReasoning: opp.relevanceReasoning,
				source: source.name,
			});
		}

		// Store samples as metadata, not as actual opportunities
		filterMetrics.responseSamples = sampleMetadata;
		filterMetrics.isDebugMetadataOnly = true;

		const endTime = Date.now();
		filterMetrics.processingTime = endTime - startTime;

		// Update run manager with first stage filter metrics
		if (runManager) {
			await runManager.updateFirstStageFilter(filterMetrics);
		}

		// Log the agent execution
		await logAgentExecution(
			supabase,
			'first_stage_filter',
			{ source, processingDetails },
			parsedOutput,
			filterMetrics.processingTime,
			{
				promptTokens: response.usage?.prompt_tokens,
				completionTokens: response.usage?.completion_tokens,
			}
		);

		return {
			filteredItems: parsedOutput.opportunities,
			metrics: filterMetrics,
		};
	} catch (error) {
		console.error('Error in first stage filtering:', error);

		// Update metrics with error
		const endTime = Date.now();
		const filterMetrics = {
			inputCount: 0,
			passedCount: 0,
			filterReasoning: `Error: ${error.message}`,
			processingTime: endTime - startTime,
			sampleOpportunities: [],
		};

		// Update run manager with error
		if (runManager) {
			await runManager.updateFirstStageFilter(filterMetrics);
		}

		throw error;
	}
}

/**
 * Fetches detailed information for opportunities
 * @param {Array} filteredItems - The filtered items from first stage
 * @param {Object} source - The API source
 * @param {Object} processingDetails - The processing details
 * @param {Object} runManager - The run manager for tracking
 * @returns {Promise<Object>} - The detailed items and metrics
 */
async function fetchDetailedInformation(
	filteredItems,
	source,
	processingDetails,
	runManager
) {
	const startTime = Date.now();
	const detailConfig = processingDetails.detailConfig;

	// Metrics for detail API calls
	const detailMetrics = {
		opportunitiesRequiringDetails: 0,
		successfulDetailCalls: 0,
		failedDetailCalls: 0,
		detailCallErrors: [],
		averageDetailResponseTime: 0,
		totalDetailCallTime: 0,
	};

	// If detail config is not enabled or no filtered items, return early
	if (!detailConfig || !detailConfig.enabled || filteredItems.length === 0) {
		if (runManager) {
			await runManager.updateDetailApiCalls(detailMetrics);
		}

		return {
			detailedItems: filteredItems,
			metrics: detailMetrics,
		};
	}

	// Update metrics
	detailMetrics.opportunitiesRequiringDetails = filteredItems.length;

	// Process each item
	const detailedItems = [];
	const responseTimes = [];

	for (const item of filteredItems) {
		const itemId = extractDataByPath(item, detailConfig.idField);

		if (itemId) {
			try {
				const detailRequestBody = {};
				detailRequestBody[detailConfig.idParam] = itemId;

				const detailStartTime = Date.now();
				const detailResponse = await makeConfiguredApiRequest({
					method: detailConfig.method || 'GET',
					url: detailConfig.endpoint,
					queryParameters: {},
					requestBody: detailRequestBody,
					headers:
						detailConfig.headers || processingDetails.requestConfig.headers,
				});
				const detailEndTime = Date.now();

				// Track response time
				const responseTime = detailEndTime - detailStartTime;
				responseTimes.push(responseTime);

				// Add detailed information
				detailedItems.push({
					...item,
					_detailResponse: detailResponse,
				});

				detailMetrics.successfulDetailCalls++;
			} catch (error) {
				console.error(`Error fetching details for item ${itemId}:`, error);

				// Track error
				detailMetrics.failedDetailCalls++;
				detailMetrics.detailCallErrors.push(
					`${error.message} for ID ${itemId}`
				);

				// Keep the original item
				detailedItems.push(item);
			}
		} else {
			// No ID field, keep the original item
			detailedItems.push(item);
		}
	}

	// Calculate metrics
	const endTime = Date.now();
	detailMetrics.totalDetailCallTime = endTime - startTime;

	if (responseTimes.length > 0) {
		detailMetrics.averageDetailResponseTime =
			responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
	}

	// Update run manager with detail API call metrics
	if (runManager) {
		await runManager.updateDetailApiCalls(detailMetrics);
	}

	return {
		detailedItems,
		metrics: detailMetrics,
	};
}

/**
 * API Handler Agent that processes an API source
 * @param {Object} source - The API source to process
 * @param {Object} processingDetails - The processing details from the source manager
 * @param {Object} runManager - Optional RunManager instance for tracking
 * @returns {Promise<Object>} - The processing result
 */
export async function apiHandlerAgent(
	source,
	processingDetails,
	runManager = null
) {
	const supabase = createSupabaseClient();
	const startTime = Date.now();

	try {
		// Step 1: Make the API request(s)
		const { results: apiResults, metrics: initialApiMetrics } =
			await processPaginatedApi(source, processingDetails, runManager);

		// Step 2: Perform first-stage filtering
		const { filteredItems, metrics: firstStageMetrics } =
			await performFirstStageFiltering(
				apiResults,
				source,
				processingDetails,
				runManager
			);

		// Step 3: Fetch detailed information if needed
		const { detailedItems, metrics: detailApiMetrics } =
			await fetchDetailedInformation(
				filteredItems,
				source,
				processingDetails,
				runManager
			);

		// Store the raw API responses
		const { data: rawResponseData, error: rawResponseError } = await supabase
			.from('api_raw_responses')
			.insert({
				source_id: source.id,
				content: {
					list_responses: apiResults,
					detail_responses: detailedItems
						.map((item) => item._detailResponse)
						.filter(Boolean),
				},
				request_details: {
					list_request: {
						endpoint: processingDetails.apiEndpoint,
						method: processingDetails.requestConfig.method,
						headers: processingDetails.requestConfig.headers,
						queryParams: processingDetails.queryParameters,
						requestBody: processingDetails.requestBody,
					},
					detail_requests: processingDetails.detailConfig?.enabled
						? {
								endpoint: processingDetails.detailConfig.endpoint,
								method: processingDetails.detailConfig.method || 'GET',
								headers: processingDetails.detailConfig.headers,
								idField: processingDetails.detailConfig.idField,
								idParam: processingDetails.detailConfig.idParam,
						  }
						: null,
				},
				timestamp: new Date().toISOString(),
				created_at: new Date().toISOString(),
			})
			.select('id')
			.single();

		if (rawResponseError) {
			console.error('Error storing raw API response:', rawResponseError);
			throw rawResponseError;
		}

		// Calculate execution time
		const executionTime = Date.now() - startTime;

		// Prepare the result
		const result = {
			opportunities: detailedItems.map((item) => {
				// Remove the _detailResponse from items before passing them on
				const { _detailResponse, ...cleanItem } = item;
				return cleanItem;
			}),
			totalCount: initialApiMetrics.totalHitCount,
			rawApiResponse: {
				list_responses: apiResults,
				detail_responses: detailedItems
					.map((item) => item._detailResponse)
					.filter(Boolean),
			},
			requestDetails: {
				list_request: {
					endpoint: processingDetails.apiEndpoint,
					method: processingDetails.requestConfig.method,
					headers: processingDetails.requestConfig.headers,
					queryParams: processingDetails.queryParameters,
					requestBody: processingDetails.requestBody,
				},
				detail_requests: processingDetails.detailConfig?.enabled
					? {
							endpoint: processingDetails.detailConfig.endpoint,
							method: processingDetails.detailConfig.method || 'GET',
							headers: processingDetails.detailConfig.headers,
							idField: processingDetails.detailConfig.idField,
							idParam: processingDetails.detailConfig.idParam,
					  }
					: null,
			},
			rawResponseId: rawResponseData.id,
			sourceId: source.id,
		};

		// Log the agent execution
		await logAgentExecution(
			supabase,
			'api_handler',
			{ source, processingDetails },
			result,
			executionTime,
			{}
		);

		// Log the API activity
		await logApiActivity(supabase, source.id, 'api_process', 'success', {
			opportunitiesFound: detailedItems.length,
			totalCount: initialApiMetrics.totalHitCount,
		});

		// Update the last processed timestamp
		await supabase
			.from('api_sources')
			.update({ last_processed: new Date().toISOString() })
			.eq('id', source.id);

		return {
			...result,
			initialApiMetrics,
			firstStageMetrics,
			detailApiMetrics,
		};
	} catch (error) {
		// Calculate execution time even if there was an error
		const executionTime = Date.now() - startTime;

		// Log the error
		console.error('Error in API Handler Agent:', error);

		// Log the agent execution with error
		await logAgentExecution(
			supabase,
			'api_handler',
			{ source, processingDetails },
			null,
			executionTime,
			{},
			error
		);

		// Log the API activity with error
		await logApiActivity(supabase, source.id, 'api_process', 'failure', {
			error: String(error),
		});

		// Update run with error if runManager is provided
		if (runManager) {
			await runManager.updateRunError(error);
		}

		throw error;
	}
}

/**
 * Processes the next API source in the queue
 * @returns {Promise<Object|null>} - The processing result, or null if no source was processed
 */
export async function processNextSourceWithHandler() {
	const { processNextSource } = require('./sourceManagerAgent');

	// Get the next source to process
	const result = await processNextSource();

	if (!result) {
		console.log('No sources to process');
		return null;
	}

	// Process the source with the API Handler Agent
	const { source, processingDetails, runManager } = result;
	const handlerResult = await apiHandlerAgent(
		source,
		processingDetails,
		runManager
	);

	// Return the complete result
	return {
		source,
		processingDetails,
		handlerResult,
		runManager,
	};
}
