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
				id: z.string().describe('Unique identifier for the opportunity'),
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

// Define the prompt template for the agent
const detailProcessorPromptTemplateString = `You are an expert funding opportunity analyst for energy and infrastructure projects.
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
5. Matching requirements - Are they reasonable for our clients?
6. Application complexity - Is it worth the effort?

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
   - 3 points: Applicable to any of our client types

3. Funding amount and accessibility (0-2 points):
   - 0 points: Insufficient funding or excessive match requirements
   - 1 point: Moderate funding with reasonable match requirements
   - 2 points: Substantial funding with minimal match requirements

Only include opportunities with a {minRelevanceScore} or higher in your final output. In the absence of information, make assumptions to lean on the side of inclusion.

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

{formatInstructions}
`;

// Create a proper PromptTemplate object
const detailProcessorPromptTemplate = PromptTemplate.fromTemplate(
	detailProcessorPromptTemplateString
);

/**
 * Splits opportunities into chunks based on token size
 * @param {Array} opportunities - The opportunities to split
 * @param {number} tokenThreshold - Maximum tokens per chunk
 * @returns {Array} - Array of opportunity chunks
 */
function splitOpportunitiesIntoChunks(opportunities, tokenThreshold = 10000) {
	const chunks = [];
	let currentChunk = [];
	let currentSize = 0;

	// Use string length as a rough approximation of token count
	// This is conservative as 1 character is usually less than 1 token
	for (const opportunity of opportunities) {
		const oppSize = JSON.stringify(opportunity).length;

		// If this opportunity alone exceeds the threshold, it needs its own chunk
		if (oppSize > tokenThreshold) {
			// If we have a current chunk, add it to chunks
			if (currentChunk.length > 0) {
				chunks.push(currentChunk);
				currentChunk = [];
				currentSize = 0;
			}
			// Add this large opportunity as its own chunk
			chunks.push([opportunity]);
			continue;
		}

		// If adding this opportunity would exceed the threshold, start a new chunk
		if (currentSize + oppSize > tokenThreshold && currentChunk.length > 0) {
			chunks.push(currentChunk);
			currentChunk = [];
			currentSize = 0;
		}

		// Add the opportunity to the current chunk
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
 * Detail Processor Agent that performs detailed analysis of opportunities
 * @param {Array} detailedOpportunities - The detailed opportunities from the API Handler Agent
 * @param {Object} source - The API source
 * @param {Object} runManager - Optional RunManager instance for tracking
 * @param {Object} config - Configuration for the detail processor
 * @returns {Promise<Object>} - The filtered opportunities
 */
export async function detailProcessorAgent(
	detailedOpportunities,
	source,
	runManager = null,
	config = {}
) {
	const supabase = createSupabaseClient();
	const startTime = Date.now();

	// Default configuration
	const defaultConfig = {
		minScoreThreshold: 7,
		tokenThreshold: 10000,
		model: 'claude-3-5-haiku-20241022',
		temperature: 0,
		maxTokensPerRequest: 16000,
	};

	// Merge with provided config
	const processingConfig = { ...defaultConfig, ...config };

	try {
		// Create the output parser
		const parser = StructuredOutputParser.fromZodSchema(detailProcessingSchema);
		const formatInstructions = parser.getFormatInstructions();

		// Create the model
		const model = new ChatAnthropic({
			temperature: processingConfig.temperature,
			modelName: processingConfig.model,
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		});

		// Initialize the combined results
		const allResults = {
			opportunities: [],
			processingMetrics: {
				inputCount: detailedOpportunities.length,
				passedCount: 0,
				rejectedCount: 0,
				rejectionReasons: [],
				averageScoreBeforeFiltering: 0,
				averageScoreAfterFiltering: 0,
				processingTime: 0,
				tokenUsage: 0,
				chunkMetrics: [],
				filterReasoning: '',
			},
		};

		console.log('\n=== Starting Detail Processing ===');
		console.log(
			`Processing ${detailedOpportunities.length} opportunities with minimum score threshold: ${processingConfig.minScoreThreshold}`
		);

		// Split opportunities into chunks based on token threshold
		const chunks = splitOpportunitiesIntoChunks(
			detailedOpportunities,
			processingConfig.tokenThreshold
		);
		console.log(`Split opportunities into ${chunks.length} chunks`);

		// Process each chunk
		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i];
			const chunkStartTime = Date.now();
			console.log(
				`\nProcessing chunk ${i + 1}/${chunks.length} with ${
					chunk.length
				} opportunities...`
			);

			// Format the prompt
			const prompt = await detailProcessorPromptTemplate.format({
				detailedOpportunities: JSON.stringify(chunk, null, 2),
				minRelevanceScore: processingConfig.minScoreThreshold,
				formatInstructions,
				sourceInfo: JSON.stringify(source, null, 2),
			});

			// Get the LLM response
			const response = await model.invoke(prompt);

			// Parse the response
			const result = await parser.parse(response.content);

			// Calculate chunk metrics
			const chunkTime = Date.now() - chunkStartTime;
			const chunkMetrics = {
				chunkIndex: i + 1,
				processedOpportunities: chunk.length,
				passedCount: result.opportunities.length,
				timeSeconds: (chunkTime / 1000).toFixed(1),
			};

			console.log(
				`Chunk ${i + 1} completed: ${result.opportunities.length}/${
					chunk.length
				} opportunities passed filtering (${chunkMetrics.timeSeconds}s)`
			);

			// Add chunk metrics to the results
			allResults.processingMetrics.chunkMetrics.push(chunkMetrics);

			// Add the results to the combined results
			allResults.opportunities = [
				...allResults.opportunities,
				...result.opportunities,
			];

			// Update the processing metrics from LLM response
			if (result.processingMetrics) {
				allResults.processingMetrics.passedCount +=
					result.processingMetrics.passedCount;
				allResults.processingMetrics.rejectedCount +=
					result.processingMetrics.rejectedCount;

				// Collect unique rejection reasons
				if (result.processingMetrics.rejectionReasons) {
					allResults.processingMetrics.rejectionReasons = [
						...new Set([
							...allResults.processingMetrics.rejectionReasons,
							...result.processingMetrics.rejectionReasons,
						]),
					];
				}

				// Update filter reasoning
				if (result.processingMetrics.filterReasoning) {
					if (!allResults.processingMetrics.filterReasoning) {
						allResults.processingMetrics.filterReasoning =
							result.processingMetrics.filterReasoning;
					} else if (
						!allResults.processingMetrics.filterReasoning.includes(
							result.processingMetrics.filterReasoning
						)
					) {
						allResults.processingMetrics.filterReasoning +=
							'; ' + result.processingMetrics.filterReasoning;
					}
				}

				// Track token usage if provided
				if (result.processingMetrics.tokenUsage) {
					allResults.processingMetrics.tokenUsage +=
						result.processingMetrics.tokenUsage;
				}
			}
		}

		// Calculate final average scores from the processed opportunities
		if (allResults.opportunities.length > 0) {
			allResults.processingMetrics.averageScoreAfterFiltering =
				allResults.opportunities.reduce(
					(sum, opp) => sum + opp.relevanceScore,
					0
				) / allResults.opportunities.length;
		}

		// Calculate total processing time
		const executionTime = Date.now() - startTime;
		allResults.processingMetrics.processingTime = executionTime;

		console.log('\n=== Detail Processing Complete ===');
		console.log(
			`Processed ${detailedOpportunities.length} opportunities in ${(
				executionTime / 1000
			).toFixed(1)}s`
		);
		console.log(
			`${allResults.opportunities.length} opportunities passed filtering`
		);
		console.log(
			`Average score after filtering: ${allResults.processingMetrics.averageScoreAfterFiltering.toFixed(
				1
			)}`
		);

		// Log the execution
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

		// Update run with second stage filter metrics if runManager is provided
		if (runManager) {
			await runManager.updateSecondStageFilter({
				inputCount: detailedOpportunities.length,
				passedCount: allResults.opportunities.length,
				rejectedCount: allResults.processingMetrics.rejectedCount,
				rejectionReasons: allResults.processingMetrics.rejectionReasons,
				averageScoreBeforeFiltering: 0, // Not applicable for raw opportunities
				averageScoreAfterFiltering:
					allResults.processingMetrics.averageScoreAfterFiltering,
				processingTime: executionTime,
				filterReasoning: allResults.processingMetrics.filterReasoning,
				sampleOpportunities: allResults.opportunities.slice(0, 3),
				chunkMetrics: allResults.processingMetrics.chunkMetrics,
			});
		}

		return allResults;
	} catch (error) {
		// Log the error
		console.error('Error in Detail Processor Agent:', error);

		// Log the API activity with error
		await logApiActivity(supabase, source.id, 'detail_processing', 'failure', {
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
 * Processes detailed opportunity information in batches with adaptive sizing
 * @param {Array} detailedOpportunities - The detailed opportunities from the API Handler Agent
 * @param {Object} source - The API source
 * @param {Object} runManager - Optional RunManager instance for tracking
 * @param {Object} config - Configuration for the detail processor
 * @returns {Promise<Object>} - The filtered opportunities
 */
export async function processDetailedInfo(
	detailedOpportunities,
	source,
	runManager = null,
	config = {}
) {
	// Default configuration
	const defaultConfig = {
		minScoreThreshold: 7,
		batchSize: 40,
		maxConcurrentBatches: 5,
		model: 'claude-3-5-haiku-20241022',
		temperature: 0.2,
		maxTokensPerRequest: 16000,
	};

	// Merge with provided config
	const processingConfig = { ...defaultConfig, ...config };

	// Process with the Detail Processor Agent
	const result = await detailProcessorAgent(
		detailedOpportunities,
		source,
		runManager,
		processingConfig
	);

	return result;
}
