'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
	useOpportunitiesFilterStore,
	DEFAULT_FILTERS,
} from '@/lib/stores/opportunitiesFilterStore';

/**
 * Bidirectional URL ↔ Zustand store sync for the opportunities list page.
 *
 * On mount: reads URL search params and seeds the store.
 * On store changes: pushes non-default values to the URL.
 * Uses refs to prevent infinite sync loops.
 */
export function useOpportunitiesUrlSync() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const filters = useOpportunitiesFilterStore((s) => s.filters);
	const searchQuery = useOpportunitiesFilterStore((s) => s.searchQuery);
	const sortOption = useOpportunitiesFilterStore((s) => s.sortOption);
	const sortDirection = useOpportunitiesFilterStore((s) => s.sortDirection);
	const setFilters = useOpportunitiesFilterStore((s) => s.setFilters);
	const setSearchQuery = useOpportunitiesFilterStore((s) => s.setSearchQuery);
	const setSortOption = useOpportunitiesFilterStore((s) => s.setSortOption);
	const setSortDirection = useOpportunitiesFilterStore(
		(s) => s.setSortDirection
	);

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
				: DEFAULT_FILTERS.status,
			projectTypes: searchParams.get('projectTypes')
				? searchParams.get('projectTypes').split(',')
				: DEFAULT_FILTERS.projectTypes,
			state: searchParams.get('state') || DEFAULT_FILTERS.state,
			coverageTypes: searchParams.get('coverage_types')
				? searchParams.get('coverage_types').split(',')
				: DEFAULT_FILTERS.coverageTypes,
			page: parseInt(searchParams.get('page')) || DEFAULT_FILTERS.page,
			pageSize: DEFAULT_FILTERS.pageSize,
			tracked: searchParams.get('tracked') === 'true',
		};

		setFilters(urlFilters);
		setSearchQuery(searchParams.get('search') || '');
		setSortOption(searchParams.get('sort') || 'relevance');
		setSortDirection(searchParams.get('sort_direction') || 'desc');

		// Release the lock after the seed state propagates
		requestAnimationFrame(() => {
			isUpdatingFromUrl.current = false;
		});
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Push store changes to URL
	useEffect(() => {
		if (isUpdatingFromUrl.current) return;

		const params = new URLSearchParams();

		if (searchQuery?.trim()) {
			params.set('search', searchQuery.trim());
		}

		// Only encode non-default values to keep URLs clean
		const isDefaultStatus =
			filters.status.length === DEFAULT_FILTERS.status.length &&
			DEFAULT_FILTERS.status.every((s) => filters.status.includes(s));
		if (!isDefaultStatus && filters.status.length > 0) {
			params.set('status', filters.status.join(','));
		}

		if (filters.projectTypes.length > 0) {
			params.set('projectTypes', filters.projectTypes.join(','));
		}

		if (filters.state) {
			params.set('state', filters.state);
		}

		const isDefaultCoverage =
			filters.coverageTypes.length ===
				DEFAULT_FILTERS.coverageTypes.length &&
			DEFAULT_FILTERS.coverageTypes.every((t) =>
				filters.coverageTypes.includes(t)
			);
		if (!isDefaultCoverage) {
			params.set('coverage_types', filters.coverageTypes.join(','));
		}

		if (filters.tracked) {
			params.set('tracked', 'true');
		}

		if (sortOption !== 'relevance') {
			params.set('sort', sortOption);
		}
		if (sortDirection !== 'desc') {
			params.set('sort_direction', sortDirection);
		}
		if (filters.page > 1) {
			params.set('page', String(filters.page));
		}

		const qs = params.toString();
		const newUrl = qs ? `${pathname}?${qs}` : pathname;

		router.replace(newUrl, { scroll: false });
	}, [filters, searchQuery, sortOption, sortDirection, pathname, router]);
}
