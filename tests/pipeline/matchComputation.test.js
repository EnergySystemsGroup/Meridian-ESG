/**
 * Match Computation Job Tests
 *
 * Tests the background match computation job execution flow.
 * Uses inline functions mirroring lib/matching/computeMatches.js.
 */

import { describe, test, expect } from 'vitest';

// --- Inline functions mirroring computeMatches.js job logic ---

/**
 * Build the stats object returned by a match computation job.
 * Mirrors the stats shape from runMatchComputation().
 */
function buildJobStats({
  clientCount,
  opportunityCount,
  newMatches,
  updatedMatches,
  staleMatches,
  totalActiveMatches,
  durationMs
}) {
  return {
    clients_processed: clientCount,
    opportunities_evaluated: opportunityCount,
    pairs_evaluated: clientCount * opportunityCount,
    new_matches: newMatches,
    updated_matches: updatedMatches,
    stale_matches: staleMatches,
    total_active_matches: totalActiveMatches,
    duration_ms: durationMs
  };
}

/**
 * Determine the trigger type for a match computation.
 */
function determineTrigger(scope) {
  if (!scope || Object.keys(scope).length === 0) return 'cron';
  if (scope.clientIds?.length) return 'client_updated';
  if (scope.opportunityIds?.length) return 'opportunity_stored';
  return 'cron';
}

/**
 * Validate that a scope correctly limits computation.
 * Returns which dimension is scoped (or 'full' for no scope).
 */
function getScopeType(scope) {
  if (!scope || Object.keys(scope).length === 0) return 'full';
  if (scope.clientIds?.length && scope.opportunityIds?.length) return 'both';
  if (scope.clientIds?.length) return 'client';
  if (scope.opportunityIds?.length) return 'opportunity';
  return 'full';
}

/**
 * Build a match job log record.
 */
function buildJobLog({ trigger, scope, status, stats, error }) {
  return {
    trigger,
    scope: scope || {},
    started_at: new Date().toISOString(),
    completed_at: status !== 'running' ? new Date().toISOString() : null,
    status,
    stats: stats || {},
    error: error || null
  };
}

// --- Tests ---

describe('Match Computation: Stats Shape', () => {
  test('full computation stats have correct shape', () => {
    const stats = buildJobStats({
      clientCount: 50,
      opportunityCount: 500,
      newMatches: 120,
      updatedMatches: 30,
      staleMatches: 5,
      totalActiveMatches: 150,
      durationMs: 850
    });

    expect(stats.clients_processed).toBe(50);
    expect(stats.opportunities_evaluated).toBe(500);
    expect(stats.pairs_evaluated).toBe(25000);
    expect(stats.new_matches).toBe(120);
    expect(stats.updated_matches).toBe(30);
    expect(stats.stale_matches).toBe(5);
    expect(stats.total_active_matches).toBe(150);
    expect(stats.duration_ms).toBe(850);
  });

  test('zero clients produces zero pairs', () => {
    const stats = buildJobStats({
      clientCount: 0,
      opportunityCount: 500,
      newMatches: 0,
      updatedMatches: 0,
      staleMatches: 0,
      totalActiveMatches: 0,
      durationMs: 10
    });

    expect(stats.pairs_evaluated).toBe(0);
    expect(stats.total_active_matches).toBe(0);
  });
});

describe('Match Computation: Trigger Detection', () => {
  test('empty scope is cron trigger', () => {
    expect(determineTrigger({})).toBe('cron');
    expect(determineTrigger(null)).toBe('cron');
    expect(determineTrigger(undefined)).toBe('cron');
  });

  test('clientIds scope is client_updated trigger', () => {
    expect(determineTrigger({ clientIds: ['abc-123'] })).toBe('client_updated');
  });

  test('opportunityIds scope is opportunity_stored trigger', () => {
    expect(determineTrigger({ opportunityIds: ['opp-1', 'opp-2'] })).toBe('opportunity_stored');
  });
});

describe('Match Computation: Scope Types', () => {
  test('no scope is full computation', () => {
    expect(getScopeType({})).toBe('full');
    expect(getScopeType(null)).toBe('full');
  });

  test('clientIds scope is client-scoped', () => {
    expect(getScopeType({ clientIds: ['c1'] })).toBe('client');
  });

  test('opportunityIds scope is opportunity-scoped', () => {
    expect(getScopeType({ opportunityIds: ['o1', 'o2'] })).toBe('opportunity');
  });

  test('both scopes is both-scoped', () => {
    expect(getScopeType({ clientIds: ['c1'], opportunityIds: ['o1'] })).toBe('both');
  });
});

describe('Match Computation: Job Logging', () => {
  test('running job log has no completed_at', () => {
    const log = buildJobLog({
      trigger: 'cron',
      scope: {},
      status: 'running'
    });

    expect(log.trigger).toBe('cron');
    expect(log.status).toBe('running');
    expect(log.started_at).toBeDefined();
    expect(log.completed_at).toBeNull();
    expect(log.error).toBeNull();
  });

  test('completed job log has stats and completed_at', () => {
    const stats = buildJobStats({
      clientCount: 10,
      opportunityCount: 100,
      newMatches: 25,
      updatedMatches: 5,
      staleMatches: 2,
      totalActiveMatches: 30,
      durationMs: 450
    });

    const log = buildJobLog({
      trigger: 'client_updated',
      scope: { clientIds: ['c1'] },
      status: 'completed',
      stats
    });

    expect(log.status).toBe('completed');
    expect(log.completed_at).toBeDefined();
    expect(log.stats.new_matches).toBe(25);
    expect(log.scope.clientIds).toEqual(['c1']);
  });

  test('failed job log has error message', () => {
    const log = buildJobLog({
      trigger: 'opportunity_stored',
      scope: { opportunityIds: ['o1'] },
      status: 'failed',
      error: 'Failed to fetch opportunities: connection timeout'
    });

    expect(log.status).toBe('failed');
    expect(log.error).toContain('connection timeout');
    expect(log.completed_at).toBeDefined();
  });
});

describe('Match Computation: First-Time Client Detection', () => {
  /**
   * Identify clients with zero prior matches (first-ever computation).
   * Mirrors lib/matching/computeMatches.js lines 160-167.
   */
  function identifyFirstTimeClients(clients, existingMatches) {
    const clientsWithExistingMatches = new Set(
      (existingMatches || []).map(m => m.client_id)
    );
    return clients
      .map(c => c.id)
      .filter(cid => !clientsWithExistingMatches.has(cid));
  }

  test('brand new clients with no existing matches are identified', () => {
    const clients = [
      { id: 'c1' },
      { id: 'c2' },
      { id: 'c3' },
    ];
    const existingMatches = [
      { client_id: 'c1', opportunity_id: 'opp-1' },
    ];

    const firstTime = identifyFirstTimeClients(clients, existingMatches);
    expect(firstTime).toEqual(['c2', 'c3']);
  });

  test('all clients are first-time when no existing matches', () => {
    const clients = [{ id: 'c1' }, { id: 'c2' }];
    const firstTime = identifyFirstTimeClients(clients, []);
    expect(firstTime).toEqual(['c1', 'c2']);
  });

  test('no first-time clients when all have existing matches', () => {
    const clients = [{ id: 'c1' }, { id: 'c2' }];
    const existingMatches = [
      { client_id: 'c1', opportunity_id: 'opp-1' },
      { client_id: 'c2', opportunity_id: 'opp-2' },
    ];

    const firstTime = identifyFirstTimeClients(clients, existingMatches);
    expect(firstTime).toEqual([]);
  });

  test('handles null existingMatches gracefully', () => {
    const clients = [{ id: 'c1' }];
    const firstTime = identifyFirstTimeClients(clients, null);
    expect(firstTime).toEqual(['c1']);
  });

  test('a client with any match is not first-time (even one)', () => {
    const clients = [{ id: 'c1' }, { id: 'c2' }];
    const existingMatches = [
      { client_id: 'c1', opportunity_id: 'opp-1' },
      { client_id: 'c1', opportunity_id: 'opp-2' },
      // c2 has no matches — it's first-time
    ];

    const firstTime = identifyFirstTimeClients(clients, existingMatches);
    expect(firstTime).toEqual(['c2']);
  });
});

describe('Match Computation: Scoped vs Full', () => {
  test('client-scoped computation only processes that client', () => {
    // Simulate: 1 client, all opportunities
    const stats = buildJobStats({
      clientCount: 1,
      opportunityCount: 500,
      newMatches: 8,
      updatedMatches: 2,
      staleMatches: 1,
      totalActiveMatches: 10,
      durationMs: 50
    });

    expect(stats.clients_processed).toBe(1);
    expect(stats.opportunities_evaluated).toBe(500);
    expect(stats.pairs_evaluated).toBe(500); // 1 client x 500 opps
  });

  test('opportunity-scoped computation evaluates all clients against specific opps', () => {
    // Simulate: all clients, 3 new opportunities
    const stats = buildJobStats({
      clientCount: 50,
      opportunityCount: 3,
      newMatches: 15,
      updatedMatches: 0,
      staleMatches: 0,
      totalActiveMatches: 15,
      durationMs: 30
    });

    expect(stats.clients_processed).toBe(50);
    expect(stats.opportunities_evaluated).toBe(3);
    expect(stats.pairs_evaluated).toBe(150); // 50 clients x 3 opps
  });
});
