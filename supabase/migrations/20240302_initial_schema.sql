-- Initial Schema for Meridian
-- This migration handles potential conflicts with other migrations

-- Check if tables already exist and drop them if needed
DO $$
BEGIN
    -- Drop tables if they exist (in reverse order of dependencies)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'funding_eligibility_criteria') THEN
        DROP TABLE public.funding_eligibility_criteria CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'funding_contacts') THEN
        DROP TABLE public.funding_contacts CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'funding_applications') THEN
        DROP TABLE public.funding_applications CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'funding_opportunities') THEN
        DROP TABLE public.funding_opportunities CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'funding_sources') THEN
        DROP TABLE public.funding_sources CASCADE;
    END IF;
    
    -- Drop types if they exist
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'agency_type') THEN
        DROP TYPE agency_type CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'opportunity_status') THEN
        DROP TYPE opportunity_status CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'legislation_source') THEN
        DROP TYPE legislation_source CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'legislation_stage') THEN
        DROP TYPE legislation_stage CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'organization_type') THEN
        DROP TYPE organization_type CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'action_status') THEN
        DROP TYPE action_status CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'tag_category') THEN
        DROP TYPE tag_category CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'task_status') THEN
        DROP TYPE task_status CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'task_priority') THEN
        DROP TYPE task_priority CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'source_type') THEN
        DROP TYPE source_type CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'scrape_status') THEN
        DROP TYPE scrape_status CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'project_type') THEN
        DROP TYPE project_type CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'applicant_type') THEN
        DROP TYPE applicant_type CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM pg_type WHERE typname = 'tagging_source') THEN
        DROP TYPE tagging_source CASCADE;
    END IF;
END $$;

-- Create a table for users (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create a table for example data
CREATE TABLE IF NOT EXISTS public.your_table_name (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.your_table_name ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Create policies for your_table_name
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

-- Create a function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the function when a user is created
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 