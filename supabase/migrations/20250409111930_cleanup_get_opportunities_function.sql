-- Drop the function without the tracked_ids parameter to clean up the duplicates
DROP FUNCTION IF EXISTS get_funding_opportunities_dynamic_sort(TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, INT);

-- Keep only the function with p_tracked_ids parameter
-- No need to recreate the function as it already exists in the database
COMMENT ON FUNCTION get_funding_opportunities_dynamic_sort(TEXT, TEXT[], TEXT[], TEXT, TEXT, TEXT, INT, INT, TEXT[]) IS 'Get funding opportunities with dynamic sorting and filtering, including tracked IDs support'; 