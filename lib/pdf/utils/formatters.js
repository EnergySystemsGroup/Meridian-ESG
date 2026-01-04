/**
 * PDF Formatting Utilities
 *
 * Helper functions for formatting data in PDF exports
 */

/**
 * Format currency amount
 * @param {number} amount - The amount to format
 * @param {boolean} compact - Use compact notation (e.g., $1.5M)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, compact = false) {
  if (amount == null || isNaN(amount)) return 'N/A';

  if (compact) {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(1)}B`;
    }
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format funding range (min to max)
 * @param {number} min - Minimum amount
 * @param {number} max - Maximum amount
 * @returns {string} Formatted range string
 */
export function formatFundingRange(min, max) {
  const minVal = min || 0;
  const maxVal = max || 0;

  if (minVal === 0 && maxVal === 0) return 'Award amount not specified';
  if (minVal === 0) return `Up to ${formatCurrency(maxVal, true)}`;
  if (maxVal === 0) return `From ${formatCurrency(minVal, true)}`;
  if (minVal === maxVal) return formatCurrency(minVal, true);

  return `${formatCurrency(minVal, true)} - ${formatCurrency(maxVal, true)}`;
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {string} format - Format style ('short', 'medium', 'long')
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'medium') {
  if (!date) return 'N/A';

  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';

  const options = {
    short: { month: 'numeric', day: 'numeric' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
  };

  return d.toLocaleDateString('en-US', options[format] || options.medium);
}

/**
 * Calculate days remaining until deadline
 * @param {string|Date} deadline - The deadline date
 * @returns {number} Days remaining (negative if past)
 */
export function getDaysRemaining(deadline) {
  if (!deadline) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  const diffTime = deadlineDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format deadline with days remaining
 * @param {string|Date} deadline - The deadline date
 * @returns {object} { text: string, daysRemaining: number, urgency: string }
 */
export function formatDeadline(deadline) {
  if (!deadline) {
    return { text: 'No deadline', daysRemaining: null, urgency: 'none' };
  }

  const daysRemaining = getDaysRemaining(deadline);
  const dateStr = formatDate(deadline, 'medium');

  let urgency = 'normal';
  let suffix = '';

  if (daysRemaining === null) {
    return { text: dateStr, daysRemaining: null, urgency: 'none' };
  }

  if (daysRemaining < 0) {
    suffix = ` (${Math.abs(daysRemaining)} days ago)`;
    urgency = 'past';
  } else if (daysRemaining === 0) {
    suffix = ' (Today!)';
    urgency = 'critical';
  } else if (daysRemaining === 1) {
    suffix = ' (Tomorrow!)';
    urgency = 'critical';
  } else if (daysRemaining < 14) {
    suffix = ` (${daysRemaining} days)`;
    urgency = 'critical';
  } else if (daysRemaining <= 30) {
    suffix = ` (${daysRemaining} days)`;
    urgency = 'warning';
  } else {
    suffix = ` (${daysRemaining} days)`;
    urgency = 'normal';
  }

  return {
    text: `${dateStr}${suffix}`,
    daysRemaining,
    urgency,
  };
}

/**
 * Format match score as percentage
 * @param {number} score - Score value (0-100)
 * @returns {string} Formatted percentage
 */
export function formatMatchScore(score) {
  if (score == null || isNaN(score)) return 'N/A';
  return `${Math.round(score)}%`;
}

/**
 * Get score level category
 * @param {number} score - Score value (0-100)
 * @returns {string} 'high' | 'medium' | 'low'
 */
export function getScoreLevel(score) {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/**
 * Derive source type from agency name when source_type is not available
 * @param {string} agencyName - The agency name
 * @returns {string} Derived source type
 */
export function deriveSourceTypeFromAgency(agencyName) {
  if (!agencyName) return 'Other';

  const name = agencyName.toLowerCase();

  // Federal agencies
  const federalPatterns = [
    'department of energy',
    'doe ',
    'national science foundation',
    'nsf',
    'national institutes of health',
    'nih',
    'u.s.',
    'u.s ',
    'us department',
    'us embassy',
    'us mission',
    'arpa-e',
    'arpa ',
    'advanced research projects agency',
    'engineer research and development center',
    'national energy technology',
    'federal',
    'epa',
    'environmental protection agency',
    'fema',
    'usda',
    'department of agriculture',
    'department of interior',
    'department of commerce',
    'department of transportation', // Federal DOT (check for state prefix first)
    'bureau of',
    'national oceanic',
    'noaa',
  ];

  // State agencies (California-specific patterns)
  const statePatterns = [
    'california',
    'ca ',
    'ca energy',
    'state of',
    'state water',
    'state treasurer',
    'state library',
    'conservancy',
    'air resources board',
    'pollution control',
    'housing and community development',
    'parks and recreation',
    'fish and wildlife',
    'resources recycling',
    'employment development',
    'ocean protection',
    'governor\'s office',
    'caltrans',
    'economic development bank',
  ];

  // Utility patterns
  const utilityPatterns = [
    'electric',
    'gas & electric',
    'gas and electric',
    'utility',
    'utilities',
    'power company',
    'energy company',
    'pg&e',
    'sce',
    'sdg&e',
    'ladwp',
    'smud',
  ];

  // Foundation patterns
  const foundationPatterns = [
    'foundation',
    'trust',
    'endowment',
    'charitable',
    'philanthrop',
  ];

  // Local patterns
  const localPatterns = [
    'city of',
    'county of',
    'municipal',
    'town of',
    'district',
  ];

  // Check patterns in order of specificity
  // First check for state (California) to avoid false positives with federal
  for (const pattern of statePatterns) {
    if (name.includes(pattern)) return 'State';
  }

  // Then check federal
  for (const pattern of federalPatterns) {
    if (name.includes(pattern)) return 'Federal';
  }

  // Check utility
  for (const pattern of utilityPatterns) {
    if (name.includes(pattern)) return 'Utility';
  }

  // Check foundation
  for (const pattern of foundationPatterns) {
    if (name.includes(pattern)) return 'Foundation';
  }

  // Check local
  for (const pattern of localPatterns) {
    if (name.includes(pattern)) return 'Local';
  }

  return 'Other';
}

/**
 * Format source type for display
 * @param {string} sourceType - The source type (may be null)
 * @param {string} agencyName - The agency name (fallback for deriving type)
 * @returns {string} Formatted source type
 */
export function formatSourceType(sourceType, agencyName = '') {
  // If we have a valid source type, use it
  if (sourceType) {
    const type = sourceType.toLowerCase();

    if (type.includes('federal')) return 'Federal';
    if (type.includes('state')) return 'State';
    if (type.includes('utility')) return 'Utility';
    if (type.includes('foundation')) return 'Foundation';
    if (type.includes('local')) return 'Local';

    // If it's a meaningful value, capitalize and return
    if (type !== 'other' && type !== 'unknown') {
      return sourceType.charAt(0).toUpperCase() + sourceType.slice(1);
    }
  }

  // Derive from agency name as fallback
  return deriveSourceTypeFromAgency(agencyName);
}

/**
 * Format status for display
 * @param {string} status - The status value
 * @returns {object} { text: string, color: string }
 */
export function formatStatus(status) {
  const statusMap = {
    open: { text: 'Open', color: '#22C55E' },
    upcoming: { text: 'Upcoming', color: '#3B82F6' },
    closed: { text: 'Closed', color: '#6B7280' },
    forecasted: { text: 'Forecasted', color: '#8B5CF6' },
  };

  const key = (status || '').toLowerCase();
  return statusMap[key] || { text: status || 'Unknown', color: '#6B7280' };
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 200) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format cost share information
 * @param {boolean} required - Whether cost share is required
 * @param {number} percentage - Cost share percentage
 * @returns {string} Formatted cost share text
 */
export function formatCostShare(required, percentage) {
  if (!required) return 'None required';
  if (percentage) return `${percentage}% required`;
  return 'Required (check details)';
}

/**
 * Calculate total funding available from matches
 * @param {Array} matches - Array of opportunity matches
 * @returns {object} { min: number, max: number }
 */
export function calculateTotalFunding(matches) {
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return { min: 0, max: 0 };
  }

  let totalMin = 0;
  let totalMax = 0;

  matches.forEach((match) => {
    const min = match.minimum_award || match.min_amount || 0;
    const max = match.maximum_award || match.max_amount || 0;
    totalMin += min;
    totalMax += max;
  });

  return { min: totalMin, max: totalMax };
}

/**
 * Format total funding summary
 * @param {Array} matches - Array of opportunity matches
 * @returns {string} Formatted funding summary
 */
export function formatTotalFundingSummary(matches) {
  const { min, max } = calculateTotalFunding(matches);

  if (min === 0 && max === 0) return 'Award amount not specified';

  // For summary, just show the max available
  if (max > 0) {
    return `${formatCurrency(max, true)} available`;
  }

  return formatFundingRange(min, max);
}
