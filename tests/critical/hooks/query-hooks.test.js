/**
 * TanStack Query Custom Hooks — Configuration Tests
 *
 * Tests the hook wiring logic using inline replicas per project test standards.
 * Validates query key selection, placeholderData behavior, enabled guards,
 * staleTime overrides, select transforms, and mutation invalidation targets.
 */

import { describe, test, expect } from 'vitest';

// --- Inline query key factory (mirrors lib/queries/queryKeys.js) ---

const queryKeys = {
	funding: {
		all: ['funding'],
		list: (filters) => ['funding', 'list', filters],
		detail: (id) => ['funding', 'detail', id],
		sources: {
			all: ['funding', 'sources'],
			list: (filters) => ['funding', 'sources', 'list', filters],
			detail: (id) => ['funding', 'sources', 'detail', id],
		},
		projectTypeSummary: (filters) => ['funding', 'projectTypeSummary', filters],
		coverageCounts: (filters) => ['funding', 'coverageCounts', filters],
		totalAvailable: ['funding', 'totalAvailable'],
	},
	projectTypes: {
		all: ['projectTypes'],
		list: (filters) => ['projectTypes', 'list', filters],
	},
	categories: {
		all: ['categories'],
		list: () => ['categories', 'list'],
	},
	clientMatching: {
		all: ['clientMatching'],
		matches: (clientId) => ['clientMatching', 'matches', clientId],
		summary: () => ['clientMatching', 'summary'],
		topMatches: () => ['clientMatching', 'topMatches'],
	},
	dashboard: {
		all: ['dashboard'],
		counts: (type) => ['dashboard', 'counts', type],
		deadlines: (type, limit) => ['dashboard', 'deadlines', type, limit],
	},
	map: {
		all: ['map'],
		fundingByState: (filters) => ['map', 'fundingByState', filters],
		national: (filters) => ['map', 'national', filters],
		opportunities: (filters) => ['map', 'opportunities', filters],
		opportunitiesByState: (stateCode, filters) => ['map', 'opportunitiesByState', stateCode, filters],
		scopeBreakdown: (stateCode, filters) => ['map', 'scopeBreakdown', stateCode, filters],
	},
	admin: {
		all: ['admin'],
		review: (filters) => ['admin', 'review', filters],
	},
};

// --- Inline hook config builders (mirrors the useQuery config logic) ---

const LONG_STALE_TIME = 15 * 60 * 1000;

function buildOpportunitiesConfig(filters = {}, options = {}) {
	return {
		queryKey: queryKeys.funding.list(filters),
		hasPlaceholderData: true,
		...options,
	};
}

function buildOpportunityDetailConfig(id, options = {}) {
	return {
		queryKey: queryKeys.funding.detail(id),
		enabled: !!id,
		...options,
	};
}

function buildProjectTypesConfig(filters = {}, options = {}) {
	return {
		queryKey: queryKeys.projectTypes.list(filters),
		hasPlaceholderData: true,
		...options,
	};
}

function buildCoverageCountsConfig(filters = {}, options = {}) {
	return {
		queryKey: queryKeys.funding.coverageCounts(filters),
		hasPlaceholderData: true,
		...options,
	};
}

function buildFundingCountConfig(options = {}) {
	return {
		queryKey: queryKeys.funding.totalAvailable,
		staleTime: LONG_STALE_TIME,
		...options,
	};
}

function buildFundingByStateConfig(filters = {}, options = {}) {
	return {
		queryKey: queryKeys.map.fundingByState(filters),
		hasPlaceholderData: true,
		...options,
	};
}

function buildNationalOpportunitiesConfig(filters = {}, options = {}) {
	return {
		queryKey: queryKeys.map.national(filters),
		hasPlaceholderData: true,
		...options,
	};
}

function buildStateOpportunitiesConfig(stateCode, filters = {}, options = {}) {
	return {
		queryKey: queryKeys.map.opportunitiesByState(stateCode, filters),
		enabled: !!stateCode,
		hasPlaceholderData: true,
		...options,
	};
}

function buildScopeBreakdownConfig(stateCode, filters = {}, options = {}) {
	return {
		queryKey: queryKeys.map.scopeBreakdown(stateCode, filters),
		enabled: !!stateCode,
		hasPlaceholderData: true,
		...options,
	};
}

function buildCategoryMappingConfig(options = {}) {
	return {
		queryKey: queryKeys.categories.list(),
		staleTime: LONG_STALE_TIME,
		...options,
	};
}

function buildClientMatchesConfig(clientId, options = {}) {
	return {
		queryKey: queryKeys.clientMatching.matches(clientId),
		hasPlaceholderData: true,
		...options,
	};
}

function buildClientMatchSummaryConfig(options = {}) {
	return {
		queryKey: queryKeys.clientMatching.summary(),
		...options,
	};
}

function buildTopClientMatchesConfig(options = {}) {
	return {
		queryKey: queryKeys.clientMatching.topMatches(),
		...options,
	};
}

function buildUpcomingDeadlinesConfig(limit, options = {}) {
	return {
		queryKey: queryKeys.dashboard.deadlines('upcoming', limit),
		...options,
	};
}

function buildThirtyDayDeadlineCountConfig(options = {}) {
	return {
		queryKey: queryKeys.dashboard.deadlines('thirty_day_count', undefined),
		...options,
	};
}

function buildOpenOpportunitiesCountConfig(options = {}) {
	return {
		queryKey: queryKeys.dashboard.counts('open_opportunities'),
		...options,
	};
}

function buildAdminReviewConfig(filters = {}, options = {}) {
	return {
		queryKey: queryKeys.admin.review(filters),
		hasPlaceholderData: true,
		...options,
	};
}

// --- Select transform for useCategoryMapping ---

function categoryMappingSelect(data) {
	return {
		rawToNormalizedMap: data.rawToNormalizedMap ?? {},
		categories: data.categories ?? [],
	};
}

// --- Recent opportunities filter constant ---

const RECENT_OPPORTUNITIES_FILTERS = {
	sort_by: 'created_at',
	sort_direction: 'desc',
	page: 1,
	page_size: 5,
};

// --- POST helper error detection (mirrors api.js post() logic) ---

function isPostError(status) {
	return !( status >= 200 && status < 300 );
}

// ===================================================================
// Tests
// ===================================================================

describe('useFunding hooks', () => {
	test('useOpportunities uses funding.list key with filters', () => {
		const filters = { status: 'Open', state: 'CA' };
		const config = buildOpportunitiesConfig(filters);
		expect(config.queryKey).toEqual(['funding', 'list', filters]);
		expect(config.hasPlaceholderData).toBe(true);
	});

	test('useOpportunities with empty filters uses empty object key', () => {
		const config = buildOpportunitiesConfig();
		expect(config.queryKey).toEqual(['funding', 'list', {}]);
	});

	test('useOpportunityDetail uses funding.detail key with id', () => {
		const config = buildOpportunityDetailConfig('abc-123');
		expect(config.queryKey).toEqual(['funding', 'detail', 'abc-123']);
		expect(config.enabled).toBe(true);
	});

	test('useOpportunityDetail is disabled without id', () => {
		expect(buildOpportunityDetailConfig(null).enabled).toBe(false);
		expect(buildOpportunityDetailConfig(undefined).enabled).toBe(false);
		expect(buildOpportunityDetailConfig('').enabled).toBe(false);
		expect(buildOpportunityDetailConfig(0).enabled).toBe(false);
	});

	test('useProjectTypes uses projectTypes.list key', () => {
		const filters = { status: 'Open' };
		const config = buildProjectTypesConfig(filters);
		expect(config.queryKey).toEqual(['projectTypes', 'list', filters]);
		expect(config.hasPlaceholderData).toBe(true);
	});

	test('useCoverageCounts uses funding.coverageCounts key', () => {
		const filters = { state: 'OR' };
		const config = buildCoverageCountsConfig(filters);
		expect(config.queryKey).toEqual(['funding', 'coverageCounts', filters]);
		expect(config.hasPlaceholderData).toBe(true);
	});

	test('useFundingCount uses static totalAvailable key with long staleTime', () => {
		const config = buildFundingCountConfig();
		expect(config.queryKey).toEqual(['funding', 'totalAvailable']);
		expect(config.staleTime).toBe(15 * 60 * 1000);
	});

	test('options spread allows overriding defaults', () => {
		const config = buildOpportunitiesConfig({}, { staleTime: 1000 });
		expect(config.staleTime).toBe(1000);
	});
});

describe('useMap hooks', () => {
	test('useFundingByState uses map.fundingByState key', () => {
		const filters = { status: 'Open' };
		const config = buildFundingByStateConfig(filters);
		expect(config.queryKey).toEqual(['map', 'fundingByState', filters]);
		expect(config.hasPlaceholderData).toBe(true);
	});

	test('useNationalOpportunities uses map.national key', () => {
		const config = buildNationalOpportunitiesConfig({ status: 'Open' });
		expect(config.queryKey).toEqual(['map', 'national', { status: 'Open' }]);
		expect(config.hasPlaceholderData).toBe(true);
	});

	test('useStateOpportunities uses map.opportunitiesByState key', () => {
		const config = buildStateOpportunitiesConfig('CA', { status: 'Open' });
		expect(config.queryKey).toEqual(['map', 'opportunitiesByState', 'CA', { status: 'Open' }]);
		expect(config.enabled).toBe(true);
	});

	test('useStateOpportunities is disabled without stateCode', () => {
		expect(buildStateOpportunitiesConfig(null).enabled).toBe(false);
		expect(buildStateOpportunitiesConfig('').enabled).toBe(false);
	});

	test('useScopeBreakdown uses map.scopeBreakdown key', () => {
		const config = buildScopeBreakdownConfig('OR');
		expect(config.queryKey).toEqual(['map', 'scopeBreakdown', 'OR', {}]);
		expect(config.enabled).toBe(true);
	});

	test('useScopeBreakdown is disabled without stateCode', () => {
		expect(buildScopeBreakdownConfig(null).enabled).toBe(false);
	});

	test('useCategoryMapping uses categories.list key with long staleTime', () => {
		const config = buildCategoryMappingConfig();
		expect(config.queryKey).toEqual(['categories', 'list']);
		expect(config.staleTime).toBe(15 * 60 * 1000);
	});
});

describe('useCategoryMapping select transform', () => {
	test('extracts rawToNormalizedMap and categories from response', () => {
		const apiResponse = {
			success: true,
			rawToNormalizedMap: { 'energy eff': 'Energy Efficiency' },
			categories: ['Energy Efficiency', 'Renewable Energy'],
			categoryGroups: {},
		};
		const result = categoryMappingSelect(apiResponse);
		expect(result).toEqual({
			rawToNormalizedMap: { 'energy eff': 'Energy Efficiency' },
			categories: ['Energy Efficiency', 'Renewable Energy'],
		});
	});

	test('defaults to empty values when fields are missing', () => {
		const result = categoryMappingSelect({ success: true });
		expect(result).toEqual({ rawToNormalizedMap: {}, categories: [] });
	});

	test('handles null fields gracefully', () => {
		const result = categoryMappingSelect({
			rawToNormalizedMap: null,
			categories: null,
		});
		expect(result).toEqual({ rawToNormalizedMap: {}, categories: [] });
	});
});

describe('useClients hooks', () => {
	test('useClientMatches uses clientMatching.matches key', () => {
		const config = buildClientMatchesConfig('client-1');
		expect(config.queryKey).toEqual(['clientMatching', 'matches', 'client-1']);
		expect(config.hasPlaceholderData).toBe(true);
	});

	test('useClientMatches with undefined clientId fetches all', () => {
		const config = buildClientMatchesConfig(undefined);
		expect(config.queryKey).toEqual(['clientMatching', 'matches', undefined]);
	});

	test('useClientMatchSummary uses clientMatching.summary key', () => {
		const config = buildClientMatchSummaryConfig();
		expect(config.queryKey).toEqual(['clientMatching', 'summary']);
	});

	test('useTopClientMatches uses clientMatching.topMatches key', () => {
		const config = buildTopClientMatchesConfig();
		expect(config.queryKey).toEqual(['clientMatching', 'topMatches']);
	});
});

describe('useDashboard hooks', () => {
	test('useUpcomingDeadlines uses dashboard.deadlines key with limit', () => {
		const config = buildUpcomingDeadlinesConfig(5);
		expect(config.queryKey).toEqual(['dashboard', 'deadlines', 'upcoming', 5]);
	});

	test('useUpcomingDeadlines without limit uses undefined', () => {
		const config = buildUpcomingDeadlinesConfig();
		expect(config.queryKey).toEqual(['dashboard', 'deadlines', 'upcoming', undefined]);
	});

	test('useThirtyDayDeadlineCount uses thirty_day_count type', () => {
		const config = buildThirtyDayDeadlineCountConfig();
		expect(config.queryKey).toEqual(['dashboard', 'deadlines', 'thirty_day_count', undefined]);
	});

	test('useOpenOpportunitiesCount uses dashboard.counts key', () => {
		const config = buildOpenOpportunitiesCountConfig();
		expect(config.queryKey).toEqual(['dashboard', 'counts', 'open_opportunities']);
	});

	test('useRecentOpportunities uses funding.list with fixed filters', () => {
		const config = buildOpportunitiesConfig(RECENT_OPPORTUNITIES_FILTERS);
		expect(config.queryKey).toEqual(['funding', 'list', {
			sort_by: 'created_at',
			sort_direction: 'desc',
			page: 1,
			page_size: 5,
		}]);
		expect(config.hasPlaceholderData).toBe(true);
	});

	test('recent opportunities filter constant is immutable shape', () => {
		expect(RECENT_OPPORTUNITIES_FILTERS).toEqual({
			sort_by: 'created_at',
			sort_direction: 'desc',
			page: 1,
			page_size: 5,
		});
	});
});

describe('useAdmin hooks', () => {
	test('useAdminReview uses admin.review key with filters', () => {
		const filters = { status: 'pending_review', page: 1 };
		const config = buildAdminReviewConfig(filters);
		expect(config.queryKey).toEqual(['admin', 'review', filters]);
		expect(config.hasPlaceholderData).toBe(true);
	});

	test('useAdminReview with default empty filters', () => {
		const config = buildAdminReviewConfig();
		expect(config.queryKey).toEqual(['admin', 'review', {}]);
	});

	test('mutation invalidation targets admin.all key', () => {
		expect(queryKeys.admin.all).toEqual(['admin']);
	});

	test('admin.all is a prefix of admin.review keys for broad invalidation', () => {
		const allKey = queryKeys.admin.all;
		const reviewKey = queryKeys.admin.review({ status: 'pending_review' });
		expect(reviewKey[0]).toBe(allKey[0]);
	});
});

describe('Mutation argument destructuring', () => {
	function extractApproveArgs({ ids, reviewed_by }) {
		return { ids, reviewed_by };
	}

	function extractRejectArgs({ ids, reviewed_by, review_notes }) {
		return { ids, reviewed_by, review_notes };
	}

	test('approve extracts ids and reviewed_by', () => {
		const input = { ids: ['a', 'b'], reviewed_by: 'admin', extra: 'ignored' };
		expect(extractApproveArgs(input)).toEqual({ ids: ['a', 'b'], reviewed_by: 'admin' });
	});

	test('reject extracts ids, reviewed_by, and review_notes', () => {
		const input = { ids: ['a'], reviewed_by: 'admin', review_notes: 'bad data' };
		expect(extractRejectArgs(input)).toEqual({
			ids: ['a'],
			reviewed_by: 'admin',
			review_notes: 'bad data',
		});
	});

	test('reject with no notes passes undefined', () => {
		const input = { ids: ['a'], reviewed_by: 'admin' };
		expect(extractRejectArgs(input)).toEqual({
			ids: ['a'],
			reviewed_by: 'admin',
			review_notes: undefined,
		});
	});
});

describe('useCategoryMapping select override', () => {
	test('options spread can override select', () => {
		const customSelect = (data) => data.categories;
		const config = buildCategoryMappingConfig({ select: customSelect });
		expect(config.select).toBe(customSelect);
	});

	test('options spread can override staleTime', () => {
		const config = buildCategoryMappingConfig({ staleTime: 1000 });
		expect(config.staleTime).toBe(1000);
	});
});

describe('POST helper error detection', () => {
	test('treats 4xx as error', () => {
		expect(isPostError(400)).toBe(true);
		expect(isPostError(401)).toBe(true);
		expect(isPostError(404)).toBe(true);
		expect(isPostError(422)).toBe(true);
	});

	test('treats 5xx as error', () => {
		expect(isPostError(500)).toBe(true);
		expect(isPostError(503)).toBe(true);
	});

	test('treats 2xx as success', () => {
		expect(isPostError(200)).toBe(false);
		expect(isPostError(201)).toBe(false);
		expect(isPostError(204)).toBe(false);
	});

	test('treats 1xx and 3xx as error', () => {
		expect(isPostError(100)).toBe(true);
		expect(isPostError(301)).toBe(true);
	});
});
