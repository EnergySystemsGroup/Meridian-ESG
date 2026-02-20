/**
 * Tier 3b: View Integration Tests
 *
 * Connects to the REAL local Supabase instance and verifies that views
 * expose the columns that application code depends on. This catches schema
 * drift that the simulated Tier 3 tests cannot detect.
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
// funding_opportunities_with_geography
// ---------------------------------------------------------------------------
describe('View: funding_opportunities_with_geography', () => {
  test('view is queryable', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
  });

  test('exposes all base table passthrough columns', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select('*')
      .limit(1);

    expect(error).toBeNull();

    // Even if the table is empty, the query itself succeeds — which proves
    // the view definition is valid SQL. If the view has a broken join or
    // missing column reference, the query would fail.
    if (data.length > 0) {
      const columns = Object.keys(data[0]);

      const BASE_COLUMNS = [
        'id', 'title', 'minimum_award', 'maximum_award',
        'total_funding_available', 'cost_share_required', 'cost_share_percentage',
        'posted_date', 'open_date', 'close_date', 'description',
        'funding_source_id', 'raw_response_id', 'is_national',
        'agency_name', 'funding_type', 'actionable_summary',
        'tags', 'url', 'eligible_applicants', 'eligible_project_types',
        'eligible_locations', 'categories', 'created_at', 'updated_at',
        'relevance_score', 'relevance_reasoning', 'notes',
        'disbursement_type', 'award_process', 'eligible_activities',
        'enhanced_description', 'scoring', 'api_updated_at',
        'api_opportunity_id', 'api_source_id',
        'program_overview', 'program_use_cases',
        'application_summary', 'program_insights',
        'program_id',
      ];

      const missing = BASE_COLUMNS.filter(col => !columns.includes(col));
      expect(missing).toEqual([]);
    }
  });

  test('exposes computed status column', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select('status')
      .limit(1);

    expect(error).toBeNull();
    if (data.length > 0) {
      expect(Object.keys(data[0])).toContain('status');
    }
  });

  test('exposes source join columns', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select('source_display_name, source_type_display')
      .limit(1);

    expect(error).toBeNull();
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      expect(columns).toContain('source_display_name');
      expect(columns).toContain('source_type_display');
    }
  });

  test('exposes coverage area columns', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select('coverage_area_names, coverage_area_codes, coverage_area_types, coverage_state_codes')
      .limit(1);

    expect(error).toBeNull();
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      expect(columns).toContain('coverage_area_names');
      expect(columns).toContain('coverage_area_codes');
      expect(columns).toContain('coverage_area_types');
      expect(columns).toContain('coverage_state_codes');
    }
  });

  test('exposes promotion/review columns', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select('promotion_status, reviewed_by, reviewed_at, review_notes')
      .limit(1);

    expect(error).toBeNull();
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      expect(columns).toContain('promotion_status');
      expect(columns).toContain('reviewed_by');
      expect(columns).toContain('reviewed_at');
      expect(columns).toContain('review_notes');
    }
  });

  test('exposes legacy geographic columns', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select('eligible_states, eligible_counties_states, eligible_counties')
      .limit(1);

    expect(error).toBeNull();
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      expect(columns).toContain('eligible_states');
      expect(columns).toContain('eligible_counties_states');
      expect(columns).toContain('eligible_counties');
    }
  });

  test('admin review page columns all present', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const ADMIN_REVIEW_COLUMNS = [
      'id', 'title', 'agency_name', 'funding_type',
      'minimum_award', 'maximum_award', 'open_date', 'close_date',
      'status', 'relevance_score', 'promotion_status',
      'categories', 'eligible_project_types', 'is_national',
      'program_id', 'created_at', 'reviewed_by', 'reviewed_at',
      'review_notes', 'url', 'funding_source_id',
      'source_display_name', 'source_type_display',
      'coverage_state_codes',
    ];

    const { data, error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select(ADMIN_REVIEW_COLUMNS.join(', '))
      .limit(1);

    expect(error).toBeNull();
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      const missing = ADMIN_REVIEW_COLUMNS.filter(col => !columns.includes(col));
      expect(missing).toEqual([]);
    }
  });

  test('map query columns all present', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const MAP_COLUMNS = [
      'id', 'title', 'status', 'is_national',
      'coverage_state_codes', 'minimum_award', 'maximum_award',
      'promotion_status',
    ];

    const { data, error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select(MAP_COLUMNS.join(', '))
      .limit(1);

    expect(error).toBeNull();
    if (data.length > 0) {
      const columns = Object.keys(data[0]);
      const missing = MAP_COLUMNS.filter(col => !columns.includes(col));
      expect(missing).toEqual([]);
    }
  });

  test('promotion_status filter works via PostgREST', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select('id, promotion_status')
      .or('promotion_status.is.null,promotion_status.eq.promoted')
      .limit(1);

    expect(error).toBeNull();
  });

  test('state filter via coverage_state_codes works via PostgREST', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { error } = await db.supabase
      .from('funding_opportunities_with_geography')
      .select('id, is_national, coverage_state_codes')
      .or('is_national.eq.true,coverage_state_codes.cs.{"CA"}')
      .limit(1);

    expect(error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// coverage_areas_summary
// ---------------------------------------------------------------------------
describe('View: coverage_areas_summary', () => {
  test('view is queryable', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase
      .from('coverage_areas_summary')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// process_run_status
// ---------------------------------------------------------------------------
describe('View: process_run_status', () => {
  test('view is queryable', async (ctx) => {
    const reason = db.requireSupabase();
    if (reason) return ctx.skip(reason);

    const { data, error } = await db.supabase
      .from('process_run_status')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
