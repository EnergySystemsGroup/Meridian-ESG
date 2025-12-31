/**
 * Top Client Matches API
 *
 * Returns the top 5 clients with their best opportunity matches for dashboard display.
 * Each result includes the client name, their best matching opportunity, and match score.
 */

import { createClient } from '@supabase/supabase-js';
import { TAXONOMIES, getExpandedClientTypes } from '@/lib/constants/taxonomies';

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple in-memory cache
let cache = {
	data: null,
	timestamp: null,
	ttl: 5 * 60 * 1000, // 5 minutes
};

export async function GET() {
	try {
		// Check cache
		const now = Date.now();
		if (cache.data && cache.timestamp && now - cache.timestamp < cache.ttl) {
			return Response.json({
				success: true,
				matches: cache.data,
				cached: true,
				timestamp: new Date().toISOString(),
			});
		}

		console.log('[TopMatches] Calculating top client matches');

		// Get all clients
		const { data: clients, error: clientError } = await supabase
			.from('clients')
			.select('*');

		if (clientError) {
			console.error('[TopMatches] Error fetching clients:', clientError);
			return Response.json(
				{ success: false, error: 'Failed to fetch clients' },
				{ status: 500 }
			);
		}

		// Get all open opportunities
		const { data: rawOpportunities, error: oppError } = await supabase
			.from('funding_opportunities')
			.select(
				`
				id, title, eligible_locations, eligible_applicants,
				eligible_project_types, eligible_activities, is_national,
				maximum_award, close_date, status
			`
			)
			.neq('status', 'closed');

		if (oppError) {
			console.error('[TopMatches] Error fetching opportunities:', oppError);
			return Response.json(
				{ success: false, error: 'Failed to fetch opportunities' },
				{ status: 500 }
			);
		}

		// Get opportunity coverage areas
		const { data: opportunityCoverageAreas, error: coverageError } = await supabase
			.from('opportunity_coverage_areas')
			.select('opportunity_id, coverage_area_id');

		if (coverageError) {
			console.error('[TopMatches] Error fetching coverage areas:', coverageError);
		}

		// Build coverage map
		const opportunityCoverageMap = {};
		for (const link of opportunityCoverageAreas || []) {
			if (!opportunityCoverageMap[link.opportunity_id]) {
				opportunityCoverageMap[link.opportunity_id] = [];
			}
			opportunityCoverageMap[link.opportunity_id].push(link.coverage_area_id);
		}

		// Attach coverage areas to opportunities
		const opportunities = (rawOpportunities || []).map((opp) => ({
			...opp,
			coverage_area_ids: opportunityCoverageMap[opp.id] || [],
		}));

		// Calculate matches for each client
		const clientResults = [];

		for (const client of clients || []) {
			const matches = calculateMatches(client, opportunities);
			const topMatch = matches[0]; // Best match by score

			if (topMatch) {
				clientResults.push({
					client_id: client.id,
					client_name: client.name,
					client_type: client.type,
					match_count: matches.length,
					top_opportunity_id: topMatch.id,
					top_opportunity_title: topMatch.title,
					top_opportunity_score: topMatch.score,
					top_opportunity_amount: topMatch.maximum_award,
				});
			}
		}

		// Sort by match count (clients with most matches first), then by top score
		clientResults.sort((a, b) => {
			if (b.match_count !== a.match_count) {
				return b.match_count - a.match_count;
			}
			return b.top_opportunity_score - a.top_opportunity_score;
		});

		// Take top 5
		const topMatches = clientResults.slice(0, 5);

		// Cache the result
		cache.data = topMatches;
		cache.timestamp = now;

		console.log(`[TopMatches] Returning top ${topMatches.length} client matches`);

		return Response.json({
			success: true,
			matches: topMatches,
			cached: false,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('[TopMatches] API error:', error);
		return Response.json(
			{
				success: false,
				error: 'Internal server error',
				message: error.message,
			},
			{ status: 500 }
		);
	}
}

/**
 * Calculate matches between a client and opportunities
 */
function calculateMatches(client, opportunities) {
	const matches = [];

	for (const opportunity of opportunities) {
		const matchResult = evaluateMatch(client, opportunity);

		if (matchResult.isMatch) {
			matches.push({
				...opportunity,
				score: matchResult.score,
			});
		}
	}

	// Sort by score descending
	return matches.sort((a, b) => b.score - a.score);
}

/**
 * Evaluate if an opportunity matches a client
 */
function evaluateMatch(client, opportunity) {
	const details = {
		locationMatch: false,
		applicantTypeMatch: false,
		projectNeedsMatch: false,
		activitiesMatch: false,
		matchedProjectNeeds: [],
	};

	// 1. Location Match
	if (opportunity.is_national) {
		details.locationMatch = true;
	} else if (
		client.coverage_area_ids &&
		Array.isArray(client.coverage_area_ids) &&
		opportunity.coverage_area_ids &&
		Array.isArray(opportunity.coverage_area_ids)
	) {
		const hasIntersection = client.coverage_area_ids.some((clientAreaId) =>
			opportunity.coverage_area_ids.includes(clientAreaId)
		);
		details.locationMatch = hasIntersection;
	}

	// 2. Applicant Type Match
	if (opportunity.eligible_applicants && Array.isArray(opportunity.eligible_applicants)) {
		const expandedTypes = getExpandedClientTypes(client.type);
		details.applicantTypeMatch = opportunity.eligible_applicants.some((applicant) =>
			expandedTypes.some(
				(clientType) =>
					applicant.toLowerCase() === clientType.toLowerCase() ||
					applicant.toLowerCase().includes(clientType.toLowerCase()) ||
					clientType.toLowerCase().includes(applicant.toLowerCase())
			)
		);
	}

	// 3. Project Needs Match
	if (
		opportunity.eligible_project_types &&
		Array.isArray(opportunity.eligible_project_types) &&
		client.project_needs &&
		Array.isArray(client.project_needs)
	) {
		for (const need of client.project_needs) {
			const hasMatch = opportunity.eligible_project_types.some(
				(projectType) =>
					projectType.toLowerCase().includes(need.toLowerCase()) ||
					need.toLowerCase().includes(projectType.toLowerCase())
			);

			if (hasMatch) {
				details.matchedProjectNeeds.push(need);
			}
		}

		details.projectNeedsMatch = details.matchedProjectNeeds.length > 0;
	}

	// 4. Activities Match
	if (opportunity.eligible_activities && Array.isArray(opportunity.eligible_activities)) {
		const hotActivities = TAXONOMIES.ELIGIBLE_ACTIVITIES.hot;
		details.activitiesMatch = opportunity.eligible_activities.some((activity) =>
			hotActivities.some(
				(hotActivity) =>
					activity.toLowerCase().includes(hotActivity.toLowerCase()) ||
					hotActivity.toLowerCase().includes(activity.toLowerCase())
			)
		);
	}

	// Check if all criteria are met
	const isMatch =
		details.locationMatch &&
		details.applicantTypeMatch &&
		details.projectNeedsMatch &&
		details.activitiesMatch;

	// Calculate score (% of project needs matched)
	let score = 0;
	if (isMatch && client.project_needs && client.project_needs.length > 0) {
		score = Math.round(
			(details.matchedProjectNeeds.length / client.project_needs.length) * 100
		);
	}

	return {
		isMatch,
		score,
		details,
	};
}
