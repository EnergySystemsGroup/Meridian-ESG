import { createSupabaseClient, logApiActivity } from '../supabase';

/**
 * Process a batch of opportunities
 * @param {Array} opportunities - Array of opportunities to process
 * @param {string} sourceId - The ID of the source
 * @param {string} rawResponseId - The ID of the already stored raw API response
 * @param {Object} runManager - Optional RunManager instance for tracking
 * @returns {Promise<Object>} - The processing results with new, updated, and ignored opportunities
 */
export async function processOpportunitiesBatch(
	opportunities,
	sourceId,
	rawResponseId,
	runManager = null
) {
	console.log('Processing opportunities batch:', opportunities);

	const supabase = createSupabaseClient();
	const startTime = Date.now();

	try {
		// Initialize results
		const result = {
			newOpportunities: [],
			updatedOpportunities: [],
			ignoredOpportunities: [],
			metrics: {
				total: opportunities.length,
				new: 0,
				updated: 0,
				ignored: 0,
				processingTime: 0,
			},
		};

		// Function to sanitize opportunity data for the database
		// Converting camelCase to snake_case and filtering out non-existent columns
		function sanitizeOpportunityForDatabase(opportunity) {
			// Map of camelCase to snake_case fields
			const fieldMap = {
				title: 'title',
				description: 'description',
				url: 'url',
				status: 'status',
				openDate: 'open_date',
				closeDate: 'close_date',
				minimumAward: 'minimum_award',
				maximumAward: 'maximum_award',
				totalFundingAvailable: 'total_funding_available',
				matchingRequired: 'cost_share_required',
				matchingPercentage: 'cost_share_percentage',
				eligibleApplicants: 'eligible_applicants',
				eligibleProjectTypes: 'eligible_project_types',
				eligibleLocations: 'eligible_locations',
				categories: 'categories',
				tags: 'tags',
				isNational: 'is_national',
				actionableSummary: 'actionable_summary',
				id: 'opportunity_number', // Special case: map external ID to opportunity_number
			};

			// Create sanitized object with snake_case keys
			const sanitized = {};
			for (const [camelCaseKey, snakeCaseKey] of Object.entries(fieldMap)) {
				if (opportunity[camelCaseKey] !== undefined) {
					sanitized[snakeCaseKey] = opportunity[camelCaseKey];
				}
			}

			// Add required metadata fields but don't include raw_response_id if it's not in the schema
			sanitized.source_id = sourceId;
			sanitized.created_at = new Date().toISOString();
			sanitized.updated_at = new Date().toISOString();

			return sanitized;
		}

		// Process each opportunity
		for (const opportunity of opportunities) {
			console.log(`Processing opportunity: ${opportunity.title}`);

			// Check for existing opportunity by opportunity ID first (mapped to opportunity_number in DB)
			let existingOpportunity = null;
			if (opportunity.id) {
				const { data, error } = await supabase
					.from('funding_opportunities')
					.select('*')
					.eq('opportunity_number', opportunity.id)
					.eq('source_id', sourceId)
					.limit(1);

				if (!error && data && data.length > 0) {
					existingOpportunity = data[0];
				}
			}

			// If no match by ID, try matching by title
			if (!existingOpportunity) {
				// Sanitize opportunity data for database insertion
				const opportunityData = sanitizeOpportunityForDatabase(opportunity);

				// Remove the id field to prevent conflicts with DB auto-generated IDs
				delete opportunityData.id;

				// Console log for debugging
				console.log(
					'Prepared opportunity data for insert:',
					Object.keys(opportunityData).join(', ')
				);

				// Insert new opportunity
				const { data: insertData, error: insertError } = await supabase
					.from('funding_opportunities')
					.insert(opportunityData)
					.select()
					.single();

				if (insertError) {
					console.error('Error inserting opportunity:', insertError);
					continue;
				}

				result.newOpportunities.push(insertData);
				result.metrics.new++;
			} else {
				// Check if update is needed by comparing fields
				const hasChanges = Object.keys(opportunity).some((key) => {
					// Skip certain fields from comparison
					if (
						['id', 'created_at', 'updated_at', 'raw_response_id'].includes(key)
					) {
						return false;
					}

					// Special handling for opportunity_number/id comparison
					if (key === 'id') {
						return opportunity.id !== existingOpportunity.opportunity_number;
					}

					return (
						JSON.stringify(opportunity[key]) !==
						JSON.stringify(existingOpportunity[key])
					);
				});

				if (hasChanges) {
					// Sanitize opportunity data for database update
					const updateData = sanitizeOpportunityForDatabase(opportunity);
					// For updates, we only want to update the timestamp
					updateData.created_at = undefined; // Remove created_at for updates

					// Remove the id field to prevent conflicts with DB ID
					delete updateData.id;

					// Console log for debugging
					console.log(
						'Prepared opportunity data for update:',
						Object.keys(updateData).join(', ')
					);

					// Update existing opportunity
					const { data: updatedData, error: updateError } = await supabase
						.from('funding_opportunities')
						.update(updateData)
						.eq('id', existingOpportunity.id)
						.select()
						.single();

					if (updateError) {
						console.error('Error updating opportunity:', updateError);
						continue;
					}

					result.updatedOpportunities.push(updatedData);
					result.metrics.updated++;
				} else {
					// No changes needed
					result.ignoredOpportunities.push(existingOpportunity);
					result.metrics.ignored++;
				}
			}
		}

		// Calculate processing time
		result.metrics.processingTime = Date.now() - startTime;

		// Update run manager with results if provided
		if (runManager) {
			await runManager.updateStorageResults({
				attemptedCount: result.metrics.total,
				storedCount: result.metrics.new,
				updatedCount: result.metrics.updated,
				skippedCount: result.metrics.ignored,
				processingTime: result.metrics.processingTime,
			});
		}

		// Log successful API activity
		await logApiActivity(supabase, sourceId, 'processing', 'success', {
			processed: result.metrics.total,
			new: result.metrics.new,
			updated: result.metrics.updated,
			ignored: result.metrics.ignored,
		});

		return result;
	} catch (error) {
		console.error('Error in Data Processor:', error);

		// Log API activity with error
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
