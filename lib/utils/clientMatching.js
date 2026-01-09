/**
 * Client Matching Utilities
 *
 * Shared utilities for client-opportunity matching functionality
 */

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