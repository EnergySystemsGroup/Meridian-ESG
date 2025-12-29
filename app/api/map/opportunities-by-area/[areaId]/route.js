import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';

/**
 * GET /api/map/opportunities-by-area/[areaId]
 * Returns paginated opportunities for a specific coverage area
 *
 * Query params:
 * - includeState: 'true' to include state-wide opportunities (default: true)
 * - includeNational: 'true' to include national opportunities (default: true)
 * - status: comma-separated status filter (optional)
 * - projectTypes: comma-separated project types (optional)
 * - page: page number (default: 1)
 * - pageSize: items per page (default: 10)
 */
export async function GET(request, { params }) {
	try {
		const { supabase } = createClient(request);
		const { areaId } = await params;
		const { searchParams } = new URL(request.url);

		// Parse query parameters
		const includeState = searchParams.get('includeState') !== 'false';
		const includeNational = searchParams.get('includeNational') !== 'false';
		const status = searchParams.get('status');
		const projectTypes = searchParams.get('projectTypes');
		const page = parseInt(searchParams.get('page') || '1', 10);
		const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

		// Call the RPC function
		const { data, error } = await supabase.rpc(
			'get_opportunities_for_coverage_area',
			{
				p_area_id: areaId,
				p_include_state_scope: includeState,
				p_include_national_scope: includeNational,
				p_status: status ? status.split(',') : null,
				p_project_types: projectTypes ? projectTypes.split(',') : null,
				p_page: page,
				p_page_size: pageSize,
			}
		);

		if (error) {
			console.error('Error fetching opportunities for area:', error);
			return NextResponse.json(
				{ success: false, error: error.message },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			data: data,
			areaId,
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
