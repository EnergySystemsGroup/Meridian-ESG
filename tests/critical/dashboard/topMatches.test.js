/**
 * Dashboard Top Matches Tests
 *
 * Tests the top client matches display logic:
 * - Ranking by match score
 * - Top N selection
 * - Client-opportunity pairing
 * - Score display formatting
 */

import { describe, test, expect } from 'vitest';

/**
 * Get top client matches
 *
 * @param {Array} matches - All client-opportunity matches
 * @param {number} limit - Number of top matches to return
 * @returns {Array} Top matches sorted by score
 */
function getTopMatches(matches, limit = 5) {
  return [...matches]
    .filter(m => m.score > 0) // Only include positive scores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Format match score for display
 */
function formatMatchScore(score) {
  if (score == null) return 'N/A';
  if (score >= 90) return 'Excellent Match';
  if (score >= 75) return 'Strong Match';
  if (score >= 50) return 'Good Match';
  if (score >= 25) return 'Fair Match';
  return 'Low Match';
}

/**
 * Group matches by client
 */
function groupMatchesByClient(matches) {
  const grouped = {};

  for (const match of matches) {
    const clientId = match.client_id;
    if (!grouped[clientId]) {
      grouped[clientId] = {
        client_id: clientId,
        client_name: match.client_name,
        matches: [],
        topScore: 0,
        matchCount: 0,
      };
    }

    grouped[clientId].matches.push(match);
    grouped[clientId].matchCount++;
    grouped[clientId].topScore = Math.max(grouped[clientId].topScore, match.score);
  }

  return Object.values(grouped);
}

const testMatches = [
  { id: 1, client_id: 'c1', client_name: 'City of SF', opportunity_id: 'o1', opportunity_title: 'Grant A', score: 95 },
  { id: 2, client_id: 'c1', client_name: 'City of SF', opportunity_id: 'o2', opportunity_title: 'Grant B', score: 80 },
  { id: 3, client_id: 'c2', client_name: 'Oakland USD', opportunity_id: 'o1', opportunity_title: 'Grant A', score: 85 },
  { id: 4, client_id: 'c2', client_name: 'Oakland USD', opportunity_id: 'o3', opportunity_title: 'Grant C', score: 70 },
  { id: 5, client_id: 'c3', client_name: 'PG&E', opportunity_id: 'o4', opportunity_title: 'Grant D', score: 92 },
  { id: 6, client_id: 'c4', client_name: 'Houston HA', opportunity_id: 'o2', opportunity_title: 'Grant B', score: 60 },
  { id: 7, client_id: 'c5', client_name: 'LA County', opportunity_id: 'o5', opportunity_title: 'Grant E', score: 45 },
];

describe('Dashboard Top Matches', () => {

  describe('Top Matches Selection', () => {
    test('returns top 5 matches by default', () => {
      const result = getTopMatches(testMatches);

      expect(result).toHaveLength(5);
      expect(result[0].score).toBe(95);
      expect(result[4].score).toBe(70);
    });

    test('respects custom limit', () => {
      const result = getTopMatches(testMatches, 3);

      expect(result).toHaveLength(3);
      expect(result[0].score).toBe(95);
      expect(result[2].score).toBe(85);
    });

    test('returns all if fewer than limit', () => {
      const fewMatches = testMatches.slice(0, 3);
      const result = getTopMatches(fewMatches, 10);

      expect(result).toHaveLength(3);
    });

    test('sorts by score descending', () => {
      const result = getTopMatches(testMatches);

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
      }
    });

    test('excludes zero-score matches', () => {
      const withZeros = [
        ...testMatches,
        { id: 8, client_id: 'c6', score: 0 },
        { id: 9, client_id: 'c7', score: 0 },
      ];

      const result = getTopMatches(withZeros);

      expect(result.every(m => m.score > 0)).toBe(true);
    });

    test('handles empty array', () => {
      const result = getTopMatches([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('Score Formatting', () => {
    test('formats excellent matches (90+)', () => {
      expect(formatMatchScore(95)).toBe('Excellent Match');
      expect(formatMatchScore(90)).toBe('Excellent Match');
      expect(formatMatchScore(100)).toBe('Excellent Match');
    });

    test('formats strong matches (75-89)', () => {
      expect(formatMatchScore(89)).toBe('Strong Match');
      expect(formatMatchScore(80)).toBe('Strong Match');
      expect(formatMatchScore(75)).toBe('Strong Match');
    });

    test('formats good matches (50-74)', () => {
      expect(formatMatchScore(74)).toBe('Good Match');
      expect(formatMatchScore(60)).toBe('Good Match');
      expect(formatMatchScore(50)).toBe('Good Match');
    });

    test('formats fair matches (25-49)', () => {
      expect(formatMatchScore(49)).toBe('Fair Match');
      expect(formatMatchScore(30)).toBe('Fair Match');
      expect(formatMatchScore(25)).toBe('Fair Match');
    });

    test('formats low matches (below 25)', () => {
      expect(formatMatchScore(24)).toBe('Low Match');
      expect(formatMatchScore(10)).toBe('Low Match');
      expect(formatMatchScore(0)).toBe('Low Match');
    });

    test('handles null/undefined', () => {
      expect(formatMatchScore(null)).toBe('N/A');
      expect(formatMatchScore(undefined)).toBe('N/A');
    });
  });

  describe('Group By Client', () => {
    test('groups matches by client', () => {
      const result = groupMatchesByClient(testMatches);

      expect(result).toHaveLength(5); // 5 unique clients
    });

    test('calculates match count per client', () => {
      const result = groupMatchesByClient(testMatches);
      const sfClient = result.find(g => g.client_id === 'c1');

      expect(sfClient.matchCount).toBe(2);
    });

    test('tracks top score per client', () => {
      const result = groupMatchesByClient(testMatches);
      const sfClient = result.find(g => g.client_id === 'c1');

      expect(sfClient.topScore).toBe(95);
    });

    test('preserves client name', () => {
      const result = groupMatchesByClient(testMatches);
      const sfClient = result.find(g => g.client_id === 'c1');

      expect(sfClient.client_name).toBe('City of SF');
    });

    test('stores all matches for each client', () => {
      const result = groupMatchesByClient(testMatches);
      const sfClient = result.find(g => g.client_id === 'c1');

      expect(sfClient.matches).toHaveLength(2);
    });

    test('handles empty matches', () => {
      const result = groupMatchesByClient([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('Dashboard Integration', () => {
    test('can get top clients by match count', () => {
      const grouped = groupMatchesByClient(testMatches);
      const topByCount = grouped.sort((a, b) => b.matchCount - a.matchCount);

      expect(topByCount[0].matchCount).toBe(2); // SF and Oakland both have 2
    });

    test('can get top clients by best score', () => {
      const grouped = groupMatchesByClient(testMatches);
      const topByScore = grouped.sort((a, b) => b.topScore - a.topScore);

      expect(topByScore[0].topScore).toBe(95); // City of SF
      expect(topByScore[0].client_name).toBe('City of SF');
    });

    test('client with single excellent match ranks high', () => {
      const grouped = groupMatchesByClient(testMatches);
      const topByScore = grouped.sort((a, b) => b.topScore - a.topScore);

      // PG&E has only 1 match but score of 92
      const pgeRank = topByScore.findIndex(g => g.client_id === 'c3');
      expect(pgeRank).toBeLessThanOrEqual(2);
    });
  });

  describe('Edge Cases', () => {
    test('handles duplicate scores', () => {
      const sameScores = [
        { id: 1, score: 80 },
        { id: 2, score: 80 },
        { id: 3, score: 80 },
      ];

      const result = getTopMatches(sameScores);
      expect(result).toHaveLength(3);
      expect(result.every(m => m.score === 80)).toBe(true);
    });

    test('handles single match', () => {
      const single = [{ id: 1, score: 75 }];
      const result = getTopMatches(single);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(75);
    });

    test('original array not mutated', () => {
      const original = [...testMatches];
      getTopMatches(testMatches);

      expect(testMatches).toEqual(original);
    });
  });
});
