-- Core Data Models for Policy & Funding Intelligence System
-- Migration file created on 2024-06-01

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create ENUM types
CREATE TYPE agency_type AS ENUM ('Federal', 'State', 'Utility', 'Foundation', 'Other');
CREATE TYPE opportunity_status AS ENUM ('Anticipated', 'Open', 'Closed', 'Awarded');
CREATE TYPE legislation_source AS ENUM ('Federal', 'State', 'Local');
CREATE TYPE legislation_stage AS ENUM ('Introduced', 'Committee', 'Passed', 'Enacted', 'Failed', 'Withdrawn');
CREATE TYPE organization_type AS ENUM ('K12', 'Higher Ed', 'Municipal', 'County', 'State', 'Federal', 'Nonprofit', 'For-profit', 'Other');
CREATE TYPE action_status AS ENUM ('New', 'Reviewing', 'Pursuing', 'Submitted', 'Awarded', 'Rejected', 'Abandoned');
CREATE TYPE tag_category AS ENUM ('Service Area', 'Client Type', 'Geography', 'Timeline', 'Custom');
CREATE TYPE task_status AS ENUM ('Not Started', 'In Progress', 'Completed');
CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE source_type AS ENUM ('API', 'Website', 'Document', 'Email');
CREATE TYPE scrape_status AS ENUM ('Success', 'Partial', 'Failed');
CREATE TYPE project_type AS ENUM ('Energy_Efficiency', 'Renewable_Energy', 'HVAC', 'Lighting', 'Water_Conservation', 'Waste_Reduction', 'Transportation', 'Infrastructure', 'Planning', 'Other');
CREATE TYPE applicant_type AS ENUM ('K12', 'Municipal', 'County', 'State', 'Higher_Ed', 'Nonprofit', 'For-profit', 'Tribal', 'Other');
CREATE TYPE tagging_source AS ENUM ('Automatic', 'Manual');

-- 1. Funding Sources
CREATE TABLE funding_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    agency_type agency_type NOT NULL,
    parent_organization UUID REFERENCES funding_sources(id),
    jurisdiction TEXT,
    website TEXT,
    contact_info JSONB,
    description TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Funding Programs
CREATE TABLE funding_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES funding_sources(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    typical_funding_amount JSONB,
    recurrence_pattern TEXT,
    typical_open_month INTEGER,
    typical_close_month INTEGER,
    eligibility_criteria JSONB,
    matching_requirements TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Funding Opportunities
CREATE TABLE funding_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID REFERENCES funding_programs(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    fiscal_year TEXT,
    status opportunity_status NOT NULL DEFAULT 'Anticipated',
    open_date TIMESTAMP WITH TIME ZONE,
    close_date TIMESTAMP WITH TIME ZONE,
    amount_available NUMERIC,
    minimum_award NUMERIC,
    maximum_award NUMERIC,
    cost_share_required BOOLEAN DEFAULT FALSE,
    cost_share_percentage NUMERIC,
    application_url TEXT,
    guidelines_url TEXT,
    relevance_score NUMERIC CHECK (relevance_score >= 0 AND relevance_score <= 100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Legislation
CREATE TABLE legislation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    summary TEXT,
    full_text TEXT,
    source legislation_source NOT NULL,
    jurisdiction TEXT,
    bill_number TEXT,
    introduction_date TIMESTAMP WITH TIME ZONE,
    last_action_date TIMESTAMP WITH TIME ZONE,
    current_stage legislation_stage,
    probability_score NUMERIC CHECK (probability_score >= 0 AND probability_score <= 100),
    sponsors JSONB,
    committees JSONB,
    funding_implications JSONB,
    implementation_timeline JSONB,
    relevance_score NUMERIC CHECK (relevance_score >= 0 AND relevance_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Legislation History
CREATE TABLE legislation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legislation_id UUID REFERENCES legislation(id) ON DELETE CASCADE NOT NULL,
    version_date TIMESTAMP WITH TIME ZONE NOT NULL,
    changes JSONB,
    version_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Clients
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_name TEXT NOT NULL,
    organization_type organization_type NOT NULL,
    locations JSONB,
    contacts JSONB,
    service_interests TEXT[],
    facility_data JSONB,
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. Opportunity Matches
CREATE TABLE opportunity_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE NOT NULL,
    match_score NUMERIC CHECK (match_score >= 0 AND match_score <= 100),
    potential_project_value NUMERIC,
    qualification_notes TEXT,
    action_status action_status DEFAULT 'New',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 8. Tags
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category tag_category NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(category, value)
);

-- 9. Tagged Items
CREATE TABLE tagged_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
    item_type TEXT NOT NULL,
    item_id UUID NOT NULL,
    confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 100),
    source tagging_source DEFAULT 'Manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 10. Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status task_status DEFAULT 'Not Started',
    priority task_priority DEFAULT 'Medium',
    related_item_type TEXT,
    related_item_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 11. Eligible Project Types
CREATE TABLE eligible_project_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE NOT NULL,
    project_type project_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(opportunity_id, project_type)
);

-- 12. Eligible Applicants
CREATE TABLE eligible_applicants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE NOT NULL,
    applicant_type applicant_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(opportunity_id, applicant_type)
);

-- 13. Data Sources
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    url TEXT,
    source_type source_type NOT NULL,
    authentication_required BOOLEAN DEFAULT FALSE,
    authentication_details JSONB,
    last_checked TIMESTAMP WITH TIME ZONE,
    check_frequency TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 14. Scrape Logs
CREATE TABLE scrape_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status scrape_status NOT NULL,
    items_found INTEGER DEFAULT 0,
    items_added INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Junction table for many-to-many relationship between Legislation and Funding Opportunities
CREATE TABLE legislation_funding_opportunities (
    legislation_id UUID REFERENCES legislation(id) ON DELETE CASCADE NOT NULL,
    opportunity_id UUID REFERENCES funding_opportunities(id) ON DELETE CASCADE NOT NULL,
    relationship_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (legislation_id, opportunity_id)
);

-- Create indexes for performance
CREATE INDEX idx_funding_programs_source_id ON funding_programs(source_id);
CREATE INDEX idx_funding_opportunities_program_id ON funding_opportunities(program_id);
CREATE INDEX idx_funding_opportunities_status ON funding_opportunities(status);
CREATE INDEX idx_legislation_bill_number ON legislation(bill_number);
CREATE INDEX idx_legislation_current_stage ON legislation(current_stage);
CREATE INDEX idx_legislation_history_legislation_id ON legislation_history(legislation_id);
CREATE INDEX idx_opportunity_matches_client_id ON opportunity_matches(client_id);
CREATE INDEX idx_opportunity_matches_opportunity_id ON opportunity_matches(opportunity_id);
CREATE INDEX idx_tagged_items_tag_id ON tagged_items(tag_id);
CREATE INDEX idx_tagged_items_item_type_item_id ON tagged_items(item_type, item_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_eligible_project_types_opportunity_id ON eligible_project_types(opportunity_id);
CREATE INDEX idx_eligible_applicants_opportunity_id ON eligible_applicants(opportunity_id);
CREATE INDEX idx_scrape_logs_source_id ON scrape_logs(source_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all tables with updated_at column
CREATE TRIGGER update_funding_sources_modtime
BEFORE UPDATE ON funding_sources
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_funding_programs_modtime
BEFORE UPDATE ON funding_programs
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_funding_opportunities_modtime
BEFORE UPDATE ON funding_opportunities
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_legislation_modtime
BEFORE UPDATE ON legislation
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_clients_modtime
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_opportunity_matches_modtime
BEFORE UPDATE ON opportunity_matches
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_tasks_modtime
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_data_sources_modtime
BEFORE UPDATE ON data_sources
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE funding_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislation ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tagged_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligible_project_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligible_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE legislation_funding_opportunities ENABLE ROW LEVEL SECURITY;

-- Create default policies (authenticated users can read all data)
-- You'll want to customize these policies based on your specific requirements
CREATE POLICY "Allow authenticated read access" ON funding_sources FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON funding_programs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON funding_opportunities FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON legislation FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON legislation_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON opportunity_matches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON tags FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON tagged_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON eligible_project_types FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON eligible_applicants FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON data_sources FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON scrape_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON legislation_funding_opportunities FOR SELECT USING (auth.role() = 'authenticated');

-- Tasks are only visible to the assigned user or admin
CREATE POLICY "Users can view their assigned tasks" ON tasks
FOR SELECT USING (
  auth.uid() = assigned_to OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Create policies for insert, update, delete (only admins can modify data)
-- You'll want to customize these policies based on your specific requirements
CREATE POLICY "Allow admin insert access" ON funding_sources FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Allow admin update access" ON funding_sources FOR UPDATE USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Allow admin delete access" ON funding_sources FOR DELETE USING (auth.jwt() ->> 'role' = 'admin');

-- Repeat for other tables as needed
-- For brevity, not all policies are shown here

-- Create a view for active funding opportunities
CREATE VIEW active_funding_opportunities AS
SELECT 
    fo.*,
    fp.name AS program_name,
    fs.name AS source_name,
    fs.agency_type
FROM 
    funding_opportunities fo
JOIN 
    funding_programs fp ON fo.program_id = fp.id
JOIN 
    funding_sources fs ON fp.source_id = fs.id
WHERE 
    fo.status = 'Open'
ORDER BY 
    fo.close_date ASC;

-- Create a function to match clients with opportunities
CREATE OR REPLACE FUNCTION match_clients_with_opportunities()
RETURNS VOID AS $$
DECLARE
    client_record RECORD;
    opportunity_record RECORD;
    match_score NUMERIC;
BEGIN
    -- For each client
    FOR client_record IN SELECT * FROM clients LOOP
        -- For each open opportunity
        FOR opportunity_record IN SELECT * FROM funding_opportunities WHERE status = 'Open' LOOP
            -- Calculate a match score (this is a placeholder - implement your matching algorithm)
            match_score := 50; -- Default score
            
            -- Check if a match already exists
            IF NOT EXISTS (
                SELECT 1 FROM opportunity_matches 
                WHERE client_id = client_record.id AND opportunity_id = opportunity_record.id
            ) THEN
                -- Insert a new match
                INSERT INTO opportunity_matches (
                    client_id, 
                    opportunity_id, 
                    match_score,
                    action_status
                ) VALUES (
                    client_record.id,
                    opportunity_record.id,
                    match_score,
                    'New'
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql; 