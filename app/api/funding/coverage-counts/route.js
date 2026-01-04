import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';

export async function GET(request) {
	try {
		const { supabase } = createClient(request);
		const { searchParams } = new URL(request.url);
		const stateCode = searchParams.get('state') || null;

		const { data, error } = await supabase.rpc('get_coverage_filter_counts', {
			p_state_code: stateCode
		});

		if (error) {
			console.error('Error fetching coverage counts:', error);
			return NextResponse.json(
				{ success: false, error: error.message },
				{ status: 500 }
			);
		}

		// Convert array to object for easier frontend use
		const counts = {};
		data.forEach(row => {
			counts[row.coverage_type] = parseInt(row.opportunity_count);
		});

		return NextResponse.json({ success: true, counts });
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
