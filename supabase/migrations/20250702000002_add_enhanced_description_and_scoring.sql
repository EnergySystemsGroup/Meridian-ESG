-- Add enhanced_description and scoring fields to funding_opportunities table
-- Migration: 20250702000002_add_enhanced_description_and_scoring.sql

-- Add enhanced_description field for detailed strategic descriptions
ALTER TABLE funding_opportunities 
ADD COLUMN enhanced_description TEXT;

-- Add scoring field to store full scoring breakdown as JSONB
ALTER TABLE funding_opportunities 
ADD COLUMN scoring JSONB;

-- Add comments for documentation
COMMENT ON COLUMN funding_opportunities.enhanced_description IS 'Detailed, strategic description with narrative clarity and practical use case examples';
COMMENT ON COLUMN funding_opportunities.scoring IS 'Full scoring breakdown object with clientProjectRelevance, fundingAttractiveness, fundingType, and overallScore';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_enhanced_description ON funding_opportunities USING GIN(to_tsvector('english', enhanced_description));
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_scoring ON funding_opportunities USING GIN(scoring); 