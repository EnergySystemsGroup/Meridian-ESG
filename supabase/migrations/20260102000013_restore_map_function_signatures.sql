-- Migration: Restore Original Map Function Signatures
-- Purpose: Fix broken functions from security migration that changed signatures
-- Created: 2026-01-02
--
-- The security migration (20260102000002) rewrote these functions with completely
-- different parameter lists instead of just adding SET search_path = public.
-- Then 20260102000003 dropped the original signatures.
-- This restores the original signatures that the API code expects, WITH the security fix.

-- ============================================================================
-- DROP INCOMPATIBLE NEW VERSIONS
-- ============================================================================

DROP FUNCTION IF EXISTS get_total_funding_available(text[], text[], text[], text[], text);
DROP FUNCTION IF EXISTS get_total_opportunities_count(text[], text[], text[], text[], text);
DROP FUNCTION IF EXISTS get_states_with_funding_count(text[], text[], text[], text[]);

-- ============================================================================
-- FUNCTION 1: get_total_funding_available
-- Original signature with SET search_path = public
-- ============================================================================
CREATE OR REPLACE FUNCTION get_total_funding_available(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_state_code CHARACTER(2) DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    total NUMERIC := 0;
    per_applicant_cap CONSTANT NUMERIC := 30000000;
BEGIN
    SELECT
        SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), per_applicant_cap))
    INTO
        total
    FROM
        funding_opportunities fo
    LEFT JOIN
        funding_sources fs ON fo.funding_source_id = fs.id
    WHERE
        (p_status IS NULL OR LOWER(fo.status) = ANY(string_to_array(LOWER(p_status), ','))) AND
        (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
        (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
        (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories) AND
        (fo.maximum_award IS NOT NULL OR fo.minimum_award IS NOT NULL);

    RETURN COALESCE(total, 0);
END;
$$;

-- ============================================================================
-- FUNCTION 2: get_total_opportunities_count
-- Original signature with SET search_path = public
-- ============================================================================
CREATE OR REPLACE FUNCTION get_total_opportunities_count(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    opp_count INTEGER := 0;
BEGIN
    SELECT
        COUNT(DISTINCT fo.id)
    INTO
        opp_count
    FROM
        funding_opportunities fo
    LEFT JOIN
        funding_sources fs ON fo.funding_source_id = fs.id
    WHERE
        (p_status IS NULL OR LOWER(fo.status) = ANY(string_to_array(LOWER(p_status), ','))) AND
        (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
        (p_min_amount IS NULL OR
            COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount
        ) AND
        (p_max_amount IS NULL OR
            COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount
        ) AND
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);

    RETURN COALESCE(opp_count, 0);
END;
$$;

-- ============================================================================
-- FUNCTION 3: get_states_with_funding_count
-- Original signature with SET search_path = public
-- ============================================================================
CREATE OR REPLACE FUNCTION get_states_with_funding_count(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    state_count INTEGER := 0;
    has_national BOOLEAN := FALSE;
    opp_count INTEGER := 0;
    states_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO states_count FROM states WHERE code != 'DC';

    SELECT COUNT(DISTINCT fo.id) INTO opp_count
    FROM funding_opportunities fo
    LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
    WHERE
        (p_status IS NULL OR LOWER(fo.status) = ANY(string_to_array(LOWER(p_status), ','))) AND
        (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
        (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
        (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);

    IF opp_count = 0 THEN
        RETURN 0;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM funding_opportunities fo
        LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            fo.is_national = TRUE AND
            (p_status IS NULL OR LOWER(fo.status) = ANY(string_to_array(LOWER(p_status), ','))) AND
            (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
            (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories)
    ) INTO has_national;

    IF has_national THEN
        state_count := states_count;
    ELSE
        SELECT
            COUNT(DISTINCT s.id)
        INTO
            state_count
        FROM
            states s
        JOIN
            opportunity_state_eligibility ose ON s.id = ose.state_id
        JOIN
            funding_opportunities fo ON ose.opportunity_id = fo.id
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            s.code != 'DC' AND
            (p_status IS NULL OR LOWER(fo.status) = ANY(string_to_array(LOWER(p_status), ','))) AND
            (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
            (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    END IF;

    RETURN COALESCE(state_count, 0);
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_total_funding_available(TEXT, TEXT, NUMERIC, NUMERIC, TEXT[], CHARACTER(2)) TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_opportunities_count(TEXT, TEXT, NUMERIC, NUMERIC, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_states_with_funding_count(TEXT, TEXT, NUMERIC, NUMERIC, TEXT[]) TO authenticated;
