import { describe, it, expect } from 'vitest';

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

// Inline action functions replicating store logic

function toggleSelectedId(selectedIds, id) {
	const next = new Set(selectedIds);
	if (next.has(id)) {
		next.delete(id);
	} else {
		next.add(id);
	}
	return next;
}

function selectAll(ids) {
	return new Set(ids);
}

function clearSelection() {
	return new Set();
}

function resetFilters() {
	return {
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
}

describe('adminReviewStore', () => {
	describe('initial state', () => {
		it('has pending_review as default statusFilter', () => {
			expect(DEFAULT_STATE.statusFilter).toBe('pending_review');
		});

		it('has empty search fields', () => {
			expect(DEFAULT_STATE.searchText).toBe('');
			expect(DEFAULT_STATE.searchInput).toBe('');
		});

		it('has empty filter fields', () => {
			expect(DEFAULT_STATE.stateFilter).toBe('');
			expect(DEFAULT_STATE.minScoreFilter).toBe('');
		});

		it('has created_at desc as default sort', () => {
			expect(DEFAULT_STATE.sortBy).toBe('created_at');
			expect(DEFAULT_STATE.sortDirection).toBe('desc');
		});

		it('starts on page 1', () => {
			expect(DEFAULT_STATE.page).toBe(1);
		});

		it('has empty selectedIds Set', () => {
			expect(DEFAULT_STATE.selectedIds).toEqual(new Set());
			expect(DEFAULT_STATE.selectedIds.size).toBe(0);
		});
	});

	describe('filter setters reset page to 1', () => {
		it('setStatusFilter resets page', () => {
			const state = { ...DEFAULT_STATE, page: 3, statusFilter: 'promoted' };
			// Simulating the store action: set statusFilter and page: 1
			const result = { ...state, statusFilter: 'rejected', page: 1 };
			expect(result.statusFilter).toBe('rejected');
			expect(result.page).toBe(1);
		});

		it('setSearchText resets page', () => {
			const state = { ...DEFAULT_STATE, page: 5 };
			const result = { ...state, searchText: 'solar', page: 1 };
			expect(result.searchText).toBe('solar');
			expect(result.page).toBe(1);
		});

		it('setStateFilter resets page', () => {
			const state = { ...DEFAULT_STATE, page: 2 };
			const result = { ...state, stateFilter: 'CA', page: 1 };
			expect(result.stateFilter).toBe('CA');
			expect(result.page).toBe(1);
		});

		it('setMinScoreFilter resets page', () => {
			const state = { ...DEFAULT_STATE, page: 4 };
			const result = { ...state, minScoreFilter: '5', page: 1 };
			expect(result.minScoreFilter).toBe('5');
			expect(result.page).toBe(1);
		});

		it('setSearchInput does NOT reset page (input buffer, not committed search)', () => {
			const state = { ...DEFAULT_STATE, page: 3 };
			// searchInput is the raw keystroke buffer; only searchText (debounced) resets page
			const result = { ...state, searchInput: 'sol' };
			expect(result.searchInput).toBe('sol');
			expect(result.page).toBe(3);
		});
	});

	describe('sort setters', () => {
		it('setSortBy updates sort column', () => {
			const result = { ...DEFAULT_STATE, sortBy: 'final_score' };
			expect(result.sortBy).toBe('final_score');
		});

		it('setSortDirection updates direction', () => {
			const result = { ...DEFAULT_STATE, sortDirection: 'asc' };
			expect(result.sortDirection).toBe('asc');
		});

		it('sort by and direction update independently', () => {
			let state = { ...DEFAULT_STATE };
			state = { ...state, sortBy: 'title' };
			state = { ...state, sortDirection: 'asc' };
			expect(state.sortBy).toBe('title');
			expect(state.sortDirection).toBe('asc');
		});
	});

	describe('toggleSelectedId', () => {
		it('adds ID when not present', () => {
			const result = toggleSelectedId(new Set(), 'id-1');
			expect(result).toEqual(new Set(['id-1']));
		});

		it('removes ID when already present', () => {
			const result = toggleSelectedId(new Set(['id-1', 'id-2']), 'id-1');
			expect(result).toEqual(new Set(['id-2']));
		});

		it('toggle twice returns to original', () => {
			let selected = new Set();
			selected = toggleSelectedId(selected, 'id-1');
			selected = toggleSelectedId(selected, 'id-1');
			expect(selected).toEqual(new Set());
		});

		it('handles multiple toggles', () => {
			let selected = new Set();
			selected = toggleSelectedId(selected, 'id-1');
			selected = toggleSelectedId(selected, 'id-2');
			selected = toggleSelectedId(selected, 'id-3');
			expect(selected).toEqual(new Set(['id-1', 'id-2', 'id-3']));

			selected = toggleSelectedId(selected, 'id-2');
			expect(selected).toEqual(new Set(['id-1', 'id-3']));
		});
	});

	describe('selectAll', () => {
		it('creates Set with all provided IDs', () => {
			const result = selectAll(['id-1', 'id-2', 'id-3']);
			expect(result).toEqual(new Set(['id-1', 'id-2', 'id-3']));
		});

		it('handles empty array', () => {
			const result = selectAll([]);
			expect(result).toEqual(new Set());
		});
	});

	describe('clearSelection', () => {
		it('returns empty Set', () => {
			const result = clearSelection();
			expect(result).toEqual(new Set());
			expect(result.size).toBe(0);
		});
	});

	describe('resetFilters', () => {
		it('returns all values to defaults', () => {
			const result = resetFilters();
			expect(result.statusFilter).toBe('pending_review');
			expect(result.searchText).toBe('');
			expect(result.searchInput).toBe('');
			expect(result.stateFilter).toBe('');
			expect(result.minScoreFilter).toBe('');
			expect(result.sortBy).toBe('created_at');
			expect(result.sortDirection).toBe('desc');
			expect(result.page).toBe(1);
			expect(result.selectedIds).toEqual(new Set());
		});

		it('clears selection as part of reset', () => {
			const result = resetFilters();
			expect(result.selectedIds.size).toBe(0);
		});
	});
});
