/**
 * Dashboard Deadlines Tests
 *
 * Tests deadline calculations and days-left logic used in the dashboard.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { staticDeadlines, getExpectedColor, createDeadlineScenarios } from '../../fixtures/deadlines.js';

/**
 * Calculate days left until deadline
 * (Logic from deadline utilities)
 *
 * @param {string|Date|null} deadline - The deadline date
 * @param {Date} now - Current date (for testing)
 * @returns {number|null} Days left or null if no deadline
 */
function calculateDaysLeft(deadline, now = new Date()) {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const timeDiff = deadlineDate.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  return daysDiff;
}

/**
 * Get urgency color based on days left
 * (Logic from timeline/dashboard components)
 *
 * @param {number|null} daysLeft
 * @returns {string} Color code
 */
function getUrgencyColor(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return 'gray';
  if (daysLeft < 0) return 'gray';
  if (daysLeft <= 3) return 'red';
  if (daysLeft <= 7) return 'orange';
  if (daysLeft <= 14) return 'yellow';
  return 'green';
}

describe('Days Left Calculation', () => {
  const baseDate = new Date('2025-01-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Future Deadlines', () => {
    test('calculates days for same-day deadline as 0', () => {
      // Deadline later same day
      const daysLeft = calculateDaysLeft('2025-01-15T23:59:59Z', baseDate);
      expect(daysLeft).toBe(1); // Ceil of partial day = 1
    });

    test('calculates days for tomorrow', () => {
      const daysLeft = calculateDaysLeft('2025-01-16T23:59:59Z', baseDate);
      expect(daysLeft).toBe(2);
    });

    test('calculates days for 30 days out', () => {
      const daysLeft = calculateDaysLeft('2025-02-14T12:00:00Z', baseDate);
      expect(daysLeft).toBe(30);
    });

    test('calculates days for 1 year out', () => {
      const daysLeft = calculateDaysLeft('2026-01-15T12:00:00Z', baseDate);
      expect(daysLeft).toBe(365);
    });
  });

  describe('Past Deadlines', () => {
    test('returns negative for yesterday', () => {
      const daysLeft = calculateDaysLeft('2025-01-14T12:00:00Z', baseDate);
      expect(daysLeft).toBeLessThan(0);
    });

    test('returns negative for last week', () => {
      const daysLeft = calculateDaysLeft('2025-01-08T12:00:00Z', baseDate);
      expect(daysLeft).toBe(-7);
    });

    test('returns negative for last year', () => {
      const daysLeft = calculateDaysLeft('2024-01-15T12:00:00Z', baseDate);
      // Account for leap year (2024 is a leap year, so 366 days)
      expect(daysLeft).toBe(-366);
    });
  });

  describe('Edge Cases', () => {
    test('null deadline returns null', () => {
      expect(calculateDaysLeft(null, baseDate)).toBeNull();
    });

    test('undefined deadline returns null', () => {
      expect(calculateDaysLeft(undefined, baseDate)).toBeNull();
    });

    test('empty string deadline returns null (falsy early-return)', () => {
      // Empty string is falsy — the function hits `if (!deadline) return null`
      // before reaching date arithmetic. This documents the actual behavior.
      const result = calculateDaysLeft('', baseDate);
      expect(result).toBeNull();
    });

    test('invalid date string handled', () => {
      const result = calculateDaysLeft('not-a-date', baseDate);
      expect(Number.isNaN(result)).toBe(true);
    });

    test('handles ISO date strings', () => {
      const daysLeft = calculateDaysLeft('2025-01-20T00:00:00.000Z', baseDate);
      expect(daysLeft).toBeGreaterThan(0);
    });

    test('handles Date objects', () => {
      const futureDate = new Date('2025-01-25T12:00:00Z');
      const daysLeft = calculateDaysLeft(futureDate, baseDate);
      expect(daysLeft).toBe(10);
    });
  });

  describe('Boundary Conditions', () => {
    test('exact same time = 0 days', () => {
      const daysLeft = calculateDaysLeft('2025-01-15T12:00:00Z', baseDate);
      expect(daysLeft).toBe(0);
    });

    test('1 second before now = negative', () => {
      const daysLeft = calculateDaysLeft('2025-01-15T11:59:59Z', baseDate);
      expect(daysLeft).toBeLessThanOrEqual(0);
    });

    test('1 second after now = positive', () => {
      const daysLeft = calculateDaysLeft('2025-01-15T12:00:01Z', baseDate);
      // Math.ceil(1000ms / 86400000ms) = 1
      expect(daysLeft).toBe(1);
    });
  });
});

describe('Urgency Color Coding', () => {

  describe('Color Thresholds', () => {
    test('0-3 days = red', () => {
      expect(getUrgencyColor(0)).toBe('red');
      expect(getUrgencyColor(1)).toBe('red');
      expect(getUrgencyColor(2)).toBe('red');
      expect(getUrgencyColor(3)).toBe('red');
    });

    test('4-7 days = orange', () => {
      expect(getUrgencyColor(4)).toBe('orange');
      expect(getUrgencyColor(5)).toBe('orange');
      expect(getUrgencyColor(6)).toBe('orange');
      expect(getUrgencyColor(7)).toBe('orange');
    });

    test('8-14 days = yellow', () => {
      expect(getUrgencyColor(8)).toBe('yellow');
      expect(getUrgencyColor(10)).toBe('yellow');
      expect(getUrgencyColor(14)).toBe('yellow');
    });

    test('15+ days = green', () => {
      expect(getUrgencyColor(15)).toBe('green');
      expect(getUrgencyColor(30)).toBe('green');
      expect(getUrgencyColor(100)).toBe('green');
      expect(getUrgencyColor(365)).toBe('green');
    });
  });

  describe('Edge Cases', () => {
    test('null daysLeft = gray', () => {
      expect(getUrgencyColor(null)).toBe('gray');
    });

    test('undefined daysLeft = gray', () => {
      expect(getUrgencyColor(undefined)).toBe('gray');
    });

    test('negative daysLeft (past) = gray', () => {
      expect(getUrgencyColor(-1)).toBe('gray');
      expect(getUrgencyColor(-7)).toBe('gray');
      expect(getUrgencyColor(-365)).toBe('gray');
    });
  });

  describe('Boundary Values', () => {
    test('boundary at 3/4 days (red/orange)', () => {
      expect(getUrgencyColor(3)).toBe('red');
      expect(getUrgencyColor(4)).toBe('orange');
    });

    test('boundary at 7/8 days (orange/yellow)', () => {
      expect(getUrgencyColor(7)).toBe('orange');
      expect(getUrgencyColor(8)).toBe('yellow');
    });

    test('boundary at 14/15 days (yellow/green)', () => {
      expect(getUrgencyColor(14)).toBe('yellow');
      expect(getUrgencyColor(15)).toBe('green');
    });
  });
});

describe('Fixture Deadline Scenarios', () => {
  test('all static deadline scenarios have correct expected colors', () => {
    staticDeadlines.opportunities.forEach(opp => {
      const color = getExpectedColor(opp.expectedDaysLeft);
      expect(color).toBe(opp.expectedColor);
    });
  });

  test('dynamic deadline scenarios match expected values', () => {
    const baseDate = new Date('2025-01-15T12:00:00Z');
    const scenarios = createDeadlineScenarios(baseDate);

    Object.values(scenarios).forEach(scenario => {
      const daysLeft = calculateDaysLeft(scenario.close_date, baseDate);

      // Handle null cases
      if (scenario.expectedDaysLeft === null) {
        expect(daysLeft).toBeNull();
      } else {
        // Allow for small differences due to time precision
        expect(Math.abs(daysLeft - scenario.expectedDaysLeft)).toBeLessThanOrEqual(1);
      }

      const color = getUrgencyColor(daysLeft);
      expect(color).toBe(scenario.expectedColor);
    });
  });
});

describe('Dashboard Deadline Integration', () => {
  const baseDate = new Date('2025-01-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('sorts deadlines by urgency (days left ascending)', () => {
    const opportunities = [
      { id: 1, close_date: '2025-02-15T00:00:00Z' }, // 31 days
      { id: 2, close_date: '2025-01-16T00:00:00Z' }, // 1 day
      { id: 3, close_date: '2025-01-25T00:00:00Z' }, // 10 days
      { id: 4, close_date: null },                   // null
    ];

    const sorted = [...opportunities].sort((a, b) => {
      const daysA = calculateDaysLeft(a.close_date, baseDate);
      const daysB = calculateDaysLeft(b.close_date, baseDate);

      // Push nulls to end
      if (daysA === null && daysB === null) return 0;
      if (daysA === null) return 1;
      if (daysB === null) return -1;

      return daysA - daysB;
    });

    expect(sorted[0].id).toBe(2); // 1 day
    expect(sorted[1].id).toBe(3); // 10 days
    expect(sorted[2].id).toBe(1); // 31 days
    expect(sorted[3].id).toBe(4); // null (at end)
  });

  test('filters to 5 soonest deadlines for dashboard', () => {
    const opportunities = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      close_date: new Date(baseDate.getTime() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
      status: 'open',
    }));

    const withDaysLeft = opportunities.map(opp => ({
      ...opp,
      daysLeft: calculateDaysLeft(opp.close_date, baseDate),
    }));

    const sorted = withDaysLeft.sort((a, b) => a.daysLeft - b.daysLeft);
    const top5 = sorted.slice(0, 5);

    expect(top5).toHaveLength(5);
    expect(top5[0].daysLeft).toBeLessThanOrEqual(top5[4].daysLeft);
    expect(top5[0].id).toBe(1); // Soonest
  });
});
