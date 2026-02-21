/**
 * View: funding_opportunities_with_geography Tests
 *
 * Tests the view that joins opportunities with coverage area data:
 * - coverage_state_codes calculation
 * - is_national flag handling
 * - Geographic aggregation
 *
 * NOTE: These tests validate expected behavior patterns.
 * For full integration tests, run against real Supabase.
 */

import { describe, test, expect } from 'vitest';

/**
 * Simulates the coverage_state_codes calculation from the view
 *
 * The real view does:
 * ARRAY_AGG(DISTINCT ca.state_code) FILTER (WHERE ca.state_code IS NOT NULL)
 */
function calculateCoverageStateCodes(opportunityCoverageAreas, coverageAreas) {
  const stateCodes = new Set();

  for (const link of opportunityCoverageAreas) {
    const area = coverageAreas.find(ca => ca.id === link.coverage_area_id);
    if (area?.state_code) {
      stateCodes.add(area.state_code);
    }
  }

  return stateCodes.size > 0 ? Array.from(stateCodes).sort() : null;
}

/**
 * Simulates building the view result for an opportunity
 */
function buildViewResult(opportunity, opportunityCoverageAreas, coverageAreas) {
  return {
    ...opportunity,
    coverage_state_codes: calculateCoverageStateCodes(
      opportunityCoverageAreas.filter(oca => oca.opportunity_id === opportunity.id),
      coverageAreas
    ),
  };
}

// Test data
const coverageAreas = [
  { id: 1, name: 'California', kind: 'state', state_code: 'CA' },
  { id: 2, name: 'PG&E', kind: 'utility', state_code: 'CA' },
  { id: 3, name: 'SCE', kind: 'utility', state_code: 'CA' },
  { id: 4, name: 'Texas', kind: 'state', state_code: 'TX' },
  { id: 5, name: 'Oncor', kind: 'utility', state_code: 'TX' },
  { id: 6, name: 'New York', kind: 'state', state_code: 'NY' },
  { id: 7, name: 'National', kind: 'national', state_code: null }, // National has no state_code
];

const opportunities = [
  { id: 'opp-1', title: 'National Grant', is_national: true },
  { id: 'opp-2', title: 'California Grant', is_national: false },
  { id: 'opp-3', title: 'Multi-State Grant', is_national: false },
  { id: 'opp-4', title: 'Utility Grant', is_national: false },
  { id: 'opp-5', title: 'No Coverage Grant', is_national: false },
];

const opportunityCoverageAreas = [
  // opp-1 (National) - no coverage areas typically
  // opp-2 (California) - state + utilities
  { opportunity_id: 'opp-2', coverage_area_id: 1 }, // CA state
  { opportunity_id: 'opp-2', coverage_area_id: 2 }, // PG&E (CA)
  // opp-3 (Multi-State)
  { opportunity_id: 'opp-3', coverage_area_id: 1 }, // CA
  { opportunity_id: 'opp-3', coverage_area_id: 4 }, // TX
  { opportunity_id: 'opp-3', coverage_area_id: 6 }, // NY
  // opp-4 (Utility only)
  { opportunity_id: 'opp-4', coverage_area_id: 2 }, // PG&E (CA)
  { opportunity_id: 'opp-4', coverage_area_id: 5 }, // Oncor (TX)
  // opp-5 (No coverage areas)
];

describe('View: funding_opportunities_with_geography', () => {

  describe('coverage_state_codes Calculation', () => {
    test('aggregates state codes from coverage areas', () => {
      const result = buildViewResult(opportunities[1], opportunityCoverageAreas, coverageAreas);

      // California grant with CA state + PG&E utility
      expect(result.coverage_state_codes).toEqual(['CA']);
    });

    test('deduplicates state codes', () => {
      const result = buildViewResult(opportunities[1], opportunityCoverageAreas, coverageAreas);

      // Both CA state and PG&E (CA) should result in single 'CA'
      expect(result.coverage_state_codes).toHaveLength(1);
      expect(result.coverage_state_codes).toContain('CA');
    });

    test('handles multiple states', () => {
      const result = buildViewResult(opportunities[2], opportunityCoverageAreas, coverageAreas);

      // Multi-state grant covers CA, TX, NY
      expect(result.coverage_state_codes).toContain('CA');
      expect(result.coverage_state_codes).toContain('TX');
      expect(result.coverage_state_codes).toContain('NY');
      expect(result.coverage_state_codes).toHaveLength(3);
    });

    test('extracts state from utility coverage areas', () => {
      const result = buildViewResult(opportunities[3], opportunityCoverageAreas, coverageAreas);

      // Utility-only grant with PG&E (CA) and Oncor (TX)
      expect(result.coverage_state_codes).toContain('CA');
      expect(result.coverage_state_codes).toContain('TX');
    });

    test('returns null for no coverage areas', () => {
      const result = buildViewResult(opportunities[4], opportunityCoverageAreas, coverageAreas);

      expect(result.coverage_state_codes).toBeNull();
    });

    test('returns null for national opportunities with no coverage areas', () => {
      const result = buildViewResult(opportunities[0], opportunityCoverageAreas, coverageAreas);

      expect(result.coverage_state_codes).toBeNull();
    });
  });

  describe('is_national Flag Handling', () => {
    test('national opportunities have is_national=true', () => {
      const result = buildViewResult(opportunities[0], opportunityCoverageAreas, coverageAreas);

      expect(result.is_national).toBe(true);
    });

    test('regional opportunities have is_national=false', () => {
      const result = buildViewResult(opportunities[1], opportunityCoverageAreas, coverageAreas);

      expect(result.is_national).toBe(false);
    });

    test('national + regional distinction for filtering', () => {
      const results = opportunities.map(opp =>
        buildViewResult(opp, opportunityCoverageAreas, coverageAreas)
      );

      const national = results.filter(r => r.is_national);
      const regional = results.filter(r => !r.is_national);

      expect(national).toHaveLength(1);
      expect(regional).toHaveLength(4);
    });
  });

  describe('Geographic Query Patterns', () => {
    test('filter by state using coverage_state_codes', () => {
      const results = opportunities.map(opp =>
        buildViewResult(opp, opportunityCoverageAreas, coverageAreas)
      );

      // Query pattern: coverage_state_codes @> ARRAY['CA']
      const caOpportunities = results.filter(r =>
        r.is_national || (r.coverage_state_codes && r.coverage_state_codes.includes('CA'))
      );

      // Should include: National (is_national=true) + California + Multi-State + Utility (PG&E)
      expect(caOpportunities.length).toBe(4);
    });

    test('national opportunities match all state queries', () => {
      const results = opportunities.map(opp =>
        buildViewResult(opp, opportunityCoverageAreas, coverageAreas)
      );

      const nationalOpp = results.find(r => r.is_national);

      // National should match any state query
      ['CA', 'TX', 'NY', 'FL'].forEach(state => {
        const matches = nationalOpp.is_national ||
          (nationalOpp.coverage_state_codes && nationalOpp.coverage_state_codes.includes(state));
        expect(matches).toBe(true);
      });
    });

    test('filter by multiple states', () => {
      const results = opportunities.map(opp =>
        buildViewResult(opp, opportunityCoverageAreas, coverageAreas)
      );

      // Query pattern: coverage_state_codes && ARRAY['CA', 'TX'] (overlap)
      const caOrTxOpportunities = results.filter(r =>
        r.is_national ||
        (r.coverage_state_codes && (
          r.coverage_state_codes.includes('CA') || r.coverage_state_codes.includes('TX')
        ))
      );

      expect(caOrTxOpportunities.length).toBe(4);
    });
  });

  describe('Data Integrity', () => {
    test('preserves opportunity fields', () => {
      const opp = { id: 'test', title: 'Test', status: 'open', is_national: false };
      const result = buildViewResult(opp, [], coverageAreas);

      expect(result.id).toBe('test');
      expect(result.title).toBe('Test');
      expect(result.status).toBe('open');
    });

    test('coverage_state_codes is sorted', () => {
      const result = buildViewResult(opportunities[2], opportunityCoverageAreas, coverageAreas);

      // Should be alphabetically sorted
      const sorted = [...result.coverage_state_codes].sort();
      expect(result.coverage_state_codes).toEqual(sorted);
    });
  });

  describe('Promotion Status in View', () => {
    test('view includes promotion_status column (passthrough)', () => {
      const opp = { id: 'test', title: 'Test', is_national: false, promotion_status: 'pending_review' };
      const result = buildViewResult(opp, [], coverageAreas);

      expect(result.promotion_status).toBe('pending_review');
    });

    test('view includes records with any promotion_status', () => {
      const statuses = [null, 'pending_review', 'promoted', 'rejected'];
      const opps = statuses.map((ps, i) => ({
        id: `ps-${i}`, title: `Test ${ps}`, is_national: false, promotion_status: ps,
      }));

      const results = opps.map(opp => buildViewResult(opp, [], coverageAreas));

      // View should include all records (no filtering by promotion_status)
      expect(results).toHaveLength(4);
      expect(results.map(r => r.promotion_status)).toEqual(statuses);
    });

    test('consumer-side filter replicates old WHERE clause', () => {
      const allOpps = [
        { id: 'a', promotion_status: null },
        { id: 'b', promotion_status: 'promoted' },
        { id: 'c', promotion_status: 'pending_review' },
        { id: 'd', promotion_status: 'rejected' },
      ];

      // Consumer applies: WHERE promotion_status IS NULL OR promotion_status = 'promoted'
      const visible = allOpps.filter(o =>
        o.promotion_status === null || o.promotion_status === 'promoted'
      );

      expect(visible).toHaveLength(2);
      expect(visible.map(o => o.id)).toEqual(['a', 'b']);
    });

    test('view includes review metadata columns', () => {
      const opp = {
        id: 'rev-1', title: 'Reviewed', is_national: false,
        promotion_status: 'promoted',
        reviewed_by: 'admin',
        reviewed_at: '2026-02-18T00:00:00Z',
        review_notes: 'Approved after verification',
      };
      const result = buildViewResult(opp, [], coverageAreas);

      expect(result.reviewed_by).toBe('admin');
      expect(result.reviewed_at).toBe('2026-02-18T00:00:00Z');
      expect(result.review_notes).toBe('Approved after verification');
    });
  });

  describe('View Schema Contract', () => {
    // This is the authoritative list of columns the view MUST expose.
    // Consumer code (API routes, services) depends on these columns.
    // If a column is missing from the view SQL, this test MUST fail.
    //
    // To keep this test useful without a live DB connection:
    // - The list is maintained manually, mirroring the SQL view definition.
    // - When adding a column to the view migration, add it here too.
    // - When an API route starts using a new column, add it here FIRST.
    const VIEW_COLUMNS = [
      // Base table passthrough columns
      'id', 'title', 'minimum_award', 'maximum_award', 'total_funding_available',
      'cost_share_required', 'cost_share_percentage', 'posted_date', 'open_date',
      'close_date', 'description', 'funding_source_id', 'raw_response_id',
      'is_national', 'agency_name', 'funding_type', 'actionable_summary',
      'tags', 'url', 'eligible_applicants', 'eligible_project_types',
      'eligible_locations', 'categories', 'created_at', 'updated_at',
      'relevance_score', 'relevance_reasoning', 'notes', 'disbursement_type',
      'award_process', 'eligible_activities', 'enhanced_description', 'scoring',
      'api_updated_at', 'api_opportunity_id', 'api_source_id',
      'program_overview', 'program_use_cases', 'application_summary', 'program_insights',
      'program_id',
      // Computed status (CASE expression, not a passthrough)
      'status',
      // Computed source columns (from JOIN to funding_sources)
      'source_display_name', 'source_type_display',
      // Legacy geographic columns (deprecated)
      'eligible_states', 'eligible_counties_states', 'eligible_counties',
      // Coverage area columns (current system)
      'coverage_area_names', 'coverage_area_codes', 'coverage_area_types',
      'coverage_state_codes',
      // Promotion/review columns
      'promotion_status', 'reviewed_by', 'reviewed_at', 'review_notes',
    ];

    // Columns that specific consumers depend on.
    // If ANY of these are missing from VIEW_COLUMNS, something is wrong.
    const ADMIN_REVIEW_COLUMNS = [
      'id', 'title', 'agency_name', 'funding_type', 'minimum_award', 'maximum_award',
      'open_date', 'close_date', 'status', 'relevance_score', 'promotion_status',
      'categories', 'eligible_project_types', 'is_national', 'program_id',
      'created_at', 'reviewed_by', 'reviewed_at', 'review_notes', 'url',
      'funding_source_id', 'source_display_name', 'source_type_display',
      'coverage_state_codes',
    ];

    const DETAIL_PAGE_COLUMNS = [
      'id', 'title', 'description', 'agency_name', 'funding_type', 'status',
      'minimum_award', 'maximum_award', 'open_date', 'close_date', 'url',
      'categories', 'eligible_project_types', 'is_national', 'program_id',
      'coverage_area_names', 'coverage_state_codes', 'promotion_status',
    ];

    const MAP_QUERY_COLUMNS = [
      'id', 'title', 'status', 'is_national', 'coverage_state_codes',
      'minimum_award', 'maximum_award', 'promotion_status',
    ];

    test('VIEW_COLUMNS includes all admin review dependencies', () => {
      const missing = ADMIN_REVIEW_COLUMNS.filter(col => !VIEW_COLUMNS.includes(col));
      expect(missing).toEqual([]);
    });

    test('VIEW_COLUMNS includes all detail page dependencies', () => {
      const missing = DETAIL_PAGE_COLUMNS.filter(col => !VIEW_COLUMNS.includes(col));
      expect(missing).toEqual([]);
    });

    test('VIEW_COLUMNS includes all map query dependencies', () => {
      const missing = MAP_QUERY_COLUMNS.filter(col => !VIEW_COLUMNS.includes(col));
      expect(missing).toEqual([]);
    });

    test('no duplicate columns in VIEW_COLUMNS', () => {
      const dupes = VIEW_COLUMNS.filter((col, i) => VIEW_COLUMNS.indexOf(col) !== i);
      expect(dupes).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    test('coverage area with null state_code excluded', () => {
      const oppWithNationalArea = [
        { opportunity_id: 'opp-test', coverage_area_id: 7 }, // National area (null state_code)
        { opportunity_id: 'opp-test', coverage_area_id: 1 }, // CA state
      ];

      const result = calculateCoverageStateCodes(oppWithNationalArea, coverageAreas);

      // Should only include CA, not null from national area
      expect(result).toEqual(['CA']);
    });

    test('handles unknown coverage_area_id', () => {
      const oppWithUnknownArea = [
        { opportunity_id: 'opp-test', coverage_area_id: 999 }, // Unknown
      ];

      const result = calculateCoverageStateCodes(oppWithUnknownArea, coverageAreas);

      expect(result).toBeNull();
    });
  });
});
