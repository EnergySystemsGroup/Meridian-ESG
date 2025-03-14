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
					.string()
					.optional()
					.nullable()
					.describe('Eligibility requirements'),
				url: z
					.string()
					.optional()
					.nullable()
					.describe('URL to the opportunity details'),
				sourceId: z
					.string()
					.describe('ID of the source this opportunity came from'),
				externalId: z
					.string()
					.optional()
					.nullable()
					.describe('External ID from the source system'),
				rawData: z.any().optional().describe('Raw data from the API response'),
			})
		)
		.describe('Array of funding opportunities extracted from the API response'),
	totalCount: z.number().describe('Total number of opportunities found'),
	nextCursor: z
		.string()
		.optional()
		.nullable()
		.describe('Cursor for the next page of results'),
	reasoning: z
		.string()
		.describe('Brief explanation of how you processed the data'),
});

// Create the prompt template for standard API handler
const standardApiPromptTemplate = PromptTemplate.fromTemplate(`
You are the API Handler Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to process the following API response and extract structured funding opportunity data.

SOURCE INFORMATION:
{sourceInfo}

API RESPONSE:
{apiResponse}

RESPONSE MAPPING:
{responseMapping}

Based on this information, extract all funding opportunities from the API response.
Use the response mapping to map fields from the API response to our standard fields.
If a field is not available in the API response, leave it as null or undefined.

{formatInstructions}
`);

// Create the prompt template for first-stage filtering (two-step API sources)
const firstStageFilteringPromptTemplate = PromptTemplate.fromTemplate(`
You are an expert funding opportunity analyst for energy and infrastructure projects.
Your task is to analyze a list of funding opportunities and identify those most relevant to our organization's focus areas.

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
- Energy & Buildings
- Transportation & Mobility
- Water & Resources
- Climate & Resilience
- Community & Economic Development
- Infrastructure & Planning

For each opportunity in the provided list, assign a relevance score from 1-10 based on:
1. Alignment with our focus areas (0-5 points)
2. Applicability to our client types (0-3 points)
3. Funding amount and accessibility (0-2 points)

If information is limited, use the title and/or description, or any available information to make a determination as to how relevant the opportunity is to our organization. In the absence of information, make assumptions to lean on the side of inclusion.

Only opportunities scoring 6 or higher should proceed to detailed analysis.

For each selected opportunity, provide:
1. Opportunity ID
2. Title
3. Relevance score
4. Brief justification (1-2 sentences)

Source Information:
{sourceInfo}

API Response:
{apiResponse}

{formatInstructions}
`);

// Create the prompt template for document handler
const documentApiPromptTemplate = PromptTemplate.fromTemplate(`
You are the Document Handler Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to process the following document content and extract structured funding opportunity data.

SOURCE INFORMATION:
{sourceInfo}

DOCUMENT CONTENT:
{documentContent}

Based on this information, extract all funding opportunities from the document.
Look for key information such as:
- Opportunity title
- Description
- Funding amount
- Eligibility requirements
- Application deadlines
- Contact information

{formatInstructions}
`);

// Create the prompt template for state portal handler
const statePortalPromptTemplate = PromptTemplate.fromTemplate(`
You are the State Portal Handler Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to process the following state portal content and extract structured funding opportunity data.

SOURCE INFORMATION:
{sourceInfo}

PORTAL CONTENT:
{portalContent}

Based on this information, extract all funding opportunities from the state portal.
State portals often have unique structures, so look carefully for:
- Grant programs
- Loan programs
- Incentives
- Rebates
- Technical assistance programs

{formatInstructions}
`);

/**
 * Makes an API request with the given configuration
 * @param {Object} config - The API request configuration
 * @returns {Promise<Object>} - The API response
 */
async function makeConfiguredApiRequest(config) {
	try {
		const response = await axios({
			method: config.method || 'GET',
			url: config.url,
			params: config.queryParameters,
			data: config.requestBody,
			headers: config.headers || {},
		});

		return response.data;
	} catch (error) {
		console.error('API request error:', error);
		throw error;
	}
}

/**
 * Extracts data from a nested object using a path string
 * @param {Object} obj - The object to extract data from
 * @param {String} path - The path to the data (e.g., "data.items")
 * @returns {Any} - The extracted data
 */
function extractDataByPath(obj, path) {
	if (!path) return obj;

	const keys = path.split('.');
	let result = obj;

	for (const key of keys) {
		if (result === null || result === undefined) return undefined;
		result = result[key];
	}

	return result;
}

/**
 * Processes a paginated API response
 * @param {Object} source - The API source
 * @param {Object} processingDetails - The processing details from the source manager
 * @returns {Promise<Array>} - The combined results from all pages
 */
async function processPaginatedApi(source, processingDetails) {
	const results = [];
	const paginationConfig = processingDetails.paginationConfig;
	const detailConfig = processingDetails.detailConfig;

	if (!paginationConfig || !paginationConfig.enabled) {
		// If pagination is not enabled, make a single request
		const response = await makeConfiguredApiRequest({
			method: processingDetails.requestConfig.method,
			url: processingDetails.apiEndpoint,
			queryParameters: processingDetails.queryParameters,
			requestBody: processingDetails.requestBody,
			headers: processingDetails.requestConfig.headers,
		});

		// If detail config is enabled, fetch details for each item
		if (detailConfig && detailConfig.enabled && response) {
			const items = extractDataByPath(
				response,
				paginationConfig?.responseDataPath || ''
			);
			if (Array.isArray(items)) {
				const detailedItems = [];
				for (const item of items) {
					const itemId = extractDataByPath(item, detailConfig.idField);
					if (itemId) {
						try {
							const detailRequestBody = {};
							detailRequestBody[detailConfig.idParam] = itemId;

							const detailResponse = await makeConfiguredApiRequest({
								method: detailConfig.method || 'GET',
								url: detailConfig.endpoint,
								queryParameters: {},
								requestBody: detailRequestBody,
								headers:
									detailConfig.headers ||
									processingDetails.requestConfig.headers,
							});

							detailedItems.push({
								...item,
								_detailResponse: detailResponse,
							});
						} catch (error) {
							console.error(
								`Error fetching details for item ${itemId}:`,
								error
							);
							detailedItems.push(item); // Keep the original item if detail fetch fails
						}
					} else {
						detailedItems.push(item);
					}
				}

				// Replace the items in the response with the detailed items
				const responseDataPath = paginationConfig?.responseDataPath || '';
				if (responseDataPath) {
					const pathParts = responseDataPath.split('.');
					let current = response;
					for (let i = 0; i < pathParts.length - 1; i++) {
						current = current[pathParts[i]];
					}
					current[pathParts[pathParts.length - 1]] = detailedItems;
				}
			}
		}

		return [response];
	}

	// Initialize pagination variables
	let currentPage = 0;
	let hasMorePages = true;
	let offset = 0;
	let cursor = null;

	// Get the page size
	const pageSize = paginationConfig.pageSize || 100;
	const maxPages = paginationConfig.maxPages || 5;

	while (hasMorePages && currentPage < maxPages) {
		// Prepare query parameters for this page
		const queryParams = { ...processingDetails.queryParameters };

		// Add pagination parameters based on the pagination type
		if (paginationConfig.type === 'offset') {
			queryParams[paginationConfig.limitParam] = pageSize;
			queryParams[paginationConfig.offsetParam] = offset;
		} else if (paginationConfig.type === 'page') {
			queryParams[paginationConfig.limitParam] = pageSize;
			queryParams[paginationConfig.pageParam] = currentPage + 1; // Pages usually start at 1
		} else if (paginationConfig.type === 'cursor' && cursor) {
			queryParams[paginationConfig.limitParam] = pageSize;
			queryParams[paginationConfig.cursorParam] = cursor;
		}

		// Make the API request
		const response = await makeConfiguredApiRequest({
			method: processingDetails.requestConfig.method,
			url: processingDetails.apiEndpoint,
			queryParameters: queryParams,
			requestBody: processingDetails.requestBody,
			headers: processingDetails.requestConfig.headers,
		});

		// If detail config is enabled, fetch details for each item
		if (detailConfig && detailConfig.enabled && response) {
			const items = extractDataByPath(
				response,
				paginationConfig.responseDataPath
			);
			if (Array.isArray(items)) {
				const detailedItems = [];
				for (const item of items) {
					const itemId = extractDataByPath(item, detailConfig.idField);
					if (itemId) {
						try {
							const detailRequestBody = {};
							detailRequestBody[detailConfig.idParam] = itemId;

							const detailResponse = await makeConfiguredApiRequest({
								method: detailConfig.method || 'GET',
								url: detailConfig.endpoint,
								queryParameters: {},
								requestBody: detailRequestBody,
								headers:
									detailConfig.headers ||
									processingDetails.requestConfig.headers,
							});

							detailedItems.push({
								...item,
								_detailResponse: detailResponse,
							});
						} catch (error) {
							console.error(
								`Error fetching details for item ${itemId}:`,
								error
							);
							detailedItems.push(item); // Keep the original item if detail fetch fails
						}
					} else {
						detailedItems.push(item);
					}
				}

				// Replace the items in the response with the detailed items
				const pathParts = paginationConfig.responseDataPath.split('.');
				let current = response;
				for (let i = 0; i < pathParts.length - 1; i++) {
					current = current[pathParts[i]];
				}
				current[pathParts[pathParts.length - 1]] = detailedItems;
			}
		}

		// Add the response to the results
		results.push(response);

		// Extract the data and total count
		const data = extractDataByPath(response, paginationConfig.responseDataPath);
		const totalCount = extractDataByPath(
			response,
			paginationConfig.totalCountPath
		);

		// Update pagination variables
		currentPage++;

		if (paginationConfig.type === 'offset') {
			offset += pageSize;
			hasMorePages = data && data.length > 0 && offset < totalCount;
		} else if (paginationConfig.type === 'page') {
			hasMorePages =
				data && data.length > 0 && currentPage * pageSize < totalCount;
		} else if (paginationConfig.type === 'cursor') {
			// For cursor-based pagination, we need to extract the next cursor from the response
			// This is highly API-specific, so we'll assume it's in the response as "nextCursor"
			cursor = response.nextCursor || response.next_cursor;
			hasMorePages = !!cursor && data && data.length > 0;
		}
	}

	return results;
}

/**
 * Processes an API source using the appropriate handler
 * @param {Object} source - The API source
 * @param {Object} processingDetails - The processing details from the source manager
 * @returns {Promise<Object>} - The processed opportunities
 */
export async function apiHandlerAgent(source, processingDetails) {
	const startTime = Date.now();
	const supabase = createSupabaseClient();

	try {
		// Initialize the LLM
		const model = new ChatAnthropic({
			temperature: 0,
			modelName: 'claude-3-5-haiku-20241022',
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		});

		// Create the output parser
		const parser = StructuredOutputParser.fromZodSchema(
			apiResponseProcessingSchema
		);
		const formatInstructions = parser.getFormatInstructions();

		// Select the appropriate handler based on the handler type
		let promptTemplate;
		let promptVariables = {
			sourceInfo: JSON.stringify(source, null, 2),
			formatInstructions,
		};

		let apiResponses;
		let rawResponseId;
		let allOpportunities = [];
		let totalCount = 0;

		// Process the API based on the handler type
		if (processingDetails.handlerType === 'standard') {
			// Process a standard API
			try {
				// For Grants.gov API, handle pagination manually
				if (source.name === 'Grants.gov') {
					console.log('Processing Grants.gov API source');

					// Get pagination configuration
					const paginationConfig = processingDetails.paginationConfig;
					const pageSize = paginationConfig?.pageSize || 100;
					const maxPages = paginationConfig?.maxPages || 20;

					// Initialize responses array
					apiResponses = [];

					// Make first request to get total count
					console.log('Making initial request to Grants.gov API...');
					const firstResponse = await axios({
						method: processingDetails.requestConfig.method,
						url: processingDetails.apiEndpoint,
						data: processingDetails.requestBody,
						headers: processingDetails.requestConfig.headers || {},
					});

					apiResponses.push(firstResponse.data);

					// Extract total count and first page of opportunities
					if (firstResponse.data && firstResponse.data.data) {
						totalCount = firstResponse.data.data.hitCount || 0;
						console.log(
							`API reports total of ${totalCount} opportunities available`
						);

						if (
							firstResponse.data.data.oppHits &&
							Array.isArray(firstResponse.data.data.oppHits)
						) {
							allOpportunities = [...firstResponse.data.data.oppHits];
							console.log(
								`First page: fetched ${allOpportunities.length} opportunities`
							);
						}

						// Calculate number of pages needed
						const totalPages = Math.min(
							maxPages,
							Math.ceil(totalCount / pageSize)
						);
						console.log(`Will fetch up to ${totalPages} pages of results`);

						// Fetch remaining pages
						for (let page = 1; page < totalPages; page++) {
							// Create request body with updated startRecordNum
							const pageRequestBody = {
								...processingDetails.requestBody,
								startRecordNum: page * pageSize,
							};

							console.log(
								`Fetching page ${page + 1}/${totalPages}, starting at record ${
									page * pageSize
								}`
							);

							try {
								const pageResponse = await axios({
									method: processingDetails.requestConfig.method,
									url: processingDetails.apiEndpoint,
									data: pageRequestBody,
									headers: processingDetails.requestConfig.headers || {},
								});

								apiResponses.push(pageResponse.data);

								// Extract opportunities from this page
								if (
									pageResponse.data &&
									pageResponse.data.data &&
									pageResponse.data.data.oppHits &&
									Array.isArray(pageResponse.data.data.oppHits)
								) {
									const pageOpps = pageResponse.data.data.oppHits;
									allOpportunities = [...allOpportunities, ...pageOpps];
									console.log(
										`Page ${page + 1}: fetched ${
											pageOpps.length
										} opportunities. Running total: ${allOpportunities.length}`
									);
								} else {
									console.log(
										`Page ${page + 1}: No opportunities found in response`
									);
								}
							} catch (pageError) {
								console.error(`Error fetching page ${page + 1}:`, pageError);
								// Continue with the opportunities we have so far
								break;
							}
						}

						console.log(
							`FINAL COUNT: Total opportunities fetched: ${allOpportunities.length} out of ${totalCount} reported by API`
						);

						// Log the first 5 opportunity titles to verify content
						console.log('Sample of opportunities fetched:');
						allOpportunities.slice(0, 5).forEach((opp, index) => {
							console.log(
								`  ${index + 1}. ${opp.title || opp.id || 'Untitled'}`
							);
						});

						// Log the last 5 opportunity titles to verify we have different content
						if (allOpportunities.length > 10) {
							console.log('Last few opportunities fetched:');
							allOpportunities.slice(-5).forEach((opp, index) => {
								const realIndex = allOpportunities.length - 5 + index;
								console.log(
									`  ${realIndex + 1}. ${opp.title || opp.id || 'Untitled'}`
								);
							});
						}
					} else {
						console.log('No opportunities found in Grants.gov API response');
						console.log(
							'Response structure:',
							JSON.stringify(firstResponse.data, null, 2).substring(0, 500) +
								'...'
						);
					}
				} else {
					// For other APIs, use the standard pagination process
					apiResponses = await processPaginatedApi(source, processingDetails);

					// Extract all opportunities from all pages
					if (Array.isArray(apiResponses) && apiResponses.length > 0) {
						const responseDataPath =
							processingDetails.paginationConfig?.responseDataPath || '';
						const totalCountPath =
							processingDetails.paginationConfig?.totalCountPath || '';

						// Get total count from the first page
						if (totalCountPath && apiResponses[0]) {
							totalCount =
								extractDataByPath(apiResponses[0], totalCountPath) || 0;
						}

						// Extract opportunities from each page
						for (const response of apiResponses) {
							const pageOpportunities = extractDataByPath(
								response,
								responseDataPath
							);
							if (Array.isArray(pageOpportunities)) {
								allOpportunities = [...allOpportunities, ...pageOpportunities];
							}
						}

						console.log(
							`Extracted ${allOpportunities.length} total opportunities from ${apiResponses.length} pages (API reported total: ${totalCount})`
						);
					}
				}
			} catch (apiError) {
				console.error('Error making API request:', apiError);
				throw apiError;
			}

			// Store the raw response in the database
			const { data: rawResponse, error: rawResponseError } = await supabase
				.from('api_raw_responses')
				.insert({
					source_id: source.id,
					content: apiResponses,
					request_details: {
						url: processingDetails.apiEndpoint,
						method: processingDetails.requestConfig.method,
						params: processingDetails.queryParameters,
						body: processingDetails.requestBody,
						headers: processingDetails.requestConfig.headers,
					},
				})
				.select('id')
				.single();

			if (rawResponseError) {
				console.error('Error storing raw response:', rawResponseError);
			} else {
				rawResponseId = rawResponse.id;
			}

			// Check if this is a two-step API source
			const isDetailEnabled =
				processingDetails.detailConfig &&
				processingDetails.detailConfig.enabled;

			if (isDetailEnabled) {
				// For two-step API sources, use the first-stage filtering prompt
				promptTemplate = firstStageFilteringPromptTemplate;
			} else {
				// For single-API sources, use the comprehensive filtering prompt
				promptTemplate = standardApiPromptTemplate;
			}

			promptVariables.apiResponse = JSON.stringify(
				{
					totalCount: totalCount || allOpportunities.length,
					opportunities: allOpportunities,
				},
				null,
				2
			);
			promptVariables.responseMapping = JSON.stringify(
				processingDetails.responseMapping || {},
				null,
				2
			);
		} else if (processingDetails.handlerType === 'document') {
			// Process a document API
			// This would typically involve downloading and extracting text from documents
			// For simplicity, we'll assume the API returns document content directly
			const response = await makeConfiguredApiRequest({
				method: processingDetails.requestConfig.method,
				url: processingDetails.apiEndpoint,
				queryParameters: processingDetails.queryParameters,
				requestBody: processingDetails.requestBody,
				headers: processingDetails.requestConfig.headers,
			});

			// Store the raw response in the database
			const { data: rawResponse, error: rawResponseError } = await supabase
				.from('api_raw_responses')
				.insert({
					source_id: source.id,
					content: response,
					request_details: {
						url: processingDetails.apiEndpoint,
						method: processingDetails.requestConfig.method,
						params: processingDetails.queryParameters,
						body: processingDetails.requestBody,
						headers: processingDetails.requestConfig.headers,
					},
				})
				.select('id')
				.single();

			if (rawResponseError) {
				console.error('Error storing raw response:', rawResponseError);
			} else {
				rawResponseId = rawResponse.id;
			}

			promptTemplate = documentApiPromptTemplate;
			promptVariables.documentContent = JSON.stringify(response, null, 2);
		} else if (processingDetails.handlerType === 'statePortal') {
			// Process a state portal
			// This would typically involve web scraping or specialized handling
			// For simplicity, we'll assume the API returns portal content directly
			const response = await makeConfiguredApiRequest({
				method: processingDetails.requestConfig.method,
				url: processingDetails.apiEndpoint,
				queryParameters: processingDetails.queryParameters,
				requestBody: processingDetails.requestBody,
				headers: processingDetails.requestConfig.headers,
			});

			// Store the raw response in the database
			const { data: rawResponse, error: rawResponseError } = await supabase
				.from('api_raw_responses')
				.insert({
					source_id: source.id,
					content: response,
					request_details: {
						url: processingDetails.apiEndpoint,
						method: processingDetails.requestConfig.method,
						params: processingDetails.queryParameters,
						body: processingDetails.requestBody,
						headers: processingDetails.requestConfig.headers,
					},
				})
				.select('id')
				.single();

			if (rawResponseError) {
				console.error('Error storing raw response:', rawResponseError);
			} else {
				rawResponseId = rawResponse.id;
			}

			promptTemplate = statePortalPromptTemplate;
			promptVariables.portalContent = JSON.stringify(response, null, 2);
		} else {
			throw new Error(
				`Unsupported handler type: ${processingDetails.handlerType}`
			);
		}

		// Create the prompt
		const prompt = await promptTemplate.format(promptVariables);

		// Get the LLM response
		const response = await model.invoke(prompt);

		// Parse the response
		const parsedOutput = await parser.parse(response.content);

		// Add the source ID and raw response ID to each opportunity
		parsedOutput.opportunities = parsedOutput.opportunities.map(
			(opportunity) => ({
				...opportunity,
				sourceId: source.id,
				rawResponseId: rawResponseId,
			})
		);

		// Calculate execution time
		const executionTime = Date.now() - startTime;

		// Log the agent execution
		await logAgentExecution(
			supabase,
			'api_handler',
			{ source, processingDetails },
			parsedOutput,
			executionTime,
			{
				promptTokens: response.usage?.prompt_tokens,
				completionTokens: response.usage?.completion_tokens,
			}
		);

		// Log the API activity
		await logApiActivity(supabase, source.id, 'api_process', 'success', {
			opportunitiesFound: parsedOutput.opportunities.length,
			totalCount: parsedOutput.totalCount,
			rawResponseId: rawResponseId,
		});

		// Update the last processed timestamp
		await supabase
			.from('api_sources')
			.update({ last_processed: new Date().toISOString() })
			.eq('id', source.id);

		// Store extracted opportunities in the database
		if (parsedOutput.opportunities.length > 0) {
			const opportunitiesToInsert = parsedOutput.opportunities.map(
				(opportunity) => ({
					raw_response_id: rawResponseId,
					source_id: source.id,
					data: opportunity,
					confidence_score: 100, // Default confidence score
				})
			);

			const { error: opportunitiesError } = await supabase
				.from('api_extracted_opportunities')
				.insert(opportunitiesToInsert);

			if (opportunitiesError) {
				console.error(
					'Error storing extracted opportunities:',
					opportunitiesError
				);
			}
		}

		return {
			...parsedOutput,
			rawResponseId,
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
	const { source, processingDetails } = result;
	const handlerResult = await apiHandlerAgent(source, processingDetails);

	// Return the complete result
	return {
		source,
		processingDetails,
		handlerResult,
	};
}
