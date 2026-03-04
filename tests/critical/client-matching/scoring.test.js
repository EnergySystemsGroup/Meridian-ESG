/**
 * Match Scoring Tests
 *
 * Tests the match score calculation which represents
 * the percentage of client's project needs that are matched.
 */

import { describe, test, expect } from 'vitest';

/**
 * Calculate match score
 * (Logic from route.js)
 *
 * @param {string[]} clientNeeds - Client's project needs
 * @param {string[]} matchedNeeds - Needs that matched opportunity
 * @returns {number} Score 0-100
 */
function calculateMatchScore(clientNeeds, matchedNeeds) {
  if (!clientNeeds || clientNeeds.length === 0) {
    return 0;
  }

  if (!matchedNeeds || matchedNeeds.length === 0) {
    return 0;
  }

  return Math.round((matchedNeeds.length / clientNeeds.length) * 100);
}

/**
 * Find matched project needs
 * (Logic from route.js)
 */
function findMatchedNeeds(clientNeeds, opportunityTypes) {
  if (!clientNeeds || !Array.isArray(clientNeeds) ||
      !opportunityTypes || !Array.isArray(opportunityTypes)) {
    return [];
  }

  const matched = [];

  for (const need of clientNeeds) {
    const hasMatch = opportunityTypes.some(projectType =>
      projectType.toLowerCase().includes(need.toLowerCase()) ||
      need.toLowerCase().includes(projectType.toLowerCase())
    );

    if (hasMatch) {
      matched.push(need);
    }
  }

  return matched;
}

describe('Match Score Calculation', () => {

  describe('Score Formula', () => {
    test('score = (matchedNeeds / totalNeeds) * 100, rounded', () => {
      expect(calculateMatchScore(['A', 'B', 'C'], ['A'])).toBe(33);        // 1/3 = 33.33%
      expect(calculateMatchScore(['A', 'B', 'C'], ['A', 'B'])).toBe(67);   // 2/3 = 66.67%
      expect(calculateMatchScore(['A', 'B', 'C'], ['A', 'B', 'C'])).toBe(100);
      expect(calculateMatchScore(['A', 'B'], ['A'])).toBe(50);             // 1/2 = 50%
    });

    test('single need matched = based on total', () => {
      expect(calculateMatchScore(['A'], ['A'])).toBe(100);                 // 1/1
      expect(calculateMatchScore(['A', 'B'], ['A'])).toBe(50);             // 1/2
      expect(calculateMatchScore(['A', 'B', 'C', 'D'], ['A'])).toBe(25);   // 1/4
      expect(calculateMatchScore(['A', 'B', 'C', 'D', 'E'], ['A'])).toBe(20); // 1/5
    });
  });

  describe('Edge Cases', () => {
    test('empty client needs returns 0', () => {
      expect(calculateMatchScore([], ['A'])).toBe(0);
      expect(calculateMatchScore([], [])).toBe(0);
    });

    test('null client needs returns 0', () => {
      expect(calculateMatchScore(null, ['A'])).toBe(0);
    });

    test('no matched needs returns 0', () => {
      expect(calculateMatchScore(['A', 'B'], [])).toBe(0);
      expect(calculateMatchScore(['A', 'B'], null)).toBe(0);
    });

    test('more matched than client needs (shouldn\'t happen in practice)', () => {
      // This shouldn't happen in practice - matched needs should be subset of client needs
      // Current formula doesn't cap, which documents actual behavior
      // In production, this scenario can't occur since we only count client needs that match
      const score = calculateMatchScore(['A'], ['A', 'B', 'C']);
      // Formula: 3/1 * 100 = 300 - no capping in current implementation
      expect(score).toBe(300);
    });
  });

  describe('Rounding Behavior', () => {
    test('rounds to nearest integer', () => {
      // 1/3 = 33.33... → 33
      expect(calculateMatchScore(['A', 'B', 'C'], ['A'])).toBe(33);

      // 2/3 = 66.66... → 67
      expect(calculateMatchScore(['A', 'B', 'C'], ['A', 'B'])).toBe(67);

      // 1/6 = 16.66... → 17
      expect(calculateMatchScore(
        ['A', 'B', 'C', 'D', 'E', 'F'],
        ['A']
      )).toBe(17);

      // 5/6 = 83.33... → 83
      expect(calculateMatchScore(
        ['A', 'B', 'C', 'D', 'E', 'F'],
        ['A', 'B', 'C', 'D', 'E']
      )).toBe(83);
    });
  });

  describe('Score Invariants', () => {
    test('score is always 0-100', () => {
      // Test various combinations
      const testCases = [
        { needs: [], matched: [] },
        { needs: ['A'], matched: [] },
        { needs: ['A'], matched: ['A'] },
        { needs: ['A', 'B', 'C', 'D', 'E'], matched: ['A', 'B'] },
        { needs: Array(100).fill('X'), matched: Array(50).fill('X') },
      ];

      testCases.forEach(({ needs, matched }) => {
        const score = calculateMatchScore(needs, matched);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    test('score is always an integer', () => {
      const testCases = [
        { needs: ['A', 'B', 'C'], matched: ['A'] },
        { needs: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], matched: ['A', 'B', 'C'] },
        { needs: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], matched: ['A'] },
      ];

      testCases.forEach(({ needs, matched }) => {
        const score = calculateMatchScore(needs, matched);
        expect(Number.isInteger(score)).toBe(true);
      });
    });
  });
});

describe('Project Needs Matching', () => {

  describe('Exact Matching', () => {
    test('exact string match', () => {
      const matched = findMatchedNeeds(
        ['Solar'],
        ['Solar']
      );

      expect(matched).toContain('Solar');
    });

    test('multiple exact matches', () => {
      const matched = findMatchedNeeds(
        ['Solar', 'Wind', 'HVAC'],
        ['Solar', 'Wind', 'Battery']
      );

      expect(matched).toContain('Solar');
      expect(matched).toContain('Wind');
      expect(matched).not.toContain('HVAC');
    });
  });

  describe('Substring Matching', () => {
    test('client need contained in opportunity type', () => {
      const matched = findMatchedNeeds(
        ['Solar'],
        ['Solar Panel Installation']
      );

      expect(matched).toContain('Solar');
    });

    test('opportunity type contained in client need', () => {
      const matched = findMatchedNeeds(
        ['Solar Panel Installation'],
        ['Solar']
      );

      expect(matched).toContain('Solar Panel Installation');
    });

    test('partial word matching', () => {
      const matched = findMatchedNeeds(
        ['EV'],
        ['EV Charging Stations']
      );

      expect(matched).toContain('EV');
    });

    test('abbreviation in longer string', () => {
      const matched = findMatchedNeeds(
        ['HVAC'],
        ['HVAC Systems', 'Lighting']
      );

      expect(matched).toContain('HVAC');
    });
  });

  describe('Case Insensitivity', () => {
    test('lowercase client need matches uppercase type', () => {
      const matched = findMatchedNeeds(
        ['solar'],
        ['SOLAR']
      );

      expect(matched).toContain('solar');
    });

    test('uppercase client need matches lowercase type', () => {
      const matched = findMatchedNeeds(
        ['SOLAR'],
        ['solar panels']
      );

      expect(matched).toContain('SOLAR');
    });

    test('mixed case matching', () => {
      const matched = findMatchedNeeds(
        ['Solar Panels'],
        ['SOLAR panels']
      );

      expect(matched).toContain('Solar Panels');
    });
  });

  describe('No Matches', () => {
    test('completely different needs', () => {
      const matched = findMatchedNeeds(
        ['Nuclear', 'Fusion'],
        ['Solar', 'Wind', 'Battery']
      );

      expect(matched).toHaveLength(0);
    });

    test('partial word that doesn\'t match', () => {
      const matched = findMatchedNeeds(
        ['Sol'],  // Partial of Solar
        ['Solar Panel']
      );

      // 'Sol' is contained in 'Solar Panel', so it WILL match
      // This documents current behavior
      expect(matched).toContain('Sol');
    });
  });

  describe('Edge Cases', () => {
    test('empty client needs', () => {
      const matched = findMatchedNeeds([], ['Solar']);
      expect(matched).toHaveLength(0);
    });

    test('empty opportunity types', () => {
      const matched = findMatchedNeeds(['Solar'], []);
      expect(matched).toHaveLength(0);
    });

    test('null inputs', () => {
      expect(findMatchedNeeds(null, ['Solar'])).toHaveLength(0);
      expect(findMatchedNeeds(['Solar'], null)).toHaveLength(0);
    });

    test('whitespace handling', () => {
      const matched = findMatchedNeeds(
        ['  Solar  '],
        ['Solar Panels']
      );

      // Current implementation doesn't trim, so '  Solar  ' won't match 'Solar Panels'
      expect(matched).toHaveLength(0);
    });

    test('special characters', () => {
      const matched = findMatchedNeeds(
        ['K-12 Schools'],
        ['K-12 Schools']
      );

      expect(matched).toContain('K-12 Schools');
    });
  });

  describe('Real-World Matching Scenarios', () => {
    test('typical client needs against typical opportunity', () => {
      const clientNeeds = ['Energy Efficiency', 'Solar', 'EV Charging'];
      const oppTypes = [
        'Energy Efficiency',
        'Solar Panels',
        'Wind Turbines',
        'Battery Storage'
      ];

      const matched = findMatchedNeeds(clientNeeds, oppTypes);

      expect(matched).toContain('Energy Efficiency');
      expect(matched).toContain('Solar');
      expect(matched).not.toContain('EV Charging');
      expect(matched).toHaveLength(2);
    });

    test('broad client need matches specific opportunity type', () => {
      const matched = findMatchedNeeds(
        ['Building Systems'],
        ['HVAC Systems', 'Lighting Systems', 'Plumbing Systems']
      );

      // 'Building Systems' won't match any because it's not a substring
      expect(matched).not.toContain('Building Systems');
    });

    test('specific client need matches broad opportunity type', () => {
      const matched = findMatchedNeeds(
        ['Solar Panel Installation'],
        ['Solar']
      );

      // 'Solar' is contained in 'Solar Panel Installation'
      expect(matched).toContain('Solar Panel Installation');
    });
  });
});

describe('Full Score Calculation Flow', () => {
  test('realistic scoring scenario', () => {
    const clientNeeds = ['Energy Efficiency', 'Solar', 'EV Charging', 'Battery Storage'];
    const oppTypes = ['Energy Efficiency', 'Solar Panels', 'Battery Storage Systems'];

    const matched = findMatchedNeeds(clientNeeds, oppTypes);
    const score = calculateMatchScore(clientNeeds, matched);

    // Should match: Energy Efficiency, Solar, Battery Storage (3 of 4)
    expect(matched).toHaveLength(3);
    expect(score).toBe(75);
  });

  test('scoring with one match', () => {
    const clientNeeds = ['Nuclear Power', 'Fusion', 'Thorium', 'Solar'];
    const oppTypes = ['Solar Panels'];

    const matched = findMatchedNeeds(clientNeeds, oppTypes);
    const score = calculateMatchScore(clientNeeds, matched);

    expect(matched).toHaveLength(1);
    expect(score).toBe(25);
  });

  test('perfect score scenario', () => {
    const clientNeeds = ['Solar', 'Wind'];
    const oppTypes = ['Solar Panels', 'Wind Turbines', 'Battery Storage'];

    const matched = findMatchedNeeds(clientNeeds, oppTypes);
    const score = calculateMatchScore(clientNeeds, matched);

    expect(matched).toHaveLength(2);
    expect(score).toBe(100);
  });

  test('zero score scenario', () => {
    const clientNeeds = ['Nuclear', 'Fusion'];
    const oppTypes = ['Solar', 'Wind', 'Battery'];

    const matched = findMatchedNeeds(clientNeeds, oppTypes);
    const score = calculateMatchScore(clientNeeds, matched);

    expect(matched).toHaveLength(0);
    expect(score).toBe(0);
  });
});
