'use client';

import { useMemo, useRef } from 'react';
import { useMapFilterStore } from '@/lib/stores/mapFilterStore';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * Composes API filter objects from the map Zustand store state.
 *
 * Returns separate filter objects per query so each has a stable reference
 * and only triggers refetches for its own dependencies.
 */
export function useMapApiFilters() {
	const filters = useMapFilterStore((s) => s.filters);
	const selectedStateCode = useMapFilterStore((s) => s.selectedStateCode);
	const sortOption = useMapFilterStore((s) => s.sortOption);
	const sortDirection = useMapFilterStore((s) => s.sortDirection);

	const debouncedSearch = useDebounce(filters.search, 500);

	// On the very first render after URL seed, debouncedSearch is stale ('').
	// Use raw search until debounce has caught up to avoid a flash of
	// unfiltered results.
	const hasSettled = useRef(false);
	if (!hasSettled.current && filters.search && !debouncedSearch) {
		// Still waiting for debounce to settle after URL seed
	} else {
		hasSettled.current = true;
	}
	const effectiveSearch = hasSettled.current ? debouncedSearch : filters.search;

	// Filters for the funding-by-state choropleth query
	const fundingByStateFilters = useMemo(() => {
		const result = {};
		if (filters.status?.length > 0) {
			result.status = filters.status.join(',');
		}
		if (filters.projectTypes?.length > 0) {
			result.projectTypes = filters.projectTypes.join(',');
		}
		if (filters.scope?.length > 0 && filters.scope.length < 4) {
			result.scope = filters.scope.join(',');
		}
		if (effectiveSearch?.trim()) {
			result.search = effectiveSearch.trim();
		}
		return result;
	}, [filters.status, filters.projectTypes, filters.scope, effectiveSearch]);

	// Filters for the opportunities list query (side panel)
	const opportunitiesFilters = useMemo(() => {
		const result = {};
		if (selectedStateCode) {
			result.state = selectedStateCode;
		}
		if (filters.status?.length > 0) {
			result.status = filters.status.join(',');
		}
		if (filters.scope?.length > 0 && filters.scope.length < 4) {
			result.scope = filters.scope.join(',');
		}
		if (filters.projectTypes?.length > 0) {
			result.projectTypes = filters.projectTypes.join(',');
		}
		if (effectiveSearch?.trim()) {
			result.search = effectiveSearch.trim();
		}
		result.sort_by = sortOption;
		result.sort_direction = sortDirection;
		result.page = String(filters.page);
		result.pageSize = String(filters.pageSize);
		return result;
	}, [filters, selectedStateCode, sortOption, sortDirection, effectiveSearch]);

	// Filters for the scope breakdown query
	const scopeBreakdownFilters = useMemo(() => {
		const result = {};
		if (filters.status?.length > 0) {
			result.status = filters.status.join(',');
		}
		if (filters.projectTypes?.length > 0) {
			result.projectTypes = filters.projectTypes.join(',');
		}
		return result;
	}, [filters.status, filters.projectTypes]);

	return {
		fundingByStateFilters,
		opportunitiesFilters,
		scopeBreakdownFilters,
		debouncedSearch: effectiveSearch,
	};
}
