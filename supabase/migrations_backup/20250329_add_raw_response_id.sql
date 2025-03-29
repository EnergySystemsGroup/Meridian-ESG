-- Add raw_response_id column to funding_opportunities table
ALTER TABLE funding_opportunities ADD COLUMN raw_response_id UUID REFERENCES api_raw_responses(id) ON DELETE SET NULL;

-- Create an index for better query performance
CREATE INDEX idx_funding_opportunities_raw_response_id ON funding_opportunities(raw_response_id);

-- Update the view that might be using funding_opportunities
-- If you have views based on funding_opportunities, update them here
-- For example:
-- CREATE OR REPLACE VIEW public.funding_opportunities_view AS 
-- SELECT ..., raw_response_id FROM funding_opportunities; 