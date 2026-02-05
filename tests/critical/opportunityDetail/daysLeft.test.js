/**
 * Opportunity Detail - Days Left Tests
 *
 * Tests the days-left calculation for opportunity detail page:
 * - Days remaining calculation
 * - Urgency display
 * - Past deadline handling
 * - Null deadline handling
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Calculate days left until deadline
 */
function calculateDaysLeft(closeDate, now = new Date()) {
  if (!closeDate) return null;

  const deadline = new Date(closeDate);
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get urgency level based on days left
 */
function getUrgencyLevel(daysLeft) {
  if (daysLeft === null) return 'none';
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 3) return 'critical';
  if (daysLeft <= 7) return 'urgent';
  if (daysLeft <= 14) return 'attention';
  if (daysLeft <= 30) return 'upcoming';
  return 'normal';
}

/**
 * Format days left for display
 */
function formatDaysLeft(daysLeft) {
  if (daysLeft === null) return 'No deadline';
  if (daysLeft < 0) return `Closed ${Math.abs(daysLeft)} days ago`;
  if (daysLeft === 0) return 'Due today';
  if (daysLeft === 1) return '1 day left';
  return `${daysLeft} days left`;
}

describe('Opportunity Detail Days Left', () => {
  const baseDate = new Date('2025-01-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Days Calculation', () => {
    test('calculates positive days left', () => {
      expect(calculateDaysLeft('2025-01-20T23:59:59Z', baseDate)).toBe(6);
      expect(calculateDaysLeft('2025-01-16T12:00:00Z', baseDate)).toBe(1);
      expect(calculateDaysLeft('2025-02-15T12:00:00Z', baseDate)).toBe(31);
    });

    test('calculates same day as 1 day (due today counts as 1)', () => {
      // Same day but later = ceiling rounds up to 1
      const result = calculateDaysLeft('2025-01-15T23:59:59Z', baseDate);
      expect(result).toBe(1);
    });

    test('calculates exact same time as 0', () => {
      const result = calculateDaysLeft('2025-01-15T12:00:00Z', baseDate);
      expect(result).toBe(0);
    });

    test('calculates negative days for past deadlines', () => {
      expect(calculateDaysLeft('2025-01-14T12:00:00Z', baseDate)).toBe(-1);
      expect(calculateDaysLeft('2025-01-10T12:00:00Z', baseDate)).toBe(-5);
    });

    test('returns null for null deadline', () => {
      expect(calculateDaysLeft(null, baseDate)).toBeNull();
    });

    test('returns null for undefined deadline', () => {
      expect(calculateDaysLeft(undefined, baseDate)).toBeNull();
    });
  });

  describe('Urgency Levels', () => {
    test('critical (0-3 days)', () => {
      expect(getUrgencyLevel(0)).toBe('critical');
      expect(getUrgencyLevel(1)).toBe('critical');
      expect(getUrgencyLevel(2)).toBe('critical');
      expect(getUrgencyLevel(3)).toBe('critical');
    });

    test('urgent (4-7 days)', () => {
      expect(getUrgencyLevel(4)).toBe('urgent');
      expect(getUrgencyLevel(5)).toBe('urgent');
      expect(getUrgencyLevel(6)).toBe('urgent');
      expect(getUrgencyLevel(7)).toBe('urgent');
    });

    test('attention (8-14 days)', () => {
      expect(getUrgencyLevel(8)).toBe('attention');
      expect(getUrgencyLevel(10)).toBe('attention');
      expect(getUrgencyLevel(14)).toBe('attention');
    });

    test('upcoming (15-30 days)', () => {
      expect(getUrgencyLevel(15)).toBe('upcoming');
      expect(getUrgencyLevel(20)).toBe('upcoming');
      expect(getUrgencyLevel(30)).toBe('upcoming');
    });

    test('normal (31+ days)', () => {
      expect(getUrgencyLevel(31)).toBe('normal');
      expect(getUrgencyLevel(60)).toBe('normal');
      expect(getUrgencyLevel(365)).toBe('normal');
    });

    test('expired (negative days)', () => {
      expect(getUrgencyLevel(-1)).toBe('expired');
      expect(getUrgencyLevel(-30)).toBe('expired');
    });

    test('none (null days)', () => {
      expect(getUrgencyLevel(null)).toBe('none');
    });
  });

  describe('Display Formatting', () => {
    test('formats positive days', () => {
      expect(formatDaysLeft(5)).toBe('5 days left');
      expect(formatDaysLeft(30)).toBe('30 days left');
      expect(formatDaysLeft(365)).toBe('365 days left');
    });

    test('formats single day', () => {
      expect(formatDaysLeft(1)).toBe('1 day left');
    });

    test('formats due today', () => {
      expect(formatDaysLeft(0)).toBe('Due today');
    });

    test('formats past deadlines', () => {
      expect(formatDaysLeft(-1)).toBe('Closed 1 days ago');
      expect(formatDaysLeft(-7)).toBe('Closed 7 days ago');
    });

    test('formats null deadline', () => {
      expect(formatDaysLeft(null)).toBe('No deadline');
    });
  });

  describe('Integration Scenarios', () => {
    test('opportunity closing soon', () => {
      const opp = { close_date: '2025-01-17T23:59:59Z' };
      const daysLeft = calculateDaysLeft(opp.close_date, baseDate);
      const urgency = getUrgencyLevel(daysLeft);
      const display = formatDaysLeft(daysLeft);

      expect(daysLeft).toBe(3);
      expect(urgency).toBe('critical');
      expect(display).toBe('3 days left');
    });

    test('opportunity with no deadline', () => {
      const opp = { close_date: null };
      const daysLeft = calculateDaysLeft(opp.close_date, baseDate);
      const urgency = getUrgencyLevel(daysLeft);
      const display = formatDaysLeft(daysLeft);

      expect(daysLeft).toBeNull();
      expect(urgency).toBe('none');
      expect(display).toBe('No deadline');
    });

    test('expired opportunity', () => {
      const opp = { close_date: '2025-01-10T23:59:59Z' };
      const daysLeft = calculateDaysLeft(opp.close_date, baseDate);
      const urgency = getUrgencyLevel(daysLeft);
      const display = formatDaysLeft(daysLeft);

      expect(daysLeft).toBe(-4);
      expect(urgency).toBe('expired');
      expect(display).toBe('Closed 4 days ago');
    });

    test('opportunity far in future', () => {
      const opp = { close_date: '2025-12-31T23:59:59Z' };
      const daysLeft = calculateDaysLeft(opp.close_date, baseDate);
      const urgency = getUrgencyLevel(daysLeft);

      expect(daysLeft).toBeGreaterThan(300);
      expect(urgency).toBe('normal');
    });
  });

  describe('Edge Cases', () => {
    test('handles ISO date strings', () => {
      const result = calculateDaysLeft('2025-01-20T00:00:00.000Z', baseDate);
      expect(typeof result).toBe('number');
    });

    test('handles date objects', () => {
      const deadline = new Date('2025-01-20T12:00:00Z');
      const result = calculateDaysLeft(deadline, baseDate);
      expect(result).toBe(5);
    });

    test('handles end of month transitions', () => {
      vi.setSystemTime(new Date('2025-01-30T12:00:00Z'));
      const result = calculateDaysLeft('2025-02-05T12:00:00Z');
      expect(result).toBe(6);
    });

    test('handles year transitions', () => {
      vi.setSystemTime(new Date('2024-12-30T12:00:00Z'));
      const result = calculateDaysLeft('2025-01-05T12:00:00Z');
      expect(result).toBe(6);
    });
  });
});
