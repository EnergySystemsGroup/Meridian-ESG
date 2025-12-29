import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';

/**
 * GET /api/map/opportunities
 * Fetches opportunities for the map page with optional state filtering
 * When no stateCode provided, returns nationwide opportunities
 */
export async function GET(request) {
	try {
		const { supabase } = createClient(request);
		const { searchParams } = new URL(request.url);

		// Parse filters
		const stateCode = searchParams.get('state') || null;
		const statusParam = searchParams.get('status');
		const scopeParam = searchParams.get('scope');
		const projectTypesParam = searchParams.get('projectTypes');
		const sortBy = searchParams.get('sort_by') || 'relevance';
		const sortDirection = searchParams.get('sort_direction') || 'desc';
		const page = parseInt(searchParams.get('page') || '1', 10);
		const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
		const searchQuery = searchParams.get('search') || '';

		// Parse status - default to Open,Upcoming (capitalized to match view)
		const statuses = statusParam
			? statusParam.split(',').filter(Boolean)
			: ['Open', 'Upcoming'];

		// Parse scope - default to all
		const scopes = scopeParam
			? scopeParam.split(',').filter(Boolean)
			: ['national', 'state_wide', 'county', 'utility'];

		// Parse project types
		const projectTypes = projectTypesParam
			? projectTypesParam.split(',').filter(Boolean)
			: [];

		// Calculate pagination
		const from = (page - 1) * pageSize;
		const to = from + pageSize - 1;

		console.log(`Map opportunities API: state=${stateCode}, status=${statuses}, scope=${scopes}, sort=${sortBy}`);

		// Determine sort column
		let sortColumn = 'relevance_score';
		let ascending = sortDirection === 'asc';

		switch (sortBy) {
			case 'deadline':
				sortColumn = 'close_date';
				// For deadlines, null should be last
				break;
			case 'amount':
				sortColumn = 'maximum_award';
				break;
			case 'recent':
				sortColumn = 'updated_at';
				break;
			case 'alphabetical':
				sortColumn = 'title';
				ascending = sortDirection !== 'desc'; // A-Z default
				break;
			default:
				sortColumn = 'relevance_score';
		}

		// Build the query using the view
		let query = supabase
			.from('funding_opportunities_with_geography')
			.select('*', { count: 'exact' });

		// Apply status filter
		if (statuses.length > 0 && !statuses.includes('all')) {
			query = query.in('status', statuses);
		}

		// Apply state filter (if provided)
		// Uses coverage_state_codes from coverage_areas table (not legacy eligible_states)
		if (stateCode && stateCode !== 'US') {
			// For state-specific: include national + opportunities with coverage in this state
			query = query.or(`is_national.eq.true,coverage_state_codes.cs.{${stateCode}}`);
		}
		// For nationwide (no stateCode or 'US'): no state filter, include all

		// Apply scope filter using is_national and coverage_area_types
		if (scopes.length > 0 && scopes.length < 4) {
			// Build scope filter conditions
			const scopeConditions = [];

			if (scopes.includes('national')) {
				scopeConditions.push('is_national.eq.true');
			}
			if (scopes.includes('state_wide')) {
				scopeConditions.push('coverage_area_types.cs.{state}');
			}
			if (scopes.includes('county')) {
				scopeConditions.push('coverage_area_types.cs.{county}');
			}
			if (scopes.includes('utility')) {
				scopeConditions.push('coverage_area_types.cs.{utility}');
			}

			// If national is NOT included, exclude national opportunities
			if (!scopes.includes('national')) {
				// We need to filter OUT national opportunities
				query = query.eq('is_national', false);
			}

			// Apply the OR conditions for selected scopes (excluding national which is handled above)
			const nonNationalConditions = scopeConditions.filter(c => !c.includes('is_national'));
			if (nonNationalConditions.length > 0 && !scopes.includes('national')) {
				query = query.or(nonNationalConditions.join(','));
			} else if (scopeConditions.length > 0) {
				query = query.or(scopeConditions.join(','));
			}
		}

		// Apply project types filter
		if (projectTypes.length > 0) {
			query = query.overlaps('categories', projectTypes);
		}

		// Apply search
		if (searchQuery) {
			query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
		}

		// Apply sorting
		query = query.order(sortColumn, {
			ascending,
			nullsFirst: false
		});

		// Apply pagination
		query = query.range(from, to);

		const { data, error, count } = await query;

		if (error) {
			console.error('Error fetching map opportunities:', error);
			return NextResponse.json(
				{ success: false, error: error.message },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			data: {
				opportunities: data || [],
				total: count || 0,
				page,
				pageSize,
				totalPages: count ? Math.ceil(count / pageSize) : 0,
			},
		});
	} catch (error) {
		console.error('Map opportunities API error:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
