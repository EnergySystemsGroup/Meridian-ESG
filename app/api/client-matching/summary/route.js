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
import { evaluateMatch } from '@/lib/matching/evaluateMatch';

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
			.neq('status', 'closed')
			.or('promotion_status.is.null,promotion_status.eq.promoted');

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
	const deps = {
		hotActivities: TAXONOMIES.ELIGIBLE_ACTIVITIES.hot,
		getExpandedClientTypes
	};

	for (const opportunity of opportunities) {
		const result = evaluateMatch(client, opportunity, deps);
		if (result.isMatch) {
			count++;
		}
	}

	return count;
}
