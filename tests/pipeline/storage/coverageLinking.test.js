/**
 * Pipeline: Coverage Area Linking Tests
 *
 * Tests the logic for linking opportunities to coverage areas:
 * - Matching opportunity to areas by state
 * - National opportunity coverage
 * - Preventing duplicate links
 * - Handling missing/unknown areas
 */

import { describe, test, expect } from 'vitest';
import { coverageAreas } from '../../fixtures/coverageAreas.js';

/**
 * Determine coverage areas for an opportunity
 */
function determineCoverageAreas(opportunity, allAreas) {
  if (opportunity.is_national) {
    // National = link to all state-level areas
    return allAreas
      .filter(a => a.kind === 'state')
      .map(a => a.id);
  }

  // Non-national: match by state codes mentioned
  const stateCodes = opportunity.state_codes || [];
  const matched = [];

  for (const stateCode of stateCodes) {
    const stateArea = allAreas.find(
      a => a.kind === 'state' && a.state_code === stateCode
    );
    if (stateArea) {
      matched.push(stateArea.id);
    }
  }

  // Also match by utility/county names if provided
  const areaNames = opportunity.coverage_area_names || [];
  for (const name of areaNames) {
    const matchedArea = allAreas.find(
      a => a.name.toLowerCase() === name.toLowerCase()
    );
    if (matchedArea && !matched.includes(matchedArea.id)) {
      matched.push(matchedArea.id);
    }
  }

  return matched;
}

/**
 * Build link records for opportunity_coverage_areas table
 */
function buildLinkRecords(opportunityId, coverageAreaIds) {
  return coverageAreaIds.map(areaId => ({
    opportunity_id: opportunityId,
    coverage_area_id: areaId,
  }));
}

/**
 * Deduplicate link records (prevent duplicate links)
 */
function deduplicateLinks(newLinks, existingLinks) {
  const existingSet = new Set(
    existingLinks.map(l => `${l.opportunity_id}:${l.coverage_area_id}`)
  );

  return newLinks.filter(link =>
    !existingSet.has(`${link.opportunity_id}:${link.coverage_area_id}`)
  );
}

/**
 * Summarize linking results
 */
function summarizeLinking(results) {
  return {
    totalOpportunities: results.length,
    totalLinksCreated: results.reduce((sum, r) => sum + r.linksCreated, 0),
    totalSkipped: results.reduce((sum, r) => sum + r.skipped, 0),
    noAreaMatches: results.filter(r => r.linksCreated === 0).length,
  };
}

const allAreas = Object.values(coverageAreas);

describe('Coverage Area Linking', () => {

  describe('Coverage Area Determination', () => {
    test('national opportunity links to all state areas', () => {
      const opp = { is_national: true };
      const areaIds = determineCoverageAreas(opp, allAreas);

      const stateAreas = allAreas.filter(a => a.kind === 'state');
      expect(areaIds).toHaveLength(stateAreas.length);
    });

    test('state-specific opportunity links to matching state', () => {
      const opp = { is_national: false, state_codes: ['CA'] };
      const areaIds = determineCoverageAreas(opp, allAreas);

      expect(areaIds.length).toBeGreaterThan(0);
      // CA state area has id 6 in fixture
      expect(areaIds).toContain(6);
    });

    test('matches by area name', () => {
      const opp = {
        is_national: false,
        state_codes: [],
        coverage_area_names: ['Pacific Gas & Electric'],
      };
      const areaIds = determineCoverageAreas(opp, allAreas);

      // PG&E has id 1 in fixture
      expect(areaIds).toContain(1);
    });

    test('case-insensitive name matching', () => {
      const opp = {
        is_national: false,
        state_codes: [],
        coverage_area_names: ['pacific gas & electric'],
      };
      const areaIds = determineCoverageAreas(opp, allAreas);

      // PG&E has id 1 in fixture
      expect(areaIds).toContain(1);
    });

    test('no duplicate IDs when matched by both state and name', () => {
      const opp = {
        is_national: false,
        state_codes: ['CA'],
        coverage_area_names: ['California'],
      };
      const areaIds = determineCoverageAreas(opp, allAreas);

      const uniqueIds = [...new Set(areaIds)];
      expect(areaIds).toHaveLength(uniqueIds.length);
    });

    test('returns empty for unknown state', () => {
      const opp = { is_national: false, state_codes: ['ZZ'] };
      const areaIds = determineCoverageAreas(opp, allAreas);
      expect(areaIds).toEqual([]);
    });

    test('returns empty for no matching info', () => {
      const opp = { is_national: false, state_codes: [], coverage_area_names: [] };
      const areaIds = determineCoverageAreas(opp, allAreas);
      expect(areaIds).toEqual([]);
    });
  });

  describe('Link Record Building', () => {
    test('creates link for each area ID', () => {
      const links = buildLinkRecords('opp-001', [1, 2, 3]);

      expect(links).toHaveLength(3);
      expect(links[0]).toEqual({ opportunity_id: 'opp-001', coverage_area_id: 1 });
      expect(links[1]).toEqual({ opportunity_id: 'opp-001', coverage_area_id: 2 });
    });

    test('empty area IDs produces empty links', () => {
      const links = buildLinkRecords('opp-001', []);
      expect(links).toEqual([]);
    });
  });

  describe('Link Deduplication', () => {
    test('removes already-existing links', () => {
      const newLinks = [
        { opportunity_id: 'opp-1', coverage_area_id: 1 },
        { opportunity_id: 'opp-1', coverage_area_id: 2 },
        { opportunity_id: 'opp-1', coverage_area_id: 3 },
      ];

      const existingLinks = [
        { opportunity_id: 'opp-1', coverage_area_id: 1 },
      ];

      const unique = deduplicateLinks(newLinks, existingLinks);
      expect(unique).toHaveLength(2);
      expect(unique.map(l => l.coverage_area_id)).toEqual([2, 3]);
    });

    test('returns all when no existing links', () => {
      const newLinks = [
        { opportunity_id: 'opp-1', coverage_area_id: 1 },
        { opportunity_id: 'opp-1', coverage_area_id: 2 },
      ];

      const unique = deduplicateLinks(newLinks, []);
      expect(unique).toHaveLength(2);
    });

    test('returns empty when all already exist', () => {
      const links = [{ opportunity_id: 'opp-1', coverage_area_id: 1 }];
      const unique = deduplicateLinks(links, links);
      expect(unique).toHaveLength(0);
    });
  });

  describe('Linking Summary', () => {
    test('summarizes linking results', () => {
      const results = [
        { opportunityId: 'opp-1', linksCreated: 3, skipped: 0 },
        { opportunityId: 'opp-2', linksCreated: 2, skipped: 1 },
        { opportunityId: 'opp-3', linksCreated: 0, skipped: 0 },
      ];

      const summary = summarizeLinking(results);

      expect(summary.totalOpportunities).toBe(3);
      expect(summary.totalLinksCreated).toBe(5);
      expect(summary.totalSkipped).toBe(1);
      expect(summary.noAreaMatches).toBe(1);
    });

    test('handles empty results', () => {
      const summary = summarizeLinking([]);
      expect(summary.totalOpportunities).toBe(0);
      expect(summary.totalLinksCreated).toBe(0);
    });
  });
});
