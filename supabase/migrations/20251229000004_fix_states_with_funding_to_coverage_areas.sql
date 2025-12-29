-- ============================================================================
-- MIGRATION: Fix get_states_with_funding_count to use coverage_areas
-- ============================================================================
-- Issue: Function still used defunct opportunity_state_eligibility table
--        in its ELSE branch (when no national opportunities match filters)
--
-- Solution: Replace opportunity_state_eligibility with coverage_areas +
--           opportunity_coverage_areas (consistent with get_funding_by_state_per_applicant)
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
    status_array TEXT[];
BEGIN
    -- Convert comma-separated status to lowercase array
    IF p_status IS NOT NULL THEN
        SELECT array_agg(LOWER(s)) INTO status_array FROM unnest(string_to_array(p_status, ',')) AS s;
    END IF;

    SELECT COUNT(*) INTO states_count FROM states WHERE code != 'DC';

    -- Count matching opportunities
    SELECT COUNT(DISTINCT fo.id) INTO opp_count
    FROM funding_opportunities fo
    LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
    WHERE
        (p_status IS NULL OR LOWER(fo.status) = ANY(status_array)) AND
        (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
        (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
        (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);

    IF opp_count = 0 THEN
        RETURN 0;
    END IF;

    -- Check for national opportunities
    SELECT EXISTS (
        SELECT 1
        FROM funding_opportunities fo
        LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            fo.is_national = TRUE AND
            (p_status IS NULL OR LOWER(fo.status) = ANY(status_array)) AND
            (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
            (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories)
    ) INTO has_national;

    IF has_national THEN
        -- National opportunities available to all states
        state_count := states_count;
    ELSE
        -- FIX: Use coverage_areas instead of opportunity_state_eligibility
        SELECT
            COUNT(DISTINCT s.id)
        INTO
            state_count
        FROM
            states s
        JOIN
            opportunity_coverage_areas oca ON TRUE
        JOIN
            coverage_areas ca ON oca.coverage_area_id = ca.id AND ca.state_code = s.code
        JOIN
            funding_opportunities fo ON oca.opportunity_id = fo.id
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            s.code != 'DC' AND
            (p_status IS NULL OR LOWER(fo.status) = ANY(status_array)) AND
            (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount) AND
            (p_max_amount IS NULL OR COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    END IF;

    RETURN COALESCE(state_count, 0);
END;
$$ LANGUAGE plpgsql;
