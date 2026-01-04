-- Make update_opportunity_statuses bidirectional
-- Previously only handled: Upcoming→Open and Open→Closed
-- Now also handles: Closed→Open (for bad data that came in marked closed with future dates)

CREATE OR REPLACE FUNCTION update_opportunity_statuses()
RETURNS void AS $$
BEGIN
  RAISE NOTICE 'Updating statuses: Checking for Upcoming -> Open...';

  -- Update 'Upcoming' to 'Open'
  -- Where status is 'Upcoming' AND open_date is today or in the past
  UPDATE funding_opportunities
  SET status = 'Open'
  WHERE
    lower(status) = 'upcoming' AND
    open_date IS NOT NULL AND
    open_date <= CURRENT_DATE;

  RAISE NOTICE 'Updating statuses: Checking for Open -> Closed...';

  -- Update 'Open' to 'Closed'
  -- Where status is 'Open' AND close_date is in the past
  UPDATE funding_opportunities
  SET status = 'Closed'
  WHERE
    lower(status) = 'open' AND
    close_date IS NOT NULL AND
    close_date < CURRENT_DATE;

  RAISE NOTICE 'Updating statuses: Checking for Closed -> Open (fixing bad data)...';

  -- NEW: Fix incorrectly closed opportunities
  -- Where status is 'Closed' but close_date is in future (or null) and open_date has passed
  UPDATE funding_opportunities
  SET status = 'Open'
  WHERE
    lower(status) = 'closed' AND
    (close_date IS NULL OR close_date >= CURRENT_DATE) AND
    (open_date IS NULL OR open_date <= CURRENT_DATE);

  RAISE NOTICE 'Status update complete.';
END;
$$ LANGUAGE plpgsql;
