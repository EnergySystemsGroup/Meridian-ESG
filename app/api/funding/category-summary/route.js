import { createAdminSupabaseClient } from '@/app/lib/supabase';
import { NextResponse } from 'next/server';
import { TAXONOMIES } from '@/app/lib/constants/taxonomies';
import { getNormalizedCategories } from '@/app/lib/utils/categoryUtils';

export async function GET() {
	const supabase = createAdminSupabaseClient();

	try {
		// 1. Fetch raw data (category, total_funding, opportunity_count) from the database function
		const { data: rawResults, error: rpcError } = await supabase.rpc(
			'get_funding_by_category'
		);

		if (rpcError) {
			console.error('Error fetching funding by category via RPC:', rpcError);
			const errorMessage = rpcError.message.includes(
				'function get_funding_by_category() does not exist'
			)
				? 'Database function get_funding_by_category not found. Ensure migration was applied.'
				: rpcError.message;
			return NextResponse.json(
				{
					error: 'Failed to fetch funding data by category',
					details: errorMessage,
				},
				{ status: 500 }
			);
		}

		// Ensure rawResults is an array
		if (!Array.isArray(rawResults)) {
			console.warn('RPC did not return an array:', rawResults);
			return NextResponse.json([]); // Return empty if data is unexpected
		}

		// 2. Normalize and Aggregate
		const standardCategories = TAXONOMIES.CATEGORIES;
		// Extract just the raw category names for normalization function
		const rawCategoryNames = rawResults.map((item) => item.category);

		// Get the mapping from raw name -> normalized name
		const { normalizedMapping } = getNormalizedCategories(
			rawCategoryNames,
			standardCategories
			// We don't need categoryCounts here, just the mapping
		);

		// Aggregate results by normalized category
		const aggregatedResults = new Map();

		rawResults.forEach((item) => {
			const rawCategory = item.category;
			// Find the normalized group for this raw category
			const normalizedCategory = normalizedMapping[rawCategory] || 'Other'; // Default to 'Other' if somehow unmapped

			// Get current aggregates or initialize
			const current = aggregatedResults.get(normalizedCategory) || {
				category: normalizedCategory,
				total_funding: 0,
				opportunity_count: 0,
			};

			// Add current item's values to the aggregate
			// Ensure values are treated as numbers
			current.total_funding += Number(item.total_funding || 0);
			current.opportunity_count += Number(item.opportunity_count || 0);

			// Store back in the map
			aggregatedResults.set(normalizedCategory, current);
		});

		// 3. Convert Map back to Array for the response
		const finalResults = Array.from(aggregatedResults.values());

		// Optional: Sort final results if needed (e.g., by funding desc)
		finalResults.sort((a, b) => b.total_funding - a.total_funding);

		// 4. Return the normalized and aggregated results
		return NextResponse.json(finalResults);
	} catch (e) {
		console.error('Unexpected error fetching funding by category:', e);
		return NextResponse.json(
			{ error: 'An unexpected error occurred' },
			{ status: 500 }
		);
	}
}

// Note: The previous execute_sql function is no longer needed for this route.
// The get_funding_by_category function is defined in the migration file
// supabase/migrations/20250630000002_create_execute_sql_function.sql
