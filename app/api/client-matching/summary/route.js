/**
 * Client Matching Summary API
 *
 * Returns client matching statistics for dashboard display:
 * - clientsWithMatches: number of clients that have at least 1 visible match
 * - totalMatches: sum of all visible matches across all clients
 * - totalClients: total number of clients in system
 *
 * Reads from persisted client_matches table instead of recomputing.
 */

import { createClient } from '@supabase/supabase-js';

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

		console.log('[ClientMatchingSummary] Calculating match statistics from client_matches');

		// 1. Count total clients
		const { count: totalClients, error: clientError } = await supabase
			.from('clients')
			.select('*', { count: 'exact', head: true });

		if (clientError) {
			console.error('[ClientMatchingSummary] Error counting clients:', clientError);
			return Response.json(
				{ success: false, error: 'Failed to count clients' },
				{ status: 500 }
			);
		}

		// 2. Fetch all non-stale match pairs
		const { data: matchRows, error: matchError } = await supabase
			.from('client_matches')
			.select('client_id, opportunity_id')
			.eq('is_stale', false)
			.limit(10000);

		if (matchError) {
			console.error('[ClientMatchingSummary] Error fetching matches:', matchError);
			return Response.json(
				{ success: false, error: 'Failed to fetch matches' },
				{ status: 500 }
			);
		}

		// 3. Fetch hidden matches to exclude
		const { data: hiddenRows, error: hiddenError } = await supabase
			.from('hidden_matches')
			.select('client_id, opportunity_id')
			.limit(10000);

		if (hiddenError) {
			console.error('[ClientMatchingSummary] Error fetching hidden matches:', hiddenError);
		}

		const hiddenSet = new Set(
			(hiddenRows || []).map(h => `${h.client_id}:${h.opportunity_id}`)
		);

		// 4. Filter visible matches and compute stats
		const clientsWithMatchesSet = new Set();
		let totalMatches = 0;

		for (const row of matchRows || []) {
			const key = `${row.client_id}:${row.opportunity_id}`;
			if (hiddenSet.has(key)) continue;
			clientsWithMatchesSet.add(row.client_id);
			totalMatches++;
		}

		const result = {
			clientsWithMatches: clientsWithMatchesSet.size,
			totalMatches,
			totalClients: totalClients || 0,
		};

		// Cache the result
		cache.data = result;
		cache.timestamp = now;

		console.log(
			`[ClientMatchingSummary] ${result.clientsWithMatches}/${result.totalClients} clients with matches, ${totalMatches} total`
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
