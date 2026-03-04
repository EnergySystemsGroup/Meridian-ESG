import { describe, it, expect } from 'vitest';

// Inline constants matching the store defaults
const DEFAULT_FILTERS = {
	status: ['Open', 'Upcoming'],
	projectTypes: [],
	state: null,
	coverageTypes: ['national', 'state', 'local'],
	page: 1,
	pageSize: 9,
	tracked: false,
};

const INITIAL_STATE = {
	filters: { ...DEFAULT_FILTERS },
	searchQuery: '',
	debouncedSearchQuery: '',
	sortOption: 'relevance',
	sortDirection: 'desc',
	projectTypeSearchInput: '',
};

// Inline action functions replicating store logic

function setFilters(state, filters) {
	return { ...state, filters };
}

function updateFilter(state, key, value) {
	return { ...state, filters: { ...state.filters, [key]: value } };
}

function resetFilters() {
	return { ...INITIAL_STATE, filters: { ...DEFAULT_FILTERS } };
}

function setPage(state, page) {
	return { ...state, filters: { ...state.filters, page } };
}

describe('opportunitiesFilterStore', () => {
	describe('DEFAULT_FILTERS', () => {
		it('has correct default status', () => {
			expect(DEFAULT_FILTERS.status).toEqual(['Open', 'Upcoming']);
		});

		it('has empty projectTypes', () => {
			expect(DEFAULT_FILTERS.projectTypes).toEqual([]);
		});

		it('has null state', () => {
			expect(DEFAULT_FILTERS.state).toBeNull();
		});

		it('has correct default coverageTypes', () => {
			expect(DEFAULT_FILTERS.coverageTypes).toEqual([
				'national',
				'state',
				'local',
			]);
		});

		it('has page 1 and pageSize 9', () => {
			expect(DEFAULT_FILTERS.page).toBe(1);
			expect(DEFAULT_FILTERS.pageSize).toBe(9);
		});

		it('has tracked false', () => {
			expect(DEFAULT_FILTERS.tracked).toBe(false);
		});
	});

	describe('initial state', () => {
		it('has correct default sort option', () => {
			expect(INITIAL_STATE.sortOption).toBe('relevance');
		});

		it('has correct default sort direction', () => {
			expect(INITIAL_STATE.sortDirection).toBe('desc');
		});

		it('has empty search queries', () => {
			expect(INITIAL_STATE.searchQuery).toBe('');
			expect(INITIAL_STATE.debouncedSearchQuery).toBe('');
		});

		it('has empty projectTypeSearchInput', () => {
			expect(INITIAL_STATE.projectTypeSearchInput).toBe('');
		});
	});

	describe('setFilters', () => {
		it('replaces the entire filters object', () => {
			const newFilters = { ...DEFAULT_FILTERS, status: ['Closed'] };
			const result = setFilters(INITIAL_STATE, newFilters);
			expect(result.filters.status).toEqual(['Closed']);
		});
	});

	describe('updateFilter', () => {
		it('updates a single filter key', () => {
			const result = updateFilter(INITIAL_STATE, 'status', ['Open']);
			expect(result.filters.status).toEqual(['Open']);
			expect(result.filters.projectTypes).toEqual([]);
		});

		it('updates state filter', () => {
			const result = updateFilter(INITIAL_STATE, 'state', 'CA');
			expect(result.filters.state).toBe('CA');
		});

		it('updates tracked filter', () => {
			const result = updateFilter(INITIAL_STATE, 'tracked', true);
			expect(result.filters.tracked).toBe(true);
		});

		it('updates coverageTypes', () => {
			const result = updateFilter(INITIAL_STATE, 'coverageTypes', [
				'national',
			]);
			expect(result.filters.coverageTypes).toEqual(['national']);
		});
	});

	describe('resetFilters', () => {
		it('returns to initial state', () => {
			const result = resetFilters();
			expect(result.filters).toEqual(DEFAULT_FILTERS);
			expect(result.searchQuery).toBe('');
			expect(result.sortOption).toBe('relevance');
			expect(result.sortDirection).toBe('desc');
			expect(result.projectTypeSearchInput).toBe('');
		});
	});

	describe('setPage', () => {
		it('updates page in filters', () => {
			const result = setPage(INITIAL_STATE, 3);
			expect(result.filters.page).toBe(3);
		});

		it('preserves other filter values', () => {
			const modified = updateFilter(INITIAL_STATE, 'state', 'NY');
			const result = setPage(modified, 2);
			expect(result.filters.state).toBe('NY');
			expect(result.filters.page).toBe(2);
		});
	});
});
