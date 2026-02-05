/**
 * Map Tooltip Tests
 *
 * Tests the data computation for hover tooltips on the map:
 * - State-level tooltips (opp count, total funding, top categories)
 * - Tooltip data accuracy matches underlying state data
 * - Formatting of currency and counts
 * - Edge cases (no data, single opportunity)
 */

import { describe, test, expect } from 'vitest';

/**
 * Build tooltip data for a state
 */
function buildStateTooltip(stateName, stateCode, stateData, opportunities) {
  if (!stateData) {
    return {
      title: stateName,
      stateCode,
      opportunityCount: 0,
      totalFunding: 0,
      topCategories: [],
      hasData: false,
    };
  }

  // Get opportunities for this state
  const stateOpps = opportunities || [];

  // Collect top categories
  const categoryCount = {};
  for (const opp of stateOpps) {
    const categories = opp.categories || [];
    for (const cat of categories) {
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }
  }

  const topCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  return {
    title: stateName,
    stateCode,
    opportunityCount: stateData.count,
    totalFunding: stateData.amount,
    topCategories,
    hasData: true,
  };
}

/**
 * Format currency for display
 */
function formatFunding(amount) {
  if (!amount || amount === 0) return '$0';
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

/**
 * Format opportunity count for display
 */
function formatCount(count) {
  if (count === 0) return 'No opportunities';
  if (count === 1) return '1 opportunity';
  return `${count} opportunities`;
}

describe('Map Tooltips', () => {

  describe('Building Tooltip Data', () => {
    test('builds complete tooltip for state with data', () => {
      const stateData = { count: 5, amount: 2500000 };
      const opps = [
        { id: '1', categories: ['Energy', 'Infrastructure'] },
        { id: '2', categories: ['Energy', 'Climate'] },
        { id: '3', categories: ['Transportation'] },
      ];

      const tooltip = buildStateTooltip('California', 'CA', stateData, opps);

      expect(tooltip.title).toBe('California');
      expect(tooltip.stateCode).toBe('CA');
      expect(tooltip.opportunityCount).toBe(5);
      expect(tooltip.totalFunding).toBe(2500000);
      expect(tooltip.hasData).toBe(true);
      expect(tooltip.topCategories).toHaveLength(3);
    });

    test('top categories sorted by frequency', () => {
      const stateData = { count: 4, amount: 1000000 };
      const opps = [
        { id: '1', categories: ['Energy'] },
        { id: '2', categories: ['Energy'] },
        { id: '3', categories: ['Energy'] },
        { id: '4', categories: ['Climate'] },
      ];

      const tooltip = buildStateTooltip('California', 'CA', stateData, opps);

      expect(tooltip.topCategories[0].name).toBe('Energy');
      expect(tooltip.topCategories[0].count).toBe(3);
      expect(tooltip.topCategories[1].name).toBe('Climate');
      expect(tooltip.topCategories[1].count).toBe(1);
    });

    test('limits to top 3 categories', () => {
      const stateData = { count: 5, amount: 1000000 };
      const opps = [
        { id: '1', categories: ['Energy'] },
        { id: '2', categories: ['Climate'] },
        { id: '3', categories: ['Transportation'] },
        { id: '4', categories: ['Infrastructure'] },
        { id: '5', categories: ['Water'] },
      ];

      const tooltip = buildStateTooltip('California', 'CA', stateData, opps);
      expect(tooltip.topCategories).toHaveLength(3);
    });

    test('returns hasData=false when no state data', () => {
      const tooltip = buildStateTooltip('Wyoming', 'WY', null, []);

      expect(tooltip.title).toBe('Wyoming');
      expect(tooltip.opportunityCount).toBe(0);
      expect(tooltip.totalFunding).toBe(0);
      expect(tooltip.hasData).toBe(false);
      expect(tooltip.topCategories).toEqual([]);
    });

    test('handles opportunities with no categories', () => {
      const stateData = { count: 2, amount: 500000 };
      const opps = [
        { id: '1', categories: [] },
        { id: '2' }, // no categories property
      ];

      const tooltip = buildStateTooltip('Texas', 'TX', stateData, opps);
      expect(tooltip.topCategories).toEqual([]);
    });
  });

  describe('Currency Formatting', () => {
    test('formats zero', () => {
      expect(formatFunding(0)).toBe('$0');
    });

    test('formats null', () => {
      expect(formatFunding(null)).toBe('$0');
    });

    test('formats billions', () => {
      expect(formatFunding(1500000000)).toBe('$1.5B');
    });

    test('formats millions', () => {
      expect(formatFunding(2500000)).toBe('$2.5M');
    });

    test('formats thousands', () => {
      expect(formatFunding(50000)).toBe('$50K');
    });

    test('formats exact million', () => {
      expect(formatFunding(1000000)).toBe('$1.0M');
    });

    test('formats sub-thousand', () => {
      expect(formatFunding(500)).toBe('$500');
    });
  });

  describe('Count Formatting', () => {
    test('formats zero', () => {
      expect(formatCount(0)).toBe('No opportunities');
    });

    test('formats singular', () => {
      expect(formatCount(1)).toBe('1 opportunity');
    });

    test('formats plural', () => {
      expect(formatCount(5)).toBe('5 opportunities');
    });

    test('formats large numbers', () => {
      expect(formatCount(100)).toBe('100 opportunities');
    });
  });
});
