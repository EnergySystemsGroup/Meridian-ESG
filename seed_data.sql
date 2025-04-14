-- IMPORTANT: All sample data has been commented out for staging environment.
-- This prevents test data from being loaded into the staging database.
-- If you need test data in staging, please create staging-specific data.

/*
-- Clear existing data
TRUNCATE funding_sources, funding_programs, funding_opportunities, opportunity_state_eligibility CASCADE;

-- Insert funding sources
INSERT INTO funding_sources (id, name, type, agency_type, description, website, contact_email, contact_phone)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Department of Energy', 'Federal', 'Federal', 'The Department of Energy (DOE) is responsible for advancing the energy, environmental, and nuclear security of the United States.', 'https://www.energy.gov', 'info@energy.gov', '202-586-5000'),
  ('22222222-2222-2222-2222-222222222222', 'Environmental Protection Agency', 'Federal', 'Federal', 'The Environmental Protection Agency (EPA) is an independent executive agency of the United States federal government tasked with environmental protection matters.', 'https://www.epa.gov', 'public-inquiries@epa.gov', '202-272-0167'),
  ('33333333-3333-3333-3333-333333333333', 'Department of Agriculture', 'Federal', 'Federal', 'The United States Department of Agriculture (USDA) is the federal executive department responsible for developing and executing federal laws related to farming, forestry, rural economic development, and food.', 'https://www.usda.gov', 'askusda@usda.gov', '202-720-2791'),
  ('44444444-4444-4444-4444-444444444444', 'California Energy Commission', 'State', 'State', 'The California Energy Commission is the state''s primary energy policy and planning agency.', 'https://www.energy.ca.gov', 'mediaoffice@energy.ca.gov', '916-654-4989'),
  ('55555555-5555-5555-5555-555555555555', 'New York State Energy Research and Development Authority', 'State', 'State', 'NYSERDA offers objective information and analysis, innovative programs, technical expertise, and support to help New Yorkers increase energy efficiency, save money, use renewable energy, and reduce reliance on fossil fuels.', 'https://www.nyserda.ny.gov', 'info@nyserda.ny.gov', '866-697-3732');

-- Insert funding programs
INSERT INTO funding_programs (id, name, source_id, description)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Clean Energy Research', '11111111-1111-1111-1111-111111111111', 'Research program focused on developing new clean energy technologies.'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Environmental Justice Grants', '22222222-2222-2222-2222-222222222222', 'Grants to address environmental and public health issues in underserved communities.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Rural Development', '33333333-3333-3333-3333-333333333333', 'Program to improve the economy and quality of life in rural America.'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'California Clean Energy Fund', '44444444-4444-4444-4444-444444444444', 'Fund to support clean energy projects in California.'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'NY Green Bank', '55555555-5555-5555-5555-555555555555', 'A state-sponsored financial entity working with the private sector to increase investments into New York''s clean energy markets.');

-- Insert funding opportunities
INSERT INTO funding_opportunities (
  id, title, opportunity_number, source_name, source_type, 
  min_amount, max_amount, minimum_award, maximum_award, 
  cost_share_required, cost_share_percentage, 
  posted_date, open_date, close_date, 
  description, objectives, eligibility, status, tags, url, is_national, program_id
)
VALUES
  (
    'abcdef01-abcd-abcd-abcd-abcdef012345', 
    'Advanced Solar Energy Research Initiative', 
    'DOE-2023-SOLAR-01', 
    'Department of Energy', 
    'Federal', 
    100000, 1000000, 100000, 1000000, 
    true, 20, 
    '2023-01-15T00:00:00Z', '2023-02-01T00:00:00Z', '2023-12-31T23:59:59Z', 
    'Funding for innovative solar energy research projects that aim to reduce costs and improve efficiency.', 
    'To advance solar energy technologies and accelerate their adoption in the United States.', 
    'Open to universities, research institutions, and private companies with demonstrated expertise in solar energy research.', 
    'Open', 
    ARRAY['solar', 'renewable energy', 'research'], 
    'https://www.energy.gov/solar-initiative', 
    false, 
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ),
  (
    'bcdef012-bcde-bcde-bcde-bcdef0123456', 
    'Environmental Justice Community Grants', 
    'EPA-2023-EJ-01', 
    'Environmental Protection Agency', 
    'Federal', 
    50000, 200000, 50000, 200000, 
    false, null, 
    '2023-02-10T00:00:00Z', '2023-03-01T00:00:00Z', '2023-11-30T23:59:59Z', 
    'Grants to address environmental and public health issues in underserved communities.', 
    'To empower communities to develop solutions that address local environmental and public health issues.', 
    'Open to nonprofit organizations, tribal governments, and community-based organizations serving underrepresented populations.', 
    'Open', 
    ARRAY['environmental justice', 'community', 'public health'], 
    'https://www.epa.gov/ej-grants', 
    false, 
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ),
  (
    'cdef0123-cdef-cdef-cdef-cdef01234567', 
    'Rural Renewable Energy Development', 
    'USDA-2023-RRED-01', 
    'Department of Agriculture', 
    'Federal', 
    200000, 500000, 200000, 500000, 
    true, 25, 
    '2023-03-05T00:00:00Z', '2023-04-01T00:00:00Z', '2023-10-31T23:59:59Z', 
    'Funding for renewable energy projects in rural communities to reduce energy costs and increase energy independence.', 
    'To help rural communities develop renewable energy resources and improve energy efficiency.', 
    'Open to rural businesses, agricultural producers, and rural public entities.', 
    'Open', 
    ARRAY['rural', 'renewable energy', 'agriculture'], 
    'https://www.usda.gov/rural-energy', 
    false, 
    'cccccccc-cccc-cccc-cccc-cccccccccccc'
  ),
  (
    'def01234-def0-def0-def0-def012345678', 
    'California Clean Transportation Initiative', 
    'CEC-2023-CCTI-01', 
    'California Energy Commission', 
    'State', 
    75000, 300000, 75000, 300000, 
    true, 15, 
    '2023-04-20T00:00:00Z', '2023-05-15T00:00:00Z', '2023-12-15T23:59:59Z', 
    'Funding for projects that advance clean transportation technologies and infrastructure in California.', 
    'To reduce greenhouse gas emissions from the transportation sector and improve air quality in California.', 
    'Open to California-based businesses, research institutions, and public agencies.', 
    'Open', 
    ARRAY['transportation', 'clean energy', 'California'], 
    'https://www.energy.ca.gov/transportation', 
    false, 
    'dddddddd-dddd-dddd-dddd-dddddddddddd'
  ),
  (
    'ef012345-ef01-ef01-ef01-ef0123456789', 
    'New York Community Solar Development', 
    'NYSERDA-2023-CSD-01', 
    'New York State Energy Research and Development Authority', 
    'State', 
    100000, 400000, 100000, 400000, 
    true, 10, 
    '2023-05-10T00:00:00Z', '2023-06-01T00:00:00Z', '2023-11-30T23:59:59Z', 
    'Funding for community solar projects that increase access to solar energy for low and moderate-income New Yorkers.', 
    'To expand solar access to all New Yorkers and support the state''s clean energy goals.', 
    'Open to solar developers, community organizations, and municipalities in New York State.', 
    'Open', 
    ARRAY['solar', 'community', 'New York'], 
    'https://www.nyserda.ny.gov/community-solar', 
    false, 
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
  ),
  (
    'f0123456-f012-f012-f012-f0123456789a', 
    'National Clean Energy Innovation Challenge', 
    'DOE-2023-NCEIC-01', 
    'Department of Energy', 
    'Federal', 
    500000, 2000000, 500000, 2000000, 
    true, 30, 
    '2023-06-15T00:00:00Z', '2023-07-01T00:00:00Z', '2023-12-31T23:59:59Z', 
    'A national competition to accelerate clean energy innovation across multiple technology areas.', 
    'To identify and support groundbreaking clean energy technologies with the potential for significant market impact.', 
    'Open to universities, national laboratories, private companies, and non-profit research organizations nationwide.', 
    'Open', 
    ARRAY['innovation', 'clean energy', 'competition'], 
    'https://www.energy.gov/innovation-challenge', 
    true, 
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  );

-- Insert state eligibility for opportunities
-- For the first opportunity (Solar Energy Research), eligible in CA, AZ, NV, NM, TX (states with high solar potential)
INSERT INTO opportunity_state_eligibility (opportunity_id, state_id)
VALUES
  ('abcdef01-abcd-abcd-abcd-abcdef012345', 5),  -- California
  ('abcdef01-abcd-abcd-abcd-abcdef012345', 3),  -- Arizona
  ('abcdef01-abcd-abcd-abcd-abcdef012345', 28), -- Nevada
  ('abcdef01-abcd-abcd-abcd-abcdef012345', 31), -- New Mexico
  ('abcdef01-abcd-abcd-abcd-abcdef012345', 43); -- Texas

-- For the second opportunity (Environmental Justice), eligible in NY, NJ, PA, MI, IL
INSERT INTO opportunity_state_eligibility (opportunity_id, state_id)
VALUES
  ('bcdef012-bcde-bcde-bcde-bcdef0123456', 32), -- New York
  ('bcdef012-bcde-bcde-bcde-bcdef0123456', 30), -- New Jersey
  ('bcdef012-bcde-bcde-bcde-bcdef0123456', 38), -- Pennsylvania
  ('bcdef012-bcde-bcde-bcde-bcdef0123456', 22), -- Michigan
  ('bcdef012-bcde-bcde-bcde-bcdef0123456', 13); -- Illinois

-- For the third opportunity (Rural Renewable Energy), eligible in IA, NE, KS, MO, OK
INSERT INTO opportunity_state_eligibility (opportunity_id, state_id)
VALUES
  ('cdef0123-cdef-cdef-cdef-cdef01234567', 15), -- Iowa
  ('cdef0123-cdef-cdef-cdef-cdef01234567', 27), -- Nebraska
  ('cdef0123-cdef-cdef-cdef-cdef01234567', 16), -- Kansas
  ('cdef0123-cdef-cdef-cdef-cdef01234567', 25), -- Missouri
  ('cdef0123-cdef-cdef-cdef-cdef01234567', 36); -- Oklahoma

-- For the fourth opportunity (California Clean Transportation), only eligible in CA
INSERT INTO opportunity_state_eligibility (opportunity_id, state_id)
VALUES
  ('def01234-def0-def0-def0-def012345678', 5);  -- California

-- For the fifth opportunity (New York Community Solar), only eligible in NY
INSERT INTO opportunity_state_eligibility (opportunity_id, state_id)
VALUES
  ('ef012345-ef01-ef01-ef01-ef0123456789', 32); -- New York

-- The sixth opportunity is national, so no state eligibility needed (is_national = true) 
*/

-- You can add staging-specific data here if needed 