import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';

export async function GET(request) {
	try {
		// Create Supabase client with request context
		const { supabase } = createClient(request);
		
		// Get URL parameters to determine which counts to fetch
		const { searchParams } = new URL(request.url);
		const type = searchParams.get('type');

		// For open opportunities count
		if (type === 'open_opportunities') {
			const { count, error } = await supabase
				.from('funding_opportunities')
				.select('id', { count: 'exact', head: true })
				.ilike('status', 'open');

			if (error) {
				throw error;
			}

			return NextResponse.json({
				success: true,
				count,
			});
		}

		// Default response for invalid type
		return NextResponse.json(
			{ success: false, error: 'Invalid count type requested' },
			{ status: 400 }
		);
	} catch (error) {
		console.error('Error fetching counts:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
