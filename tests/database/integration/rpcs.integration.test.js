/**
 * Tier 3b: RPC Integration Tests
 *
 * Calls REAL RPC functions on the local Supabase instance and verifies
 * that they execute without error and return the expected shapes. This
 * catches signature mismatches, missing function definitions, and return
 * type changes that the simulated Tier 3 tests cannot detect.
 *
 * Prerequisites:
 *   - Docker running
 *   - `supabase start` executed
 *   - All migrations applied (`supabase migration up`)
 *
 * Run: npm run test:db:integration
 */

import { describe, test, expect } from 'vitest';
import { setupSupabaseTests } from './supabaseLocal.js';

const db = setupSupabaseTests();

// ---------------------------------------------------------------------------
// get_funding_opportunities_dynamic_sort
// ---------------------------------------------------------------------------
describe('RPC: get_funding_opportunities_dynamic_sort', () => {
  test('executes with default params', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_opportunities_dynamic_sort', {
      p_sort_by: 'relevance',
      p_sort_direction: 'desc',
      p_page: 1,
      p_page_size: 5,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('returns view columns in each row', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_opportunities_dynamic_sort', {
      p_sort_by: 'relevance',
      p_sort_direction: 'desc',
      p_page: 1,
      p_page_size: 1,
    });

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);

    const columns = Object.keys(data[0]);

    // The RPC returns SETOF funding_opportunities_with_geography,
    // so every row should have the same columns as the view
    expect(columns).toContain('id');
    expect(columns).toContain('title');
    expect(columns).toContain('status');
    expect(columns).toContain('relevance_score');
    expect(columns).toContain('coverage_state_codes');
    expect(columns).toContain('promotion_status');
    expect(columns).toContain('program_id');
  });

  test('accepts status array filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_opportunities_dynamic_sort', {
      p_status: ['Open'],
      p_sort_by: 'relevance',
      p_sort_direction: 'desc',
      p_page: 1,
      p_page_size: 5,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  test('accepts state_code filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_opportunities_dynamic_sort', {
      p_state_code: 'CA',
      p_sort_by: 'relevance',
      p_sort_direction: 'desc',
      p_page: 1,
      p_page_size: 5,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  test('accepts search text filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_opportunities_dynamic_sort', {
      p_search: 'energy',
      p_sort_by: 'relevance',
      p_sort_direction: 'desc',
      p_page: 1,
      p_page_size: 5,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  test('accepts all sort modes', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const sortModes = ['relevance', 'deadline', 'amount', 'recent', 'title'];

    for (const mode of sortModes) {
      const { error } = await db.supabase.rpc('get_funding_opportunities_dynamic_sort', {
        p_sort_by: mode,
        p_sort_direction: 'desc',
        p_page: 1,
        p_page_size: 1,
      });

      expect(error).toBeNull();
    }
  });

  test('accepts category and project_type filters', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_opportunities_dynamic_sort', {
      p_categories: ['Energy'],
      p_project_types: ['Solar'],
      p_sort_by: 'relevance',
      p_sort_direction: 'desc',
      p_page: 1,
      p_page_size: 5,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('accepts coverage_types filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_opportunities_dynamic_sort', {
      p_coverage_types: ['state', 'utility'],
      p_sort_by: 'relevance',
      p_sort_direction: 'desc',
      p_page: 1,
      p_page_size: 5,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('accepts tracked_ids filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_opportunities_dynamic_sort', {
      p_tracked_ids: ['00000000-0000-0000-0000-000000000000'],
      p_sort_by: 'relevance',
      p_sort_direction: 'desc',
      p_page: 1,
      p_page_size: 5,
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// get_state_scope_breakdown
// ---------------------------------------------------------------------------
describe('RPC: get_state_scope_breakdown', () => {
  test('executes with a state code', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_state_scope_breakdown', {
      p_state_code: 'CA',
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('returns JSON object', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_state_scope_breakdown', {
      p_state_code: 'CA',
    });

    expect(error).toBeNull();
    expect(typeof data).toBe('object');
  });

  test('accepts optional status filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_state_scope_breakdown', {
      p_state_code: 'CA',
      p_status: ['Open'],
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  test('accepts optional project_types filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_state_scope_breakdown', {
      p_state_code: 'CA',
      p_project_types: ['Solar'],
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// get_funding_by_state_v3
// ---------------------------------------------------------------------------
describe('RPC: get_funding_by_state_v3', () => {
  test('executes with no filters', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_by_state_v3');

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('returns expected column names', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_by_state_v3');

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    const columns = Object.keys(data[0]);
    expect(columns).toContain('state_code');
    expect(columns).toContain('state');
    expect(columns).toContain('value');
    expect(columns).toContain('opportunities');
  });

  test('accepts status filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_by_state_v3', {
      p_status: 'Open',
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  test('accepts categories filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_by_state_v3', {
      p_categories: ['Energy'],
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// get_funding_by_project_type
// ---------------------------------------------------------------------------
describe('RPC: get_funding_by_project_type', () => {
  test('executes successfully', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_by_project_type');

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('returns expected column names', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_funding_by_project_type');

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    const columns = Object.keys(data[0]);
    expect(columns).toContain('project_type');
    expect(columns).toContain('total_funding');
    expect(columns).toContain('opportunity_count');
  });
});

// ---------------------------------------------------------------------------
// get_coverage_filter_counts
// ---------------------------------------------------------------------------
describe('RPC: get_coverage_filter_counts', () => {
  test('executes with no state filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_coverage_filter_counts');

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('executes with state filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_coverage_filter_counts', {
      p_state_code: 'CA',
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('returns expected column names', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_coverage_filter_counts');

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    const columns = Object.keys(data[0]);
    expect(columns).toContain('coverage_type');
    expect(columns).toContain('opportunity_count');
  });
});

// ---------------------------------------------------------------------------
// get_opportunity_counts_by_coverage_area
// ---------------------------------------------------------------------------
describe('RPC: get_opportunity_counts_by_coverage_area', () => {
  test('executes with state + kind', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_opportunity_counts_by_coverage_area', {
      p_state_code: 'CA',
      p_kind: 'utility',
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  test('returns expected column names', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_opportunity_counts_by_coverage_area', {
      p_state_code: 'CA',
      p_kind: 'county',
    });

    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    const columns = Object.keys(data[0]);
    expect(columns).toContain('area_id');
    expect(columns).toContain('area_name');
    expect(columns).toContain('area_code');
    expect(columns).toContain('opportunity_count');
    expect(columns).toContain('total_funding');
  });

  test('accepts optional status and project_types', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_opportunity_counts_by_coverage_area', {
      p_state_code: 'CA',
      p_kind: 'utility',
      p_status: ['Open'],
      p_project_types: ['Solar'],
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// get_total_opportunities_count
// ---------------------------------------------------------------------------
describe('RPC: get_total_opportunities_count', () => {
  test('executes with no filters', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_total_opportunities_count');

    expect(error).toBeNull();
    expect(typeof data).toBe('number');
  });

  test('accepts status filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_total_opportunities_count', {
      p_status: 'Open',
    });

    expect(error).toBeNull();
    expect(typeof data).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// get_total_funding_available
// ---------------------------------------------------------------------------
describe('RPC: get_total_funding_available', () => {
  test('executes with no filters', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_total_funding_available');

    expect(error).toBeNull();
    // Returns numeric which may be null if no rows, or a number
    expect(data === null || typeof data === 'number').toBe(true);
  });

  test('accepts status filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_total_funding_available', {
      p_status: 'Open',
    });

    expect(error).toBeNull();
    expect(data === null || typeof data === 'number').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// get_national_opportunities_count
// ---------------------------------------------------------------------------
describe('RPC: get_national_opportunities_count', () => {
  test('executes with no filters', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_national_opportunities_count');

    expect(error).toBeNull();
    expect(typeof data).toBe('number');
  });

  test('accepts status array filter', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase.rpc('get_national_opportunities_count', {
      p_status: ['Open'],
    });

    expect(error).toBeNull();
    expect(typeof data).toBe('number');
  });
});
