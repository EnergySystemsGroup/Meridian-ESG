-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.your_table_name (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.your_table_name ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own items" 
  ON public.your_table_name 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own items" 
  ON public.your_table_name 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items" 
  ON public.your_table_name 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items" 
  ON public.your_table_name 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Get the current user's ID (if you're logged in)
-- If not logged in, we'll use a placeholder UUID
DO $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Try to get the current user's ID
    SELECT id INTO current_user_id FROM auth.users LIMIT 1;
    
    -- If no user exists, create a test user
    IF current_user_id IS NULL THEN
        INSERT INTO auth.users (id, email)
        VALUES ('00000000-0000-0000-0000-000000000000', 'test@example.com')
        RETURNING id INTO current_user_id;
    END IF;
    
    -- Insert test data using the user ID
    INSERT INTO public.your_table_name (user_id, title, description, is_completed)
    VALUES 
      (current_user_id, 'Complete Supabase setup', 'Finish setting up Supabase connection and authentication', true),
      (current_user_id, 'Create database schema', 'Design and implement the database schema for the application', false),
      (current_user_id, 'Implement authentication', 'Set up authentication with Supabase Auth', false),
      (current_user_id, 'Add Row Level Security', 'Implement RLS policies to secure data', false),
      (current_user_id, 'Test the application', 'Perform comprehensive testing of the application', false);
END $$; 