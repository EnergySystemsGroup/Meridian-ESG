/**
 * Client Matching Summary API
 *
 * Returns client matching statistics for dashboard display:
 * - clientsWithMatches: number of clients that have at least 1 match
 * - totalMatches: sum of all matches across all clients
 * - totalClients: total number of clients in system
 */

import { createClient } from '@supabase/supabase-js';
import { TAXONOMIES, getExpandedClientTypes } from '@/lib/constants/taxonomies';

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SECRET_KEY
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
				...cache.data,
				cached: true,
				timestamp: new Date().toISOString(),
			});
		}

		console.log('[ClientMatchingSummary] Calculating match statistics');

		// Get all clients from database
		const { data: clients, error: clientError } = await supabase
			.from('clients')
			.select('*');

		if (clientError) {
			console.error('[ClientMatchingSummary] Error fetching clients:', clientError);
			return Response.json(
				{ success: false, error: 'Failed to fetch clients' },
				{ status: 500 }
			);
		}

		const totalClients = clients?.length || 0;

		// Get all open opportunities
		const { data: rawOpportunities, error: oppError } = await supabase
			.from('funding_opportunities')
			.select(
				`
				id, title, eligible_locations, eligible_applicants,
				eligible_project_types, eligible_activities, is_national,
				status
			`
			)
			.neq('status', 'closed');

		if (oppError) {
			console.error('[ClientMatchingSummary] Error fetching opportunities:', oppError);
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
			console.error('[ClientMatchingSummary] Error fetching coverage areas:', coverageError);
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
		let clientsWithMatches = 0;
		let totalMatches = 0;

		for (const client of clients || []) {
			const matchCount = countMatches(client, opportunities);
			if (matchCount > 0) {
				clientsWithMatches++;
				totalMatches += matchCount;
			}
		}

		// Cache the result
		const result = {
			clientsWithMatches,
			totalMatches,
			totalClients,
		};
		cache.data = result;
		cache.timestamp = now;

		console.log(
			`[ClientMatchingSummary] ${clientsWithMatches}/${totalClients} clients with matches, ${totalMatches} total`
		);

		return Response.json({
			success: true,
			...result,
			cached: false,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('[ClientMatchingSummary] API error:', error);
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
 * Count matches between a client and opportunities
 */
function countMatches(client, opportunities) {
	let count = 0;

	for (const opportunity of opportunities) {
		if (evaluateMatch(client, opportunity)) {
			count++;
		}
	}

	return count;
}

/**
 * Evaluate if an opportunity matches a client
 * Uses same logic as top-matches API for consistency
 */
function evaluateMatch(client, opportunity) {
	// 1. Location Match
	let locationMatch = false;
	if (opportunity.is_national) {
		locationMatch = true;
	} else if (
		client.coverage_area_ids &&
		Array.isArray(client.coverage_area_ids) &&
		opportunity.coverage_area_ids &&
		Array.isArray(opportunity.coverage_area_ids)
	) {
		locationMatch = client.coverage_area_ids.some((clientAreaId) =>
			opportunity.coverage_area_ids.includes(clientAreaId)
		);
	}

	if (!locationMatch) return false;

	// 2. Applicant Type Match
	let applicantTypeMatch = false;
	if (opportunity.eligible_applicants && Array.isArray(opportunity.eligible_applicants)) {
		const expandedTypes = getExpandedClientTypes(client.type);
		applicantTypeMatch = opportunity.eligible_applicants.some((applicant) =>
			expandedTypes.some(
				(clientType) =>
					applicant.toLowerCase() === clientType.toLowerCase() ||
					applicant.toLowerCase().includes(clientType.toLowerCase()) ||
					clientType.toLowerCase().includes(applicant.toLowerCase())
			)
		);
	}

	if (!applicantTypeMatch) return false;

	// 3. Project Needs Match
	let projectNeedsMatch = false;
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
				projectNeedsMatch = true;
				break;
			}
		}
	}

	if (!projectNeedsMatch) return false;

	// 4. Activities Match
	let activitiesMatch = false;
	if (opportunity.eligible_activities && Array.isArray(opportunity.eligible_activities)) {
		const hotActivities = TAXONOMIES.ELIGIBLE_ACTIVITIES.hot;
		activitiesMatch = opportunity.eligible_activities.some((activity) =>
			hotActivities.some(
				(hotActivity) =>
					activity.toLowerCase().includes(hotActivity.toLowerCase()) ||
					hotActivity.toLowerCase().includes(activity.toLowerCase())
			)
		);
	}

	return activitiesMatch;
}
