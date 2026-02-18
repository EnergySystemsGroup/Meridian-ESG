import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/api';

// GET /api/admin/review - Fetch opportunities for admin review
export async function GET(request) {
	try {
		const { supabase } = createAdminClient(request);
		const { searchParams } = new URL(request.url);

		// Parse query parameters
		const status = searchParams.get('status') || 'pending_review';
		const sourceId = searchParams.get('source_id');
		const state = searchParams.get('state');
		const minScore = searchParams.get('min_score');
		const search = searchParams.get('search');
		const page = parseInt(searchParams.get('page') || '1', 10);
		const pageSize = parseInt(searchParams.get('page_size') || '50', 10);
		const sortBy = searchParams.get('sort_by') || 'created_at';
		const sortDirection = searchParams.get('sort_direction') || 'desc';

		// Query the view (includes all records + computed geography columns)
		let query = supabase
			.from('funding_opportunities_with_geography')
			.select(`
				id, title, agency_name, funding_type, minimum_award, maximum_award,
				open_date, close_date, status, relevance_score, promotion_status,
				categories, eligible_project_types, is_national, program_id,
				created_at, reviewed_by, reviewed_at, review_notes, url,
				funding_source_id, source_display_name, source_type_display,
				coverage_state_codes
			`, { count: 'exact' });

		// Status filter
		if (status === 'all') {
			query = query.not('promotion_status', 'is', null);
		} else {
			query = query.eq('promotion_status', status);
		}

		// Source filter
		if (sourceId) {
			query = query.eq('funding_source_id', sourceId);
		}

		// State filter (now handled via view's coverage_state_codes)
		if (state) {
			query = query.or(`is_national.eq.true,coverage_state_codes.cs.{${state}}`);
		}

		// Score filter
		if (minScore) {
			query = query.gte('relevance_score', parseFloat(minScore));
		}

		// Search filter
		if (search) {
			query = query.or(`title.ilike.%${search}%,agency_name.ilike.%${search}%`);
		}

		// Sorting
		const ascending = sortDirection === 'asc';
		query = query.order(sortBy, { ascending });

		// Pagination
		const from = (page - 1) * pageSize;
		const to = from + pageSize - 1;
		query = query.range(from, to);

		const { data, error, count } = await query;

		if (error) throw error;

		console.log(`[AdminReview] Fetched ${data.length} records (total: ${count})`);

		return NextResponse.json({
			success: true,
			data,
			total_count: count,
			pagination: { page, page_size: pageSize, total: count },
		});
	} catch (error) {
		console.error('[AdminReview] Error fetching review queue:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch review queue' },
			{ status: 500 }
		);
	}
}
