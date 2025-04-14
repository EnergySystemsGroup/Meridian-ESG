-- Enable realtime for api_source_runs table to support real-time updates

-- Create a function to enable realtime for runs
CREATE OR REPLACE FUNCTION enable_realtime_for_runs()
RETURNS void AS $$
BEGIN
    -- Add api_source_runs to the realtime publication
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE api_source_runs;';
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT enable_realtime_for_runs();

-- Add process_runs to the realtime publication too
CREATE OR REPLACE FUNCTION enable_realtime_for_process_runs()
RETURNS void AS $$
BEGIN
    -- Add process_runs to the realtime publication
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE process_runs;';
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT enable_realtime_for_process_runs(); 