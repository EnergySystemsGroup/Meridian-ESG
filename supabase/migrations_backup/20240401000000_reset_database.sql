-- Seed data for Policy & Funding Intelligence System
-- This file populates the database with sample data for testing

-- Sample Funding Sources
/*
INSERT INTO funding_sources (id, name, agency_type, jurisdiction, website, contact_info, description, tags)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Department of Energy', 'Federal', 'United States', 'https://energy.gov', 
   '{"email": "info@energy.gov", "phone": "202-555-1000"}', 
   'Federal department focused on energy policy and funding', 
   ARRAY['energy', 'federal', 'infrastructure']),
   
  ('22222222-2222-2222-2222-222222222222', 'Environmental Protection Agency', 'Federal', 'United States', 'https://epa.gov', 
   '{"email": "info@epa.gov", "phone": "202-555-2000"}', 
   'Federal agency focused on environmental protection', 
   ARRAY['environment', 'federal', 'sustainability']),
   
  ('33333333-3333-3333-3333-333333333333', 'California Energy Commission', 'State', 'California', 'https://energy.ca.gov', 
   '{"email": "info@energy.ca.gov", "phone": "916-555-3000"}', 
   'State agency focused on energy policy and funding in California', 
   ARRAY['energy', 'state', 'california']),
   
  ('44444444-4444-4444-4444-444444444444', 'XYZ Foundation', 'Foundation', 'National', 'https://xyzfoundation.org', 
   '{"email": "grants@xyzfoundation.org", "phone": "415-555-4000"}', 
   'Private foundation supporting sustainability initiatives', 
   ARRAY['foundation', 'sustainability', 'private']);

-- Sample Funding Programs
INSERT INTO funding_programs (id, source_id, name, description, typical_funding_amount, recurrence_pattern, typical_open_month, typical_close_month, eligibility_criteria, matching_requirements, notes)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Building Technologies Program', 
   'Supports research and development for energy-efficient building technologies', 
   '{"min": 500000, "max": 2000000}', 'Annual', 2, 4, 
   '{"eligible_entities": ["universities", "national labs", "private companies"], "requirements": ["cost share of 20%"]}',
   '20% cost share required', 'Priority given to projects with commercial application potential'),
   
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Solar Energy Technologies Program', 
   'Supports research, development, and deployment of solar energy technologies', 
   '{"min": 250000, "max": 1500000}', 'Annual', 5, 7, 
   '{"eligible_entities": ["universities", "national labs", "private companies"], "requirements": ["cost share of 20%"]}',
   '20% cost share required', 'Focus on innovative solar technologies'),
   
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Clean Air Act Grants', 
   'Supports projects that improve air quality and reduce emissions', 
   '{"min": 100000, "max": 500000}', 'Annual', 3, 5, 
   '{"eligible_entities": ["state agencies", "local governments", "nonprofits"], "requirements": ["emissions reduction metrics"]}',
   'No cost share required', 'Must demonstrate measurable emissions reduction'),
   
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', 'California Clean Energy Fund', 
   'Supports clean energy projects in California', 
   '{"min": 50000, "max": 250000}', 'Biennial', 9, 11, 
   '{"eligible_entities": ["california-based organizations", "local governments"], "requirements": ["located in California", "emissions reduction"]}',
   '10% cost share recommended', 'Must be located in California'),
   
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444', 'Sustainability Innovation Grants', 
   'Supports innovative approaches to sustainability challenges', 
   '{"min": 25000, "max": 100000}', 'Annual', 1, 3, 
   '{"eligible_entities": ["nonprofits", "community organizations"], "requirements": ["innovation", "sustainability impact"]}',
   'No cost share required', 'Focus on innovative and scalable solutions');

-- Sample Funding Opportunities
INSERT INTO funding_opportunities (
  id,
  program_id,
  title,
  fiscal_year,
  status,
  open_date,
  close_date,
  amount_available,
  minimum_award,
  maximum_award,
  cost_share_required,
  cost_share_percentage,
  application_url,
  guidelines_url,
  relevance_score,
  notes
) VALUES
(
  '12345678-1234-1234-1234-123456789012',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Building Energy Efficiency Grant',
  '2023',
  'Open',
  '2023-02-01T00:00:00Z',
  '2023-04-15T00:00:00Z',
  5000000,
  500000,
  2000000,
  TRUE,
  20,
  'https://www.energy.gov/grants/building-efficiency/apply',
  'https://www.energy.gov/grants/building-efficiency/guidelines',
  85,
  'Funding for commercial building energy efficiency improvements including HVAC upgrades, lighting retrofits, and building envelope enhancements.'
),
(
  '23456789-2345-2345-2345-234567890123',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Solar Energy Innovation Grant',
  '2023',
  'Open',
  '2023-03-01T00:00:00Z',
  '2023-05-15T00:00:00Z',
  3000000,
  250000,
  1000000,
  TRUE,
  15,
  'https://www.energy.gov/grants/solar-innovation/apply',
  'https://www.energy.gov/grants/solar-innovation/guidelines',
  90,
  'Funding for innovative solar energy projects that reduce costs and increase efficiency.'
),
(
  '34567890-3456-3456-3456-345678901234',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Clean Air Community Grant',
  '2023',
  'Open',
  '2023-03-15T00:00:00Z',
  '2023-05-30T00:00:00Z',
  2000000,
  100000,
  500000,
  FALSE,
  NULL,
  'https://www.epa.gov/grants/clean-air/apply',
  'https://www.epa.gov/grants/clean-air/guidelines',
  75,
  'Support for communities to improve air quality through local initiatives.'
),
(
  '45678901-4567-4567-4567-456789012345',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'California Energy Efficiency Program',
  '2023',
  'Anticipated',
  '2023-04-01T00:00:00Z',
  '2023-06-15T00:00:00Z',
  1000000,
  50000,
  250000,
  TRUE,
  10,
  'https://www.energy.ca.gov/funding/efficiency/apply',
  'https://www.energy.ca.gov/funding/efficiency/guidelines',
  80,
  'Funding for California-based energy efficiency projects.'
),
(
  '56789012-5678-5678-5678-567890123456',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'Sustainability Innovation Challenge',
  '2023',
  'Anticipated',
  '2023-05-01T00:00:00Z',
  '2023-07-01T00:00:00Z',
  500000,
  25000,
  100000,
  FALSE,
  NULL,
  'https://www.xyzfoundation.org/grants/sustainability/apply',
  'https://www.xyzfoundation.org/grants/sustainability/guidelines',
  70,
  'Funding for innovative approaches to sustainability challenges.'
);
*/

-- Add a view to join funding opportunities with their source information
CREATE OR REPLACE VIEW funding_opportunities_with_source AS
SELECT 
  fo.id,
  fo.title,
  fo.fiscal_year,
  fo.status,
  fo.open_date,
  fo.close_date,
  fo.amount_available,
  fo.minimum_award,
  fo.maximum_award,
  fo.cost_share_required,
  fo.cost_share_percentage,
  fo.application_url,
  fo.guidelines_url,
  fo.relevance_score,
  fo.notes,
  fp.name AS program_name,
  fp.description AS description,
  fs.name AS source_name,
  fs.agency_type AS source_type,
  fs.jurisdiction
FROM 
  funding_opportunities fo
JOIN 
  funding_programs fp ON fo.program_id = fp.id
JOIN 
  funding_sources fs ON fp.source_id = fs.id;

-- Sample Legislation
INSERT INTO legislation (
  id,
  title,
  summary,
  source,
  jurisdiction,
  bill_number,
  introduction_date,
  last_action_date,
  current_stage,
  probability_score,
  sponsors,
  relevance_score
) VALUES
(
  'abcdef12-abcd-abcd-abcd-abcdef123456',
  'Clean Energy Act of 2023',
  'Comprehensive legislation to promote clean energy development and reduce carbon emissions',
  'Federal',
  'United States',
  'H.R. 1234',
  '2023-01-15T00:00:00Z',
  '2023-02-20T00:00:00Z',
  'Committee',
  75,
  '[{"name": "Jane Smith", "party": "D", "state": "CA"}, {"name": "John Doe", "party": "R", "state": "OH"}]',
  85
),
(
  'bcdef123-bcde-bcde-bcde-bcdef1234567',
  'California Building Efficiency Standards',
  'Updates building energy efficiency standards for new construction in California',
  'State',
  'California',
  'SB 567',
  '2023-02-10T00:00:00Z',
  '2023-03-15T00:00:00Z',
  'Introduced',
  80,
  '[{"name": "Maria Rodriguez", "party": "D", "state": "CA"}]',
  90
);

-- Sample Legislation History
INSERT INTO legislation_history (
  legislation_id,
  version_date,
  changes,
  version_text
) VALUES
(
  'abcdef12-abcd-abcd-abcd-abcdef123456',
  '2023-02-20T00:00:00Z',
  '{"sections_modified": ["Section 3", "Section 5"], "summary": "Added provisions for solar tax credits"}',
  'Updated text with solar tax credit provisions'
);

-- Sample Eligible Project Types
INSERT INTO eligible_project_types (opportunity_id, project_type)
VALUES
  ('12345678-1234-1234-1234-123456789012', 'Energy_Efficiency'),
  ('12345678-1234-1234-1234-123456789012', 'HVAC'),
  ('12345678-1234-1234-1234-123456789012', 'Lighting'),
  ('23456789-2345-2345-2345-234567890123', 'Renewable_Energy'),
  ('34567890-3456-3456-3456-345678901234', 'Infrastructure'),
  ('45678901-4567-4567-4567-456789012345', 'Energy_Efficiency'),
  ('56789012-5678-5678-5678-567890123456', 'Other');

-- Sample Eligible Applicants
INSERT INTO eligible_applicants (opportunity_id, applicant_type)
VALUES
  ('12345678-1234-1234-1234-123456789012', 'Municipal'),
  ('12345678-1234-1234-1234-123456789012', 'For-profit'),
  ('23456789-2345-2345-2345-234567890123', 'For-profit'),
  ('23456789-2345-2345-2345-234567890123', 'Nonprofit'),
  ('34567890-3456-3456-3456-345678901234', 'Municipal'),
  ('34567890-3456-3456-3456-345678901234', 'County'),
  ('45678901-4567-4567-4567-456789012345', 'K12'),
  ('45678901-4567-4567-4567-456789012345', 'Municipal'),
  ('56789012-5678-5678-5678-567890123456', 'Nonprofit');

-- Sample Clients
INSERT INTO clients (
  id,
  organization_name,
  organization_type,
  locations,
  contacts,
  service_interests,
  facility_data,
  tags,
  notes
) VALUES
(
  'c1111111-1111-1111-1111-111111111111',
  'Cityville School District',
  'K12',
  '{"locations": [{"city": "Cityville", "state": "CA"}]}',
  '{"contacts": [{"name": "Jane Smith", "email": "jsmith@cityville.edu", "phone": "555-123-4567"}]}',
  ARRAY['Education', 'K-12'],
  '{"buildings": 15, "total_sqft": 1500000, "avg_age": 25}',
  ARRAY['California', 'School District', 'Public'],
  'Large school district with 15 schools and sustainability goals.'
),
(
  'c2222222-2222-2222-2222-222222222222',
  'City of Metropolis',
  'Municipal',
  '{"locations": [{"city": "Metropolis", "state": "NY"}]}',
  '{"contacts": [{"name": "John Doe", "email": "jdoe@metropolis.gov", "phone": "555-234-5678"}]}',
  ARRAY['Municipal Services', 'Public Works'],
  '{"buildings": 20, "total_sqft": 2000000, "avg_age": 35}',
  ARRAY['New York', 'City', 'Urban'],
  'Medium-sized city with climate action plan and energy reduction goals.'
),
(
  'c3333333-3333-3333-3333-333333333333',
  'GreenTech Solutions',
  'For-profit',
  '{"locations": [{"city": "San Francisco", "state": "CA"}]}',
  '{"contacts": [{"name": "Sarah Johnson", "email": "sjohnson@greentech.com", "phone": "555-345-6789"}]}',
  ARRAY['Energy', 'Technology'],
  '{"buildings": 2, "total_sqft": 50000, "avg_age": 5}',
  ARRAY['California', 'Startup', 'Clean Energy'],
  'Clean energy technology startup focused on building efficiency solutions.'
);

-- Sample Opportunity Matches
INSERT INTO opportunity_matches (
  client_id,
  opportunity_id,
  match_score,
  potential_project_value,
  qualification_notes,
  action_status
) VALUES
(
  'c1111111-1111-1111-1111-111111111111',
  '45678901-4567-4567-4567-456789012345',
  85,
  750000,
  'Strong match for school district energy efficiency needs.',
  'New'
),
(
  'c2222222-2222-2222-2222-222222222222',
  '12345678-1234-1234-1234-123456789012',
  90,
  1200000,
  'Excellent match for municipal building efficiency program.',
  'Reviewing'
),
(
  'c2222222-2222-2222-2222-222222222222',
  '34567890-3456-3456-3456-345678901234',
  75,
  400000,
  'Good match for city air quality initiatives.',
  'New'
),
(
  'c3333333-3333-3333-3333-333333333333',
  '23456789-2345-2345-2345-234567890123',
  95,
  800000,
  'Perfect match for company solar technology innovations.',
  'Pursuing'
);

-- Sample Tags
INSERT INTO tags (
  id,
  category,
  value,
  description
) VALUES
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Service Area',
  'Energy Efficiency',
  'Projects focused on reducing energy consumption'
),
(
  'b2c3d4e5-f6a1-7890-abcd-ef1234567891',
  'Service Area',
  'Renewable Energy',
  'Projects focused on renewable energy generation'
),
(
  'd4e5f6a1-b2c3-7890-abcd-ef1234567893',
  'Client Type',
  'K12',
  'K-12 educational institutions'
),
(
  'e5f6a1b2-c3d4-7890-abcd-ef1234567894',
  'Client Type',
  'Municipal',
  'City governments'
);

-- Sample Tagged Items
INSERT INTO tagged_items (
  tag_id,
  item_type,
  item_id,
  confidence_score,
  source
) VALUES
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'funding_opportunity',
  '12345678-1234-1234-1234-123456789012',
  100,
  'Manual'
),
(
  'b2c3d4e5-f6a1-7890-abcd-ef1234567891',
  'funding_opportunity',
  '23456789-2345-2345-2345-234567890123',
  100,
  'Manual'
),
(
  'd4e5f6a1-b2c3-7890-abcd-ef1234567893',
  'client',
  'c1111111-1111-1111-1111-111111111111',
  100,
  'Manual'
),
(
  'e5f6a1b2-c3d4-7890-abcd-ef1234567894',
  'client',
  'c2222222-2222-2222-2222-222222222222',
  100,
  'Manual'
);

-- Sample Tasks
INSERT INTO tasks (
  title,
  description,
  due_date,
  status,
  priority,
  related_item_type,
  related_item_id
) VALUES
(
  'Review Building Energy Efficiency Grant',
  'Review requirements and prepare summary for client meeting',
  NOW() + INTERVAL '7 days',
  'Not Started',
  'High',
  'opportunity',
  '12345678-1234-1234-1234-123456789012'
),
(
  'Contact Solar Energy Program Officer',
  'Schedule call to discuss project eligibility',
  NOW() + INTERVAL '3 days',
  'Not Started',
  'Medium',
  'opportunity',
  '23456789-2345-2345-2345-234567890123'
),
(
  'Prepare California Energy Efficiency Application',
  'Draft application for school district energy upgrades',
  NOW() + INTERVAL '14 days',
  'Not Started',
  'High',
  'opportunity',
  '45678901-4567-4567-4567-456789012345'
);

-- Sample Legislation-Funding Opportunity Relationships
INSERT INTO legislation_funding_opportunities (
  legislation_id,
  opportunity_id,
  relationship_notes
) VALUES
(
  'abcdef12-abcd-abcd-abcd-abcdef123456',
  '12345678-1234-1234-1234-123456789012',
  'This legislation authorizes funding for this opportunity'
),
(
  'abcdef12-abcd-abcd-abcd-abcdef123456',
  '23456789-2345-2345-2345-234567890123',
  'This legislation impacts eligibility criteria'
),
(
  'bcdef123-bcde-bcde-bcde-bcdef1234567',
  '45678901-4567-4567-4567-456789012345',
  'This legislation sets standards relevant to this opportunity'
);

-- Sample Data Sources
INSERT INTO data_sources (
  name,
  url,
  source_type,
  authentication_required,
  authentication_details,
  last_checked,
  check_frequency
) VALUES
(
  'Grants.gov',
  'https://www.grants.gov',
  'API',
  TRUE,
  '{"api_key": "sample_key_123"}',
  NOW() - INTERVAL '1 day',
  'Daily'
),
(
  'California Energy Commission',
  'https://www.energy.ca.gov/funding-opportunities',
  'Website',
  FALSE,
  NULL,
  NOW() - INTERVAL '5 days',
  'Weekly'
),
(
  'EPA Grants',
  'https://www.epa.gov/grants',
  'API',
  TRUE,
  '{"api_key": "sample_key_456"}',
  NOW() - INTERVAL '3 days',
  'Weekly'
);

-- Sample Scrape Logs
INSERT INTO scrape_logs (
  source_id,
  start_time,
  end_time,
  status,
  items_found,
  items_added,
  items_updated,
  error_message
) VALUES
(
  (SELECT id FROM data_sources WHERE name = 'Grants.gov'),
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day' + INTERVAL '10 minutes',
  'Success',
  25,
  3,
  2,
  NULL
),
(
  (SELECT id FROM data_sources WHERE name = 'California Energy Commission'),
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days' + INTERVAL '15 minutes',
  'Success',
  12,
  1,
  0,
  NULL
),
(
  (SELECT id FROM data_sources WHERE name = 'EPA Grants'),
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days' + INTERVAL '5 minutes',
  'Partial',
  18,
  0,
  2,
  'Timeout when accessing page 3 of results'
); 