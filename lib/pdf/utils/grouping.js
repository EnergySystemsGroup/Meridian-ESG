/**
 * PDF Grouping Utilities
 *
 * Helper functions for organizing opportunities in PDF exports
 */

import { getDaysRemaining, getScoreLevel } from './formatters';

/**
 * Group opportunities by matched project needs
 * Each opportunity can appear in multiple groups if it matches multiple needs
 *
 * @param {Array} matches - Array of opportunity matches with matchDetails
 * @param {Array} clientProjectNeeds - Client's project needs to use for ordering
 * @returns {Array} Array of { projectNeed, opportunities }
 */
export function groupByProjectNeed(matches, clientProjectNeeds = []) {
  if (!matches || !Array.isArray(matches)) return [];

  // Build a map of project need -> opportunities
  const needsMap = new Map();

  matches.forEach((match) => {
    const matchedNeeds = match.matchDetails?.matchedProjectNeeds || [];

    // If no matched needs, put in "Other Matches"
    if (matchedNeeds.length === 0) {
      if (!needsMap.has('Other Matches')) {
        needsMap.set('Other Matches', []);
      }
      needsMap.get('Other Matches').push(match);
      return;
    }

    // Add to each matched need's group
    matchedNeeds.forEach((need) => {
      if (!needsMap.has(need)) {
        needsMap.set(need, []);
      }
      needsMap.get(need).push(match);
    });
  });

  // Convert to array and sort by client's project needs order, then alphabetically
  const result = Array.from(needsMap.entries()).map(([projectNeed, opportunities]) => ({
    projectNeed,
    opportunities,
  }));

  // Sort: client's needs first (in order), then others alphabetically
  result.sort((a, b) => {
    const aIndex = clientProjectNeeds.indexOf(a.projectNeed);
    const bIndex = clientProjectNeeds.indexOf(b.projectNeed);

    // Both in client needs - sort by client's order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }

    // Only a is in client needs - a comes first
    if (aIndex !== -1) return -1;

    // Only b is in client needs - b comes first
    if (bIndex !== -1) return 1;

    // Neither in client needs - alphabetical, but "Other Matches" last
    if (a.projectNeed === 'Other Matches') return 1;
    if (b.projectNeed === 'Other Matches') return -1;

    return a.projectNeed.localeCompare(b.projectNeed);
  });

  return result;
}

/**
 * Group opportunities by source type
 *
 * @param {Array} matches - Array of opportunity matches
 * @returns {Array} Array of { sourceType, opportunities }
 */
export function groupBySourceType(matches) {
  if (!matches || !Array.isArray(matches)) return [];

  const typeOrder = ['Federal', 'State', 'Utility', 'Foundation', 'Local', 'Other'];
  const typeMap = new Map();

  matches.forEach((match) => {
    const sourceType = normalizeSourceType(match.source_type);
    if (!typeMap.has(sourceType)) {
      typeMap.set(sourceType, []);
    }
    typeMap.get(sourceType).push(match);
  });

  // Convert to array and sort by predefined order
  const result = Array.from(typeMap.entries()).map(([sourceType, opportunities]) => ({
    sourceType,
    opportunities,
  }));

  result.sort((a, b) => {
    const aIndex = typeOrder.indexOf(a.sourceType);
    const bIndex = typeOrder.indexOf(b.sourceType);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return result;
}

/**
 * Normalize source type string
 */
function normalizeSourceType(sourceType) {
  if (!sourceType) return 'Other';

  const type = sourceType.toLowerCase();

  if (type.includes('federal')) return 'Federal';
  if (type.includes('state')) return 'State';
  if (type.includes('utility')) return 'Utility';
  if (type.includes('foundation')) return 'Foundation';
  if (type.includes('local')) return 'Local';

  return 'Other';
}

/**
 * Group opportunities by deadline urgency
 *
 * @param {Array} matches - Array of opportunity matches
 * @returns {Array} Array of { urgency, label, opportunities }
 */
export function groupByDeadline(matches) {
  if (!matches || !Array.isArray(matches)) return [];

  const groups = {
    critical: { label: 'Closing Within 2 Weeks', opportunities: [] },
    warning: { label: 'Closing Within 30 Days', opportunities: [] },
    normal: { label: 'Closing in 30+ Days', opportunities: [] },
    upcoming: { label: 'Upcoming (Not Yet Open)', opportunities: [] },
    noDeadline: { label: 'No Deadline Specified', opportunities: [] },
  };

  matches.forEach((match) => {
    const deadline = match.close_date;
    const status = (match.status || '').toLowerCase();

    if (status === 'upcoming' || status === 'forecasted') {
      groups.upcoming.opportunities.push(match);
      return;
    }

    if (!deadline) {
      groups.noDeadline.opportunities.push(match);
      return;
    }

    const daysRemaining = getDaysRemaining(deadline);

    if (daysRemaining !== null) {
      if (daysRemaining < 14) {
        groups.critical.opportunities.push(match);
      } else if (daysRemaining <= 30) {
        groups.warning.opportunities.push(match);
      } else {
        groups.normal.opportunities.push(match);
      }
    } else {
      groups.noDeadline.opportunities.push(match);
    }
  });

  // Convert to array, filter empty groups, maintain order
  return Object.entries(groups)
    .filter(([_, group]) => group.opportunities.length > 0)
    .map(([urgency, group]) => ({
      urgency,
      label: group.label,
      opportunities: group.opportunities,
    }));
}

/**
 * Group opportunities by match score
 *
 * @param {Array} matches - Array of opportunity matches
 * @returns {Array} Array of { level, label, opportunities }
 */
export function groupByMatchScore(matches) {
  if (!matches || !Array.isArray(matches)) return [];

  const groups = {
    high: { label: 'Strong Matches (60%+)', opportunities: [] },
    medium: { label: 'Good Matches (30-59%)', opportunities: [] },
    low: { label: 'Potential Matches (<30%)', opportunities: [] },
  };

  matches.forEach((match) => {
    const score = match.matchDetails?.score ?? match.relevance_score ?? 0;
    const level = getScoreLevel(score);
    groups[level].opportunities.push(match);
  });

  // Convert to array, filter empty groups, maintain order
  return Object.entries(groups)
    .filter(([_, group]) => group.opportunities.length > 0)
    .map(([level, group]) => ({
      level,
      label: group.label,
      opportunities: group.opportunities,
    }));
}

/**
 * Sort opportunities within a group
 *
 * @param {Array} opportunities - Array of opportunities to sort
 * @param {string} sortBy - Sort criteria: 'deadline', 'score', 'amount'
 * @returns {Array} Sorted opportunities
 */
export function sortOpportunities(opportunities, sortBy = 'deadline') {
  if (!opportunities || !Array.isArray(opportunities)) return [];

  const sorted = [...opportunities];

  switch (sortBy) {
    case 'deadline':
      // Sort by deadline, soonest first, nulls last
      sorted.sort((a, b) => {
        const aDeadline = a.close_date ? new Date(a.close_date).getTime() : Infinity;
        const bDeadline = b.close_date ? new Date(b.close_date).getTime() : Infinity;
        return aDeadline - bDeadline;
      });
      break;

    case 'score':
      // Sort by match score, highest first
      // Score comes directly from match object (from client-matching API)
      sorted.sort((a, b) => {
        const aScore = a.score ?? a.matchDetails?.score ?? a.relevance_score ?? 0;
        const bScore = b.score ?? b.matchDetails?.score ?? b.relevance_score ?? 0;
        return bScore - aScore;
      });
      break;

    case 'amount':
      // Sort by max amount, highest first
      sorted.sort((a, b) => {
        const aAmount = a.maximum_award || a.max_amount || 0;
        const bAmount = b.maximum_award || b.max_amount || 0;
        return bAmount - aAmount;
      });
      break;

    default:
      // Default to deadline
      sorted.sort((a, b) => {
        const aDeadline = a.close_date ? new Date(a.close_date).getTime() : Infinity;
        const bDeadline = b.close_date ? new Date(b.close_date).getTime() : Infinity;
        return aDeadline - bDeadline;
      });
  }

  return sorted;
}

/**
 * Deduplicate opportunities (used when same opp appears in multiple groups)
 *
 * @param {Array} opportunities - Array that may contain duplicates
 * @returns {Array} Deduplicated array
 */
export function deduplicateOpportunities(opportunities) {
  if (!opportunities || !Array.isArray(opportunities)) return [];

  const seen = new Set();
  return opportunities.filter((opp) => {
    if (seen.has(opp.id)) return false;
    seen.add(opp.id);
    return true;
  });
}

/**
 * Get summary statistics for matches
 *
 * @param {Array} matches - Array of opportunity matches
 * @returns {object} Statistics object
 */
export function getMatchStatistics(matches) {
  if (!matches || !Array.isArray(matches)) {
    return {
      total: 0,
      bySourceType: {},
      byUrgency: { critical: 0, warning: 0, normal: 0 },
      averageScore: 0,
    };
  }

  const stats = {
    total: matches.length,
    bySourceType: {},
    byUrgency: { critical: 0, warning: 0, normal: 0 },
    totalScore: 0,
  };

  matches.forEach((match) => {
    // Count by source type
    const sourceType = normalizeSourceType(match.source_type);
    stats.bySourceType[sourceType] = (stats.bySourceType[sourceType] || 0) + 1;

    // Count by urgency
    const deadline = match.close_date;
    if (deadline) {
      const daysRemaining = getDaysRemaining(deadline);
      if (daysRemaining !== null) {
        if (daysRemaining < 14) {
          stats.byUrgency.critical++;
        } else if (daysRemaining <= 30) {
          stats.byUrgency.warning++;
        } else {
          stats.byUrgency.normal++;
        }
      }
    }

    // Sum scores for average
    const score = match.matchDetails?.score ?? match.relevance_score ?? 0;
    stats.totalScore += score;
  });

  stats.averageScore = stats.total > 0 ? Math.round(stats.totalScore / stats.total) : 0;
  delete stats.totalScore;

  return stats;
}
