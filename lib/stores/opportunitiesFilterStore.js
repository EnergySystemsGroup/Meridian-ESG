import { create } from 'zustand';

export const DEFAULT_FILTERS = {
	status: ['Open', 'Upcoming'],
	projectTypes: [],
	state: null,
	coverageTypes: ['national', 'state', 'local'],
	page: 1,
	pageSize: 9,
	tracked: false,
};

const initialState = {
	filters: { ...DEFAULT_FILTERS },
	searchQuery: '',
	debouncedSearchQuery: '',
	sortOption: 'relevance',
	sortDirection: 'desc',
	projectTypeSearchInput: '',
};

export const useOpportunitiesFilterStore = create((set) => ({
	...initialState,

	setFilters: (filters) => set({ filters }),

	updateFilter: (key, value) =>
		set((state) => ({
			filters: { ...state.filters, [key]: value },
		})),

	resetFilters: () =>
		set({
			filters: { ...DEFAULT_FILTERS },
			searchQuery: '',
			debouncedSearchQuery: '',
			sortOption: 'relevance',
			sortDirection: 'desc',
			projectTypeSearchInput: '',
		}),

	setSearchQuery: (searchQuery) => set({ searchQuery }),
	setDebouncedSearchQuery: (debouncedSearchQuery) =>
		set({ debouncedSearchQuery }),
	setSortOption: (sortOption) => set({ sortOption }),
	setSortDirection: (sortDirection) => set({ sortDirection }),
	setPage: (page) =>
		set((state) => ({
			filters: { ...state.filters, page },
		})),
	setProjectTypeSearchInput: (projectTypeSearchInput) =>
		set({ projectTypeSearchInput }),
}));
