-- Create a function to update total_funding_available values
CREATE OR REPLACE FUNCTION update_total_funding_available()
RETURNS void AS $$
BEGIN
    -- Update total_funding_available based on maximum_award where it's not set
    UPDATE funding_opportunities
    SET total_funding_available = 
        CASE 
            -- National opportunities typically have larger total funding pools
            WHEN is_national = true THEN maximum_award * 20
            -- State-specific opportunities have smaller pools but still larger than individual awards
            ELSE maximum_award * 10
        END
    WHERE maximum_award IS NOT NULL
    AND (total_funding_available IS NULL OR total_funding_available <= maximum_award);
    
    RAISE NOTICE 'Updated total_funding_available values for funding opportunities';
END;
$$ LANGUAGE plpgsql; 