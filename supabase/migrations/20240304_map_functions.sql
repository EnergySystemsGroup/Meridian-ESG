-- Map Functions for Funding Opportunities
-- Migration file created on 2024-03-04

-- Function to get aggregated funding data by state
-- Only create this if the required tables exist
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'funding_opportunities'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'funding_programs'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'funding_sources'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'states'
    ) THEN
        EXECUTE '
        CREATE OR REPLACE FUNCTION get_funding_by_state(
            status TEXT DEFAULT NULL,
            source_type TEXT DEFAULT NULL,
            min_amount NUMERIC DEFAULT NULL,
            max_amount NUMERIC DEFAULT NULL
        )
        RETURNS TABLE (
            state TEXT,
            state_code TEXT,
            value NUMERIC,
            opportunities INTEGER
        ) AS $$
        BEGIN
            RETURN QUERY
            WITH eligible_opportunities AS (
                SELECT 
                    fo.id,
                    fo.minimum_award,
                    fo.maximum_award,
                    fo.is_national,
                    s.name AS state_name,
                    s.code AS state_code
                FROM 
                    funding_opportunities fo
                LEFT JOIN 
                    funding_programs fp ON fo.program_id = fp.id
                LEFT JOIN 
                    funding_sources fs ON fp.source_id = fs.id
                LEFT JOIN 
                    opportunity_state_eligibility ose ON fo.id = ose.opportunity_id
                LEFT JOIN 
                    states s ON ose.state_id = s.id
                WHERE 
                    (status IS NULL OR fo.status = status) AND
                    (source_type IS NULL OR fs.agency_type = source_type) AND
                    (min_amount IS NULL OR fo.minimum_award >= min_amount) AND
                    (max_amount IS NULL OR fo.maximum_award <= max_amount)
            ),
            national_opportunities AS (
                SELECT 
                    id,
                    minimum_award,
                    maximum_award
                FROM 
                    eligible_opportunities
                WHERE 
                    is_national = true
            ),
            state_counts AS (
                SELECT 
                    state_name AS state,
                    state_code,
                    COUNT(DISTINCT id) AS state_opportunities,
                    COALESCE(SUM(maximum_award), 0) AS state_value
                FROM 
                    eligible_opportunities
                WHERE 
                    state_name IS NOT NULL
                GROUP BY 
                    state_name, state_code
            ),
            national_counts AS (
                SELECT 
                    COUNT(DISTINCT id) AS national_count,
                    COALESCE(SUM(maximum_award), 0) AS national_value
                FROM 
                    national_opportunities
            ),
            all_states AS (
                SELECT 
                    name AS state,
                    code AS state_code
                FROM 
                    states
            )
            SELECT 
                a.state,
                a.state_code,
                COALESCE(s.state_value, 0) + (COALESCE(n.national_value, 0) / 51) AS value,
                COALESCE(s.state_opportunities, 0) + COALESCE(n.national_count, 0) AS opportunities
            FROM 
                all_states a
            LEFT JOIN 
                state_counts s ON a.state = s.state
            CROSS JOIN 
                national_counts n
            ORDER BY 
                a.state;
        END;
        $$ LANGUAGE plpgsql';
    END IF;
END
$$;

-- Function to get county-level funding data (for future use)
-- Only create this if the required tables exist
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'funding_opportunities'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'funding_programs'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'funding_sources'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'states'
    ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'counties'
    ) THEN
        EXECUTE '
        CREATE OR REPLACE FUNCTION get_funding_by_county(
            state_code TEXT,
            status TEXT DEFAULT NULL,
            source_type TEXT DEFAULT NULL,
            min_amount NUMERIC DEFAULT NULL,
            max_amount NUMERIC DEFAULT NULL
        )
        RETURNS TABLE (
            county_name TEXT,
            state_code TEXT,
            value NUMERIC,
            opportunities INTEGER
        ) AS $$
        BEGIN
            RETURN QUERY
            WITH eligible_opportunities AS (
                SELECT 
                    fo.id,
                    fo.minimum_award,
                    fo.maximum_award,
                    fo.is_national,
                    c.name AS county_name,
                    s.code AS state_code
                FROM 
                    funding_opportunities fo
                LEFT JOIN 
                    funding_programs fp ON fo.program_id = fp.id
                LEFT JOIN 
                    funding_sources fs ON fp.source_id = fs.id
                LEFT JOIN 
                    opportunity_county_eligibility oce ON fo.id = oce.opportunity_id
                LEFT JOIN 
                    counties c ON oce.county_id = c.id
                LEFT JOIN 
                    states s ON c.state_id = s.id
                WHERE 
                    s.code = state_code AND
                    (status IS NULL OR fo.status = status) AND
                    (source_type IS NULL OR fs.agency_type = source_type) AND
                    (min_amount IS NULL OR fo.minimum_award >= min_amount) AND
                    (max_amount IS NULL OR fo.maximum_award <= max_amount)
            ),
            state_opportunities AS (
                SELECT 
                    fo.id,
                    fo.minimum_award,
                    fo.maximum_award
                FROM 
                    funding_opportunities fo
                LEFT JOIN 
                    funding_programs fp ON fo.program_id = fp.id
                LEFT JOIN 
                    funding_sources fs ON fp.source_id = fs.id
                LEFT JOIN 
                    opportunity_state_eligibility ose ON fo.id = ose.opportunity_id
                LEFT JOIN 
                    states s ON ose.state_id = s.id
                WHERE 
                    s.code = state_code AND
                    (status IS NULL OR fo.status = status) AND
                    (source_type IS NULL OR fs.agency_type = source_type) AND
                    (min_amount IS NULL OR fo.minimum_award >= min_amount) AND
                    (max_amount IS NULL OR fo.maximum_award <= max_amount) AND
                    fo.id NOT IN (
                        SELECT id FROM eligible_opportunities WHERE county_name IS NOT NULL
                    )
            ),
            national_opportunities AS (
                SELECT 
                    id,
                    minimum_award,
                    maximum_award
                FROM 
                    funding_opportunities
                WHERE 
                    is_national = true AND
                    (status IS NULL OR status = status) AND
                    (min_amount IS NULL OR minimum_award >= min_amount) AND
                    (max_amount IS NULL OR maximum_award <= max_amount)
            ),
            county_counts AS (
                SELECT 
                    county_name,
                    state_code,
                    COUNT(DISTINCT id) AS county_opportunities,
                    COALESCE(SUM(maximum_award), 0) AS county_value
                FROM 
                    eligible_opportunities
                WHERE 
                    county_name IS NOT NULL
                GROUP BY 
                    county_name, state_code
            ),
            state_counts AS (
                SELECT 
                    COUNT(DISTINCT id) AS state_count,
                    COALESCE(SUM(maximum_award), 0) AS state_value
                FROM 
                    state_opportunities
            ),
            national_counts AS (
                SELECT 
                    COUNT(DISTINCT id) AS national_count,
                    COALESCE(SUM(maximum_award), 0) AS national_value
                FROM 
                    national_opportunities
            ),
            all_counties AS (
                SELECT 
                    c.name AS county_name,
                    s.code AS state_code
                FROM 
                    counties c
                JOIN 
                    states s ON c.state_id = s.id
                WHERE 
                    s.code = state_code
            )
            SELECT 
                a.county_name,
                a.state_code,
                COALESCE(c.county_value, 0) + 
                (COALESCE(s.state_value, 0) / (SELECT COUNT(*) FROM all_counties)) + 
                (COALESCE(n.national_value, 0) / (SELECT COUNT(*) FROM all_counties)) AS value,
                COALESCE(c.county_opportunities, 0) + 
                COALESCE(s.state_count, 0) + 
                COALESCE(n.national_count, 0) AS opportunities
            FROM 
                all_counties a
            LEFT JOIN 
                county_counts c ON a.county_name = c.county_name
            CROSS JOIN 
                state_counts s
            CROSS JOIN 
                national_counts n
            ORDER BY 
                a.county_name;
        END;
        $$ LANGUAGE plpgsql';
    END IF;
END
$$;