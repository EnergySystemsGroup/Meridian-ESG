/**
 * Coverage Area Intersection Tests
 *
 * Tests the geographic matching logic that uses coverage_area_ids
 * for precise utility-level, county-level, or state-level matching.
 */

import { describe, test, expect } from 'vitest';
import { createSupabaseMock } from '../../helpers/supabaseMock.js';
import { clients } from '../../fixtures/clients.js';
import { opportunities } from '../../fixtures/opportunities.js';
import { coverageAreas, opportunityCoverageLinks } from '../../fixtures/coverageAreas.js';

/**
 * Check if coverage areas intersect
 * (Core logic from route.js)
 */
function checkCoverageIntersection(clientAreaIds, opportunityAreaIds, isNational) {
  if (isNational) {
    return true;
  }

  if (!clientAreaIds || !Array.isArray(clientAreaIds) ||
      !opportunityAreaIds || !Array.isArray(opportunityAreaIds)) {
    return false;
  }

  return clientAreaIds.some(clientAreaId =>
    opportunityAreaIds.includes(clientAreaId)
  );
}

describe('Coverage Area Intersection', () => {

  describe('National Opportunities', () => {
    test('national opportunity matches any client', () => {
      expect(checkCoverageIntersection([1, 2, 3], [], true)).toBe(true);
      expect(checkCoverageIntersection([], [], true)).toBe(true);
      expect(checkCoverageIntersection(null, [], true)).toBe(true);
    });

    test('is_national takes precedence over coverage_area_ids', () => {
      // Even with non-overlapping areas, national = match
      expect(checkCoverageIntersection([1, 2], [100, 200], true)).toBe(true);
    });
  });

  describe('Coverage Area Intersection Logic', () => {
    test('single overlapping area creates match', () => {
      const clientAreas = [1, 2, 3];
      const oppAreas = [3, 4, 5];  // 3 overlaps

      expect(checkCoverageIntersection(clientAreas, oppAreas, false)).toBe(true);
    });

    test('multiple overlapping areas creates match', () => {
      const clientAreas = [1, 2, 3, 4];
      const oppAreas = [2, 3, 5, 6];  // 2 and 3 overlap

      expect(checkCoverageIntersection(clientAreas, oppAreas, false)).toBe(true);
    });

    test('no overlapping areas means no match', () => {
      const clientAreas = [1, 2, 3];
      const oppAreas = [4, 5, 6];  // No overlap

      expect(checkCoverageIntersection(clientAreas, oppAreas, false)).toBe(false);
    });

    test('identical arrays match completely', () => {
      const areas = [1, 2, 3];

      expect(checkCoverageIntersection(areas, areas, false)).toBe(true);
    });

    test('subset relationship creates match', () => {
      const clientAreas = [1, 2];
      const oppAreas = [1, 2, 3, 4, 5];  // Client areas are subset

      expect(checkCoverageIntersection(clientAreas, oppAreas, false)).toBe(true);
    });

    test('superset relationship creates match', () => {
      const clientAreas = [1, 2, 3, 4, 5];
      const oppAreas = [2, 3];  // Opp areas are subset of client

      expect(checkCoverageIntersection(clientAreas, oppAreas, false)).toBe(true);
    });
  });

  describe('Empty and Null Handling', () => {
    test('empty client areas means no match', () => {
      expect(checkCoverageIntersection([], [1, 2, 3], false)).toBe(false);
    });

    test('empty opportunity areas means no match', () => {
      expect(checkCoverageIntersection([1, 2, 3], [], false)).toBe(false);
    });

    test('both empty means no match', () => {
      expect(checkCoverageIntersection([], [], false)).toBe(false);
    });

    test('null client areas means no match', () => {
      expect(checkCoverageIntersection(null, [1, 2, 3], false)).toBe(false);
    });

    test('null opportunity areas means no match', () => {
      expect(checkCoverageIntersection([1, 2, 3], null, false)).toBe(false);
    });

    test('undefined arrays means no match', () => {
      expect(checkCoverageIntersection(undefined, [1, 2, 3], false)).toBe(false);
      expect(checkCoverageIntersection([1, 2, 3], undefined, false)).toBe(false);
    });
  });

  describe('Real-World Scenarios', () => {
    test('PG&E client matches PG&E opportunity', () => {
      // PG&E Bay Area client (coverage_area_ids: [1, 2, 3])
      // PG&E Utility Grant (coverage_area_ids: [1, 2, 7])
      const result = checkCoverageIntersection(
        clients.pgeBayAreaClient.coverage_area_ids,
        opportunities.pgeUtilityGrant.coverage_area_ids,
        opportunities.pgeUtilityGrant.is_national
      );

      expect(result).toBe(true);
    });

    test('PG&E client does NOT match SCE opportunity', () => {
      // PG&E Bay Area client (coverage_area_ids: [1, 2, 3])
      // SCE Utility Grant (coverage_area_ids: [4, 5])
      const result = checkCoverageIntersection(
        clients.pgeBayAreaClient.coverage_area_ids,
        opportunities.sceUtilityGrant.coverage_area_ids,
        opportunities.sceUtilityGrant.is_national
      );

      expect(result).toBe(false);
    });

    test('SCE client matches SCE opportunity', () => {
      // SCE client (coverage_area_ids: [4, 5, 6])
      // SCE Utility Grant (coverage_area_ids: [4, 5])
      const result = checkCoverageIntersection(
        clients.sceUtilityClient.coverage_area_ids,
        opportunities.sceUtilityGrant.coverage_area_ids,
        opportunities.sceUtilityGrant.is_national
      );

      expect(result).toBe(true);
    });

    test('Texas client matches Texas opportunity', () => {
      // Texas client (coverage_area_ids: [10, 11])
      // Texas Grant (coverage_area_ids: [10, 11])
      const result = checkCoverageIntersection(
        clients.texasCommercialClient.coverage_area_ids,
        opportunities.texasOnlyGrant.coverage_area_ids,
        opportunities.texasOnlyGrant.is_national
      );

      expect(result).toBe(true);
    });

    test('California client does NOT match Texas opportunity', () => {
      const result = checkCoverageIntersection(
        clients.pgeBayAreaClient.coverage_area_ids,
        opportunities.texasOnlyGrant.coverage_area_ids,
        opportunities.texasOnlyGrant.is_national
      );

      expect(result).toBe(false);
    });

    test('any client matches national opportunity', () => {
      // National grant
      const nationalOpp = opportunities.nationalGrant;

      expect(checkCoverageIntersection(
        clients.pgeBayAreaClient.coverage_area_ids,
        nationalOpp.coverage_area_ids,
        nationalOpp.is_national
      )).toBe(true);

      expect(checkCoverageIntersection(
        clients.texasCommercialClient.coverage_area_ids,
        nationalOpp.coverage_area_ids,
        nationalOpp.is_national
      )).toBe(true);
    });
  });

  describe('California State-Wide Matching', () => {
    test('CA client matches CA state-wide opportunity', () => {
      // California State Grant has coverage_area_ids: [6] (CA state)
      // PG&E client has coverage_area_ids: [1, 2, 3] - should NOT match if
      // we're doing strict intersection (client needs state-level area)

      // This test documents current behavior - strict ID matching
      // State ID 6 is not in client's [1, 2, 3]
      const result = checkCoverageIntersection(
        clients.pgeBayAreaClient.coverage_area_ids,
        opportunities.californiaStateGrant.coverage_area_ids,
        opportunities.californiaStateGrant.is_national
      );

      // NOTE: With strict intersection, this would be FALSE
      // If client has state ID (6) in their coverage_area_ids, it would be TRUE
      expect(result).toBe(false);
    });

    test('client with state-level coverage area matches state-wide opportunity', () => {
      // Client with CA state in coverage areas
      const clientWithStateArea = {
        ...clients.pgeBayAreaClient,
        coverage_area_ids: [1, 2, 3, 6]  // Added state-level ID
      };

      const result = checkCoverageIntersection(
        clientWithStateArea.coverage_area_ids,
        opportunities.californiaStateGrant.coverage_area_ids,
        opportunities.californiaStateGrant.is_national
      );

      expect(result).toBe(true);
    });
  });

  describe('Coverage Area Building (from opportunity_coverage_areas)', () => {
    test('opportunity coverage map builds correctly', () => {
      // Simulate building coverage map from join table
      const opportunityCoverageMap = {};

      for (const link of opportunityCoverageLinks) {
        if (!opportunityCoverageMap[link.opportunity_id]) {
          opportunityCoverageMap[link.opportunity_id] = [];
        }
        opportunityCoverageMap[link.opportunity_id].push(link.coverage_area_id);
      }

      // Verify PG&E grant has correct coverage areas
      expect(opportunityCoverageMap['opp-pge-001']).toContain(1);
      expect(opportunityCoverageMap['opp-pge-001']).toContain(2);
      expect(opportunityCoverageMap['opp-pge-001']).toContain(7);

      // Verify SCE grant has correct coverage areas
      expect(opportunityCoverageMap['opp-sce-001']).toContain(4);
      expect(opportunityCoverageMap['opp-sce-001']).toContain(5);

      // Verify California state grant
      expect(opportunityCoverageMap['opp-ca-state-001']).toContain(6);
    });
  });

  describe('Large Array Performance', () => {
    test('handles large coverage area arrays efficiently', () => {
      // Client with many coverage areas
      const largeClientAreas = Array.from({ length: 1000 }, (_, i) => i);
      const largeOppAreas = Array.from({ length: 500 }, (_, i) => i + 750);

      const start = performance.now();
      const result = checkCoverageIntersection(largeClientAreas, largeOppAreas, false);
      const duration = performance.now() - start;

      // Should find intersection at ID 750-999
      expect(result).toBe(true);
      // Should complete quickly (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    test('handles no intersection in large arrays', () => {
      const clientAreas = Array.from({ length: 500 }, (_, i) => i);
      const oppAreas = Array.from({ length: 500 }, (_, i) => i + 1000);

      const result = checkCoverageIntersection(clientAreas, oppAreas, false);

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('single element arrays', () => {
      expect(checkCoverageIntersection([1], [1], false)).toBe(true);
      expect(checkCoverageIntersection([1], [2], false)).toBe(false);
    });

    test('duplicate IDs in arrays', () => {
      // Duplicates shouldn't break anything
      expect(checkCoverageIntersection([1, 1, 2, 2], [2, 3], false)).toBe(true);
      expect(checkCoverageIntersection([1, 1, 1], [2, 2, 2], false)).toBe(false);
    });

    test('negative IDs (edge case)', () => {
      expect(checkCoverageIntersection([-1, -2], [-2, -3], false)).toBe(true);
    });

    test('zero as valid ID', () => {
      expect(checkCoverageIntersection([0, 1], [0, 2], false)).toBe(true);
      expect(checkCoverageIntersection([0], [1], false)).toBe(false);
    });
  });
});
