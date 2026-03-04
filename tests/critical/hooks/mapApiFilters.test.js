import { describe, test, expect } from 'vitest';

/**
 * Inline test functions mirroring the logic in hooks/useMapApiFilters.js
 * Tests the filter composition from Zustand store state -> API params.
 */

const SORT_BY_MAP = {
	deadline: 'close_date',
	amount: 'maximum_award',
	recent: 'updated_at',
	relevance: 'relevance',
};

const DEFAULT_MAP_FILTERS = {
	status: ['Open', 'Upcoming'],
	projectTypes: [],
	scope: ['national', 'state_wide', 'county', 'utility'],
	search: '',
	page: 1,
	pageSize: 10,
};

/**
 * Builds the funding-by-state filter object.
 * Mirrors useMapApiFilters -> fundingByStateFilters logic.
 */
function buildFundingByStateFilters({
	filters = DEFAULT_MAP_FILTERS,
	debouncedSearch = '',
} = {}) {
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
	if (debouncedSearch?.trim()) {
		result.search = debouncedSearch.trim();
	}
	return result;
}

/**
 * Builds the opportunities list filter object.
 * Mirrors useMapApiFilters -> opportunitiesFilters logic.
 */
function buildOpportunitiesFilters({
	filters = DEFAULT_MAP_FILTERS,
	selectedStateCode = null,
	sortOption = 'relevance',
	sortDirection = 'desc',
	debouncedSearch = '',
} = {}) {
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
	if (debouncedSearch?.trim()) {
		result.search = debouncedSearch.trim();
	}
	result.sort_by = sortOption;
	result.sort_direction = sortDirection;
	result.page = String(filters.page);
	result.pageSize = String(filters.pageSize);
	return result;
}

/**
 * Builds the scope breakdown filter object.
 * Mirrors useMapApiFilters -> scopeBreakdownFilters logic.
 */
function buildScopeBreakdownFilters({
	filters = DEFAULT_MAP_FILTERS,
} = {}) {
	const result = {};
	if (filters.status?.length > 0) {
		result.status = filters.status.join(',');
	}
	if (filters.projectTypes?.length > 0) {
		result.projectTypes = filters.projectTypes.join(',');
	}
	return result;
}

describe('mapApiFilters', () => {
	describe('fundingByStateFilters', () => {
		test('default filters include status only', () => {
			const result = buildFundingByStateFilters();
			expect(result.status).toBe('Open,Upcoming');
			expect(result.scope).toBeUndefined(); // all 4 scopes = default, not sent
			expect(result.projectTypes).toBeUndefined();
			expect(result.search).toBeUndefined();
		});

		test('includes scope when not all selected', () => {
			const result = buildFundingByStateFilters({
				filters: { ...DEFAULT_MAP_FILTERS, scope: ['national', 'state_wide'] },
			});
			expect(result.scope).toBe('national,state_wide');
		});

		test('omits scope when all 4 selected', () => {
			const result = buildFundingByStateFilters({
				filters: DEFAULT_MAP_FILTERS,
			});
			expect(result.scope).toBeUndefined();
		});

		test('includes projectTypes when set', () => {
			const result = buildFundingByStateFilters({
				filters: { ...DEFAULT_MAP_FILTERS, projectTypes: ['Solar', 'HVAC'] },
			});
			expect(result.projectTypes).toBe('Solar,HVAC');
		});

		test('includes search when debounced value present', () => {
			const result = buildFundingByStateFilters({
				debouncedSearch: 'solar panel',
			});
			expect(result.search).toBe('solar panel');
		});

		test('trims whitespace from search', () => {
			const result = buildFundingByStateFilters({
				debouncedSearch: '  solar  ',
			});
			expect(result.search).toBe('solar');
		});
	});

	describe('opportunitiesFilters', () => {
		test('default filters include sort and pagination', () => {
			const result = buildOpportunitiesFilters();
			expect(result.status).toBe('Open,Upcoming');
			expect(result.sort_by).toBe('relevance');
			expect(result.sort_direction).toBe('desc');
			expect(result.page).toBe('1');
			expect(result.pageSize).toBe('10');
			expect(result.state).toBeUndefined();
		});

		test('includes state when selected', () => {
			const result = buildOpportunitiesFilters({
				selectedStateCode: 'CA',
			});
			expect(result.state).toBe('CA');
		});

		test('maps sort option correctly', () => {
			const result = buildOpportunitiesFilters({
				sortOption: 'deadline',
				sortDirection: 'asc',
			});
			expect(result.sort_by).toBe('deadline');
			expect(result.sort_direction).toBe('asc');
		});

		test('includes page as string', () => {
			const result = buildOpportunitiesFilters({
				filters: { ...DEFAULT_MAP_FILTERS, page: 3 },
			});
			expect(result.page).toBe('3');
		});

		test('includes search when debounced value present', () => {
			const result = buildOpportunitiesFilters({
				debouncedSearch: 'wind',
			});
			expect(result.search).toBe('wind');
		});
	});

	describe('scopeBreakdownFilters', () => {
		test('default filters include status', () => {
			const result = buildScopeBreakdownFilters();
			expect(result.status).toBe('Open,Upcoming');
			expect(result.projectTypes).toBeUndefined();
		});

		test('includes projectTypes when set', () => {
			const result = buildScopeBreakdownFilters({
				filters: { ...DEFAULT_MAP_FILTERS, projectTypes: ['Solar'] },
			});
			expect(result.projectTypes).toBe('Solar');
		});

		test('does not include scope or search', () => {
			const result = buildScopeBreakdownFilters({
				filters: {
					...DEFAULT_MAP_FILTERS,
					scope: ['national'],
					search: 'test',
				},
			});
			expect(result.scope).toBeUndefined();
			expect(result.search).toBeUndefined();
		});
	});

	describe('SORT_BY_MAP', () => {
		test('maps deadline to close_date', () => {
			expect(SORT_BY_MAP.deadline).toBe('close_date');
		});

		test('maps amount to maximum_award', () => {
			expect(SORT_BY_MAP.amount).toBe('maximum_award');
		});

		test('maps recent to updated_at', () => {
			expect(SORT_BY_MAP.recent).toBe('updated_at');
		});

		test('maps relevance to relevance', () => {
			expect(SORT_BY_MAP.relevance).toBe('relevance');
		});
	});
});
