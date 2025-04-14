-- Schedule the update_opportunity_statuses function to run daily at 5 minutes past midnight
SELECT cron.schedule(
    'daily-status-update', -- Name of the cron job (can be anything descriptive)
    '5 0 * * *',           -- Cron schedule: Run at 00:05 (5 minutes past midnight) every day
    $$ SELECT update_opportunity_statuses(); $$ -- SQL command to execute
);

-- Optional: Uncomment to run the update immediately after scheduling
-- SELECT update_opportunity_statuses();
