-- ============================================================================
-- MIGRATION: Cap Per-Applicant Funding at $30M for Map Display
-- ============================================================================
--
-- CONTEXT (December 2025):
-- The map view was showing California with $83.23B in funding, which was
-- misleading. Investigation revealed that bond/loan financing programs
-- (CHFFA, CEFA) have maximum_award values of $5B each - representing total
-- program bond capacity, not realistic per-applicant amounts.
--
-- THE PROBLEM:
-- 1. Bond programs present total capacity as "award amounts" (e.g., "$1 to $5B")
-- 2. Our extraction correctly captures this, but it's not meaningful for
--    "per applicant funding available" calculations
-- 3. Summing $5B bond programs alongside $100K grants produces inflated totals
--
-- EVIDENCE FROM INVESTIGATION:
-- | Program                  | maximum_award    | Issue                        |
-- |--------------------------|------------------|------------------------------|
-- | CHFFA Commercial Paper   | $5,000,000,000   | Bond capacity, not per-app   |
-- | CHFFA Bond Financing     | $5,000,000,000   | Bond capacity, not per-app   |
-- | CEFA Bond Financing      | $5,000,000,000   | Bond capacity, not per-app   |
-- | ERDC Broad Agency        | $999,999,999     | Program ceiling              |
--
-- THE SOLUTION:
-- Cap each opportunity's contribution to the map funding sum at $30M.
-- This threshold was chosen because:
-- - Realistic maximum any single entity receives from one program
-- - Preserves accuracy for 95%+ of opportunities
-- - Prevents bond/infrastructure financing from skewing totals
--
-- IMPORTANT:
-- - This cap applies ONLY to map display calculations
-- - Actual maximum_award values in funding_opportunities remain unchanged
-- - Individual opportunity detail pages show the real uncapped values
--
-- AFFECTED FUNCTIONS:
-- - get_funding_by_state_per_applicant (state_specific_data and national_data CTEs)
-- - get_funding_by_state_v3 (wrapper, no changes needed)
-- ============================================================================

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Applying $30M per-applicant cap to map funding calculations';
END $$;

CREATE OR REPLACE FUNCTION get_funding_by_state_per_applicant(
    p_status TEXT DEFAULT NULL,
    p_source_type TEXT DEFAULT NULL,
    p_min_amount NUMERIC DEFAULT NULL,
    p_max_amount NUMERIC DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    state TEXT,
    state_code TEXT,
    value NUMERIC,
    opportunities INTEGER
) AS $$
DECLARE
    -- Cap per-applicant contribution at $30M for display purposes
    -- See migration header for full context on why this exists
    -- To adjust: change this value and run migration
    per_applicant_cap CONSTANT NUMERIC := 30000000;
BEGIN
    RETURN QUERY
    WITH filtered_opportunities AS (
        -- Pre-filter opportunities based on all criteria including categories
        SELECT
            fo.id,
            fo.maximum_award,
            fo.minimum_award,
            fo.is_national
        FROM
            funding_opportunities fo
        LEFT JOIN
            funding_sources fs ON fo.funding_source_id = fs.id
        WHERE
            (p_status IS NULL OR fo.status = p_status) AND
            (p_source_type IS NULL OR fs.type::TEXT = p_source_type) AND
            (p_min_amount IS NULL OR
                COALESCE(fo.minimum_award, fo.maximum_award, 0) >= p_min_amount
            ) AND
            (p_max_amount IS NULL OR
                COALESCE(fo.maximum_award, fo.minimum_award, 0) <= p_max_amount
            ) AND
            -- Category filtering: Check for overlap if p_categories is provided and not empty
            (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR fo.categories && p_categories) AND
            -- Only include opportunities that have award amounts defined
            (fo.maximum_award IS NOT NULL OR fo.minimum_award IS NOT NULL)
    ),
    state_specific_data AS (
        -- Get state-specific opportunities
        SELECT
            s.name AS state_name,
            s.code::TEXT AS state_code,
            COUNT(DISTINCT fo.id) AS state_opp_count,
            -- CAP APPLIED HERE: Each opportunity contributes at most $30M to the sum
            -- This prevents bond financing programs ($5B+) from skewing state totals
            SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), per_applicant_cap)) AS state_funding
        FROM
            states s
        LEFT JOIN
            opportunity_state_eligibility ose ON s.id = ose.state_id
        JOIN
            filtered_opportunities fo ON ose.opportunity_id = fo.id -- Join with pre-filtered ops
        WHERE
            fo.is_national = false -- Only count non-national here
        GROUP BY
            s.name, s.code
    ),
    national_data AS (
        -- Get national opportunities that apply to all states
        SELECT
            COUNT(DISTINCT fo.id) AS national_opp_count,
            -- CAP APPLIED HERE: Each national opportunity also capped at $30M
            SUM(LEAST(COALESCE(fo.maximum_award, fo.minimum_award, 0), per_applicant_cap)) AS national_funding
        FROM
            filtered_opportunities fo -- Use pre-filtered ops
        WHERE
            fo.is_national = true
    ),
    all_states AS (
        -- Ensure all states are represented, even with zero funding/opps
        SELECT name, code::TEXT FROM states
    ),
    combined_data AS (
        -- Combine state-specific and national data
        SELECT
            als.name AS state_name,
            als.code AS state_code,
            COALESCE(ssd.state_funding, 0) + COALESCE((SELECT national_funding FROM national_data), 0) AS total_funding,
            COALESCE(ssd.state_opp_count, 0) + COALESCE((SELECT national_opp_count FROM national_data), 0) AS total_opp_count
        FROM
            all_states als
        LEFT JOIN
            state_specific_data ssd ON als.code = ssd.state_code
    )
    SELECT
        cd.state_name AS state,
        cd.state_code,
        cd.total_funding AS value,
        cd.total_opp_count::INTEGER AS opportunities
    FROM
        combined_data cd
    ORDER BY
        cd.state_name;
END;
$$ LANGUAGE plpgsql;

-- Note: get_funding_by_state_v3 is a wrapper that calls get_funding_by_state_per_applicant
-- No changes needed to it - it will automatically use the updated function above
