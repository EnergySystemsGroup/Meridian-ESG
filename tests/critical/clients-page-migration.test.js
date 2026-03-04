import { describe, it, expect } from 'vitest';
import { clientMatches as mockClientMatches } from '../fixtures/clients.js';

// ---------------------------------------------------------------------------
// Inline pure functions replicating production logic from app/clients/page.jsx
// These MUST stay in sync with the production code.
// ---------------------------------------------------------------------------

const ITEMS_PER_PAGE = 12;

/**
 * Generates simple tags from client project_needs for search matching.
 * Simplified version of generateClientTags from lib/utils/clientMatching.
 */
function generateSimpleTags(client, matches) {
	return client.project_needs || [];
}

/**
 * Filter and sort client match results.
 * Mirrors the useMemo in ClientsPageContent.
 */
function filterAndSortClients(
	clientMatchesObj,
	{ searchQuery = '', filterTypes = [], filterStates = [], filterHasMatches = 'all', filterDac = 'all', sortBy = 'matchCount-desc' }
) {
	let result = Object.values(clientMatchesObj);

	// Search filter
	if (searchQuery) {
		const query = searchQuery.toLowerCase();
		result = result.filter(clientResult => {
			const client = clientResult.client;
			const tags = generateSimpleTags(client, clientResult.matches);
			return (
				client.name.toLowerCase().includes(query) ||
				client.type.toLowerCase().includes(query) ||
				(client.address && client.address.toLowerCase().includes(query)) ||
				(client.city && client.city.toLowerCase().includes(query)) ||
				(client.state_code && client.state_code.toLowerCase().includes(query)) ||
				(client.description && client.description.toLowerCase().includes(query)) ||
				(client.dac && 'dac'.includes(query)) ||
				tags.some(tag => tag.toLowerCase().includes(query)) ||
				(client.project_needs && client.project_needs.some(need => need.toLowerCase().includes(query)))
			);
		});
	}

	// Type filter
	if (filterTypes.length > 0) {
		result = result.filter(c => filterTypes.includes(c.client.type));
	}

	// State filter
	if (filterStates.length > 0) {
		result = result.filter(c => filterStates.includes(c.client.state_code));
	}

	// Has matches filter
	if (filterHasMatches === 'yes') {
		result = result.filter(c => c.matchCount > 0);
	} else if (filterHasMatches === 'no') {
		result = result.filter(c => c.matchCount === 0);
	}

	// DAC filter
	if (filterDac === 'yes') {
		result = result.filter(c => c.client.dac === true);
	} else if (filterDac === 'no') {
		result = result.filter(c => c.client.dac !== true);
	}

	// Sorting
	result.sort((a, b) => {
		switch (sortBy) {
			case 'matchCount-desc':
				return b.matchCount - a.matchCount;
			case 'matchCount-asc':
				return a.matchCount - b.matchCount;
			case 'name-asc':
				return a.client.name.localeCompare(b.client.name);
			case 'name-desc':
				return b.client.name.localeCompare(a.client.name);
			case 'location':
				const locA = `${a.client.state_code || ''}-${a.client.city || ''}`;
				const locB = `${b.client.state_code || ''}-${b.client.city || ''}`;
				return locA.localeCompare(locB);
			default:
				return b.matchCount - a.matchCount;
		}
	});

	return result;
}

/**
 * Compute active filter count.
 */
function getActiveFilterCount({ filterTypes = [], filterStates = [], filterHasMatches = 'all', filterDac = 'all' }) {
	return (
		filterTypes.length +
		filterStates.length +
		(filterHasMatches !== 'all' ? 1 : 0) +
		(filterDac !== 'all' ? 1 : 0)
	);
}

/**
 * Serialize filter state to URL params.
 * Mirrors updateURL callback behavior.
 */
function buildURLParams(updates, existingParams = '') {
	const params = new URLSearchParams(existingParams);
	Object.entries(updates).forEach(([key, value]) => {
		if (value === '' || value === 'all' || (Array.isArray(value) && value.length === 0)) {
			params.delete(key);
		} else if (Array.isArray(value)) {
			params.set(key, value.join(','));
		} else {
			params.set(key, value);
		}
	});
	return params.toString();
}

/**
 * Parse URL params to filter state.
 * Mirrors the URL initialization logic.
 */
function parseURLToFilters(searchParams) {
	return {
		searchQuery: searchParams.get('q') || '',
		sortBy: searchParams.get('sort') || 'matchCount-desc',
		filterTypes: searchParams.get('types')?.split(',').filter(Boolean) || [],
		filterStates: searchParams.get('states')?.split(',').filter(Boolean) || [],
		filterHasMatches: searchParams.get('hasMatches') || 'all',
		filterDac: searchParams.get('dac') || 'all',
	};
}

/**
 * Extract available filter options from client data.
 */
function getAvailableFilters(clientMatchesObj) {
	const clients = Object.values(clientMatchesObj);
	const types = [...new Set(clients.map(c => c.client.type).filter(Boolean))].sort();
	const states = [...new Set(clients.map(c => c.client.state_code).filter(Boolean))].sort();
	return { types, states };
}

// Test fixtures imported from tests/fixtures/clients.js

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Clients Page Migration Logic', () => {
	describe('filterAndSortClients', () => {
		describe('search filter', () => {
			it('filters by client name', () => {
				const result = filterAndSortClients(mockClientMatches, { searchQuery: 'san francisco' });
				expect(result).toHaveLength(1);
				expect(result[0].client.id).toBe('client-1');
			});

			it('filters by client type', () => {
				const result = filterAndSortClients(mockClientMatches, { searchQuery: 'commercial' });
				expect(result).toHaveLength(1);
				expect(result[0].client.id).toBe('client-2');
			});

			it('filters by state code', () => {
				const result = filterAndSortClients(mockClientMatches, { searchQuery: 'TX' });
				expect(result).toHaveLength(1);
				expect(result[0].client.id).toBe('client-2');
			});

			it('filters by project need', () => {
				const result = filterAndSortClients(mockClientMatches, { searchQuery: 'hvac' });
				expect(result).toHaveLength(2);
			});

			it('is case insensitive', () => {
				const result = filterAndSortClients(mockClientMatches, { searchQuery: 'OAKLAND' });
				expect(result).toHaveLength(1);
				expect(result[0].client.id).toBe('client-3');
			});

			it('returns all when search is empty', () => {
				const result = filterAndSortClients(mockClientMatches, { searchQuery: '' });
				expect(result).toHaveLength(4);
			});
		});

		describe('type filter', () => {
			it('filters by single type', () => {
				const result = filterAndSortClients(mockClientMatches, { filterTypes: ['School District'] });
				expect(result).toHaveLength(1);
				expect(result[0].client.id).toBe('client-3');
			});

			it('filters by multiple types', () => {
				const result = filterAndSortClients(mockClientMatches, { filterTypes: ['Municipal Government', 'School District'] });
				expect(result).toHaveLength(2);
			});

			it('returns all when filter is empty', () => {
				const result = filterAndSortClients(mockClientMatches, { filterTypes: [] });
				expect(result).toHaveLength(4);
			});
		});

		describe('state filter', () => {
			it('filters by single state', () => {
				const result = filterAndSortClients(mockClientMatches, { filterStates: ['TX'] });
				expect(result).toHaveLength(1);
				expect(result[0].client.id).toBe('client-2');
			});

			it('filters by multiple states', () => {
				const result = filterAndSortClients(mockClientMatches, { filterStates: ['CA'] });
				expect(result).toHaveLength(3);
			});
		});

		describe('has matches filter', () => {
			it('shows only clients with matches', () => {
				const result = filterAndSortClients(mockClientMatches, { filterHasMatches: 'yes' });
				expect(result).toHaveLength(3);
				expect(result.every(c => c.matchCount > 0)).toBe(true);
			});

			it('shows only clients without matches', () => {
				const result = filterAndSortClients(mockClientMatches, { filterHasMatches: 'no' });
				expect(result).toHaveLength(1);
				expect(result[0].client.id).toBe('client-3');
			});

			it('shows all when set to all', () => {
				const result = filterAndSortClients(mockClientMatches, { filterHasMatches: 'all' });
				expect(result).toHaveLength(4);
			});
		});

		describe('DAC filter', () => {
			it('shows only DAC clients', () => {
				const result = filterAndSortClients(mockClientMatches, { filterDac: 'yes' });
				expect(result).toHaveLength(2);
				expect(result.every(c => c.client.dac === true)).toBe(true);
			});

			it('shows only non-DAC clients', () => {
				const result = filterAndSortClients(mockClientMatches, { filterDac: 'no' });
				expect(result).toHaveLength(2);
				expect(result.every(c => c.client.dac !== true)).toBe(true);
			});
		});

		describe('combined filters', () => {
			it('applies search + type filter together', () => {
				const result = filterAndSortClients(mockClientMatches, {
					searchQuery: 'ca',
					filterTypes: ['Municipal Government'],
				});
				expect(result).toHaveLength(1);
				expect(result[0].client.id).toBe('client-1');
			});

			it('applies state + DAC filter together', () => {
				const result = filterAndSortClients(mockClientMatches, {
					filterStates: ['CA'],
					filterDac: 'yes',
				});
				expect(result).toHaveLength(2);
			});
		});

		describe('sorting', () => {
			it('sorts by match count descending (default)', () => {
				const result = filterAndSortClients(mockClientMatches, { sortBy: 'matchCount-desc' });
				expect(result[0].matchCount).toBe(8);
				expect(result[1].matchCount).toBe(5);
				expect(result[2].matchCount).toBe(2);
				expect(result[3].matchCount).toBe(0);
			});

			it('sorts by match count ascending', () => {
				const result = filterAndSortClients(mockClientMatches, { sortBy: 'matchCount-asc' });
				expect(result[0].matchCount).toBe(0);
				expect(result[3].matchCount).toBe(8);
			});

			it('sorts by name A-Z', () => {
				const result = filterAndSortClients(mockClientMatches, { sortBy: 'name-asc' });
				expect(result[0].client.name).toBe('City of San Francisco');
				expect(result[1].client.name).toBe('Green Foundation');
				expect(result[2].client.name).toBe('Oakland Schools');
				expect(result[3].client.name).toBe('Texas Energy Corp');
			});

			it('sorts by name Z-A', () => {
				const result = filterAndSortClients(mockClientMatches, { sortBy: 'name-desc' });
				expect(result[0].client.name).toBe('Texas Energy Corp');
				expect(result[3].client.name).toBe('City of San Francisco');
			});

			it('sorts by location', () => {
				const result = filterAndSortClients(mockClientMatches, { sortBy: 'location' });
				// CA-Oakland, CA-Sacramento, CA-San Francisco, TX-Houston
				expect(result[0].client.city).toBe('Oakland');
				expect(result[1].client.city).toBe('Sacramento');
				expect(result[2].client.city).toBe('San Francisco');
				expect(result[3].client.city).toBe('Houston');
			});
		});
	});

	describe('pagination', () => {
		it('slices to displayCount', () => {
			const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));
			const displayed = items.slice(0, ITEMS_PER_PAGE);
			expect(displayed).toHaveLength(12);
		});

		it('hasMore is true when more items exist', () => {
			const total = 25;
			const displayCount = ITEMS_PER_PAGE;
			expect(displayCount < total).toBe(true);
		});

		it('hasMore is false when all items shown', () => {
			const total = 10;
			const displayCount = ITEMS_PER_PAGE;
			expect(displayCount < total).toBe(false);
		});
	});

	describe('activeFilterCount', () => {
		it('returns 0 with no active filters', () => {
			expect(getActiveFilterCount({})).toBe(0);
		});

		it('counts type filters', () => {
			expect(getActiveFilterCount({ filterTypes: ['Municipal Government', 'School District'] })).toBe(2);
		});

		it('counts state filters', () => {
			expect(getActiveFilterCount({ filterStates: ['CA'] })).toBe(1);
		});

		it('counts hasMatches when not all', () => {
			expect(getActiveFilterCount({ filterHasMatches: 'yes' })).toBe(1);
		});

		it('counts DAC when not all', () => {
			expect(getActiveFilterCount({ filterDac: 'no' })).toBe(1);
		});

		it('sums all active filters', () => {
			expect(getActiveFilterCount({
				filterTypes: ['Municipal Government'],
				filterStates: ['CA', 'TX'],
				filterHasMatches: 'yes',
				filterDac: 'no',
			})).toBe(5);
		});
	});

	describe('URL serialization', () => {
		it('builds params from filter state', () => {
			const params = buildURLParams({ q: 'solar', sort: 'name-asc' });
			expect(params).toContain('q=solar');
			expect(params).toContain('sort=name-asc');
		});

		it('removes params with default values', () => {
			const params = buildURLParams({ q: '', hasMatches: 'all', types: [] });
			expect(params).toBe('');
		});

		it('joins arrays with commas', () => {
			const params = buildURLParams({ types: ['Municipal Government', 'School District'] });
			expect(params).toBe('types=Municipal+Government%2CSchool+District');
		});

		it('preserves existing params when adding new ones', () => {
			const params = buildURLParams({ sort: 'name-asc' }, 'q=solar');
			expect(params).toContain('q=solar');
			expect(params).toContain('sort=name-asc');
		});
	});

	describe('URL parsing', () => {
		it('parses search query', () => {
			const params = new URLSearchParams('q=solar');
			const filters = parseURLToFilters(params);
			expect(filters.searchQuery).toBe('solar');
		});

		it('parses sort option', () => {
			const params = new URLSearchParams('sort=name-asc');
			const filters = parseURLToFilters(params);
			expect(filters.sortBy).toBe('name-asc');
		});

		it('parses comma-separated types', () => {
			const params = new URLSearchParams('types=Municipal Government,School District');
			const filters = parseURLToFilters(params);
			expect(filters.filterTypes).toEqual(['Municipal Government', 'School District']);
		});

		it('uses defaults for missing params', () => {
			const params = new URLSearchParams('');
			const filters = parseURLToFilters(params);
			expect(filters.searchQuery).toBe('');
			expect(filters.sortBy).toBe('matchCount-desc');
			expect(filters.filterTypes).toEqual([]);
			expect(filters.filterStates).toEqual([]);
			expect(filters.filterHasMatches).toBe('all');
			expect(filters.filterDac).toBe('all');
		});
	});

	describe('availableFilters', () => {
		it('extracts unique types sorted alphabetically', () => {
			const { types } = getAvailableFilters(mockClientMatches);
			expect(types).toEqual(['Commercial Entity', 'Municipal Government', 'Non-Profit Organization', 'School District']);
		});

		it('extracts unique states sorted alphabetically', () => {
			const { states } = getAvailableFilters(mockClientMatches);
			expect(states).toEqual(['CA', 'TX']);
		});

		it('returns empty arrays for empty data', () => {
			const { types, states } = getAvailableFilters({});
			expect(types).toEqual([]);
			expect(states).toEqual([]);
		});
	});
});
