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
				.describe('The date when applications open (ISO format)'),
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
			eligibility: z
				.string()
				.optional()
				.nullable()
				.describe('Eligibility requirements as text'),
			status: z
				.string()
				.describe('Current status (Anticipated, Open, Closed, Awarded)'),
			tags: z
				.array(z.string())
				.optional()
				.describe('Tags to apply to this opportunity'),
			url: z
				.string()
				.optional()
				.nullable()
				.describe('URL for the application or more information'),
			is_national: z
				.boolean()
				.optional()
				.describe('Whether this is a national opportunity'),
			program_id: z
				.string()
				.uuid()
				.optional()
				.nullable()
				.describe(
					'UUID of the funding program this belongs to (not the external ID)'
				),
		})
		.describe('The normalized data to store in the database'),
	eligibleApplicants: z
		.array(z.string())
		.describe('List of eligible applicant types'),
	eligibleProjectTypes: z
		.array(z.string())
		.describe('List of eligible project types'),
});

// Create the prompt template
const promptTemplate = PromptTemplate.fromTemplate(`
You are the Data Processor Agent for a funding intelligence system that collects information about energy infrastructure funding opportunities.

Your task is to analyze the following extracted opportunity and determine:
1. Whether it is a new opportunity or an update to an existing one
2. Whether any fields need enrichment or correction
3. If the opportunity requires human review
4. How to normalize the data for storage

EXTRACTED OPPORTUNITY:
{extractedOpportunity}

POTENTIAL MATCHING OPPORTUNITIES IN DATABASE:
{existingOpportunities}

Based on your analysis:
1. Determine if this is a new entry, an update, or a duplicate
2. Correct any inconsistencies or formatting issues
3. Flag for human review if there are significant uncertainties
4. Prepare the normalized data structure for database storage

IMPORTANT NOTES:
- For program_id, always use the program ID provided in the function call, NOT the source ID or external ID from the opportunity
- Store the external ID from the source system in the opportunity_number field
- The program_id must be a valid UUID

For eligible applicants, use these standardized types:
- K12
- Municipal
- County
- State
- Higher_Ed
- Nonprofit
- For-profit
- Tribal
- Other

For eligible project types, use these standardized types:
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
 * Checks for potential duplicate opportunities in the database
 * @param {Object} opportunity - The extracted opportunity
 * @param {string} programId - The ID of the funding program
 * @returns {Promise<Array>} - Potential matching opportunities
 */
async function checkForDuplicates(opportunity, programId) {
	const supabase = createSupabaseClient();

	try {
		// First, try to find exact matches by title and program
		const { data: exactMatches } = await supabase
			.from('funding_opportunities')
			.select('*')
			.eq('title', opportunity.title)
			.eq('program_id', programId)
			.limit(5);

		if (exactMatches && exactMatches.length > 0) {
			return exactMatches;
		}

		// If no exact matches, try fuzzy matching on title
		const { data: fuzzyMatches } = await supabase
			.from('funding_opportunities')
			.select('*')
			.ilike('title', `%${opportunity.title.substring(0, 50)}%`)
			.limit(10);

		return fuzzyMatches || [];
	} catch (error) {
		console.error('Error checking for duplicates:', error);
		return [];
	}
}

/**
 * Processes a single extracted opportunity
 * @param {Object} opportunity - The extracted opportunity
 * @param {string} sourceId - The ID of the source
 * @param {string} rawResponseId - The ID of the raw response
 * @returns {Promise<Object>} - The processing result
 */
async function processOpportunity(opportunity, sourceId, rawResponseId) {
	const startTime = Date.now();
	const supabase = createSupabaseClient();

	try {
		// Get the program ID for this source
		let { data: programData, error: programError } = await supabase
			.from('funding_programs')
			.select('id')
			.eq('source_id', sourceId)
			.single();

		let programId;

		if (programError) {
			console.log('No funding program found, creating one automatically...');

			// Get the source details to use for the program name
			const { data: sourceData, error: sourceError } = await supabase
				.from('api_sources')
				.select('name')
				.eq('id', sourceId)
				.single();

			if (sourceError) {
				console.error('Error getting source details:', sourceError);
				throw new Error(`Could not find API source with ID: ${sourceId}`);
			}

			// Create a funding program automatically
			const { data: newProgram, error: createError } = await supabase
				.from('funding_programs')
				.insert({
					name: `${sourceData.name} Program`,
					source_id: sourceId,
					description: `Auto-generated program for ${sourceData.name}`,
				})
				.select('id')
				.single();

			if (createError) {
				console.error('Error creating funding program:', createError);
				throw new Error(
					`Failed to create funding program for source ID: ${sourceId}`
				);
			}

			programId = newProgram.id;
			console.log(`Created new funding program with ID: ${programId}`);
		} else {
			programId = programData.id;
		}

		// Check for potential duplicates
		const existingOpportunities = await checkForDuplicates(
			opportunity,
			programId
		);

		// Check if Anthropic API key is available
		if (
			!process.env.ANTHROPIC_API_KEY ||
			process.env.ANTHROPIC_API_KEY.includes('xxxxxxxx')
		) {
			console.log(
				'No valid Anthropic API key found. Using mock response for Data Processor Agent.'
			);

			// Return a mock processing result for testing purposes
			const mockResult = {
				action: 'insert',
				confidence: 100,
				needsReview: false,
				normalizedData: {
					title: opportunity.title,
					opportunity_number: opportunity.externalId || null,
					source_name: opportunity.agency || 'Unknown',
					source_type: 'federal',
					min_amount: opportunity.minAward || null,
					max_amount: opportunity.maxAward || null,
					minimum_award: opportunity.minAward || null,
					maximum_award: opportunity.maxAward || null,
					cost_share_required: opportunity.matchingRequired || false,
					cost_share_percentage: opportunity.matchingPercentage || null,
					posted_date: opportunity.postDate || null,
					open_date: opportunity.openDate || null,
					close_date: opportunity.closeDate || null,
					description: opportunity.description || null,
					objectives: null,
					eligibility: opportunity.eligibilityText || null,
					status: opportunity.status || 'Open',
					tags: [],
					url: opportunity.url || null,
					is_national: true,
					program_id: programId,
				},
				eligibleApplicants: opportunity.eligibility || [
					'Municipal',
					'Nonprofit',
				],
				eligibleProjectTypes: ['Energy_Efficiency'],
			};

			// Update the extracted opportunity record
			await supabase
				.from('api_extracted_opportunities')
				.update({
					processed: true,
					processing_result: mockResult.action,
					processing_details: mockResult,
				})
				.eq('source_id', sourceId)
				.eq('data->title', opportunity.title);

			return {
				action: 'insert',
				opportunityId: 'mock-id',
				result: mockResult,
			};
		}

		// Initialize the LLM
		const model = new ChatAnthropic({
			temperature: 0,
			modelName: 'claude-3-5-haiku-20241022',
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		});

		// Create the output parser
		const parser = StructuredOutputParser.fromZodSchema(processingResultSchema);
		const formatInstructions = parser.getFormatInstructions();

		// Create the prompt
		const prompt = await promptTemplate.format({
			extractedOpportunity: JSON.stringify(opportunity, null, 2),
			existingOpportunities: JSON.stringify(existingOpportunities, null, 2),
			formatInstructions,
		});

		// Get the LLM response
		const response = await model.invoke(prompt);

		// Parse the response
		const result = await parser.parse(response.content);

		// Ensure program_id is always the programId
		if (result.normalizedData) {
			result.normalizedData.program_id = programId;

			// If opportunity has an externalId but no opportunity_number, use externalId
			if (!result.normalizedData.opportunity_number && opportunity.externalId) {
				result.normalizedData.opportunity_number = opportunity.externalId;
			}
		}

		// Calculate execution time
		const executionTime = Date.now() - startTime;

		// Log the agent execution
		await logAgentExecution(
			supabase,
			'data_processor',
			{
				opportunity: opportunity.title,
				sourceId,
				programId,
			},
			result,
			executionTime,
			{
				promptTokens: response.usage?.prompt_tokens,
				completionTokens: response.usage?.completion_tokens,
			}
		);

		// Update the extracted opportunity record
		await supabase
			.from('api_extracted_opportunities')
			.update({
				processed: true,
				processing_result: result.action,
				processing_details: result,
			})
			.eq('source_id', sourceId)
			.eq('data->title', opportunity.title);

		// Take the appropriate action based on the result
		if (result.action === 'insert') {
			// Insert the new opportunity with tags directly in the record
			const { data: newOpportunity, error } = await supabase
				.from('funding_opportunities')
				.insert({
					...result.normalizedData,
					tags: result.tags || [], // Include tags directly in the record
				})
				.select('id')
				.single();

			if (error) {
				console.error('Error processing opportunity:', error);
				throw error;
			}

			// Insert eligible applicants
			if (result.eligibleApplicants && result.eligibleApplicants.length > 0) {
				const applicantInserts = result.eligibleApplicants.map(
					(applicantType) => ({
						opportunity_id: newOpportunity.id,
						entity_type: applicantType,
					})
				);

				await supabase
					.from('funding_eligibility_criteria')
					.insert(applicantInserts);
			}

			// Insert eligible project types
			if (
				result.eligibleProjectTypes &&
				result.eligibleProjectTypes.length > 0
			) {
				const projectTypeInserts = result.eligibleProjectTypes.map(
					(projectType) => ({
						opportunity_id: newOpportunity.id,
						entity_type: `Project:${projectType}`,
					})
				);

				await supabase
					.from('funding_eligibility_criteria')
					.insert(projectTypeInserts);
			}

			return {
				action: 'insert',
				opportunityId: newOpportunity.id,
				result,
			};
		} else if (result.action === 'update') {
			// Update the existing opportunity
			const existingOpportunity = existingOpportunities[0];

			const { error } = await supabase
				.from('funding_opportunities')
				.update({
					...result.normalizedData,
					tags: result.tags || [], // Include tags directly in the record
					updated_at: new Date().toISOString(),
				})
				.eq('id', existingOpportunity.id);

			if (error) {
				console.error('Error updating opportunity:', error);
				throw error;
			}

			// Update eligible applicants (remove existing and add new)
			await supabase
				.from('funding_eligibility_criteria')
				.delete()
				.eq('opportunity_id', existingOpportunity.id);

			if (result.eligibleApplicants && result.eligibleApplicants.length > 0) {
				const applicantInserts = result.eligibleApplicants.map(
					(applicantType) => ({
						opportunity_id: existingOpportunity.id,
						entity_type: applicantType,
					})
				);

				await supabase
					.from('funding_eligibility_criteria')
					.insert(applicantInserts);
			}

			// Update eligible project types (now part of eligibility criteria)
			if (
				result.eligibleProjectTypes &&
				result.eligibleProjectTypes.length > 0
			) {
				const projectTypeInserts = result.eligibleProjectTypes.map(
					(projectType) => ({
						opportunity_id: existingOpportunity.id,
						entity_type: `Project:${projectType}`,
					})
				);

				await supabase
					.from('funding_eligibility_criteria')
					.insert(projectTypeInserts);
			}

			return {
				action: 'update',
				opportunityId: existingOpportunity.id,
				result,
			};
		} else {
			// Ignore the opportunity (duplicate or not relevant)
			return {
				action: 'ignore',
				result,
			};
		}
	} catch (error) {
		// Calculate execution time even if there was an error
		const executionTime = Date.now() - startTime;

		// Log the error
		console.error('Error processing opportunity:', error);

		// Log the agent execution with error
		await logAgentExecution(
			supabase,
			'data_processor',
			{
				opportunity: opportunity.title,
				sourceId,
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
 * Data Processor Agent that processes extracted opportunities
 * @param {Array} opportunities - The extracted opportunities
 * @param {string} sourceId - The ID of the source
 * @param {string} rawResponseId - The ID of the raw response
 * @returns {Promise<Object>} - The processing results
 */
export async function dataProcessorAgent(
	opportunities,
	sourceId,
	rawResponseId
) {
	const supabase = createSupabaseClient();
	const results = [];

	try {
		// Process each opportunity
		for (const opportunity of opportunities) {
			const result = await processOpportunity(
				opportunity,
				sourceId,
				rawResponseId
			);
			results.push(result);
		}

		// Log the API activity
		await logApiActivity(supabase, sourceId, 'processing', 'success', {
			processedCount: opportunities.length,
			insertedCount: results.filter((r) => r.action === 'insert').length,
			updatedCount: results.filter((r) => r.action === 'update').length,
			ignoredCount: results.filter((r) => r.action === 'ignore').length,
		});

		return {
			totalProcessed: opportunities.length,
			results,
		};
	} catch (error) {
		// Log the API activity with error
		await logApiActivity(supabase, sourceId, 'processing', 'failure', {
			error: String(error),
		});

		throw error;
	}
}

/**
 * Processes all unprocessed extracted opportunities for a source
 * @param {string} sourceId - The ID of the source
 * @returns {Promise<Object>} - The processing results
 */
export async function processUnprocessedOpportunities(sourceId) {
	const supabase = createSupabaseClient();

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
			return {
				message: 'No unprocessed opportunities found',
				count: 0,
			};
		}

		// Group opportunities by raw response ID
		const opportunitiesByResponse = {};
		for (const opportunity of unprocessedOpportunities) {
			if (!opportunitiesByResponse[opportunity.raw_response_id]) {
				opportunitiesByResponse[opportunity.raw_response_id] = [];
			}
			opportunitiesByResponse[opportunity.raw_response_id].push(
				opportunity.data
			);
		}

		// Process each group of opportunities
		const results = [];
		for (const rawResponseId in opportunitiesByResponse) {
			const opportunities = opportunitiesByResponse[rawResponseId];
			const result = await dataProcessorAgent(
				opportunities,
				sourceId,
				rawResponseId
			);
			results.push(result);
		}

		return {
			message: 'Successfully processed opportunities',
			count: unprocessedOpportunities.length,
			results,
		};
	} catch (error) {
		console.error('Error processing unprocessed opportunities:', error);
		throw error;
	}
}
