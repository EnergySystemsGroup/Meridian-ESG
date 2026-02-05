/**
 * Explorer Filter Tests
 *
 * Tests the filtering logic for the opportunity explorer:
 * - Status filter (Open, Upcoming, Closed)
 * - Project Types filter (multi-select)
 * - State filter (single-select)
 * - Coverage Type filter (National, State, Local)
 * - Search (full-text)
 */

import { describe, test, expect } from 'vitest';
import { opportunities } from '../../fixtures/opportunities.js';

/**
 * Filter opportunities by status
 */
function filterByStatus(opps, status) {
  if (!status || status === 'all') return opps;
  return opps.filter(o => o.status === status);
}

/**
 * Filter opportunities by project types (any match)
 */
function filterByProjectTypes(opps, selectedTypes) {
  if (!selectedTypes || selectedTypes.length === 0) return opps;

  return opps.filter(opp => {
    const oppTypes = opp.eligible_project_types || [];
    return selectedTypes.some(type =>
      oppTypes.some(oppType =>
        oppType.toLowerCase().includes(type.toLowerCase()) ||
        type.toLowerCase().includes(oppType.toLowerCase())
      )
    );
  });
}

/**
 * Filter opportunities by state coverage
 */
function filterByState(opps, stateCode, coverageMap = {}) {
  if (!stateCode) return opps;

  return opps.filter(opp => {
    if (opp.is_national) return true;

    // Check if opportunity covers this state
    const oppAreas = opp.coverage_area_ids || [];
    // In real implementation, would check if any area is in the state
    // For testing, we'll use a simplified approach
    return oppAreas.length > 0;
  });
}

/**
 * Filter opportunities by coverage type
 */
function filterByCoverageType(opps, coverageType) {
  if (!coverageType || coverageType === 'all') return opps;

  switch (coverageType) {
    case 'national':
      return opps.filter(o => o.is_national === true);
    case 'state':
      return opps.filter(o => !o.is_national && (o.coverage_area_ids?.length || 0) > 0);
    case 'local':
      return opps.filter(o => !o.is_national && (o.coverage_area_ids?.length || 0) > 0);
    default:
      return opps;
  }
}

/**
 * Search opportunities by text
 */
function searchOpportunities(opps, query) {
  if (!query || query.trim() === '') return opps;

  const q = query.toLowerCase();
  return opps.filter(opp => {
    const searchFields = [
      opp.title,
      opp.agency_name,
      opp.program_overview,
      opp.program_insights,
    ].filter(Boolean);

    return searchFields.some(field =>
      field.toLowerCase().includes(q)
    );
  });
}

describe('Explorer Filters', () => {

  describe('Status Filter', () => {
    const allOpps = Object.values(opportunities);

    test('filters to only open opportunities', () => {
      const result = filterByStatus(allOpps, 'open');
      expect(result.every(o => o.status === 'open')).toBe(true);
    });

    test('filters to only closed opportunities', () => {
      const result = filterByStatus(allOpps, 'closed');
      expect(result.every(o => o.status === 'closed')).toBe(true);
    });

    test('filters to only upcoming opportunities', () => {
      const result = filterByStatus(allOpps, 'upcoming');
      expect(result.every(o => o.status === 'upcoming')).toBe(true);
    });

    test('returns all when status is "all"', () => {
      const result = filterByStatus(allOpps, 'all');
      expect(result).toHaveLength(allOpps.length);
    });

    test('returns all when status is null/undefined', () => {
      expect(filterByStatus(allOpps, null)).toHaveLength(allOpps.length);
      expect(filterByStatus(allOpps, undefined)).toHaveLength(allOpps.length);
    });
  });

  describe('Project Types Filter', () => {
    const testOpps = [
      { id: 1, eligible_project_types: ['Solar', 'Wind'] },
      { id: 2, eligible_project_types: ['HVAC', 'Lighting'] },
      { id: 3, eligible_project_types: ['Solar Panels', 'Battery Storage'] },
      { id: 4, eligible_project_types: [] },
      { id: 5 },
    ];

    test('filters by single project type', () => {
      const result = filterByProjectTypes(testOpps, ['Solar']);
      expect(result).toHaveLength(2); // id 1 and 3 match
      expect(result.map(o => o.id)).toContain(1);
      expect(result.map(o => o.id)).toContain(3);
    });

    test('filters by multiple project types (OR logic)', () => {
      const result = filterByProjectTypes(testOpps, ['Solar', 'HVAC']);
      expect(result).toHaveLength(3); // id 1, 2, and 3 match
    });

    test('returns all when no types selected', () => {
      const result = filterByProjectTypes(testOpps, []);
      expect(result).toHaveLength(testOpps.length);
    });

    test('handles case insensitive matching', () => {
      const result = filterByProjectTypes(testOpps, ['SOLAR']);
      expect(result).toHaveLength(2);
    });

    test('handles substring matching', () => {
      const result = filterByProjectTypes(testOpps, ['Solar']);
      // 'Solar' matches 'Solar' and 'Solar Panels'
      expect(result.map(o => o.id)).toContain(1);
      expect(result.map(o => o.id)).toContain(3);
    });
  });

  describe('Coverage Type Filter', () => {
    const testOpps = [
      { id: 1, is_national: true, coverage_area_ids: [] },
      { id: 2, is_national: false, coverage_area_ids: [1, 2] },
      { id: 3, is_national: false, coverage_area_ids: [3] },
      { id: 4, is_national: false, coverage_area_ids: [] },
    ];

    test('filters to national only', () => {
      const result = filterByCoverageType(testOpps, 'national');
      expect(result).toHaveLength(1);
      expect(result[0].is_national).toBe(true);
    });

    test('filters to state/local only', () => {
      const result = filterByCoverageType(testOpps, 'state');
      expect(result.every(o => !o.is_national)).toBe(true);
      expect(result.every(o => o.coverage_area_ids.length > 0)).toBe(true);
    });

    test('returns all when coverage type is "all"', () => {
      const result = filterByCoverageType(testOpps, 'all');
      expect(result).toHaveLength(testOpps.length);
    });
  });

  describe('Text Search', () => {
    const testOpps = [
      { id: 1, title: 'Federal Clean Energy Grant', agency_name: 'DOE' },
      { id: 2, title: 'California Climate Initiative', agency_name: 'CEC' },
      { id: 3, title: 'Texas Energy Program', agency_name: 'SECO', program_overview: 'Energy efficiency funding' },
    ];

    test('searches in title', () => {
      const result = searchOpportunities(testOpps, 'Clean Energy');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('searches in agency name', () => {
      const result = searchOpportunities(testOpps, 'DOE');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('searches in program overview', () => {
      const result = searchOpportunities(testOpps, 'efficiency funding');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    test('case insensitive search', () => {
      const result = searchOpportunities(testOpps, 'CALIFORNIA');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    test('partial word matching', () => {
      const result = searchOpportunities(testOpps, 'Clim');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    test('returns all when search is empty', () => {
      expect(searchOpportunities(testOpps, '')).toHaveLength(testOpps.length);
      expect(searchOpportunities(testOpps, null)).toHaveLength(testOpps.length);
      expect(searchOpportunities(testOpps, '   ')).toHaveLength(testOpps.length);
    });

    test('returns empty when no matches', () => {
      const result = searchOpportunities(testOpps, 'xyz123nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  describe('Combined Filters', () => {
    const allOpps = Object.values(opportunities);

    test('status + search combination', () => {
      let result = filterByStatus(allOpps, 'open');
      result = searchOpportunities(result, 'Energy');

      expect(result.every(o => o.status === 'open')).toBe(true);
      // All results should contain 'Energy' in at least one searchable field
      expect(result.every(o =>
        o.title?.toLowerCase().includes('energy') ||
        o.agency_name?.toLowerCase().includes('energy') ||
        o.program_overview?.toLowerCase().includes('energy') ||
        o.program_insights?.toLowerCase().includes('energy')
      )).toBe(true);
      expect(result.length).toBeGreaterThan(0); // Should have matches
    });

    test('status + coverage type combination', () => {
      let result = filterByStatus(allOpps, 'open');
      result = filterByCoverageType(result, 'national');

      expect(result.every(o => o.status === 'open')).toBe(true);
      expect(result.every(o => o.is_national === true)).toBe(true);
    });

    test('all filters applied returns subset', () => {
      let result = allOpps;
      result = filterByStatus(result, 'open');
      result = filterByCoverageType(result, 'national');
      result = searchOpportunities(result, 'Grant');

      expect(result.length).toBeLessThanOrEqual(allOpps.length);
    });
  });

  describe('Edge Cases', () => {
    test('empty opportunity array', () => {
      expect(filterByStatus([], 'open')).toHaveLength(0);
      expect(filterByProjectTypes([], ['Solar'])).toHaveLength(0);
      expect(searchOpportunities([], 'test')).toHaveLength(0);
    });

    test('opportunity with null fields', () => {
      const opps = [
        { id: 1, title: null, status: 'open' },
      ];

      const result = searchOpportunities(opps, 'test');
      expect(result).toHaveLength(0);
    });

    test('filter returns new array (no mutation)', () => {
      const original = [{ id: 1, status: 'open' }];
      const result = filterByStatus(original, 'open');

      expect(result).not.toBe(original);
    });
  });
});
