/**
 * Date Test Helpers
 *
 * Utilities for date-related test assertions and data generation.
 * Complements the testUtils.freezeTime/restoreTime from setup.js.
 */

/**
 * Create a date string N days from a reference date
 * @param {number} days - Days offset (positive = future, negative = past)
 * @param {string|Date} from - Reference date (defaults to now)
 * @returns {string} ISO date string
 */
export function daysFrom(days, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Create a full ISO timestamp N days from a reference date
 */
export function daysFromTimestamp(days, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Create a date string N months from a reference date
 */
export function monthsFrom(months, from = new Date()) {
  const date = new Date(from);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

/**
 * Calculate days between two dates
 */
export function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diff = Math.abs(b.getTime() - a.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date string is a valid ISO date
 */
export function isValidIsoDate(str) {
  if (!str || typeof str !== 'string') return false;
  const date = new Date(str);
  return !isNaN(date.getTime());
}

/**
 * Check if a date string is in YYYY-MM-DD format
 */
export function isDateOnly(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && isValidIsoDate(str);
}

/**
 * Generate a range of dates for testing
 * @param {number} count - Number of dates
 * @param {number} intervalDays - Days between each date
 * @param {string|Date} start - Start date
 * @returns {string[]} Array of ISO date strings
 */
export function dateRange(count, intervalDays = 1, start = new Date()) {
  return Array.from({ length: count }, (_, i) =>
    daysFrom(i * intervalDays, start)
  );
}

/**
 * Create deadline scenarios relative to a frozen "now"
 * Returns objects with { date, daysLeft, label }
 */
export function createDeadlineSet(now = new Date()) {
  return {
    overdue: {
      date: daysFrom(-5, now),
      daysLeft: -5,
      label: 'Overdue',
    },
    today: {
      date: daysFrom(0, now),
      daysLeft: 0,
      label: 'Today',
    },
    thisWeek: {
      date: daysFrom(3, now),
      daysLeft: 3,
      label: 'This week',
    },
    nextWeek: {
      date: daysFrom(10, now),
      daysLeft: 10,
      label: 'Next week',
    },
    nextMonth: {
      date: daysFrom(35, now),
      daysLeft: 35,
      label: 'Next month',
    },
    farFuture: {
      date: daysFrom(180, now),
      daysLeft: 180,
      label: 'Far future',
    },
    noDeadline: {
      date: null,
      daysLeft: null,
      label: 'No deadline',
    },
  };
}

/**
 * Assert that a date is within N days of another date
 */
export function isWithinDays(dateA, dateB, maxDays) {
  return daysBetween(dateA, dateB) <= maxDays;
}
