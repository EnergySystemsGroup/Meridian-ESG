/**
 * Related Opportunities Tests
 *
 * Tests the recommendation logic for related opportunities:
 * - Similarity based on project types overlap
 * - Similarity based on coverage area overlap
 * - Similarity based on applicant type overlap
 * - Excludes the current opportunity from results
 * - Sorted by relevance score descending
 * - Limited to top N results
 */

import { describe, test, expect } from 'vitest';
import { opportunities } from '../../fixtures/opportunities.js';

/**
 * Calculate similarity score between two opportunities
 */
function calculateSimilarity(opp1, opp2) {
  let score = 0;

  // Project type overlap (highest weight)
  const types1 = new Set(opp1.eligible_project_types || []);
  const types2 = new Set(opp2.eligible_project_types || []);
  const typeOverlap = [...types1].filter(t => types2.has(t)).length;
  const typeTotal = new Set([...types1, ...types2]).size;
  if (typeTotal > 0) {
    score += (typeOverlap / typeTotal) * 40; // 40% weight
  }

  // Applicant type overlap
  const applicants1 = new Set(opp1.eligible_applicants || []);
  const applicants2 = new Set(opp2.eligible_applicants || []);
  const applicantOverlap = [...applicants1].filter(a => applicants2.has(a)).length;
  const applicantTotal = new Set([...applicants1, ...applicants2]).size;
  if (applicantTotal > 0) {
    score += (applicantOverlap / applicantTotal) * 30; // 30% weight
  }

  // Coverage area overlap
  const areas1 = new Set(opp1.coverage_area_ids || []);
  const areas2 = new Set(opp2.coverage_area_ids || []);
  if (opp1.is_national && opp2.is_national) {
    score += 15; // Both national = moderate similarity
  } else if (opp1.is_national || opp2.is_national) {
    score += 5; // One national = low similarity
  } else {
    const areaOverlap = [...areas1].filter(a => areas2.has(a)).length;
    const areaTotal = new Set([...areas1, ...areas2]).size;
    if (areaTotal > 0) {
      score += (areaOverlap / areaTotal) * 30; // 30% weight
    }
  }

  return Math.round(score * 10) / 10;
}

/**
 * Get related opportunities for a given opportunity
 */
function getRelatedOpportunities(currentOpp, allOpps, limit = 5) {
  return allOpps
    .filter(opp => opp.id !== currentOpp.id) // Exclude self
    .filter(opp => opp.status === 'open') // Only open opps
    .map(opp => ({
      ...opp,
      similarityScore: calculateSimilarity(currentOpp, opp),
    }))
    .filter(opp => opp.similarityScore > 0) // Must have some similarity
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}

const allOpps = Object.values(opportunities);

describe('Related Opportunities', () => {

  describe('Similarity Calculation', () => {
    test('identical project types give maximum type score', () => {
      const opp1 = { eligible_project_types: ['Solar', 'Wind'] };
      const opp2 = { eligible_project_types: ['Solar', 'Wind'] };

      const score = calculateSimilarity(opp1, opp2);
      expect(score).toBeGreaterThanOrEqual(40); // Full type overlap = 40 points
    });

    test('no overlap gives 0 score', () => {
      const opp1 = {
        eligible_project_types: ['Solar'],
        eligible_applicants: ['Municipal Government'],
        coverage_area_ids: [1],
        is_national: false,
      };
      const opp2 = {
        eligible_project_types: ['Water Treatment'],
        eligible_applicants: ['Tribal Government'],
        coverage_area_ids: [99],
        is_national: false,
      };

      const score = calculateSimilarity(opp1, opp2);
      expect(score).toBe(0);
    });

    test('partial overlap gives proportional score', () => {
      const opp1 = { eligible_project_types: ['Solar', 'Wind', 'Battery Storage'] };
      const opp2 = { eligible_project_types: ['Solar', 'EV Charging'] };

      const score = calculateSimilarity(opp1, opp2);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(40); // Not full overlap
    });

    test('both national opportunities get geographic bonus', () => {
      const opp1 = { is_national: true, coverage_area_ids: [] };
      const opp2 = { is_national: true, coverage_area_ids: [] };

      const score = calculateSimilarity(opp1, opp2);
      expect(score).toBe(15); // Both national with no other overlap
    });

    test('one national gets smaller geographic bonus', () => {
      const opp1 = { is_national: true, coverage_area_ids: [] };
      const opp2 = { is_national: false, coverage_area_ids: [1, 2] };

      const score = calculateSimilarity(opp1, opp2);
      expect(score).toBe(5);
    });

    test('empty arrays handle gracefully', () => {
      const opp1 = {};
      const opp2 = {};
      const score = calculateSimilarity(opp1, opp2);
      expect(score).toBe(0);
    });

    test('score is always between 0 and 100', () => {
      // Maximum possible: 40 (types) + 30 (applicants) + 30 (areas) = 100
      const maxOpp = {
        eligible_project_types: ['Solar'],
        eligible_applicants: ['Municipal Government'],
        coverage_area_ids: [1],
      };
      const score = calculateSimilarity(maxOpp, maxOpp);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Getting Related Opportunities', () => {
    test('excludes the current opportunity', () => {
      const current = opportunities.nationalGrant;
      const related = getRelatedOpportunities(current, allOpps);

      expect(related.every(o => o.id !== current.id)).toBe(true);
    });

    test('excludes closed opportunities', () => {
      const closedOpp = { ...opportunities.nationalGrant, id: 'closed-1', status: 'closed' };
      const testOpps = [...allOpps, closedOpp];

      const related = getRelatedOpportunities(opportunities.californiaStateGrant, testOpps);
      expect(related.every(o => o.status === 'open')).toBe(true);
    });

    test('sorted by similarity score descending', () => {
      const related = getRelatedOpportunities(opportunities.nationalGrant, allOpps);

      for (let i = 1; i < related.length; i++) {
        expect(related[i - 1].similarityScore)
          .toBeGreaterThanOrEqual(related[i].similarityScore);
      }
    });

    test('limited to specified count', () => {
      const related = getRelatedOpportunities(opportunities.nationalGrant, allOpps, 2);
      expect(related.length).toBeLessThanOrEqual(2);
    });

    test('each result has similarityScore property', () => {
      const related = getRelatedOpportunities(opportunities.nationalGrant, allOpps);
      related.forEach(opp => {
        expect(opp).toHaveProperty('similarityScore');
        expect(typeof opp.similarityScore).toBe('number');
      });
    });

    test('excludes opportunities with 0 similarity', () => {
      const unrelatedOpp = {
        id: 'unrelated',
        status: 'open',
        eligible_project_types: ['Underwater Basket Weaving'],
        eligible_applicants: ['Alien Governments'],
        coverage_area_ids: [9999],
        is_national: false,
      };

      const related = getRelatedOpportunities(unrelatedOpp, allOpps);
      related.forEach(opp => {
        expect(opp.similarityScore).toBeGreaterThan(0);
      });
    });

    test('returns empty array when no similar opportunities', () => {
      const uniqueOpp = {
        id: 'unique',
        status: 'open',
        eligible_project_types: ['Quantum Computing'],
        eligible_applicants: ['Space Agency'],
        coverage_area_ids: [9999],
        is_national: false,
      };

      const related = getRelatedOpportunities(uniqueOpp, [uniqueOpp]);
      expect(related).toEqual([]);
    });

    test('works with fixture opportunities', () => {
      // CA state grant should be related to PG&E utility grant
      // (both in CA, overlapping project types)
      const related = getRelatedOpportunities(
        opportunities.californiaStateGrant,
        allOpps,
      );

      expect(related.length).toBeGreaterThan(0);
    });
  });
});
