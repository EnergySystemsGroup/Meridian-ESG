-- Migration to update the status update function to consistently use lowercase values
-- This ensures the status values in the database match the required schema convention

-- Update the existing function to use lowercase status values
CREATE OR REPLACE FUNCTION update_opportunity_statuses()
RETURNS void AS $$
BEGIN
  RAISE NOTICE 'Updating statuses: Checking for upcoming -> open...';

  -- Update 'upcoming' to 'open' (lowercase)
  -- Where status is 'upcoming' (case-insensitive) AND open_date is today or in the past
  UPDATE funding_opportunities
  SET status = 'open'
  WHERE
    lower(status) = 'upcoming' AND
    open_date IS NOT NULL AND
    open_date <= CURRENT_DATE;

  RAISE NOTICE 'Updating statuses: Checking for open -> closed...';

  -- Update 'open' to 'closed' (lowercase)
  -- Where status is 'open' (case-insensitive) AND close_date is in the past
  UPDATE funding_opportunities
  SET status = 'closed'
  WHERE
    lower(status) = 'open' AND
    close_date IS NOT NULL AND
    close_date < CURRENT_DATE;

  RAISE NOTICE 'Status update complete.';
END;
$$ LANGUAGE plpgsql;

-- Also update any existing capitalized status values in the database to be lowercase
UPDATE funding_opportunities
SET status = lower(status)
WHERE status != lower(status); 