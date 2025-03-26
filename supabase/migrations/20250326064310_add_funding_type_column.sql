-- Add funding_type column to funding_opportunities table
ALTER TABLE public.funding_opportunities ADD COLUMN IF NOT EXISTS funding_type TEXT;
