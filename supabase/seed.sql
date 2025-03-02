-- Seed data for Policy & Funding Intelligence System
-- This file populates the database with sample data for testing

-- Sample Funding Sources
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
INSERT INTO funding_programs (id, source_id, name, description, typical_funding_amount, recurrence_pattern, typical_open_month, typical_close_month, eligibility_criteria)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Building Technologies Program', 
   'Supports research and development for energy-efficient building technologies', 
   '{"min": 500000, "max": 2000000}', 'Annual', 2, 4, 
   '{"eligible_entities": ["universities", "national labs", "private companies"], "requirements": ["cost share of 20%"]}'),
   
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Solar Energy Technologies Program', 
   'Supports research, development, and deployment of solar energy technologies', 
   '{"min": 250000, "max": 1500000}', 'Annual', 5, 7, 
   '{"eligible_entities": ["universities", "national labs", "private companies"], "requirements": ["cost share of 20%"]}'),
   
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Clean Air Act Grants', 
   'Supports projects that improve air quality and reduce emissions', 
   '{"min": 100000, "max": 500000}', 'Annual', 3, 5, 
   '{"eligible_entities": ["state agencies", "local governments", "nonprofits"], "requirements": ["emissions reduction metrics"]}'),
   
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', 'California Clean Energy Fund', 
   'Supports clean energy projects in California', 
   '{"min": 50000, "max": 250000}', 'Biennial', 9, 11, 
   '{"eligible_entities": ["california-based organizations", "local governments"], "requirements": ["located in California", "emissions reduction"]}'),
   
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444', 'Sustainability Innovation Grants', 
   'Supports innovative approaches to sustainability challenges', 
   '{"min": 25000, "max": 100000}', 'Annual', 1, 3, 
   '{"eligible_entities": ["nonprofits", "community organizations"], "requirements": ["innovation", "sustainability impact"]}');

-- Sample Funding Opportunities
INSERT INTO funding_opportunities (id, program_id, title, fiscal_year, status, open_date, close_date, amount_available, minimum_award, maximum_award, cost_share_required, cost_share_percentage, application_url, guidelines_url)
VALUES
  ('12345678-1234-1234-1234-123456789012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Commercial Building Energy Efficiency 2024', '2024', 'Open', 
   '2024-02-15', '2024-04-30', 10000000, 500000, 2000000, TRUE, 20, 
   'https://energy.gov/apply/commercial-building-2024', 'https://energy.gov/guidelines/commercial-building-2024'),
   
  ('23456789-2345-2345-2345-234567890123', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Solar Innovation Challenge 2024', '2024', 'Open', 
   '2024-05-01', '2024-07-15', 7500000, 250000, 1500000, TRUE, 20, 
   'https://energy.gov/apply/solar-innovation-2024', 'https://energy.gov/guidelines/solar-innovation-2024'),
   
  ('34567890-3456-3456-3456-345678901234', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Urban Air Quality Improvement 2024', '2024', 'Anticipated', 
   '2024-03-01', '2024-05-15', 3000000, 100000, 500000, FALSE, NULL, 
   'https://epa.gov/apply/air-quality-2024', 'https://epa.gov/guidelines/air-quality-2024'),
   
  ('45678901-4567-4567-4567-456789012345', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'California Renewable Energy Projects', '2024', 'Closed', 
   '2023-09-15', '2023-11-30', 2000000, 50000, 250000, TRUE, 10, 
   'https://energy.ca.gov/apply/renewable-2023', 'https://energy.ca.gov/guidelines/renewable-2023'),
   
  ('56789012-5678-5678-5678-567890123456', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Community Sustainability Challenge 2024', '2024', 'Open', 
   '2024-01-15', '2024-03-31', 500000, 25000, 100000, FALSE, NULL, 
   'https://xyzfoundation.org/apply/sustainability-2024', 'https://xyzfoundation.org/guidelines/sustainability-2024');

-- Sample Eligible Project Types
INSERT INTO eligible_project_types (opportunity_id, project_type)
VALUES
  ('12345678-1234-1234-1234-123456789012', 'Energy_Efficiency'),
  ('12345678-1234-1234-1234-123456789012', 'HVAC'),
  ('12345678-1234-1234-1234-123456789012', 'Lighting'),
  ('23456789-2345-2345-2345-234567890123', 'Renewable_Energy'),
  ('34567890-3456-3456-3456-345678901234', 'Infrastructure'),
  ('45678901-4567-4567-4567-456789012345', 'Renewable_Energy'),
  ('56789012-5678-5678-5678-567890123456', 'Water_Conservation'),
  ('56789012-5678-5678-5678-567890123456', 'Waste_Reduction');

-- Sample Eligible Applicants
INSERT INTO eligible_applicants (opportunity_id, applicant_type)
VALUES
  ('12345678-1234-1234-1234-123456789012', 'Municipal'),
  ('12345678-1234-1234-1234-123456789012', 'K12'),
  ('12345678-1234-1234-1234-123456789012', 'Higher_Ed'),
  ('23456789-2345-2345-2345-234567890123', 'Municipal'),
  ('23456789-2345-2345-2345-234567890123', 'For-profit'),
  ('34567890-3456-3456-3456-345678901234', 'Municipal'),
  ('34567890-3456-3456-3456-345678901234', 'County'),
  ('45678901-4567-4567-4567-456789012345', 'Municipal'),
  ('45678901-4567-4567-4567-456789012345', 'K12'),
  ('56789012-5678-5678-5678-567890123456', 'Nonprofit'),
  ('56789012-5678-5678-5678-567890123456', 'K12');

-- Sample Legislation
INSERT INTO legislation (id, title, summary, source, jurisdiction, bill_number, introduction_date, current_stage, probability_score, sponsors, relevance_score)
VALUES
  ('abcdef12-abcd-abcd-abcd-abcdef123456', 'Clean Energy Act of 2024', 
   'Comprehensive legislation to promote clean energy development and reduce carbon emissions', 
   'Federal', 'United States', 'H.R. 1234', '2024-01-10', 'Committee', 65, 
   '[{"name": "Jane Smith", "party": "D", "state": "CA"}, {"name": "John Doe", "party": "R", "state": "OH"}]', 85),
   
  ('bcdef123-bcde-bcde-bcde-bcdef1234567', 'State Energy Efficiency Standards', 
   'Updates building energy efficiency standards for new construction', 
   'State', 'California', 'SB 567', '2024-02-05', 'Introduced', 80, 
   '[{"name": "Maria Rodriguez", "party": "D", "state": "CA"}]', 90),
   
  ('cdef1234-cdef-cdef-cdef-cdef12345678', 'Municipal Climate Action Funding', 
   'Establishes a fund for municipal climate action projects', 
   'Local', 'San Francisco', 'Ordinance 789', '2024-03-01', 'Passed', 100, 
   '[{"name": "City Council", "vote": "8-2"}]', 75);

-- Sample Legislation-Funding Opportunity Relationships
INSERT INTO legislation_funding_opportunities (legislation_id, opportunity_id, relationship_notes)
VALUES
  ('abcdef12-abcd-abcd-abcd-abcdef123456', '12345678-1234-1234-1234-123456789012', 'This legislation authorizes funding for this opportunity'),
  ('abcdef12-abcd-abcd-abcd-abcdef123456', '23456789-2345-2345-2345-234567890123', 'This legislation impacts eligibility criteria'),
  ('bcdef123-bcde-bcde-bcde-bcdef1234567', '45678901-4567-4567-4567-456789012345', 'This legislation sets standards relevant to this opportunity');

-- Sample Clients
INSERT INTO clients (id, organization_name, organization_type, locations, contacts, service_interests, facility_data)
VALUES
  ('c0000001-0000-0000-0000-000000000001', 'Metropolis School District', 'K12', 
   '[{"city": "Metropolis", "state": "CA", "zip": "90001"}]', 
   '[{"name": "Sarah Johnson", "title": "Facilities Director", "email": "sjohnson@metropolissd.org", "phone": "555-123-4567"}]', 
   ARRAY['Energy Efficiency', 'HVAC Upgrades', 'Lighting'], 
   '{"buildings": 12, "total_sqft": 1200000, "avg_age": 35}'),
   
  ('c0000002-0000-0000-0000-000000000002', 'Riverdale City', 'Municipal', 
   '[{"city": "Riverdale", "state": "CA", "zip": "90002"}]', 
   '[{"name": "Michael Chen", "title": "Sustainability Manager", "email": "mchen@riverdale.gov", "phone": "555-234-5678"}]', 
   ARRAY['Renewable Energy', 'Water Conservation', 'Climate Action Planning'], 
   '{"buildings": 25, "total_sqft": 2500000, "avg_age": 40}'),
   
  ('c0000003-0000-0000-0000-000000000003', 'Greenville Community College', 'Higher Ed', 
   '[{"city": "Greenville", "state": "CA", "zip": "90003"}]', 
   '[{"name": "David Wilson", "title": "VP of Operations", "email": "dwilson@gcc.edu", "phone": "555-345-6789"}]', 
   ARRAY['Energy Efficiency', 'Renewable Energy', 'Sustainability Planning'], 
   '{"buildings": 18, "total_sqft": 1800000, "avg_age": 30}');

-- Sample Opportunity Matches
INSERT INTO opportunity_matches (client_id, opportunity_id, match_score, potential_project_value, qualification_notes, action_status)
VALUES
  ('c0000001-0000-0000-0000-000000000001', '12345678-1234-1234-1234-123456789012', 85, 750000, 
   'Strong match for HVAC and lighting upgrades across multiple schools', 'Reviewing'),
   
  ('c0000001-0000-0000-0000-000000000001', '56789012-5678-5678-5678-567890123456', 70, 75000, 
   'Good match for water conservation projects', 'New'),
   
  ('c0000002-0000-0000-0000-000000000002', '23456789-2345-2345-2345-234567890123', 90, 1200000, 
   'Excellent match for municipal solar project', 'Pursuing'),
   
  ('c0000002-0000-0000-0000-000000000002', '34567890-3456-3456-3456-345678901234', 80, 400000, 
   'Good match for air quality improvement projects', 'New'),
   
  ('c0000003-0000-0000-0000-000000000003', '12345678-1234-1234-1234-123456789012', 95, 1500000, 
   'Excellent match for campus-wide energy efficiency upgrades', 'Pursuing');

-- Sample Tags
INSERT INTO tags (id, category, value, description)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Service Area', 'Energy Efficiency', 'Projects focused on reducing energy consumption'),
  ('b2c3d4e5-f6a1-7890-abcd-ef1234567891', 'Service Area', 'Renewable Energy', 'Projects focused on renewable energy generation'),
  ('c3d4e5f6-a1b2-7890-abcd-ef1234567892', 'Service Area', 'Water Conservation', 'Projects focused on reducing water consumption'),
  ('d4e5f6a1-b2c3-7890-abcd-ef1234567893', 'Client Type', 'K12', 'K-12 educational institutions'),
  ('e5f6a1b2-c3d4-7890-abcd-ef1234567894', 'Client Type', 'Municipal', 'City governments'),
  ('f6a1b2c3-d4e5-7890-abcd-ef1234567895', 'Client Type', 'Higher Ed', 'Higher education institutions'),
  ('1a2b3c4d-5e6f-7890-abcd-ef1234567896', 'Geography', 'California', 'Located in California'),
  ('2b3c4d5e-6f1a-7890-abcd-ef1234567897', 'Timeline', 'Urgent', 'Requires immediate attention'),
  ('3c4d5e6f-1a2b-7890-abcd-ef1234567898', 'Timeline', 'Long-term', 'Long-term planning required');

-- Sample Tagged Items
INSERT INTO tagged_items (tag_id, item_type, item_id, confidence_score)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'funding_opportunity', '12345678-1234-1234-1234-123456789012', 100),
  ('b2c3d4e5-f6a1-7890-abcd-ef1234567891', 'funding_opportunity', '23456789-2345-2345-2345-234567890123', 100),
  ('c3d4e5f6-a1b2-7890-abcd-ef1234567892', 'funding_opportunity', '56789012-5678-5678-5678-567890123456', 100),
  ('d4e5f6a1-b2c3-7890-abcd-ef1234567893', 'client', 'c0000001-0000-0000-0000-000000000001', 100),
  ('e5f6a1b2-c3d4-7890-abcd-ef1234567894', 'client', 'c0000002-0000-0000-0000-000000000002', 100),
  ('f6a1b2c3-d4e5-7890-abcd-ef1234567895', 'client', 'c0000003-0000-0000-0000-000000000003', 100),
  ('1a2b3c4d-5e6f-7890-abcd-ef1234567896', 'funding_opportunity', '45678901-4567-4567-4567-456789012345', 100),
  ('2b3c4d5e-6f1a-7890-abcd-ef1234567897', 'opportunity_match', 'c0000002-0000-0000-0000-000000000002', 80);

-- Sample Data Sources
INSERT INTO data_sources (name, url, source_type, authentication_required, check_frequency)
VALUES
  ('DOE Funding Opportunity Announcements', 'https://eere-exchange.energy.gov/', 'Website', TRUE, 'daily'),
  ('EPA Grants Database', 'https://www.epa.gov/grants', 'Website', FALSE, 'weekly'),
  ('California Energy Commission Funding', 'https://www.energy.ca.gov/funding-opportunities', 'Website', FALSE, 'weekly'),
  ('Federal Register', 'https://www.federalregister.gov/api/', 'API', FALSE, 'daily'),
  ('Grants.gov', 'https://www.grants.gov/web/grants/search-grants.html', 'Website', FALSE, 'daily');

-- Sample Tasks
INSERT INTO tasks (title, description, due_date, status, priority, related_item_type, related_item_id)
VALUES
  ('Review Commercial Building Energy Efficiency opportunity', 'Analyze requirements and prepare summary for client', '2024-03-15', 'In Progress', 'High', 'funding_opportunity', '12345678-1234-1234-1234-123456789012'),
  ('Contact Metropolis School District', 'Discuss potential funding match and project scope', '2024-03-20', 'Not Started', 'Medium', 'client', 'c0000001-0000-0000-0000-000000000001'),
  ('Prepare Solar Innovation Challenge application', 'Draft application for Riverdale City', '2024-05-15', 'Not Started', 'Medium', 'opportunity_match', 'c0000002-0000-0000-0000-000000000002'),
  ('Monitor Clean Energy Act progress', 'Track legislation through committee process', '2024-04-01', 'Not Started', 'Low', 'legislation', 'abcdef12-abcd-abcd-abcd-abcdef123456'),
  ('Update funding database', 'Add new opportunities from weekly scan', '2024-03-10', 'Completed', 'Medium', NULL, NULL); 