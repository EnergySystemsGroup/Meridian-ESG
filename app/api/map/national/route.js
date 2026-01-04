import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';

/**
 * GET /api/map/national
 * Returns national opportunities count and optionally paginated list
 *
 * Query params:
 * - countOnly: 'true' to only return count (default: false)
 * - status: comma-separated status filter (optional)
 * - projectTypes: comma-separated project types (optional)
 * - page: page number (default: 1)
 * - pageSize: items per page (default: 10)
 */
export async function GET(request) {
	try {
		const { supabase } = createClient(request);
		const { searchParams } = new URL(request.url);

		// Parse query parameters
		const countOnly = searchParams.get('countOnly') === 'true';
		const status = searchParams.get('status');
		const projectTypes = searchParams.get('projectTypes');
		const page = parseInt(searchParams.get('page') || '1', 10);
		const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

		// Always get the count
		const { data: count, error: countError } = await supabase.rpc(
			'get_national_opportunities_count',
			{
				p_status: status ? status.split(',') : null,
				p_project_types: projectTypes ? projectTypes.split(',') : null,
			}
		);

		if (countError) {
			console.error('Error fetching national count:', countError);
			return NextResponse.json(
				{ success: false, error: countError.message },
				{ status: 500 }
			);
		}

		// If count only, return just the count
		if (countOnly) {
			return NextResponse.json({
				success: true,
				count: count,
			});
		}

		// Otherwise, get the paginated list too
		const { data: opportunities, error: oppsError } = await supabase.rpc(
			'get_national_opportunities',
			{
				p_status: status ? status.split(',') : null,
				p_project_types: projectTypes ? projectTypes.split(',') : null,
				p_page: page,
				p_page_size: pageSize,
			}
		);

		if (oppsError) {
			console.error('Error fetching national opportunities:', oppsError);
			return NextResponse.json(
				{ success: false, error: oppsError.message },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			count: count,
			data: opportunities,
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
