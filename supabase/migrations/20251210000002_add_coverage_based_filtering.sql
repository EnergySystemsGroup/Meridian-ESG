-- Migration: Add coverage-based geographic filtering
-- This replaces the legacy eligible_locations text array filtering with proper coverage_areas joins

-- First, drop the existing function
DROP FUNCTION IF EXISTS get_funding_opportunities_dynamic_sort(text, text[], text[], text, text, text, integer, integer, text[]);

-- Create the new function with coverage-based filtering
CREATE OR REPLACE FUNCTION public.get_funding_opportunities_dynamic_sort(
    p_status text DEFAULT NULL::text,
    p_categories text[] DEFAULT NULL::text[],
    p_state_code text DEFAULT NULL::text,  -- Changed: single state code instead of array
    p_coverage_types text[] DEFAULT NULL::text[],  -- New: array of coverage types (national, state, local, unknown)
    p_search text DEFAULT NULL::text,
    p_sort_by text DEFAULT 'relevance'::text,
    p_sort_direction text DEFAULT 'desc'::text,
    p_page integer DEFAULT 1,
    p_page_size integer DEFAULT 9,
    p_tracked_ids text[] DEFAULT NULL::text[]
)
RETURNS SETOF funding_opportunities_with_geography
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    base_query TEXT;
    where_clauses TEXT[] := '{}';
    coverage_conditions TEXT[] := '{}';
    final_query TEXT;
    include_national BOOLEAN := FALSE;
    include_state BOOLEAN := FALSE;
    include_local BOOLEAN := FALSE;
    include_unknown BOOLEAN := FALSE;
BEGIN
    base_query := 'SELECT DISTINCT fwg.* FROM funding_opportunities_with_geography fwg
                   LEFT JOIN opportunity_coverage_areas oca ON fwg.id = oca.opportunity_id
                   LEFT JOIN coverage_areas ca ON oca.coverage_area_id = ca.id';

    -- Status filter
    IF p_status IS NOT NULL AND p_status <> '' THEN
        where_clauses := array_append(where_clauses, format('lower(fwg.status) = lower(%L)', p_status));
    END IF;

    -- Categories filter
    IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 0 THEN
        where_clauses := array_append(where_clauses, format('fwg.categories && %L::text[]', p_categories));
    END IF;

    -- Search filter
    IF p_search IS NOT NULL AND p_search <> '' THEN
        where_clauses := array_append(where_clauses, format('(fwg.title ILIKE %L OR fwg.description ILIKE %L OR fwg.actionable_summary ILIKE %L)',
             '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%'));
    END IF;

    -- Tracked IDs filter
    IF p_tracked_ids IS NOT NULL THEN
        IF array_length(p_tracked_ids, 1) > 0 AND
           EXISTS(SELECT 1 FROM unnest(p_tracked_ids) AS elem WHERE elem IS NOT NULL AND elem <> '') THEN
            where_clauses := array_append(where_clauses,
                format('fwg.id::text = ANY(ARRAY[%s])',
                    (SELECT string_agg(format('%L', elem), ',')
                     FROM unnest(p_tracked_ids) AS elem
                     WHERE elem IS NOT NULL AND elem <> '')));
        ELSE
            where_clauses := array_append(where_clauses, 'FALSE');
        END IF;
    END IF;

    -- Parse coverage types
    IF p_coverage_types IS NOT NULL AND array_length(p_coverage_types, 1) > 0 THEN
        include_national := 'national' = ANY(p_coverage_types);
        include_state := 'state' = ANY(p_coverage_types);
        include_local := 'local' = ANY(p_coverage_types);
        include_unknown := 'unknown' = ANY(p_coverage_types);
    ELSE
        -- Default: include all except unknown
        include_national := TRUE;
        include_state := TRUE;
        include_local := TRUE;
        include_unknown := FALSE;
    END IF;

    -- Build coverage type conditions
    -- When a state is selected, filter by that state's coverage areas
    IF p_state_code IS NOT NULL AND p_state_code <> '' THEN
        -- National coverage applies everywhere
        IF include_national THEN
            coverage_conditions := array_append(coverage_conditions, 'ca.kind = ''national''');
        END IF;

        -- State-level coverage for the selected state
        IF include_state THEN
            coverage_conditions := array_append(coverage_conditions,
                format('(ca.kind = ''state'' AND ca.state_code = %L)', p_state_code));
        END IF;

        -- Local coverage (utility, county, city) for the selected state
        IF include_local THEN
            coverage_conditions := array_append(coverage_conditions,
                format('(ca.kind IN (''utility'', ''county'', ''city'') AND ca.state_code = %L)', p_state_code));
        END IF;

        -- Unknown: opportunities with no coverage area links
        IF include_unknown THEN
            coverage_conditions := array_append(coverage_conditions, 'oca.id IS NULL');
        END IF;
    ELSE
        -- No state selected - show all based on coverage type checkboxes
        IF include_national THEN
            coverage_conditions := array_append(coverage_conditions, 'ca.kind = ''national''');
        END IF;

        IF include_state THEN
            coverage_conditions := array_append(coverage_conditions, 'ca.kind = ''state''');
        END IF;

        IF include_local THEN
            coverage_conditions := array_append(coverage_conditions, 'ca.kind IN (''utility'', ''county'', ''city'')');
        END IF;

        IF include_unknown THEN
            coverage_conditions := array_append(coverage_conditions, 'oca.id IS NULL');
        END IF;
    END IF;

    -- Add coverage conditions to where clauses
    IF array_length(coverage_conditions, 1) > 0 THEN
        where_clauses := array_append(where_clauses, '(' || array_to_string(coverage_conditions, ' OR ') || ')');
    END IF;

    -- Build final WHERE clause
    IF array_length(where_clauses, 1) > 0 THEN
        base_query := base_query || ' WHERE ' || array_to_string(where_clauses, ' AND ');
    END IF;

    -- Sorting logic
    IF p_sort_by = 'amount' AND p_sort_direction = 'desc' THEN
        final_query := base_query || format(' ORDER BY fwg.maximum_award DESC NULLS LAST, fwg.minimum_award DESC NULLS LAST, fwg.total_funding_available DESC NULLS LAST, fwg.relevance_score DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'amount' AND p_sort_direction = 'asc' THEN
         final_query := base_query || format(' ORDER BY
             CASE
                 WHEN fwg.maximum_award IS NULL AND fwg.minimum_award IS NULL AND fwg.total_funding_available IS NULL THEN 0
                 WHEN fwg.maximum_award IS NULL AND fwg.minimum_award IS NULL THEN 1
                 WHEN fwg.maximum_award IS NULL THEN 2
                 ELSE 3
             END ASC,
             CASE
                 WHEN fwg.maximum_award IS NULL AND fwg.minimum_award IS NULL AND fwg.total_funding_available IS NULL THEN fwg.relevance_score
                 WHEN fwg.maximum_award IS NULL AND fwg.minimum_award IS NULL THEN fwg.total_funding_available
                 WHEN fwg.maximum_award IS NULL THEN fwg.minimum_award
                 ELSE fwg.maximum_award
             END ASC NULLS LAST,
             fwg.relevance_score DESC NULLS LAST,
             fwg.id ASC
             LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'relevance' AND p_sort_direction = 'desc' THEN
        final_query := base_query || format(' ORDER BY fwg.relevance_score DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'relevance' AND p_sort_direction = 'asc' THEN
         final_query := base_query || format(' ORDER BY fwg.relevance_score ASC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'close_date' AND p_sort_direction = 'desc' THEN
         final_query := base_query || format(' ORDER BY fwg.close_date DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'close_date' AND p_sort_direction = 'asc' THEN
         final_query := base_query || format(' ORDER BY fwg.close_date ASC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'updated_at' AND p_sort_direction = 'desc' THEN
         final_query := base_query || format(' ORDER BY fwg.updated_at DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'updated_at' AND p_sort_direction = 'asc' THEN
         final_query := base_query || format(' ORDER BY fwg.updated_at ASC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'created_at' AND p_sort_direction = 'desc' THEN
         final_query := base_query || format(' ORDER BY fwg.created_at DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'created_at' AND p_sort_direction = 'asc' THEN
         final_query := base_query || format(' ORDER BY fwg.created_at ASC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSE
        final_query := base_query || format(' ORDER BY fwg.relevance_score DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    END IF;

    RAISE NOTICE 'Executing query (V13 - coverage-based filtering): %', final_query;
    RETURN QUERY EXECUTE final_query;

END;
$function$;

COMMENT ON FUNCTION get_funding_opportunities_dynamic_sort IS 'V13: Coverage-based geographic filtering with state dropdown and coverage type checkboxes';

-- Create a helper function to get coverage statistics for filter counts
CREATE OR REPLACE FUNCTION public.get_coverage_filter_counts(
    p_state_code text DEFAULT NULL::text
)
RETURNS TABLE(
    coverage_type text,
    opportunity_count bigint
)
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
    IF p_state_code IS NOT NULL AND p_state_code <> '' THEN
        -- Counts for a specific state
        RETURN QUERY
        SELECT 'national'::text, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'national'

        UNION ALL

        SELECT 'state'::text, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'state' AND ca.state_code = p_state_code

        UNION ALL

        SELECT 'local'::text, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind IN ('utility', 'county', 'city') AND ca.state_code = p_state_code

        UNION ALL

        SELECT 'unknown'::text, COUNT(*)
        FROM funding_opportunities fo
        WHERE NOT EXISTS (
            SELECT 1 FROM opportunity_coverage_areas oca WHERE oca.opportunity_id = fo.id
        );
    ELSE
        -- Global counts (no state filter)
        RETURN QUERY
        SELECT 'national'::text, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'national'

        UNION ALL

        SELECT 'state'::text, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind = 'state'

        UNION ALL

        SELECT 'local'::text, COUNT(DISTINCT fo.id)
        FROM funding_opportunities fo
        JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
        JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
        WHERE ca.kind IN ('utility', 'county', 'city')

        UNION ALL

        SELECT 'unknown'::text, COUNT(*)
        FROM funding_opportunities fo
        WHERE NOT EXISTS (
            SELECT 1 FROM opportunity_coverage_areas oca WHERE oca.opportunity_id = fo.id
        );
    END IF;
END;
$function$;

COMMENT ON FUNCTION get_coverage_filter_counts IS 'Returns opportunity counts by coverage type, optionally filtered by state';
