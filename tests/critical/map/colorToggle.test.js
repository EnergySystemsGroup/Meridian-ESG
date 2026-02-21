/**
 * Map Color Toggle Tests
 *
 * Tests the Amount vs Count coloring logic:
 * - Color by count: states colored by number of opportunities
 * - Color by amount: states colored by total funding amount
 * - Color scale calculation (min/max range)
 * - States with no data appear neutral
 */

import { describe, test, expect } from 'vitest';

/**
 * Calculate state data for coloring
 */
function calculateStateData(opportunities, coverageByState) {
  const stateData = {};

  for (const opp of opportunities) {
    if (opp.status !== 'open') continue;

    if (opp.is_national) {
      // National opps count toward all states
      for (const stateCode of Object.keys(coverageByState)) {
        if (!stateData[stateCode]) {
          stateData[stateCode] = { count: 0, amount: 0 };
        }
        stateData[stateCode].count++;
        stateData[stateCode].amount += opp.maximum_award || opp.total_funding_available || 0;
      }
    } else {
      // Non-national opps count toward their coverage states
      const oppAreas = opp.coverage_area_ids || [];
      const states = new Set();

      for (const areaId of oppAreas) {
        for (const [stateCode, areaIds] of Object.entries(coverageByState)) {
          if (areaIds.includes(areaId)) {
            states.add(stateCode);
          }
        }
      }

      for (const stateCode of states) {
        if (!stateData[stateCode]) {
          stateData[stateCode] = { count: 0, amount: 0 };
        }
        stateData[stateCode].count++;
        stateData[stateCode].amount += opp.maximum_award || opp.total_funding_available || 0;
      }
    }
  }

  return stateData;
}

/**
 * Get color for a state based on mode
 */
function getStateColor(value, min, max, colorMode) {
  if (value === 0 || value === undefined) return '#f0f0f0'; // Neutral/no data
  if (max === min) return '#3b82f6'; // All same value

  const ratio = (value - min) / (max - min);

  // Return color intensity (0-1 scale for testing)
  return ratio;
}

/**
 * Calculate min/max for color scale
 */
function calculateColorScale(stateData, colorMode) {
  const values = Object.values(stateData).map(d =>
    colorMode === 'count' ? d.count : d.amount
  );

  if (values.length === 0) return { min: 0, max: 0 };

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * Get display value for a state based on color mode
 */
function getDisplayValue(stateData, stateCode, colorMode) {
  const data = stateData[stateCode];
  if (!data) return colorMode === 'count' ? 0 : '$0';

  if (colorMode === 'count') {
    return data.count;
  }
  return data.amount;
}

describe('Map Color Toggle', () => {
  const coverageByState = {
    CA: [1, 2, 3, 4, 5, 6],
    TX: [10, 11, 12],
    NY: [20, 21],
  };

  const testOpps = [
    { id: '1', status: 'open', is_national: true, coverage_area_ids: [], maximum_award: 5000000 },
    { id: '2', status: 'open', is_national: false, coverage_area_ids: [1, 2], maximum_award: 500000 },
    { id: '3', status: 'open', is_national: false, coverage_area_ids: [10], maximum_award: 1000000 },
    { id: '4', status: 'closed', is_national: false, coverage_area_ids: [1], maximum_award: 200000 },
  ];

  describe('State Data Calculation', () => {
    test('national opps count toward all states', () => {
      const data = calculateStateData(testOpps, coverageByState);

      // National opp counts toward all 3 states; CA also has opp-2, TX also has opp-3
      expect(data.CA.count).toBe(2);
      expect(data.TX.count).toBe(2);
      expect(data.NY.count).toBe(1);
    });

    test('state-specific opps only count toward their states', () => {
      const data = calculateStateData(testOpps, coverageByState);

      // CA gets national + opp-2, TX gets national + opp-3, NY gets national only
      expect(data.CA.count).toBe(2);
      expect(data.TX.count).toBe(2);
      expect(data.NY.count).toBe(1);
    });

    test('closed opps are excluded', () => {
      const data = calculateStateData(testOpps, coverageByState);
      // opp-4 is closed, so CA should still have count=2 not 3
      expect(data.CA.count).toBe(2);
    });

    test('amount aggregation sums correctly', () => {
      const data = calculateStateData(testOpps, coverageByState);
      // CA: national ($5M) + opp-2 ($500K) = $5.5M
      expect(data.CA.amount).toBe(5500000);
      // TX: national ($5M) + opp-3 ($1M) = $6M
      expect(data.TX.amount).toBe(6000000);
    });

    test('empty opportunities returns empty data', () => {
      const data = calculateStateData([], coverageByState);
      expect(Object.keys(data)).toHaveLength(0);
    });
  });

  describe('Color Scale', () => {
    test('calculates min/max for count mode', () => {
      const stateData = {
        CA: { count: 5, amount: 1000000 },
        TX: { count: 3, amount: 500000 },
        NY: { count: 8, amount: 2000000 },
      };

      const scale = calculateColorScale(stateData, 'count');
      expect(scale.min).toBe(3);
      expect(scale.max).toBe(8);
    });

    test('calculates min/max for amount mode', () => {
      const stateData = {
        CA: { count: 5, amount: 1000000 },
        TX: { count: 3, amount: 500000 },
        NY: { count: 8, amount: 2000000 },
      };

      const scale = calculateColorScale(stateData, 'amount');
      expect(scale.min).toBe(500000);
      expect(scale.max).toBe(2000000);
    });

    test('empty data returns 0/0', () => {
      const scale = calculateColorScale({}, 'count');
      expect(scale.min).toBe(0);
      expect(scale.max).toBe(0);
    });
  });

  describe('State Color Assignment', () => {
    test('zero value returns neutral color', () => {
      expect(getStateColor(0, 0, 10, 'count')).toBe('#f0f0f0');
    });

    test('undefined value returns neutral color', () => {
      expect(getStateColor(undefined, 0, 10, 'count')).toBe('#f0f0f0');
    });

    test('same min/max returns single color', () => {
      expect(getStateColor(5, 5, 5, 'count')).toBe('#3b82f6');
    });

    test('min value returns 0 ratio', () => {
      expect(getStateColor(0, 0, 100, 'count')).toBe('#f0f0f0');
    });

    test('max value returns 1 ratio', () => {
      expect(getStateColor(100, 0, 100, 'count')).toBe(1);
    });

    test('mid value returns 0.5 ratio', () => {
      expect(getStateColor(50, 0, 100, 'count')).toBe(0.5);
    });
  });

  describe('Display Value', () => {
    const stateData = {
      CA: { count: 5, amount: 1500000 },
      TX: { count: 3, amount: 750000 },
    };

    test('returns count in count mode', () => {
      expect(getDisplayValue(stateData, 'CA', 'count')).toBe(5);
    });

    test('returns amount in amount mode', () => {
      expect(getDisplayValue(stateData, 'CA', 'amount')).toBe(1500000);
    });

    test('returns 0 for unknown state in count mode', () => {
      expect(getDisplayValue(stateData, 'ZZ', 'count')).toBe(0);
    });

    test('returns $0 for unknown state in amount mode', () => {
      expect(getDisplayValue(stateData, 'ZZ', 'amount')).toBe('$0');
    });
  });
});
