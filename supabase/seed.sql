-- Seed data for Policy & Funding Intelligence System
-- This file populates the database with sample data for testing

-- Sample Funding Sources
INSERT INTO funding_sources (id, name, agency_type, description, website, contact_email, contact_phone)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Department of Energy', 'Federal', 
   'Federal department focused on energy policy and funding', 
   'https://energy.gov', 'info@energy.gov', '202-555-1000'),
   
  ('22222222-2222-2222-2222-222222222222', 'Environmental Protection Agency', 'Federal', 
   'Federal agency focused on environmental protection', 
   'https://epa.gov', 'info@epa.gov', '202-555-2000'),
   
  ('33333333-3333-3333-3333-333333333333', 'California Energy Commission', 'State', 
   'State agency focused on energy policy and funding in California', 
   'https://energy.ca.gov', 'info@energy.ca.gov', '916-555-3000'),
   
  ('44444444-4444-4444-4444-444444444444', 'XYZ Foundation', 'Foundation', 
   'Private foundation supporting sustainability initiatives', 
   'https://xyzfoundation.org', 'grants@xyzfoundation.org', '415-555-4000');

-- Sample API Sources
INSERT INTO api_sources (
  id, 
  name, 
  organization, 
  type, 
  url, 
  api_endpoint, 
  api_documentation_url, 
  auth_type, 
  auth_details, 
  update_frequency, 
  active, 
  priority, 
  notes, 
  handler_type
)
VALUES
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Grants.gov',
    'U.S. Government',
    'Federal',
    'https://www.grants.gov/',
    'https://www.grants.gov/grantsws/rest/opportunities/search/',
    'https://www.grants.gov/web/grants/developers/grantsws-specifications.html',
    'apikey',
    '{"api_key": "sample-api-key-placeholder"}',
    'daily',
    TRUE,
    1,
    'Official U.S. government grants API source - primary data provider',
    'standard'
  ),
  (
    'gggggggg-gggg-gggg-gggg-gggggggggggg',
    'Energy.gov Funding Opportunities',
    'Department of Energy',
    'Federal',
    'https://www.energy.gov/',
    'https://www.energy.gov/eere/funding/api/opportunities',
    'https://www.energy.gov/eere/funding/developer-resources',
    'none',
    '{}',
    'weekly',
    TRUE,
    2,
    'Energy department funding opportunities',
    'standard'
  );

-- API Source Configurations
INSERT INTO api_source_configurations (
  source_id,
  config_type,
  configuration
)
VALUES
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'query_params',
    '{
      "dateRange": "all",
      "oppStatuses": "forecasted,posted,closed",
      "sortBy": "openDate",
      "sortOrder": "desc"
    }'
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'headers',
    '{
      "Content-Type": "application/json",
      "Accept": "application/json"
    }'
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'parser_config',
    '{
      "opportunity_mapping": {
        "title": "title",
        "opportunity_number": "opportunityNumber",
        "agency_name": "agencyName",
        "posted_date": "postDate",
        "close_date": "closeDate",
        "status": "opportunityStatus",
        "description": "description",
        "url": "opportunityUrl"
      },
      "list_path": "opportunities",
      "detail_endpoint_template": "https://www.grants.gov/grantsws/rest/opportunity/details/{opportunityNumber}"
    }'
  ),
  (
    'gggggggg-gggg-gggg-gggg-gggggggggggg',
    'query_params',
    '{
      "status": "open",
      "limit": 50
    }'
  );

-- Sample Funding Programs
INSERT INTO funding_programs (id, source_id, name, description)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Building Technologies Program', 
   'Supports research and development for energy-efficient building technologies'),
   
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Solar Energy Technologies Program', 
   'Supports research, development, and deployment of solar energy technologies'),
   
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Clean Air Act Grants', 
   'Supports projects that improve air quality and reduce emissions'),
   
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', 'California Clean Energy Fund', 
   'Supports clean energy projects in California'),
   
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444', 'Sustainability Innovation Grants', 
   'Supports innovative approaches to sustainability challenges');

-- Sample Funding Opportunities
INSERT INTO funding_opportunities (
  id,
  program_id,
  funding_source_id,
  title,
  funding_type,
  status,
  open_date,
  close_date,
  minimum_award,
  maximum_award,
  total_funding_available,
  cost_share_required,
  cost_share_percentage,
  url,
  description,
  is_national
) VALUES
(
  '12345678-1234-1234-1234-123456789012',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Building Energy Efficiency Grant',
  'Federal',
  'Open',
  '2023-02-01T00:00:00Z',
  '2023-04-15T00:00:00Z',
  500000,
  2000000,
  10000000,
  TRUE,
  20,
  'https://www.energy.gov/grants/building-efficiency/apply',
  'Funding for commercial building energy efficiency improvements including HVAC upgrades, lighting retrofits, and building envelope enhancements.',
  TRUE
),
(
  '23456789-2345-2345-2345-234567890123',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  'Solar Energy Innovation Grant',
  'Federal',
  'Open',
  '2023-03-01T00:00:00Z',
  '2023-05-15T00:00:00Z',
  250000,
  1000000,
  5000000,
  TRUE,
  15,
  'https://www.energy.gov/grants/solar-innovation/apply',
  'Funding for innovative solar energy projects that reduce costs and increase efficiency.',
  TRUE
),
(
  '34567890-3456-3456-3456-345678901234',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '22222222-2222-2222-2222-222222222222',
  'Clean Air Community Grant',
  'Federal',
  'Open',
  '2023-03-15T00:00:00Z',
  '2023-05-30T00:00:00Z',
  100000,
  500000,
  2000000,
  FALSE,
  NULL,
  'https://www.epa.gov/grants/clean-air/apply',
  'Support for communities to improve air quality through local initiatives.',
  TRUE
),
(
  '45678901-4567-4567-4567-456789012345',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '33333333-3333-3333-3333-333333333333',
  'California Energy Efficiency Program',
  'State',
  'Anticipated',
  '2023-04-01T00:00:00Z',
  '2023-06-15T00:00:00Z',
  50000,
  250000,
  1000000,
  TRUE,
  10,
  'https://www.energy.ca.gov/funding/efficiency/apply',
  'Funding for California-based energy efficiency projects.',
  FALSE
),
(
  '56789012-5678-5678-5678-567890123456',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '44444444-4444-4444-4444-444444444444',
  'Sustainability Innovation Challenge',
  'Foundation',
  'Anticipated',
  '2023-05-01T00:00:00Z',
  '2023-07-01T00:00:00Z',
  25000,
  100000,
  500000,
  FALSE,
  NULL,
  'https://www.xyzfoundation.org/grants/sustainability/apply',
  'Funding for innovative approaches to sustainability challenges.',
  TRUE
);

-- Insert state eligibility for the California grant
INSERT INTO states (name, code, region)
VALUES
    ('California', 'CA', 'West')
ON CONFLICT (code) DO NOTHING;

INSERT INTO opportunity_state_eligibility (opportunity_id, state_id)
SELECT 
    '45678901-4567-4567-4567-456789012345'::uuid,
    id 
FROM 
    states 
WHERE 
    code = 'CA'; 