-- Fix RPC functions that reference fs.agency_type (column was renamed to fs.type)
-- The column was renamed in migration 20251125000001_cleanup_funding_sources_and_staging.sql
-- but these functions were not updated
-- Also fix status matching to handle comma-separated list like "Open,Upcoming"

-- Function to calculate total unique opportunities count
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
    status_array TEXT[];
BEGIN
    -- Convert comma-separated status to array
    IF p_status IS NOT NULL THEN
        status_array := string_to_array(p_status, ',');
    END IF;

    SELECT
        COUNT(DISTINCT fo.id)
    INTO
        opp_count
    FROM
        funding_opportunities fo
    LEFT JOIN
        funding_sources fs ON fo.funding_source_id = fs.id
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
        (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories);

    RETURN COALESCE(opp_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total funding available
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
    v_state_id INTEGER := NULL;
    status_array TEXT[];
BEGIN
    -- Convert comma-separated status to array
    IF p_status IS NOT NULL THEN
        status_array := string_to_array(p_status, ',');
    END IF;

    IF p_state_code IS NOT NULL THEN
        SELECT id INTO v_state_id FROM states WHERE code = p_state_code;
    END IF;

    WITH filtered_opportunities AS (
        SELECT
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
            opportunity_state_eligibility ose ON fo.id = ose.opportunity_id AND (v_state_id IS NULL OR ose.state_id = v_state_id)
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
            (v_state_id IS NULL OR fo.is_national OR ose.state_id = v_state_id)
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

-- Function to count states with funding
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

-- Fix get_state_scope_breakdown to use case-insensitive status matching
-- The base table has lowercase status values ('open', 'upcoming') but UI passes capitalized values
-- Also handle 'US' as nationwide - aggregate ALL scopes across all states
CREATE OR REPLACE FUNCTION public.get_state_scope_breakdown(
  p_state_code text,
  p_status text[] DEFAULT NULL::text[],
  p_project_types text[] DEFAULT NULL::text[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
  lower_status text[];
BEGIN
  -- Convert status array to lowercase for case-insensitive matching
  IF p_status IS NOT NULL THEN
    SELECT array_agg(LOWER(s)) INTO lower_status FROM unnest(p_status) AS s;
  END IF;

  -- Handle 'US' as nationwide - aggregate ALL scopes across all states
  IF p_state_code = 'US' THEN
    SELECT json_build_object(
      'national', (
        SELECT COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        WHERE fo.is_national = TRUE
          AND (p_status IS NULL OR LOWER(fo.status) = ANY(lower_status))
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
      ),
      'state_wide', (
        SELECT COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'state'
          AND fo.is_national = FALSE
          AND (p_status IS NULL OR LOWER(fo.status) = ANY(lower_status))
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
      ),
      'county', (
        SELECT COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'county'
          AND (p_status IS NULL OR LOWER(fo.status) = ANY(lower_status))
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
      ),
      'utility', (
        SELECT COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'utility'
          AND (p_status IS NULL OR LOWER(fo.status) = ANY(lower_status))
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
      ),
      'state_code', p_state_code
    )
    INTO result;
  ELSE
    -- For specific state codes, filter by state
    SELECT json_build_object(
      'national', (
        SELECT COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        WHERE fo.is_national = TRUE
          AND (p_status IS NULL OR LOWER(fo.status) = ANY(lower_status))
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
      ),
      'state_wide', (
        SELECT COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'state'
          AND ca.state_code = p_state_code
          AND fo.is_national = FALSE
          AND (p_status IS NULL OR LOWER(fo.status) = ANY(lower_status))
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
      ),
      'county', (
        SELECT COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'county'
          AND ca.state_code = p_state_code
          AND (p_status IS NULL OR LOWER(fo.status) = ANY(lower_status))
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
      ),
      'utility', (
        SELECT COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'utility'
          AND ca.state_code = p_state_code
          AND (p_status IS NULL OR LOWER(fo.status) = ANY(lower_status))
          AND (p_project_types IS NULL OR fo.eligible_project_types && p_project_types)
      ),
      'state_code', p_state_code
    )
    INTO result;
  END IF;

  RETURN result;
END;
$function$;

-- Fix get_funding_by_state_per_applicant to handle comma-separated status values
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
        LEFT JOIN
            opportunity_state_eligibility ose ON s.id = ose.state_id
        JOIN
            filtered_opportunities fo ON ose.opportunity_id = fo.id
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