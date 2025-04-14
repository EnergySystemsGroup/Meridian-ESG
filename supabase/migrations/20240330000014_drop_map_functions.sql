-- Migration to drop map functions that were dependent on program_id
-- This file was recreated to maintain migration sequence integrity

-- Drop functions if they exist 
DO $$
BEGIN
  -- Drop functions with any signature
  BEGIN 
    DROP FUNCTION IF EXISTS get_opportunities_by_state(TEXT);
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS get_funding_by_state(TEXT, TEXT, NUMERIC, NUMERIC);
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP FUNCTION IF EXISTS get_funding_by_county(TEXT, TEXT, TEXT, NUMERIC, NUMERIC);
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- Drop view
  BEGIN
    DROP VIEW IF EXISTS funding_opportunities_with_geography;
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
END
$$; 