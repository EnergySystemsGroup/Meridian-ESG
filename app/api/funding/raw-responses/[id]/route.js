import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/lib/supabase';

// GET /api/funding/raw-responses/[id] - Get a specific raw API response
export async function GET(request, { params }) {
	try {
		const supabase = createSupabaseClient();
		const { id } = params;

		// Get the raw response
		const { data: rawResponse, error } = await supabase
			.from('api_raw_responses')
			.select('*')
			.eq('id', id)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				return NextResponse.json(
					{ error: 'Raw response not found' },
					{ status: 404 }
				);
			}
			throw error;
		}

		return NextResponse.json({ rawResponse });
	} catch (error) {
		console.error('Error fetching raw response:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch raw response' },
			{ status: 500 }
		);
	}
}
