-- Force update of the get_funding_by_category function to include count

-- Drop the old function signature first
DROP FUNCTION IF EXISTS get_funding_by_category(TEXT);

-- Create the new function with the updated return type
CREATE FUNCTION get_funding_by_category(p_status TEXT DEFAULT 'Open')
RETURNS TABLE (category TEXT, total_funding NUMERIC, opportunity_count BIGINT)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
      unnested_category::TEXT AS category,
      SUM(COALESCE(fo.maximum_award, 0)) AS total_funding,
      COUNT(*) AS opportunity_count -- Count opportunities in each group
  FROM
      funding_opportunities_with_geography fo,
      UNNEST(fo.categories) AS unnested_category
  WHERE
      lower(fo.status) = lower(p_status)
      AND fo.categories IS NOT NULL 
      AND array_length(fo.categories, 1) > 0
  GROUP BY
      unnested_category
  ORDER BY
      total_funding DESC;
END;
$$; 