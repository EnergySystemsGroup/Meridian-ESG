/**
 * Database Constraints: Match Job Logs & Client Matches Stale Columns Tests
 *
 * Tests the expected schema behavior for:
 * - match_job_logs table structure and defaults
 * - client_matches stale tracking columns (is_stale, stale_at)
 * - Column defaults and constraints
 *
 * NOTE: These tests validate expected behavior patterns using inline functions.
 * For full integration tests, run against real Supabase.
 */

import { describe, test, expect } from 'vitest';

// --- Inline functions mirroring schema defaults and constraints ---

/**
 * Simulate inserting a row into match_job_logs with DB defaults.
 * Mirrors the DEFAULT values from the migration.
 */
function createJobLogRow(input) {
  return {
    id: input.id || crypto.randomUUID(),
    trigger: input.trigger,  // NOT NULL, no default — must be provided
    started_at: input.started_at || new Date().toISOString(),  // DEFAULT NOW()
    completed_at: input.completed_at || null,  // nullable
    status: input.status || 'running',  // DEFAULT 'running'
    stats: input.stats || {},  // DEFAULT '{}'::jsonb
    error: input.error || null,  // nullable
    scope: input.scope || {}  // DEFAULT '{}'::jsonb
  };
}

/**
 * Validate match_job_logs row has required fields.
 */
function validateJobLogRow(row) {
  const errors = [];
  if (!row.id) errors.push('Missing id');
  if (!row.trigger) errors.push('Missing trigger (NOT NULL)');
  if (!row.started_at) errors.push('Missing started_at (NOT NULL)');
  if (!row.status) errors.push('Missing status (NOT NULL)');
  const validStatuses = ['running', 'completed', 'failed'];
  if (!validStatuses.includes(row.status)) {
    errors.push(`Invalid status: ${row.status}. Must be one of: ${validStatuses.join(', ')}`);
  }
  const validTriggers = ['cron', 'opportunity_stored', 'client_created', 'client_updated',
    'manual', 'manual_full', 'manual_client', 'manual_opportunities'];
  if (!validTriggers.includes(row.trigger)) {
    errors.push(`Invalid trigger: ${row.trigger}. Must be one of: ${validTriggers.join(', ')}`);
  }
  return errors;
}

/**
 * Simulate client_matches row with stale columns.
 * Mirrors the schema after the migration adds is_stale and stale_at.
 */
function createClientMatchRow(input) {
  return {
    id: input.id || crypto.randomUUID(),
    client_id: input.client_id,
    opportunity_id: input.opportunity_id,
    score: input.score ?? 0,  // DEFAULT 0
    match_details: input.match_details || {},  // DEFAULT '{}'::jsonb
    first_matched_at: input.first_matched_at || new Date().toISOString(),  // DEFAULT NOW()
    last_matched_at: input.last_matched_at || new Date().toISOString(),  // DEFAULT NOW()
    is_new: input.is_new ?? true,  // DEFAULT true
    is_stale: input.is_stale ?? false,  // DEFAULT false (from migration)
    stale_at: input.stale_at || null  // nullable (from migration)
  };
}

/**
 * Check UNIQUE constraint on client_matches(client_id, opportunity_id).
 */
function wouldViolateUnique(newRow, existingRows) {
  return existingRows.some(existing =>
    existing.client_id === newRow.client_id &&
    existing.opportunity_id === newRow.opportunity_id
  );
}

/**
 * Simulate RLS policy check.
 * authenticated: SELECT only
 * service_role: ALL operations
 */
function checkRlsPolicy(role, operation) {
  if (role === 'service_role') return true;
  if (role === 'authenticated' && operation === 'SELECT') return true;
  return false;
}

// --- Tests ---

describe('Match Job Logs: Defaults', () => {
  test('minimal insert gets correct defaults', () => {
    const row = createJobLogRow({ trigger: 'cron' });
    expect(row.status).toBe('running');
    expect(row.started_at).toBeDefined();
    expect(row.completed_at).toBeNull();
    expect(row.stats).toEqual({});
    expect(row.error).toBeNull();
    expect(row.scope).toEqual({});
  });

  test('trigger is required (NOT NULL)', () => {
    const row = createJobLogRow({ trigger: undefined });
    const errors = validateJobLogRow(row);
    expect(errors).toContain('Missing trigger (NOT NULL)');
  });

  test('all valid triggers are accepted', () => {
    const triggers = ['cron', 'opportunity_stored', 'client_created', 'client_updated',
      'manual', 'manual_full', 'manual_client', 'manual_opportunities'];
    for (const trigger of triggers) {
      const row = createJobLogRow({ trigger });
      const errors = validateJobLogRow(row);
      expect(errors).toHaveLength(0);
    }
  });

  test('invalid status is rejected', () => {
    const row = createJobLogRow({ trigger: 'cron', status: 'pending' });
    const errors = validateJobLogRow(row);
    expect(errors.some(e => e.includes('Invalid status'))).toBe(true);
  });
});

describe('Match Job Logs: Lifecycle', () => {
  test('running job has no completed_at or error', () => {
    const row = createJobLogRow({ trigger: 'cron', status: 'running' });
    expect(row.completed_at).toBeNull();
    expect(row.error).toBeNull();
  });

  test('completed job has completed_at and stats', () => {
    const row = createJobLogRow({
      trigger: 'cron',
      status: 'completed',
      completed_at: new Date().toISOString(),
      stats: { new_matches: 10, duration_ms: 500 }
    });
    expect(row.completed_at).toBeDefined();
    expect(row.stats.new_matches).toBe(10);
    expect(row.error).toBeNull();
  });

  test('failed job has error message', () => {
    const row = createJobLogRow({
      trigger: 'opportunity_stored',
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: 'Connection timeout'
    });
    expect(row.error).toBe('Connection timeout');
    expect(row.completed_at).toBeDefined();
  });
});

describe('Client Matches: Stale Columns', () => {
  test('new match defaults to is_stale=false', () => {
    const row = createClientMatchRow({
      client_id: 'c1',
      opportunity_id: 'o1',
      score: 80
    });
    expect(row.is_stale).toBe(false);
    expect(row.stale_at).toBeNull();
  });

  test('stale match has is_stale=true and stale_at set', () => {
    const row = createClientMatchRow({
      client_id: 'c1',
      opportunity_id: 'o1',
      is_stale: true,
      stale_at: new Date().toISOString()
    });
    expect(row.is_stale).toBe(true);
    expect(row.stale_at).toBeDefined();
  });

  test('un-staling resets is_stale and stale_at', () => {
    // Simulate a match that was stale but is now active again
    const staleRow = createClientMatchRow({
      client_id: 'c1',
      opportunity_id: 'o1',
      is_stale: true,
      stale_at: '2026-01-01T00:00:00.000Z'
    });
    expect(staleRow.is_stale).toBe(true);

    // Un-stale it
    const activeRow = createClientMatchRow({
      ...staleRow,
      is_stale: false,
      stale_at: null
    });
    expect(activeRow.is_stale).toBe(false);
    expect(activeRow.stale_at).toBeNull();
  });

  test('is_new defaults to true for new matches', () => {
    const row = createClientMatchRow({
      client_id: 'c1',
      opportunity_id: 'o1'
    });
    expect(row.is_new).toBe(true);
  });

  test('first_matched_at defaults to current time', () => {
    const before = new Date().toISOString();
    const row = createClientMatchRow({
      client_id: 'c1',
      opportunity_id: 'o1'
    });
    expect(row.first_matched_at).toBeDefined();
    expect(row.first_matched_at >= before).toBe(true);
  });
});

describe('Client Matches: Unique Constraint', () => {
  test('duplicate client_id + opportunity_id violates unique', () => {
    const existing = [
      { client_id: 'c1', opportunity_id: 'o1' },
      { client_id: 'c1', opportunity_id: 'o2' }
    ];
    const newRow = { client_id: 'c1', opportunity_id: 'o1' };
    expect(wouldViolateUnique(newRow, existing)).toBe(true);
  });

  test('different opportunity_id does not violate unique', () => {
    const existing = [
      { client_id: 'c1', opportunity_id: 'o1' }
    ];
    const newRow = { client_id: 'c1', opportunity_id: 'o3' };
    expect(wouldViolateUnique(newRow, existing)).toBe(false);
  });

  test('same opportunity_id but different client_id does not violate unique', () => {
    const existing = [
      { client_id: 'c1', opportunity_id: 'o1' }
    ];
    const newRow = { client_id: 'c2', opportunity_id: 'o1' };
    expect(wouldViolateUnique(newRow, existing)).toBe(false);
  });
});

describe('Match Job Logs: RLS Policies', () => {
  test('authenticated users can SELECT', () => {
    expect(checkRlsPolicy('authenticated', 'SELECT')).toBe(true);
  });

  test('authenticated users cannot INSERT', () => {
    expect(checkRlsPolicy('authenticated', 'INSERT')).toBe(false);
  });

  test('authenticated users cannot UPDATE', () => {
    expect(checkRlsPolicy('authenticated', 'UPDATE')).toBe(false);
  });

  test('authenticated users cannot DELETE', () => {
    expect(checkRlsPolicy('authenticated', 'DELETE')).toBe(false);
  });

  test('service_role can do all operations', () => {
    expect(checkRlsPolicy('service_role', 'SELECT')).toBe(true);
    expect(checkRlsPolicy('service_role', 'INSERT')).toBe(true);
    expect(checkRlsPolicy('service_role', 'UPDATE')).toBe(true);
    expect(checkRlsPolicy('service_role', 'DELETE')).toBe(true);
  });

  test('anonymous users cannot access', () => {
    expect(checkRlsPolicy('anon', 'SELECT')).toBe(false);
  });
});
