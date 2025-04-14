-- migrate:up
SET ROLE postgres;

DO $$ 
BEGIN
    -- Add new columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'eligible_applicants') THEN
        ALTER TABLE funding_opportunities ADD COLUMN eligible_applicants text[];
    ELSE
        -- Convert existing text column to array if it's not already
        ALTER TABLE funding_opportunities ALTER COLUMN eligible_applicants TYPE text[] USING 
            CASE 
                WHEN eligible_applicants IS NULL THEN NULL
                ELSE ARRAY[eligible_applicants]
            END;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'eligible_project_types') THEN
        ALTER TABLE funding_opportunities ADD COLUMN eligible_project_types text[];
    ELSE
        -- Convert existing text column to array if it's not already
        ALTER TABLE funding_opportunities ALTER COLUMN eligible_project_types TYPE text[] USING 
            CASE 
                WHEN eligible_project_types IS NULL THEN NULL
                ELSE ARRAY[eligible_project_types]
            END;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'eligible_locations') THEN
        ALTER TABLE funding_opportunities ADD COLUMN eligible_locations text[];
    ELSE
        -- Convert existing text column to array if it's not already
        ALTER TABLE funding_opportunities ALTER COLUMN eligible_locations TYPE text[] USING 
            CASE 
                WHEN eligible_locations IS NULL THEN NULL
                ELSE ARRAY[eligible_locations]
            END;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'categories') THEN
        ALTER TABLE funding_opportunities ADD COLUMN categories text[];
    END IF;

    -- Copy data from eligibility if the column exists and hasn't been copied yet
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'eligibility') THEN
        -- Only copy if eligible_applicants is null (hasn't been copied yet)
        UPDATE funding_opportunities 
        SET eligible_applicants = ARRAY[eligibility]
        WHERE eligible_applicants IS NULL AND eligibility IS NOT NULL;

        -- Drop the old eligibility column
        ALTER TABLE funding_opportunities DROP COLUMN eligibility;
    END IF;
END $$;

RESET ROLE;

-- migrate:down
SET ROLE postgres;

DO $$ 
BEGIN
    -- Add back the original eligibility column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'eligibility') THEN
        ALTER TABLE funding_opportunities ADD COLUMN eligibility text;
        
        -- Copy data back from eligible_applicants if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'eligible_applicants') THEN
            UPDATE funding_opportunities 
            SET eligibility = array_to_string(eligible_applicants, ', ');
        END IF;
    END IF;

    -- Drop the new columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'eligible_applicants') THEN
        ALTER TABLE funding_opportunities DROP COLUMN eligible_applicants;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'eligible_project_types') THEN
        ALTER TABLE funding_opportunities DROP COLUMN eligible_project_types;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'eligible_locations') THEN
        ALTER TABLE funding_opportunities DROP COLUMN eligible_locations;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'funding_opportunities' AND column_name = 'categories') THEN
        ALTER TABLE funding_opportunities DROP COLUMN categories;
    END IF;
END $$;

RESET ROLE; 