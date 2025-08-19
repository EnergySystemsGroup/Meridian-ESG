import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';
import axios from 'axios';

export async function GET(request) {
	try {
		console.log('Verification API called');
		const { supabase } = createClient(request);

		// Get the funding source
		const { data: sources, error: sourceError } = await supabase
			.from('funding_sources')
			.select('*')
			.eq('name', 'Grants.gov')
			.limit(1);

		if (sourceError) {
			console.error('Error fetching funding source:', sourceError);
			return NextResponse.json(
				{ error: 'Failed to fetch funding source' },
				{ status: 500 }
			);
		}

		if (!sources || sources.length === 0) {
			console.error('Grants.gov funding source not found');
			return NextResponse.json(
				{ error: 'Grants.gov funding source not found' },
				{ status: 404 }
			);
		}

		const source = sources[0];
		console.log('Found funding source:', source);

		// Use the correct Grants.gov API endpoints from the notes
		const searchEndpoint = 'https://api.grants.gov/v1/api/search2';
		const detailEndpoint = 'https://api.grants.gov/v1/api/fetchOpportunity';

		// Initialize stats object
		const stats = {
			initialApiCall: {},
			firstStageFilter: {},
			detailApiCalls: {},
			secondStageFilter: {},
			databaseStorage: {},
			processingTime: 0,
			actualProcessing: {},
		};

		// Make a test API call to Grants.gov search endpoint
		const startTime = Date.now();
		try {
			console.log('Making API call to search endpoint:', searchEndpoint);

			// Prepare search parameters based on the API notes
			const searchParams = {
				rows: 10,
				keyword: 'education',
				oppStatuses: 'forecasted|posted',
			};

			console.log('Search parameters:', searchParams);

			// Make the search request
			const searchResponse = await fetch(searchEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				body: JSON.stringify(searchParams),
			});

			const searchResponseTime = Date.now() - startTime;
			console.log('Search API response status:', searchResponse.status);

			if (!searchResponse.ok) {
				const errorText = await searchResponse.text();
				console.error('Search API error response:', errorText);
				stats.initialApiCall = {
					error: `Search API returned status ${searchResponse.status}: ${errorText}`,
					apiCallTime: searchResponseTime,
				};
			} else {
				const searchData = await searchResponse.json();
				console.log('Search API response data:', searchData);

				// Extract data from search response
				const oppHits = searchData.data?.oppHits || [];

				stats.initialApiCall = {
					totalHitCount: searchData.data?.hitCount || 0,
					totalItemsRetrieved: oppHits.length,
					apiCallCount: 1,
					firstPageCount: oppHits.length,
					totalPages:
						Math.ceil((searchData.data?.hitCount || 0) / searchParams.rows) ||
						0,
					sampleOpportunities: oppHits.slice(0, 3),
					apiEndpoint: searchEndpoint,
					responseTime: searchResponseTime,
					apiCallTime: searchResponseTime,
				};

				// After successfully getting the search results, add first-stage filtering
				if (oppHits.length > 0) {
					// First stage filtering simulation
					const firstStageStartTime = Date.now();

					// Simple relevance scoring based on opportunity title and description
					const scoredOpportunities = oppHits.map((opp) => {
						// Simple scoring logic
						let score = 0;
						const title = opp.title || '';
						const description = opp.synopsis || '';

						// Keywords to look for
						const keywords = [
							'education',
							'research',
							'development',
							'community',
							'health',
						];

						// Score based on keywords in title and description
						keywords.forEach((keyword) => {
							if (title.toLowerCase().includes(keyword.toLowerCase()))
								score += 2;
							if (
								description &&
								description.toLowerCase().includes(keyword.toLowerCase())
							)
								score += 1;
						});

						return { ...opp, relevanceScore: score };
					});

					// Filter opportunities with score > 0
					const filteredOpportunities = scoredOpportunities.filter(
						(opp) => opp.relevanceScore > 0
					);

					// Calculate score distribution
					const scoreDistribution = {};
					scoredOpportunities.forEach((opp) => {
						const score = opp.relevanceScore || 0;
						scoreDistribution[score] = (scoreDistribution[score] || 0) + 1;
					});

					const firstStageTime = Date.now() - firstStageStartTime;

					stats.firstStageFilter = {
						inputOpportunitiesCount: oppHits.length,
						opportunitiesPassingFirstFilter: filteredOpportunities.length,
						filterPassRate: oppHits.length
							? (filteredOpportunities.length / oppHits.length) * 100
							: 0,
						scoreDistribution: scoreDistribution,
						sampleFilteredOpportunities: filteredOpportunities.slice(0, 3),
						filteringTime: firstStageTime,
					};

					// After getting the initial API verification results, test the actual processing
					try {
						console.log('Testing actual processing pipeline...');

						// Call the processing endpoint for Grants.gov source
						const processingResponse = await fetch(
							`/api/funding/sources/${source.id}/process`,
							{
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
								},
							}
						);

						if (!processingResponse.ok) {
							throw new Error(
								`Processing failed with status ${processingResponse.status}`
							);
						}

						const processingResult = await processingResponse.json();

						// Add actual processing results to the stats
						stats.actualProcessing = {
							success: true,
							processingResults: processingResult,
							opportunitiesProcessed:
								processingResult.opportunities?.length || 0,
							llmFilteringResults: processingResult.filteringResults,
							storedOpportunities: processingResult.storedOpportunities,
						};
					} catch (processingError) {
						console.error('Error in actual processing:', processingError);
						stats.actualProcessing = {
							success: false,
							error: processingError.message,
						};
					}
				}

				// If we have search results, test the detail API with the first opportunity
				if (searchData.data?.oppHits && searchData.data.oppHits.length > 0) {
					const firstOpp = searchData.data.oppHits[0];
					const detailStartTime = Date.now();

					console.log(
						'Making API call to detail endpoint for opportunity:',
						firstOpp.id
					);

					// Prepare detail parameters
					const detailParams = {
						opportunityId: firstOpp.id,
					};

					// Make the detail request
					const detailResponse = await fetch(detailEndpoint, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Accept: 'application/json',
						},
						body: JSON.stringify(detailParams),
					});

					const detailResponseTime = Date.now() - detailStartTime;
					console.log('Detail API response status:', detailResponse.status);

					if (!detailResponse.ok) {
						const errorText = await detailResponse.text();
						console.error('Detail API error response:', errorText);
						stats.detailApiCalls = {
							opportunitiesRequiringDetails: 1,
							successfulDetailCalls: 0,
							failedDetailCalls: 1,
							detailCallErrors: [
								`API returned status ${detailResponse.status}: ${errorText}`,
							],
							averageDetailResponseTime: detailResponseTime,
							totalDetailCallTime: detailResponseTime,
						};
					} else {
						const detailData = await detailResponse.json();
						console.log('Detail API response data:', detailData);

						stats.detailApiCalls = {
							opportunitiesRequiringDetails: 1,
							successfulDetailCalls: 1,
							failedDetailCalls: 0,
							detailCallErrors: [],
							averageDetailResponseTime: detailResponseTime,
							totalDetailCallTime: detailResponseTime,
							sampleDetailResponse: detailData,
						};

						// After successfully getting the detail response, add second-stage filtering
						if (detailData.length > 0) {
							const secondStageStartTime = Date.now();

							// Enhanced scoring with detail information
							const enhancedScoredOpportunities = detailData.map((detail) => {
								const opportunity = detail.data?.opportunity || {};

								// More sophisticated scoring logic using detailed information
								let score = 0;
								const title = opportunity.opportunityTitle || '';
								const description = opportunity.synopsis?.synopsisDesc || '';
								const eligibility =
									opportunity.synopsis?.applicantEligibilityDesc || '';

								// Keywords with different weights
								const keywordWeights = {
									education: 3,
									research: 2,
									development: 2,
									community: 1,
									health: 2,
									grant: 1,
									funding: 1,
								};

								// Score based on weighted keywords
								Object.entries(keywordWeights).forEach(([keyword, weight]) => {
									if (title.toLowerCase().includes(keyword.toLowerCase()))
										score += weight * 2;
									if (
										description &&
										description.toLowerCase().includes(keyword.toLowerCase())
									)
										score += weight;
									if (
										eligibility &&
										eligibility.toLowerCase().includes(keyword.toLowerCase())
									)
										score += weight / 2;
								});

								return {
									id: opportunity.id,
									opportunityNumber: opportunity.opportunityNumber,
									title: opportunity.opportunityTitle,
									relevanceScore: score,
									focusAreas: ['Education', 'Research'], // Example focus areas
									clientTypes: ['Nonprofit', 'Educational'], // Example client types
								};
							});

							// Filter opportunities with enhanced score > 2
							const enhancedFilteredOpportunities =
								enhancedScoredOpportunities.filter(
									(opp) => opp.relevanceScore > 2
								);

							const secondStageTime = Date.now() - secondStageStartTime;

							stats.secondStageFilter = {
								inputOpportunitiesCount: detailData.length,
								opportunitiesPassingSecondFilter:
									enhancedFilteredOpportunities.length,
								filterPassRate: detailData.length
									? (enhancedFilteredOpportunities.length / detailData.length) *
									  100
									: 0,
								sampleFinalOpportunities: enhancedFilteredOpportunities,
								filteringTime: secondStageTime,
							};

							// Database storage simulation
							stats.databaseStorage = {
								opportunitiesToStore: enhancedFilteredOpportunities.length,
								storedCount: enhancedFilteredOpportunities.length,
								recentlyStoredCount: enhancedFilteredOpportunities.length,
								storedOpportunities: enhancedFilteredOpportunities.map(
									(opp) => ({
										title: opp.title,
										opportunityNumber: opp.opportunityNumber,
										status: 'new',
									})
								),
							};
						}
					}
				}
			}
		} catch (apiError) {
			console.error('API call error:', apiError);
			stats.initialApiCall = {
				error: `API call failed: ${apiError.message}`,
				apiCallTime: Date.now() - startTime,
			};
		}

		// Step 3: Check first-stage filtering results
		const { data: handlerExecutions, error: handlerError } = await supabase
			.from('agent_executions')
			.select('*')
			.eq('agent_type', 'api_handler')
			.eq('source_id', source.id)
			.order('created_at', { ascending: false })
			.limit(1);

		if (!handlerError && handlerExecutions.length > 0) {
			const handlerExecution = handlerExecutions[0];

			// Calculate score distribution
			const scoreDistribution = {};
			if (handlerExecution.output?.opportunities) {
				handlerExecution.output.opportunities.forEach((opp) => {
					const score = opp.relevanceScore || 0;
					scoreDistribution[score] = (scoreDistribution[score] || 0) + 1;
				});
			}

			stats.firstStageFilter = {
				inputOpportunitiesCount: stats.initialApiCall.totalItemsRetrieved,
				opportunitiesPassingFirstFilter:
					handlerExecution.output?.opportunities?.length || 0,
				filterPassRate: handlerExecution.output?.opportunities?.length
					? (handlerExecution.output.opportunities.length /
							stats.initialApiCall.totalItemsRetrieved) *
					  100
					: 0,
				scoreDistribution,
				sampleFilteredOpportunities:
					handlerExecution.output?.opportunities?.slice(0, 3) || [],
				filteringTime: handlerExecution.processing_time || 0,
				executionId: handlerExecution.id,
				executionDate: handlerExecution.created_at,
			};
		}

		// Step 4: Check detail API calls (for two-step API)
		const { data: detailExecutions, error: detailError } = await supabase
			.from('agent_executions')
			.select('*')
			.eq('agent_type', 'detail_processor')
			.eq('source_id', source.id)
			.order('created_at', { ascending: false })
			.limit(1);

		if (!detailError && detailExecutions.length > 0) {
			const detailExecution = detailExecutions[0];

			stats.detailApiCalls = {
				opportunitiesRequiringDetails:
					stats.firstStageFilter.opportunitiesPassingFirstFilter,
				successfulDetailCalls:
					detailExecution.metrics?.successful_detail_calls || 0,
				failedDetailCalls: detailExecution.metrics?.failed_detail_calls || 0,
				detailCallErrors: detailExecution.metrics?.detail_call_errors || [],
				averageDetailResponseTime:
					detailExecution.metrics?.avg_detail_response_time || 0,
				totalDetailCallTime:
					detailExecution.metrics?.total_detail_call_time || 0,
				executionId: detailExecution.id,
				executionDate: detailExecution.created_at,
			};

			// Calculate second-stage filtering stats
			const secondScoreDistribution = {};
			if (detailExecution.output?.opportunities) {
				detailExecution.output.opportunities.forEach((opp) => {
					const score = opp.relevanceScore || 0;
					secondScoreDistribution[score] =
						(secondScoreDistribution[score] || 0) + 1;
				});
			}

			stats.secondStageFilter = {
				inputOpportunitiesCount: stats.detailApiCalls.successfulDetailCalls,
				opportunitiesPassingSecondFilter:
					detailExecution.output?.opportunities?.length || 0,
				filterPassRate: stats.detailApiCalls.successfulDetailCalls
					? (detailExecution.output?.opportunities?.length /
							stats.detailApiCalls.successfulDetailCalls) *
					  100
					: 0,
				scoreDistribution: secondScoreDistribution,
				sampleFinalOpportunities:
					detailExecution.output?.opportunities?.slice(0, 3) || [],
				filteringTime: detailExecution.processing_time || 0,
			};
		}

		// Step 5: Check stored opportunities
		const { data: opportunities, error: oppError } = await supabase
			.from('funding_opportunities')
			.select(
				`
        id, 
        title, 
        api_opportunity_id,
        status,
        open_date,
        close_date,
        minimum_award,
        maximum_award,
        cost_share_required,
        cost_share_percentage,
        application_url,
        guidelines_url,
        relevance_score,
        program_id,
        created_at
      `
			)
			.eq('source_id', source.id)
			.order('created_at', { ascending: false })
			.limit(10);

		if (!oppError) {
			stats.databaseStorage = {
				opportunitiesToStore:
					stats.secondStageFilter.opportunitiesPassingSecondFilter ||
					stats.firstStageFilter.opportunitiesPassingFirstFilter,
				storedOpportunities: opportunities,
				storedCount: opportunities.length,
				recentlyStoredCount: opportunities.filter(
					(o) =>
						new Date(o.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
				).length,
			};
		}

		// Calculate total processing time
		const endTime = Date.now();
		stats.processingTime = ((endTime - startTime) / 1000).toFixed(3);

		// Before returning the response, log it
		console.log('API response:', { source, stats });

		return NextResponse.json({ source, stats });
	} catch (error) {
		console.error('Verification API error:', error);
		return NextResponse.json(
			{ error: 'Failed to verify API integration', details: error.message },
			{ status: 500 }
		);
	}
}
