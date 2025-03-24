import { ChatAnthropic } from '@langchain/anthropic';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import {
	createSupabaseClient,
	logAgentExecution,
	logApiActivity,
} from '../supabase';
import { z } from 'zod';

// Define the processing result schema
const processingResultSchema = z.object({
	action: z
		.enum(['insert', 'update', 'ignore'])
		.describe('The action to take with this opportunity'),
	confidence: z
		.number()
		.min(0)
		.max(100)
		.describe('Confidence score for this decision (0-100)'),
	needsReview: z
		.boolean()
		.describe('Whether this opportunity needs human review'),
	reviewReason: z
		.string()
		.optional()
		.nullable()
		.describe('Reason why this opportunity needs review'),
	normalizedData: z
		.object({
			title: z.string().describe('The title of the funding opportunity'),
			opportunity_number: z
				.string()
				.optional()
				.nullable()
				.describe('The opportunity number/ID from the source'),
			source_name: z.string().describe('The name of the funding source/agency'),
			source_type: z
				.string()
				.optional()
				.nullable()
				.describe('Type of source (federal, state, local, etc.)'),
			min_amount: z
				.number()
				.optional()
				.nullable()
				.describe('The minimum amount of funding available'),
			max_amount: z
				.number()
				.optional()
				.nullable()
				.describe('The maximum amount of funding available'),
			minimum_award: z
				.number()
				.optional()
				.nullable()
				.describe('The minimum award amount'),
			maximum_award: z
				.number()
				.optional()
				.nullable()
				.describe('The maximum award amount'),
			cost_share_required: z
				.boolean()
				.describe('Whether matching funds are required'),
			cost_share_percentage: z
				.number()
				.optional()
				.nullable()
				.describe('The required matching percentage'),
			posted_date: z
				.string()
				.optional()
				.nullable()
				.describe('The date when the opportunity was posted (ISO format)'),
			open_date: z
				.string()
				.optional()
				.nullable()
				.describe('The date when applications open'),
			close_date: z
				.string()
				.optional()
				.nullable()
				.describe('The date when applications close (ISO format)'),
			description: z
				.string()
				.optional()
				.nullable()
				.describe('A description of the funding opportunity'),
			objectives: z
				.string()
				.optional()
				.nullable()
				.describe('The objectives of the funding opportunity'),
			eligibleApplicants: z
				.array(z.string())
				.describe('List of eligible applicant types'),
			eligibleProjectTypes: z
				.array(z.string())
				.describe('List of eligible project types'),
			eligibleLocations: z
				.array(z.string())
				.describe('List of eligible locations'),
			status: z
				.string()
				.describe('Current status (Anticipated, Open, Closed, Awarded)'),
			tags: z
				.array(z.string())
				.optional()
				.describe('Tags to apply to this opportunity'),
			categories: z
				.array(z.string())
				.describe('Relevant categories from our taxonomy'),
			description: z.string().describe('Description of the opportunity'),
			url: z.string().describe('URL for more information'),
			funding_type: z
				.string()
				.describe('The type of funding (grant, loan, incentive, etc.)'),
			is_national: z
				.boolean()
				.optional()
				.describe('Whether this is a national opportunity'),
		})
		.describe('The normalized data for this opportunity'),
});

// Create the prompt template
const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert funding opportunity data processor for a funding intelligence system.
Your task is to analyze a funding opportunity and determine how to process it for our database.

OPPORTUNITY DATA:
{opportunityData}

SOURCE INFORMATION:
{sourceInfo}

For this opportunity, determine:
1. Whether to insert it as a new opportunity, update an existing one, or ignore it
2. How confident you are in this decision (0-100)
3. Whether it needs human review
4. Normalize the data according to our standard schema

Our standard categories include:
- Energy & Buildings
- Transportation & Mobility
- Water & Resources
- Climate & Resilience
- Community & Economic Development
- Infrastructure & Planning

IMPORTANT NOTES:
- Store the external ID from the source system in the opportunity_number field
- Each opportunity is associated with a funding source, which is handled automatically by the system

Our standard eligible applicants include:
- K-12 Schools
- Higher Education
- Local Government
- State Government
- Federal Government
- Tribal Government
- Nonprofit
- For-profit Business
- Special District
- Healthcare

Eligible project types include :
- Energy_Efficiency
- Renewable_Energy
- HVAC
- Lighting
- Water_Conservation
- Waste_Reduction
- Transportation
- Infrastructure
- Planning
- Other

For status, use these standardized values:
- Anticipated
- Open
- Closed
- Awarded

{formatInstructions}
`);

/**
 * Data Processor Agent that processes a single opportunity
 * @param {Object} opportunity - The opportunity to process
 * @param {string} sourceId - The ID of the source
 * @param {string} rawApiResponse - The raw API response
 * @param {Object} requestDetails - The details of the request
 * @param {Object} runManager - Optional RunManager instance for tracking
 * @returns {Promise<Object>} - The processing result
 */
export async function dataProcessorAgent(
	opportunity,
	sourceId,
	rawApiResponse,
	requestDetails,
	runManager = null
) {
	const supabase = createSupabaseClient();
	const startTime = Date.now();

	try {
		// Store the raw API response first
		const { data: rawResponseData, error: rawResponseError } = await supabase
			.from('api_raw_responses')
			.insert({
				source_id: sourceId,
				content: rawApiResponse,
				request_details: requestDetails,
				timestamp: new Date().toISOString(),
				created_at: new Date().toISOString(),
			})
			.select('id')
			.single();

		if (rawResponseError) {
			console.error('Error storing raw API response:', rawResponseError);
			throw rawResponseError;
		}

		const rawResponseId = rawResponseData.id;

		// Get the source information
		const { data: sourceData, error: sourceError } = await supabase
			.from('api_sources')
			.select('*')
			.eq('id', sourceId)
			.single();

		if (sourceError) {
			throw sourceError;
		}

		// Create the output parser
		const parser = StructuredOutputParser.fromZodSchema(processingResultSchema);
		const formatInstructions = parser.getFormatInstructions();

		// Create the model
		const model = new ChatAnthropic({
			temperature: 0.2,
			modelName: 'claude-3-5-haiku-20241022',
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		});

		// Format the prompt
		const prompt = await promptTemplate.format({
			opportunityData: JSON.stringify(opportunity, null, 2),
			sourceInfo: JSON.stringify(sourceData, null, 2),
			formatInstructions,
		});

		// Get the LLM response
		const response = await model.invoke(prompt);

		// Parse the response
		const result = await parser.parse(response.content);

		// Calculate execution time
		const executionTime = Date.now() - startTime;

		// Log the agent execution
		await logAgentExecution(
			supabase,
			'data_processor',
			{ opportunity, sourceId },
			result,
			executionTime,
			{
				promptTokens: response.usage?.prompt_tokens,
				completionTokens: response.usage?.completion_tokens,
			}
		);

		// Process the opportunity based on the action
		let storageResult = {
			action: result.action,
			opportunityId: null,
			success: false,
			error: null,
		};

		if (result.action === 'insert') {
			// Insert the opportunity
			const { data: insertData, error: insertError } = await supabase
				.from('funding_opportunities')
				.insert({
					...result.normalizedData,
					source_id: sourceId,
					raw_response_id: rawResponseId,
					confidence_score: result.confidence,
					needs_review: result.needsReview,
					review_reason: result.reviewReason,
				})
				.select('id')
				.single();

			if (insertError) {
				console.error('Error inserting opportunity:', insertError);
				storageResult.error = insertError.message;
			} else {
				storageResult.opportunityId = insertData.id;
				storageResult.success = true;
			}
		} else if (result.action === 'update') {
			// Find the existing opportunity by title and source
			const { data: existingData, error: existingError } = await supabase
				.from('funding_opportunities')
				.select('id')
				.eq('title', result.normalizedData.title)
				.eq('source_name', result.normalizedData.source_name)
				.limit(1);

			if (existingError) {
				console.error('Error finding existing opportunity:', existingError);
				storageResult.error = existingError.message;
			} else if (existingData && existingData.length > 0) {
				// Update the existing opportunity
				const { error: updateError } = await supabase
					.from('funding_opportunities')
					.update({
						...result.normalizedData,
						raw_response_id: rawResponseId,
						confidence_score: result.confidence,
						needs_review: result.needsReview,
						review_reason: result.reviewReason,
						updated_at: new Date().toISOString(),
					})
					.eq('id', existingData[0].id);

				if (updateError) {
					console.error('Error updating opportunity:', updateError);
					storageResult.error = updateError.message;
				} else {
					storageResult.opportunityId = existingData[0].id;
					storageResult.success = true;
				}
			} else {
				// Existing opportunity not found, insert instead
				const { data: insertData, error: insertError } = await supabase
					.from('funding_opportunities')
					.insert({
						...result.normalizedData,
						source_id: sourceId,
						raw_response_id: rawResponseId,
						confidence_score: result.confidence,
						needs_review: result.needsReview,
						review_reason: result.reviewReason,
					})
					.select('id')
					.single();

				if (insertError) {
					console.error('Error inserting opportunity:', insertError);
					storageResult.error = insertError.message;
					storageResult.action = 'insert_fallback';
				} else {
					storageResult.opportunityId = insertData.id;
					storageResult.success = true;
					storageResult.action = 'insert_fallback';
				}
			}
		} else {
			// Ignore the opportunity
			storageResult.success = true;
		}

		// Mark the extracted opportunity as processed
		const { error: markProcessedError } = await supabase
			.from('api_extracted_opportunities')
			.update({ processed: true, processing_result: storageResult })
			.eq('raw_response_id', rawResponseId)
			.eq('data->title', opportunity.title);

		if (markProcessedError) {
			console.error(
				'Error marking opportunity as processed:',
				markProcessedError
			);
		}

		return {
			...result,
			storageResult,
			executionTime,
		};
	} catch (error) {
		// Log the error
		console.error('Error in Data Processor Agent:', error);

		// Log the API activity with error
		await logApiActivity(supabase, sourceId, 'processing', 'failure', {
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
 * Processes all unprocessed extracted opportunities for a source
 * @param {string} sourceId - The ID of the source
 * @param {string} rawApiResponse - The raw API response
 * @param {Object} requestDetails - The details of the request
 * @param {Object} runManager - Optional RunManager instance for tracking
 * @returns {Promise<Object>} - The processing results
 */
export async function processUnprocessedOpportunities(
	sourceId,
	rawApiResponse,
	requestDetails,
	runManager = null
) {
	const supabase = createSupabaseClient();
	const startTime = Date.now();

	try {
		// Get all unprocessed opportunities for this source
		const { data: unprocessedOpportunities, error } = await supabase
			.from('api_extracted_opportunities')
			.select('*')
			.eq('source_id', sourceId)
			.eq('processed', false);

		if (error) {
			throw error;
		}

		if (!unprocessedOpportunities || unprocessedOpportunities.length === 0) {
			// No opportunities to process
			if (runManager) {
				await runManager.updateStorageResults({
					attemptedCount: 0,
					storedCount: 0,
					updatedCount: 0,
					skippedCount: 0,
					skippedReasons: {},
					processingTime: 0,
				});
			}

			return {
				message: 'No unprocessed opportunities found',
				count: 0,
			};
		}

		// Process each opportunity
		const results = [];
		const storageMetrics = {
			attemptedCount: unprocessedOpportunities.length,
			storedCount: 0,
			updatedCount: 0,
			skippedCount: 0,
			skippedReasons: {},
			processingTime: 0,
		};

		for (const opportunity of unprocessedOpportunities) {
			const result = await dataProcessorAgent(
				opportunity.data,
				sourceId,
				rawApiResponse,
				requestDetails,
				runManager
			);

			results.push(result);

			// Update metrics based on the result
			if (result.storageResult.success) {
				if (
					result.action === 'insert' ||
					result.storageResult.action === 'insert_fallback'
				) {
					storageMetrics.storedCount++;
				} else if (result.action === 'update') {
					storageMetrics.updatedCount++;
				} else if (result.action === 'ignore') {
					storageMetrics.skippedCount++;

					// Track skip reasons
					const reason = result.reviewReason || 'No reason provided';
					if (!storageMetrics.skippedReasons[reason]) {
						storageMetrics.skippedReasons[reason] = 0;
					}
					storageMetrics.skippedReasons[reason]++;
				}
			} else {
				// Count failed operations as skipped
				storageMetrics.skippedCount++;

				// Track error as skip reason
				const reason = result.storageResult.error || 'Unknown error';
				if (!storageMetrics.skippedReasons[reason]) {
					storageMetrics.skippedReasons[reason] = 0;
				}
				storageMetrics.skippedReasons[reason]++;
			}
		}

		// Calculate total processing time
		const executionTime = Date.now() - startTime;
		storageMetrics.processingTime = executionTime;

		// Update run manager with storage results
		if (runManager) {
			await runManager.updateStorageResults(storageMetrics);
		}

		return {
			message: 'Successfully processed opportunities',
			count: unprocessedOpportunities.length,
			results,
			metrics: storageMetrics,
		};
	} catch (error) {
		console.error('Error processing unprocessed opportunities:', error);

		// Update run with error if runManager is provided
		if (runManager) {
			await runManager.updateRunError(error);
		}

		throw error;
	}
}
