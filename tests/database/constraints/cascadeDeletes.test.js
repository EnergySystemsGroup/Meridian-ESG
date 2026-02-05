/**
 * Database Constraints: Cascade Delete Tests
 *
 * Tests the expected cascade delete behavior:
 * - Client deletion cascades to related records
 * - Opportunity deletion cascades to coverage areas
 * - Referential integrity maintained
 *
 * NOTE: These tests validate expected behavior patterns.
 * For full integration tests, run against real Supabase.
 */

import { describe, test, expect, beforeEach } from 'vitest';

/**
 * Simulates a database with cascade delete behavior
 */
class MockDatabase {
  constructor() {
    this.reset();
  }

  reset() {
    this.clients = [];
    this.opportunities = [];
    this.client_opportunity_matches = [];
    this.hidden_matches = [];
    this.tracked_opportunities = [];
    this.opportunity_coverage_areas = [];
    this.coverage_areas = [];
  }

  // Client operations
  insertClient(client) {
    this.clients.push({ ...client, id: client.id || `client-${Date.now()}` });
    return this.clients[this.clients.length - 1];
  }

  deleteClient(clientId) {
    const clientExists = this.clients.find(c => c.id === clientId);
    if (!clientExists) {
      return { error: 'Client not found' };
    }

    // CASCADE: Delete related records
    const hiddenMatchesRemoved = this.hidden_matches.filter(m => m.client_id === clientId).length;
    const trackedOppsRemoved = this.tracked_opportunities.filter(t => t.client_id === clientId).length;
    const matchesRemoved = this.client_opportunity_matches.filter(m => m.client_id === clientId).length;

    this.hidden_matches = this.hidden_matches.filter(m => m.client_id !== clientId);
    this.tracked_opportunities = this.tracked_opportunities.filter(t => t.client_id !== clientId);
    this.client_opportunity_matches = this.client_opportunity_matches.filter(m => m.client_id !== clientId);
    this.clients = this.clients.filter(c => c.id !== clientId);

    return {
      success: true,
      cascade: {
        hidden_matches_removed: hiddenMatchesRemoved,
        tracked_opportunities_removed: trackedOppsRemoved,
        matches_removed: matchesRemoved,
      },
    };
  }

  // Opportunity operations
  insertOpportunity(opportunity) {
    this.opportunities.push({ ...opportunity, id: opportunity.id || `opp-${Date.now()}` });
    return this.opportunities[this.opportunities.length - 1];
  }

  deleteOpportunity(opportunityId) {
    const oppExists = this.opportunities.find(o => o.id === opportunityId);
    if (!oppExists) {
      return { error: 'Opportunity not found' };
    }

    // CASCADE: Delete related records
    const coverageAreasRemoved = this.opportunity_coverage_areas.filter(
      oca => oca.opportunity_id === opportunityId
    ).length;
    const matchesRemoved = this.client_opportunity_matches.filter(
      m => m.opportunity_id === opportunityId
    ).length;
    const hiddenRemoved = this.hidden_matches.filter(
      h => h.opportunity_id === opportunityId
    ).length;
    const trackedRemoved = this.tracked_opportunities.filter(
      t => t.opportunity_id === opportunityId
    ).length;

    this.opportunity_coverage_areas = this.opportunity_coverage_areas.filter(
      oca => oca.opportunity_id !== opportunityId
    );
    this.client_opportunity_matches = this.client_opportunity_matches.filter(
      m => m.opportunity_id !== opportunityId
    );
    this.hidden_matches = this.hidden_matches.filter(
      h => h.opportunity_id !== opportunityId
    );
    this.tracked_opportunities = this.tracked_opportunities.filter(
      t => t.opportunity_id !== opportunityId
    );
    this.opportunities = this.opportunities.filter(o => o.id !== opportunityId);

    return {
      success: true,
      cascade: {
        coverage_areas_removed: coverageAreasRemoved,
        matches_removed: matchesRemoved,
        hidden_matches_removed: hiddenRemoved,
        tracked_removed: trackedRemoved,
      },
    };
  }

  // Helper methods for setting up test data
  addMatch(clientId, opportunityId, score = 75) {
    this.client_opportunity_matches.push({
      id: `match-${Date.now()}-${Math.random()}`,
      client_id: clientId,
      opportunity_id: opportunityId,
      match_score: score,
    });
  }

  addHiddenMatch(clientId, opportunityId) {
    this.hidden_matches.push({
      id: `hidden-${Date.now()}-${Math.random()}`,
      client_id: clientId,
      opportunity_id: opportunityId,
      hidden_at: new Date().toISOString(),
    });
  }

  addTrackedOpportunity(clientId, opportunityId) {
    this.tracked_opportunities.push({
      id: `tracked-${Date.now()}-${Math.random()}`,
      client_id: clientId,
      opportunity_id: opportunityId,
      tracked_at: new Date().toISOString(),
    });
  }

  addOpportunityCoverageArea(opportunityId, coverageAreaId) {
    this.opportunity_coverage_areas.push({
      id: `oca-${Date.now()}-${Math.random()}`,
      opportunity_id: opportunityId,
      coverage_area_id: coverageAreaId,
    });
  }
}

let db;

beforeEach(() => {
  db = new MockDatabase();
});

describe('Database Constraints: Cascade Deletes', () => {

  describe('Client Deletion Cascade', () => {
    test('deleting client removes client record', () => {
      const client = db.insertClient({ id: 'client-1', name: 'Test Client' });

      const result = db.deleteClient('client-1');

      expect(result.success).toBe(true);
      expect(db.clients.find(c => c.id === 'client-1')).toBeUndefined();
    });

    test('cascades to hidden_matches', () => {
      db.insertClient({ id: 'client-1', name: 'Test Client' });
      db.insertOpportunity({ id: 'opp-1', title: 'Test Opportunity' });
      db.addHiddenMatch('client-1', 'opp-1');
      db.addHiddenMatch('client-1', 'opp-2');

      expect(db.hidden_matches.length).toBe(2);

      const result = db.deleteClient('client-1');

      expect(result.success).toBe(true);
      expect(result.cascade.hidden_matches_removed).toBe(2);
      expect(db.hidden_matches.length).toBe(0);
    });

    test('cascades to tracked_opportunities', () => {
      db.insertClient({ id: 'client-1', name: 'Test Client' });
      db.insertOpportunity({ id: 'opp-1', title: 'Test Opportunity' });
      db.addTrackedOpportunity('client-1', 'opp-1');
      db.addTrackedOpportunity('client-1', 'opp-2');
      db.addTrackedOpportunity('client-1', 'opp-3');

      expect(db.tracked_opportunities.length).toBe(3);

      const result = db.deleteClient('client-1');

      expect(result.cascade.tracked_opportunities_removed).toBe(3);
      expect(db.tracked_opportunities.length).toBe(0);
    });

    test('cascades to client_opportunity_matches', () => {
      db.insertClient({ id: 'client-1', name: 'Test Client' });
      db.addMatch('client-1', 'opp-1', 85);
      db.addMatch('client-1', 'opp-2', 70);

      expect(db.client_opportunity_matches.length).toBe(2);

      const result = db.deleteClient('client-1');

      expect(result.cascade.matches_removed).toBe(2);
      expect(db.client_opportunity_matches.length).toBe(0);
    });

    test('only deletes records for the specific client', () => {
      db.insertClient({ id: 'client-1', name: 'Client 1' });
      db.insertClient({ id: 'client-2', name: 'Client 2' });
      db.addMatch('client-1', 'opp-1', 85);
      db.addMatch('client-2', 'opp-1', 75);
      db.addHiddenMatch('client-1', 'opp-2');
      db.addHiddenMatch('client-2', 'opp-2');

      db.deleteClient('client-1');

      // Client-2's records should remain
      expect(db.clients.find(c => c.id === 'client-2')).toBeDefined();
      expect(db.client_opportunity_matches.length).toBe(1);
      expect(db.client_opportunity_matches[0].client_id).toBe('client-2');
      expect(db.hidden_matches.length).toBe(1);
      expect(db.hidden_matches[0].client_id).toBe('client-2');
    });

    test('returns error for non-existent client', () => {
      const result = db.deleteClient('non-existent');

      expect(result.error).toBe('Client not found');
    });
  });

  describe('Opportunity Deletion Cascade', () => {
    test('deleting opportunity removes opportunity record', () => {
      db.insertOpportunity({ id: 'opp-1', title: 'Test Opportunity' });

      const result = db.deleteOpportunity('opp-1');

      expect(result.success).toBe(true);
      expect(db.opportunities.find(o => o.id === 'opp-1')).toBeUndefined();
    });

    test('cascades to opportunity_coverage_areas', () => {
      db.insertOpportunity({ id: 'opp-1', title: 'Test Opportunity' });
      db.addOpportunityCoverageArea('opp-1', 1);
      db.addOpportunityCoverageArea('opp-1', 2);
      db.addOpportunityCoverageArea('opp-1', 3);

      expect(db.opportunity_coverage_areas.length).toBe(3);

      const result = db.deleteOpportunity('opp-1');

      expect(result.cascade.coverage_areas_removed).toBe(3);
      expect(db.opportunity_coverage_areas.length).toBe(0);
    });

    test('cascades to client_opportunity_matches', () => {
      db.insertOpportunity({ id: 'opp-1', title: 'Test Opportunity' });
      db.addMatch('client-1', 'opp-1', 85);
      db.addMatch('client-2', 'opp-1', 70);

      const result = db.deleteOpportunity('opp-1');

      expect(result.cascade.matches_removed).toBe(2);
      expect(db.client_opportunity_matches.length).toBe(0);
    });

    test('cascades to hidden_matches', () => {
      db.insertOpportunity({ id: 'opp-1', title: 'Test Opportunity' });
      db.addHiddenMatch('client-1', 'opp-1');
      db.addHiddenMatch('client-2', 'opp-1');

      const result = db.deleteOpportunity('opp-1');

      expect(result.cascade.hidden_matches_removed).toBe(2);
      expect(db.hidden_matches.length).toBe(0);
    });

    test('cascades to tracked_opportunities', () => {
      db.insertOpportunity({ id: 'opp-1', title: 'Test Opportunity' });
      db.addTrackedOpportunity('client-1', 'opp-1');

      const result = db.deleteOpportunity('opp-1');

      expect(result.cascade.tracked_removed).toBe(1);
      expect(db.tracked_opportunities.length).toBe(0);
    });

    test('only deletes records for the specific opportunity', () => {
      db.insertOpportunity({ id: 'opp-1', title: 'Opportunity 1' });
      db.insertOpportunity({ id: 'opp-2', title: 'Opportunity 2' });
      db.addOpportunityCoverageArea('opp-1', 1);
      db.addOpportunityCoverageArea('opp-2', 1);
      db.addMatch('client-1', 'opp-1', 85);
      db.addMatch('client-1', 'opp-2', 75);

      db.deleteOpportunity('opp-1');

      // Opp-2's records should remain
      expect(db.opportunities.find(o => o.id === 'opp-2')).toBeDefined();
      expect(db.opportunity_coverage_areas.length).toBe(1);
      expect(db.opportunity_coverage_areas[0].opportunity_id).toBe('opp-2');
      expect(db.client_opportunity_matches.length).toBe(1);
      expect(db.client_opportunity_matches[0].opportunity_id).toBe('opp-2');
    });

    test('returns error for non-existent opportunity', () => {
      const result = db.deleteOpportunity('non-existent');

      expect(result.error).toBe('Opportunity not found');
    });
  });

  describe('Referential Integrity', () => {
    test('cascade reports accurate counts', () => {
      db.insertClient({ id: 'client-1', name: 'Test Client' });
      db.insertOpportunity({ id: 'opp-1', title: 'Opp 1' });
      db.insertOpportunity({ id: 'opp-2', title: 'Opp 2' });

      // Create various relationships
      db.addMatch('client-1', 'opp-1', 85);
      db.addMatch('client-1', 'opp-2', 70);
      db.addHiddenMatch('client-1', 'opp-1');
      db.addTrackedOpportunity('client-1', 'opp-2');

      const result = db.deleteClient('client-1');

      expect(result.cascade.matches_removed).toBe(2);
      expect(result.cascade.hidden_matches_removed).toBe(1);
      expect(result.cascade.tracked_opportunities_removed).toBe(1);
    });

    test('no orphaned records after client deletion', () => {
      db.insertClient({ id: 'client-1', name: 'Test Client' });
      db.addMatch('client-1', 'opp-1', 85);
      db.addHiddenMatch('client-1', 'opp-1');
      db.addTrackedOpportunity('client-1', 'opp-1');

      db.deleteClient('client-1');

      // Check for any records referencing deleted client
      expect(db.client_opportunity_matches.filter(m => m.client_id === 'client-1').length).toBe(0);
      expect(db.hidden_matches.filter(h => h.client_id === 'client-1').length).toBe(0);
      expect(db.tracked_opportunities.filter(t => t.client_id === 'client-1').length).toBe(0);
    });

    test('no orphaned records after opportunity deletion', () => {
      db.insertOpportunity({ id: 'opp-1', title: 'Test Opportunity' });
      db.addOpportunityCoverageArea('opp-1', 1);
      db.addOpportunityCoverageArea('opp-1', 2);
      db.addMatch('client-1', 'opp-1', 85);
      db.addHiddenMatch('client-1', 'opp-1');
      db.addTrackedOpportunity('client-1', 'opp-1');

      db.deleteOpportunity('opp-1');

      // Check for any records referencing deleted opportunity
      expect(db.opportunity_coverage_areas.filter(oca => oca.opportunity_id === 'opp-1').length).toBe(0);
      expect(db.client_opportunity_matches.filter(m => m.opportunity_id === 'opp-1').length).toBe(0);
      expect(db.hidden_matches.filter(h => h.opportunity_id === 'opp-1').length).toBe(0);
      expect(db.tracked_opportunities.filter(t => t.opportunity_id === 'opp-1').length).toBe(0);
    });
  });

  describe('Cascade Delete Response Structure', () => {
    test('client delete response has cascade info', () => {
      db.insertClient({ id: 'client-1', name: 'Test Client' });

      const result = db.deleteClient('client-1');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('cascade');
      expect(result.cascade).toHaveProperty('hidden_matches_removed');
      expect(result.cascade).toHaveProperty('tracked_opportunities_removed');
      expect(result.cascade).toHaveProperty('matches_removed');
    });

    test('opportunity delete response has cascade info', () => {
      db.insertOpportunity({ id: 'opp-1', title: 'Test Opportunity' });

      const result = db.deleteOpportunity('opp-1');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('cascade');
      expect(result.cascade).toHaveProperty('coverage_areas_removed');
      expect(result.cascade).toHaveProperty('matches_removed');
      expect(result.cascade).toHaveProperty('hidden_matches_removed');
      expect(result.cascade).toHaveProperty('tracked_removed');
    });
  });

  describe('Complex Scenarios', () => {
    test('handles multiple clients with shared opportunity relationships', () => {
      db.insertClient({ id: 'client-1', name: 'Client 1' });
      db.insertClient({ id: 'client-2', name: 'Client 2' });
      db.insertClient({ id: 'client-3', name: 'Client 3' });
      db.insertOpportunity({ id: 'opp-1', title: 'Shared Opportunity' });

      // All clients match the same opportunity
      db.addMatch('client-1', 'opp-1', 85);
      db.addMatch('client-2', 'opp-1', 75);
      db.addMatch('client-3', 'opp-1', 65);

      // Delete opportunity
      const result = db.deleteOpportunity('opp-1');

      // All matches should be removed
      expect(result.cascade.matches_removed).toBe(3);
      expect(db.client_opportunity_matches.length).toBe(0);

      // But clients should remain
      expect(db.clients.length).toBe(3);
    });

    test('handles client with many tracked opportunities', () => {
      db.insertClient({ id: 'client-1', name: 'Active Client' });

      // Track 10 opportunities
      for (let i = 1; i <= 10; i++) {
        db.insertOpportunity({ id: `opp-${i}`, title: `Opportunity ${i}` });
        db.addTrackedOpportunity('client-1', `opp-${i}`);
      }

      expect(db.tracked_opportunities.length).toBe(10);

      const result = db.deleteClient('client-1');

      expect(result.cascade.tracked_opportunities_removed).toBe(10);
      expect(db.tracked_opportunities.length).toBe(0);

      // Opportunities themselves should remain
      expect(db.opportunities.length).toBe(10);
    });

    test('handles opportunity with many coverage areas', () => {
      db.insertOpportunity({ id: 'opp-1', title: 'Multi-State Opportunity' });

      // Link to 50 coverage areas (all states)
      for (let i = 1; i <= 50; i++) {
        db.addOpportunityCoverageArea('opp-1', i);
      }

      expect(db.opportunity_coverage_areas.length).toBe(50);

      const result = db.deleteOpportunity('opp-1');

      expect(result.cascade.coverage_areas_removed).toBe(50);
      expect(db.opportunity_coverage_areas.length).toBe(0);
    });
  });
});
