-- Update funding_opportunities_with_geography view to always calculate status dynamically
CREATE OR REPLACE VIEW funding_opportunities_with_geography AS
SELECT
  fo.id,
  fo.title,
  fo.opportunity_number,
  fo.minimum_award,
  fo.maximum_award,
  fo.total_funding_available,
  fo.cost_share_required,
  fo.cost_share_percentage,
  fo.posted_date,
  fo.open_date,
  fo.close_date,
  fo.description,
  fo.source_id,
  fo.funding_source_id,
  fo.raw_response_id,
  fo.is_national,
  fo.agency_name,
  fo.funding_type,
  fo.actionable_summary,
  -- Always calculate status based on dates, ignoring fo.status from the base table
  CASE
    WHEN fo.close_date IS NOT NULL AND fo.close_date < CURRENT_DATE THEN 'Closed'::text
    WHEN fo.open_date IS NOT NULL AND fo.open_date > CURRENT_DATE THEN 'Upcoming'::text
    -- Assumes 'Open' if not Closed or Upcoming (including cases where open_date is today or in the past, and close_date is null, today, or in the future)
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
  COALESCE(fs.name, 'Unknown Source'::text) AS source_display_name,
  COALESCE(fs.agency_type::text, 'Unknown'::text) AS source_type_display,
  ARRAY(
    SELECT s.code
    FROM opportunity_state_eligibility ose
    JOIN states s ON ose.state_id = s.id
    WHERE ose.opportunity_id = fo.id
  ) AS eligible_states
FROM
  funding_opportunities fo
LEFT JOIN
  funding_sources fs ON fo.funding_source_id = fs.id;
