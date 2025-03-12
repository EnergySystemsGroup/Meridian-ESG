import { ChatAnthropic } from '@langchain/anthropic';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import {
	createSupabaseClient,
	logAgentExecution,
	logApiActivity,
} from '../supabase';
import {
	makeApiRequest,
	makePaginatedApiRequest,
	getNestedValue,
} from '../apiRequest';
import { z } from 'zod';

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

// Create the prompt template for the standard API handler
const standardHandlerPromptTemplate = PromptTemplate.fromTemplate(`
You are the API Handler Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to analyze the following API response from {sourceName} and extract all funding opportunities that match our criteria.

For context, this source typically provides funding for:
{sourceFocus}

API RESPONSE:
{apiResponse}

For each funding opportunity you identify, extract the following information:
1. Title
2. Description
3. Funding type (grant, loan, incentive, etc.)
4. Agency/organization providing the funding
5. Total funding amount (if available)
6. Minimum and maximum award amounts (if available)
7. Application open and close dates
8. Eligibility requirements
9. URL for more information
10. Matching fund requirements
11. Relevant categories from our taxonomy
12. Current status (open, upcoming, closed)

If information is not explicitly provided, use your judgment to infer it from context, and assign a confidence score to each field.

Our funding categories include:
- Energy efficiency and conservation
- Renewable energy generation
- Energy storage and battery systems
- Building modernization and retrofits
- HVAC systems and technologies
- Building envelope improvements
- Lighting systems and controls
- Building automation and smart building technologies
- Electric vehicle infrastructure and charging
- Climate adaptation and resilience
- Water conservation and efficiency
- Sustainable transportation

{formatInstructions}
`);

// Create the prompt template for the document API handler
const documentHandlerPromptTemplate = PromptTemplate.fromTemplate(`
You are the Document API Handler Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to analyze the following document-style API response from {sourceName} and extract all funding opportunities that match our criteria.

For context, this source typically provides funding for:
{sourceFocus}

DOCUMENT CONTENT:
{apiResponse}

This content may contain one or more funding opportunities described in prose format. Your job is to carefully read through the document and identify any funding opportunities related to energy, buildings, infrastructure, sustainability, or climate.

For each funding opportunity you identify, extract the following information:
1. Title
2. Description
3. Funding type (grant, loan, incentive, etc.)
4. Agency/organization providing the funding
5. Total funding amount (if available)
6. Minimum and maximum award amounts (if available)
7. Application open and close dates
8. Eligibility requirements
9. URL for more information
10. Matching fund requirements
11. Relevant categories from our taxonomy
12. Current status (open, upcoming, closed)

If information is not explicitly provided, use your judgment to infer it from context, and assign a confidence score to each field.

Our funding categories include:
- Energy efficiency and conservation
- Renewable energy generation
- Energy storage and battery systems
- Building modernization and retrofits
- HVAC systems and technologies
- Building envelope improvements
- Lighting systems and controls
- Building automation and smart building technologies
- Electric vehicle infrastructure and charging
- Climate adaptation and resilience
- Water conservation and efficiency
- Sustainable transportation

{formatInstructions}
`);

// Create the prompt template for the state portal API handler
const statePortalHandlerPromptTemplate = PromptTemplate.fromTemplate(`
You are the State Portal API Handler Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to analyze the following state portal API response from {sourceName} and extract all funding opportunities that match our criteria.

For context, this source typically provides funding for:
{sourceFocus}

STATE PORTAL RESPONSE:
{apiResponse}

State portals often have unique structures and terminology. Look for grants, incentives, rebates, loans, or other funding programs related to energy, buildings, infrastructure, sustainability, or climate.

For each funding opportunity you identify, extract the following information:
1. Title
2. Description
3. Funding type (grant, loan, incentive, etc.)
4. Agency/organization providing the funding
5. Total funding amount (if available)
6. Minimum and maximum award amounts (if available)
7. Application open and close dates
8. Eligibility requirements
9. URL for more information
10. Matching fund requirements
11. Relevant categories from our taxonomy
12. Current status (open, upcoming, closed)

If information is not explicitly provided, use your judgment to infer it from context, and assign a confidence score to each field.

Our funding categories include:
- Energy efficiency and conservation
- Renewable energy generation
- Energy storage and battery systems
- Building modernization and retrofits
- HVAC systems and technologies
- Building envelope improvements
- Lighting systems and controls
- Building automation and smart building technologies
- Electric vehicle infrastructure and charging
- Climate adaptation and resilience
- Water conservation and efficiency
- Sustainable transportation

{formatInstructions}
`);

// Create the prompt template specifically for Grants.gov
const grantsGovHandlerPromptTemplate = PromptTemplate.fromTemplate(`
You are the Grants.gov API Handler Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to analyze the following API response from Grants.gov and extract all funding opportunities that match our criteria.

The Grants.gov API response includes both search results and detailed information for each opportunity. The search results are in the "oppHits" array, and the detailed information is nested within each opportunity under the "details" property.

API RESPONSE:
{apiResponse}

For each funding opportunity you identify, extract the following information:
1. Title - Use the "opportunityTitle" field
2. Description - Use the "synopsisDesc" field from the details
3. Funding type - Usually "grant" or based on "fundingInstruments" in the details
4. Agency - Use the "agency" or "agencyName" field
5. Total funding amount - Use "estimatedFunding" if available
6. Minimum award amount - Use "awardFloor" if available
7. Maximum award amount - Use "awardCeiling" if available
8. Application open date - Use "openDate" or "postingDate"
9. Application close date - Use "closeDate" or "responseDate"
10. Eligibility requirements - Extract from "applicantTypes" or "applicantEligibilityDesc"
11. URL - Construct from the opportunity number or use provided URLs
12. Matching fund requirements - Check for "costSharing" field
13. Relevant categories - Map from "fundingActivityCategories" to our taxonomy
14. Current status - Determine from "oppStatus" and dates

Our funding categories include:
- Energy efficiency and conservation
- Renewable energy generation
- Energy storage and battery systems
- Building modernization and retrofits
- HVAC systems and technologies
- Building envelope improvements
- Lighting systems and controls
- Building automation and smart building technologies
- Electric vehicle infrastructure and charging
- Climate adaptation and resilience
- Water conservation and efficiency
- Sustainable transportation

{formatInstructions}
`);

/**
 * Makes an API request and stores the raw response
 * @param {Object} source - The API source information
 * @param {Object} processingDetails - Details from the Source Manager Agent
 * @returns {Promise<Object>} - The API response and raw response ID
 */
async function makeAndStoreApiRequest(source, processingDetails) {
	const supabase = createSupabaseClient();

	try {
		// Determine if pagination is needed
		const paginationConfig = source.configurations?.pagination_config;

		// Get request configuration if available
		const requestConfig = source.configurations?.request_config || {};
		const method = requestConfig.method || 'GET';
		const headers = requestConfig.headers || {};

		// Special handling for Grants.gov
		if (source.name === 'Grants.gov') {
			console.log('Using special handling for Grants.gov API');

			// Step 1: Make the search request
			console.log('Making search request to Grants.gov API');
			const searchResponse = await makeApiRequest(
				processingDetails.apiEndpoint,
				{}, // Empty query params for POST request
				processingDetails.authMethod,
				processingDetails.authDetails,
				headers,
				'POST', // Always use POST for Grants.gov
				processingDetails.queryParameters // Send query params in the request body
			);

			console.log('Search response received:', searchResponse.status);

			// Extract opportunities from the search response
			const opportunities =
				getNestedValue(searchResponse.data, 'data.oppHits') || [];
			console.log(
				`Found ${opportunities.length} opportunities in search results`
			);

			// Step 2: If detail_config is enabled, fetch details for each opportunity
			const detailConfig = source.configurations?.detail_config;
			const detailedOpportunities = [];

			if (detailConfig && detailConfig.enabled && opportunities.length > 0) {
				console.log('Fetching detailed information for opportunities...');

				// Limit to first 10 opportunities for testing
				const limitedOpportunities = opportunities.slice(0, 10);

				for (const opportunity of limitedOpportunities) {
					// Get the opportunity ID
					const opportunityId = opportunity[detailConfig.idField];
					if (!opportunityId) {
						console.warn(
							`No ID found for opportunity: ${JSON.stringify(opportunity)}`
						);
						continue;
					}

					console.log(`Fetching details for opportunity ${opportunityId}`);

					// Prepare the request body
					const detailParams = {
						[detailConfig.idParam]: opportunityId,
					};

					try {
						// Make the detail request
						const detailResponse = await makeApiRequest(
							detailConfig.endpoint,
							{},
							processingDetails.authMethod,
							processingDetails.authDetails,
							detailConfig.headers || headers,
							detailConfig.method || 'POST',
							detailParams
						);

						// Add the detailed information to the opportunity
						detailedOpportunities.push({
							...opportunity,
							details: detailResponse.data,
						});

						console.log(
							`Successfully fetched details for opportunity ${opportunityId}`
						);
					} catch (detailError) {
						console.error(
							`Error fetching details for opportunity ${opportunityId}:`,
							detailError
						);
						// Add the opportunity without details
						detailedOpportunities.push(opportunity);
					}
				}
			}

			// Store the raw response with the detailed opportunities
			const responseData =
				detailedOpportunities.length > 0
					? detailedOpportunities
					: opportunities;

			const { data: rawResponse, error } = await supabase
				.from('api_raw_responses')
				.insert({
					source_id: source.id,
					content: responseData,
					request_details: {
						url: processingDetails.apiEndpoint,
						method: 'POST',
						body: processingDetails.queryParameters,
						headers: headers,
					},
				})
				.select('id')
				.single();

			if (error) {
				throw error;
			}

			return {
				response: { data: responseData },
				rawResponseId: rawResponse.id,
			};
		}

		// Standard handling for other APIs
		let response;
		if (paginationConfig && paginationConfig.enabled) {
			// Make a paginated request
			response = await makePaginatedApiRequest({
				url: processingDetails.apiEndpoint,
				params: processingDetails.queryParameters,
				authType: processingDetails.authMethod,
				authDetails: processingDetails.authDetails,
				paginationConfig,
				method,
				headers,
				data: method === 'POST' ? processingDetails.queryParameters : null,
			});
		} else {
			// Make a single request
			response = await makeApiRequest(
				processingDetails.apiEndpoint,
				processingDetails.queryParameters,
				processingDetails.authMethod,
				processingDetails.authDetails,
				headers,
				method,
				method === 'POST' ? processingDetails.queryParameters : null
			);
		}

		// Step 2: If detail_config is enabled, fetch details for each opportunity
		const detailConfig = source.configurations?.detail_config;
		if (detailConfig && detailConfig.enabled) {
			console.log('Fetching detailed information for opportunities...');

			// Get the list of opportunities from the response
			let opportunities = [];
			if (paginationConfig && paginationConfig.enabled) {
				opportunities = response.data;
			} else {
				const responseDataPath =
					paginationConfig?.responseDataPath || 'oppHits';
				opportunities = getNestedValue(response.data, responseDataPath) || [];
			}

			// Fetch details for each opportunity
			const detailedOpportunities = [];
			for (const opportunity of opportunities) {
				// Get the opportunity ID
				const opportunityId = opportunity[detailConfig.idField];
				if (!opportunityId) {
					console.warn(
						`No ID found for opportunity: ${JSON.stringify(opportunity)}`
					);
					continue;
				}

				// Prepare the request body
				const detailParams = {
					[detailConfig.idParam]: opportunityId,
				};

				try {
					// Make the detail request
					const detailResponse = await makeApiRequest(
						detailConfig.endpoint,
						{},
						processingDetails.authMethod,
						processingDetails.authDetails,
						detailConfig.headers || headers,
						detailConfig.method || 'POST',
						detailParams
					);

					// Add the detailed information to the opportunity
					detailedOpportunities.push({
						...opportunity,
						details: detailResponse.data,
					});
				} catch (detailError) {
					console.error(
						`Error fetching details for opportunity ${opportunityId}:`,
						detailError
					);
					// Add the opportunity without details
					detailedOpportunities.push(opportunity);
				}
			}

			// Replace the original opportunities with the detailed ones
			if (paginationConfig && paginationConfig.enabled) {
				response.data = detailedOpportunities;
			} else {
				// Update the nested data
				const responseDataPath =
					paginationConfig?.responseDataPath || 'oppHits';
				const pathParts = responseDataPath.split('.');
				let current = response.data;

				// Navigate to the parent object
				for (let i = 0; i < pathParts.length - 1; i++) {
					if (!current[pathParts[i]]) {
						current[pathParts[i]] = {};
					}
					current = current[pathParts[i]];
				}

				// Update the opportunities array
				current[pathParts[pathParts.length - 1]] = detailedOpportunities;
			}
		}

		// Store the raw response
		const { data: rawResponse, error } = await supabase
			.from('api_raw_responses')
			.insert({
				source_id: source.id,
				content: response.data,
				request_details: response.requestDetails,
			})
			.select('id')
			.single();

		if (error) {
			throw error;
		}

		return {
			response,
			rawResponseId: rawResponse.id,
		};
	} catch (error) {
		console.error('Error making API request:', error);

		// Log the API activity with error
		await logApiActivity(supabase, source.id, 'api_check', 'failure', {
			error: String(error),
		});

		throw error;
	}
}

/**
 * Extracts funding opportunities from an API response
 * @param {Object} source - The API source information
 * @param {Object} processingDetails - Details from the Source Manager Agent
 * @param {Object} apiResponse - The API response
 * @param {string} rawResponseId - The ID of the stored raw response
 * @returns {Promise<Array>} - The extracted opportunities
 */
async function extractOpportunities(
	source,
	processingDetails,
	apiResponse,
	rawResponseId
) {
	const startTime = Date.now();
	const supabase = createSupabaseClient();

	try {
		// Check if Anthropic API key is available
		if (
			!process.env.ANTHROPIC_API_KEY ||
			process.env.ANTHROPIC_API_KEY.includes('xxxxxxxx')
		) {
			console.log(
				'No valid Anthropic API key found. Using mock response for API Handler Agent.'
			);

			// Return a mock opportunity for testing purposes
			const mockOpportunity = {
				title: 'Sample Funding Opportunity',
				description:
					'This is a mock opportunity generated for testing purposes.',
				fundingType: 'grant',
				agency: source.name || 'Sample Agency',
				totalFunding: 1000000,
				minAward: 50000,
				maxAward: 200000,
				openDate: new Date().toISOString(),
				closeDate: new Date(
					Date.now() + 30 * 24 * 60 * 60 * 1000
				).toISOString(),
				eligibility: ['Municipal', 'Nonprofit'],
				url: source.url || 'https://example.com',
				matchingRequired: false,
				categories: ['Energy efficiency and conservation'],
				status: 'open',
				confidence: 100,
			};

			// Store the mock opportunity
			await supabase.from('api_extracted_opportunities').insert({
				raw_response_id: rawResponseId,
				source_id: source.id,
				data: mockOpportunity,
				confidence_score: 100,
			});

			return [mockOpportunity];
		}

		// Initialize the LLM
		const model = new ChatAnthropic({
			temperature: 0,
			modelName: 'claude-3-5-haiku-20241022',
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		});

		// Create the output parser
		const parser = StructuredOutputParser.fromZodSchema(
			z.array(fundingOpportunitySchema)
		);
		const formatInstructions = parser.getFormatInstructions();

		// Select the appropriate prompt template based on the source and handler type
		let promptTemplate;
		if (source.name === 'Grants.gov') {
			// Use the Grants.gov-specific prompt template
			promptTemplate = grantsGovHandlerPromptTemplate;
		} else {
			// Use the standard prompt templates based on handler type
			switch (processingDetails.handlerType) {
				case 'document':
					promptTemplate = documentHandlerPromptTemplate;
					break;
				case 'statePortal':
					promptTemplate = statePortalHandlerPromptTemplate;
					break;
				case 'standard':
				default:
					promptTemplate = standardHandlerPromptTemplate;
					break;
			}
		}

		// Create the prompt
		const prompt = await promptTemplate.format({
			sourceName: source.name,
			sourceFocus: source.notes || 'various energy and infrastructure projects',
			apiResponse: JSON.stringify(apiResponse.data, null, 2),
			formatInstructions,
		});

		// Get the LLM response
		const response = await model.invoke(prompt);

		// Parse the response
		const opportunities = await parser.parse(response.content);

		// Calculate execution time
		const executionTime = Date.now() - startTime;

		// Log the agent execution
		await logAgentExecution(
			supabase,
			'api_handler',
			{
				source: source.id,
				handlerType: processingDetails.handlerType,
			},
			{ opportunitiesCount: opportunities.length },
			executionTime,
			{
				promptTokens: response.usage?.prompt_tokens,
				completionTokens: response.usage?.completion_tokens,
			}
		);

		// Store each extracted opportunity
		for (const opportunity of opportunities) {
			await supabase.from('api_extracted_opportunities').insert({
				raw_response_id: rawResponseId,
				source_id: source.id,
				data: opportunity,
				confidence_score: opportunity.confidence,
			});
		}

		return opportunities;
	} catch (error) {
		// Calculate execution time even if there was an error
		const executionTime = Date.now() - startTime;

		// Log the error
		console.error('Error extracting opportunities:', error);

		// Log the agent execution with error
		await logAgentExecution(
			supabase,
			'api_handler',
			{
				source: source.id,
				handlerType: processingDetails.handlerType,
			},
			null,
			executionTime,
			{},
			error
		);

		throw error;
	}
}

/**
 * API Handler Agent that processes an API source and extracts opportunities
 * @param {Object} source - The API source information
 * @param {Object} processingDetails - Details from the Source Manager Agent
 * @returns {Promise<Object>} - The processing results
 */
export async function apiHandlerAgent(source, processingDetails) {
	const supabase = createSupabaseClient();

	try {
		// Make the API request and store the raw response
		const { response, rawResponseId } = await makeAndStoreApiRequest(
			source,
			processingDetails
		);

		// Extract opportunities from the response
		const opportunities = await extractOpportunities(
			source,
			processingDetails,
			response,
			rawResponseId
		);

		// Log the API activity
		await logApiActivity(supabase, source.id, 'processing', 'success', {
			opportunitiesCount: opportunities.length,
			rawResponseId,
		});

		return {
			opportunities,
			rawResponseId,
			source: source.id,
		};
	} catch (error) {
		// Log the API activity with error
		await logApiActivity(supabase, source.id, 'processing', 'failure', {
			error: String(error),
		});

		throw error;
	}
}
