/**
 * Supabase Local Client for Integration Tests
 *
 * Connects to the local Supabase instance started via `supabase start`.
 * Uses the service_role key to bypass RLS for testing.
 *
 * Prerequisites:
 *   - Docker running
 *   - `supabase start` (spins up local Postgres)
 *   - All migrations applied (`supabase migration up`)
 *
 * Connection details come from `supabase status` output.
 */

import { createClient } from '@supabase/supabase-js';
import { beforeAll } from 'vitest';

// Local Supabase defaults from `supabase start`
const SUPABASE_URL = process.env.SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

/**
 * Create a Supabase client connected to the local instance.
 * Uses service_role key so RLS is bypassed for test queries.
 */
export function createLocalClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Check whether the local Supabase instance is reachable.
 * Returns true if connection succeeds, false otherwise.
 *
 * This is evaluated ONCE at module load time so that test.skipIf()
 * has the value available during test registration.
 */
let _supabaseRunning = null;

export async function isSupabaseRunning() {
  if (_supabaseRunning !== null) return _supabaseRunning;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(3000),
    });
    _supabaseRunning = response.ok;
  } catch {
    _supabaseRunning = false;
  }
  return _supabaseRunning;
}

/**
 * Local Supabase DB URL for direct postgres queries when needed.
 */
export const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * Shared test setup for integration test files.
 *
 * Call at the top level of each test file:
 *   const db = setupSupabaseTests();
 *
 * Then use db.supabase for queries and db.requireSupabase() for skip checks.
 * The beforeAll hook registers in the calling file's scope.
 */
export function setupSupabaseTests() {
  let supabase = null;
  let available = false;

  beforeAll(async () => {
    available = await isSupabaseRunning();
    if (available) {
      supabase = createLocalClient();
    }
  });

  return {
    get supabase() { return supabase; },
    requireSupabase() {
      if (!available) return 'Supabase not running — skipping integration test';
      return null;
    },
  };
}
