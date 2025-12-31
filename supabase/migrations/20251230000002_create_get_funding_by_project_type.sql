-- Create get_funding_by_project_type RPC function
-- Returns per-applicant available funding grouped by project type
-- Uses $30M cap per opportunity (matching map and dashboard calculations)

CREATE OR REPLACE FUNCTION get_funding_by_project_type()
RETURNS TABLE (project_type TEXT, total_funding NUMERIC, opportunity_count BIGINT)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
      unnested_type::TEXT AS project_type,
      SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), 30000000)) AS total_funding,
      COUNT(*) AS opportunity_count
  FROM
      funding_opportunities_with_geography fo,
      UNNEST(fo.eligible_project_types) AS unnested_type
  WHERE
      fo.status IN ('Open', 'Upcoming')
      AND fo.eligible_project_types IS NOT NULL
      AND array_length(fo.eligible_project_types, 1) > 0
  GROUP BY
      unnested_type
  ORDER BY
      total_funding DESC;
  -- No LIMIT here; JS will limit after normalization
END;
$$;
