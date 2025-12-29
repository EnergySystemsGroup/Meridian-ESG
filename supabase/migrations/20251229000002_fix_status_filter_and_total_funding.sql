-- ============================================================================
-- MIGRATION: Fix Status Filter + Total Funding Calculation
-- ============================================================================
--
-- ISSUES FIXED (December 29, 2025):
-- 1. Status filter doesn't support comma-separated values (API sends 'Open,Upcoming')
-- 2. Status filter is case-sensitive (DB has 'open', API sends 'Open')
-- 3. get_total_funding_available shows $83B (wrong metric - uses maximum_award * 10)
--
-- SOLUTION:
-- 1. Use string_to_array() + ANY() for comma-separated status matching
-- 2. Apply LOWER() for case-insensitive comparison
-- 3. Change get_total_funding_available to sum per-applicant amounts with $30M cap
--
-- CONTEXT:
-- This follows migration 20251229000001 which added the $30M cap but:
-- - Reverted case-insensitive matching that was in 20250421000001
-- - Didn't support comma-separated status values like 'Open,Upcoming'
-- - Didn't update get_total_funding_available to use per-applicant amounts
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Fixing status filter and total funding calculation';
END $$;

-- ============================================================================
-- FUNCTION 1: get_funding_by_state_per_applicant (FIXES status filter)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_funding_by_state_per_applicant(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    state TEXT,
    state_code TEXT,
    value NUMERIC,
    opportunities INTEGER
) AS $$
DECLARE
    per_applicant_cap CONSTANT NUMERIC := 30000000;
BEGIN
    RETURN QUERY
    WITH filtered_opportunities AS (
        SELECT
            fo.id,
            fo.maximum_award,
            fo.minimum_award,
            fo.is_national
        FROM
            funding_opportunities fo
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            -- FIX: Support comma-separated status values with case-insensitive matching
            (p_status IS NULL OR LOWER(fo.status) = ANY(string_to_array(LOWER(p_status), ','))) AND
            (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR
                COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount
            ) AND
            (p_max_amount IS NULL OR
                COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount
            ) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories) AND
            (fo.maximum_award IS NOT NULL OR fo.minimum_award IS NOT NULL)
    ),
    state_specific_data AS (
        SELECT
            s.name AS state_name,
            s.code::TEXT AS state_code,
            COUNT(DISTINCT fo.id) AS state_opp_count,
            SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), per_applicant_cap)) AS state_funding
        FROM
            states s
        LEFT JOIN
            opportunity_state_eligibility ose ON s.id = ose.state_id
        JOIN
            filtered_opportunities fo ON ose.opportunity_id = fo.id
        WHERE
            fo.is_national = false
        GROUP BY
            s.name, s.code
    ),
    national_data AS (
        SELECT
            COUNT(DISTINCT fo.id) AS national_opp_count,
            SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), per_applicant_cap)) AS national_funding
        FROM
            filtered_opportunities fo
        WHERE
            fo.is_national = true
    ),
    all_states AS (
        SELECT name, code::TEXT FROM states
    ),
    combined_data AS (
        SELECT
            als.name AS state_name,
            als.code AS state_code,
            COALESCE(ssd.state_funding, 0) + COALESCE((SELECT national_funding FROM national_data), 0) AS total_funding,
            COALESCE(ssd.state_opp_count, 0) + COALESCE((SELECT national_opp_count FROM national_data), 0) AS total_opp_count
        FROM
            all_states als
        LEFT JOIN
            state_specific_data ssd ON als.code = ssd.state_code
    )
    SELECT
        cd.state_name AS state,
        cd.state_code,
        cd.total_funding AS value,
        cd.total_opp_count::INTEGER AS opportunities
    FROM
        combined_data cd
    ORDER BY
        cd.state_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION 2: get_total_funding_available (REPLACE with per-applicant calculation)
-- ============================================================================
-- OLD: Used total_funding_available or maximum_award * 10 (wrong metric)
-- NEW: Sum of per-applicant amounts with $30M cap (consistent with map)
CREATE OR REPLACE FUNCTION get_total_funding_available(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_state_code CHARACTER(2) DEFAULT NULL
)
RETURNS NUMERIC AS $$
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
        -- FIX: Support comma-separated status values with case-insensitive matching
        (p_status IS NULL OR LOWER(fo.status) = ANY(string_to_array(LOWER(p_status), ','))) AND
        (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
        (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
        (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories) AND
        (fo.maximum_award IS NOT NULL OR fo.minimum_award IS NOT NULL);

    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION 3: get_total_opportunities_count (FIX status filter)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_total_opportunities_count(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS INTEGER AS $$
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
        -- FIX: Support comma-separated status values with case-insensitive matching
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
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION 4: get_states_with_funding_count (FIX status filter)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_states_with_funding_count(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    state_count INTEGER := 0;
    has_national BOOLEAN := FALSE;
    opp_count INTEGER := 0;
    states_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO states_count FROM states WHERE code != 'DC';

    -- FIX: Support comma-separated status values with case-insensitive matching
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
$$ LANGUAGE plpgsql;
