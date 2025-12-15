import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';
import { TAXONOMIES } from '../../../lib/constants/taxonomies.js';

export async function GET(request) {
	try {
		// Create Supabase client with request context
		const { supabase } = createClient(request);

		// Get URL parameters for filtering
		const { searchParams } = new URL(request.url);
		const statusParam = searchParams.get('status');
		const status = statusParam ? statusParam.split(',') : null;
		const stateCode = searchParams.get('state');
		const coverageTypes = searchParams.get('coverage_types')
			? searchParams.get('coverage_types').split(',')
			: null;

		// Use the RPC function to get filtered opportunities (reuse existing filter logic)
		// This ensures consistency with the main funding API filtering
		const params = {
			p_status: status?.length > 0 ? status : null,
			p_categories: null,
			p_project_types: null, // Don't filter by project types when counting them
			p_state_code: stateCode || null,
			p_coverage_types: coverageTypes,
			p_search: null,
			p_sort_by: 'relevance',
			p_sort_direction: 'desc',
			p_page: 1,
			p_page_size: 10000, // Get all to count project types
			p_tracked_ids: null,
		};

		const { data, error } = await supabase.rpc(
			'get_funding_opportunities_dynamic_sort',
			params
		);

		if (error) {
			throw new Error(error.message);
		}

		// Get all valid project types from taxonomy (flatten tiered structure)
		const taxonomyProjectTypes = new Set(
			Object.values(TAXONOMIES.ELIGIBLE_PROJECT_TYPES).flat()
		);

		// Count opportunities per project type (only counting each opportunity once per type)
		const projectTypeGroups = {};

		data.forEach((opportunity) => {
			if (
				!opportunity.eligible_project_types ||
				opportunity.eligible_project_types.length === 0
			)
				return;

			// Track which project types we've seen for this opportunity
			const seenTypes = new Set();

			opportunity.eligible_project_types.forEach((projectType) => {
				// Only include types that exist in the taxonomy
				if (projectType && taxonomyProjectTypes.has(projectType)) {
					// Only count each type once per opportunity
					if (!seenTypes.has(projectType)) {
						seenTypes.add(projectType);

						// Initialize group if needed
						if (!projectTypeGroups[projectType]) {
							projectTypeGroups[projectType] = {
								count: 0,
								opportunityIds: new Set(),
							};
						}

						// Add this opportunity to the set for this type
						projectTypeGroups[projectType].opportunityIds.add(opportunity.id);
						projectTypeGroups[projectType].count =
							projectTypeGroups[projectType].opportunityIds.size;
					}
				}
			});
		});

		// Convert to final format (remove Set for JSON serialization)
		const finalGroups = {};
		Object.keys(projectTypeGroups).forEach((type) => {
			finalGroups[type] = {
				count: projectTypeGroups[type].count,
			};
		});

		// Get project types list sorted by count (descending), then alphabetically
		const projectTypes = Object.keys(finalGroups).sort((a, b) => {
			// First sort by count (descending)
			const countDiff = finalGroups[b].count - finalGroups[a].count;
			if (countDiff !== 0) return countDiff;

			// Then sort alphabetically
			return a.localeCompare(b);
		});

		return NextResponse.json({
			success: true,
			// Main data needed by the UI - only types that have opportunities
			projectTypes: projectTypes,
			// Additional data with counts
			projectTypeGroups: finalGroups,
		});
	} catch (error) {
		console.error('Error fetching project types:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
