-- ============================================================================
-- MIGRATION: Fix Opportunity Count + Use coverage_areas
-- ============================================================================
-- Issues Fixed:
-- 1. Tooltip showed 78 opportunities for CA, state card showed 236
-- 2. Function was using old opportunity_state_eligibility instead of coverage_areas
--
-- Solution:
-- - Use coverage_areas/opportunity_coverage_areas (correct data source)
-- - Keep $30M per-applicant cap for funding
-- - COUNT all opportunities, SUM only those with award amounts
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
    status_array TEXT[];
BEGIN
    -- Convert comma-separated status to lowercase array
    IF p_status IS NOT NULL THEN
        SELECT array_agg(LOWER(s)) INTO status_array FROM unnest(string_to_array(p_status, ',')) AS s;
    END IF;

    RETURN QUERY
    WITH filtered_opportunities AS (
        -- Base filter - count ALL matching opportunities
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
            (p_status IS NULL OR LOWER(fo.status) = ANY(status_array)) AND
            (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR p_min_amount = 0 OR fo.maximum_award IS NULL OR fo.maximum_award >= p_min_amount) AND
            (p_max_amount IS NULL OR p_max_amount = 0 OR fo.maximum_award IS NULL OR fo.maximum_award <= p_max_amount) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories)
    ),
    -- Use coverage_areas instead of opportunity_state_eligibility
    state_specific_data AS (
        SELECT
            s.name AS state_name,
            s.code::TEXT AS st_code,
            -- COUNT all opportunities (including those without award amounts)
            COUNT(DISTINCT fo.id) AS state_opp_count,
            -- SUM with $30M cap, only for opportunities with award amounts
            SUM(
                CASE WHEN fo.maximum_award IS NOT NULL OR fo.minimum_award IS NOT NULL
                THEN LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), per_applicant_cap)
                ELSE 0 END
            ) AS state_funding
        FROM
            states s
        JOIN
            opportunity_coverage_areas oca ON TRUE
        JOIN
            coverage_areas ca ON oca.coverage_area_id = ca.id AND ca.state_code = s.code
        JOIN
            filtered_opportunities fo ON oca.opportunity_id = fo.id
        WHERE
            fo.is_national = false AND
            s.code != 'DC'
        GROUP BY
            s.name, s.code
    ),
    national_data AS (
        SELECT
            -- COUNT all national opportunities
            COUNT(DISTINCT fo.id) AS national_opp_count,
            -- SUM with $30M cap
            SUM(
                CASE WHEN fo.maximum_award IS NOT NULL OR fo.minimum_award IS NOT NULL
                THEN LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), per_applicant_cap)
                ELSE 0 END
            ) AS national_funding
        FROM
            filtered_opportunities fo
        WHERE
            fo.is_national = true
    ),
    all_states AS (
        SELECT name, code::TEXT FROM states WHERE code != 'DC'
    ),
    combined_data AS (
        SELECT
            als.name AS state_name,
            als.code AS st_code,
            COALESCE(ssd.state_funding, 0) + COALESCE((SELECT national_funding FROM national_data), 0) AS total_funding,
            COALESCE(ssd.state_opp_count, 0) + COALESCE((SELECT national_opp_count FROM national_data), 0) AS total_opp_count
        FROM
            all_states als
        LEFT JOIN
            state_specific_data ssd ON als.code = ssd.st_code
    )
    SELECT
        cd.state_name AS state,
        cd.st_code AS state_code,
        cd.total_funding AS value,
        cd.total_opp_count::INTEGER AS opportunities
    FROM
        combined_data cd
    ORDER BY
        cd.state_name;
END;
$$ LANGUAGE plpgsql;
