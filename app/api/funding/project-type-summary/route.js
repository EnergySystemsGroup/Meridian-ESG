import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/api';

export async function GET(request) {
	// Create admin Supabase client with service role
	const { supabase } = createAdminClient(request);

	try {
		// Fetch raw data from the database function
		// RPC uses $30M per-applicant cap and includes both Open and Upcoming opportunities
		// Results are already sorted by total_funding DESC
		const { data: rawResults, error: rpcError } = await supabase.rpc(
			'get_funding_by_project_type'
		);

		if (rpcError) {
			console.error('Error fetching funding by project type via RPC:', rpcError);
			const errorMessage = rpcError.message.includes(
				'function get_funding_by_project_type() does not exist'
			)
				? 'Database function get_funding_by_project_type not found. Ensure migration was applied.'
				: rpcError.message;
			return NextResponse.json(
				{
					error: 'Failed to fetch funding data by project type',
					details: errorMessage,
				},
				{ status: 500 }
			);
		}

		// Ensure rawResults is an array
		if (!Array.isArray(rawResults)) {
			console.warn('RPC did not return an array:', rawResults);
			return NextResponse.json([]);
		}

		// Return top 10 directly from RPC (no normalization)
		// This shows actual project types from our extraction pipeline
		const top10 = rawResults.slice(0, 10).map((item) => ({
			category: item.project_type, // Keep 'category' key for chart compatibility
			total_funding: Number(item.total_funding || 0),
			opportunity_count: Number(item.opportunity_count || 0),
		}));

		return NextResponse.json(top10);
	} catch (e) {
		console.error('Unexpected error fetching funding by project type:', e);
		return NextResponse.json(
			{ error: 'An unexpected error occurred' },
			{ status: 500 }
		);
	}
}
