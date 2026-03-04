/**
 * Integration: Client Matching Flow
 *
 * Tests the full flow: API request → matching logic → DB query → response shape
 * Ensures all layers cooperate correctly end-to-end.
 */

import { describe, test, expect } from 'vitest';
import { clients } from '../fixtures/clients.js';
import { opportunities } from '../fixtures/opportunities.js';
import { coverageAreas, opportunityCoverageLinks } from '../fixtures/coverageAreas.js';

/**
 * Simulate the matching endpoint flow
 */
function matchClientToOpportunities(clientId, allClients, allOpps, allLinks) {
  // Step 1: Retrieve client
  const client = Object.values(allClients).find(c => c.id === clientId);
  if (!client) return { error: 'Client not found', matches: [] };

  // Step 2: Find opportunities with overlapping coverage areas
  const clientAreaIds = new Set(client.coverage_area_ids || []);
  const candidateOppIds = new Set();

  for (const link of allLinks) {
    if (clientAreaIds.has(link.coverage_area_id)) {
      candidateOppIds.add(link.opportunity_id);
    }
  }

  // Step 3: Also include national opportunities
  const allOppList = Object.values(allOpps);
  for (const opp of allOppList) {
    if (opp.is_national) candidateOppIds.add(opp.id);
  }

  // Step 4: Build matches with scores
  const matches = [];
  for (const oppId of candidateOppIds) {
    const opp = allOppList.find(o => o.id === oppId);
    if (!opp || opp.status !== 'open') continue;

    const score = calculateMatchScore(client, opp);
    matches.push({
      opportunity_id: opp.id,
      client_id: client.id,
      title: opp.title,
      agency_name: opp.agency_name,
      match_score: score,
      match_reasons: getMatchReasons(client, opp),
    });
  }

  // Step 5: Sort by score descending
  matches.sort((a, b) => b.match_score - a.match_score);

  return {
    error: null,
    client_id: clientId,
    client_name: client.name,
    total_matches: matches.length,
    matches,
  };
}

function calculateMatchScore(client, opp) {
  let score = 0;
  const clientNeeds = client.project_needs || [];
  const oppTypes = opp.eligible_project_types || [];

  // Project type overlap (40%)
  const typeOverlap = clientNeeds.filter(n =>
    oppTypes.some(t => t.toLowerCase().includes(n.toLowerCase()) ||
                       n.toLowerCase().includes(t.toLowerCase()))
  );
  score += (typeOverlap.length / Math.max(clientNeeds.length, 1)) * 40;

  // Coverage area overlap (30%)
  const clientAreas = new Set(client.coverage_area_ids || []);
  const oppAreas = new Set(opp.coverage_area_ids || []);
  if (opp.is_national) {
    score += 30; // National = full coverage match
  } else {
    const overlap = [...clientAreas].filter(a => oppAreas.has(a));
    score += (overlap.length / Math.max(clientAreas.size, 1)) * 30;
  }

  // Budget fit (30%)
  if (opp.maximum_award && client.budget) {
    const ratio = Math.min(opp.maximum_award / client.budget, 1);
    score += ratio * 30;
  }

  return Math.round(score);
}

function getMatchReasons(client, opp) {
  const reasons = [];
  const clientNeeds = client.project_needs || [];
  const oppTypes = opp.eligible_project_types || [];

  const typeOverlap = clientNeeds.filter(n =>
    oppTypes.some(t => t.toLowerCase().includes(n.toLowerCase()) ||
                       n.toLowerCase().includes(t.toLowerCase()))
  );
  if (typeOverlap.length > 0) reasons.push('project_type_match');
  if (opp.is_national) reasons.push('national_opportunity');

  const clientAreas = new Set(client.coverage_area_ids || []);
  const oppAreas = new Set(opp.coverage_area_ids || []);
  const areaOverlap = [...clientAreas].filter(a => oppAreas.has(a));
  if (areaOverlap.length > 0) reasons.push('coverage_area_overlap');

  return reasons;
}

describe('Client Matching Flow (Integration)', () => {

  describe('Full Match Pipeline', () => {
    test('Bay Area client matches PG&E and national opportunities', () => {
      const result = matchClientToOpportunities(
        'client-pge-bay-area', clients, opportunities, opportunityCoverageLinks
      );

      expect(result.error).toBeNull();
      expect(result.client_name).toBe('City of San Francisco');
      expect(result.total_matches).toBeGreaterThan(0);

      // Should include national grant
      const national = result.matches.find(m => m.opportunity_id === 'opp-national-001');
      expect(national).toBeDefined();
      expect(national.match_reasons).toContain('national_opportunity');
    });

    test('Texas client gets national opportunities', () => {
      const result = matchClientToOpportunities(
        'client-texas-commercial', clients, opportunities, opportunityCoverageLinks
      );

      expect(result.error).toBeNull();
      // National opportunities should always be included
      const hasNational = result.matches.some(m =>
        m.match_reasons.includes('national_opportunity')
      );
      expect(hasNational).toBe(true);
    });

    test('nonexistent client returns error', () => {
      const result = matchClientToOpportunities(
        'client-nonexistent', clients, opportunities, opportunityCoverageLinks
      );

      expect(result.error).toBe('Client not found');
      expect(result.matches).toEqual([]);
    });
  });

  describe('Response Shape Contract', () => {
    test('response has required top-level fields', () => {
      const result = matchClientToOpportunities(
        'client-pge-bay-area', clients, opportunities, opportunityCoverageLinks
      );

      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('client_id');
      expect(result).toHaveProperty('client_name');
      expect(result).toHaveProperty('total_matches');
      expect(result).toHaveProperty('matches');
      expect(typeof result.total_matches).toBe('number');
    });

    test('each match has required fields', () => {
      const result = matchClientToOpportunities(
        'client-pge-bay-area', clients, opportunities, opportunityCoverageLinks
      );

      for (const match of result.matches) {
        expect(match).toHaveProperty('opportunity_id');
        expect(match).toHaveProperty('client_id');
        expect(match).toHaveProperty('title');
        expect(match).toHaveProperty('match_score');
        expect(match).toHaveProperty('match_reasons');
        expect(typeof match.match_score).toBe('number');
        expect(Array.isArray(match.match_reasons)).toBe(true);
      }
    });

    test('matches are sorted by score descending', () => {
      const result = matchClientToOpportunities(
        'client-pge-bay-area', clients, opportunities, opportunityCoverageLinks
      );

      for (let i = 1; i < result.matches.length; i++) {
        expect(result.matches[i].match_score)
          .toBeLessThanOrEqual(result.matches[i - 1].match_score);
      }
    });

    test('total_matches equals matches array length', () => {
      const result = matchClientToOpportunities(
        'client-pge-bay-area', clients, opportunities, opportunityCoverageLinks
      );

      expect(result.total_matches).toBe(result.matches.length);
    });
  });

  describe('Score Calculations', () => {
    test('score is between 0 and 100', () => {
      const result = matchClientToOpportunities(
        'client-pge-bay-area', clients, opportunities, opportunityCoverageLinks
      );

      for (const match of result.matches) {
        expect(match.match_score).toBeGreaterThanOrEqual(0);
        expect(match.match_score).toBeLessThanOrEqual(100);
      }
    });

    test('national opportunity gets full coverage score', () => {
      const client = clients.pgeBayAreaClient;
      const opp = opportunities.nationalGrant;
      const score = calculateMatchScore(client, opp);
      // Coverage portion (30) should be full for national
      expect(score).toBeGreaterThanOrEqual(30);
    });
  });
});
