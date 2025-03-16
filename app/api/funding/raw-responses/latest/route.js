import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/lib/supabase';

// GET /api/funding/raw-responses/latest - Get the latest raw API response
export async function GET(request) {
	try {
		const supabase = createSupabaseClient();

		// Get the source ID from query params
		const { searchParams } = new URL(request.url);
		const sourceId = searchParams.get('sourceId');

		// Build the query
		let query = supabase
			.from('api_raw_responses')
			.select('*')
			.order('created_at', { ascending: false })
			.limit(1);

		// Filter by source ID if provided
		if (sourceId) {
			query = query.eq('source_id', sourceId);
		}

		// Execute the query
		const { data: rawResponse, error } = await query.single();

		if (error) {
			if (error.code === 'PGRST116') {
				return NextResponse.json(
					{ error: 'No raw responses found' },
					{ status: 404 }
				);
			}
			throw error;
		}

		return NextResponse.json({ rawResponse });
	} catch (error) {
		console.error('Error fetching latest raw response:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch latest raw response' },
			{ status: 500 }
		);
	}
}
