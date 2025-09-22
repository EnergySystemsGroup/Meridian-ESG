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
 * Get match score background color for badges
 */
export function getMatchScoreBgColor(score) {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200';
  if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200';
  if (score >= 40) return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200';
  return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200';
}

/**
 * Format client type for display
 */
export function formatClientType(type) {
  return type;
}

/**
 * Format project needs for display
 */
export function formatProjectNeeds(projectNeeds) {
  if (!projectNeeds || !Array.isArray(projectNeeds)) return [];
  return projectNeeds;
}

/**
 * Generate client tags from client data
 */
export function generateClientTags(client) {
  const tags = [];

  // Add type
  if (client.type) {
    tags.push(client.type);
  }

  // Add location (state)
  if (client.location) {
    tags.push(client.location);
  }

  // Add budget if available
  if (client.budget) {
    const budgetLabels = {
      small: 'Small Budget',
      medium: 'Medium Budget',
      large: 'Large Budget',
      very_large: 'Very Large Budget'
    };
    tags.push(budgetLabels[client.budget] || client.budget);
  }

  return tags;
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