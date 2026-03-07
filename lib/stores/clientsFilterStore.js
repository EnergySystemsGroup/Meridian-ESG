import { create } from 'zustand';

export const ITEMS_PER_PAGE = 12;

export const DEFAULT_CLIENT_FILTERS = {
	searchQuery: '',
	sortBy: 'matchCount-desc',
	filterTypes: [],
	filterStates: [],
	filterHasMatches: 'all',
	filterDac: 'all',
	filterUserId: null, // null = "my clients" (API default), 'all' = no filter, uuid = specific user
	displayCount: ITEMS_PER_PAGE,
};

export const useClientsFilterStore = create((set) => ({
	...DEFAULT_CLIENT_FILTERS,

	setSearchQuery: (searchQuery) => set({ searchQuery }),
	setSortBy: (sortBy) => set({ sortBy }),
	setFilterTypes: (filterTypes) => set({ filterTypes }),
	setFilterStates: (filterStates) => set({ filterStates }),
	setFilterHasMatches: (filterHasMatches) => set({ filterHasMatches }),
	setFilterDac: (filterDac) => set({ filterDac }),
	setFilterUserId: (filterUserId) => set({ filterUserId }),
	setDisplayCount: (displayCount) => set({ displayCount }),
	resetFilters: () => set({ ...DEFAULT_CLIENT_FILTERS }),
	loadMore: () =>
		set((state) => ({ displayCount: state.displayCount + ITEMS_PER_PAGE })),
}));
