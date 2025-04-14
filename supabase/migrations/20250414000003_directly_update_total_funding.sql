-- Directly update total_funding_available values for existing opportunities
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