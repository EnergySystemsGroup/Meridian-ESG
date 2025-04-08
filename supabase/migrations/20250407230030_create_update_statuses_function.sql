-- Function to update opportunity statuses based on current date
CREATE OR REPLACE FUNCTION update_opportunity_statuses()
RETURNS void AS $$
BEGIN
  RAISE NOTICE 'Updating statuses: Checking for Upcoming -> Open...';

  -- Update 'Upcoming' to 'Open'
  -- Where status is 'Upcoming' (case-insensitive) AND open_date is today or in the past
  UPDATE funding_opportunities
  SET status = 'Open'
  WHERE
    lower(status) = 'upcoming' AND
    open_date IS NOT NULL AND
    open_date <= CURRENT_DATE;

  RAISE NOTICE 'Updating statuses: Checking for Open -> Closed...';

  -- Update 'Open' to 'Closed'
  -- Where status is 'Open' (case-insensitive) AND close_date is in the past
  UPDATE funding_opportunities
  SET status = 'Closed'
  WHERE
    lower(status) = 'open' AND
    close_date IS NOT NULL AND
    close_date < CURRENT_DATE;

  RAISE NOTICE 'Status update complete.';
END;
$$ LANGUAGE plpgsql;

-- Optional: Perform an initial run immediately after creation
-- SELECT update_opportunity_statuses();
