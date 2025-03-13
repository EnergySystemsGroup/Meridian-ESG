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
- Store the external ID from the source system in the opportunity_number field
- Each opportunity is associated with a funding source, which is handled automatically by the system

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
 * Check for potential duplicates of an opportunity
 * @param {Object} opportunity - The opportunity to check
 * @param {string} sourceId - The ID of the source
 * @returns {Promise<Object>} - Object containing any exact or fuzzy matches
 */
async function checkForDuplicates(opportunity, sourceId) {
	const supabase = createSupabaseClient();
	const result = { exactMatch: null, fuzzyMatch: null };

	try {
		// First, check for exact matches by title and source ID
		const { data: exactMatches, error: exactError } = await supabase
			.from('funding_opportunities')
			.select('*')
			.eq('title', opportunity.title)
			.eq('source_id', sourceId);

		if (exactError) {
			console.error('Error checking for exact matches:', exactError);
		} else if (exactMatches && exactMatches.length > 0) {
			result.exactMatch = exactMatches[0];
			return result;
		}

		// If no exact match, try fuzzy matching on title
		const { data: fuzzyMatches, error: fuzzyError } = await supabase
			.from('funding_opportunities')
			.select('*')
			.ilike('title', `%${opportunity.title}%`)
			.eq('source_id', sourceId);

		if (fuzzyError) {
			console.error('Error checking for fuzzy matches:', fuzzyError);
		} else if (fuzzyMatches && fuzzyMatches.length > 0) {
			// Find the best fuzzy match
			result.fuzzyMatch = fuzzyMatches.reduce((best, current) => {
				if (!best) return current;

				const bestSimilarity = similarity(best.title, opportunity.title);
				const currentSimilarity = similarity(current.title, opportunity.title);

				return currentSimilarity > bestSimilarity ? current : best;
			}, null);
		}

		return result;
	} catch (error) {
		console.error('Error checking for duplicates:', error);
		return result;
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
		// Check for potential duplicates using sourceId
		const existingOpportunities = await checkForDuplicates(
			opportunity,
			sourceId
		);

		// If we found an exact match, update it
		if (existingOpportunities.exactMatch) {
			console.log(`Found exact match for opportunity: ${opportunity.title}`);

			// Update the existing opportunity
			const { error: updateError } = await supabase
				.from('funding_opportunities')
				.update({
					title: opportunity.title,
					description: opportunity.description,
					source_name: opportunity.agency || 'Unknown',
					source_type: opportunity.fundingType || 'Unknown',
					min_amount: opportunity.minAward || null,
					max_amount: opportunity.maxAward || null,
					open_date: opportunity.openDate || null,
					close_date: opportunity.closeDate || null,
					eligibility: opportunity.eligibility || null,
					url: opportunity.url || null,
					source_id: sourceId,
					updated_at: new Date().toISOString(),
				})
				.eq('id', existingOpportunities.exactMatch.id);

			if (updateError) {
				console.error('Error updating opportunity:', updateError);
				throw updateError;
			}

			// Log the agent execution
			await logAgentExecution(
				supabase,
				'dataProcessor',
				{
					opportunity,
					sourceId,
					rawResponseId,
				},
				{
					action: 'update',
					opportunityId: existingOpportunities.exactMatch.id,
				},
				Date.now() - startTime,
				null
			);

			return {
				action: 'update',
				opportunityId: existingOpportunities.exactMatch.id,
			};
		}

		// If we found a fuzzy match, update it
		if (existingOpportunities.fuzzyMatch) {
			console.log(`Found fuzzy match for opportunity: ${opportunity.title}`);

			// Update the existing opportunity
			const { error: updateError } = await supabase
				.from('funding_opportunities')
				.update({
					title: opportunity.title,
					description: opportunity.description,
					source_name: opportunity.agency || 'Unknown',
					source_type: opportunity.fundingType || 'Unknown',
					min_amount: opportunity.minAward || null,
					max_amount: opportunity.maxAward || null,
					open_date: opportunity.openDate || null,
					close_date: opportunity.closeDate || null,
					eligibility: opportunity.eligibility || null,
					url: opportunity.url || null,
					source_id: sourceId,
					updated_at: new Date().toISOString(),
				})
				.eq('id', existingOpportunities.fuzzyMatch.id);

			if (updateError) {
				console.error('Error updating opportunity:', updateError);
				throw updateError;
			}

			// Log the agent execution
			await logAgentExecution(
				supabase,
				'dataProcessor',
				{
					opportunity,
					sourceId,
					rawResponseId,
				},
				{
					action: 'update',
					opportunityId: existingOpportunities.fuzzyMatch.id,
				},
				Date.now() - startTime,
				null
			);

			return {
				action: 'update',
				opportunityId: existingOpportunities.fuzzyMatch.id,
			};
		}

		// If we didn't find a match, insert a new opportunity
		console.log(`Inserting new opportunity: ${opportunity.title}`);

		// Insert the new opportunity with tags directly in the record
		const { data: newOpportunity, error } = await supabase
			.from('funding_opportunities')
			.insert({
				title: opportunity.title,
				opportunity_number: opportunity.opportunityNumber || null,
				description: opportunity.description,
				source_name: opportunity.agency || 'Unknown',
				source_type: opportunity.fundingType || 'Unknown',
				min_amount: opportunity.minAward || null,
				max_amount: opportunity.maxAward || null,
				open_date: opportunity.openDate || null,
				close_date: opportunity.closeDate || null,
				eligibility: opportunity.eligibility || null,
				url: opportunity.url || null,
				source_id: sourceId,
				tags: opportunity.tags || [],
			})
			.select('id')
			.single();

		if (error) {
			console.error('Error inserting opportunity:', error);
			throw error;
		}

		// Insert eligible applicants
		if (opportunity.eligibility && opportunity.eligibility.length > 0) {
			const applicantInserts = opportunity.eligibility.map((applicantType) => ({
				opportunity_id: newOpportunity.id,
				entity_type: applicantType,
			}));

			await supabase
				.from('funding_eligibility_criteria')
				.insert(applicantInserts);
		}

		// Insert eligible project types
		if (opportunity.projectTypes && opportunity.projectTypes.length > 0) {
			const projectTypeInserts = opportunity.projectTypes.map(
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
		};
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
