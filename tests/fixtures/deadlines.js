/**
 * Deadline Test Fixtures
 *
 * Sample deadline scenarios for testing days-left calculations and color coding.
 */

/**
 * Create a date string relative to a base date
 * @param {Date} baseDate - Reference date
 * @param {number} daysOffset - Days to add/subtract
 */
function offsetDate(baseDate, daysOffset) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

/**
 * Generate deadline scenarios relative to "now"
 * Use with vi.useFakeTimers() to control "now"
 */
export function createDeadlineScenarios(baseDate = new Date()) {
  return {
    // Red zone: 0-3 days (urgent)
    today: {
      close_date: offsetDate(baseDate, 0),
      expectedDaysLeft: 0,
      expectedColor: 'red',
      label: 'Due today',
    },
    tomorrow: {
      close_date: offsetDate(baseDate, 1),
      expectedDaysLeft: 1,
      expectedColor: 'red',
      label: 'Due tomorrow',
    },
    in2Days: {
      close_date: offsetDate(baseDate, 2),
      expectedDaysLeft: 2,
      expectedColor: 'red',
      label: '2 days left',
    },
    in3Days: {
      close_date: offsetDate(baseDate, 3),
      expectedDaysLeft: 3,
      expectedColor: 'red',
      label: '3 days left (boundary)',
    },

    // Orange zone: 4-7 days (warning)
    in4Days: {
      close_date: offsetDate(baseDate, 4),
      expectedDaysLeft: 4,
      expectedColor: 'orange',
      label: '4 days left',
    },
    in7Days: {
      close_date: offsetDate(baseDate, 7),
      expectedDaysLeft: 7,
      expectedColor: 'orange',
      label: '7 days left (boundary)',
    },

    // Yellow zone: 8-14 days (attention)
    in8Days: {
      close_date: offsetDate(baseDate, 8),
      expectedDaysLeft: 8,
      expectedColor: 'yellow',
      label: '8 days left',
    },
    in14Days: {
      close_date: offsetDate(baseDate, 14),
      expectedDaysLeft: 14,
      expectedColor: 'yellow',
      label: '14 days left (boundary)',
    },

    // Green zone: 15+ days (normal)
    in15Days: {
      close_date: offsetDate(baseDate, 15),
      expectedDaysLeft: 15,
      expectedColor: 'green',
      label: '15 days left',
    },
    in30Days: {
      close_date: offsetDate(baseDate, 30),
      expectedDaysLeft: 30,
      expectedColor: 'green',
      label: '30 days left',
    },
    in90Days: {
      close_date: offsetDate(baseDate, 90),
      expectedDaysLeft: 90,
      expectedColor: 'green',
      label: '90 days left',
    },
    in365Days: {
      close_date: offsetDate(baseDate, 365),
      expectedDaysLeft: 365,
      expectedColor: 'green',
      label: '1 year left',
    },

    // Past deadlines (negative days)
    yesterday: {
      close_date: offsetDate(baseDate, -1),
      expectedDaysLeft: -1,
      expectedColor: 'gray',
      label: 'Past deadline',
    },
    lastWeek: {
      close_date: offsetDate(baseDate, -7),
      expectedDaysLeft: -7,
      expectedColor: 'gray',
      label: 'Expired last week',
    },

    // Edge cases
    nullDeadline: {
      close_date: null,
      expectedDaysLeft: null,
      expectedColor: 'gray',
      label: 'No deadline',
    },
    undefinedDeadline: {
      close_date: undefined,
      expectedDaysLeft: null,
      expectedColor: 'gray',
      label: 'Undefined deadline',
    },
  };
}

/**
 * Static deadline fixtures for consistent testing
 * Uses fixed dates that can be compared against frozen time
 */
export const staticDeadlines = {
  // Fixed date: January 15, 2025
  baseDate: '2025-01-15T12:00:00Z',

  opportunities: [
    {
      id: 'deadline-red-1',
      title: 'Urgent Grant - Due Tomorrow',
      close_date: '2025-01-16T23:59:59Z', // 1 day from base
      expectedDaysLeft: 1,
      expectedColor: 'red',
    },
    {
      id: 'deadline-red-2',
      title: 'Very Urgent - Due Today',
      close_date: '2025-01-15T23:59:59Z', // Same day
      expectedDaysLeft: 0,
      expectedColor: 'red',
    },
    {
      id: 'deadline-orange-1',
      title: 'Warning Zone Grant',
      close_date: '2025-01-20T23:59:59Z', // 5 days from base
      expectedDaysLeft: 5,
      expectedColor: 'orange',
    },
    {
      id: 'deadline-yellow-1',
      title: 'Attention Zone Grant',
      close_date: '2025-01-25T23:59:59Z', // 10 days from base
      expectedDaysLeft: 10,
      expectedColor: 'yellow',
    },
    {
      id: 'deadline-green-1',
      title: 'Normal Zone Grant',
      close_date: '2025-02-15T23:59:59Z', // 31 days from base
      expectedDaysLeft: 31,
      expectedColor: 'green',
    },
    {
      id: 'deadline-null',
      title: 'Ongoing Program',
      close_date: null,
      expectedDaysLeft: null,
      expectedColor: 'gray',
    },
    {
      id: 'deadline-past',
      title: 'Expired Grant',
      close_date: '2025-01-10T23:59:59Z', // 5 days before base
      expectedDaysLeft: -5,
      expectedColor: 'gray',
    },
  ],
};

/**
 * Get deadline opportunities sorted by days left
 */
export function getDeadlinesSortedByUrgency(opportunities = staticDeadlines.opportunities) {
  return [...opportunities].sort((a, b) => {
    // Nulls go to end
    if (a.expectedDaysLeft === null && b.expectedDaysLeft === null) return 0;
    if (a.expectedDaysLeft === null) return 1;
    if (b.expectedDaysLeft === null) return -1;
    // Sort by days ascending (most urgent first)
    return a.expectedDaysLeft - b.expectedDaysLeft;
  });
}

/**
 * Color thresholds (matching production code)
 */
export const colorThresholds = {
  red: { min: null, max: 3 }, // 0-3 days
  orange: { min: 4, max: 7 }, // 4-7 days
  yellow: { min: 8, max: 14 }, // 8-14 days
  green: { min: 15, max: null }, // 15+ days
  gray: 'past or null', // Past deadlines or no deadline
};

/**
 * Get expected color for days left value
 */
export function getExpectedColor(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return 'gray';
  if (daysLeft < 0) return 'gray';
  if (daysLeft <= 3) return 'red';
  if (daysLeft <= 7) return 'orange';
  if (daysLeft <= 14) return 'yellow';
  return 'green';
}

export default { createDeadlineScenarios, staticDeadlines, colorThresholds, getExpectedColor };
