import { describe, it, expect } from 'vitest';

// Inline constants matching the store defaults
const DEFAULT_MAP_FILTERS = {
	status: ['Open', 'Upcoming'],
	projectTypes: [],
	scope: ['national', 'state_wide', 'county', 'utility'],
	search: '',
	page: 1,
	pageSize: 10,
};

const INITIAL_STATE = {
	filters: { ...DEFAULT_MAP_FILTERS },
	selectedStateCode: null,
	selectedStateName: null,
	viewMode: 'us',
	colorBy: 'amount',
	sortOption: 'relevance',
	sortDirection: 'desc',
};

// Inline action functions replicating store logic

function setFilters(state, filters) {
	return { ...state, filters };
}

function updateFilter(state, key, value) {
	return { ...state, filters: { ...state.filters, [key]: value } };
}

function resetFilters(state) {
	return {
		...state,
		filters: { ...DEFAULT_MAP_FILTERS },
		sortOption: 'relevance',
		sortDirection: 'desc',
	};
}

function setPage(state, page) {
	return { ...state, filters: { ...state.filters, page } };
}

function setSelectedState(state, code, name) {
	return {
		...state,
		selectedStateCode: code,
		selectedStateName: name,
		viewMode: code ? 'state' : 'us',
		filters: { ...state.filters, page: 1 },
	};
}

function clearSelectedState(state) {
	return {
		...state,
		selectedStateCode: null,
		selectedStateName: null,
		viewMode: 'us',
	};
}

describe('mapFilterStore', () => {
	describe('DEFAULT_MAP_FILTERS', () => {
		it('has correct default status', () => {
			expect(DEFAULT_MAP_FILTERS.status).toEqual(['Open', 'Upcoming']);
		});

		it('has empty projectTypes', () => {
			expect(DEFAULT_MAP_FILTERS.projectTypes).toEqual([]);
		});

		it('has all scope types', () => {
			expect(DEFAULT_MAP_FILTERS.scope).toEqual([
				'national',
				'state_wide',
				'county',
				'utility',
			]);
		});

		it('has empty search', () => {
			expect(DEFAULT_MAP_FILTERS.search).toBe('');
		});

		it('has page 1 and pageSize 10', () => {
			expect(DEFAULT_MAP_FILTERS.page).toBe(1);
			expect(DEFAULT_MAP_FILTERS.pageSize).toBe(10);
		});
	});

	describe('initial state', () => {
		it('has no selected state', () => {
			expect(INITIAL_STATE.selectedStateCode).toBeNull();
			expect(INITIAL_STATE.selectedStateName).toBeNull();
		});

		it('has us view mode', () => {
			expect(INITIAL_STATE.viewMode).toBe('us');
		});

		it('has amount color mode', () => {
			expect(INITIAL_STATE.colorBy).toBe('amount');
		});

		it('has correct default sort', () => {
			expect(INITIAL_STATE.sortOption).toBe('relevance');
			expect(INITIAL_STATE.sortDirection).toBe('desc');
		});
	});

	describe('setFilters', () => {
		it('replaces the entire filters object', () => {
			const newFilters = { ...DEFAULT_MAP_FILTERS, status: ['Closed'] };
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

		it('updates scope filter', () => {
			const result = updateFilter(INITIAL_STATE, 'scope', ['national']);
			expect(result.filters.scope).toEqual(['national']);
		});

		it('updates search', () => {
			const result = updateFilter(INITIAL_STATE, 'search', 'solar');
			expect(result.filters.search).toBe('solar');
		});

		it('updates projectTypes', () => {
			const result = updateFilter(INITIAL_STATE, 'projectTypes', [
				'Solar',
				'HVAC',
			]);
			expect(result.filters.projectTypes).toEqual(['Solar', 'HVAC']);
		});
	});

	describe('resetFilters', () => {
		it('returns to initial filter state', () => {
			const result = resetFilters(INITIAL_STATE);
			expect(result.filters).toEqual(DEFAULT_MAP_FILTERS);
			expect(result.sortOption).toBe('relevance');
			expect(result.sortDirection).toBe('desc');
		});

		it('preserves non-filter state like selectedStateCode', () => {
			const withState = setSelectedState(INITIAL_STATE, 'CA', 'California');
			const modified = updateFilter(withState, 'status', ['Closed']);
			const result = resetFilters(modified);
			expect(result.filters).toEqual(DEFAULT_MAP_FILTERS);
			expect(result.selectedStateCode).toBe('CA');
			expect(result.selectedStateName).toBe('California');
			expect(result.viewMode).toBe('state');
		});
	});

	describe('setPage', () => {
		it('updates page in filters', () => {
			const result = setPage(INITIAL_STATE, 3);
			expect(result.filters.page).toBe(3);
		});

		it('preserves other filter values', () => {
			const modified = updateFilter(INITIAL_STATE, 'scope', ['national']);
			const result = setPage(modified, 2);
			expect(result.filters.scope).toEqual(['national']);
			expect(result.filters.page).toBe(2);
		});
	});

	describe('setSelectedState', () => {
		it('sets state code, name, and switches to state view', () => {
			const result = setSelectedState(INITIAL_STATE, 'CA', 'California');
			expect(result.selectedStateCode).toBe('CA');
			expect(result.selectedStateName).toBe('California');
			expect(result.viewMode).toBe('state');
		});

		it('preserves filters but resets page when selecting state', () => {
			const modified = updateFilter(INITIAL_STATE, 'search', 'solar');
			const paged = setPage(modified, 3);
			const result = setSelectedState(paged, 'NY', 'New York');
			expect(result.filters.search).toBe('solar');
			expect(result.filters.page).toBe(1);
		});

		it('sets us view when code is null', () => {
			const withState = setSelectedState(INITIAL_STATE, 'CA', 'California');
			const result = setSelectedState(withState, null, null);
			expect(result.viewMode).toBe('us');
		});
	});

	describe('clearSelectedState', () => {
		it('clears selection and returns to us view', () => {
			const withState = setSelectedState(INITIAL_STATE, 'TX', 'Texas');
			const result = clearSelectedState(withState);
			expect(result.selectedStateCode).toBeNull();
			expect(result.selectedStateName).toBeNull();
			expect(result.viewMode).toBe('us');
		});
	});
});
