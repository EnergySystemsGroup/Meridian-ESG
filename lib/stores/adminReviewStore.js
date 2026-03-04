import { create } from 'zustand';

const DEFAULT_STATE = {
	statusFilter: 'pending_review',
	searchText: '',
	searchInput: '',
	stateFilter: '',
	minScoreFilter: '',
	sortBy: 'created_at',
	sortDirection: 'desc',
	page: 1,
	selectedIds: new Set(),
};

export const useAdminReviewStore = create((set) => ({
	...DEFAULT_STATE,

	setStatusFilter: (statusFilter) => set({ statusFilter, page: 1 }),
	setSearchText: (searchText) => set({ searchText, page: 1 }),
	setSearchInput: (searchInput) => set({ searchInput }),
	setStateFilter: (stateFilter) => set({ stateFilter, page: 1 }),
	setMinScoreFilter: (minScoreFilter) => set({ minScoreFilter, page: 1 }),
	setSortBy: (sortBy) => set({ sortBy, page: 1 }),
	setSortDirection: (sortDirection) => set({ sortDirection, page: 1 }),
	setPage: (page) => set({ page }),

	toggleSelectedId: (id) =>
		set((state) => {
			const next = new Set(state.selectedIds);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return { selectedIds: next };
		}),

	selectAll: (ids) => set({ selectedIds: new Set(ids) }),
	clearSelection: () => set({ selectedIds: new Set() }),

	resetFilters: () =>
		set({
			statusFilter: 'pending_review',
			searchText: '',
			searchInput: '',
			stateFilter: '',
			minScoreFilter: '',
			sortBy: 'created_at',
			sortDirection: 'desc',
			page: 1,
			selectedIds: new Set(),
		}),
}));
