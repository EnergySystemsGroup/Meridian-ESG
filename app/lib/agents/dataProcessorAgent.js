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
				fundingSourcesCreated: 0,
				fundingSourcesReused: 0,
			},
		};

		/**
		 * Get or create a funding source based on funding_source object
		 * @param {Object} fundingSource - Funding source object with name, type, etc.
		 * @param {string} apiSourceType - Type of the API source (federal, state, etc.)
		 * @returns {Promise<string>} - ID of the funding source
		 */
		async function getOrCreateFundingSource(fundingSource, apiSourceType) {
			if (!fundingSource || !fundingSource.name) {
				console.log('No funding source name provided');
				return null;
			}

			const agencyName = fundingSource.name;
			console.log(`Processing funding source: "${agencyName}"`);

			// Try to find existing funding source by name
			const { data: existingSources, error: findError } = await supabase
				.from('funding_sources')
				.select(
					'id, name, type, agency_type, website, description, contact_email, contact_phone'
				)
				.ilike('name', agencyName)
				.limit(1);

			if (findError) {
				console.error('Error finding funding source:', findError);
				return null;
			}

			// If found, return the ID but also update with any new information
			if (existingSources && existingSources.length > 0) {
				console.log(
					`Found existing funding source: ${existingSources[0].name}`
				);
				result.metrics.fundingSourcesReused++;

				// Check if we need to update with new information
				const existingSource = existingSources[0];
				const updates = {};
				let needsUpdate = false;

				// Check each field for potential updates
				if (
					fundingSource.website &&
					existingSource.website !== fundingSource.website
				) {
					updates.website = fundingSource.website;
					needsUpdate = true;
				}

				if (
					fundingSource.contact_email &&
					existingSource.contact_email !== fundingSource.contact_email
				) {
					updates.contact_email = fundingSource.contact_email;
					needsUpdate = true;
				}

				if (
					fundingSource.contact_phone &&
					existingSource.contact_phone !== fundingSource.contact_phone
				) {
					updates.contact_phone = fundingSource.contact_phone;
					needsUpdate = true;
				}

				// Build a better description if we have new information
				let newDescription = existingSource.description || 'Funding agency';
				if (
					fundingSource.description &&
					!existingSource.description?.includes(fundingSource.description)
				) {
					newDescription = fundingSource.description;
					needsUpdate = true;
				}

				if (
					fundingSource.parent_organization &&
					!existingSource.description?.includes(
						fundingSource.parent_organization
					)
				) {
					if (!newDescription.includes(fundingSource.parent_organization)) {
						newDescription += ` (Part of ${fundingSource.parent_organization})`;
						needsUpdate = true;
					}
				}

				if (newDescription !== existingSource.description) {
					updates.description = newDescription;
				}

				// Only update agency_type if we have a more specific one
				if (
					fundingSource.agency_type &&
					(!existingSource.agency_type ||
						existingSource.agency_type === 'Other')
				) {
					updates.agency_type = fundingSource.agency_type;
					needsUpdate = true;
				}

				// Only update type if we have a more specific one
				if (fundingSource.type && !existingSource.type) {
					updates.type = fundingSource.type;
					needsUpdate = true;
				}

				if (needsUpdate) {
					// Update the existing source with new information
					updates.updated_at = new Date().toISOString();

					const { error: updateError } = await supabase
						.from('funding_sources')
						.update(updates)
						.eq('id', existingSource.id);

					if (updateError) {
						console.error('Error updating funding source:', updateError);
					} else {
						console.log(
							'Updated funding source with new information:',
							Object.keys(updates).join(', ')
						);
					}
				}

				return existingSources[0].id;
			}

			// If not found, create a new funding source
			// Determine agency_type based on funding source type or API source type
			let agencyType = fundingSource.agency_type || 'Federal';
			if (!fundingSource.agency_type) {
				// If no agency_type is provided, derive it from type field or apiSourceType
				if (fundingSource.type) {
					// Convert to proper agency_type format
					const type = fundingSource.type.toLowerCase();
					if (type.includes('federal')) agencyType = 'Federal';
					else if (type.includes('state')) agencyType = 'State';
					else if (type.includes('local')) agencyType = 'Other';
					else if (type.includes('utility')) agencyType = 'Utility';
					else if (type.includes('foundation') || type.includes('private'))
						agencyType = 'Foundation';
				} else if (apiSourceType) {
					// Derive from API source type
					if (apiSourceType.toLowerCase() === 'federal') agencyType = 'Federal';
					else if (apiSourceType.toLowerCase() === 'state')
						agencyType = 'State';
					else if (apiSourceType.toLowerCase() === 'local')
						agencyType = 'Other';
					else if (apiSourceType.toLowerCase() === 'utility')
						agencyType = 'Utility';
					else if (apiSourceType.toLowerCase() === 'private')
						agencyType = 'Foundation';
				}
			}

			// Build description
			let description =
				fundingSource.description ||
				`Funding agency extracted from opportunity data`;
			if (
				fundingSource.parent_organization &&
				!description.includes(fundingSource.parent_organization)
			) {
				description += ` (Part of ${fundingSource.parent_organization})`;
			}

			// Create a new funding source with all available fields
			const { data: newSource, error: createError } = await supabase
				.from('funding_sources')
				.insert({
					name: agencyName,
					agency_type: agencyType,
					type: fundingSource.type || apiSourceType || 'federal',
					website: fundingSource.website || null,
					contact_email: fundingSource.contact_email || null,
					contact_phone: fundingSource.contact_phone || null,
					description: description,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				})
				.select()
				.single();

			if (createError) {
				console.error('Error creating funding source:', createError);
				return null;
			}

			console.log(
				`Created new funding source: ${newSource.name} (${newSource.id})`
			);
			result.metrics.fundingSourcesCreated++;
			return newSource.id;
		}

		// Get API source type for better categorization of funding sources
		const { data: apiSourceData, error: apiSourceError } = await supabase
			.from('api_sources')
			.select('type')
			.eq('id', sourceId)
			.single();

		const apiSourceType = apiSourceData?.type || 'federal';

		// Function to sanitize opportunity data for the database
		// Converting camelCase to snake_case and filtering out non-existent columns
		function sanitizeOpportunityForDatabase(opportunity) {
			// Map of camelCase to snake_case fields
			const fieldMap = {
				title: 'title',
				description: 'description',
				url: 'url',
				status: 'status',
				fundingType: 'funding_type',
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
				// Agency is handled separately through funding_source_id
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
			sanitized.raw_response_id = rawResponseId;

			return sanitized;
		}

		// Process each opportunity
		for (const opportunity of opportunities) {
			console.log(`Processing opportunity: ${opportunity.title}`);

			// Process funding source first
			const fundingSourceId = await getOrCreateFundingSource(
				opportunity.funding_source,
				apiSourceType
			);

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

				// Add funding source ID
				if (fundingSourceId) {
					opportunityData.funding_source_id = fundingSourceId;
				}

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
				// Check if update is needed by comparing ONLY critical fields
				const criticalFields = [
					'totalFundingAvailable',
					'minimumAward',
					'maximumAward',
					'openDate',
					'closeDate',
					'status',
				];
				const hasChanges = criticalFields.some((key) => {
					// Skip if field isn't in the opportunity
					if (opportunity[key] === undefined) {
						return false;
					}

					// Map camelCase to snake_case for DB field comparison
					const fieldMap = {
						status: 'status',
						openDate: 'open_date',
						closeDate: 'close_date',
						minimumAward: 'minimum_award',
						maximumAward: 'maximum_award',
						totalFundingAvailable: 'total_funding_available',
					};

					const dbFieldName = fieldMap[key];

					// Special handling for date fields
					if (['openDate', 'closeDate'].includes(key)) {
						const existingDate = existingOpportunity[dbFieldName]
							? new Date(existingOpportunity[dbFieldName])
									.toISOString()
									.split('T')[0]
							: null;
						const newDate = opportunity[key]
							? new Date(opportunity[key]).toISOString().split('T')[0]
							: null;
						return existingDate !== newDate;
					}

					// Special handling for amounts - check if significant difference (>5%)
					if (
						['minimumAward', 'maximumAward', 'totalFundingAvailable'].includes(
							key
						)
					) {
						const existingAmount = parseFloat(
							existingOpportunity[dbFieldName] || 0
						);
						const newAmount = parseFloat(opportunity[key] || 0);

						// If both are zero or null, no change
						if (!existingAmount && !newAmount) return false;

						// If one is missing and the other isn't, that's a change
						if (
							(!existingAmount && newAmount) ||
							(existingAmount && !newAmount)
						)
							return true;

						// Calculate percentage difference and only count significant changes
						const percentDiff =
							Math.abs((newAmount - existingAmount) / existingAmount) * 100;
						return percentDiff > 5; // Only consider >5% changes as material
					}

					// For status field, direct comparison
					if (key === 'status') {
						return opportunity[key] !== existingOpportunity[dbFieldName];
					}

					return false;
				});

				if (hasChanges) {
					// Track only critical field changes
					const changedFields = [];
					criticalFields.forEach((key) => {
						if (opportunity[key] === undefined) return;

						const fieldMap = {
							status: 'status',
							openDate: 'open_date',
							closeDate: 'close_date',
							minimumAward: 'minimum_award',
							maximumAward: 'maximum_award',
							totalFundingAvailable: 'total_funding_available',
						};

						const dbFieldName = fieldMap[key];

						// Date fields
						if (['openDate', 'closeDate'].includes(key)) {
							const existingDate = existingOpportunity[dbFieldName]
								? new Date(existingOpportunity[dbFieldName])
										.toISOString()
										.split('T')[0]
								: null;
							const newDate = opportunity[key]
								? new Date(opportunity[key]).toISOString().split('T')[0]
								: null;

							if (existingDate !== newDate) {
								changedFields.push({
									field: dbFieldName,
									oldValue: existingOpportunity[dbFieldName],
									newValue: opportunity[key],
									note: 'Date changed',
								});
							}
						}
						// Amount fields
						else if (
							[
								'minimumAward',
								'maximumAward',
								'totalFundingAvailable',
							].includes(key)
						) {
							const existingAmount = parseFloat(
								existingOpportunity[dbFieldName] || 0
							);
							const newAmount = parseFloat(opportunity[key] || 0);

							// Calculate percentage difference
							if (existingAmount || newAmount) {
								// Avoid division by zero
								const baseDivisor = existingAmount || 0.01;
								const percentDiff =
									Math.abs((newAmount - existingAmount) / baseDivisor) * 100;

								if (percentDiff > 5) {
									changedFields.push({
										field: dbFieldName,
										oldValue: existingOpportunity[dbFieldName],
										newValue: opportunity[key],
										note: `${percentDiff.toFixed(1)}% change in amount`,
									});
								}
							}
						}
						// Status field
						else if (
							key === 'status' &&
							opportunity[key] !== existingOpportunity[dbFieldName]
						) {
							changedFields.push({
								field: dbFieldName,
								oldValue: existingOpportunity[dbFieldName],
								newValue: opportunity[key],
								note: 'Status changed',
							});
						}
					});

					// We still want to update the funding source if it's provided and different
					if (
						fundingSourceId &&
						fundingSourceId !== existingOpportunity.funding_source_id
					) {
						let fundingSourceNote = `Funding source changed to "${
							opportunity.funding_source?.name || 'Unknown'
						}"`;

						if (opportunity.funding_source?.type) {
							fundingSourceNote += ` (${opportunity.funding_source.type})`;
						}

						if (opportunity.funding_source?.parent_organization) {
							fundingSourceNote += `, part of ${opportunity.funding_source.parent_organization}`;
						}

						changedFields.push({
							field: 'funding_source_id',
							oldValue: existingOpportunity.funding_source_id,
							newValue: fundingSourceId,
							note: fundingSourceNote,
						});
					}

					// Sanitize opportunity data for database update
					const updateData = sanitizeOpportunityForDatabase(opportunity);
					// For updates, we only want to update the timestamp
					updateData.created_at = undefined; // Remove created_at for updates

					// Add funding source ID if it exists
					if (fundingSourceId) {
						updateData.funding_source_id = fundingSourceId;
					}

					// Remove the id field to prevent conflicts with DB ID
					delete updateData.id;

					// Console log for debugging
					console.log(
						'Prepared opportunity data for update:',
						Object.keys(updateData).join(', ')
					);
					console.log('Fields changed:', changedFields);

					// Create a new update object with ONLY changed fields to minimize updates
					const limitedUpdateData = { updated_at: new Date().toISOString() };

					// If raw_response_id is provided and different from existing, update it
					if (
						rawResponseId &&
						existingOpportunity.raw_response_id !== rawResponseId
					) {
						limitedUpdateData.raw_response_id = rawResponseId;
						changedFields.push({
							field: 'raw_response_id',
							oldValue: existingOpportunity.raw_response_id,
							newValue: rawResponseId,
							note: 'Updated link to raw API response',
						});
					}

					// Fields we want to potentially update
					const criticalFieldsMap = {
						status: 'status',
						open_date: 'openDate',
						close_date: 'closeDate',
						minimum_award: 'minimumAward',
						maximum_award: 'maximumAward',
						total_funding_available: 'totalFundingAvailable',
						funding_source_id: 'funding_source_id',
					};

					// Only include critical fields that have changed
					changedFields.forEach((change) => {
						const field = change.field;

						// For each critical field that changed, add it to the update
						if (field === 'funding_source_id') {
							limitedUpdateData.funding_source_id = fundingSourceId;
						} else if (field in criticalFieldsMap) {
							// For known critical fields, add them to the update
							if (field === 'open_date' && opportunity.openDate !== undefined) {
								limitedUpdateData.open_date = opportunity.openDate;
							} else if (
								field === 'close_date' &&
								opportunity.closeDate !== undefined
							) {
								limitedUpdateData.close_date = opportunity.closeDate;
							} else if (
								field === 'minimum_award' &&
								opportunity.minimumAward !== undefined
							) {
								limitedUpdateData.minimum_award = opportunity.minimumAward;
							} else if (
								field === 'maximum_award' &&
								opportunity.maximumAward !== undefined
							) {
								limitedUpdateData.maximum_award = opportunity.maximumAward;
							} else if (
								field === 'total_funding_available' &&
								opportunity.totalFundingAvailable !== undefined
							) {
								limitedUpdateData.total_funding_available =
									opportunity.totalFundingAvailable;
							} else if (
								field === 'status' &&
								opportunity.status !== undefined
							) {
								limitedUpdateData.status = opportunity.status;
							}
						}
					});

					// Update existing opportunity with ONLY the changed fields
					const { data: updatedData, error: updateError } = await supabase
						.from('funding_opportunities')
						.update(limitedUpdateData)
						.eq('id', existingOpportunity.id)
						.select()
						.single();

					if (updateError) {
						console.error('Error updating opportunity:', updateError);
						continue;
					}

					// Add change tracking to the updated opportunity data
					updatedData._changedFields = changedFields;
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
				fundingSourcesCreated: result.metrics.fundingSourcesCreated,
				fundingSourcesReused: result.metrics.fundingSourcesReused,
				// Include samples of stored and updated opportunities
				storedOpportunities: await Promise.all(
					result.newOpportunities.slice(0, 3).map(async (opp) => {
						// Get funding source details if available
						let fundingSourceData = null;
						if (opp.funding_source_id) {
							const { data } = await supabase
								.from('funding_sources')
								.select(
									'name, type, agency_type, website, contact_email, contact_phone, description'
								)
								.eq('id', opp.funding_source_id)
								.single();

							fundingSourceData = data;
						}

						return {
							...opp,
							operation: 'new',
							// Add funding source details for display
							funding_source_name: fundingSourceData?.name,
							funding_source_type:
								fundingSourceData?.agency_type || fundingSourceData?.type,
							funding_source_website: fundingSourceData?.website,
							funding_source_email: fundingSourceData?.contact_email,
							funding_source_phone: fundingSourceData?.contact_phone,
							funding_source_description: fundingSourceData?.description,
						};
					})
				),
				updatedOpportunities: await Promise.all(
					result.updatedOpportunities.slice(0, 3).map(async (opp) => {
						// Get funding source details if available
						let fundingSourceData = null;
						if (opp.funding_source_id) {
							const { data } = await supabase
								.from('funding_sources')
								.select(
									'name, type, agency_type, website, contact_email, contact_phone, description'
								)
								.eq('id', opp.funding_source_id)
								.single();

							fundingSourceData = data;
						}

						return {
							...opp,
							operation: 'updated',
							// Add funding source details for display
							funding_source_name: fundingSourceData?.name,
							funding_source_type:
								fundingSourceData?.agency_type || fundingSourceData?.type,
							funding_source_website: fundingSourceData?.website,
							funding_source_email: fundingSourceData?.contact_email,
							funding_source_phone: fundingSourceData?.contact_phone,
							funding_source_description: fundingSourceData?.description,
						};
					})
				),
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
