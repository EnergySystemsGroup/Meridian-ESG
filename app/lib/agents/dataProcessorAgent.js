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

					// Special handling for funding_source/funding_source_id
					if (key === 'funding_source') {
						// If funding source IDs don't match, it's a change
						return (
							fundingSourceId &&
							fundingSourceId !== existingOpportunity.funding_source_id
						);
					}

					// Map camelCase to snake_case for DB field comparison
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
					};

					const dbFieldName = fieldMap[key] || key;

					// Special handling for text fields that might have minor LLM wording differences
					if (['description', 'actionableSummary'].includes(key)) {
						// Skip minor text differences in these fields
						return false;
					}

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

					// Special handling for arrays - compare content, not order
					if (
						Array.isArray(opportunity[key]) &&
						Array.isArray(existingOpportunity[dbFieldName])
					) {
						const existingArr = [...existingOpportunity[dbFieldName]].sort();
						const newArr = [...opportunity[key]].sort();

						// Compare length first for quick check
						if (existingArr.length !== newArr.length) return true;

						// Compare elements
						return existingArr.some((item, index) => {
							return JSON.stringify(item) !== JSON.stringify(newArr[index]);
						});
					}

					// Default comparison
					return (
						JSON.stringify(opportunity[key]) !==
						JSON.stringify(existingOpportunity[dbFieldName])
					);
				});

				if (hasChanges) {
					// Track what fields changed
					const changedFields = [];
					Object.keys(opportunity).forEach((key) => {
						// Skip certain fields from comparison
						if (
							[
								'id',
								'created_at',
								'updated_at',
								'raw_response_id',
								'description',
								'actionableSummary',
							].includes(key)
						) {
							return;
						}

						// Special handling for opportunity_number/id comparison
						if (key === 'id') {
							if (opportunity.id !== existingOpportunity.opportunity_number) {
								changedFields.push({
									field: 'opportunity_number',
									oldValue: existingOpportunity.opportunity_number,
									newValue: opportunity.id,
								});
							}
							return;
						}

						// Special handling for funding_source/funding_source_id
						if (key === 'funding_source') {
							if (
								fundingSourceId &&
								fundingSourceId !== existingOpportunity.funding_source_id
							) {
								// Capture the funding source name and any other relevant details
								let fundingSourceNote = `Funding source changed to "${
									opportunity.funding_source?.name || 'Unknown'
								}"`;

								// Add additional details if available
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
							return;
						}

						// Map camelCase to snake_case for comparison
						const fieldMap = {
							title: 'title',
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
						};

						const dbFieldName = fieldMap[key] || key;

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

							if (existingDate !== newDate) {
								changedFields.push({
									field: dbFieldName,
									oldValue: existingOpportunity[dbFieldName],
									newValue: opportunity[key],
									note: 'Date changed',
								});
							}
							return;
						}

						// Special handling for amounts - check if significant difference (>5%)
						if (
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
									// Only consider >5% changes as material
									changedFields.push({
										field: dbFieldName,
										oldValue: existingOpportunity[dbFieldName],
										newValue: opportunity[key],
										note: `${percentDiff.toFixed(1)}% change in amount`,
									});
								}
							}
							return;
						}

						// Special handling for arrays
						if (
							Array.isArray(opportunity[key]) &&
							Array.isArray(existingOpportunity[dbFieldName])
						) {
							const existingArr = [...existingOpportunity[dbFieldName]].sort();
							const newArr = [...opportunity[key]].sort();

							// Simple length check
							if (existingArr.length !== newArr.length) {
								changedFields.push({
									field: dbFieldName,
									oldValue: existingOpportunity[dbFieldName],
									newValue: opportunity[key],
									note: `Changed from ${existingArr.length} items to ${newArr.length} items`,
								});
								return;
							}

							// Check for content differences
							const hasChanges = existingArr.some((item, index) => {
								return JSON.stringify(item) !== JSON.stringify(newArr[index]);
							});

							if (hasChanges) {
								changedFields.push({
									field: dbFieldName,
									oldValue: existingOpportunity[dbFieldName],
									newValue: opportunity[key],
									note: 'Array contents changed',
								});
							}
							return;
						}

						// Default check for other fields
						if (
							opportunity[key] !== undefined &&
							JSON.stringify(opportunity[key]) !==
								JSON.stringify(existingOpportunity[dbFieldName])
						) {
							changedFields.push({
								field: dbFieldName,
								oldValue: existingOpportunity[dbFieldName],
								newValue: opportunity[key],
							});
						}
					});

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
