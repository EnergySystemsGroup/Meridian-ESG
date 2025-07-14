import { ChatAnthropic } from '@langchain/anthropic';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import {
	createSupabaseClient,
	logAgentExecution,
	logApiActivity,
} from '@/lib/supabase';
import { RunManager } from '@/lib/services/runManager';
import { z } from 'zod';

// Define the output schema for the agent
const sourceProcessingSchema = z.object({
	apiEndpoint: z.string().describe('The full URL to call'),
	requestConfig: z
		.object({
			method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
			headers: z.record(z.string()).default({}),
		})
		.describe('HTTP method and headers for the request'),
	queryParameters: z
		.record(z.string())
		.optional()
		.describe('Key-value pairs of parameters to include in the URL'),
	requestBody: z
		.record(z.any())
		.optional()
		.describe('JSON body to send with the request'),
	responseConfig: z
		.object({
			responseDataPath: z.string().optional(),
			totalCountPath: z.string().optional(),
		})
		.optional()
		.describe('Configuration for extracting data from API responses'),
	paginationConfig: z
		.object({
			enabled: z.boolean().default(false),
			type: z
				.enum(['offset', 'page', 'cursor'])
				.optional()
				.nullable()
				.transform((val) => (val === null ? undefined : val)),
			limitParam: z.string().optional(),
			offsetParam: z.string().optional(),
			pageParam: z.string().optional(),
			cursorParam: z.string().optional(),
			pageSize: z.number().optional(),
			maxPages: z.number().optional(),
			inBody: z.boolean().optional(),
			paginationInBody: z.boolean().optional(),
		})
		.describe('Configuration for handling paginated responses'),
	detailConfig: z
		.object({
			enabled: z.boolean().default(false),
			endpoint: z.string().optional(),
			method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
			headers: z.record(z.string()).optional(),
			idField: z.string().optional(),
			idParam: z.string().optional(),
			responseDataPath: z
				.string()
				.nullable()
				.default('data')
				.describe(
					'Path to extract data from the detail response (e.g., "data" or "results.data")'
				),
		})
		.describe('Configuration for fetching detailed information'),
	responseMapping: z
		.record(z.string())
		.optional()
		.describe(
			'Mapping of API response fields to standard fields. Use dot notation for nested fields (e.g., "data.title". leave blank if no mapping is provided in source configurations)'
		),
	apiNotes: z
		.string()
		.optional()
		.describe(
			'Additional notes about the API, such as rate limits, authentication quirks, or special handling requirements'
		),
	authMethod: z
		.enum(['none', 'apikey', 'oauth', 'basic'])
		.describe('How to authenticate'),
	authDetails: z
		.record(z.any())
		.optional()
		.nullable()
		.transform((val) => (val === null ? {} : val))
		.describe('Authentication details like keys, tokens, etc.'),
	handlerType: z
		.enum(['standard', 'document', 'statePortal'])
		.describe('The type of handler to use'),
	reasoning: z
		.string()
		.describe(
			'Document independent output choices outside of the standard input you received'
		),
});

// Create the prompt template
const promptTemplate = PromptTemplate.fromTemplate(`
You are the Source Manager Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to analyze the following API source and determine the best approach for retrieving funding opportunities.

SOURCE INFORMATION:
{sourceInfo}

CONFIGURATIONS:
{configurations}

Based on this information, determine the best approach for retrieving funding opportunities from this source. Consider:
- The type of organization (federal, state, local, utility, private)
- The typical funding programs they offer
- The structure of their API (if documented)
- The frequency of updates
- The relevance to our target funding categories

Be sure to include any important API notes such as:
- Rate limits that might affect our processing
- Authentication quirks or token expiration details
- Special handling requirements for this particular API
- Known issues or limitations with the API
- Best practices for working with this specific API
- Whether this api is a one or multi-step process
- Any other important details that would be helpful for the processing agent

Use the provided configurations if they exist, but feel free to suggest improvements or modifications.

{formatInstructions}
`);

/**
 * Formats the configurations for the prompt
 * @param {Object} source - The API source with configurations
 * @returns {String} - Formatted configurations
 */
function formatConfigurations(source) {
	if (!source.configurations) {
		return 'No configurations found for this source.';
	}

	const configTypes = [
		'query_params',
		'request_body',
		'request_config',
		'pagination_config',
		'detail_config',
		'response_mapping',
	];

	const formattedConfigs = configTypes
		.filter((type) => source.configurations[type])
		.map((type) => {
			return `${type.toUpperCase()}: ${JSON.stringify(
				source.configurations[type],
				null,
				2
			)}`;
		})
		.join('\n\n');

	return (
		formattedConfigs || 'No specific configurations found for this source.'
	);
}

/**
 * Source Manager Agent that determines how to process an API source
 * @param {Object} source - The API source to process
 * @param {Object} runManager - Optional RunManager instance for tracking
 * @returns {Promise<Object>} - The processing details
 */
export async function sourceManagerAgent(source, runManager = null) {
	const supabase = createSupabaseClient();
	const startTime = Date.now();

	try {
		// Format the configurations
		const formattedConfigurations = formatConfigurations(source);

		// Create the output parser
		const parser = StructuredOutputParser.fromZodSchema(sourceProcessingSchema);
		const formatInstructions = parser.getFormatInstructions();

		// Create the model
		const model = new ChatAnthropic({
			temperature: 0,
			modelName: 'claude-3-5-haiku-20241022',
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		});

		// Format the prompt
		const prompt = await promptTemplate.format({
			sourceInfo: JSON.stringify(source, null, 2),
			configurations: formattedConfigurations,
			formatInstructions,
		});

		// Get the LLM response
		const response = await model.invoke(prompt);

		// Parse the response
		const parsedOutput = await parser.parse(response.content);

		// Calculate execution time
		const executionTime = Date.now() - startTime;

		// Log the agent execution
		await logAgentExecution(
			supabase,
			'source_manager',
			{ source },
			parsedOutput,
			executionTime,
			{
				promptTokens: response.usage?.prompt_tokens,
				completionTokens: response.usage?.completion_tokens,
			}
		);

		// Log the API activity
		await logApiActivity(supabase, source.id, 'api_check', 'success', {
			result: parsedOutput,
		});

		// Update the last checked timestamp
		await supabase
			.from('api_sources')
			.update({ last_checked: new Date().toISOString() })
			.eq('id', source.id);

		return parsedOutput;
	} catch (error) {
		// Calculate execution time even if there was an error
		const executionTime = Date.now() - startTime;

		// Log the error
		console.error('Error in Source Manager Agent:', error);

		// Log the agent execution with error
		await logAgentExecution(
			supabase,
			'source_manager',
			{ source },
			null,
			executionTime,
			{},
			error
		);

		// Log the API activity with error
		await logApiActivity(supabase, source.id, 'api_check', 'failure', {
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
 * Gets the next API source to process
 * @returns {Promise<Object|null>} - The next source to process, or null if none
 */
export async function getNextSourceToProcess() {
	const supabase = createSupabaseClient();

	try {
		// Use the database function to get the next source
		const { data, error } = await supabase.rpc(
			'get_next_api_source_to_process'
		);

		if (error) {
			throw error;
		}

		if (data.length > 0) {
			// Fetch the configurations for this source
			const { data: configData, error: configError } = await supabase
				.from('api_source_configurations')
				.select('*')
				.eq('source_id', data[0].id);

			if (configError) {
				throw configError;
			}

			// Group configurations by type
			const configurations = {};
			configData.forEach((config) => {
				configurations[config.config_type] = config.configuration;
			});

			// Add configurations to the source
			data[0].configurations = configurations;
		}

		return data.length > 0 ? data[0] : null;
	} catch (error) {
		console.error('Error getting next source to process:', error);
		return null;
	}
}

/**
 * Processes the next API source in the queue
 * @returns {Promise<Object|null>} - The processing result, or null if no source was processed
 */
export async function processNextSource() {
	// Get the next source to process
	const source = await getNextSourceToProcess();

	if (!source) {
		console.log('No sources to process');
		return null;
	}

	// Create a new run manager
	const runManager = new RunManager();
	await runManager.startRun(source.id);

	try {
		// Process the source with the Source Manager Agent
		const processingDetails = await sourceManagerAgent(source, runManager);

		// Return the source, processing details, and run manager
		return {
			source,
			processingDetails,
			runManager,
		};
	} catch (error) {
		console.error('Error processing source:', error);
		await runManager.updateRunError(error);
		return null;
	}
}
