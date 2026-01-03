-- Migration: Document Active Tables
-- Purpose: Add clear documentation to all production tables
-- Created: 2026-01-02

-- ============================================================================
-- CORE DATA TABLES
-- ============================================================================

COMMENT ON TABLE funding_opportunities IS 'Primary table storing all funding opportunities from API and manual sources. Links to coverage areas for geographic filtering. V2 pipeline writes here via StorageAgent.';

COMMENT ON TABLE funding_sources IS 'Registry of funding agencies and organizations. Types: Federal, State, Utility, Foundation, Other. Referenced by funding_opportunities.funding_source_id.';

COMMENT ON TABLE coverage_areas IS 'Geographic coverage areas with PostGIS geometry. Supports national, state, county, city, utility, region, tribal types. Current geographic system per ADR-001.';

COMMENT ON TABLE opportunity_coverage_areas IS 'Junction table linking opportunities to geographic coverage areas (many-to-many). Used for geographic filtering in V2 pipeline.';

COMMENT ON TABLE states IS 'Reference table: US states and territories with 2-letter codes and regions. Pre-populated with all 50 states + DC.';

COMMENT ON TABLE counties IS 'Reference table: US counties with FIPS codes linked to states via state_id.';

-- ============================================================================
-- CLIENT TABLES
-- ============================================================================

COMMENT ON TABLE clients IS 'End-user client organizations seeking funding matches. Includes location data, project needs, and coverage area preferences.';

COMMENT ON TABLE hidden_matches IS 'Tracks opportunities hidden from specific clients by their choice. Allows users to dismiss irrelevant matches.';

-- ============================================================================
-- API & SOURCE CONFIGURATION TABLES
-- ============================================================================

COMMENT ON TABLE api_sources IS 'Configuration for external API data sources. Includes endpoints, authentication, update frequency, and handler types. Core to V2 pipeline orchestration.';

COMMENT ON TABLE api_source_configurations IS 'Flexible configuration storage for API sources. Stores query params, headers, and parser configurations as JSONB.';

COMMENT ON TABLE api_raw_responses IS 'Stores raw API responses for audit trail and re-processing capability. Links to funding_opportunities via raw_response_id. Includes content hash for deduplication.';

COMMENT ON TABLE api_activity_logs IS 'Activity logging for API operations. Used by processCoordinatorV2 for tracking API actions and their outcomes (success/failure/partial).';

-- ============================================================================
-- V2 PIPELINE TRACKING TABLES
-- ============================================================================

COMMENT ON TABLE pipeline_runs IS 'V2 pipeline execution tracking with comprehensive metrics. Tracks status, execution time, token usage, costs, and SLA compliance. Created by RunManagerV2.';

COMMENT ON TABLE pipeline_stages IS 'Individual stage execution within pipeline runs. Stages: source_orchestrator, api_fetch, data_extraction, early_duplicate_detector, analysis, filter, storage. Tracks per-stage metrics.';

COMMENT ON TABLE opportunity_processing_paths IS 'Tracks how each opportunity flows through the V2 pipeline. Records path_type (NEW/UPDATE/SKIP), stages_processed, and final_outcome. Used for flow analytics.';

COMMENT ON TABLE duplicate_detection_sessions IS 'Analytics on duplicate detection effectiveness. Tracks LLM bypass savings, match types (id/title), and validation metrics.';

COMMENT ON TABLE processing_jobs IS 'Job queue for batch processing with retry support. Used by jobQueueManager for chunked parallel processing.';

-- ============================================================================
-- MANUAL PIPELINE TABLE
-- ============================================================================

COMMENT ON TABLE manual_funding_opportunities_staging IS 'Staging table for manual discovery pipeline (utilities, grants without APIs). Three-phase workflow: extraction (fetch URL, parse content) → analysis (scoring, enhancement) → storage (upsert to funding_opportunities). Stores raw_content for re-extraction.';

-- ============================================================================
-- SYSTEM & LOGGING TABLES
-- ============================================================================

COMMENT ON TABLE agent_executions IS 'Log of AI agent executions for debugging and cost tracking. Records agent_type, input/output, execution_time, and token_usage.';

COMMENT ON TABLE system_config IS 'System configuration and runtime settings storage.';

COMMENT ON TABLE unmatched_locations IS 'QA utility: tracks location texts from opportunities that could not be matched to coverage areas. Used for manual review and coverage area gap identification.';
