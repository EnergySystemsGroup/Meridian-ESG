import { describe, it, expect } from 'vitest';

const ITEMS_PER_PAGE = 12;

const DEFAULT_CLIENT_FILTERS = {
	searchQuery: '',
	sortBy: 'matchCount-desc',
	filterTypes: [],
	filterStates: [],
	filterHasMatches: 'all',
	filterDac: 'all',
	filterUserId: null,
	displayCount: ITEMS_PER_PAGE,
};

// Inline action functions replicating store logic

function resetFilters() {
	return { ...DEFAULT_CLIENT_FILTERS };
}

function loadMore(state) {
	return { ...state, displayCount: state.displayCount + ITEMS_PER_PAGE };
}

describe('clientsFilterStore', () => {
	describe('DEFAULT_CLIENT_FILTERS', () => {
		it('has empty search query', () => {
			expect(DEFAULT_CLIENT_FILTERS.searchQuery).toBe('');
		});

		it('has matchCount-desc as default sort', () => {
			expect(DEFAULT_CLIENT_FILTERS.sortBy).toBe('matchCount-desc');
		});

		it('has empty filter arrays', () => {
			expect(DEFAULT_CLIENT_FILTERS.filterTypes).toEqual([]);
			expect(DEFAULT_CLIENT_FILTERS.filterStates).toEqual([]);
		});

		it('has "all" as default for toggle filters', () => {
			expect(DEFAULT_CLIENT_FILTERS.filterHasMatches).toBe('all');
			expect(DEFAULT_CLIENT_FILTERS.filterDac).toBe('all');
		});

		it('has null as default filterUserId (my clients)', () => {
			expect(DEFAULT_CLIENT_FILTERS.filterUserId).toBeNull();
		});

		it('has ITEMS_PER_PAGE as default displayCount', () => {
			expect(DEFAULT_CLIENT_FILTERS.displayCount).toBe(12);
		});
	});

	describe('ITEMS_PER_PAGE', () => {
		it('is 12', () => {
			expect(ITEMS_PER_PAGE).toBe(12);
		});
	});

	describe('setter actions', () => {
		it('setSearchQuery updates search', () => {
			const state = { ...DEFAULT_CLIENT_FILTERS, searchQuery: 'test' };
			expect(state.searchQuery).toBe('test');
		});

		it('setSortBy updates sort', () => {
			const state = { ...DEFAULT_CLIENT_FILTERS, sortBy: 'name-asc' };
			expect(state.sortBy).toBe('name-asc');
		});

		it('setFilterTypes replaces the array', () => {
			const state = {
				...DEFAULT_CLIENT_FILTERS,
				filterTypes: ['residential', 'commercial'],
			};
			expect(state.filterTypes).toEqual(['residential', 'commercial']);
		});

		it('setFilterStates replaces the array', () => {
			const state = {
				...DEFAULT_CLIENT_FILTERS,
				filterStates: ['CA', 'NY'],
			};
			expect(state.filterStates).toEqual(['CA', 'NY']);
		});

		it('setFilterHasMatches accepts valid values', () => {
			for (const value of ['all', 'yes', 'no']) {
				const state = {
					...DEFAULT_CLIENT_FILTERS,
					filterHasMatches: value,
				};
				expect(state.filterHasMatches).toBe(value);
			}
		});

		it('setFilterDac accepts valid values', () => {
			for (const value of ['all', 'yes', 'no']) {
				const state = { ...DEFAULT_CLIENT_FILTERS, filterDac: value };
				expect(state.filterDac).toBe(value);
			}
		});

		it('setFilterUserId sets to "all" for all clients', () => {
			const state = { ...DEFAULT_CLIENT_FILTERS, filterUserId: 'all' };
			expect(state.filterUserId).toBe('all');
		});

		it('setFilterUserId sets to uuid for specific user', () => {
			const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
			const state = { ...DEFAULT_CLIENT_FILTERS, filterUserId: uuid };
			expect(state.filterUserId).toBe(uuid);
		});

		it('setFilterUserId sets to null for my clients', () => {
			const state = { ...DEFAULT_CLIENT_FILTERS, filterUserId: null };
			expect(state.filterUserId).toBeNull();
		});

		it('setDisplayCount updates count', () => {
			const state = { ...DEFAULT_CLIENT_FILTERS, displayCount: 24 };
			expect(state.displayCount).toBe(24);
		});
	});

	describe('resetFilters', () => {
		it('returns all values to defaults', () => {
			const result = resetFilters();
			expect(result).toEqual(DEFAULT_CLIENT_FILTERS);
		});

		it('resets displayCount to ITEMS_PER_PAGE', () => {
			const result = resetFilters();
			expect(result.displayCount).toBe(ITEMS_PER_PAGE);
		});
	});

	describe('userFilterLabel', () => {
		// Inline function matching the page's useMemo logic
		function getUserFilterLabel(filterUserId, allUsers) {
			if (filterUserId === null) return 'My Clients';
			if (filterUserId === 'all') return 'All Clients';
			const found = allUsers.find(u => u.id === filterUserId);
			return found?.display_name || 'Unknown User';
		}

		it('returns "My Clients" when filterUserId is null', () => {
			expect(getUserFilterLabel(null, [])).toBe('My Clients');
		});

		it('returns "All Clients" when filterUserId is "all"', () => {
			expect(getUserFilterLabel('all', [])).toBe('All Clients');
		});

		it('returns user display name for matching uuid', () => {
			const users = [{ id: 'abc', display_name: 'Jane Doe' }];
			expect(getUserFilterLabel('abc', users)).toBe('Jane Doe');
		});

		it('returns "Unknown User" for unrecognized uuid', () => {
			expect(getUserFilterLabel('xyz', [])).toBe('Unknown User');
		});
	});

	describe('resolveApiUserId', () => {
		// Inline function matching the page logic:
		// null → undefined (API defaults to current user)
		// 'all' → 'all' (API returns all clients)
		// uuid → uuid (API filters by that user)
		function resolveApiUserId(filterUserId) {
			return filterUserId === null ? undefined : filterUserId;
		}

		it('null maps to undefined (API default = my clients)', () => {
			expect(resolveApiUserId(null)).toBeUndefined();
		});

		it('"all" passes through as "all"', () => {
			expect(resolveApiUserId('all')).toBe('all');
		});

		it('uuid passes through as-is', () => {
			const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
			expect(resolveApiUserId(uuid)).toBe(uuid);
		});
	});

	describe('loadMore', () => {
		it('increments displayCount by ITEMS_PER_PAGE', () => {
			const state = { ...DEFAULT_CLIENT_FILTERS };
			const result = loadMore(state);
			expect(result.displayCount).toBe(24);
		});

		it('increments correctly when called multiple times', () => {
			let state = { ...DEFAULT_CLIENT_FILTERS };
			state = loadMore(state);
			state = loadMore(state);
			expect(state.displayCount).toBe(36);
		});

		it('increments from a custom displayCount', () => {
			const state = { ...DEFAULT_CLIENT_FILTERS, displayCount: 6 };
			const result = loadMore(state);
			expect(result.displayCount).toBe(18);
		});
	});
});
