/**
 * Client Matching Utility Tests
 *
 * Tests the display and formatting utilities from lib/utils/clientMatching.js.
 * Uses inline pure functions (no imports from app code).
 */

import { describe, test, expect } from 'vitest';
import { clients } from '../../fixtures/clients.js';

// ---------------------------------------------------------------------------
// Inline pure functions — copied from lib/utils/clientMatching.js
// ---------------------------------------------------------------------------

/**
 * Format match score for display
 * (Logic from clientMatching.js:38-40)
 */
function formatMatchScore(score) {
  return `${score}%`;
}

/**
 * Get match score color based on percentage
 * (Logic from clientMatching.js:45-50)
 */
function getMatchScoreColor(score) {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get match score background color for badges
 * (Logic from clientMatching.js:56-63)
 */
function getMatchScoreBgColor(score) {
  if (score >= 60) return { backgroundColor: '#9333ea', color: 'white' };
  if (score >= 30) return { backgroundColor: '#f59e0b', color: 'white' };
  return { backgroundColor: '#6b7280', color: 'white' };
}

/**
 * Format project needs for display
 * (Logic from clientMatching.js:68-71)
 */
function formatProjectNeeds(projectNeeds) {
  if (!projectNeeds || !Array.isArray(projectNeeds)) return [];
  return projectNeeds;
}

/**
 * Generate client tags from match data
 * (Logic from clientMatching.js:81-108)
 */
function generateClientTags(client, matches = [], limit = 3) {
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return [];
  }

  const projectNeedCounts = new Map();

  matches.forEach(match => {
    const matchedNeeds = match.matchDetails?.matchedProjectNeeds || [];
    matchedNeeds.forEach(need => {
      const currentCount = projectNeedCounts.get(need) || 0;
      projectNeedCounts.set(need, currentCount + 1);
    });
  });

  const sortedNeeds = Array.from(projectNeedCounts.entries())
    .sort((a, b) => b[1] - a[1]);

  const limitedNeeds = limit ? sortedNeeds.slice(0, limit) : sortedNeeds;

  return limitedNeeds.map(([need, count]) => `${need} (${count})`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('formatMatchScore', () => {

  describe('Standard Values', () => {
    test('formats integer score', () => {
      expect(formatMatchScore(85)).toBe('85%');
    });

    test('formats zero score', () => {
      expect(formatMatchScore(0)).toBe('0%');
    });

    test('formats 100 score', () => {
      expect(formatMatchScore(100)).toBe('100%');
    });

    test('formats 50 score', () => {
      expect(formatMatchScore(50)).toBe('50%');
    });
  });

  describe('Edge Cases', () => {
    test('formats null — produces "null%"', () => {
      // Production code does not guard against null; it template-literals directly
      expect(formatMatchScore(null)).toBe('null%');
    });

    test('formats undefined — produces "undefined%"', () => {
      expect(formatMatchScore(undefined)).toBe('undefined%');
    });

    test('formats negative score', () => {
      expect(formatMatchScore(-10)).toBe('-10%');
    });

    test('formats floating point score', () => {
      expect(formatMatchScore(33.33)).toBe('33.33%');
    });

    test('formats string number', () => {
      expect(formatMatchScore('75')).toBe('75%');
    });
  });
});

describe('getMatchScoreColor', () => {

  describe('High Scores (>= 80)', () => {
    test('score of 80 returns green', () => {
      expect(getMatchScoreColor(80)).toBe('text-green-600 dark:text-green-400');
    });

    test('score of 100 returns green', () => {
      expect(getMatchScoreColor(100)).toBe('text-green-600 dark:text-green-400');
    });

    test('score of 95 returns green', () => {
      expect(getMatchScoreColor(95)).toBe('text-green-600 dark:text-green-400');
    });
  });

  describe('Medium-High Scores (60-79)', () => {
    test('score of 60 returns yellow', () => {
      expect(getMatchScoreColor(60)).toBe('text-yellow-600 dark:text-yellow-400');
    });

    test('score of 79 returns yellow', () => {
      expect(getMatchScoreColor(79)).toBe('text-yellow-600 dark:text-yellow-400');
    });

    test('score of 70 returns yellow', () => {
      expect(getMatchScoreColor(70)).toBe('text-yellow-600 dark:text-yellow-400');
    });
  });

  describe('Medium-Low Scores (40-59)', () => {
    test('score of 40 returns orange', () => {
      expect(getMatchScoreColor(40)).toBe('text-orange-600 dark:text-orange-400');
    });

    test('score of 59 returns orange', () => {
      expect(getMatchScoreColor(59)).toBe('text-orange-600 dark:text-orange-400');
    });

    test('score of 50 returns orange', () => {
      expect(getMatchScoreColor(50)).toBe('text-orange-600 dark:text-orange-400');
    });
  });

  describe('Low Scores (< 40)', () => {
    test('score of 39 returns red', () => {
      expect(getMatchScoreColor(39)).toBe('text-red-600 dark:text-red-400');
    });

    test('score of 0 returns red', () => {
      expect(getMatchScoreColor(0)).toBe('text-red-600 dark:text-red-400');
    });

    test('score of 1 returns red', () => {
      expect(getMatchScoreColor(1)).toBe('text-red-600 dark:text-red-400');
    });
  });

  describe('Boundary Values', () => {
    test('79 is yellow, 80 is green (boundary)', () => {
      expect(getMatchScoreColor(79)).toBe('text-yellow-600 dark:text-yellow-400');
      expect(getMatchScoreColor(80)).toBe('text-green-600 dark:text-green-400');
    });

    test('59 is orange, 60 is yellow (boundary)', () => {
      expect(getMatchScoreColor(59)).toBe('text-orange-600 dark:text-orange-400');
      expect(getMatchScoreColor(60)).toBe('text-yellow-600 dark:text-yellow-400');
    });

    test('39 is red, 40 is orange (boundary)', () => {
      expect(getMatchScoreColor(39)).toBe('text-red-600 dark:text-red-400');
      expect(getMatchScoreColor(40)).toBe('text-orange-600 dark:text-orange-400');
    });
  });

  describe('Edge Cases', () => {
    test('negative score returns red', () => {
      expect(getMatchScoreColor(-5)).toBe('text-red-600 dark:text-red-400');
    });

    test('score above 100 returns green', () => {
      expect(getMatchScoreColor(150)).toBe('text-green-600 dark:text-green-400');
    });
  });
});

describe('getMatchScoreBgColor', () => {

  describe('High Scores (>= 60)', () => {
    test('score of 60 returns purple', () => {
      expect(getMatchScoreBgColor(60)).toEqual({
        backgroundColor: '#9333ea',
        color: 'white',
      });
    });

    test('score of 100 returns purple', () => {
      expect(getMatchScoreBgColor(100)).toEqual({
        backgroundColor: '#9333ea',
        color: 'white',
      });
    });

    test('score of 85 returns purple', () => {
      expect(getMatchScoreBgColor(85)).toEqual({
        backgroundColor: '#9333ea',
        color: 'white',
      });
    });
  });

  describe('Medium Scores (30-59)', () => {
    test('score of 30 returns amber', () => {
      expect(getMatchScoreBgColor(30)).toEqual({
        backgroundColor: '#f59e0b',
        color: 'white',
      });
    });

    test('score of 59 returns amber', () => {
      expect(getMatchScoreBgColor(59)).toEqual({
        backgroundColor: '#f59e0b',
        color: 'white',
      });
    });

    test('score of 45 returns amber', () => {
      expect(getMatchScoreBgColor(45)).toEqual({
        backgroundColor: '#f59e0b',
        color: 'white',
      });
    });
  });

  describe('Low Scores (< 30)', () => {
    test('score of 29 returns gray', () => {
      expect(getMatchScoreBgColor(29)).toEqual({
        backgroundColor: '#6b7280',
        color: 'white',
      });
    });

    test('score of 0 returns gray', () => {
      expect(getMatchScoreBgColor(0)).toEqual({
        backgroundColor: '#6b7280',
        color: 'white',
      });
    });

    test('score of 10 returns gray', () => {
      expect(getMatchScoreBgColor(10)).toEqual({
        backgroundColor: '#6b7280',
        color: 'white',
      });
    });
  });

  describe('Boundary Values', () => {
    test('59 is amber, 60 is purple (boundary)', () => {
      expect(getMatchScoreBgColor(59).backgroundColor).toBe('#f59e0b');
      expect(getMatchScoreBgColor(60).backgroundColor).toBe('#9333ea');
    });

    test('29 is gray, 30 is amber (boundary)', () => {
      expect(getMatchScoreBgColor(29).backgroundColor).toBe('#6b7280');
      expect(getMatchScoreBgColor(30).backgroundColor).toBe('#f59e0b');
    });
  });

  describe('Return Shape', () => {
    test('always returns object with backgroundColor and color keys', () => {
      const scores = [0, 15, 29, 30, 45, 59, 60, 80, 100];
      scores.forEach(score => {
        const result = getMatchScoreBgColor(score);
        expect(result).toHaveProperty('backgroundColor');
        expect(result).toHaveProperty('color');
        expect(result.color).toBe('white');
      });
    });
  });
});

describe('formatProjectNeeds', () => {

  describe('Valid Arrays', () => {
    test('returns the same array passed in', () => {
      const needs = ['Solar', 'HVAC', 'EV Charging'];
      expect(formatProjectNeeds(needs)).toBe(needs);
    });

    test('returns empty array unchanged', () => {
      const needs = [];
      expect(formatProjectNeeds(needs)).toBe(needs);
      expect(formatProjectNeeds(needs)).toHaveLength(0);
    });

    test('returns single-element array unchanged', () => {
      const needs = ['Solar'];
      expect(formatProjectNeeds(needs)).toEqual(['Solar']);
    });
  });

  describe('Fixture Data', () => {
    test('formats PGE Bay Area client project needs', () => {
      const result = formatProjectNeeds(clients.pgeBayAreaClient.project_needs);
      expect(result).toEqual(['Energy Efficiency', 'Solar', 'EV Charging']);
    });

    test('formats empty needs client', () => {
      const result = formatProjectNeeds(clients.emptyNeedsClient.project_needs);
      expect(result).toEqual([]);
    });
  });

  describe('Null / Invalid Inputs', () => {
    test('null returns empty array', () => {
      expect(formatProjectNeeds(null)).toEqual([]);
    });

    test('undefined returns empty array', () => {
      expect(formatProjectNeeds(undefined)).toEqual([]);
    });

    test('string returns empty array (not an array)', () => {
      expect(formatProjectNeeds('Solar')).toEqual([]);
    });

    test('number returns empty array', () => {
      expect(formatProjectNeeds(42)).toEqual([]);
    });

    test('object returns empty array', () => {
      expect(formatProjectNeeds({ need: 'Solar' })).toEqual([]);
    });
  });
});

describe('generateClientTags', () => {

  // Helper to build match objects with matchDetails
  function buildMatch(matchedProjectNeeds) {
    return {
      matchDetails: { matchedProjectNeeds },
    };
  }

  describe('Basic Tag Generation', () => {
    test('generates tags from single match with one need', () => {
      const matches = [buildMatch(['Solar'])];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches);
      expect(tags).toEqual(['Solar (1)']);
    });

    test('generates tags from multiple matches with same need', () => {
      const matches = [
        buildMatch(['Solar']),
        buildMatch(['Solar']),
        buildMatch(['Solar']),
      ];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches);
      expect(tags).toEqual(['Solar (3)']);
    });

    test('generates tags from matches with different needs', () => {
      const matches = [
        buildMatch(['Solar', 'HVAC']),
        buildMatch(['Solar', 'EV Charging']),
        buildMatch(['HVAC']),
      ];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches);
      // Solar: 2, HVAC: 2, EV Charging: 1 — sorted by count desc
      expect(tags).toHaveLength(3);
      // Solar and HVAC both have count 2, so order between them depends on Map insertion order
      expect(tags[0]).toBe('Solar (2)');
      expect(tags[1]).toBe('HVAC (2)');
      expect(tags[2]).toBe('EV Charging (1)');
    });
  });

  describe('Sorting by Count', () => {
    test('tags are sorted by count descending', () => {
      const matches = [
        buildMatch(['A']),
        buildMatch(['B', 'A']),
        buildMatch(['C', 'B', 'A']),
      ];
      // A: 3, B: 2, C: 1
      const tags = generateClientTags(clients.pgeBayAreaClient, matches);
      expect(tags).toEqual(['A (3)', 'B (2)', 'C (1)']);
    });
  });

  describe('Limit Parameter', () => {
    test('default limit is 3', () => {
      const matches = [
        buildMatch(['A', 'B', 'C', 'D', 'E']),
      ];
      // Each need appears once — all have count 1
      const tags = generateClientTags(clients.pgeBayAreaClient, matches);
      expect(tags).toHaveLength(3);
    });

    test('limit of 1 returns only top tag', () => {
      const matches = [
        buildMatch(['A']),
        buildMatch(['A', 'B']),
        buildMatch(['A', 'B', 'C']),
      ];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches, 1);
      expect(tags).toEqual(['A (3)']);
    });

    test('limit of 2 returns top 2 tags', () => {
      const matches = [
        buildMatch(['A']),
        buildMatch(['A', 'B']),
        buildMatch(['A', 'B', 'C']),
      ];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches, 2);
      expect(tags).toEqual(['A (3)', 'B (2)']);
    });

    test('limit of null returns all tags', () => {
      const matches = [
        buildMatch(['A', 'B', 'C', 'D', 'E']),
      ];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches, null);
      expect(tags).toHaveLength(5);
    });

    test('limit of 0 returns all tags (falsy)', () => {
      const matches = [
        buildMatch(['A', 'B', 'C', 'D']),
      ];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches, 0);
      expect(tags).toHaveLength(4);
    });

    test('limit larger than available needs returns all', () => {
      const matches = [buildMatch(['Solar'])];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches, 10);
      expect(tags).toEqual(['Solar (1)']);
    });
  });

  describe('Deduplication', () => {
    test('same need from multiple matches is counted, not duplicated', () => {
      const matches = [
        buildMatch(['Solar']),
        buildMatch(['Solar']),
      ];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches);
      // "Solar" should appear once with count 2, not twice
      expect(tags).toEqual(['Solar (2)']);
      expect(tags).toHaveLength(1);
    });

    test('needs are aggregated across all matches', () => {
      const matches = [
        buildMatch(['Solar', 'HVAC']),
        buildMatch(['HVAC', 'EV Charging']),
        buildMatch(['Solar', 'EV Charging']),
      ];
      // Solar: 2, HVAC: 2, EV Charging: 2
      const tags = generateClientTags(clients.pgeBayAreaClient, matches, null);
      expect(tags).toHaveLength(3);
      tags.forEach(tag => {
        expect(tag).toMatch(/\(2\)$/);
      });
    });
  });

  describe('Empty / Null Inputs', () => {
    test('null matches returns empty array', () => {
      expect(generateClientTags(clients.pgeBayAreaClient, null)).toEqual([]);
    });

    test('undefined matches returns empty array', () => {
      expect(generateClientTags(clients.pgeBayAreaClient, undefined)).toEqual([]);
    });

    test('empty matches array returns empty array', () => {
      expect(generateClientTags(clients.pgeBayAreaClient, [])).toEqual([]);
    });

    test('non-array matches returns empty array', () => {
      expect(generateClientTags(clients.pgeBayAreaClient, 'not-array')).toEqual([]);
    });

    test('matches with no matchDetails still work', () => {
      const matches = [{ matchDetails: null }, {}];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches);
      // matchedProjectNeeds defaults to [] via optional chaining
      expect(tags).toEqual([]);
    });

    test('matches with empty matchedProjectNeeds', () => {
      const matches = [buildMatch([])];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches);
      expect(tags).toEqual([]);
    });
  });

  describe('Tag Format', () => {
    test('tag format is "Need (count)"', () => {
      const matches = [buildMatch(['Solar'])];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches);
      expect(tags[0]).toMatch(/^.+ \(\d+\)$/);
    });

    test('multi-word need preserved in tag', () => {
      const matches = [buildMatch(['Energy Efficiency'])];
      const tags = generateClientTags(clients.pgeBayAreaClient, matches);
      expect(tags[0]).toBe('Energy Efficiency (1)');
    });
  });
});

// ---------------------------------------------------------------------------
// New inline pure functions — added for match page redesign
// ---------------------------------------------------------------------------

/**
 * Generate project needs with match counts (merged view)
 * (Logic from clientMatching.js:generateProjectNeedsWithCounts)
 */
function generateProjectNeedsWithCounts(projectNeeds, matches = []) {
  if (!projectNeeds || !Array.isArray(projectNeeds) || projectNeeds.length === 0) return [];

  const countMap = new Map();
  if (Array.isArray(matches)) {
    matches.forEach(match => {
      const matchedNeeds = match.matchDetails?.matchedProjectNeeds || [];
      matchedNeeds.forEach(need => {
        countMap.set(need, (countMap.get(need) || 0) + 1);
      });
    });
  }

  return projectNeeds.map(need => ({
    need,
    count: countMap.get(need) || 0,
  }));
}

/**
 * Funding type group definitions, ordered by desirability
 * (Logic from clientMatching.js:FUNDING_TYPE_GROUPS)
 */
const FUNDING_TYPE_GROUPS = [
  {
    key: 'grants',
    label: 'Grants',
    description: 'Direct Grant Funding',
    types: ['Grant', 'Cooperative Agreement'],
  },
  {
    key: 'tax',
    label: 'Tax Benefits',
    description: 'Tax Incentives',
    types: ['Tax Credit', 'Tax Incentive', 'Tax Deduction', 'Tax Exemption'],
  },
  {
    key: 'loans',
    label: 'Loans',
    description: 'Loans & Credit',
    types: ['Loan', 'Forgivable Loan', 'Guarantee', 'Bond'],
  },
  {
    key: 'incentives',
    label: 'Incentives',
    description: 'Utility Incentives',
    types: ['Incentive', 'Direct Payment', 'Voucher'],
  },
  {
    key: 'other',
    label: 'Other',
    description: 'Support & Services',
    types: [],
  },
];

function getRelevanceScore(opportunity) {
  return opportunity.relevance_score
    || opportunity.scoring?.finalScore
    || opportunity.scoring?.overallScore
    || 0;
}

/**
 * Group matches by funding type category
 * (Logic from clientMatching.js:groupMatchesByFundingType)
 */
function groupMatchesByFundingType(matches) {
  if (!matches || !Array.isArray(matches) || matches.length === 0) return [];

  const typeToGroup = new Map();
  FUNDING_TYPE_GROUPS.forEach((group, index) => {
    group.types.forEach(type => typeToGroup.set(type.toLowerCase(), index));
  });
  typeToGroup.set('rebate', typeToGroup.get('incentive'));

  const groups = FUNDING_TYPE_GROUPS.map(g => ({ ...g, matches: [] }));

  matches.forEach(match => {
    const fundingType = (match.funding_type || '').toLowerCase();
    const groupIndex = typeToGroup.has(fundingType) ? typeToGroup.get(fundingType) : groups.length - 1;
    groups[groupIndex].matches.push(match);
  });

  groups.forEach(group => {
    group.matches.sort((a, b) => getRelevanceScore(b) - getRelevanceScore(a));
  });

  return groups.filter(g => g.matches.length > 0);
}

/**
 * Get match score badge inline styles
 * (Logic from clientMatching.js:getMatchScoreBadgeStyles)
 */
function getMatchScoreBadgeStyles(score) {
  if (score >= 60) return { backgroundColor: '#f5f3ff', color: '#6d28d9', border: '1px solid #c4b5fd' };
  if (score >= 30) return { backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d' };
  return { backgroundColor: '#f9fafb', color: '#6b7280', border: '1px solid #d1d5db' };
}

/**
 * Get funding group dot color
 * (Logic from clientMatching.js:getFundingGroupDotColor)
 */
function getFundingGroupDotColor(key) {
  const colors = {
    grants: '#10b981',
    incentives: '#8b5cf6',
    tax: '#f59e0b',
    loans: '#3b82f6',
    other: '#a3a3a3',
  };
  return colors[key] || colors.other;
}

/**
 * Budget display formatting
 * (Logic from matches/page.jsx budget formatting)
 */
function formatBudgetDisplay(budget) {
  const budgetLabels = {
    small: 'Small ($50K - $500K)',
    medium: 'Medium ($500K - $5M)',
    large: 'Large ($5M - $50M)',
    very_large: 'Very Large ($50M+)',
  };
  return budgetLabels[budget]
    || (typeof budget === 'number'
      ? `$${budget.toLocaleString()}`
      : (typeof budget === 'string' && budget !== '' && !isNaN(Number(budget))
        ? `$${Number(budget).toLocaleString()}`
        : budget || 'Not specified'));
}

// ---------------------------------------------------------------------------
// Tests — New functions
// ---------------------------------------------------------------------------

describe('generateProjectNeedsWithCounts', () => {
  function buildMatch(matchedProjectNeeds) {
    return { matchDetails: { matchedProjectNeeds } };
  }

  test('returns needs with zero counts when no matches', () => {
    const result = generateProjectNeedsWithCounts(['Solar', 'HVAC'], []);
    expect(result).toEqual([
      { need: 'Solar', count: 0 },
      { need: 'HVAC', count: 0 },
    ]);
  });

  test('counts matched needs correctly', () => {
    const matches = [
      buildMatch(['Solar', 'HVAC']),
      buildMatch(['Solar']),
    ];
    const result = generateProjectNeedsWithCounts(['Solar', 'HVAC', 'Wind'], matches);
    expect(result).toEqual([
      { need: 'Solar', count: 2 },
      { need: 'HVAC', count: 1 },
      { need: 'Wind', count: 0 },
    ]);
  });

  test('preserves project needs order', () => {
    const matches = [buildMatch(['Z', 'A'])];
    const result = generateProjectNeedsWithCounts(['A', 'Z'], matches);
    expect(result[0].need).toBe('A');
    expect(result[1].need).toBe('Z');
  });

  test('returns empty array for null projectNeeds', () => {
    expect(generateProjectNeedsWithCounts(null, [])).toEqual([]);
  });

  test('returns empty array for empty projectNeeds', () => {
    expect(generateProjectNeedsWithCounts([], [])).toEqual([]);
  });

  test('handles matches with no matchDetails', () => {
    const matches = [{ matchDetails: null }, {}];
    const result = generateProjectNeedsWithCounts(['Solar'], matches);
    expect(result).toEqual([{ need: 'Solar', count: 0 }]);
  });
});

describe('groupMatchesByFundingType', () => {
  test('returns empty array for null/empty matches', () => {
    expect(groupMatchesByFundingType(null)).toEqual([]);
    expect(groupMatchesByFundingType([])).toEqual([]);
    expect(groupMatchesByFundingType(undefined)).toEqual([]);
  });

  test('groups grants correctly', () => {
    const matches = [
      { funding_type: 'Grant', relevance_score: 8 },
      { funding_type: 'Cooperative Agreement', relevance_score: 6 },
    ];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('grants');
    expect(groups[0].matches).toHaveLength(2);
  });

  test('groups rebates/incentives correctly', () => {
    const matches = [
      { funding_type: 'Incentive', relevance_score: 7 },
      { funding_type: 'Direct Payment', relevance_score: 5 },
    ];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('incentives');
    expect(groups[0].matches).toHaveLength(2);
  });

  test('groups tax benefits correctly', () => {
    const matches = [
      { funding_type: 'Tax Credit', relevance_score: 7 },
      { funding_type: 'Tax Exemption', relevance_score: 9 },
    ];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('tax');
    expect(groups[0].matches).toHaveLength(2);
  });

  test('groups loans correctly', () => {
    const matches = [
      { funding_type: 'Loan', relevance_score: 5 },
      { funding_type: 'Forgivable Loan', relevance_score: 8 },
    ];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('loans');
  });

  test('unknown funding types go to "other"', () => {
    const matches = [
      { funding_type: 'Technical Assistance', relevance_score: 4 },
    ];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('other');
  });

  test('multiple groups returned in order: grants → tax → loans → incentives', () => {
    const matches = [
      { funding_type: 'Tax Credit', relevance_score: 7 },
      { funding_type: 'Grant', relevance_score: 9 },
      { funding_type: 'Loan', relevance_score: 5 },
      { funding_type: 'Incentive', relevance_score: 4 },
    ];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(4);
    expect(groups[0].key).toBe('grants');
    expect(groups[1].key).toBe('tax');
    expect(groups[2].key).toBe('loans');
    expect(groups[3].key).toBe('incentives');
  });

  test('empty groups are excluded', () => {
    const matches = [{ funding_type: 'Grant', relevance_score: 8 }];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('grants');
  });

  test('matches within a group are sorted by relevance score descending', () => {
    const matches = [
      { funding_type: 'Grant', relevance_score: 3 },
      { funding_type: 'Grant', relevance_score: 9 },
      { funding_type: 'Grant', relevance_score: 6 },
    ];
    const groups = groupMatchesByFundingType(matches);
    expect(groups[0].matches[0].relevance_score).toBe(9);
    expect(groups[0].matches[1].relevance_score).toBe(6);
    expect(groups[0].matches[2].relevance_score).toBe(3);
  });

  test('uses scoring.finalScore as fallback for relevance', () => {
    const matches = [
      { funding_type: 'Grant', scoring: { finalScore: 4 } },
      { funding_type: 'Grant', scoring: { finalScore: 8 } },
    ];
    const groups = groupMatchesByFundingType(matches);
    expect(groups[0].matches[0].scoring.finalScore).toBe(8);
    expect(groups[0].matches[1].scoring.finalScore).toBe(4);
  });

  test('missing funding_type goes to other', () => {
    const matches = [{ relevance_score: 5 }];
    const groups = groupMatchesByFundingType(matches);
    expect(groups[0].key).toBe('other');
  });

  test('lowercase "grant" goes to grants group (case-insensitive)', () => {
    const matches = [{ funding_type: 'grant', relevance_score: 7 }];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('grants');
  });

  test('lowercase "loan" goes to loans group (case-insensitive)', () => {
    const matches = [{ funding_type: 'loan', relevance_score: 5 }];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('loans');
  });

  test('uppercase "GRANT" goes to grants group (case-insensitive)', () => {
    const matches = [{ funding_type: 'GRANT', relevance_score: 6 }];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('grants');
  });

  test('stale "Rebate" value is aliased to incentives group', () => {
    const matches = [{ funding_type: 'Rebate', relevance_score: 5 }];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('incentives');
  });

  test('mixed casing across multiple types groups correctly', () => {
    const matches = [
      { funding_type: 'grant', relevance_score: 8 },
      { funding_type: 'Grant', relevance_score: 7 },
      { funding_type: 'LOAN', relevance_score: 5 },
      { funding_type: 'Rebate', relevance_score: 4 },
      { funding_type: 'Technical Assistance', relevance_score: 3 },
    ];
    const groups = groupMatchesByFundingType(matches);
    expect(groups).toHaveLength(4);
    expect(groups[0].key).toBe('grants');
    expect(groups[0].matches).toHaveLength(2);
    expect(groups[1].key).toBe('loans');
    expect(groups[1].matches).toHaveLength(1);
    expect(groups[2].key).toBe('incentives');
    expect(groups[2].matches).toHaveLength(1);
    expect(groups[3].key).toBe('other');
    expect(groups[3].matches).toHaveLength(1);
  });
});

describe('getMatchScoreBadgeStyles', () => {
  test('60+ returns violet style', () => {
    const style = getMatchScoreBadgeStyles(60);
    expect(style.backgroundColor).toBe('#f5f3ff');
    expect(style.color).toBe('#6d28d9');
    expect(style.border).toContain('#c4b5fd');
  });

  test('100 returns violet style', () => {
    expect(getMatchScoreBadgeStyles(100).color).toBe('#6d28d9');
  });

  test('30-59 returns amber style', () => {
    const style = getMatchScoreBadgeStyles(30);
    expect(style.backgroundColor).toBe('#fffbeb');
    expect(style.color).toBe('#b45309');
    expect(style.border).toContain('#fcd34d');
  });

  test('59 returns amber (boundary)', () => {
    expect(getMatchScoreBadgeStyles(59).color).toBe('#b45309');
  });

  test('<30 returns neutral style', () => {
    const style = getMatchScoreBadgeStyles(0);
    expect(style.backgroundColor).toBe('#f9fafb');
    expect(style.color).toBe('#6b7280');
    expect(style.border).toContain('#d1d5db');
  });

  test('29 is neutral, 30 is amber (boundary)', () => {
    expect(getMatchScoreBadgeStyles(29).color).toBe('#6b7280');
    expect(getMatchScoreBadgeStyles(30).color).toBe('#b45309');
  });

  test('always returns object with 3 keys', () => {
    [0, 15, 29, 30, 59, 60, 100].forEach(score => {
      const style = getMatchScoreBadgeStyles(score);
      expect(style).toHaveProperty('backgroundColor');
      expect(style).toHaveProperty('color');
      expect(style).toHaveProperty('border');
    });
  });
});

describe('getFundingGroupDotColor', () => {
  test('grants returns emerald hex', () => {
    expect(getFundingGroupDotColor('grants')).toBe('#10b981');
  });

  test('incentives returns violet hex', () => {
    expect(getFundingGroupDotColor('incentives')).toBe('#8b5cf6');
  });

  test('tax returns amber hex', () => {
    expect(getFundingGroupDotColor('tax')).toBe('#f59e0b');
  });

  test('loans returns blue hex', () => {
    expect(getFundingGroupDotColor('loans')).toBe('#3b82f6');
  });

  test('other returns neutral hex', () => {
    expect(getFundingGroupDotColor('other')).toBe('#a3a3a3');
  });

  test('unknown key returns other color', () => {
    expect(getFundingGroupDotColor('unknown')).toBe('#a3a3a3');
  });
});

describe('formatBudgetDisplay', () => {
  test('label key returns human-readable label', () => {
    expect(formatBudgetDisplay('small')).toBe('Small ($50K - $500K)');
    expect(formatBudgetDisplay('medium')).toBe('Medium ($500K - $5M)');
    expect(formatBudgetDisplay('large')).toBe('Large ($5M - $50M)');
    expect(formatBudgetDisplay('very_large')).toBe('Very Large ($50M+)');
  });

  test('numeric budget is formatted with commas', () => {
    expect(formatBudgetDisplay(30000000)).toBe('$30,000,000');
    expect(formatBudgetDisplay(500000)).toBe('$500,000');
    expect(formatBudgetDisplay(0)).toBe('$0');
  });

  test('string numeric budget is formatted', () => {
    expect(formatBudgetDisplay('30000000')).toBe('$30,000,000');
    expect(formatBudgetDisplay('500000')).toBe('$500,000');
  });

  test('non-numeric string passes through', () => {
    expect(formatBudgetDisplay('custom budget')).toBe('custom budget');
  });

  test('null/undefined returns "Not specified"', () => {
    expect(formatBudgetDisplay(null)).toBe('Not specified');
    expect(formatBudgetDisplay(undefined)).toBe('Not specified');
  });

  test('empty string returns "Not specified"', () => {
    expect(formatBudgetDisplay('')).toBe('Not specified');
  });
});
