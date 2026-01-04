-- Create manual_funding_sources staging table for non-API funding opportunities
-- Migration: 20251124000001_create_manual_funding_sources.sql

CREATE TABLE manual_funding_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source Identification
  source_type TEXT NOT NULL,              -- 'utility', 'county', 'state', 'foundation', 'other'
  source_name TEXT NOT NULL,              -- 'Pacific Gas & Electric', 'Alameda County'
  source_id UUID REFERENCES funding_sources(id),

  -- Program Identification
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content_type TEXT,                      -- 'html', 'pdf', 'unknown'

  -- Discovery Metadata
  discovery_method TEXT NOT NULL,         -- 'cc_agent', 'manual_entry', 'web_scrape', 'import'
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  discovered_by TEXT,

  -- Raw Content
  raw_content TEXT,
  raw_content_fetched_at TIMESTAMPTZ,

  -- Stage 1: Extraction
  extraction_status TEXT DEFAULT 'pending',
  extraction_data JSONB,
  extraction_error TEXT,
  extracted_at TIMESTAMPTZ,
  extracted_by TEXT,

  -- Stage 2: Analysis
  analysis_status TEXT DEFAULT 'pending',
  analysis_data JSONB,
  analysis_error TEXT,
  analyzed_at TIMESTAMPTZ,
  analyzed_by TEXT,

  -- Stage 3: Storage
  storage_status TEXT DEFAULT 'pending',
  opportunity_id UUID REFERENCES funding_opportunities(id),
  storage_error TEXT,
  stored_at TIMESTAMPTZ,
  stored_by TEXT,

  -- Refresh Tracking
  last_verified_at TIMESTAMPTZ,
  refresh_interval_days INT DEFAULT 90,
  needs_refresh BOOLEAN DEFAULT FALSE,
  source_hash TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT mfs_unique_url UNIQUE(url),
  CONSTRAINT mfs_unique_source_title UNIQUE(source_name, title)
);

-- Partial indexes for efficient status-based queries
CREATE INDEX idx_mfs_extraction_pending ON manual_funding_sources(extraction_status)
  WHERE extraction_status = 'pending';
CREATE INDEX idx_mfs_analysis_pending ON manual_funding_sources(analysis_status)
  WHERE analysis_status = 'pending';
CREATE INDEX idx_mfs_storage_pending ON manual_funding_sources(storage_status)
  WHERE storage_status = 'pending';
CREATE INDEX idx_mfs_needs_refresh ON manual_funding_sources(needs_refresh)
  WHERE needs_refresh = TRUE;
CREATE INDEX idx_mfs_source_type ON manual_funding_sources(source_type);
CREATE INDEX idx_mfs_source_name ON manual_funding_sources(source_name);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mfs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mfs_updated_at
  BEFORE UPDATE ON manual_funding_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_mfs_updated_at();

-- Comments
COMMENT ON TABLE manual_funding_sources IS 'Staging table for non-API funding opportunities (utilities, counties, foundations)';
COMMENT ON COLUMN manual_funding_sources.extraction_status IS 'pending, processing, complete, error, skipped';
COMMENT ON COLUMN manual_funding_sources.analysis_status IS 'pending, processing, complete, error, skipped';
COMMENT ON COLUMN manual_funding_sources.storage_status IS 'pending, processing, complete, error, skipped';
