-- Migration to complete the transition away from funding_programs
-- This removes the program_id column from funding_opportunities

-- First, check if there are any views or functions that reference program_id
DO $$
DECLARE
    view_name text;
    function_name text;
BEGIN
    -- Check for views that reference program_id
    FOR view_name IN 
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND view_definition LIKE '%program_id%'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || view_name || ' CASCADE';
        RAISE NOTICE 'Dropped view: %', view_name;
    END LOOP;
    
    -- Check for functions that reference program_id
    FOR function_name IN 
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
        AND routine_definition LIKE '%program_id%'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || function_name || ' CASCADE';
        RAISE NOTICE 'Dropped function: %', function_name;
    END LOOP;
END $$;

-- Drop the program_id column from funding_opportunities
ALTER TABLE funding_opportunities 
DROP COLUMN program_id;

-- Add a comment to the table explaining the change
COMMENT ON TABLE funding_opportunities IS 
'Funding opportunities from various sources. Each opportunity is directly linked to a funding source via source_id.'; 