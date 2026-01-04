-- Fix the funding_opportunities_with_geography view
-- Issues fixed:
-- 1. Add source_display_name and source_type_display (use fs.type not fs.agency_type)
-- 2. Add coverage_area_names and coverage_area_types for location display
-- 3. Maintain backward compatibility with existing eligible_states

-- First drop the function that depends on the view
DROP FUNCTION IF EXISTS get_funding_opportunities_dynamic_sort(text, text[], text[], text, text, text, integer, integer, text[]);

-- Now drop the view
DROP VIEW IF EXISTS funding_opportunities_with_geography;

-- Recreate the view with new columns
CREATE VIEW funding_opportunities_with_geography AS
SELECT
    fo.id,
    fo.title,
    fo.minimum_award,
    fo.maximum_award,
    fo.total_funding_available,
    fo.cost_share_required,
    fo.cost_share_percentage,
    fo.posted_date,
    fo.open_date,
    fo.close_date,
    fo.description,
    fo.funding_source_id,
    fo.raw_response_id,
    fo.is_national,
    fo.agency_name,
    fo.funding_type,
    fo.actionable_summary,
    CASE
        WHEN (fo.close_date IS NOT NULL AND fo.close_date < CURRENT_DATE) THEN 'Closed'::text
        WHEN (fo.open_date IS NOT NULL AND fo.open_date > CURRENT_DATE) THEN 'Upcoming'::text
        ELSE 'Open'::text
    END AS status,
    fo.tags,
    fo.url,
    fo.eligible_applicants,
    fo.eligible_project_types,
    fo.eligible_locations,
    fo.categories,
    fo.created_at,
    fo.updated_at,
    fo.relevance_score,
    fo.relevance_reasoning,
    fo.notes,
    fo.disbursement_type,
    fo.award_process,
    fo.eligible_activities,
    fo.enhanced_description,
    fo.scoring,
    fo.api_updated_at,
    fo.api_opportunity_id,
    fo.api_source_id,
    fo.program_overview,
    fo.program_use_cases,
    fo.application_summary,
    fo.program_insights,

    -- Source display fields (FIX: use fs.type not fs.agency_type)
    COALESCE(fs.name, 'Unknown Source'::text) AS source_display_name,
    COALESCE(fs.type::text, 'Unknown'::text) AS source_type_display,

    -- Legacy state eligibility (keep for backward compatibility)
    COALESCE(array_agg(DISTINCT s.code) FILTER (WHERE s.code IS NOT NULL), ARRAY[]::text[]::bpchar[]) AS eligible_states,
    COALESCE(array_agg(DISTINCT cs.code) FILTER (WHERE cs.code IS NOT NULL), ARRAY[]::text[]::bpchar[]) AS eligible_counties_states,
    COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), ARRAY[]::text[]) AS eligible_counties,

    -- NEW: Coverage area fields for location display
    COALESCE(array_agg(DISTINCT ca.name) FILTER (WHERE ca.name IS NOT NULL), ARRAY[]::text[]) AS coverage_area_names,
    COALESCE(array_agg(DISTINCT ca.kind) FILTER (WHERE ca.kind IS NOT NULL), ARRAY[]::text[]) AS coverage_area_types

FROM funding_opportunities fo
LEFT JOIN funding_sources fs ON fo.funding_source_id = fs.id
LEFT JOIN opportunity_state_eligibility se ON fo.id = se.opportunity_id
LEFT JOIN states s ON se.state_id = s.id
LEFT JOIN opportunity_county_eligibility ce ON fo.id = ce.opportunity_id
LEFT JOIN counties c ON ce.county_id = c.id
LEFT JOIN states cs ON c.state_id = cs.id
LEFT JOIN opportunity_coverage_areas oca ON fo.id = oca.opportunity_id
LEFT JOIN coverage_areas ca ON oca.coverage_area_id = ca.id
GROUP BY fo.id, fs.name, fs.type;

COMMENT ON VIEW funding_opportunities_with_geography IS 'View with source display names, legacy state eligibility, and coverage area fields';

-- Recreate the function that depends on the view
CREATE OR REPLACE FUNCTION public.get_funding_opportunities_dynamic_sort(
    p_status text DEFAULT NULL::text,
    p_categories text[] DEFAULT NULL::text[],
    p_states text[] DEFAULT NULL::text[],
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
    final_query TEXT;
BEGIN
    base_query := 'SELECT * FROM funding_opportunities_with_geography';

    IF p_status IS NOT NULL AND p_status <> '' THEN
        where_clauses := array_append(where_clauses, format('lower(status) = lower(%L)', p_status));
    END IF;

    IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 0 THEN
        where_clauses := array_append(where_clauses, format('categories && %L::text[]', p_categories));
    END IF;

    IF p_states IS NOT NULL AND array_length(p_states, 1) > 0 THEN
        where_clauses := array_append(where_clauses, format('(is_national = true OR eligible_locations && %L::text[])', p_states));
    END IF;

    IF p_search IS NOT NULL AND p_search <> '' THEN
        where_clauses := array_append(where_clauses, format('(title ILIKE %L OR description ILIKE %L OR actionable_summary ILIKE %L)',
             '%' || p_search || '%', '%' || p_search || '%', '%' || p_search || '%'));
    END IF;

    -- FIXED: Handle tracked IDs filter properly with edge case handling
    IF p_tracked_ids IS NOT NULL THEN
        -- Check if array has valid elements (not just empty strings)
        IF array_length(p_tracked_ids, 1) > 0 AND
           EXISTS(SELECT 1 FROM unnest(p_tracked_ids) AS elem WHERE elem IS NOT NULL AND elem <> '') THEN
            -- Filter out empty strings and null values
            where_clauses := array_append(where_clauses,
                format('id::text = ANY(ARRAY[%s])',
                    (SELECT string_agg(format('%L', elem), ',')
                     FROM unnest(p_tracked_ids) AS elem
                     WHERE elem IS NOT NULL AND elem <> '')));
        ELSE
            -- Empty array or array with only empty strings means "no results"
            where_clauses := array_append(where_clauses, 'FALSE');
        END IF;
    END IF;

    IF array_length(where_clauses, 1) > 0 THEN
        base_query := base_query || ' WHERE ' || array_to_string(where_clauses, ' AND ');
    END IF;

    IF p_sort_by = 'amount' AND p_sort_direction = 'desc' THEN
        final_query := base_query || format(' ORDER BY maximum_award DESC NULLS LAST, minimum_award DESC NULLS LAST, total_funding_available DESC NULLS LAST, relevance_score DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'amount' AND p_sort_direction = 'asc' THEN
         -- Final explicit tiered sorting for ASC amount
         final_query := base_query || format(' ORDER BY
             CASE
                 WHEN maximum_award IS NULL AND minimum_award IS NULL AND total_funding_available IS NULL THEN 0
                 WHEN maximum_award IS NULL AND minimum_award IS NULL THEN 1
                 WHEN maximum_award IS NULL THEN 2
                 ELSE 3
             END ASC,
             CASE
                 WHEN maximum_award IS NULL AND minimum_award IS NULL AND total_funding_available IS NULL THEN relevance_score
                 WHEN maximum_award IS NULL AND minimum_award IS NULL THEN total_funding_available
                 WHEN maximum_award IS NULL THEN minimum_award
                 ELSE maximum_award
             END ASC NULLS LAST,
             relevance_score DESC NULLS LAST,
             id ASC
             LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'relevance' AND p_sort_direction = 'desc' THEN
        final_query := base_query || format(' ORDER BY relevance_score DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'relevance' AND p_sort_direction = 'asc' THEN
         final_query := base_query || format(' ORDER BY relevance_score ASC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'close_date' AND p_sort_direction = 'desc' THEN
         final_query := base_query || format(' ORDER BY close_date DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'close_date' AND p_sort_direction = 'asc' THEN
         final_query := base_query || format(' ORDER BY close_date ASC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'updated_at' AND p_sort_direction = 'desc' THEN
         final_query := base_query || format(' ORDER BY updated_at DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'updated_at' AND p_sort_direction = 'asc' THEN
         final_query := base_query || format(' ORDER BY updated_at ASC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    -- Add sorting by created_at
    ELSIF p_sort_by = 'created_at' AND p_sort_direction = 'desc' THEN
         final_query := base_query || format(' ORDER BY created_at DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSIF p_sort_by = 'created_at' AND p_sort_direction = 'asc' THEN
         final_query := base_query || format(' ORDER BY created_at ASC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    ELSE -- Default case (relevance desc)
        final_query := base_query || format(' ORDER BY relevance_score DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    END IF;

    RAISE NOTICE 'Executing query (V12 - with coverage areas): %', final_query;
    RETURN QUERY EXECUTE final_query;

END;
$function$;
