/**
 * Shared client-opportunity matching module
 *
 * Single source of truth for the 4-criteria matching algorithm.
 * Used by all client-matching API routes.
 *
 * Criteria (all must pass):
 * 1. Location — coverage_area_ids intersection or is_national
 * 2. Applicant Type — expanded types with normalizeType for plural tolerance
 * 3. Project Needs — substring matching against eligible_project_types
 * 4. Activities — must include at least one "hot" activity
 *
 * Score = percentage of client's project_needs that matched (0-100)
 */

/**
 * Normalize a type string for matching comparison.
 * Handles plurals, case, and common variations.
 *
 * @param {string} type - The type string to normalize
 * @returns {string} Normalized type string
 */
export function normalizeType(type) {
  if (!type) return '';
  return type
    .toLowerCase()
    .trim()
    .replace(/ies$/, 'y')              // agencies → agency, utilities → utility
    .replace(/(ch|sh|ss|x|z)es$/, '$1') // churches → church, businesses → business
    .replace(/s$/, '');                 // hospitals → hospital, governments → government
}

/**
 * Evaluate if an opportunity matches a client using all 4 criteria.
 *
 * @param {Object} client - Client record with type, coverage_area_ids, project_needs
 * @param {Object} opportunity - Opportunity with is_national, eligible_applicants, etc.
 * @param {Object} deps - Injected dependencies
 * @param {string[]} deps.hotActivities - List of hot activity strings
 * @param {Function} deps.getExpandedClientTypes - Function to expand client type to synonyms/hierarchy
 * @returns {{ isMatch: boolean, score: number, details: Object }}
 */
export function evaluateMatch(client, opportunity, { hotActivities, getExpandedClientTypes }) {
  const details = {
    locationMatch: false,
    applicantTypeMatch: false,
    projectNeedsMatch: false,
    activitiesMatch: false,
    matchedProjectNeeds: []
  };

  // 1. Location Match (using coverage_area_ids for precise geographic matching)
  if (opportunity.is_national) {
    details.locationMatch = true;
  } else if (
    client.coverage_area_ids && Array.isArray(client.coverage_area_ids) &&
    opportunity.coverage_area_ids && Array.isArray(opportunity.coverage_area_ids)
  ) {
    details.locationMatch = client.coverage_area_ids.some(clientAreaId =>
      opportunity.coverage_area_ids.includes(clientAreaId)
    );
  }

  // 2. Applicant Type Match (with synonym/hierarchy expansion + normalizeType)
  if (opportunity.eligible_applicants && Array.isArray(opportunity.eligible_applicants)) {
    const expandedTypes = getExpandedClientTypes(client.type);
    details.applicantTypeMatch = opportunity.eligible_applicants.some(applicant => {
      const normalizedApplicant = normalizeType(applicant);
      return expandedTypes.some(clientType => {
        const normalizedClient = normalizeType(clientType);
        return (
          normalizedApplicant === normalizedClient ||
          normalizedApplicant.includes(normalizedClient) ||
          normalizedClient.includes(normalizedApplicant)
        );
      });
    });
  }

  // 3. Project Needs Match
  if (
    opportunity.eligible_project_types && Array.isArray(opportunity.eligible_project_types) &&
    client.project_needs && Array.isArray(client.project_needs)
  ) {
    for (const need of client.project_needs) {
      const hasMatch = opportunity.eligible_project_types.some(projectType =>
        projectType.toLowerCase().includes(need.toLowerCase()) ||
        need.toLowerCase().includes(projectType.toLowerCase())
      );
      if (hasMatch) {
        details.matchedProjectNeeds.push(need);
      }
    }
    details.projectNeedsMatch = details.matchedProjectNeeds.length > 0;
  }

  // 4. Activities Match (must include at least one "hot" activity)
  if (opportunity.eligible_activities && Array.isArray(opportunity.eligible_activities)) {
    details.activitiesMatch = opportunity.eligible_activities.some(activity =>
      hotActivities.some(hotActivity =>
        activity.toLowerCase().includes(hotActivity.toLowerCase()) ||
        hotActivity.toLowerCase().includes(activity.toLowerCase())
      )
    );
  }

  const isMatch = details.locationMatch &&
                  details.applicantTypeMatch &&
                  details.projectNeedsMatch &&
                  details.activitiesMatch;

  let score = 0;
  if (isMatch && client.project_needs && client.project_needs.length > 0) {
    score = Math.round((details.matchedProjectNeeds.length / client.project_needs.length) * 100);
  }

  return { isMatch, score, details };
}
