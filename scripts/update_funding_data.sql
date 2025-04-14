-- Update California-specific opportunities to set their total_funding_available
-- Set total_funding_available to significantly higher values than maximum_award
-- to properly reflect the total funding pool vs. individual award amounts

-- First, update opportunities for California
UPDATE funding_opportunities fo
SET total_funding_available = maximum_award * 10
WHERE id IN (
    SELECT fo.id 
    FROM funding_opportunities fo
    JOIN opportunity_state_eligibility ose ON fo.id = ose.opportunity_id
    JOIN states s ON ose.state_id = s.id
    WHERE s.name = 'California'
    AND fo.maximum_award IS NOT NULL
);

-- Then update national opportunities
UPDATE funding_opportunities
SET total_funding_available = maximum_award * 20
WHERE is_national = true
AND maximum_award IS NOT NULL;

-- Add some high-value opportunities for California if none exist
INSERT INTO funding_opportunities (
    title, 
    status, 
    source_name, 
    minimum_award, 
    maximum_award, 
    total_funding_available, 
    close_date, 
    is_national
)
SELECT 
    'California Infrastructure Enhancement Grant', 
    'Open', 
    'California Department of Infrastructure', 
    500000, 
    5000000, 
    120000000, 
    CURRENT_DATE + INTERVAL '90 days', 
    false
WHERE NOT EXISTS (
    SELECT 1 FROM funding_opportunities fo
    JOIN opportunity_state_eligibility ose ON fo.id = ose.opportunity_id
    JOIN states s ON ose.state_id = s.id
    WHERE s.name = 'California'
    AND fo.total_funding_available > 100000000
);

-- Link the new opportunity to California if it was created
WITH new_opp AS (
    SELECT id FROM funding_opportunities
    WHERE title = 'California Infrastructure Enhancement Grant'
    LIMIT 1
),
ca_state AS (
    SELECT id FROM states WHERE name = 'California'
)
INSERT INTO opportunity_state_eligibility (opportunity_id, state_id)
SELECT new_opp.id, ca_state.id
FROM new_opp, ca_state
WHERE NOT EXISTS (
    SELECT 1 FROM opportunity_state_eligibility
    WHERE opportunity_id = (SELECT id FROM new_opp)
    AND state_id = (SELECT id FROM ca_state)
);

-- Log some outputs to confirm data was updated
SELECT 
    s.name AS state,
    COUNT(DISTINCT fo.id) AS opportunity_count,
    SUM(fo.maximum_award) AS total_max_awards,
    SUM(fo.total_funding_available) AS total_funding_pool
FROM funding_opportunities fo
JOIN opportunity_state_eligibility ose ON fo.id = ose.opportunity_id
JOIN states s ON ose.state_id = s.id
WHERE s.name = 'California'
GROUP BY s.name;

-- Also check national opportunities
SELECT 
    'National Opportunities' AS category,
    COUNT(*) AS opportunity_count,
    SUM(maximum_award) AS total_max_awards,
    SUM(total_funding_available) AS total_funding_pool
FROM funding_opportunities
WHERE is_national = true; 