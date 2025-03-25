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
				const { data, error } = await supabase
					.from('funding_opportunities')
					.select('*')
					.eq('title', opportunity.title)
					.eq('source_id', sourceId)
					.limit(1);

				if (!error && data && data.length > 0) {
					existingOpportunity = data[0];
				}
			}

			if (!existingOpportunity) {
				// Prepare data for insertion, mapping external ID to opportunity_number
				const opportunityData = {
					...opportunity,
					opportunity_number: opportunity.id,
					source_id: sourceId,
					raw_response_id: rawResponseId,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};

				// Remove the id field to prevent conflicts with DB auto-generated IDs
				delete opportunityData.id;

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
					// Prepare update data, mapping external ID to opportunity_number
					const updateData = {
						...opportunity,
						opportunity_number: opportunity.id,
						raw_response_id: rawResponseId,
						updated_at: new Date().toISOString(),
					};

					// Remove the id field to prevent conflicts with DB ID
					delete updateData.id;

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
