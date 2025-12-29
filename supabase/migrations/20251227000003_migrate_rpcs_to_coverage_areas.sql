-- Migrate RPC functions from opportunity_state_eligibility to opportunity_coverage_areas
-- This ensures consistency with the scope breakdown and opportunity list APIs

-- 1. Fix get_funding_by_state_per_applicant (used for map tooltips)
CREATE OR REPLACE FUNCTION public.get_funding_by_state_per_applicant(
    p_status text DEFAULT NULL::text,
    p_source_type text DEFAULT NULL::text,
    p_min_amount numeric DEFAULT NULL::numeric,
    p_max_amount numeric DEFAULT NULL::numeric,
    p_categories text[] DEFAULT NULL::text[]
)
RETURNS TABLE(state text, state_code text, value numeric, opportunities integer)
LANGUAGE plpgsql
AS $function$
DECLARE
    status_array text[];
BEGIN
    -- Convert comma-separated status to lowercase array
    IF p_status IS NOT NULL THEN
        SELECT array_agg(LOWER(s)) INTO status_array FROM unnest(string_to_array(p_status, ',')) AS s;
    END IF;

    RETURN QUERY
    WITH filtered_opportunities AS (
        SELECT
            fo.id,
            fo.maximum_award,
            fo.minimum_award,
            fo.is_national,
            fo.total_funding_available
        FROM
            funding_opportunities fo
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            (p_status IS NULL OR LOWER(fo.status) = ANY(status_array)) AND
            (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
            (
                p_min_amount IS NULL OR
                p_min_amount = 0 OR
                fo.maximum_award IS NULL OR
                fo.maximum_award >= p_min_amount
            ) AND
            (
                p_max_amount IS NULL OR
                p_max_amount = 0 OR
                fo.maximum_award IS NULL OR
                fo.maximum_award <= p_max_amount
            ) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories)
    ),
    -- Use coverage_areas instead of opportunity_state_eligibility
    state_specific_data AS (
        SELECT
            s.name AS state_name,
            s.code::TEXT AS st_code,
            COUNT(DISTINCT fo.id) AS state_opp_count,
            SUM(
                CASE
                    WHEN fo.total_funding_available > 0 THEN fo.total_funding_available
                    WHEN fo.maximum_award > 0 THEN fo.maximum_award * 10
                    WHEN fo.minimum_award > 0 THEN fo.minimum_award * 10
                    ELSE 0
                END
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
            COUNT(DISTINCT fo.id) AS national_opp_count,
            SUM(
                CASE
                    WHEN fo.total_funding_available > 0 THEN fo.total_funding_available
                    WHEN fo.maximum_award > 0 THEN fo.maximum_award * 10
                    WHEN fo.minimum_award > 0 THEN fo.minimum_award * 10
                    ELSE 0
                END
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
$function$;

-- 2. Fix get_states_with_funding_count (dashboard metric)
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
    status_array TEXT[];
BEGIN
    -- Convert comma-separated status to array
    IF p_status IS NOT NULL THEN
        status_array := string_to_array(p_status, ',');
    END IF;

    SELECT
        EXISTS (
            SELECT 1
            FROM funding_opportunities fo
            LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
            WHERE
                fo.is_national = TRUE AND
                (p_status IS NULL OR fo.status ILIKE ANY(status_array)) AND
                (p_source_type IS NULL OR fs.type::TEXT ILIKE p_source_type) AND
                (p_min_amount IS NULL OR p_min_amount = 0 OR
                    (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
                ) AND
                (p_max_amount IS NULL OR p_max_amount = 0 OR
                    fo.maximum_award IS NULL OR
                    fo.maximum_award >= p_max_amount
                ) AND
                (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories)
        )
    INTO
        has_national;

    IF has_national THEN
        SELECT COUNT(*) INTO state_count
        FROM states
        WHERE code != 'DC';
    ELSE
        -- Use coverage_areas instead of opportunity_state_eligibility
        SELECT
            COUNT(DISTINCT s.id)
        INTO
            state_count
        FROM
            states s
        JOIN
            coverage_areas ca ON ca.state_code = s.code
        JOIN
            opportunity_coverage_areas oca ON oca.coverage_area_id = ca.id
        JOIN
            funding_opportunities fo ON oca.opportunity_id = fo.id
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            s.code != 'DC' AND
            (p_status IS NULL OR fo.status ILIKE ANY(status_array)) AND
            (p_source_type IS NULL OR fs.type::TEXT ILIKE p_source_type) AND
            (p_min_amount IS NULL OR p_min_amount = 0 OR
                (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
            ) AND
            (p_max_amount IS NULL OR p_max_amount = 0 OR
                fo.maximum_award IS NULL OR
                fo.maximum_award >= p_max_amount
            ) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);
    END IF;

    RETURN COALESCE(state_count, 0);
END;
$$ LANGUAGE plpgsql;

-- 3. Fix get_total_funding_available (dashboard metric)
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
    status_array TEXT[];
BEGIN
    -- Convert comma-separated status to array
    IF p_status IS NOT NULL THEN
        status_array := string_to_array(p_status, ',');
    END IF;

    WITH filtered_opportunities AS (
        SELECT DISTINCT
            fo.id,
            fo.total_funding_available,
            fo.maximum_award,
            fo.minimum_award,
            fo.is_national
        FROM
            funding_opportunities fo
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        LEFT JOIN
            opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        LEFT JOIN
            coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE
            (p_status IS NULL OR fo.status ILIKE ANY(status_array)) AND
            (p_source_type IS NULL OR fs.type::TEXT ILIKE p_source_type) AND
            (p_min_amount IS NULL OR p_min_amount = 0 OR
                (fo.maximum_award IS NOT NULL AND fo.maximum_award >= p_min_amount)
            ) AND
            (p_max_amount IS NULL OR p_max_amount = 0 OR
                fo.maximum_award IS NULL OR
                fo.maximum_award >= p_max_amount
            ) AND
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories) AND
            (p_state_code IS NULL OR fo.is_national OR ca.state_code = p_state_code)
    )
    SELECT
        SUM(
            CASE
                WHEN total_funding_available > 0 THEN total_funding_available
                WHEN maximum_award > 0 THEN maximum_award * 10
                WHEN minimum_award > 0 THEN minimum_award * 10
                ELSE 0
            END
        )
    INTO
        total
    FROM
        filtered_opportunities;

    RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;
