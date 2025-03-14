import { ChatAnthropic } from '@langchain/anthropic';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import {
	createSupabaseClient,
	logAgentExecution,
	logApiActivity,
} from '../supabase';
import { z } from 'zod';

// Define the output schema for the agent
const detailProcessingSchema = z.object({
	opportunities: z
		.array(
			z.object({
				id: z.string().describe('The opportunity ID'),
				title: z.string().describe('The title of the opportunity'),
				relevanceScore: z
					.number()
					.min(1)
					.max(10)
					.describe('Relevance score from 1-10'),
				focusAreas: z
					.array(z.string())
					.describe('Primary focus areas for this opportunity'),
				eligibleClientTypes: z
					.array(z.string())
					.describe('Types of clients eligible for this opportunity'),
				keyBenefits: z
					.array(z.string())
					.describe('Key benefits of this opportunity (2-3 bullet points)'),
				restrictions: z
					.string()
					.optional()
					.describe('Any notable restrictions or requirements'),
				reasoning: z
					.string()
					.describe('Reasoning for the relevance score and inclusion'),
			})
		)
		.describe('List of opportunities that passed the detailed filtering'),
	filteredCount: z
		.number()
		.describe('Number of opportunities that were filtered out'),
	processingMetrics: z
		.object({
			averageScoreBeforeFiltering: z
				.number()
				.optional()
				.describe('Average relevance score before filtering'),
			averageScoreAfterFiltering: z
				.number()
				.optional()
				.describe('Average relevance score after filtering'),
			tokenUsage: z
				.number()
				.optional()
				.describe('Estimated token usage for this processing'),
		})
		.describe('Metrics about the processing'),
});

// Define the prompt template for the agent
const detailProcessorPromptTemplate = `You are an expert funding opportunity analyst for energy and infrastructure projects.
Your task is to perform a detailed analysis of funding opportunities to determine their relevance and value to our clients.

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
   - 3 points: Strong alignment with one focus area or moderate alignment with multiple areas
   - 4 points: Strong alignment with multiple focus areas
   - 5 points: Perfect alignment with multiple focus areas and strategic priorities

2. Applicability to our client types (0-3 points):
   - 0 points: Not applicable to any of our client types
   - 1 point: Applicable to a limited subset of our client types
   - 2 points: Applicable to several of our client types
   - 3 points: Broadly applicable to most or all of our client types

3. Funding amount and accessibility (0-2 points):
   - 0 points: Insufficient funding or excessive match requirements
   - 1 point: Moderate funding with reasonable match requirements
   - 2 points: Substantial funding with minimal match requirements

Only include opportunities that score 7 or higher in your final output. In the absence of information, make assumptions to lean on the side of inclusion.

For each selected opportunity, provide:
1. Opportunity ID and title
2. Relevance score (1-10)
3. Primary focus area(s)
4. Eligible client types
5. Key benefits (2-3 bullet points)
6. Any notable restrictions or requirements
7. Brief reasoning for the relevance score and inclusion

Source Information:
{sourceInfo}

Detailed Opportunities:
{detailedOpportunities}

{formatInstructions}`;

/**
 * Processes detailed opportunity information for second-stage filtering
 * @param {Array} detailedOpportunities - The detailed opportunities from the API Handler Agent
 * @param {Object} source - The API source
 * @returns {Promise<Object>} - The filtered opportunities
 */
export async function detailProcessorAgent(detailedOpportunities, source) {
	const startTime = Date.now();
	const supabase = createSupabaseClient();

	try {
		// Initialize the LLM
		const model = new ChatAnthropic({
			temperature: 0.2,
			modelName: 'claude-3-5-sonnet-20240620',
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		});

		// Create the output parser
		const parser = StructuredOutputParser.fromZodSchema(detailProcessingSchema);
		const formatInstructions = parser.getFormatInstructions();

		// Create the prompt template
		const prompt = PromptTemplate.fromTemplate(detailProcessorPromptTemplate);

		// Process opportunities in batches to avoid token limits
		const batchSize = 40;
		const batches = [];
		for (let i = 0; i < detailedOpportunities.length; i += batchSize) {
			batches.push(detailedOpportunities.slice(i, i + batchSize));
		}

		// Process each batch
		const allResults = {
			opportunities: [],
			filteredCount: 0,
			processingMetrics: {
				averageScoreBeforeFiltering: 0,
				averageScoreAfterFiltering: 0,
				tokenUsage: 0,
			},
		};

		for (const batch of batches) {
			// Format the prompt variables
			const promptVariables = {
				sourceInfo: JSON.stringify(source, null, 2),
				detailedOpportunities: JSON.stringify(batch, null, 2),
				formatInstructions,
			};

			// Generate the prompt
			const formattedPrompt = await prompt.format(promptVariables);

			// Call the LLM
			const response = await model.invoke(formattedPrompt);

			// Parse the response
			const result = await parser.parse(response.content);

			// Add the results to the combined results
			allResults.opportunities = [
				...allResults.opportunities,
				...result.opportunities,
			];
			allResults.filteredCount += result.filteredCount;

			// Update the processing metrics
			if (result.processingMetrics) {
				if (result.processingMetrics.tokenUsage) {
					allResults.processingMetrics.tokenUsage +=
						result.processingMetrics.tokenUsage;
				}
			}
		}

		// Calculate the average scores
		if (allResults.opportunities.length > 0) {
			allResults.processingMetrics.averageScoreAfterFiltering =
				allResults.opportunities.reduce(
					(sum, opp) => sum + opp.relevanceScore,
					0
				) / allResults.opportunities.length;
		}

		// Log the execution
		const executionTime = Date.now() - startTime;
		await logAgentExecution(
			supabase,
			'detail_processor',
			{ count: detailedOpportunities.length },
			allResults,
			executionTime,
			allResults.processingMetrics.tokenUsage
		);

		// Log the API activity
		await logApiActivity(supabase, source.id, 'detail_processing', 'success', {
			inputCount: detailedOpportunities.length,
			outputCount: allResults.opportunities.length,
			executionTime,
		});

		return allResults;
	} catch (error) {
		// Log the error
		console.error('Error in Detail Processor Agent:', error);

		// Log the API activity with error
		await logApiActivity(supabase, source.id, 'detail_processing', 'failure', {
			error: String(error),
		});

		throw error;
	}
}

/**
 * Processes detailed opportunity information in batches with adaptive sizing
 * @param {Array} detailedOpportunities - The detailed opportunities from the API Handler Agent
 * @param {Object} source - The API source
 * @param {Object} config - Configuration for the detail processor
 * @returns {Promise<Object>} - The filtered opportunities
 */
export async function processDetailedInfo(
	detailedOpportunities,
	source,
	config = {}
) {
	// Default configuration
	const defaultConfig = {
		minScoreThreshold: 7,
		batchSize: 40,
		maxConcurrentBatches: 5,
		model: 'claude-3-5-sonnet-20240620',
		temperature: 0.2,
		maxTokensPerRequest: 16000,
	};

	// Merge with provided config
	const processingConfig = { ...defaultConfig, ...config };

	// Process with the Detail Processor Agent
	const result = await detailProcessorAgent(detailedOpportunities, source);

	return result;
}
