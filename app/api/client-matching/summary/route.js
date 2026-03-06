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
import { getFilteredClientIds } from '@/lib/utils/clientFiltering';

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SECRET_KEY
);

// Per-user in-memory cache (keyed by userId or 'all')
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request) {
	try {
		// Resolve user-based filtering
		const { clientIds, userId } = await getFilteredClientIds(supabase, request);
		const cacheKey = userId || 'all';

		// Check cache
		const now = Date.now();
		const cached = cache.get(cacheKey);
		if (cached && now - cached.timestamp < CACHE_TTL) {
			return Response.json({
				success: true,
				...cached.data,
				cached: true,
				timestamp: new Date().toISOString(),
			});
		}

		console.log(`[ClientMatchingSummary] Calculating match statistics (user: ${cacheKey})`);

		// Short-circuit: user has no assigned clients
		if (clientIds !== null && clientIds.length === 0) {
			const result = { clientsWithMatches: 0, totalMatches: 0, totalClients: 0 };
			cache.set(cacheKey, { data: result, timestamp: now });
			return Response.json({
				success: true, ...result, cached: false, timestamp: new Date().toISOString(),
			});
		}

		// 1. Count total clients (filtered)
		let clientQuery = supabase.from('clients').select('*', { count: 'exact', head: true });
		if (clientIds !== null) {
			clientQuery = clientQuery.in('id', clientIds);
		}
		const { count: totalClients, error: clientError } = await clientQuery;

		if (clientError) {
			console.error('[ClientMatchingSummary] Error counting clients:', clientError);
			return Response.json(
				{ success: false, error: 'Failed to count clients' },
				{ status: 500 }
			);
		}

		// 2. Fetch non-stale match pairs (filtered)
		let matchQuery = supabase
			.from('client_matches')
			.select('client_id, opportunity_id')
			.eq('is_stale', false)
			.limit(10000);

		if (clientIds !== null) {
			matchQuery = matchQuery.in('client_id', clientIds);
		}
		const { data: matchRows, error: matchError } = await matchQuery;

		if (matchError) {
			console.error('[ClientMatchingSummary] Error fetching matches:', matchError);
			return Response.json(
				{ success: false, error: 'Failed to fetch matches' },
				{ status: 500 }
			);
		}

		// 3. Fetch hidden matches to exclude (filtered)
		let hiddenQuery = supabase
			.from('hidden_matches')
			.select('client_id, opportunity_id')
			.limit(10000);

		if (clientIds !== null) {
			hiddenQuery = hiddenQuery.in('client_id', clientIds);
		}
		const { data: hiddenRows, error: hiddenError } = await hiddenQuery;

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
		cache.set(cacheKey, { data: result, timestamp: now });

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
