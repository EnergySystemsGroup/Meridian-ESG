-- Migration: Remove pipeline_performance_baselines table
-- Task: 38.6 - Database Migration Phase 3: Remove Baseline Comparison Table
-- 
-- This table was designed for V1 vs V2 comparison tracking but serves no purpose
-- in the new absolute performance tracking approach. The table is currently empty,
-- so no data archival is required.

-- Safely drop the table if it exists (including any dependent objects)
DROP TABLE IF EXISTS pipeline_performance_baselines CASCADE;

-- Remove any related indexes that might still exist
-- (CASCADE should handle this, but being explicit for documentation)

-- Migration complete
-- The pipeline_performance_baselines table and all its dependencies have been removed.
-- This completes the transition to absolute performance metrics tracking.