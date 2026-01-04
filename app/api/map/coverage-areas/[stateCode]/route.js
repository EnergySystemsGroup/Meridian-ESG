import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';

/**
 * GET /api/map/coverage-areas/[stateCode]
 * Returns GeoJSON FeatureCollection of counties or utilities for a state
 *
 * Query params:
 * - kind: 'county' or 'utility' (required)
 * - withCounts: 'true' to include opportunity counts (optional)
 * - status: status filter (optional)
 * - projectTypes: comma-separated project types (optional)
 */
export async function GET(request, { params }) {
	try {
		const { supabase } = createClient(request);
		const { stateCode } = await params;
		const { searchParams } = new URL(request.url);

		const kind = searchParams.get('kind') || 'county';
		const withCounts = searchParams.get('withCounts') === 'true';

		// Validate kind parameter
		if (!['county', 'utility'].includes(kind)) {
			return NextResponse.json(
				{ success: false, error: 'Invalid kind parameter. Must be "county" or "utility"' },
				{ status: 400 }
			);
		}

		// Get GeoJSON
		const { data: geojson, error: geojsonError } = await supabase.rpc(
			'get_coverage_areas_geojson',
			{
				p_state_code: stateCode.toUpperCase(),
				p_kind: kind,
			}
		);

		if (geojsonError) {
			console.error('Error fetching coverage areas GeoJSON:', geojsonError);
			return NextResponse.json(
				{ success: false, error: geojsonError.message },
				{ status: 500 }
			);
		}

		// Optionally get counts
		let counts = null;
		if (withCounts) {
			const status = searchParams.get('status');
			const projectTypes = searchParams.get('projectTypes');

			const { data: countsData, error: countsError } = await supabase.rpc(
				'get_opportunity_counts_by_coverage_area',
				{
					p_state_code: stateCode.toUpperCase(),
					p_kind: kind,
					p_status: status ? status.split(',') : null,
					p_project_types: projectTypes ? projectTypes.split(',') : null,
				}
			);

			if (countsError) {
				console.error('Error fetching counts:', countsError);
			} else {
				// Convert to a map for easy lookup
				counts = {};
				countsData.forEach(item => {
					counts[item.area_id] = {
						opportunity_count: item.opportunity_count,
						total_funding: item.total_funding,
					};
				});
			}
		}

		return NextResponse.json({
			success: true,
			data: geojson,
			counts,
			stateCode: stateCode.toUpperCase(),
			kind,
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
