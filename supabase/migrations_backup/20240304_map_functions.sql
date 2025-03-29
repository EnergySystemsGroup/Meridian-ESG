-- Map Functions for Funding Opportunities
-- Migration file created on 2024-03-04

-- Function to get aggregated funding data by state
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'funding_opportunities'
    ) THEN
        EXECUTE
        'CREATE OR REPLACE FUNCTION get_funding_by_state(
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
        ) AS $FUNC$
        BEGIN
            -- Simplified function that returns minimal data
            RETURN QUERY
            SELECT 
                s.name::TEXT AS state,
                s.code::TEXT AS state_code,
                0::NUMERIC AS value,
                0::INTEGER AS opportunities
            FROM states s
            ORDER BY s.name;
        END;
        $FUNC$ LANGUAGE plpgsql';
    END IF;
END
$$;

-- Function to get county-level funding data (stub for compatibility)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'funding_opportunities'
    ) THEN
        EXECUTE
        'CREATE OR REPLACE FUNCTION get_funding_by_county(
            input_state_code TEXT,
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
        ) AS $FUNC$
        BEGIN
            -- Simplified stub function that returns minimal data
            RETURN QUERY
            SELECT 
                c.name::TEXT AS county_name,
                s.code::TEXT AS state_code,
                0::NUMERIC AS value,
                0::INTEGER AS opportunities
            FROM counties c
            JOIN states s ON c.state_id = s.id
            WHERE s.code = input_state_code
            ORDER BY c.name;
        END;
        $FUNC$ LANGUAGE plpgsql';
    END IF;
END
$$;