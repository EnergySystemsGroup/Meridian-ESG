-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: funding_opportunities
CREATE TABLE IF NOT EXISTS funding_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Information
  title TEXT NOT NULL,
  opportunity_number TEXT,
  source_name TEXT NOT NULL,
  source_type TEXT,
  
  -- Funding Details
  min_amount NUMERIC,
  max_amount NUMERIC,
  cost_share_required BOOLEAN DEFAULT FALSE,
  cost_share_percentage NUMERIC,
  
  -- Dates
  posted_date TIMESTAMP WITH TIME ZONE,
  open_date TIMESTAMP WITH TIME ZONE,
  close_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Description and Details
  description TEXT,
  objectives TEXT,
  eligibility TEXT,
  
  -- Additional Metadata
  status TEXT,
  tags TEXT[],
  url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: funding_sources
CREATE TABLE IF NOT EXISTS funding_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  website TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: funding_applications
CREATE TABLE IF NOT EXISTS funding_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id),
  client_id UUID NOT NULL,
  status TEXT NOT NULL,
  next_deadline TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: funding_contacts
CREATE TABLE IF NOT EXISTS funding_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id),
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: funding_eligibility_criteria
CREATE TABLE IF NOT EXISTS funding_eligibility_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES funding_opportunities(id),
  entity_type TEXT NOT NULL,
  geographic_restriction TEXT,
  other_requirements TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_close_date ON funding_opportunities(close_date);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_status ON funding_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_funding_opportunities_source_type ON funding_opportunities(source_type);
CREATE INDEX IF NOT EXISTS idx_funding_applications_client_id ON funding_applications(client_id);
CREATE INDEX IF NOT EXISTS idx_funding_applications_opportunity_id ON funding_applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_funding_contacts_opportunity_id ON funding_contacts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_funding_eligibility_criteria_opportunity_id ON funding_eligibility_criteria(opportunity_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update the updated_at column
CREATE TRIGGER update_funding_opportunities_updated_at
BEFORE UPDATE ON funding_opportunities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funding_sources_updated_at
BEFORE UPDATE ON funding_sources
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funding_applications_updated_at
BEFORE UPDATE ON funding_applications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funding_contacts_updated_at
BEFORE UPDATE ON funding_contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funding_eligibility_criteria_updated_at
BEFORE UPDATE ON funding_eligibility_criteria
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 