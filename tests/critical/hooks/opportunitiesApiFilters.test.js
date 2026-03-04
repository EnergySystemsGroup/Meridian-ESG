import { describe, test, expect } from 'vitest';

/**
 * Inline test functions mirroring the logic in hooks/useOpportunitiesApiFilters.js
 * Tests the filter composition from Zustand store state → API params.
 */

const SORT_BY_MAP = {
	deadline: 'close_date',
	amount: 'amount',
	recent: 'updated_at',
	relevance: 'relevance',
};

const DEFAULT_FILTERS = {
	status: ['Open', 'Upcoming'],
	projectTypes: [],
	state: null,
	coverageTypes: ['national', 'state', 'local'],
	page: 1,
	pageSize: 9,
	tracked: false,
};

/**
 * Builds the API filter object from store state.
 * Mirrors useOpportunitiesApiFilters logic.
 */
function buildApiFilters({
	filters = DEFAULT_FILTERS,
	debouncedSearch = '',
	sortOption = 'relevance',
	sortDirection = 'desc',
	trackedOpportunityIds = [],
	isInitialized = true,
} = {}) {
	const result = {};

	if (filters.status?.length > 0) {
		result.status = filters.status.join(',');
	}
	if (filters.projectTypes?.length > 0) {
		result.projectTypes = filters.projectTypes.join(',');
	}
	if (filters.state) {
		result.state = filters.state;
	}
	if (filters.coverageTypes?.length > 0) {
		result.coverage_types = filters.coverageTypes.join(',');
	}
	if (debouncedSearch?.trim()) {
		result.search = debouncedSearch.trim();
	}

	result.page = String(filters.page);
	result.page_size = String(filters.pageSize);
	result.sort_by = SORT_BY_MAP[sortOption] || 'relevance';
	result.sort_direction = sortDirection;

	if (filters.tracked && isInitialized) {
		result.trackedIds = trackedOpportunityIds.join(',');
	}

	return result;
}

/**
 * Builds project type query filters (subset of full filters).
 */
function buildProjectTypeFilters(filters = DEFAULT_FILTERS) {
	const result = {};
	if (filters.status?.length > 0) {
		result.status = filters.status.join(',');
	}
	if (filters.state) {
		result.state = filters.state;
	}
	if (filters.coverageTypes?.length > 0) {
		result.coverage_types = filters.coverageTypes.join(',');
	}
	return result;
}

/**
 * Builds coverage count query filters (subset of full filters).
 */
function buildCoverageCountFilters(filters = DEFAULT_FILTERS) {
	const result = {};
	if (filters.state) {
		result.state = filters.state;
	}
	return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildApiFilters — sort option mapping', () => {
	test('maps "deadline" to sort_by "close_date"', () => {
		const result = buildApiFilters({ sortOption: 'deadline' });
		expect(result.sort_by).toBe('close_date');
	});

	test('maps "amount" to sort_by "amount"', () => {
		const result = buildApiFilters({ sortOption: 'amount' });
		expect(result.sort_by).toBe('amount');
	});

	test('maps "recent" to sort_by "updated_at"', () => {
		const result = buildApiFilters({ sortOption: 'recent' });
		expect(result.sort_by).toBe('updated_at');
	});

	test('maps "relevance" to sort_by "relevance"', () => {
		const result = buildApiFilters({ sortOption: 'relevance' });
		expect(result.sort_by).toBe('relevance');
	});

	test('unknown sort option falls back to "relevance"', () => {
		const result = buildApiFilters({ sortOption: 'nonexistent' });
		expect(result.sort_by).toBe('relevance');
	});

	test('passes sort direction through', () => {
		const result = buildApiFilters({ sortDirection: 'asc' });
		expect(result.sort_direction).toBe('asc');
	});
});

describe('buildApiFilters — filter composition', () => {
	test('default filters produce expected API params', () => {
		const result = buildApiFilters();
		expect(result.status).toBe('Open,Upcoming');
		expect(result.coverage_types).toBe('national,state,local');
		expect(result.page).toBe('1');
		expect(result.page_size).toBe('9');
		expect(result.sort_by).toBe('relevance');
		expect(result.sort_direction).toBe('desc');
		expect(result).not.toHaveProperty('projectTypes');
		expect(result).not.toHaveProperty('state');
		expect(result).not.toHaveProperty('search');
		expect(result).not.toHaveProperty('trackedIds');
	});

	test('includes projectTypes when non-empty', () => {
		const result = buildApiFilters({
			filters: { ...DEFAULT_FILTERS, projectTypes: ['Solar', 'Wind'] },
		});
		expect(result.projectTypes).toBe('Solar,Wind');
	});

	test('includes state when set', () => {
		const result = buildApiFilters({
			filters: { ...DEFAULT_FILTERS, state: 'CA' },
		});
		expect(result.state).toBe('CA');
	});

	test('omits state when null', () => {
		const result = buildApiFilters({
			filters: { ...DEFAULT_FILTERS, state: null },
		});
		expect(result).not.toHaveProperty('state');
	});

	test('includes search when non-empty after trim', () => {
		const result = buildApiFilters({ debouncedSearch: '  solar panels  ' });
		expect(result.search).toBe('solar panels');
	});

	test('omits search when empty or whitespace', () => {
		expect(buildApiFilters({ debouncedSearch: '' })).not.toHaveProperty(
			'search'
		);
		expect(buildApiFilters({ debouncedSearch: '   ' })).not.toHaveProperty(
			'search'
		);
	});

	test('maps pageSize to page_size (snake_case)', () => {
		const result = buildApiFilters({
			filters: { ...DEFAULT_FILTERS, pageSize: 12 },
		});
		expect(result.page_size).toBe('12');
		expect(result).not.toHaveProperty('pageSize');
	});

	test('maps coverageTypes to coverage_types (snake_case)', () => {
		const result = buildApiFilters({
			filters: { ...DEFAULT_FILTERS, coverageTypes: ['national'] },
		});
		expect(result.coverage_types).toBe('national');
		expect(result).not.toHaveProperty('coverageTypes');
	});
});

describe('buildApiFilters — tracked ID injection', () => {
	test('includes trackedIds when tracked=true and initialized', () => {
		const result = buildApiFilters({
			filters: { ...DEFAULT_FILTERS, tracked: true },
			trackedOpportunityIds: ['abc', 'def'],
			isInitialized: true,
		});
		expect(result.trackedIds).toBe('abc,def');
	});

	test('omits trackedIds when tracked=false', () => {
		const result = buildApiFilters({
			filters: { ...DEFAULT_FILTERS, tracked: false },
			trackedOpportunityIds: ['abc'],
			isInitialized: true,
		});
		expect(result).not.toHaveProperty('trackedIds');
	});

	test('omits trackedIds when not initialized', () => {
		const result = buildApiFilters({
			filters: { ...DEFAULT_FILTERS, tracked: true },
			trackedOpportunityIds: ['abc'],
			isInitialized: false,
		});
		expect(result).not.toHaveProperty('trackedIds');
	});

	test('includes empty trackedIds when tracked=true but list is empty', () => {
		const result = buildApiFilters({
			filters: { ...DEFAULT_FILTERS, tracked: true },
			trackedOpportunityIds: [],
			isInitialized: true,
		});
		expect(result.trackedIds).toBe('');
	});
});

describe('buildProjectTypeFilters — subset composition', () => {
	test('includes only status, state, and coverage_types', () => {
		const result = buildProjectTypeFilters({
			...DEFAULT_FILTERS,
			state: 'NY',
			projectTypes: ['Solar'],
		});
		expect(result.status).toBe('Open,Upcoming');
		expect(result.state).toBe('NY');
		expect(result.coverage_types).toBe('national,state,local');
		// Should NOT include projectTypes, page, search, etc.
		expect(result).not.toHaveProperty('projectTypes');
		expect(result).not.toHaveProperty('page');
		expect(result).not.toHaveProperty('page_size');
	});

	test('omits state when null', () => {
		const result = buildProjectTypeFilters(DEFAULT_FILTERS);
		expect(result).not.toHaveProperty('state');
	});
});

describe('buildCoverageCountFilters — subset composition', () => {
	test('includes only state when set', () => {
		const result = buildCoverageCountFilters({
			...DEFAULT_FILTERS,
			state: 'TX',
		});
		expect(result).toEqual({ state: 'TX' });
	});

	test('returns empty object when state is null', () => {
		const result = buildCoverageCountFilters(DEFAULT_FILTERS);
		expect(result).toEqual({});
	});
});
