/**
 * Total Available Funding API
 *
 * Returns the sum of max_award_amount for all open opportunities,
 * capped at $30M per opportunity (per-applicant cap).
 * This represents the maximum funding a single applicant could theoretically access.
 */

import { createClient } from '@supabase/supabase-js';

// Use secret key to bypass RLS (server-side API route)
const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SECRET_KEY
);

// Per-applicant cap (same as map calculations)
const PER_APPLICANT_CAP = 30000000;

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
		if (cache.data !== null && cache.timestamp && now - cache.timestamp < cache.ttl) {
			return Response.json({
				success: true,
				total: cache.data,
				cached: true,
				timestamp: new Date().toISOString(),
			});
		}

		console.log('[TotalAvailableFunding] Calculating capped funding total');

		// Query open and upcoming opportunities with award amounts
		const { data: opportunities, error } = await supabase
			.from('funding_opportunities_with_geography')
			.select('maximum_award, minimum_award')
			.in('status', ['Open', 'Upcoming']);

		if (error) {
			console.error('[TotalAvailableFunding] Database error:', error);
			return Response.json(
				{ success: false, error: 'Failed to fetch funding data' },
				{ status: 500 }
			);
		}

		// Sum with per-applicant cap (matching map RPC logic)
		// Use maximum_award, fall back to minimum_award, then 0
		const total = opportunities.reduce((sum, opp) => {
			const awardAmount = opp.maximum_award ?? opp.minimum_award ?? 0;
			if (awardAmount === 0) return sum;
			const cappedAmount = Math.min(awardAmount, PER_APPLICANT_CAP);
			return sum + cappedAmount;
		}, 0);

		// Cache the result
		cache.data = total;
		cache.timestamp = now;

		console.log(
			`[TotalAvailableFunding] Total: $${total.toLocaleString()} from ${opportunities.length} opportunities`
		);

		return Response.json({
			success: true,
			total,
			opportunityCount: opportunities.length,
			cached: false,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('[TotalAvailableFunding] API error:', error);
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
