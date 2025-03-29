-- Migration to remove the funding_programs table
-- This makes program_id nullable and prepares for removing the table

-- Make program_id nullable in funding_opportunities
ALTER TABLE funding_opportunities 
ALTER COLUMN program_id DROP NOT NULL;

-- Drop the foreign key constraint from funding_opportunities to funding_programs
ALTER TABLE funding_opportunities
DROP CONSTRAINT IF EXISTS funding_opportunities_program_id_fkey;

-- Add a comment explaining that program_id is deprecated
COMMENT ON COLUMN funding_opportunities.program_id IS 
'DEPRECATED: This column is being phased out in favor of direct source_id references';

-- Check for dependent views
DO $$
DECLARE
    view_name text;
BEGIN
    FOR view_name IN 
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND view_definition LIKE '%funding_programs%'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || view_name || ' CASCADE';
        RAISE NOTICE 'Dropped view: %', view_name;
    END LOOP;
END $$;

-- Drop the funding_programs table with CASCADE to handle any remaining dependencies
DROP TABLE funding_programs CASCADE; 