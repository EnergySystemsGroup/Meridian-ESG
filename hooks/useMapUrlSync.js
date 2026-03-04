'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
	useMapFilterStore,
	DEFAULT_MAP_FILTERS,
} from '@/lib/stores/mapFilterStore';
import { stateCodeToName } from '@/lib/utils/stateAbbreviations';

/**
 * Bidirectional URL <-> Zustand store sync for the map page.
 *
 * On mount: reads URL search params and seeds the store.
 * On store changes: pushes non-default values to the URL.
 * Uses refs to prevent infinite sync loops.
 */
export function useMapUrlSync() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const filters = useMapFilterStore((s) => s.filters);
	const selectedStateCode = useMapFilterStore((s) => s.selectedStateCode);
	const viewMode = useMapFilterStore((s) => s.viewMode);
	const sortOption = useMapFilterStore((s) => s.sortOption);
	const sortDirection = useMapFilterStore((s) => s.sortDirection);

	const setFilters = useMapFilterStore((s) => s.setFilters);
	const setSelectedState = useMapFilterStore((s) => s.setSelectedState);
	const setViewMode = useMapFilterStore((s) => s.setViewMode);
	const setSortOption = useMapFilterStore((s) => s.setSortOption);
	const setSortDirection = useMapFilterStore((s) => s.setSortDirection);

	const isUpdatingFromUrl = useRef(false);
	const hasSeeded = useRef(false);

	// Seed store from URL on mount (runs once)
	useEffect(() => {
		if (hasSeeded.current) return;
		hasSeeded.current = true;
		isUpdatingFromUrl.current = true;

		const urlFilters = {
			status: searchParams.get('status')
				? searchParams.get('status').split(',')
				: DEFAULT_MAP_FILTERS.status,
			projectTypes: searchParams.get('projectTypes')
				? searchParams.get('projectTypes').split(',')
				: DEFAULT_MAP_FILTERS.projectTypes,
			scope: searchParams.get('scope')
				? searchParams.get('scope').split(',')
				: DEFAULT_MAP_FILTERS.scope,
			search: searchParams.get('search') || '',
			page: parseInt(searchParams.get('page')) || 1,
			pageSize: DEFAULT_MAP_FILTERS.pageSize,
		};

		// Restore state selection first (setSelectedState resets page to 1,
		// so setFilters must come after to restore the bookmarked page value)
		const stateCode = searchParams.get('state') || null;
		if (stateCode) {
			const stateName = stateCodeToName[stateCode] || null;
			if (stateName) {
				setSelectedState(stateCode, stateName);
			}
		}

		// Restore view mode
		const view = searchParams.get('view');
		if (view === 'state' && stateCode && stateCodeToName[stateCode]) {
			setViewMode('state');
		}

		// Set filters last so page value from URL is preserved
		setFilters(urlFilters);

		setSortOption(searchParams.get('sort') || 'relevance');
		setSortDirection(searchParams.get('sortDir') || 'desc');

		// Release the lock after the seed state propagates
		requestAnimationFrame(() => {
			isUpdatingFromUrl.current = false;
		});
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Push store changes to URL
	useEffect(() => {
		if (isUpdatingFromUrl.current) return;

		const params = new URLSearchParams();

		// Only encode non-default values to keep URLs clean
		const isDefaultStatus =
			filters.status.length === DEFAULT_MAP_FILTERS.status.length &&
			DEFAULT_MAP_FILTERS.status.every((s) => filters.status.includes(s));
		if (!isDefaultStatus && filters.status.length > 0) {
			params.set('status', filters.status.join(','));
		}

		if (filters.projectTypes.length > 0) {
			params.set('projectTypes', filters.projectTypes.join(','));
		}

		const isDefaultScope =
			filters.scope.length === DEFAULT_MAP_FILTERS.scope.length &&
			DEFAULT_MAP_FILTERS.scope.every((s) => filters.scope.includes(s));
		if (!isDefaultScope) {
			params.set('scope', filters.scope.join(','));
		}

		if (filters.search?.trim()) {
			params.set('search', filters.search.trim());
		}

		if (selectedStateCode) {
			params.set('state', selectedStateCode);
		}

		if (viewMode !== 'us') {
			params.set('view', viewMode);
		}

		if (sortOption !== 'relevance') {
			params.set('sort', sortOption);
		}
		if (sortDirection !== 'desc') {
			params.set('sortDir', sortDirection);
		}
		if (filters.page > 1) {
			params.set('page', String(filters.page));
		}

		const qs = params.toString();
		const newUrl = qs ? `${pathname}?${qs}` : pathname;

		router.replace(newUrl, { scroll: false });
	}, [filters, selectedStateCode, viewMode, sortOption, sortDirection, pathname, router]);
}
