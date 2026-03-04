/**
 * Map State Selection Tests
 *
 * Tests the drill-down logic for the US choropleth map:
 * - Clicking a state selects it (drill down to counties/utilities)
 * - Clicking the same state deselects (return to national view)
 * - Only one state can be selected at a time
 * - Selected state determines what sub-areas are shown
 */

import { describe, test, expect } from 'vitest';
import { coverageAreas } from '../../fixtures/coverageAreas.js';

/**
 * Handle state click - toggle selection
 */
function handleStateClick(currentSelection, clickedState) {
  if (currentSelection === clickedState) {
    return null; // Deselect
  }
  return clickedState; // Select new state
}

/**
 * Get sub-areas for a selected state
 */
function getSubAreasForState(stateCode, allAreas) {
  if (!stateCode) return [];
  return allAreas.filter(area =>
    area.state_code === stateCode && area.kind !== 'state'
  );
}

/**
 * Group sub-areas by kind (county, utility)
 */
function groupSubAreasByKind(subAreas) {
  const groups = { county: [], utility: [] };

  for (const area of subAreas) {
    if (area.kind === 'county') {
      groups.county.push(area);
    } else if (area.kind === 'utility') {
      groups.utility.push(area);
    }
  }

  return groups;
}

/**
 * Determine the view mode based on selection
 */
function getViewMode(selectedState) {
  return selectedState ? 'state-detail' : 'national';
}

/**
 * Get opportunities for selected state (including national)
 */
function getOpportunitiesForState(opps, stateCode, areasByState) {
  if (!stateCode) return opps; // Show all in national view

  const stateAreaIds = areasByState[stateCode] || [];

  return opps.filter(opp => {
    if (opp.is_national) return true;
    const oppAreas = opp.coverage_area_ids || [];
    return oppAreas.some(id => stateAreaIds.includes(id));
  });
}

const allAreas = Object.values(coverageAreas);

describe('Map State Selection', () => {

  describe('State Click Toggle', () => {
    test('clicking unselected state selects it', () => {
      const result = handleStateClick(null, 'CA');
      expect(result).toBe('CA');
    });

    test('clicking selected state deselects it', () => {
      const result = handleStateClick('CA', 'CA');
      expect(result).toBeNull();
    });

    test('clicking different state switches selection', () => {
      const result = handleStateClick('CA', 'TX');
      expect(result).toBe('TX');
    });

    test('clicking from null to state works', () => {
      expect(handleStateClick(null, 'NY')).toBe('NY');
    });

    test('multiple click sequence: select -> switch -> deselect', () => {
      let selected = null;
      selected = handleStateClick(selected, 'CA');
      expect(selected).toBe('CA');

      selected = handleStateClick(selected, 'TX');
      expect(selected).toBe('TX');

      selected = handleStateClick(selected, 'TX');
      expect(selected).toBeNull();
    });
  });

  describe('View Mode', () => {
    test('returns national when no state selected', () => {
      expect(getViewMode(null)).toBe('national');
    });

    test('returns state-detail when state selected', () => {
      expect(getViewMode('CA')).toBe('state-detail');
    });
  });

  describe('Sub-areas for State', () => {
    test('returns counties and utilities for CA', () => {
      const subAreas = getSubAreasForState('CA', allAreas);

      expect(subAreas.length).toBeGreaterThan(0);
      expect(subAreas.every(a => a.state_code === 'CA')).toBe(true);
      expect(subAreas.every(a => a.kind !== 'state')).toBe(true);
    });

    test('returns empty array when no state selected', () => {
      const subAreas = getSubAreasForState(null, allAreas);
      expect(subAreas).toEqual([]);
    });

    test('returns empty array for state with no sub-areas', () => {
      const subAreas = getSubAreasForState('ZZ', allAreas);
      expect(subAreas).toEqual([]);
    });

    test('excludes state-level areas from sub-areas', () => {
      const subAreas = getSubAreasForState('CA', allAreas);
      expect(subAreas.every(a => a.kind !== 'state')).toBe(true);
    });
  });

  describe('Group Sub-areas by Kind', () => {
    test('separates counties from utilities', () => {
      const subAreas = [
        { id: 1, name: 'PG&E', kind: 'utility', state_code: 'CA' },
        { id: 2, name: 'SF County', kind: 'county', state_code: 'CA' },
        { id: 3, name: 'SCE', kind: 'utility', state_code: 'CA' },
        { id: 4, name: 'LA County', kind: 'county', state_code: 'CA' },
      ];

      const groups = groupSubAreasByKind(subAreas);

      expect(groups.utility).toHaveLength(2);
      expect(groups.county).toHaveLength(2);
    });

    test('handles empty input', () => {
      const groups = groupSubAreasByKind([]);
      expect(groups.utility).toEqual([]);
      expect(groups.county).toEqual([]);
    });

    test('handles all utilities', () => {
      const subAreas = [
        { id: 1, kind: 'utility' },
        { id: 2, kind: 'utility' },
      ];
      const groups = groupSubAreasByKind(subAreas);
      expect(groups.utility).toHaveLength(2);
      expect(groups.county).toHaveLength(0);
    });
  });

  describe('Opportunities for State', () => {
    const testOpps = [
      { id: 'opp-1', is_national: true, coverage_area_ids: [] },
      { id: 'opp-2', is_national: false, coverage_area_ids: [1, 2] }, // CA areas
      { id: 'opp-3', is_national: false, coverage_area_ids: [10, 11] }, // TX areas
      { id: 'opp-4', is_national: false, coverage_area_ids: [1] }, // CA only
    ];

    const areasByState = {
      CA: [1, 2, 3, 4, 5, 6],
      TX: [10, 11, 12],
    };

    test('national view returns all opportunities', () => {
      const result = getOpportunitiesForState(testOpps, null, areasByState);
      expect(result).toHaveLength(4);
    });

    test('state view includes national + state-specific opps', () => {
      const result = getOpportunitiesForState(testOpps, 'CA', areasByState);
      expect(result).toHaveLength(3); // national + 2 CA opps
      expect(result.map(o => o.id)).toContain('opp-1');
      expect(result.map(o => o.id)).toContain('opp-2');
      expect(result.map(o => o.id)).toContain('opp-4');
    });

    test('state view excludes opps from other states', () => {
      const result = getOpportunitiesForState(testOpps, 'TX', areasByState);
      expect(result).toHaveLength(2); // national + TX opp
      expect(result.map(o => o.id)).not.toContain('opp-2');
      expect(result.map(o => o.id)).not.toContain('opp-4');
    });

    test('unknown state returns only national opps', () => {
      const result = getOpportunitiesForState(testOpps, 'ZZ', areasByState);
      expect(result).toHaveLength(1);
      expect(result[0].is_national).toBe(true);
    });
  });
});
