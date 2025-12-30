-- Migration: Deprecate agency_name column
-- Date: 2025-12-15
-- Purpose: Add deprecation notice to agency_name column in funding_opportunities
--
-- The agency_name field is redundant now that we properly link opportunities
-- to funding_sources via funding_source_id. The authoritative source name
-- should come from the funding_sources table.

COMMENT ON COLUMN funding_opportunities.agency_name IS
'DEPRECATED: Use funding_sources.name via funding_source_id JOIN instead.
This field is kept for backward compatibility but should not be relied upon for new code.
The authoritative source name comes from the funding_sources table.';
