-- Migration: Mark Deprecated Tables
-- Purpose: Document tables that are superseded but kept for backward compatibility
-- Created: 2026-01-02
-- NOTE: No tables are dropped - all kept for reference

-- ============================================================================
-- ABANDONED TABLES (created but never implemented in code)
-- ============================================================================

COMMENT ON TABLE process_runs IS '@deprecated ABANDONED - created in schema but never implemented in any code. Keep for reference. V2 uses pipeline_runs instead.';

COMMENT ON TABLE funding_programs IS '@deprecated NEVER USED - intended for program groupings but never implemented. Direct source_id references used instead.';

-- ============================================================================
-- V1 LEGACY TABLES (replaced by V2 equivalents)
-- ============================================================================

COMMENT ON TABLE api_source_runs IS '@deprecated V1 legacy table - replaced by pipeline_runs in V2 pipeline. Kept for backward compatibility with admin pages. See pipeline_runs for current implementation.';

COMMENT ON TABLE api_extracted_opportunities IS '@deprecated Intermediate extraction table from original V1 design. V2 pipeline writes directly to funding_opportunities. Keep for reference.';

-- ============================================================================
-- LEGACY GEOGRAPHIC TABLES (superseded by coverage_areas system)
-- ============================================================================

COMMENT ON TABLE opportunity_state_eligibility IS '@deprecated Superseded by coverage_areas system as of ADR-001. Use opportunity_coverage_areas junction table instead. Keep for backward compatibility with views.';

COMMENT ON TABLE opportunity_county_eligibility IS '@deprecated Superseded by coverage_areas system as of ADR-001. Use opportunity_coverage_areas junction table instead. Keep for backward compatibility with views.';
