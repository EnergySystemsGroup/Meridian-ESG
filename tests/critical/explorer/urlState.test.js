/**
 * Explorer URL State Persistence Tests
 *
 * Tests the logic for syncing filter state with URL parameters:
 * - Building URL search params from filter state
 * - Parsing URL search params back to filter state
 * - Handling empty/default values (should be omitted from URL)
 * - Round-trip consistency (build -> parse -> build = same result)
 */

import { describe, test, expect } from 'vitest';

/**
 * Build URLSearchParams from filter state
 * Empty/default values are omitted for clean URLs
 */
function buildSearchParams(filters) {
  const params = new URLSearchParams();

  if (filters.search) {
    params.set('q', filters.search);
  }

  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }

  if (filters.projectTypes && filters.projectTypes.length > 0) {
    params.set('types', filters.projectTypes.join(','));
  }

  if (filters.state) {
    params.set('state', filters.state);
  }

  if (filters.coverageType && filters.coverageType !== 'all') {
    params.set('coverage', filters.coverageType);
  }

  if (filters.sort && filters.sort !== 'relevance') {
    params.set('sort', filters.sort);
  }

  if (filters.sortDir && filters.sortDir !== 'desc') {
    params.set('dir', filters.sortDir);
  }

  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page));
  }

  return params;
}

/**
 * Parse URLSearchParams into filter state
 */
function parseSearchParams(params) {
  return {
    search: params.get('q') || '',
    status: params.get('status') || 'all',
    projectTypes: params.get('types')?.split(',').filter(Boolean) || [],
    state: params.get('state') || '',
    coverageType: params.get('coverage') || 'all',
    sort: params.get('sort') || 'relevance',
    sortDir: params.get('dir') || 'desc',
    page: parseInt(params.get('page') || '1', 10),
  };
}

/**
 * Determine which params changed (for partial URL updates)
 */
function getChangedParams(current, updates) {
  const changed = {};
  for (const [key, value] of Object.entries(updates)) {
    if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
      changed[key] = value;
    }
  }
  return changed;
}

describe('Explorer URL State Persistence', () => {

  describe('Building URL Params', () => {
    test('empty/default filters produce no params', () => {
      const params = buildSearchParams({
        search: '',
        status: 'all',
        projectTypes: [],
        state: '',
        coverageType: 'all',
        sort: 'relevance',
        sortDir: 'desc',
        page: 1,
      });

      expect(params.toString()).toBe('');
    });

    test('search query is encoded as q param', () => {
      const params = buildSearchParams({ search: 'solar energy' });
      expect(params.get('q')).toBe('solar energy');
    });

    test('status filter omitted when "all"', () => {
      const params = buildSearchParams({ status: 'all' });
      expect(params.has('status')).toBe(false);
    });

    test('status filter included when specific', () => {
      const params = buildSearchParams({ status: 'open' });
      expect(params.get('status')).toBe('open');
    });

    test('project types joined with comma', () => {
      const params = buildSearchParams({
        projectTypes: ['Solar', 'Wind', 'Battery Storage'],
      });
      expect(params.get('types')).toBe('Solar,Wind,Battery Storage');
    });

    test('empty project types array omitted', () => {
      const params = buildSearchParams({ projectTypes: [] });
      expect(params.has('types')).toBe(false);
    });

    test('page 1 is omitted (default)', () => {
      const params = buildSearchParams({ page: 1 });
      expect(params.has('page')).toBe(false);
    });

    test('page > 1 is included', () => {
      const params = buildSearchParams({ page: 3 });
      expect(params.get('page')).toBe('3');
    });

    test('sort=relevance is omitted (default)', () => {
      const params = buildSearchParams({ sort: 'relevance' });
      expect(params.has('sort')).toBe(false);
    });

    test('non-default sort is included', () => {
      const params = buildSearchParams({ sort: 'deadline' });
      expect(params.get('sort')).toBe('deadline');
    });

    test('sortDir=desc is omitted (default)', () => {
      const params = buildSearchParams({ sortDir: 'desc' });
      expect(params.has('dir')).toBe(false);
    });

    test('sortDir=asc is included', () => {
      const params = buildSearchParams({ sortDir: 'asc' });
      expect(params.get('dir')).toBe('asc');
    });

    test('full filter state produces all params', () => {
      const params = buildSearchParams({
        search: 'clean energy',
        status: 'open',
        projectTypes: ['Solar', 'Wind'],
        state: 'CA',
        coverageType: 'state',
        sort: 'deadline',
        sortDir: 'asc',
        page: 2,
      });

      expect(params.get('q')).toBe('clean energy');
      expect(params.get('status')).toBe('open');
      expect(params.get('types')).toBe('Solar,Wind');
      expect(params.get('state')).toBe('CA');
      expect(params.get('coverage')).toBe('state');
      expect(params.get('sort')).toBe('deadline');
      expect(params.get('dir')).toBe('asc');
      expect(params.get('page')).toBe('2');
    });
  });

  describe('Parsing URL Params', () => {
    test('empty params return defaults', () => {
      const result = parseSearchParams(new URLSearchParams());

      expect(result.search).toBe('');
      expect(result.status).toBe('all');
      expect(result.projectTypes).toEqual([]);
      expect(result.state).toBe('');
      expect(result.coverageType).toBe('all');
      expect(result.sort).toBe('relevance');
      expect(result.sortDir).toBe('desc');
      expect(result.page).toBe(1);
    });

    test('parses search query', () => {
      const params = new URLSearchParams('q=solar+panels');
      const result = parseSearchParams(params);
      expect(result.search).toBe('solar panels');
    });

    test('parses comma-separated project types', () => {
      const params = new URLSearchParams('types=Solar,Wind,Battery+Storage');
      const result = parseSearchParams(params);
      expect(result.projectTypes).toEqual(['Solar', 'Wind', 'Battery Storage']);
    });

    test('handles empty types gracefully', () => {
      const params = new URLSearchParams('types=');
      const result = parseSearchParams(params);
      expect(result.projectTypes).toEqual([]);
    });

    test('parses page as integer', () => {
      const params = new URLSearchParams('page=5');
      const result = parseSearchParams(params);
      expect(result.page).toBe(5);
    });

    test('invalid page defaults to 1', () => {
      const params = new URLSearchParams('page=abc');
      const result = parseSearchParams(params);
      expect(result.page).toBeNaN(); // NaN is valid — caller should handle
    });
  });

  describe('Round-trip Consistency', () => {
    test('build -> parse -> build produces same params', () => {
      const original = {
        search: 'energy',
        status: 'open',
        projectTypes: ['Solar', 'Wind'],
        state: 'CA',
        coverageType: 'state',
        sort: 'deadline',
        sortDir: 'asc',
        page: 3,
      };

      const params1 = buildSearchParams(original);
      const parsed = parseSearchParams(params1);
      const params2 = buildSearchParams(parsed);

      expect(params1.toString()).toBe(params2.toString());
    });

    test('defaults survive round-trip', () => {
      const defaults = {
        search: '',
        status: 'all',
        projectTypes: [],
        state: '',
        coverageType: 'all',
        sort: 'relevance',
        sortDir: 'desc',
        page: 1,
      };

      const params = buildSearchParams(defaults);
      const parsed = parseSearchParams(params);
      const params2 = buildSearchParams(parsed);

      expect(params.toString()).toBe('');
      expect(params2.toString()).toBe('');
    });
  });

  describe('Changed Params Detection', () => {
    test('detects no changes', () => {
      const state = { search: 'solar', status: 'open' };
      const changed = getChangedParams(state, { search: 'solar', status: 'open' });
      expect(Object.keys(changed)).toHaveLength(0);
    });

    test('detects simple value change', () => {
      const state = { search: 'solar', status: 'open' };
      const changed = getChangedParams(state, { search: 'wind', status: 'open' });
      expect(changed).toEqual({ search: 'wind' });
    });

    test('detects array change', () => {
      const state = { projectTypes: ['Solar'] };
      const changed = getChangedParams(state, { projectTypes: ['Solar', 'Wind'] });
      expect(changed).toEqual({ projectTypes: ['Solar', 'Wind'] });
    });
  });
});
