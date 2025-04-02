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
import {
	TAXONOMIES,
	generateTaxonomyInstruction,
} from '../constants/taxonomies';
import axios from 'axios';
import crypto from 'crypto';
import { processChunksInParallel } from '../utils/parallelProcessing';

// Define the funding opportunity schema
const fundingOpportunitySchema = z.object({
	title: z.string().describe('The title of the funding opportunity'),
	description: z
		.string()
		.describe(
			'To the extent possible, a clear, detailed description of various aspects of the opportunity including key requirements, application process, evaluation criteria, and other important details that would help potential applicants understand the full scope of the opportunity.'
		),
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
	matchingRequired: z
		.boolean()
		.optional()
		.nullable()
		.describe('Whether matching funds are required'),
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
	actionableSummary: z
		.string()
		.describe(
			'A single concise paragraph (2-3 sentences) that clearly states: 1) the funding source, 2) the amount available, 3) who can apply, 4) specifically what the money is for, and 5) when applications are due. Example: "This is a $5M grant from the Department of Energy for schools to implement building performance standards. Applications are due August 2025."'
		),
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
					.describe(
						'To the extent possible, a clear, detailed description of various aspects of the opportunity including key requirements, application process, evaluation criteria, and other important details that would help potential applicants understand the full scope of the opportunity.'
					),
				fundingType: z
					.string()
					.optional()
					.nullable()
					.describe('Type of funding (grant, loan, etc.)'),
				funding_source: z
					.object({
						name: z
							.string()
							.describe(
								'The precise name of the funding organization or agency'
							),
						type: z
							.string()
							.optional()
							.describe(
								'High-level type (federal, state, local, utility, foundation, other)'
							),
						website: z
							.string()
							.optional()
							.nullable()
							.describe('Website of the funding organization if available'),
						contact_email: z
							.string()
							.optional()
							.nullable()
							.describe(
								'Contact email for the funding organization if available'
							),
						contact_phone: z
							.string()
							.optional()
							.nullable()
							.describe(
								'Contact phone number for the funding organization if available'
							),
						description: z
							.string()
							.optional()
							.nullable()
							.describe(
								'Additional notes or description about the funding organization'
							),
					})
					.describe(
						'Information about the organization providing this funding opportunity'
					)
					.optional()
					.nullable(),
				totalFundingAvailable: z
					.number()
					.optional()
					.nullable()
					.describe(
						'Total funding amount available for the entire program/opportunity'
					),
				minimumAward: z
					.number()
					.optional()
					.nullable()
					.describe('Minimum award amount per applicant'),
				maximumAward: z
					.number()
					.optional()
					.nullable()
					.describe('Maximum award amount per applicant'),
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
					.describe('URL for the funding opportunity, if available'),
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
					.describe(
						'Funding categories as listed by, or deduced from the source data'
					),
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
					.describe(
						'Relevance score from 1-10. Sum of the scores achieved for each relevance criteria.'
					),
				relevanceReasoning: z
					.string()
					.optional()
					.describe(
						'Detailed explanation of the relevance score. MUST INCLUDE: ' +
							'1) Point-by-point scoring breakdown (Focus Areas: X/3, ' +
							'Applicability: X/3, Funding Type Quality: X/1, Matching Requirements: X/1, Project Implementation Type: X/2), ' +
							'2) Which specific data fields from the opportunity you examined, and ' +
							'3) Direct quotes or values from these fields that influenced your scoring.'
					),
				actionableSummary: z
					.string()
					.describe(
						'A single concise paragraph (2-3 sentences) that clearly states: 1) the funding source, 2) the total funding available for the entire program and/or per award, 3) who can apply, 4) specifically what the money is for, and 5) when applications are due. Example: "This is a $5M grant from the Department of Energy for schools to implement building performance standards. School districts can receive up to $500K each, and applications are due August 2025."'
					),
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
				.describe(
					'Average relevance score of ALL opportunities before applying the minimum threshold filter. This should be the mean of all relevance scores you assigned, including both opportunities that pass and fail the filter.'
				),
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
Your task is to perform a detailed analysis of funding opportunities to determine their relevance and value to our clients.

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

${generateTaxonomyInstruction(
	'ELIGIBLE_PROJECT_TYPES',
	'eligible project types'
)}

${generateTaxonomyInstruction('ELIGIBLE_APPLICANTS', 'eligible applicants')}

${generateTaxonomyInstruction('CATEGORIES', 'funding categories')}

${generateTaxonomyInstruction('FUNDING_TYPES', 'funding types')}

${generateTaxonomyInstruction('ELIGIBLE_LOCATIONS', 'eligible locations')}

For each opportunity, analyze:
1. Eligibility requirements - Do they match our client types?
2. Funding purpose - Does it align with our focus areas?
3. Award amounts - Is the funding significant enough to pursue?
4. Timeline - Is the opportunity currently active or upcoming?
5. Match requirements - Are the cost-share requirements reasonable?

## Relevance Scoring System

For each funding opportunity, calculate a relevance score out of 10 points based on the following criteria:

1. **Alignment with Focus Areas (0-3 points)**
   - 3.0 points: Strong alignment with energy efficiency projects
   - 2.5 points: Strong alignment with one or more of our focus areas
   - 2.0 points: Moderate alignment with one or more focus areas
   - 1.0 point: Minimal alignment with one or more focus areas
   - 0.0 points: No alignment with any focus area

2. **Applicability to Client Types (0-3 points)**
   - 3.0 points: Applicable to K-12 schools
   - 2.5 points: Applicable to any of our other client types
   - 0.0 points: Not applicable to any of our client types

3. **Funding Type Quality (0-1 point)**
   - 1.0 point: Pure grant
   - 0.5 points: Any other funding type (rebate, loan, tax incentive, etc.)

4. **Matching Requirements (0-1 point)**
   - 1.0 point: No matching requirements
   - 0.0 points: Any matching requirements

5. **Project Implementation Type (0-2 points)**
   - 2.0 points: Requires contractor implementation (construction, renovation, installation, etc.)
   - 1.0 point: May partially require contractor work
   - 0.0 points: Likely doesn't require contractor (research, planning, assessment only)

The relevance score is the sum of the scores achieved for each criteria.

Only include opportunities that score {minRelevanceScore} or higher in your final output. In the absence of information, make assumptions to lean on the side of inclusion.

For each selected opportunity, provide:
1. Opportunity ID (this is critical for the detail processor and must be included)
2. Title
3. Relevance score
4. Primary focus area(s)
5. Eligible client types
6. Key benefits (2-3 bullet points)
7. Any notable restrictions or requirements

IMPORTANT FOR RELEVANCE REASONING:
When explaining your relevance score, you MUST include:
1. DETAILED SCORING BREAKDOWN - Show exactly how you calculated the score:
   - Focus areas: X/3 points (explain which focus areas aligned)
   - Applicability to client types: X/3 points (specify which client types)
   - Funding type quality: X/1 points (note what type of funding it is)
   - Matching requirements: X/1 points (note any match requirements)
   - Project implementation type: X/2 points (note to what degree the project requires contractor work)
2. DATA FIELDS EXAMINED - Explicitly identify which specific fields from the API response you examined (e.g., title, description, eligibility criteria)
3. EVIDENCE - Include direct quotes or values from these fields that influenced your scoring

This detailed breakdown helps us verify that you're analyzing the right data and understand your decision-making process.

ACTIONABLE SUMMARY REQUIREMENT:
For each opportunity, provide a concise "actionable summary" in a single paragraph (2-3 sentences) that includes:
1. The funding source (specific agency or organization)
2. The amount available (total and/or per award)
3. Who can apply (specific eligible entities)
4. SPECIFICALLY what the money is for (the exact activities or projects to be funded)
5. When applications are due (specific deadline)

If critical information is missing for any of these elements, clearly indicate what's unknown using phrases like "amount unspecified," "eligibility unclear," or "deadline not provided." Do not make up information that isn't in the source data. It's better to acknowledge missing information than to guess.

Example with complete information: "This is a $5M grant from the Department of Energy for schools to implement building performance standards and upgrade HVAC systems. School districts can receive up to $500K each, and applications are due August 15, 2025."

Example with missing information: "This appears to be a grant from the Department of Energy (amount unspecified) for energy efficiency projects, likely targeting local governments. The specific activities funded and application deadline are not provided in the source data."

Write this summary in plain language, focusing on clarity and specificity about what is known while being transparent about what is unknown.The goal is for someone to read this single paragraph and immediately understand if the opportunity is worth pursuing.

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
		// Store API configuration for future reference
		configuration: {
			method: processingDetails.requestConfig?.method || 'GET',
			pagination: paginationConfig?.enabled ? true : false,
			paginationType: paginationConfig?.type || 'none',
			queryParameters: processingDetails.queryParameters || {},
			responseDataPath:
				responseConfig?.responseDataPath ||
				paginationConfig?.responseDataPath ||
				'data',
			totalCountPath:
				responseConfig?.totalCountPath ||
				paginationConfig?.totalCountPath ||
				null,
			hasRequestBody: processingDetails.requestBody ? true : false,
			// Add more complete configuration details
			requestConfig: processingDetails.requestConfig || {},
			requestBody: processingDetails.requestBody || {},
			paginationConfig: paginationConfig || { enabled: false },
			responseConfig: responseConfig || {},
		},
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

		// Store a few complete raw samples for debugging purposes
		if (Array.isArray(items) && items.length > 0) {
			const rawSampleSize = Math.min(3, items.length);
			const rawSamples = [];

			for (let i = 0; i < rawSampleSize; i++) {
				const rawItem = items[i];
				if (typeof rawItem !== 'object' || rawItem === null) continue;

				// Clone the item to avoid reference issues
				const rawSample = JSON.parse(JSON.stringify(rawItem));

				// Add metadata to identify this as a raw sample
				rawSample._rawSample = true;
				rawSample._sampleIndex = i;

				// Truncate any unusually large string fields to prevent DB size issues
				Object.keys(rawSample).forEach((key) => {
					if (
						typeof rawSample[key] === 'string' &&
						rawSample[key].length > 5000
					) {
						rawSample[key] =
							rawSample[key].substring(0, 5000) + '... [truncated]';
					}
				});

				rawSamples.push(rawSample);
			}

			// Add to metrics
			initialApiMetrics.rawResponseSamples = rawSamples;
		}

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
			(paginationConfig.paginationInBody === true ||
				paginationConfig.inBody === true);

		// Debug pagination config and decision
		console.log('[PAGINATION DEBUG] Configuration check:', {
			method: processingDetails.requestConfig.method,
			checkingParam1: paginationConfig.paginationInBody,
			checkingParam2: paginationConfig.inBody,
			paginationInBody: paginationInBody,
			entireConfig: paginationConfig,
		});

		// Add pagination parameters to the appropriate location (query params or request body)
		if (paginationConfig.type === 'offset') {
			if (paginationInBody) {
				requestBody[paginationConfig.limitParam] = pageSize;
				requestBody[paginationConfig.offsetParam] = offset;
				console.log('[PAGINATION DEBUG] Added offset params to REQUEST BODY:', {
					[paginationConfig.limitParam]: pageSize,
					[paginationConfig.offsetParam]: offset,
					currentPage,
					resultingBody: requestBody,
				});
			} else {
				queryParams[paginationConfig.limitParam] = pageSize;
				queryParams[paginationConfig.offsetParam] = offset;
				console.log('[PAGINATION DEBUG] Added offset params to QUERY PARAMS:', {
					[paginationConfig.limitParam]: pageSize,
					[paginationConfig.offsetParam]: offset,
					currentPage,
					resultingQuery: queryParams,
				});
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

		console.log(
			`[PAGINATION DEBUG] Final request configuration for page ${currentPage}:`,
			{
				method: processingDetails.requestConfig.method,
				url: processingDetails.apiEndpoint,
				queryParams: JSON.stringify(queryParams),
				requestBody: JSON.stringify(requestBody),
				paginationInBody: paginationInBody,
				offset: offset,
				pageSize: pageSize,
			}
		);

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

				// Store a few complete raw samples for debugging purposes
				if (Array.isArray(data) && data.length > 0) {
					const rawSampleSize = Math.min(3, data.length);
					const rawSamples = [];

					for (let i = 0; i < rawSampleSize; i++) {
						const rawItem = data[i];
						if (typeof rawItem !== 'object' || rawItem === null) continue;

						// Clone the item to avoid reference issues
						const rawSample = JSON.parse(JSON.stringify(rawItem));

						// Add metadata to identify this as a raw sample
						rawSample._rawSample = true;
						rawSample._sampleIndex = i;

						// Truncate any unusually large string fields to prevent DB size issues
						Object.keys(rawSample).forEach((key) => {
							if (
								typeof rawSample[key] === 'string' &&
								rawSample[key].length > 5000
							) {
								rawSample[key] =
									rawSample[key].substring(0, 5000) + '... [truncated]';
							}
						});

						rawSamples.push(rawSample);
					}

					// Add to metrics
					initialApiMetrics.rawResponseSamples = rawSamples;
				}
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
 * Splits opportunities into chunks based on token size
 * @param {Array} opportunities - Array of opportunities to process
 * @param {number} tokenThreshold - Maximum tokens per chunk (default 10000)
 * @returns {Array} Array of opportunity chunks
 */
function splitOpportunitiesIntoChunks(opportunities, tokenThreshold = 10000) {
	const chunks = [];
	let currentChunk = [];
	let currentSize = 0;

	for (const opportunity of opportunities) {
		const oppSize = JSON.stringify(opportunity).length;

		// If adding this opportunity would exceed threshold
		if (currentSize + oppSize > tokenThreshold) {
			if (currentChunk.length > 0) {
				chunks.push(currentChunk);
				currentChunk = [];
				currentSize = 0;
			}
		}

		currentChunk.push(opportunity);
		currentSize += oppSize;
	}

	// Add the last chunk if it has items
	if (currentChunk.length > 0) {
		chunks.push(currentChunk);
	}

	return chunks;
}

/**
 * Performs first-stage filtering on API results
 * @param {Array} opportunities - The results from the API call
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
	const minRelevanceScore = secondStageFiltering ? 5 : 6;

	console.log('\n=== Starting First Stage Filtering ===');
	console.log(
		`Starting first-stage filtering with ${opportunities.length} opportunities`
	);
	console.log(`Using minimum relevance score: ${minRelevanceScore}`);
	console.log(`Second stage filtering enabled: ${secondStageFiltering}`);

	// Initialize combined results
	const combinedResults = {
		filteredItems: [],
		metrics: {
			totalOpportunitiesAnalyzed: opportunities.length,
			passedCount: 0,
			rejectedCount: 0,
			rejectionReasons: [],
			averageScoreBeforeFiltering: 0,
			averageScoreAfterFiltering: 0,
			filteringTime: 0,
			filterReasoning: '',
			chunkMetrics: [], // Track per-chunk metrics
		},
	};

	// Split opportunities into chunks if needed
	const chunks = splitOpportunitiesIntoChunks(opportunities);
	const totalChunks = chunks.length;
	console.log('\n=== Chunking Analysis ===');
	console.log(`Chunking metrics:`, {
		totalOpportunities: opportunities.length,
		numberOfChunks: totalChunks,
		averageChunkSize: Math.round(opportunities.length / totalChunks),
		chunkSizes: chunks.map((chunk) => ({
			size: chunk.length,
			estimatedTokens: JSON.stringify(chunk).length / 4, // rough estimation
		})),
	});

	let totalProcessed = 0;

	// Define the function to process a single chunk
	const processChunk = async (chunk, chunkIndex) => {
		const chunkStartTime = Date.now();
		const chunkSize = chunk.length;

		console.log(`\n=== Processing Chunk ${chunkIndex + 1}/${totalChunks} ===`);
		console.log(`\nProcessing chunk ${chunkIndex + 1}/${totalChunks}:`, {
			chunkSize: chunk.length,
			estimatedTokens: Math.round(JSON.stringify(chunk).length / 4),
		});

		const parser = StructuredOutputParser.fromZodSchema(
			apiResponseProcessingSchema
		);
		const formatInstructions = parser.getFormatInstructions();

		const prompt = await promptTemplate.format({
			opportunities: JSON.stringify(chunk, null, 2),
			sourceInfo: JSON.stringify(source, null, 2),
			formatInstructions,
			minRelevanceScore,
		});

		const model = new ChatAnthropic({
			temperature: 0,
			modelName: 'claude-3-5-haiku-20241022',
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		});

		try {
			const response = await model.invoke(prompt);
			const result = await parser.parse(response.content);
			const chunkProcessingTime = Date.now() - chunkStartTime;

			// Build chunk metrics
			const chunkMetrics = {
				chunkIndex: chunkIndex + 1,
				chunkSize,
				processedOpportunities: chunkSize,
				passedCount: result.processingMetrics.passedCount,
				rejectedCount: result.processingMetrics.rejectedCount,
				processingTime: chunkProcessingTime,
				averageTimePerItem: Math.round(chunkProcessingTime / chunkSize),
				estimatedTokens: Math.round(JSON.stringify(chunk).length / 4),
			};

			console.log(`Chunk ${chunkIndex + 1} complete:`, {
				processedInChunk: chunkSize,
				passedInChunk: result.processingMetrics.passedCount,
				rejectedInChunk: result.processingMetrics.rejectedCount,
				chunkProcessingTime: `${(chunkProcessingTime / 1000).toFixed(2)}s`,
				averageTimePerItem: `${(chunkProcessingTime / chunkSize).toFixed(2)}ms`,
			});

			return {
				filteredItems: result.opportunities,
				metrics: {
					...result.processingMetrics,
					chunkMetrics,
				},
			};
		} catch (error) {
			console.error(
				`Error parsing LLM output in performFirstStageFiltering (chunk ${
					chunkIndex + 1
				}/${totalChunks}):`,
				error
			);

			// Add more detailed logging if needed
			if (error.llmOutput) {
				console.error('LLM Output that failed parsing:', error.llmOutput);
			}

			return {
				filteredItems: [],
				metrics: {
					passedCount: 0,
					rejectedCount: chunkSize,
					rejectionReasons: ['Error processing chunk'],
					averageScoreBeforeFiltering: 0,
					averageScoreAfterFiltering: 0,
					chunkMetrics: {
						chunkIndex: chunkIndex + 1,
						chunkSize,
						processedOpportunities: 0,
						passedCount: 0,
						rejectedCount: chunkSize,
						processingTime: Date.now() - chunkStartTime,
						status: 'failed',
					},
					parsingError: error.message,
				},
			};
		}
	};

	// Process all chunks in parallel with controlled concurrency
	const chunkResults = await processChunksInParallel(chunks, processChunk, 5);

	// Combine all results
	for (const result of chunkResults) {
		// Add filtered opportunities to combined results
		combinedResults.filteredItems.push(...result.filteredItems);

		// Update metrics
		combinedResults.metrics.passedCount += result.metrics.passedCount;
		combinedResults.metrics.rejectedCount += result.metrics.rejectedCount;

		// Add unique rejection reasons
		if (result.metrics.rejectionReasons) {
			combinedResults.metrics.rejectionReasons = [
				...new Set([
					...combinedResults.metrics.rejectionReasons,
					...result.metrics.rejectionReasons,
				]),
			];
		}

		// Update filter reasoning
		if (result.metrics.filterReasoning) {
			if (!combinedResults.metrics.filterReasoning) {
				combinedResults.metrics.filterReasoning =
					result.metrics.filterReasoning;
			} else {
				combinedResults.metrics.filterReasoning +=
					' ' + result.metrics.filterReasoning;
			}
		}

		// Add chunk metrics
		if (result.metrics.chunkMetrics) {
			combinedResults.metrics.chunkMetrics.push(result.metrics.chunkMetrics);
		}

		// Update total processed count
		totalProcessed += result.metrics.chunkMetrics?.processedOpportunities || 0;
	}

	// Calculate weighted average scores
	const filteredItems = combinedResults.filteredItems;
	if (filteredItems.length > 0) {
		combinedResults.metrics.averageScoreAfterFiltering =
			filteredItems.reduce((sum, item) => sum + (item.relevanceScore || 0), 0) /
			filteredItems.length;
	}

	// For averageScoreBeforeFiltering, we'd need to aggregate from each chunk
	// This is a simplification - you might need to adjust based on your exact needs
	combinedResults.metrics.averageScoreBeforeFiltering =
		chunkResults.reduce(
			(sum, result) => sum + (result.metrics.averageScoreBeforeFiltering || 0),
			0
		) / chunkResults.length;

	// Calculate final metrics
	const totalTime = Date.now() - startTime;
	combinedResults.metrics.filteringTime = totalTime;
	// Add processingTime for UI compatibility
	combinedResults.metrics.processingTime = totalTime;

	// Log the final results
	console.log('\n=== First Stage Filtering Complete ===');
	console.log('\nFirst stage filtering complete:', {
		totalOpportunities: opportunities.length,
		totalChunks,
		filteredCount: combinedResults.filteredItems.length,
		totalProcessingTime: `${(totalTime / 1000).toFixed(2)}s`,
		averageTimePerItem: `${(totalTime / opportunities.length).toFixed(2)}ms`,
	});

	// After filtering is complete, log a sample opportunity
	if (combinedResults.filteredItems.length > 0) {
		console.log('\n=== Sample Opportunity After Filtering ===');
		const sampleOpp = combinedResults.filteredItems[0];
		console.log(`ID: ${sampleOpp.id}`);
		console.log(`Title: ${sampleOpp.title}`);
		console.log(`Relevance Score: ${sampleOpp.relevanceScore}`);
		console.log(`Actionable Summary: ${sampleOpp.actionableSummary}`);
		console.log('==========================================\n');

		// Store raw filtered opportunities samples for debugging
		const rawSampleSize = Math.min(3, combinedResults.filteredItems.length);
		const rawFilteredSamples = [];

		for (let i = 0; i < rawSampleSize; i++) {
			const rawItem = combinedResults.filteredItems[i];
			if (typeof rawItem !== 'object' || rawItem === null) continue;

			// Clone the item to avoid reference issues
			const rawSample = JSON.parse(JSON.stringify(rawItem));

			// Add metadata to identify this as a raw sample
			rawSample._rawSample = true;
			rawSample._sampleIndex = i;
			rawSample._filterStage = 'first';

			// Truncate any unusually large string fields to prevent DB size issues
			Object.keys(rawSample).forEach((key) => {
				if (
					typeof rawSample[key] === 'string' &&
					rawSample[key].length > 5000
				) {
					rawSample[key] =
						rawSample[key].substring(0, 5000) + '... [truncated]';
				}
			});

			rawFilteredSamples.push(rawSample);
		}

		// Add raw samples to metrics
		combinedResults.metrics.rawFilteredSamples = rawFilteredSamples;
	}

	// Update run manager with combined metrics
	if (runManager) {
		await runManager.updateFirstStageFilter(combinedResults.metrics);
	}

	return combinedResults;
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
		// Store configuration for future reference
		configuration: detailConfig
			? {
					endpoint: detailConfig.endpoint,
					method: detailConfig.method || 'GET',
					idParam: detailConfig.idParam,
					responseDataPath: detailConfig.responseDataPath || 'data',
					enabled: detailConfig.enabled || false,
					// Include the complete detail configuration
					detailConfig: detailConfig || {},
			  }
			: {
					enabled: false,
			  },
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

	// Capture raw response samples for debugging
	if (detailedItems.length > 0) {
		const rawSampleSize = Math.min(3, detailedItems.length);
		const rawResponseSamples = [];

		for (let i = 0; i < rawSampleSize; i++) {
			const rawItem = detailedItems[i];
			if (typeof rawItem !== 'object' || rawItem === null) continue;

			// Clone the item to avoid reference issues
			const rawSample = JSON.parse(JSON.stringify(rawItem));

			// Add metadata to identify this as a raw sample
			rawSample._rawSample = true;
			rawSample._sampleIndex = i;
			rawSample._sampleType = 'detail_response';

			// Truncate any unusually large string fields to prevent DB size issues
			Object.keys(rawSample).forEach((key) => {
				if (
					typeof rawSample[key] === 'string' &&
					rawSample[key].length > 5000
				) {
					rawSample[key] =
						rawSample[key].substring(0, 5000) + '... [truncated]';
				}
			});

			rawResponseSamples.push(rawSample);
		}

		// Add raw samples to metrics
		detailMetrics.rawResponseSamples = rawResponseSamples;
	}

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
	const startTime = Date.now();
	let initialApiMetrics = {
		/* ... */
	};
	let firstStageMetrics = {
		/* ... */
	};
	let detailApiMetrics = {
		/* ... */
	};
	let filteredItems = [];
	let detailedOpportunities = [];
	let rawResponseId = null; // Initialize rawResponseId

	try {
		// Step 1: Process the paginated API
		console.log('Step 1: Processing paginated API');
		const { results, metrics: apiMetrics } = await processPaginatedApi(
			source,
			processingDetails,
			runManager
		);
		// Merge initial API metrics collected during pagination
		initialApiMetrics = { ...initialApiMetrics, ...apiMetrics };

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
				// console.log(`Extracted ${items.length} items from result`); // Less verbose log
				allOpportunities.push(...items);
			} else {
				console.warn('Extracted data is not an array:', typeof items);
			}
		}

		console.log(
			`Total opportunities extracted from API: ${allOpportunities.length}`
		);

		// --- BEGIN ADDED DUPLICATE CHECK LOGGING ---
		if (allOpportunities.length > 0) {
			const allIds = allOpportunities
				.map((opp) => opp?.id) // Use optional chaining for safety
				.filter((id) => id !== undefined && id !== null); // Filter out missing IDs

			if (allIds.length !== allOpportunities.length) {
				console.warn(
					`[DUPLICATE CHECK] Some extracted opportunities (${
						allOpportunities.length - allIds.length
					}) are missing an 'id'.`
				);
			}

			const uniqueIds = new Set(allIds);
			console.log(
				`[DUPLICATE CHECK] Extracted unique opportunity IDs: ${uniqueIds.size}`
			);

			if (uniqueIds.size < allIds.length) {
				console.error(
					`[DUPLICATE CHECK] !! DUPLICATES DETECTED in raw extracted data !!`
				);
				const idCounts = allIds.reduce((acc, id) => {
					acc[id] = (acc[id] || 0) + 1;
					return acc;
				}, {});
				const duplicates = Object.entries(idCounts)
					.filter(([id, count]) => count > 1)
					.map(([id, count]) => ({ id, count }));
				console.error(
					`[DUPLICATE CHECK] Duplicate IDs and counts:`,
					duplicates
				);
			} else {
				console.log(
					`[DUPLICATE CHECK] No duplicates found in raw extracted data.`
				);
			}
		} else {
			console.log('[DUPLICATE CHECK] No opportunities extracted to check.');
		}
		// --- END ADDED DUPLICATE CHECK LOGGING ---

		// Log sample opportunity structure (optional, can keep or remove)
		// if (allOpportunities.length > 0) { ... }

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

		// Return the results for further processing by detailProcessorAgent
		return {
			items: detailedItems,
			metrics: {
				api: apiMetrics,
				filter: filterMetrics,
				detail: detailMetrics,
			},
			// When detail config is enabled, include the detailed responses
			rawApiResponse:
				detailedItems && detailedItems.length > 0 ? detailedItems : results,
			requestDetails: {
				source: source,
				processingDetails: processingDetails,
			},
		};
	} catch (error) {
		console.error('Error in API handler processing:', error);
		throw error;
	}
}

/**
 * Store a raw API response in the database
 * @param {Object} sourceId - The source ID
 * @param {Array} rawResponse - The raw API response
 * @param {Object} requestDetails - Details about the request
 * @returns {Promise<string>} - The ID of the stored raw response
 */
async function storeRawResponse(sourceId, rawResponse, requestDetails) {
	const supabase = createSupabaseClient();

	try {
		// Generate a content hash to check for duplicates
		let contentHash;
		if (typeof rawResponse === 'object') {
			// Sort keys to ensure consistent hashing regardless of key order
			const normalizedContent = JSON.stringify(
				rawResponse,
				Object.keys(rawResponse).sort()
			);
			contentHash = crypto
				.createHash('sha256')
				.update(normalizedContent)
				.digest('hex');
		} else {
			contentHash = crypto
				.createHash('sha256')
				.update(String(rawResponse))
				.digest('hex');
		}

		// Check if this exact content hash already exists for this source
		const { data: existingResponse } = await supabase
			.from('api_raw_responses')
			.select('id')
			.eq('source_id', sourceId)
			.eq('content_hash', contentHash)
			.limit(1);

		// If a duplicate exists, return its ID
		if (existingResponse && existingResponse.length > 0) {
			console.log(
				'Duplicate raw response found, reusing existing ID:',
				existingResponse[0].id
			);
			return existingResponse[0].id;
		}

		// No duplicate found, create new record
		const rawResponseId = crypto.randomUUID
			? crypto.randomUUID()
			: 'test-' + Math.random().toString(36).substring(2, 15);

		// Store the raw response in the database with the content hash
		const { error } = await supabase.from('api_raw_responses').insert({
			id: rawResponseId,
			source_id: sourceId,
			content: rawResponse,
			content_hash: contentHash,
			request_details: requestDetails,
			timestamp: new Date().toISOString(),
			created_at: new Date().toISOString(),
		});

		if (error) {
			console.error('Error storing raw response:', error);
			// Still return the ID even if there was an error, so processing can continue
		}

		return rawResponseId;
	} catch (error) {
		console.error('Error in storeRawResponse:', error);
		// Generate and return an ID even if there was an error
		const fallbackId = crypto.randomUUID
			? crypto.randomUUID()
			: 'test-' + Math.random().toString(36).substring(2, 15);
		return fallbackId;
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
	try {
		// Process the API handler
		const result = await processApiHandler(
			source,
			processingDetails,
			runManager
		);

		// Initialize an array to store multiple raw response IDs (one per opportunity)
		let rawResponseIds = [];
		let singleRawResponseId = null;

		// Handle the case where we have detailed responses (an array of items)
		if (
			processingDetails.detailConfig?.enabled &&
			Array.isArray(result.rawApiResponse) &&
			result.items &&
			result.items.length > 0
		) {
			console.log(
				`Debug - Processing ${result.rawApiResponse.length} detailed responses for ${result.items.length} items`
			);

			// For each detailed response, store it individually
			for (let i = 0; i < result.rawApiResponse.length; i++) {
				if (i < result.items.length) {
					console.log(
						`Debug - Storing raw response for item ${i} with ID ${result.items[i].id}`
					);

					const itemRawResponseId = await storeRawResponse(
						source.id,
						result.rawApiResponse[i],
						result.requestDetails
					);

					console.log(
						`Debug - Generated raw response ID: ${itemRawResponseId} for item ID: ${result.items[i].id}`
					);

					// Add the raw response ID to the array
					rawResponseIds.push({
						itemId: result.items[i].id,
						rawResponseId: itemRawResponseId,
					});
				}
			}

			console.log(
				`Debug - Created ${rawResponseIds.length} rawResponseIds mappings`
			);
		} else {
			// For non-detailed responses, store the entire response once
			console.log(`Debug - Storing single raw response for all items`);

			singleRawResponseId = await storeRawResponse(
				source.id,
				result.rawApiResponse,
				result.requestDetails
			);

			console.log(
				`Debug - Generated single raw response ID: ${singleRawResponseId}`
			);

			// Use the single ID for all opportunities
			if (result.items && result.items.length > 0) {
				rawResponseIds = result.items.map((item) => ({
					itemId: item.id,
					rawResponseId: singleRawResponseId,
				}));

				console.log(
					`Debug - Created ${rawResponseIds.length} mappings all using the same raw response ID`
				);
			}
		}

		// Format the result for the next stage
		const formattedResult = {
			firstStageMetrics: result.metrics.filter,
			opportunities: result.items,
			initialApiMetrics: result.metrics.api,
			rawResponseIds: rawResponseIds, // Array of {itemId, rawResponseId} objects for each opportunity
			singleRawResponseId: singleRawResponseId, // For backwards compatibility
			detailApiMetrics: result.metrics.detail,
			rawApiResponse: result.rawApiResponse,
			requestDetails: result.requestDetails,
		};

		console.log('API Handler Agent completed successfully:', {
			opportunitiesCount: formattedResult.opportunities.length,
			rawResponseIdsCount: formattedResult.rawResponseIds.length,
			hasInitialApiMetrics: !!formattedResult.initialApiMetrics,
			hasFirstStageMetrics: !!formattedResult.firstStageMetrics,
			hasDetailApiMetrics: !!formattedResult.detailApiMetrics,
			singleRawResponseId: singleRawResponseId,
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
