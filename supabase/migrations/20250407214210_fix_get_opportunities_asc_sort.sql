-- V5: Final tiered sorting for amount ASC
CREATE OR REPLACE FUNCTION get_funding_opportunities_dynamic_sort(
    p_status TEXT DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_states TEXT[] DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'relevance',
    p_sort_direction TEXT DEFAULT 'desc',
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 9
)
RETURNS SETOF funding_opportunities_with_geography AS $$
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
    ELSE -- Default case (relevance desc)
        final_query := base_query || format(' ORDER BY relevance_score DESC NULLS LAST LIMIT %L OFFSET %L', p_page_size, (p_page - 1) * p_page_size);
    END IF;

    RAISE NOTICE 'Executing query (V5): %', final_query;
    RETURN QUERY EXECUTE final_query; 

END;
$$ LANGUAGE plpgsql STABLE;
