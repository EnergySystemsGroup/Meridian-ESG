-- IMPORTANT: All sample data has been commented out for staging environment.
-- This prevents test data from being loaded into the staging database.
-- If you need test data in staging, please create staging-specific data.

/*
-- Get a user ID from the profiles table
DO $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Try to get a user ID from the profiles table
    SELECT id INTO current_user_id FROM profiles LIMIT 1;
    
    -- If no user exists, create a test user in auth.users
    IF current_user_id IS NULL THEN
        -- We can't directly insert into auth.users from SQL
        -- So we'll use a placeholder UUID
        current_user_id := '00000000-0000-0000-0000-000000000000';
        
        -- Insert into profiles table instead
        INSERT INTO profiles (id, username, full_name)
        VALUES (current_user_id, 'testuser', 'Test User');
    END IF;
    
    -- Delete existing data to avoid duplicates
    DELETE FROM your_table_name WHERE user_id = current_user_id;
    
    -- Insert test data using the user ID
    INSERT INTO your_table_name (user_id, title, description, is_completed)
    VALUES 
      (current_user_id, 'Complete Supabase setup', 'Finish setting up Supabase connection and authentication', true),
      (current_user_id, 'Create database schema', 'Design and implement the database schema for the application', false),
      (current_user_id, 'Implement authentication', 'Set up authentication with Supabase Auth', false),
      (current_user_id, 'Add Row Level Security', 'Implement RLS policies to secure data', false),
      (current_user_id, 'Test the application', 'Perform comprehensive testing of the application', false);
END $$; 
*/

-- You can add staging-specific data here if needed 