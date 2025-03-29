-- Fix Schema Issues Migration
-- Created on 2024-03-04

-- First, let's fix the source_type column in funding_opportunities
ALTER TABLE funding_opportunities 
ADD COLUMN IF NOT EXISTS source_type TEXT;

-- Add missing columns to funding_opportunities
ALTER TABLE funding_opportunities 
ADD COLUMN IF NOT EXISTS minimum_award NUMERIC,
ADD COLUMN IF NOT EXISTS maximum_award NUMERIC;

-- Create funding_programs table if it doesn't exist
CREATE TABLE IF NOT EXISTS funding_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    source_id UUID REFERENCES funding_sources(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add program_id to funding_opportunities
ALTER TABLE funding_opportunities 
ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES funding_programs(id);

-- Add agency_type to funding_sources
ALTER TABLE funding_sources 
ADD COLUMN IF NOT EXISTS agency_type TEXT;

-- Create or replace the update_updated_at_column function (safe to run again)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for funding_programs ONLY IF IT DOESN'T EXIST
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_funding_programs_updated_at' AND tgrelid = 'funding_programs'::regclass
    ) THEN
        CREATE TRIGGER update_funding_programs_updated_at
        BEFORE UPDATE ON funding_programs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_funding_programs_source_id ON funding_programs(source_id);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_program_id ON funding_opportunities(program_id);