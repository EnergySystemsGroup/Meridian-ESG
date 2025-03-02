-- Seed data for the your_table_name table
-- This will only work after you've created a user and the trigger has created a profile

-- Insert sample data (these will only be accessible to the specified user)
-- Commented out until you have a real user ID to use
/*
INSERT INTO public.your_table_name (user_id, title, description, is_completed)
VALUES 
  -- Replace with an actual user ID after you've created a user
  ('00000000-0000-0000-0000-000000000000', 'Complete Supabase setup', 'Finish setting up Supabase connection and authentication', true),
  ('00000000-0000-0000-0000-000000000000', 'Create database schema', 'Design and implement the database schema for the application', false),
  ('00000000-0000-0000-0000-000000000000', 'Implement authentication', 'Set up authentication with Supabase Auth', false),
  ('00000000-0000-0000-0000-000000000000', 'Add Row Level Security', 'Implement RLS policies to secure data', false),
  ('00000000-0000-0000-0000-000000000000', 'Test the application', 'Perform comprehensive testing of the application', false);
*/

-- Note: You'll need to replace '00000000-0000-0000-0000-000000000000' with an actual user ID
-- You can get this ID after signing up a user and querying the auth.users table 