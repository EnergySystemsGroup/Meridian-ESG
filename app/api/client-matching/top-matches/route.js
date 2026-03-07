/**
 * Top Client Matches API
 *
 * Returns the top 5 clients with their best opportunity matches for dashboard display.
 * Each result includes the client name, their best matching opportunity, and match score.
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
				matches: cached.data,
				cached: true,
				timestamp: new Date().toISOString(),
			});
		}

		console.log(`[TopMatches] Reading top client matches (user: ${cacheKey})`);

		// Short-circuit: user has no assigned clients
		if (clientIds !== null && clientIds.length === 0) {
			cache.set(cacheKey, { data: [], timestamp: now });
			return Response.json({
				success: true, matches: [], cached: false, timestamp: new Date().toISOString(),
			});
		}

		// 1. Fetch non-stale matches with client and opportunity details (filtered)
		let matchQuery = supabase
			.from('client_matches')
			.select(`
				client_id, score, opportunity_id,
				client:clients!inner(id, name, type),
				opportunity:funding_opportunities!inner(id, title, maximum_award)
			`)
			.eq('is_stale', false)
			.limit(10000);

		if (clientIds !== null) {
			matchQuery = matchQuery.in('client_id', clientIds);
		}
		const { data: matchRows, error: matchError } = await matchQuery;

		if (matchError) {
			console.error('[TopMatches] Error fetching matches:', matchError);
			return Response.json(
				{ success: false, error: 'Failed to fetch matches' },
				{ status: 500 }
			);
		}

		// 2. Fetch hidden matches to exclude (filtered)
		let hiddenQuery = supabase
			.from('hidden_matches')
			.select('client_id, opportunity_id')
			.limit(10000);

		if (clientIds !== null) {
			hiddenQuery = hiddenQuery.in('client_id', clientIds);
		}
		const { data: hiddenRows, error: hiddenError } = await hiddenQuery;

		if (hiddenError) {
			console.error('[TopMatches] Error fetching hidden matches:', hiddenError);
		}

		const hiddenSet = new Set(
			(hiddenRows || []).map(h => `${h.client_id}:${h.opportunity_id}`)
		);

		// 3. Group by client, filter hidden
		const clientMap = {};
		for (const row of matchRows || []) {
			const key = `${row.client_id}:${row.opportunity_id}`;
			if (hiddenSet.has(key)) continue;

			const cid = row.client_id;
			if (!clientMap[cid]) {
				clientMap[cid] = {
					client_id: row.client.id,
					client_name: row.client.name,
					client_type: row.client.type,
					matches: [],
				};
			}
			clientMap[cid].matches.push({
				id: row.opportunity.id,
				title: row.opportunity.title,
				score: row.score,
				maximum_award: row.opportunity.maximum_award,
			});
		}

		// 4. Build top-matches list
		const clientResults = Object.values(clientMap).map(entry => {
			entry.matches.sort((a, b) => b.score - a.score);
			const top = entry.matches[0];
			return {
				client_id: entry.client_id,
				client_name: entry.client_name,
				client_type: entry.client_type,
				match_count: entry.matches.length,
				top_opportunity_id: top.id,
				top_opportunity_title: top.title,
				top_opportunity_score: top.score,
				top_opportunity_amount: top.maximum_award,
			};
		});

		// 5. Sort by match count (desc), then top score (desc), take top 5
		clientResults.sort((a, b) => {
			if (b.match_count !== a.match_count) {
				return b.match_count - a.match_count;
			}
			return b.top_opportunity_score - a.top_opportunity_score;
		});

		const topMatches = clientResults.slice(0, 5);

		// Cache the result
		cache.set(cacheKey, { data: topMatches, timestamp: now });

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
