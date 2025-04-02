import { ChatAnthropic } from '@langchain/anthropic';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import {
	createSupabaseClient,
	logAgentExecution,
	logApiActivity,
} from '../supabase';
import { z } from 'zod';
import {
	TAXONOMIES,
	generateTaxonomyInstruction,
} from '../constants/taxonomies';
import { processChunksInParallel } from '../utils/parallelProcessing';

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
						'Relevance score from 1-10. This MUST be exactly equal to this sum calculated: [Focus Areas] + [Applicability] + [Funding Type] + [Matching Requirements] + [Implementation]. Do not assign a score that differs from this calculation.'
					),
				relevanceReasoning: z
					.string()
					.optional()
					.describe(
						'Detailed explanation of the relevance score. MUST INCLUDE: ' +
							'1) Point-by-point scoring breakdown (Focus Areas: X/3, ' +
							'Applicability: X/3, Funding Type Quality: X/1, Matching Requirements: X/1, Project Implementation Type: X/2), ' +
							'2) Which specific data fields from the opportunity you examined, ' +
							'3) Direct quotes or values from these fields that influenced your scoring, ' +
							'4) The final total relevance score calculation showing the sum of all individual scores, and ' +
							'5) An explicit calculation showing the math (e.g., "3.0 + 2.5 + 1.0 + 1.0 + 2.0 = 9.5 points"). The total MUST match this calculation exactly. ' +
							'6) VERIFICATION STEP: Double-check your math. Add up each component score again to verify the total is correct.'
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
				.nullable()
				.describe(
					'Average relevance score after filtering (null if none passed)'
				),
			filterReasoning: z
				.string()
				.describe('Summary of why items were filtered'),
		})
		.describe('Metrics about the processing'),
});

// Define the prompt template for the agent
const detailProcessorPromptTemplateString = `You are an expert funding opportunity analyst for energy and infrastructure projects.
Your task is to perform a detailed analysis of funding opportunities to determine their relevance and value to our clients.

These are our client types:
- K-12 schools
- Community colleges and universities
- Municipal, county, and state governments
- Federal agencies
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

## Relevance Scoring System

For each funding opportunity, calculate a relevance score out of 10 points based on the following criteria:

1. Alignment with Focus Areas (0-3 points)
   - 3.0 points: Strong alignment with energy efficiency
   - 2.5 points: Strong alignment with one or more of our focus areas
   - 2.0 points: Moderate alignment with one or more focus areas
   - 1.0 point: Minimal alignment with one or more focus areas
   - 0.0 points: No alignment with any focus area

2. Applicability to Client Types (0-3 points)
   - 3.0 points: Applicable to K-12 schools
   - 2.5 points: Applicable to one or more of our client types outside of k-12 schools (federal agencies, municipalities, universities, etc.)
   - 0.0 points: Not applicable to any of our client types

3. Funding Type Quality (0-1 point)
   - 1.0 point: Pure grant
   - 0.5 points: Any other funding type (rebate, loan, tax incentive, etc.)

4. Matching Requirements (0-1 point)
   - 1.0 point: No matching requirements
   - 0.0 points: Any matching requirements

5. Project Implementation Type (0-2 points)
   - 2.0 points: Requires contractor implementation (construction, renovation, installation, etc.)
   - 1.0 point: May partially require contractor work
   - 0.0 points: Likely doesn't require contractor (research, planning, assessment only)

### Relevance Score Calculation
You MUST calculate the relevance score using simple addition:
1. Focus Areas score: [X.X points]
2. Client Types score: [X.X points]
3. Funding Type score: [X.X points]
4. Matching Requirements score: [X.X points]
5. Implementation Type score: [X.X points]
6. Relevance Score = [Focus Areas] + [Client Types] + [Funding Type] + [Matching Requirements] + [Implementation Type] = [X.X] points

MISSING INFORMATION GUIDANCE:
When information is missing for any scoring category, assume the most favorable condition:
- No matching requirement data → Assume no match required (1/1)
- No funding type specified → Assume pure grant (1/1)
- No implementation details → Assume contractor work needed (2/2)

For each scoring category, if data is not available, explicitly state "Data not available" in both the Reasoning and Evidence sections, then apply the favorable assumption as specified above.

IMPORTANT FOR RELEVANCE REASONING:
When explaining your relevance score, you MUST use this exact format:

SCORING CALCULATION:
[Focus Areas]
Score: ___ /3.0 points
Reasoning: (explain which focus areas aligned, or state "Data not available")
Evidence: "quote from source" or "Data not available - assuming favorable condition"

[Applicability]
Score: ___ /3.0 points
Reasoning: (specify which client types, or state "Data not available". If you give a score of 0.0, you must provide a list of all of our client types. if you don't know our client types, state "i don't know our client types, please provide a list of our client types")
Evidence: "quote from source" or "Data not available - assuming favorable condition"

[Funding Type]
Score: ___ /1.0 points
Reasoning: (note what type of funding it is, or state "Data not available")
Evidence: "quote from source" or "Data not available - assuming favorable condition"

[Matching Requirements]
Score: ___ /1.0 points
Reasoning: (note any match requirements, or state "Data not available")
Evidence: "quote from source" or "Data not available - assuming favorable condition"

[Implementation]
Score: ___ /2.0 points
Reasoning: (note to what degree the project requires contractor work, or state "Data not available")
Evidence: "quote from source" or "Data not available - assuming favorable condition"

[Total Relevance Score]
score: ___ /10.0 points
Reasoning: [focus areas] + [applicability] + [funding type] + [matching requirements] + [implementation]
----------------------------------------


You MUST fill in each blank with the exact numerical score you've determined. The total MUST be the precise sum of the individual scores above.

DATA FIELDS EXAMINED:
- List each field from the API response you examined
- Include the specific values found

This structured format is required for every opportunity you analyze. The total score MUST match the sum of the individual components.



Only include opportunities with a {minRelevanceScore} or higher in your final output. In the absence of information, make assumptions to lean on the side of inclusion.

IMPORTANT: Calculate and return the average relevance score for ALL opportunities BEFORE filtering. This should be the mean of all scores you assigned, both for opportunities that pass and fail the minimum threshold filter.

ACTIONABLE SUMMARY REQUIREMENT:
For each opportunity, provide a concise "actionable summary" in a single paragraph (2-3 sentences) that includes:
1. The funding source (specific agency or organization)
2. The total funding available for the entire program and/or per award
3. Who can apply (specific eligible entities)
4. SPECIFICALLY what the money is for (the exact activities or projects to be funded)
5. When applications are due (specific deadline)

At this detail processing stage, you should have more complete information than in the first stage. Use this additional detail to create a comprehensive summary. However, if any critical information is still missing, clearly indicate what's unknown using phrases like "amount unspecified," "eligibility unclear," or "deadline not provided." Do not make up information that isn't in the source data.

Example with complete information: "This is a $5M grant from the Department of Energy for schools to implement building performance standards and upgrade HVAC systems. School districts can receive up to $500K each, and applications are due August 15, 2025."

Example with some missing information: "This is a grant from the Department of Energy (amount unspecified) for K-12 schools to implement energy efficiency measures including LED lighting and HVAC upgrades. Applications are due August 15, 2025."

Write this summary in plain language, focusing on clarity and specificity about what is known while being transparent about what is unknown.

For each selected opportunity, provide:
1. Opportunity ID and title
2. Relevance score (1-10)
3. Primary focus area(s)
4. Eligible client types
5. Key benefits (2-3 bullet points)
6. Any notable restrictions or requirements
7. Brief reasoning for the relevance score and inclusion

${generateTaxonomyInstruction(
	'ELIGIBLE_PROJECT_TYPES',
	'eligible project types'
)}

${generateTaxonomyInstruction('ELIGIBLE_APPLICANTS', 'eligible applicants')}

${generateTaxonomyInstruction('CATEGORIES', 'funding categories')}

${generateTaxonomyInstruction('FUNDING_TYPES', 'funding types')}

${generateTaxonomyInstruction('ELIGIBLE_LOCATIONS', 'eligible locations')}

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
		minScoreThreshold: 6,
		tokenThreshold: 10000,
		model: 'claude-3-5-haiku-20241022',
		temperature: 0,
		maxTokensPerRequest: 16000,
		maxConcurrent: 5, // Control parallel processing concurrency
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
			metrics: {}, // For backward compatibility
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

		// Define the function to process a single chunk
		const processChunk = async (chunk, chunkIndex) => {
			const chunkStartTime = Date.now();
			console.log(
				`\nProcessing chunk ${chunkIndex + 1}/${chunks.length} with ${
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

			try {
				// Get the LLM response
				const response = await model.invoke(prompt);

				// Parse the response
				const result = await parser.parse(response.content);

				// Calculate chunk metrics
				const chunkTime = Date.now() - chunkStartTime;
				const chunkMetrics = {
					chunkIndex: chunkIndex + 1,
					processedOpportunities: chunk.length,
					passedCount: result.opportunities.length,
					timeSeconds: (chunkTime / 1000).toFixed(1),
					status: 'success',
				};

				console.log(
					`Chunk ${chunkIndex + 1} completed successfully: ${
						result.opportunities.length
					}/${chunk.length} opportunities passed filtering (${
						chunkMetrics.timeSeconds
					}s)`
				);

				return {
					opportunities: result.opportunities,
					processingMetrics: {
						...result.processingMetrics,
						chunkMetrics,
					},
				};
			} catch (error) {
				// Calculate chunk metrics for failed chunk
				const chunkTime = Date.now() - chunkStartTime;
				const chunkMetrics = {
					chunkIndex: chunkIndex + 1,
					processedOpportunities: chunk.length,
					passedCount: 0,
					timeSeconds: (chunkTime / 1000).toFixed(1),
					status: 'failed',
					error: error.message,
				};

				console.error(
					`Error processing chunk ${chunkIndex + 1}/${chunks.length}: ${
						error.message
					}`
				);

				return {
					opportunities: [],
					processingMetrics: {
						passedCount: 0,
						rejectedCount: chunk.length,
						rejectionReasons: ['Error processing chunk'],
						chunkMetrics,
						error: error.message,
					},
				};
			}
		};

		// Process all chunks in parallel with controlled concurrency
		const chunkResults = await processChunksInParallel(
			chunks,
			processChunk,
			processingConfig.maxConcurrent
		);

		// Combine all results
		for (const result of chunkResults) {
			// Add filtered opportunities to combined results
			allResults.opportunities.push(...result.opportunities);

			// Update metrics
			allResults.processingMetrics.passedCount +=
				result.processingMetrics.passedCount || 0;
			allResults.processingMetrics.rejectedCount +=
				result.processingMetrics.rejectedCount || 0;

			// Add unique rejection reasons
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

			// Track token usage
			if (result.processingMetrics.tokenUsage) {
				allResults.processingMetrics.tokenUsage +=
					result.processingMetrics.tokenUsage;
			}

			// Add chunk metrics
			if (result.processingMetrics.chunkMetrics) {
				allResults.processingMetrics.chunkMetrics.push(
					result.processingMetrics.chunkMetrics
				);
			}

			// Update average score before filtering with weighted approach
			if (result.processingMetrics.averageScoreBeforeFiltering !== undefined) {
				// We'll collect all scores and calculate a weighted average after
				result.processingMetrics._processedCount =
					result.processingMetrics.passedCount +
					result.processingMetrics.rejectedCount;
				result.processingMetrics._weightedScore =
					result.processingMetrics.averageScoreBeforeFiltering *
					result.processingMetrics._processedCount;
			}
		}

		// Calculate weighted average score before filtering
		const totalProcessed = chunkResults.reduce(
			(sum, result) => sum + (result.processingMetrics._processedCount || 0),
			0
		);
		const totalWeightedScore = chunkResults.reduce(
			(sum, result) => sum + (result.processingMetrics._weightedScore || 0),
			0
		);

		if (totalProcessed > 0) {
			allResults.processingMetrics.averageScoreBeforeFiltering =
				totalWeightedScore / totalProcessed;
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

		// Capture raw filtered samples for debugging
		if (allResults.opportunities.length > 0) {
			const rawSampleSize = Math.min(3, allResults.opportunities.length);
			const rawFilteredSamples = [];

			for (let i = 0; i < rawSampleSize; i++) {
				const rawItem = allResults.opportunities[i];
				if (typeof rawItem !== 'object' || rawItem === null) continue;

				// Clone the item to avoid reference issues
				const rawSample = JSON.parse(JSON.stringify(rawItem));

				// Add metadata to identify this as a raw sample
				rawSample._rawSample = true;
				rawSample._sampleIndex = i;
				rawSample._filterStage = 'second';

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
			allResults.metrics.rawFilteredSamples = rawFilteredSamples;
			// For backward compatibility
			allResults.processingMetrics.rawFilteredSamples = rawFilteredSamples;
		}

		// Update run manager with metrics
		if (runManager) {
			await runManager.updateSecondStageFilter(allResults.processingMetrics);
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
