'use client';

import { useMemo } from 'react';
import { useOpportunitiesFilterStore } from '@/lib/stores/opportunitiesFilterStore';
import { useTrackedOpportunitiesStore } from '@/lib/stores/trackedOpportunitiesStore';
import { useDebounce } from '@/hooks/useDebounce';

const SORT_BY_MAP = {
	deadline: 'close_date',
	amount: 'amount',
	recent: 'updated_at',
	relevance: 'relevance',
};

/**
 * Composes API filter objects from Zustand store state.
 *
 * Maps store field names (camelCase) to API parameter names (snake_case)
 * and returns three separate filter objects — one per query — so each
 * has a stable reference and only triggers refetches for its own
 * dependencies.
 */
export function useOpportunitiesApiFilters() {
	const filters = useOpportunitiesFilterStore((s) => s.filters);
	const searchQuery = useOpportunitiesFilterStore((s) => s.searchQuery);
	const sortOption = useOpportunitiesFilterStore((s) => s.sortOption);
	const sortDirection = useOpportunitiesFilterStore((s) => s.sortDirection);

	const trackedOpportunityIds = useTrackedOpportunitiesStore(
		(s) => s.trackedOpportunityIds
	);
	const isInitialized = useTrackedOpportunitiesStore((s) => s.isInitialized);

	// 500ms debounce to match existing behavior
	const debouncedSearch = useDebounce(searchQuery, 500);

	// Full filter object for the main opportunities query
	const apiFilters = useMemo(() => {
		const result = {};

		if (filters.status?.length > 0) {
			result.status = filters.status.join(',');
		}
		if (filters.projectTypes?.length > 0) {
			result.projectTypes = filters.projectTypes.join(',');
		}
		if (filters.state) {
			result.state = filters.state;
		}
		if (filters.coverageTypes?.length > 0) {
			result.coverage_types = filters.coverageTypes.join(',');
		}
		if (debouncedSearch?.trim()) {
			result.search = debouncedSearch.trim();
		}

		result.page = String(filters.page);
		result.page_size = String(filters.pageSize);
		result.sort_by = SORT_BY_MAP[sortOption] || 'relevance';
		result.sort_direction = sortDirection;

		if (filters.tracked && isInitialized) {
			result.trackedIds = trackedOpportunityIds.join(',');
		}

		return result;
	}, [
		filters,
		debouncedSearch,
		sortOption,
		sortDirection,
		trackedOpportunityIds,
		isInitialized,
	]);

	// Project types query only depends on status, state, and coverage
	const projectTypeFilters = useMemo(() => {
		const result = {};
		if (filters.status?.length > 0) {
			result.status = filters.status.join(',');
		}
		if (filters.state) {
			result.state = filters.state;
		}
		if (filters.coverageTypes?.length > 0) {
			result.coverage_types = filters.coverageTypes.join(',');
		}
		return result;
	}, [filters.status, filters.state, filters.coverageTypes]);

	// Coverage counts query only depends on state
	const coverageCountFilters = useMemo(() => {
		const result = {};
		if (filters.state) {
			result.state = filters.state;
		}
		return result;
	}, [filters.state]);

	return {
		apiFilters,
		projectTypeFilters,
		coverageCountFilters,
		debouncedSearch,
		isInitialized,
	};
}
