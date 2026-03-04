/**
 * TanStack Query Foundation Tests
 *
 * Tests the query key factory (queryKeys) produces correct key arrays
 * for each domain, ensuring proper cache isolation and invalidation.
 *
 * Uses inline copies of the queryKeys object per project test standards.
 */

import { describe, test, expect } from 'vitest';

// --- Inline copy of queryKeys mirroring lib/queries/queryKeys.js ---

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

	clients: {
		all: ['clients'],
		list: () => ['clients', 'list'],
		detail: (id) => ['clients', 'detail', id],
		hiddenMatches: (id) => ['clients', 'hiddenMatches', id],
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
		coverageAreas: (stateCode, filters) => ['map', 'coverageAreas', stateCode, filters],
		opportunitiesByArea: (areaId, filters) => ['map', 'opportunitiesByArea', areaId, filters],
		scopeBreakdown: (stateCode, filters) => ['map', 'scopeBreakdown', stateCode, filters],
	},

	admin: {
		all: ['admin'],
		review: (filters) => ['admin', 'review', filters],
		systemConfig: (key) => ['admin', 'systemConfig', key],
	},
};

// --- Tests ---

describe('queryKeys factory', () => {
	describe('top-level domain keys are unique', () => {
		test('all domain .all keys have distinct first elements', () => {
			const topLevelKeys = [
				queryKeys.funding.all[0],
				queryKeys.projectTypes.all[0],
				queryKeys.categories.all[0],
				queryKeys.clients.all[0],
				queryKeys.clientMatching.all[0],
				queryKeys.dashboard.all[0],
				queryKeys.map.all[0],
				queryKeys.admin.all[0],
			];
			const unique = new Set(topLevelKeys);
			expect(unique.size).toBe(topLevelKeys.length);
		});
	});

	describe('funding keys', () => {
		test('.all returns base key', () => {
			expect(queryKeys.funding.all).toEqual(['funding']);
		});

		test('.list includes filters', () => {
			const filters = { status: 'Open', page: 1 };
			expect(queryKeys.funding.list(filters)).toEqual(['funding', 'list', filters]);
		});

		test('.detail includes id', () => {
			expect(queryKeys.funding.detail('abc-123')).toEqual(['funding', 'detail', 'abc-123']);
		});

		test('.sources.all is scoped under funding', () => {
			expect(queryKeys.funding.sources.all).toEqual(['funding', 'sources']);
		});

		test('.sources.detail includes id', () => {
			expect(queryKeys.funding.sources.detail(42)).toEqual(['funding', 'sources', 'detail', 42]);
		});

		test('.totalAvailable is a static key', () => {
			expect(queryKeys.funding.totalAvailable).toEqual(['funding', 'totalAvailable']);
		});

		test('.coverageCounts includes filters', () => {
			const filters = { state: 'CA' };
			expect(queryKeys.funding.coverageCounts(filters)).toEqual(['funding', 'coverageCounts', filters]);
		});
	});

	describe('clients keys', () => {
		test('.list returns stable key', () => {
			expect(queryKeys.clients.list()).toEqual(['clients', 'list']);
		});

		test('.detail includes id', () => {
			expect(queryKeys.clients.detail('client-1')).toEqual(['clients', 'detail', 'client-1']);
		});

		test('.hiddenMatches includes client id', () => {
			expect(queryKeys.clients.hiddenMatches('client-1')).toEqual(['clients', 'hiddenMatches', 'client-1']);
		});
	});

	describe('clientMatching keys', () => {
		test('.matches includes clientId', () => {
			expect(queryKeys.clientMatching.matches('c1')).toEqual(['clientMatching', 'matches', 'c1']);
		});

		test('.summary returns stable key', () => {
			expect(queryKeys.clientMatching.summary()).toEqual(['clientMatching', 'summary']);
		});

		test('.topMatches returns stable key', () => {
			expect(queryKeys.clientMatching.topMatches()).toEqual(['clientMatching', 'topMatches']);
		});
	});

	describe('dashboard keys', () => {
		test('.counts includes type', () => {
			expect(queryKeys.dashboard.counts('open_opportunities')).toEqual([
				'dashboard', 'counts', 'open_opportunities',
			]);
		});

		test('.deadlines includes type and limit', () => {
			expect(queryKeys.dashboard.deadlines('upcoming', 5)).toEqual([
				'dashboard', 'deadlines', 'upcoming', 5,
			]);
		});
	});

	describe('map keys', () => {
		test('.fundingByState includes filters', () => {
			const filters = { status: 'Open' };
			expect(queryKeys.map.fundingByState(filters)).toEqual(['map', 'fundingByState', filters]);
		});

		test('.opportunitiesByState includes state code and filters', () => {
			expect(queryKeys.map.opportunitiesByState('CA', { page: 1 })).toEqual([
				'map', 'opportunitiesByState', 'CA', { page: 1 },
			]);
		});

		test('.coverageAreas includes state code and filters', () => {
			expect(queryKeys.map.coverageAreas('TX', { kind: 'county' })).toEqual([
				'map', 'coverageAreas', 'TX', { kind: 'county' },
			]);
		});

		test('.scopeBreakdown includes state code', () => {
			expect(queryKeys.map.scopeBreakdown('NY', {})).toEqual([
				'map', 'scopeBreakdown', 'NY', {},
			]);
		});
	});

	describe('admin keys', () => {
		test('.review includes filters', () => {
			const filters = { status: 'pending_review', page: 1 };
			expect(queryKeys.admin.review(filters)).toEqual(['admin', 'review', filters]);
		});

		test('.systemConfig includes key', () => {
			expect(queryKeys.admin.systemConfig('scoring_weights')).toEqual([
				'admin', 'systemConfig', 'scoring_weights',
			]);
		});
	});
});
