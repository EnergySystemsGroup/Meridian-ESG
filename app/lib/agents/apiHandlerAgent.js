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
import { processNextSource } from './sourceManagerAgent';
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
				id: z
					.string()
					.describe(
						'Unique identifier for the opportunity - REQUIRED for detail fetching'
					),
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
				eligibleApplicants: z
					.array(z.string())
					.describe('List of eligible applicant types'),
				eligibleProjectTypes: z
					.array(z.string())
					.describe('List of eligible project types'),
				eligibleLocations: z
					.array(z.string())
					.describe('List of eligible locations'),
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
				tags: z
					.array(z.string())
					.optional()
					.describe(
						'Short, relevant keywords or phrases extracted from the opportunity description. These should be concise (1-3 words) and capture key aspects like: funding type (e.g., "grant", "loan"), focus areas (e.g., "solar", "energy efficiency"), target sectors (e.g., "schools", "municipalities"), or special characteristics (e.g., "matching-required", "rural-only"). Do not include full sentences.'
					),
				status: z
					.string()
					.optional()
					.describe('Current status (open, upcoming, closed)'),
				isNational: z
					.boolean()
					.optional()
					.describe('Whether this is a national opportunity'),
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
	processingMetrics: z
		.object({
			inputCount: z.number().describe('Number of items in the input'),
			passedCount: z.number().describe('Number of items that passed filtering'),
			rejectedCount: z.number().describe('Number of items that were rejected'),
			rejectionReasons: z.array(z.string()).describe('Reasons for rejection'),
			averageScoreBeforeFiltering: z
				.number()
				.describe('Average relevance score before filtering'),
			averageScoreAfterFiltering: z
				.number()
				.describe('Average relevance score after filtering'),
			filterReasoning: z
				.string()
				.describe('Summary of why items were filtered'),
		})
		.describe('Metrics about the processing'),
});

// Define the prompt template

const promptTemplate = PromptTemplate.fromTemplate(
	`You are an expert funding opportunity analyst for energy and infrastructure projects.
Your task is to analyze a list of funding opportunities and identify those most relevant to our organization's focus areas.

SOURCE INFORMATION:
{sourceInfo}

OPPORTUNITIES:
{opportunities}

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

Only include opportunities that score {minRelevanceScore} or higher in your final output. In the absence of information, make assumptions to lean on the side of inclusion.

For each selected opportunity, provide:
1. Opportunity ID (this is critical for the detail processor and must be included)
2. Title
3. Relevance score
4. Primary focus area(s)
5. Eligible client types
6. Key benefits (2-3 bullet points)
7. Any notable restrictions or requirements

IMPORTANT: Always preserve the original ID of each opportunity exactly as it appears in the API response. This ID is required for fetching detailed information in the next step.

{formatInstructions}
`
);

/**
 * Make a configured API request
 * @param {Object} config - The request configuration
 * @param {string} config.method - The HTTP method
 * @param {string} config.url - The URL to request
 * @param {Object} config.queryParameters - Query parameters
 * @param {Object} config.requestBody - Request body
 * @param {Object} config.headers - Request headers
 * @returns {Promise<Object>} - The response data
 */
async function makeConfiguredApiRequest(config) {
	const { method, url, queryParameters, requestBody, headers } = config;

	// Log the request configuration
	console.log('Making API request:', {
		method,
		url,
		queryParams: Object.keys(queryParameters || {}),
		bodyKeys: requestBody ? Object.keys(requestBody) : 'No body',
		headers: headers ? 'Headers present' : 'No headers',
	});

	try {
		// Build the URL with query parameters
		let fullUrl = url;
		if (queryParameters && Object.keys(queryParameters).length > 0) {
			const queryString = Object.entries(queryParameters)
				.filter(([_, value]) => value !== undefined && value !== null)
				.map(
					([key, value]) =>
						`${encodeURIComponent(key)}=${encodeURIComponent(value)}`
				)
				.join('&');

			fullUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
		}

		console.log(`Full request URL: ${fullUrl}`);

		// Make the request
		const startTime = Date.now();
		const response = await axios({
			method,
			url: fullUrl,
			data: requestBody,
			headers,
		});
		const endTime = Date.now();

		// Log the response
		// console.log('API response received:', {
		// 	status: response.status,
		// 	statusText: response.statusText,
		// 	responseTime: endTime - startTime,
		// 	dataSize: JSON.stringify(response.data).length,
		// 	dataKeys: Object.keys(response.data || {}),
		// });

		return response.data;
	} catch (error) {
		// Log the error
		console.error('API request failed:', {
			method,
			url,
			status: error.response?.status,
			statusText: error.response?.statusText,
			message: error.message,
			responseData: error.response?.data,
		});

		throw new Error(`API request failed: ${error.message}`);
	}
}

/**
 * Extract data from an object using a path string
 * @param {Object} obj - The object to extract data from
 * @param {string} path - The path to extract data from (e.g. 'data.items')
 * @returns {any} - The extracted data
 */
function extractDataByPath(obj, path) {
	// If no path is provided, return the object itself
	if (!path) {
		console.log(
			'No path provided for data extraction, returning entire object'
		);
		return obj;
	}

	try {
		// Split the path by dots
		const parts = path.split('.');

		// Start with the object
		let current = obj;

		// Track the path as we traverse
		let currentPath = '';

		// Traverse the path
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}.${part}` : part;

			// Check if the current part exists
			if (current === undefined || current === null) {
				console.warn(
					`Path traversal failed at "${currentPath}": parent is ${
						current === null ? 'null' : 'undefined'
					}`
				);
				return undefined;
			}

			// Move to the next part
			current = current[part];

			// Log the type of the current value
			// console.log(
			// 	`Path "${currentPath}" yielded: ${
			// 		current === null ? 'null' : typeof current
			// 	}`
			// );
		}

		// Return the final value
		return current;
	} catch (error) {
		console.error(`Error extracting data by path "${path}":`, error);
		return undefined;
	}
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

	// Counter for API calls
	let apiCallCounter = 0;

	// Metrics for run tracking
	const initialApiMetrics = {
		totalHitCount: 0, // Total number of items available in the API (from totalCountPath)
		apiCallCount: 0, // Number of API calls made
		totalItemsRetrieved: 0, // Total number of actual items retrieved across all pages
		firstPageCount: 0, // Number of items in the first page only
		totalPages: 0, // Total number of pages fetched
		sampleOpportunities: [],
		apiEndpoint: processingDetails.apiEndpoint,
		responseTime: 0,
		apiCallTime: 0,
	};

	if (!paginationConfig || !paginationConfig.enabled) {
		// If pagination is not enabled, make a single request

		const apiCallStartTime = Date.now();
		apiCallCounter++; // Increment API call counter

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
		initialApiMetrics.apiCallCount = apiCallCounter; // Use the counter
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

		// console.log('Non-paginated extraction paths:', {
		// 	responseDataPath,
		// 	totalCountPath,
		// 	responseKeys:
		// 		typeof response === 'object' ? Object.keys(response) : 'not an object',
		// });

		// First try to extract data using the configured path
		if (responseDataPath) {
			const extractedData = extractDataByPath(response, responseDataPath);
			// console.log('Extracted data using path:', {
			// 	path: responseDataPath,
			// 	isArray: Array.isArray(extractedData),
			// 	length: Array.isArray(extractedData)
			// 		? extractedData.length
			// 		: 'not an array',
			// 	sample:
			// 		Array.isArray(extractedData) && extractedData.length > 0
			// 			? typeof extractedData[0] === 'object'
			// 				? Object.keys(extractedData[0])
			// 				: extractedData[0]
			// 			: 'no sample',
			// });

			if (Array.isArray(extractedData)) {
				items = extractedData;
			}
		}

		// If no data was found using the path, fall back to generic approach
		if (items.length === 0) {
			console.log('No data found using path, falling back to generic approach');

			// Generic approach - try to find an array in the response
			if (Array.isArray(response.data)) {
				console.log(
					'Found array in response.data with length:',
					response.data.length
				);
				items = response.data;
			} else if (response.data && typeof response.data === 'object') {
				// Look for the first array property in the response
				const arrayProps = Object.keys(response.data).filter((key) =>
					Array.isArray(response.data[key])
				);
				console.log('Found array properties in response.data:', arrayProps);

				if (arrayProps.length > 0) {
					console.log(
						`Using first array property: ${arrayProps[0]} with length:`,
						response.data[arrayProps[0]].length
					);
					items = response.data[arrayProps[0]];
				}
			}
		}

		// Update metrics based on the actual data
		initialApiMetrics.firstPageCount = items.length; // This is the first and only page
		initialApiMetrics.totalItemsRetrieved = items.length; // Total items = first page items (since no pagination)

		// Try to extract total count using the configured path
		if (totalCountPath) {
			const totalCount = extractDataByPath(response, totalCountPath);
			// console.log('Extracted total count:', {
			// 	path: totalCountPath,
			// 	value: totalCount,
			// 	type: typeof totalCount,
			// });

			if (totalCount !== undefined && totalCount !== null) {
				initialApiMetrics.totalHitCount = totalCount;
			} else {
				console.log(
					'Total count not found, falling back to items.length:',
					items.length
				);
				initialApiMetrics.totalHitCount = items.length;
			}
		} else {
			console.log(
				'No totalCountPath provided, using items.length:',
				items.length
			);
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
		apiCallCounter++; // Increment API call counter

		// console.log(`[Page ${currentPage}] Making API request with params:`, {
		// 	method: processingDetails.requestConfig.method,
		// 	url: processingDetails.apiEndpoint,
		// 	queryParams,
		// 	paginationParams:
		// 		paginationConfig.type === 'offset'
		// 			? { limit: pageSize, offset }
		// 			: paginationConfig.type === 'page'
		// 			? { limit: pageSize, page: currentPage + 1 }
		// 			: { limit: pageSize, cursor },
		// });

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

		// Log data extraction results
		// console.log(`[Page ${currentPage}] Data extraction:`, {
		// 	responseDataPath,
		// 	dataLength: Array.isArray(data) ? data.length : 'not an array',
		// 	totalCountPath,
		// 	currentTotalCount,
		// 	responseKeys:
		// 		typeof response === 'object' ? Object.keys(response) : 'not an object',
		// });

		// Update total count if available
		if (currentTotalCount !== undefined && currentTotalCount !== null) {
			totalCount = currentTotalCount;
			console.log(`[Page ${currentPage}] Updated totalCount to ${totalCount}`);
		}

		// Update metrics
		if (currentPage === 0) {
			initialApiMetrics.firstPageCount = Array.isArray(data) ? data.length : 0; // Explicitly for first page only

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
			console.log(
				`[Page ${currentPage}] Added ${data.length} items, totalItems now: ${totalItems}`
			);
		}

		// Update pagination variables
		currentPage++;

		// Log pagination decision
		// console.log(`[Page ${currentPage - 1}] Pagination decision:`, {
		// 	type: paginationConfig.type,
		// 	hasMorePages,
		// 	currentPage,
		// 	maxPages,
		// 	offset: paginationConfig.type === 'offset' ? offset : undefined,
		// 	totalCount,
		// 	pageSize,
		// 	dataLength: Array.isArray(data) ? data.length : 'not an array',
		// 	cursor: paginationConfig.type === 'cursor' ? cursor : undefined,
		// });

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
	initialApiMetrics.apiCallCount = apiCallCounter; // Use the counter instead of results.length
	initialApiMetrics.totalItemsRetrieved = totalItems; // Total items retrieved across all pages
	initialApiMetrics.totalHitCount = totalCount || totalItems;

	// Log final metrics calculation
	// console.log('Final metrics calculation:', {
	// 	totalPages: currentPage,
	// 	apiCallCount: apiCallCounter,
	// 	resultsLength: results.length,
	// 	totalItemsRetrieved: totalItems,
	// 	totalHitCount: totalCount || totalItems,
	// 	rawTotalCount: totalCount,
	// 	fallbackToTotalItems: totalCount === undefined || totalCount === null,
	// });

	// Update run manager with initial API call metrics
	if (runManager) {
		await runManager.updateInitialApiCall(initialApiMetrics);
	}

	const endTime = Date.now();
	initialApiMetrics.responseTime = endTime - startTime;

	console.log(
		`API calls made: ${initialApiMetrics.apiCallCount}, Items retrieved: ${initialApiMetrics.totalItemsRetrieved}, Total available: ${initialApiMetrics.totalHitCount}`
	);

	// Verify that apiCallCount matches results.length as a sanity check
	if (apiCallCounter !== results.length) {
		console.warn(
			`Warning: API call counter (${apiCallCounter}) doesn't match results.length (${results.length})`
		);
	}

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
	opportunities,
	source,
	processingDetails,
	runManager
) {
	const startTime = Date.now();
	const secondStageFiltering = processingDetails?.detailConfig?.enabled;

	// Get the minimum relevance score from config, default to 7 if not specified
	const minRelevanceScore = secondStageFiltering ? 5 : 7;
	console.log(`Using minimum relevance score: ${minRelevanceScore}`);

	const parser = StructuredOutputParser.fromZodSchema(
		apiResponseProcessingSchema
	);
	const formatInstructions = parser.getFormatInstructions();

	// Format the prompt with the opportunities and client details

	const prompt = await promptTemplate.format({
		opportunities: JSON.stringify(opportunities, null, 2),
		sourceInfo: JSON.stringify(source, null, 2),
		formatInstructions,
		minRelevanceScore,
	});
	// Create the model
	const model = new ChatAnthropic({
		temperature: 0,
		modelName: 'claude-3-5-haiku-20241022',
		anthropicApiKey: process.env.ANTHROPIC_API_KEY,
	});

	// Call the model
	const response = await model.invoke(prompt);

	// Parse the response
	const parsedResponse = await parser.parse(response.content);

	// Extract opportunities from the parsed response
	const filteredOpportunities = parsedResponse.opportunities || [];

	// Log the first few opportunities to check their structure
	console.log('LLM response structure check:', {
		totalOpportunities: filteredOpportunities.length,
		sampleOpportunity:
			filteredOpportunities.length > 0
				? {
						...filteredOpportunities[0],
						description: filteredOpportunities[0].description
							? filteredOpportunities[0].description.substring(0, 100) + '...'
							: 'No description',
				  }
				: 'No opportunities returned',
		allHaveIds: filteredOpportunities.every((opp) => opp.id),
		sampleIds: filteredOpportunities
			.slice(0, 3)
			.map((opp) => opp.id || 'MISSING_ID'),
		allOpportunities: filteredOpportunities,
	});

	// Validate that all opportunities have IDs
	const opportunitiesWithoutIds = filteredOpportunities.filter(
		(opp) => !opp.id
	);
	if (opportunitiesWithoutIds.length > 0) {
		console.warn(
			`WARNING: ${opportunitiesWithoutIds.length} opportunities are missing IDs. This will cause problems with detail fetching.`
		);
		console.warn('First opportunity without ID:', opportunitiesWithoutIds[0]);
	}

	// Calculate metrics
	const metrics = {
		totalOpportunitiesAnalyzed: opportunities.length,
		opportunitiesPassingFilter: filteredOpportunities.length,
		filteringTime: Date.now() - startTime,
	};

	// Update run manager with metrics
	if (runManager) {
		await runManager.updateFirstStageFilter(metrics);
	}

	return {
		filteredItems: filteredOpportunities,
		metrics,
	};
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
		console.log('Detail fetching skipped: ', {
			detailConfigEnabled: detailConfig?.enabled,
			filteredItemsCount: filteredItems.length,
		});

		if (runManager) {
			await runManager.updateDetailApiCalls(detailMetrics);
		}

		return {
			detailedItems: filteredItems,
			metrics: detailMetrics,
		};
	}

	// Log the detail configuration
	// console.log('Detail fetching configuration:', {
	// 	endpoint: detailConfig.endpoint,
	// 	method: detailConfig.method || 'GET',
	// 	idField: detailConfig.idField,
	// 	idParam: detailConfig.idParam,
	// });

	// Check if all items have the required ID field
	const itemsWithId = filteredItems.filter((item) => item.id);
	const itemsWithoutId = filteredItems.filter((item) => !item.id);

	// console.log('ID availability check:', {
	// 	totalItems: filteredItems.length,
	// 	itemsWithId: itemsWithId.length,
	// 	itemsWithoutId: itemsWithoutId.length,
	// 	sampleIds: itemsWithId.slice(0, 3).map((item) => item.id),
	// });

	if (itemsWithoutId.length > 0) {
		console.warn(
			`${itemsWithoutId.length} items are missing the required ID field. These items will be skipped for detail fetching.`
		);
	}

	// Update metrics
	detailMetrics.opportunitiesRequiringDetails = itemsWithId.length;

	// Process each item
	const detailedItems = [];
	const responseTimes = [];

	for (const item of filteredItems) {
		// Get the ID directly from the item.id field (which should be required)
		// This is more reliable than using extractDataByPath with a configurable field
		const itemId = item.id;

		// console.log('Processing item for detail fetching:', {
		// 	itemId,
		// 	hasId: !!itemId,
		// 	itemKeys: Object.keys(item),
		// });

		if (itemId) {
			try {
				const detailRequestBody = {};
				detailRequestBody[detailConfig.idParam] = itemId;

				console.log('Making detail request:', {
					endpoint: detailConfig.endpoint,
					method: detailConfig.method || 'GET',
					requestBody: detailRequestBody,
				});

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

				// Extract data from the response using the configured responseDataPath
				let detailData;
				// First check if detailConfig has a responseDataPath
				if (detailConfig.responseDataPath) {
					detailData = extractDataByPath(
						detailResponse,
						detailConfig.responseDataPath
					);
					console.log(
						`Extracted detail data using path: ${detailConfig.responseDataPath}`
					);
				}
				// Default to "data" path as a common convention
				else if (detailResponse.data) {
					detailData = detailResponse.data;
					console.log('Using default "data" path for detail response');
				}
				// Fall back to the entire response if no path is specified
				else {
					detailData = detailResponse;
					console.log(
						'No responseDataPath found, using entire detail response'
					);
				}

				// Add the extracted data directly to the detailed items array
				detailedItems.push(detailData);
				detailMetrics.successfulDetailCalls++;
				console.log(`Detail request successful for ID ${itemId}`);
			} catch (error) {
				console.error(`Error fetching details for item ${itemId}:`, error);

				// Track error
				detailMetrics.failedDetailCalls++;
				detailMetrics.detailCallErrors.push(
					`${error.message} for ID ${itemId}`
				);

				// Don't add anything for failed requests
			}
		} else {
			// No ID field, log warning but don't add to detailed items
			console.warn(`No ID found for item. This item will be skipped.`, {
				itemKeys: Object.keys(item),
			});
		}
	}

	// Calculate average response time
	if (responseTimes.length > 0) {
		detailMetrics.averageDetailResponseTime =
			responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
		detailMetrics.totalDetailCallTime = responseTimes.reduce(
			(sum, time) => sum + time,
			0
		);
	}

	// Log the final detailed items structure
	console.log('Final detailed items summary:', {
		totalItems: detailedItems.length,
		sampleData: detailedItems.length > 0 ? detailedItems[0] : 'No items',
		itemsWithData: detailedItems.filter((item) => item).length,
		itemsWithoutData: detailedItems.filter((item) => !item).length,
	});

	// Log the metrics
	console.log('Detail fetching metrics:', detailMetrics);

	// Update run manager with metrics
	if (runManager) {
		await runManager.updateDetailApiCalls(detailMetrics);
	}

	return {
		detailedItems,
		metrics: detailMetrics,
	};
}

/**
 * Calls the LLM with the given prompt and configuration
 * @param {string} prompt - The prompt to send to the LLM
 * @param {Object} llmConfig - Configuration for the LLM
 * @param {Object} runManager - Optional run manager for tracking
 * @returns {Promise<string>} - The LLM response
 */
async function callLLM(prompt, llmConfig, runManager) {
	console.log('Calling LLM with config:', {
		model: llmConfig?.model || 'claude-3-5-haiku-20241022',
		temperature: llmConfig?.temperature || 0,
		promptLength: prompt.length,
	});

	try {
		// Create the model
		const model = new ChatAnthropic({
			temperature: llmConfig?.temperature || 0,
			modelName: llmConfig?.model || 'claude-3-5-haiku-20241022',
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		});

		// Call the model
		const startTime = Date.now();
		const response = await model.invoke(prompt);
		const endTime = Date.now();

		console.log('LLM response received:', {
			responseLength: response.content.length,
			processingTime: endTime - startTime,
			tokenUsage: response.usage,
			response: response.content,
		});

		// Update run manager if available
		if (runManager) {
			await runManager.updateLlmCall({
				promptTokens: response.usage?.prompt_tokens || 0,
				completionTokens: response.usage?.completion_tokens || 0,
				processingTime: endTime - startTime,
			});
		}

		return response.content;
	} catch (error) {
		console.error('Error calling LLM:', error);
		throw new Error(`LLM call failed: ${error.message}`);
	}
}

/**
 * Formats a prompt template with the given variables
 * @param {string} template - The prompt template
 * @param {Object} variables - Variables to insert into the template
 * @param {Object} options - Optional formatting options
 * @returns {string} - The formatted prompt
 */
function formatPrompt(template, variables, options = {}) {
	console.log('Formatting prompt with variables:', Object.keys(variables));

	let formattedPrompt = template;

	// Replace each variable in the template
	for (const [key, value] of Object.entries(variables)) {
		const placeholder = `{{${key}}}`;
		let replacementValue = '';

		// Handle different types of values
		if (typeof value === 'object') {
			replacementValue = JSON.stringify(value, null, 2);
		} else {
			replacementValue = String(value);
		}

		// Replace all occurrences of the placeholder
		formattedPrompt = formattedPrompt.split(placeholder).join(replacementValue);
	}

	console.log('Prompt formatted, length:', formattedPrompt.length);

	return formattedPrompt;
}

/**
 * Process an API handler
 * @param {Object} source - The source configuration
 * @param {Object} processingDetails - The processing details
 * @param {Object} runManager - Optional run manager for tracking
 * @returns {Promise<Object>} - The processed results
 */
async function processApiHandler(source, processingDetails, runManager) {
	// console.log('Starting API handler processing for source:', source.name);
	// console.log('Processing details:', {
	// 	requestConfig: {
	// 		...processingDetails.requestConfig,
	// 		headers: processingDetails.requestConfig.headers
	// 			? 'Headers present'
	// 			: 'No headers',
	// 	},
	// 	paginationConfig: processingDetails.paginationConfig
	// 		? 'Pagination enabled'
	// 		: 'No pagination',
	// 	responseConfig: processingDetails.responseConfig
	// 		? 'Response config present'
	// 		: 'No response config',
	// 	detailConfig: processingDetails.detailConfig?.enabled
	// 		? 'Detail fetching enabled'
	// 		: 'No detail fetching',
	// });

	try {
		// Step 1: Process the paginated API
		console.log('Step 1: Processing paginated API');
		const { results, metrics: apiMetrics } = await processPaginatedApi(
			source,
			processingDetails,
			runManager
		);

		console.log('API processing complete:', {
			resultsCount: results.length,
			apiMetrics,
		});

		// Extract all opportunities from the API results
		const allOpportunities = [];
		const responseDataPath =
			processingDetails.responseConfig?.responseDataPath ||
			processingDetails.paginationConfig?.responseDataPath ||
			'';

		for (const result of results) {
			const items = extractDataByPath(result, responseDataPath);
			if (Array.isArray(items)) {
				console.log(`Extracted ${items.length} items from result`);
				allOpportunities.push(...items);
			} else {
				console.warn('Extracted data is not an array:', typeof items);
			}
		}

		console.log(`Total opportunities extracted: ${allOpportunities.length}`);

		// Log sample opportunity structure
		if (allOpportunities.length > 0) {
			const sampleOpp = allOpportunities[0];
			console.log('Sample opportunity structure:', {
				keys: Object.keys(sampleOpp),
				hasId: !!sampleOpp.id,
				idValue: sampleOpp.id,
				sampleValues: Object.entries(sampleOpp)
					.slice(0, 5)
					.map(([key, value]) => ({
						key,
						type: typeof value,
						preview:
							typeof value === 'string'
								? value.substring(0, 50) + (value.length > 50 ? '...' : '')
								: value,
					})),
			});
		}

		// Step 2: Perform first stage filtering
		console.log('Step 2: Performing first stage filtering');
		const { filteredItems, metrics: filterMetrics } =
			await performFirstStageFiltering(
				allOpportunities,
				source,
				processingDetails,
				runManager
			);

		console.log('First stage filtering complete:', {
			filteredItemsCount: filteredItems.length,
			filterMetrics,
		});

		// Check if this is a one-step API process
		if (!processingDetails.detailConfig?.enabled) {
			console.log(
				'One-step API process - returning after first stage filtering'
			);
			return {
				items: filteredItems,
				metrics: {
					api: apiMetrics,
					filter: filterMetrics,
				},
				rawApiResponse: results,
				requestDetails: {
					source: source,
					processingDetails: processingDetails,
				},
			};
		}

		// If we get here, this is a two-step API process
		console.log('Two-step API process - proceeding with detail fetching');

		// Step 3: Fetch detailed information
		console.log('Step 3: Fetching detailed information');
		const { detailedItems, metrics: detailMetrics } =
			await fetchDetailedInformation(
				filteredItems,
				source,
				processingDetails,
				runManager
			);

		console.log('Detail fetching complete:', {
			detailedItemsCount: detailedItems.length,
			detailMetrics,
		});

		// Step 4: Perform second stage filtering with Detail Processor
		console.log('Step 4: Performing second stage filtering');
		const { opportunities: secondStageFiltered, metrics: secondStageMetrics } =
			await processDetailedInfo(detailedItems, source, runManager);

		console.log('Second stage filtering complete:', {
			inputCount: detailedItems.length,
			outputCount: secondStageFiltered.length,
			metrics: secondStageMetrics,
		});

		// Prepare the final result
		const result = {
			items: secondStageFiltered,
			metrics: {
				api: apiMetrics,
				filter: filterMetrics,
				detail: detailMetrics,
				secondStage: secondStageMetrics,
			},
			rawApiResponse: results,
			requestDetails: {
				source: source,
				processingDetails: processingDetails,
			},
		};

		return result;
	} catch (error) {
		console.error('Error in API handler processing:', error);
		throw error;
	}
}

/**
 * API Handler Agent that processes an API source
 * @param {Object} source - The source configuration
 * @param {Object} processingDetails - The processing details
 * @param {Object} runManager - Optional run manager for tracking
 * @returns {Promise<Object>} - The processed results
 */
export async function apiHandlerAgent(
	source,
	processingDetails,
	runManager = null
) {
	// Log the start of the API Handler Agent
	// console.log(
	// 	`Starting API Handler Agent for source: ${source.name} (${source.id})`
	// );

	try {
		// Process the API handler
		const result = await processApiHandler(
			source,
			processingDetails,
			runManager
		);

		// Format the result for the next stage
		const formattedResult = {
			opportunities: result.items,
			initialApiMetrics: result.metrics.api,
			firstStageMetrics: result.metrics.filter,
			detailApiMetrics: result.metrics.detail,
			rawApiResponse: result.rawApiResponse,
			requestDetails: result.requestDetails,
		};

		console.log('API Handler Agent completed successfully:', {
			opportunitiesCount: formattedResult.opportunities.length,
			hasInitialApiMetrics: !!formattedResult.initialApiMetrics,
			hasFirstStageMetrics: !!formattedResult.firstStageMetrics,
			hasDetailApiMetrics: !!formattedResult.detailApiMetrics,
			rawApiResponseLength: formattedResult.rawApiResponse?.length,
			hasRequestDetails: !!formattedResult.requestDetails,
		});

		return formattedResult;
	} catch (error) {
		console.error(
			`Error in API Handler Agent for source ${source.name}:`,
			error
		);
		throw error;
	}
}

/**
 * Processes the next API source in the queue
 * @returns {Promise<Object|null>} - The processing result, or null if no source was processed
 */
export async function processNextSourceWithHandler() {
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

// Export the functions
export {
	processApiHandler,
	processPaginatedApi,
	performFirstStageFiltering,
	fetchDetailedInformation,
	makeConfiguredApiRequest,
	extractDataByPath,
	callLLM,
	formatPrompt,
};
