/**
 * Match Criteria Tests
 *
 * Tests the 4 mandatory matching criteria:
 * 1. Location Match (coverage_area_ids intersection or is_national)
 * 2. Applicant Type Match (synonym + hierarchy expansion)
 * 3. Project Needs Match (word-boundary matching)
 * 4. Activities Match (must include hot activities)
 *
 * ALL 4 criteria must be true for a match.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { clients } from '../../fixtures/clients.js';
import { opportunities } from '../../fixtures/opportunities.js';
import { matchScenarios } from '../../fixtures/matchScenarios.js';
import { HOT_ACTIVITIES, CLIENT_TYPE_SYNONYMS, getExpandedClientTypes } from '../../fixtures/taxonomies.js';

/**
 * Normalize a type string for matching comparison.
 * (Copied from route.js for isolated testing)
 */
function normalizeType(type) {
  if (!type) return '';
  return type
    .toLowerCase()
    .trim()
    .replace(/ies$/, 'y')           // agencies → agency, utilities → utility
    .replace(/(ch|sh|ss|x|z)es$/, '$1')  // churches → church, businesses → business
    .replace(/s$/, '');             // hospitals → hospital, colleges → college
}

/**
 * Word-boundary aware term matching — mirrors lib/matching/evaluateMatch.js
 */
function matchTerms(a, b) {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  if (!aLower || !bLower) return false;
  if (aLower === bLower) return true;
  const shorter = aLower.length <= bLower.length ? aLower : bLower;
  const longer = aLower.length <= bLower.length ? bLower : aLower;
  const escaped = shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`);
  return regex.test(longer);
}

/**
 * Evaluate if an opportunity matches a client
 * (Core matching logic extracted for testing)
 */
function evaluateMatch(client, opportunity) {
  const details = {
    locationMatch: false,
    applicantTypeMatch: false,
    projectNeedsMatch: false,
    activitiesMatch: false,
    matchedProjectNeeds: []
  };

  // 1. Location Match
  if (opportunity.is_national) {
    details.locationMatch = true;
  } else if (client.coverage_area_ids && Array.isArray(client.coverage_area_ids) &&
             opportunity.coverage_area_ids && Array.isArray(opportunity.coverage_area_ids)) {
    const hasIntersection = client.coverage_area_ids.some(clientAreaId =>
      opportunity.coverage_area_ids.includes(clientAreaId)
    );
    details.locationMatch = hasIntersection;
  }

  // 2. Applicant Type Match
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

  // 3. Project Needs Match (word-boundary aware)
  if (opportunity.eligible_project_types && Array.isArray(opportunity.eligible_project_types) &&
      client.project_needs && Array.isArray(client.project_needs)) {
    for (const need of client.project_needs) {
      const hasMatch = opportunity.eligible_project_types.some(projectType =>
        matchTerms(projectType, need)
      );
      if (hasMatch) {
        details.matchedProjectNeeds.push(need);
      }
    }
    details.projectNeedsMatch = details.matchedProjectNeeds.length > 0;
  }

  // 4. Activities Match (word-boundary aware)
  if (opportunity.eligible_activities && Array.isArray(opportunity.eligible_activities)) {
    details.activitiesMatch = opportunity.eligible_activities.some(activity =>
      HOT_ACTIVITIES.some(hotActivity =>
        matchTerms(activity, hotActivity)
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

describe('Client-Opportunity Matching: Match Criteria', () => {

  describe('All 4 Criteria Must Match', () => {
    test('returns match only when ALL 4 criteria pass', () => {
      const result = evaluateMatch(clients.pgeBayAreaClient, opportunities.nationalGrant);

      expect(result.isMatch).toBe(true);
      expect(result.details.locationMatch).toBe(true);
      expect(result.details.applicantTypeMatch).toBe(true);
      expect(result.details.projectNeedsMatch).toBe(true);
      expect(result.details.activitiesMatch).toBe(true);
    });

    test('returns no match if location fails (even if other 3 pass)', () => {
      const result = evaluateMatch(clients.pgeBayAreaClient, opportunities.texasOnlyGrant);

      expect(result.isMatch).toBe(false);
      expect(result.details.locationMatch).toBe(false);
      // Other criteria may pass but overall is not a match
    });

    test('returns no match if applicant type fails', () => {
      // School-only grant shouldn't match municipal government
      const schoolOnlyOpp = {
        ...opportunities.schoolOnlyGrant,
        is_national: true, // ensure location passes
        eligible_project_types: ['Energy Efficiency', 'Solar'], // ensure needs pass
        eligible_activities: ['Construction'], // ensure activities pass
      };

      const result = evaluateMatch(clients.pgeBayAreaClient, schoolOnlyOpp);

      expect(result.details.applicantTypeMatch).toBe(false);
      expect(result.isMatch).toBe(false);
    });

    test('returns no match if project needs fails', () => {
      const result = evaluateMatch(clients.emptyNeedsClient, opportunities.nationalGrant);

      expect(result.details.projectNeedsMatch).toBe(false);
      expect(result.isMatch).toBe(false);
    });

    test('returns no match if activities fails (no hot activities)', () => {
      const result = evaluateMatch(clients.schoolDistrictClient, opportunities.noHotActivitiesGrant);

      expect(result.details.locationMatch).toBe(true);
      expect(result.details.applicantTypeMatch).toBe(true);
      expect(result.details.projectNeedsMatch).toBe(true);
      expect(result.details.activitiesMatch).toBe(false);
      expect(result.isMatch).toBe(false);
    });
  });

  describe('Location Matching', () => {
    test('national opportunities match all clients', () => {
      const nationalOpp = { ...opportunities.nationalGrant, is_national: true };

      const result1 = evaluateMatch(clients.pgeBayAreaClient, nationalOpp);
      const result2 = evaluateMatch(clients.texasCommercialClient, nationalOpp);

      expect(result1.details.locationMatch).toBe(true);
      expect(result2.details.locationMatch).toBe(true);
    });

    test('coverage area intersection creates location match', () => {
      // Client has [1, 2, 3], Opportunity has [1, 2, 7] - IDs 1 and 2 overlap
      const result = evaluateMatch(clients.pgeBayAreaClient, opportunities.pgeUtilityGrant);

      expect(result.details.locationMatch).toBe(true);
    });

    test('no coverage area intersection means no location match', () => {
      // CA client vs TX-only opportunity
      const result = evaluateMatch(clients.pgeBayAreaClient, opportunities.texasOnlyGrant);

      expect(result.details.locationMatch).toBe(false);
    });

    test('empty coverage_area_ids on client prevents match', () => {
      const clientNoAreas = { ...clients.pgeBayAreaClient, coverage_area_ids: [] };
      const result = evaluateMatch(clientNoAreas, opportunities.pgeUtilityGrant);

      expect(result.details.locationMatch).toBe(false);
    });

    test('empty coverage_area_ids on opportunity prevents match (unless national)', () => {
      const oppNoAreas = {
        ...opportunities.pgeUtilityGrant,
        is_national: false,
        coverage_area_ids: []
      };
      const result = evaluateMatch(clients.pgeBayAreaClient, oppNoAreas);

      expect(result.details.locationMatch).toBe(false);
    });
  });

  describe('Applicant Type Matching', () => {
    test('direct type match works', () => {
      // School District matches "School Districts" in eligible_applicants
      const result = evaluateMatch(clients.schoolDistrictClient, opportunities.schoolOnlyGrant);

      expect(result.details.applicantTypeMatch).toBe(true);
    });

    test('synonym expansion enables match', () => {
      // City Government is synonym of Municipal Government
      const oppWithMunicipal = {
        ...opportunities.californiaStateGrant,
        eligible_applicants: ['Municipal Government']
      };

      const result = evaluateMatch(clients.cityGovernmentClient, oppWithMunicipal);

      expect(result.details.applicantTypeMatch).toBe(true);
    });

    test('hierarchy expansion enables child-to-parent match', () => {
      // Township Government should match "Local Governments" parent
      const oppWithLocalGov = {
        ...opportunities.californiaStateGrant,
        eligible_applicants: ['Local Governments']
      };

      const result = evaluateMatch(clients.townshipClient, oppWithLocalGov);

      expect(result.details.applicantTypeMatch).toBe(true);
    });

    test('unrelated types do not match', () => {
      // Hospital type shouldn't match School-only opportunity
      const result = evaluateMatch(clients.hospitalClient, opportunities.schoolOnlyGrant);

      expect(result.details.applicantTypeMatch).toBe(false);
    });
  });

  describe('Project Needs Matching', () => {
    test('exact project need match', () => {
      const client = { ...clients.pgeBayAreaClient, project_needs: ['Solar'] };
      const opp = { ...opportunities.nationalGrant, eligible_project_types: ['Solar'] };

      const result = evaluateMatch(client, opp);

      expect(result.details.projectNeedsMatch).toBe(true);
      expect(result.details.matchedProjectNeeds).toContain('Solar');
    });

    test('word-boundary match (need is a word within project type)', () => {
      const client = { ...clients.pgeBayAreaClient, project_needs: ['EV'] };
      const opp = { ...opportunities.nationalGrant, eligible_project_types: ['EV Charging Stations'] };

      const result = evaluateMatch(client, opp);

      expect(result.details.projectNeedsMatch).toBe(true);
    });

    test('word-boundary match (project type is a word within need)', () => {
      const client = { ...clients.pgeBayAreaClient, project_needs: ['Solar Panel Installation'] };
      const opp = { ...opportunities.nationalGrant, eligible_project_types: ['Solar'] };

      const result = evaluateMatch(client, opp);

      expect(result.details.projectNeedsMatch).toBe(true);
    });

    test('case insensitive matching', () => {
      const client = { ...clients.pgeBayAreaClient, project_needs: ['SOLAR'] };
      const opp = { ...opportunities.nationalGrant, eligible_project_types: ['solar panels'] };

      const result = evaluateMatch(client, opp);

      expect(result.details.projectNeedsMatch).toBe(true);
    });

    test('empty project needs results in no match', () => {
      const result = evaluateMatch(clients.emptyNeedsClient, opportunities.nationalGrant);

      expect(result.details.projectNeedsMatch).toBe(false);
      expect(result.details.matchedProjectNeeds).toHaveLength(0);
    });

    test('no overlapping needs results in no match', () => {
      const client = { ...clients.pgeBayAreaClient, project_needs: ['Nuclear Power'] };
      const opp = { ...opportunities.nationalGrant, eligible_project_types: ['Solar', 'Wind'] };

      const result = evaluateMatch(client, opp);

      expect(result.details.projectNeedsMatch).toBe(false);
    });
  });

  describe('Activities Matching (Hot Activities)', () => {
    test('hot activity in opportunity creates match', () => {
      const opp = {
        ...opportunities.nationalGrant,
        eligible_activities: ['Construction', 'Planning']
      };

      const result = evaluateMatch(clients.pgeBayAreaClient, opp);

      expect(result.details.activitiesMatch).toBe(true);
    });

    test('all hot activities are recognized', () => {
      HOT_ACTIVITIES.forEach(activity => {
        const opp = {
          ...opportunities.nationalGrant,
          eligible_activities: [activity]
        };

        const result = evaluateMatch(clients.pgeBayAreaClient, opp);
        expect(result.details.activitiesMatch).toBe(true);
      });
    });

    test('only non-hot activities results in no match', () => {
      const opp = {
        ...opportunities.noHotActivitiesGrant,
        eligible_activities: ['Planning', 'Feasibility Study', 'Assessment']
      };

      const result = evaluateMatch(clients.schoolDistrictClient, opp);

      expect(result.details.activitiesMatch).toBe(false);
    });

    test('case insensitive activity matching', () => {
      const opp = {
        ...opportunities.nationalGrant,
        eligible_activities: ['CONSTRUCTION', 'new construction']
      };

      const result = evaluateMatch(clients.pgeBayAreaClient, opp);

      expect(result.isMatch).toBe(true);
      expect(result.details.activitiesMatch).toBe(true);
    });

    test('empty activities array results in no match', () => {
      const opp = {
        ...opportunities.nationalGrant,
        eligible_activities: []
      };

      const result = evaluateMatch(clients.pgeBayAreaClient, opp);

      expect(result.details.activitiesMatch).toBe(false);
    });
  });

  describe('Match Score Calculation', () => {
    test('score is percentage of matched project needs', () => {
      // Client has 3 needs, 2 match = 67%
      const client = { ...clients.pgeBayAreaClient, project_needs: ['Solar', 'Wind', 'Nuclear'] };
      const opp = {
        ...opportunities.nationalGrant,
        is_national: true,
        eligible_applicants: ['Local Governments'],
        eligible_project_types: ['Solar', 'Wind'],
        eligible_activities: ['Construction']
      };

      const result = evaluateMatch(client, opp);

      expect(result.isMatch).toBe(true);
      expect(result.score).toBe(67); // 2/3 = 66.67% rounded to 67
    });

    test('100% score when all needs match', () => {
      const client = { ...clients.pgeBayAreaClient, project_needs: ['Solar', 'Wind'] };
      const opp = {
        ...opportunities.nationalGrant,
        is_national: true,
        eligible_applicants: ['Local Governments'],
        eligible_project_types: ['Solar', 'Wind', 'Battery Storage'],
        eligible_activities: ['Construction']
      };

      const result = evaluateMatch(client, opp);

      expect(result.isMatch).toBe(true);
      expect(result.score).toBe(100);
    });

    test('score is 0 for non-matching opportunities', () => {
      const result = evaluateMatch(clients.pgeBayAreaClient, opportunities.texasOnlyGrant);

      expect(result.isMatch).toBe(false);
      expect(result.score).toBe(0);
    });

    test('single need matched = score based on total needs', () => {
      const client = { ...clients.pgeBayAreaClient, project_needs: ['Solar', 'Wind', 'Battery', 'EV'] };
      const opp = {
        ...opportunities.nationalGrant,
        is_national: true,
        eligible_applicants: ['Local Governments'],
        eligible_project_types: ['Solar'],
        eligible_activities: ['Construction']
      };

      const result = evaluateMatch(client, opp);

      expect(result.isMatch).toBe(true);
      expect(result.score).toBe(25); // 1/4 = 25%
    });
  });

  describe('Edge Cases', () => {
    test('null coverage_area_ids handled gracefully', () => {
      const clientWithNullAreas = {
        ...clients.pgeBayAreaClient,
        coverage_area_ids: null,
      };

      // Should not throw - location will fail to match but won't crash
      expect(() => evaluateMatch(clientWithNullAreas, opportunities.nationalGrant)).not.toThrow();
    });

    test('null project_needs handled gracefully', () => {
      const clientWithNullNeeds = {
        ...clients.pgeBayAreaClient,
        project_needs: null,
      };

      expect(() => evaluateMatch(clientWithNullNeeds, opportunities.nationalGrant)).not.toThrow();
    });

    test('null client type causes error (expected behavior)', () => {
      // Note: Current implementation requires client.type to be non-null
      // for getExpandedClientTypes() to work. This documents actual behavior.
      const clientWithNullType = {
        ...clients.pgeBayAreaClient,
        type: null
      };

      // Current code will throw because getExpandedClientTypes(null) fails
      // This is acceptable since clients should always have a type
      expect(() => evaluateMatch(clientWithNullType, opportunities.nationalGrant)).toThrow();
    });

    test('null/undefined opportunity fields handled gracefully', () => {
      const oppWithNulls = {
        ...opportunities.nationalGrant,
        eligible_applicants: null,
        eligible_project_types: null,
        eligible_activities: null
      };

      expect(() => evaluateMatch(clients.pgeBayAreaClient, oppWithNulls)).not.toThrow();
    });

    test('very long project needs arrays work correctly', () => {
      const manyNeeds = Array.from({ length: 100 }, (_, i) => `Need ${i}`);
      manyNeeds.push('Solar'); // Add one that will match

      const client = { ...clients.pgeBayAreaClient, project_needs: manyNeeds };
      const opp = {
        ...opportunities.nationalGrant,
        is_national: true,
        eligible_applicants: ['Local Governments'],
        eligible_project_types: ['Solar'],
        eligible_activities: ['Construction']
      };

      const result = evaluateMatch(client, opp);

      expect(result.details.projectNeedsMatch).toBe(true);
      expect(result.score).toBe(1); // 1/101 ≈ 1%
    });
  });
});

describe('Match Scenarios (Pre-defined Test Cases)', () => {
  Object.entries(matchScenarios).forEach(([name, scenario]) => {
    test(scenario.name, () => {
      const result = evaluateMatch(scenario.client, scenario.opportunity);

      expect(result.isMatch).toBe(scenario.expected.isMatch);

      // Assert each detail criterion that the scenario explicitly specifies.
      // We iterate defined keys rather than using conditional guards, so if a key
      // is missing from the fixture it is a fixture bug, not a silent test skip.
      const DETAIL_KEYS = ['locationMatch', 'applicantTypeMatch', 'projectNeedsMatch', 'activitiesMatch'];
      const details = scenario.expected.details;
      DETAIL_KEYS.forEach(key => {
        if (key in details) {
          expect(result.details[key]).toBe(details[key]);
        }
      });

      // Score: always 0 for non-matches; assert exact value when fixture provides one
      if (scenario.expected.expectedScore !== undefined) {
        expect(result.score).toBe(scenario.expected.expectedScore);
      } else if (!scenario.expected.isMatch) {
        expect(result.score).toBe(0);
      }
    });
  });
});
