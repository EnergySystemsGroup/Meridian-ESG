/**
 * Match Scenario Test Fixtures
 *
 * Pre-defined scenarios for testing client-opportunity matching edge cases.
 * Each scenario includes expected outcomes for test assertions.
 */

import { clients } from './clients.js';
import { opportunities } from './opportunities.js';

export const matchScenarios = {
  /**
   * Scenario: National opportunity matches all clients
   * Expected: All clients match because is_national = true
   */
  nationalMatchesAll: {
    name: 'National opportunity matches all clients',
    client: clients.pgeBayAreaClient,
    opportunity: opportunities.nationalGrant,
    expected: {
      isMatch: true,
      details: {
        locationMatch: true, // is_national = true
        applicantTypeMatch: true, // Local Governments includes Municipal Government
        projectNeedsMatch: true, // Energy Efficiency, Solar overlap
        activitiesMatch: true, // Construction, Installation are hot activities
      },
    },
  },

  /**
   * Scenario: Coverage area intersection match
   * Expected: Match because client and opportunity share coverage_area_ids
   */
  coverageAreaIntersection: {
    name: 'Coverage area intersection creates match',
    client: clients.pgeBayAreaClient, // coverage_area_ids: [1, 2, 3]
    opportunity: opportunities.pgeUtilityGrant, // coverage_area_ids: [1, 2, 7]
    expected: {
      isMatch: true,
      details: {
        locationMatch: true, // IDs 1 and 2 overlap
        applicantTypeMatch: true, // Municipal Governments included
        projectNeedsMatch: true, // Energy Efficiency overlaps
        activitiesMatch: true, // Equipment Purchase, Installation are hot
      },
    },
  },

  /**
   * Scenario: No coverage area overlap
   * Expected: No match because coverage areas don't intersect
   */
  noCoverageOverlap: {
    name: 'No coverage area overlap prevents match',
    client: clients.pgeBayAreaClient, // CA coverage areas
    opportunity: opportunities.texasOnlyGrant, // TX coverage areas
    expected: {
      isMatch: false,
      details: {
        locationMatch: false, // No intersection
        applicantTypeMatch: false, // Commercial not in Municipal hierarchy
        projectNeedsMatch: false, // PG&E client needs (Energy Efficiency, Solar, EV Charging) don't match TX grant (HVAC, Lighting, Building Controls)
        activitiesMatch: true, // Installation IS in hot activities!
      },
    },
  },

  /**
   * Scenario: Synonym-based applicant type match
   * Expected: "City Government" matches "Municipal Governments" via synonyms
   */
  synonymApplicantMatch: {
    name: 'Synonym expansion enables applicant type match',
    client: clients.cityGovernmentClient, // type: "City Government"
    opportunity: opportunities.californiaStateGrant, // eligible: "Local Governments"
    expected: {
      isMatch: true,
      details: {
        locationMatch: true, // CA state coverage
        applicantTypeMatch: true, // City Government → Municipal Government → Local Governments
        projectNeedsMatch: true, // Solar, EV Charging overlap
        activitiesMatch: true, // Construction, Implementation are hot
      },
    },
  },

  /**
   * Scenario: Hierarchy-based applicant type match
   * Expected: "Township Government" matches via parent "Local Governments"
   */
  hierarchyApplicantMatch: {
    name: 'Hierarchy expansion enables applicant type match',
    client: clients.townshipClient, // type: "Township Government"
    opportunity: opportunities.californiaStateGrant, // eligible: "Local Governments"
    expected: {
      isMatch: true,
      details: {
        locationMatch: true, // CA state coverage
        applicantTypeMatch: true, // Township → Municipal → Local Governments
        projectNeedsMatch: true, // Building Envelope overlaps
        activitiesMatch: true, // Construction is hot
      },
    },
  },

  /**
   * Scenario: No hot activities prevents match
   * Expected: No match because opportunity only has planning activities
   */
  noHotActivitiesFail: {
    name: 'Lack of hot activities prevents match',
    client: clients.schoolDistrictClient, // School District
    opportunity: opportunities.noHotActivitiesGrant, // Only planning activities
    expected: {
      isMatch: false,
      details: {
        locationMatch: true, // CA state
        applicantTypeMatch: true, // School Districts eligible
        projectNeedsMatch: true, // Solar matches
        activitiesMatch: false, // No hot activities!
      },
    },
  },

  /**
   * Scenario: Project needs partial match
   * Expected: Match with score based on partial overlap
   */
  partialProjectNeedsMatch: {
    name: 'Partial project needs creates match with reduced score',
    client: clients.hospitalClient, // needs: Energy Efficiency, Backup Power, HVAC
    opportunity: opportunities.pgeUtilityGrant, // types: Energy Efficiency, HVAC, Lighting
    expected: {
      isMatch: true,
      details: {
        locationMatch: true, // PG&E territory overlap
        applicantTypeMatch: true, // Hospitals eligible
        projectNeedsMatch: true, // Energy Efficiency, HVAC overlap (2 of 3)
        activitiesMatch: true, // Equipment Purchase, Installation are hot
      },
      expectedScore: 67, // 2 of 3 needs matched = ~67%
    },
  },

  /**
   * Scenario: Empty project needs results in no match
   * Expected: No match because client has no project needs
   */
  emptyProjectNeeds: {
    name: 'Empty project needs prevents match',
    client: clients.emptyNeedsClient, // project_needs: []
    opportunity: opportunities.nationalGrant,
    expected: {
      isMatch: false,
      details: {
        locationMatch: true, // National
        applicantTypeMatch: false, // Commercial doesn't match Local/State Govs
        projectNeedsMatch: false, // No needs to match
        activitiesMatch: true, // Has hot activities
      },
    },
  },

  /**
   * Scenario: School-specific opportunity
   * Expected: Only school districts match
   */
  schoolOnlyMatch: {
    name: 'School-specific opportunity only matches school districts',
    client: clients.schoolDistrictClient, // type: School District
    opportunity: opportunities.schoolOnlyGrant, // eligible: School Districts, K-12 Schools
    expected: {
      isMatch: true,
      details: {
        locationMatch: true, // National
        applicantTypeMatch: true, // School Districts directly eligible
        projectNeedsMatch: true, // Solar, HVAC, Building Envelope all match
        activitiesMatch: true, // Construction, Installation, Retrofit are hot
      },
    },
  },

  /**
   * Scenario: Utility client with grid modernization
   * Expected: Matches SCE grid modernization opportunity
   */
  utilityGridMatch: {
    name: 'Utility matches grid modernization opportunity',
    client: clients.sceUtilityClient, // type: Electric Utility, coverage: SCE areas
    opportunity: opportunities.sceUtilityGrant, // grid modernization in SCE territory
    expected: {
      isMatch: true,
      details: {
        locationMatch: true, // SCE coverage areas match
        applicantTypeMatch: true, // Electric Utilities eligible
        projectNeedsMatch: true, // Grid Modernization, Battery Storage overlap
        activitiesMatch: true, // Construction, Technology Deployment are hot
      },
    },
  },

  /**
   * Scenario: Closed opportunity matching behavior
   * Note: The matching logic itself doesn't check status - filtering happens
   * at the query level before matching. This tests that the matching logic
   * still works on closed opportunities (even though they're filtered out in production).
   */
  closedOpportunityMatching: {
    name: 'Closed opportunities still match when evaluated (filtering happens at query level)',
    client: clients.pgeBayAreaClient,
    opportunity: opportunities.closedOpportunity,
    expected: {
      // Matching logic doesn't check status - it evaluates the 4 criteria
      // In production, closed opportunities are filtered out before matching
      isMatch: true, // It DOES match because is_national=true, applicants include Local Govs, etc.
      details: {
        locationMatch: true, // is_national = true
        applicantTypeMatch: true, // Local Governments includes Municipal Government
        projectNeedsMatch: true, // Solar matches client's Solar need
        activitiesMatch: true, // Construction, Installation are hot
      },
    },
  },

  /**
   * Scenario: Applicant type requires normalization (plural handling)
   * Expected: "Utilities" matches client type "Utility" via normalization
   */
  pluralNormalization: {
    name: 'Plural normalization enables match',
    client: clients.sceUtilityClient, // type: "Electric Utility"
    opportunity: {
      ...opportunities.sceUtilityGrant,
      eligible_applicants: ['Electric Utilities'], // Plural form
    },
    expected: {
      isMatch: true,
      details: {
        applicantTypeMatch: true, // "Utilities" normalizes to "Utility"
      },
    },
  },
};

/**
 * Get all match scenarios as array
 */
export function getAllScenarios() {
  return Object.values(matchScenarios);
}

/**
 * Get scenarios that should result in a match
 */
export function getMatchingScenarios() {
  return getAllScenarios().filter((s) => s.expected.isMatch === true);
}

/**
 * Get scenarios that should NOT result in a match
 */
export function getNonMatchingScenarios() {
  return getAllScenarios().filter((s) => s.expected.isMatch === false);
}

/**
 * Get scenarios testing specific criteria
 */
export function getScenariosForCriteria(criteriaName) {
  return getAllScenarios().filter(
    (s) =>
      s.expected.details &&
      (s.expected.details[criteriaName] === true || s.expected.details[criteriaName] === false)
  );
}

export default matchScenarios;
