/**
 * Client Matching Utilities
 *
 * Shared utilities for client-opportunity matching functionality
 */

import { FUNDING_TYPE_GROUPS } from '@/lib/constants/taxonomies';

/**
 * Fetch matches for a specific client or all clients
 */
export async function fetchClientMatches(clientId = null) {
  try {
    const url = clientId
      ? `/api/client-matching?clientId=${clientId}`
      : '/api/client-matching';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch matches: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch matches');
    }

    return data.results;
  } catch (error) {
    console.error('Error fetching client matches:', error);
    throw error;
  }
}

/**
 * Format match score for display
 */
export function formatMatchScore(score) {
  return `${score}%`;
}

/**
 * Get match score color based on percentage
 */
export function getMatchScoreColor(score) {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get match score background color for badges - color-coded by performance
 * Using inline styles to avoid Tailwind JIT issues with dynamic classes
 */
export function getMatchScoreBgColor(score) {
  // Higher percentages (60%+) = vibrant purple with white text
  if (score >= 60) return { backgroundColor: '#9333ea', color: 'white' }; // purple-600
  // Medium percentages (30-59%) = amber/orange with white text
  if (score >= 30) return { backgroundColor: '#f59e0b', color: 'white' }; // amber-500
  // Lower percentages (<30%) = gray with white text
  return { backgroundColor: '#6b7280', color: 'white' }; // gray-500
}

/**
 * Format project needs for display
 */
export function formatProjectNeeds(projectNeeds) {
  if (!projectNeeds || !Array.isArray(projectNeeds)) return [];
  return projectNeeds;
}

/**
 * Generate client tags from match data
 * Shows project types by match count, sorted descending
 * @param {Object} client - Client object
 * @param {Array} matches - Array of match objects with matchDetails
 * @param {number|null} limit - Max tags to return (default 3, null = all)
 * @returns {Array} Array of tag strings formatted as "Project Need (count)"
 */
export function generateClientTags(client, matches = [], limit = 3) {
  // Return empty array if no matches
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    return [];
  }

  // Count occurrences of each matched project need
  const projectNeedCounts = new Map();

  matches.forEach(match => {
    // Get matched project needs from match details
    const matchedNeeds = match.matchDetails?.matchedProjectNeeds || [];

    matchedNeeds.forEach(need => {
      const currentCount = projectNeedCounts.get(need) || 0;
      projectNeedCounts.set(need, currentCount + 1);
    });
  });

  // Convert to array of [need, count] pairs and sort by count descending
  const sortedNeeds = Array.from(projectNeedCounts.entries())
    .sort((a, b) => b[1] - a[1]); // Sort by count descending

  // Take top N (or all if limit is null/0)
  const limitedNeeds = limit ? sortedNeeds.slice(0, limit) : sortedNeeds;

  return limitedNeeds.map(([need, count]) => `${need} (${count})`);
}

/**
 * Generate project needs with match counts (merged view)
 * @param {Array} projectNeeds - Client's project_needs array
 * @param {Array} matches - Array of match objects with matchDetails
 * @returns {Array} Array of { need, count } objects
 */
export function generateProjectNeedsWithCounts(projectNeeds, matches = []) {
  if (!projectNeeds || !Array.isArray(projectNeeds) || projectNeeds.length === 0) return [];

  // Build match count map
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
 * Get relevance score from an opportunity, with fallbacks
 */
function getRelevanceScore(opportunity) {
  return opportunity.relevance_score
    || opportunity.scoring?.finalScore
    || opportunity.scoring?.overallScore
    || 0;
}

/**
 * Group matches by funding type category, sorted by relevance within each group
 * @param {Array} matches - Array of match/opportunity objects
 * @returns {Array} Array of { key, label, description, matches } group objects (non-empty only)
 */
export function groupMatchesByFundingType(matches) {
  if (!matches || !Array.isArray(matches) || matches.length === 0) return [];

  // Build a lookup: funding type string (lowercased) → group index
  const typeToGroup = new Map();
  FUNDING_TYPE_GROUPS.forEach((group, index) => {
    group.types.forEach(type => typeToGroup.set(type.toLowerCase(), index));
  });
  // Alias stale values to their correct group
  typeToGroup.set('rebate', typeToGroup.get('incentive'));

  // Distribute matches into groups
  const groups = FUNDING_TYPE_GROUPS.map(g => ({ ...g, matches: [] }));

  matches.forEach(match => {
    const fundingType = (match.funding_type || '').toLowerCase();
    const groupIndex = typeToGroup.has(fundingType) ? typeToGroup.get(fundingType) : groups.length - 1;
    groups[groupIndex].matches.push(match);
  });

  // Sort within each group by relevance_score descending
  groups.forEach(group => {
    group.matches.sort((a, b) => getRelevanceScore(b) - getRelevanceScore(a));
  });

  // Return only non-empty groups
  return groups.filter(g => g.matches.length > 0);
}

/**
 * Get match score badge inline styles (border-only pill style)
 * Uses inline styles to avoid Tailwind JIT purging dynamic classes (e.g. violet-*)
 */
export function getMatchScoreBadgeStyles(score) {
  if (score >= 60) return { backgroundColor: '#f5f3ff', color: '#6d28d9', border: '1px solid #c4b5fd' }; // violet-50/700/300
  if (score >= 30) return { backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d' }; // amber-50/700/300
  return { backgroundColor: '#f9fafb', color: '#6b7280', border: '1px solid #d1d5db' }; // neutral-50/500/300
}

/**
 * Get color for funding type group header dots (inline style to avoid Tailwind JIT issues)
 */
export function getFundingGroupDotColor(key) {
  const colors = {
    grants: '#10b981',      // emerald-500
    incentives: '#8b5cf6',  // violet-500
    tax: '#f59e0b',         // amber-500
    loans: '#3b82f6',       // blue-500
    other: '#a3a3a3',       // neutral-400
  };
  return colors[key] || colors.other;
}

/**
 * Format match details for debugging/display
 */
export function formatMatchDetails(matchDetails) {
  if (!matchDetails) return 'No match details available';

  const details = [];

  if (matchDetails.locationMatch) {
    details.push('✓ Location eligible');
  }

  if (matchDetails.applicantTypeMatch) {
    details.push('✓ Applicant type eligible');
  }

  if (matchDetails.projectNeedsMatch) {
    details.push(`✓ ${matchDetails.matchedProjectNeeds?.length || 0} project needs matched`);
  }

  if (matchDetails.activitiesMatch) {
    details.push('✓ Construction activities supported');
  }

  return details.join(', ');
}