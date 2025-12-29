import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';

/**
 * GET /api/map/scope-breakdown/[stateCode]
 * Returns opportunity counts by scope type for a state
 *
 * Returns: { national, state_wide, county, utility, state_code }
 *
 * Query params:
 * - status: comma-separated status filter (optional)
 * - projectTypes: comma-separated project types (optional)
 */
export async function GET(request, { params }) {
	try {
		const { supabase } = createClient(request);
		const { stateCode } = await params;
		const { searchParams } = new URL(request.url);

		// Parse query parameters
		const status = searchParams.get('status');
		const projectTypes = searchParams.get('projectTypes');

		// Call the RPC function
		const { data, error } = await supabase.rpc(
			'get_state_scope_breakdown',
			{
				p_state_code: stateCode.toUpperCase(),
				p_status: status ? status.split(',') : null,
				p_project_types: projectTypes ? projectTypes.split(',') : null,
			}
		);

		if (error) {
			console.error('Error fetching scope breakdown:', error);
			return NextResponse.json(
				{ success: false, error: error.message },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			data: data,
			stateCode: stateCode.toUpperCase(),
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
