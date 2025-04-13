-- Create a dedicated function to calculate funding by category

CREATE OR REPLACE FUNCTION get_funding_by_category(p_status TEXT DEFAULT 'Open')
RETURNS TABLE (category TEXT, total_funding NUMERIC, opportunity_count BIGINT)
LANGUAGE plpgsql
-- SECURITY INVOKER is generally safer unless the function needs elevated privileges
-- If the view funding_opportunities_with_geography is accessible by the calling role, INVOKER is fine.
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
      unnested_category::TEXT AS category, -- Explicit cast for clarity
      SUM(COALESCE(fo.maximum_award, 0)) AS total_funding,
      COUNT(*) AS opportunity_count -- Count opportunities in each group
  FROM
      -- Use the view which already handles dynamic status calculation
      funding_opportunities_with_geography fo, 
      -- Expand the categories array into individual rows
      UNNEST(fo.categories) AS unnested_category 
  WHERE
      -- Filter by the calculated status from the view (case-insensitive compare just in case)
      lower(fo.status) = lower(p_status)
      -- Ensure the categories array is not null and not empty before unnesting
      AND fo.categories IS NOT NULL 
      AND array_length(fo.categories, 1) > 0
  GROUP BY
      unnested_category
  ORDER BY
      total_funding DESC;
END;
$$; 