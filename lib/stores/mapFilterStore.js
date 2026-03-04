import { create } from 'zustand';

export const DEFAULT_MAP_FILTERS = {
	status: ['Open', 'Upcoming'],
	projectTypes: [],
	scope: ['national', 'state_wide', 'county', 'utility'],
	search: '',
	page: 1,
	pageSize: 10,
};

const initialState = {
	filters: { ...DEFAULT_MAP_FILTERS },
	selectedStateCode: null,
	selectedStateName: null,
	viewMode: 'us',
	colorBy: 'amount',
	sortOption: 'relevance',
	sortDirection: 'desc',
};

export const useMapFilterStore = create((set) => ({
	...initialState,

	setFilters: (filters) => set({ filters }),

	updateFilter: (key, value) =>
		set((state) => ({
			filters: { ...state.filters, [key]: value },
		})),

	resetFilters: () =>
		set({
			filters: { ...DEFAULT_MAP_FILTERS },
			sortOption: 'relevance',
			sortDirection: 'desc',
		}),

	setSelectedState: (code, name) =>
		set((state) => ({
			selectedStateCode: code,
			selectedStateName: name,
			viewMode: code ? 'state' : 'us',
			filters: { ...state.filters, page: 1 },
		})),

	clearSelectedState: () =>
		set({
			selectedStateCode: null,
			selectedStateName: null,
			viewMode: 'us',
		}),

	setViewMode: (viewMode) => set({ viewMode }),
	setColorBy: (colorBy) => set({ colorBy }),
	setSortOption: (sortOption) => set({ sortOption }),
	setSortDirection: (sortDirection) => set({ sortDirection }),
	setPage: (page) =>
		set((state) => ({
			filters: { ...state.filters, page },
		})),
}));
