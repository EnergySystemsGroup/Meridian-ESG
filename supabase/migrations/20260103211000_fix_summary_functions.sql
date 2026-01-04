-- Migration: Fix summary functions for Funding Summary panel
-- Purpose: Match function signatures to API params (p_status, p_categories, p_project_types)
-- Created: 2026-01-03
--
-- Problem: API sends 3 params but functions expect 5-6 different params
-- Fix: Standardize all summary functions to accept same params as get_funding_by_state_v3

-- ============================================================================
-- 1. get_total_funding_available
-- ============================================================================
-- Drop all possible old signatures (idempotent)
DROP FUNCTION IF EXISTS get_total_funding_available(text, text, numeric, numeric, text[], char);  -- old 6-param
DROP FUNCTION IF EXISTS get_total_funding_available(text, text[], text[]);                        -- new 3-param

CREATE OR REPLACE FUNCTION get_total_funding_available(
    p_status TEXT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status_array TEXT[];
    v_total NUMERIC;
BEGIN
    -- Parse comma-separated status into array
    IF p_status IS NOT NULL AND p_status <> '' THEN
        v_status_array := string_to_array(p_status, ',');
    END IF;

    SELECT COALESCE(SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), 30000000)), 0)
    INTO v_total
    FROM funding_opportunities fo
    WHERE (v_status_array IS NULL OR fo.status = ANY(v_status_array))
      AND (p_categories IS NULL OR fo.categories && p_categories)
      AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

    RETURN v_total;
END;
$$;

COMMENT ON FUNCTION get_total_funding_available(TEXT, TEXT[], TEXT[]) IS
    'Returns total funding available with $30M per-applicant cap. Supports status, categories, and project_types filters.';

-- ============================================================================
-- 2. get_total_opportunities_count
-- ============================================================================
-- Drop all possible old signatures (idempotent)
DROP FUNCTION IF EXISTS get_total_opportunities_count(text, text, numeric, numeric, text[]);  -- old 5-param
DROP FUNCTION IF EXISTS get_total_opportunities_count(text, text[], text[]);                  -- new 3-param

CREATE OR REPLACE FUNCTION get_total_opportunities_count(
    p_status TEXT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status_array TEXT[];
    v_count BIGINT;
BEGIN
    -- Parse comma-separated status into array
    IF p_status IS NOT NULL AND p_status <> '' THEN
        v_status_array := string_to_array(p_status, ',');
    END IF;

    SELECT COUNT(DISTINCT fo.id)
    INTO v_count
    FROM funding_opportunities fo
    WHERE (v_status_array IS NULL OR fo.status = ANY(v_status_array))
      AND (p_categories IS NULL OR fo.categories && p_categories)
      AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION get_total_opportunities_count(TEXT, TEXT[], TEXT[]) IS
    'Returns total count of funding opportunities. Supports status, categories, and project_types filters.';

-- ============================================================================
-- 3. get_states_with_funding_count
-- ============================================================================
-- Drop all possible old signatures (idempotent)
DROP FUNCTION IF EXISTS get_states_with_funding_count(text, text, numeric, numeric, text[]);  -- old 5-param
DROP FUNCTION IF EXISTS get_states_with_funding_count(text, text[], text[]);                  -- new 3-param

CREATE OR REPLACE FUNCTION get_states_with_funding_count(
    p_status TEXT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_project_types TEXT[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status_array TEXT[];
    v_count BIGINT;
BEGIN
    -- Parse comma-separated status into array
    IF p_status IS NOT NULL AND p_status <> '' THEN
        v_status_array := string_to_array(p_status, ',');
    END IF;

    -- Count unique states that have funding opportunities
    SELECT COUNT(DISTINCT ca.state_code)
    INTO v_count
    FROM funding_opportunities fo
    JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
    JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
    WHERE ca.state_code IS NOT NULL
      AND (v_status_array IS NULL OR fo.status = ANY(v_status_array))
      AND (p_categories IS NULL OR fo.categories && p_categories)
      AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types);

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION get_states_with_funding_count(TEXT, TEXT[], TEXT[]) IS
    'Returns count of states with funding opportunities. Supports status, categories, and project_types filters.';
