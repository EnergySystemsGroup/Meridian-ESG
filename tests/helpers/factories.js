/**
 * Test Data Factories
 *
 * Factory functions to create test entities with sensible defaults.
 * Each factory returns a complete object that can be overridden with
 * partial data. Useful for generating test data without repeating
 * boilerplate across test files.
 */

let idCounter = 1000;

function nextId() {
  return `factory-${++idCounter}`;
}

/**
 * Create a funding opportunity with defaults
 */
export function createOpportunity(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    title: `Test Opportunity ${id}`,
    description: 'A test funding opportunity for automated testing.',
    agency_name: 'Test Agency',
    source_name: 'Test Source',
    funding_amount: 1000000,
    close_date: '2025-12-31',
    status: 'open',
    is_national: false,
    url: `https://example.com/opportunity/${id}`,
    created_at: '2025-01-15T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
    project_types: ['energy_efficiency'],
    eligible_applicants: ['commercial'],
    coverage_state_codes: ['CA'],
    v2_score: 7.0,
    v2_score_details: {
      funding_clarity: 7,
      eligibility_specificity: 7,
      program_maturity: 7,
      application_accessibility: 7,
      strategic_alignment: 7,
    },
    ...overrides,
  };
}

/**
 * Create a client with defaults
 */
export function createClient(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    name: `Test Client ${id}`,
    contact_email: `client-${id}@example.com`,
    state_code: 'CA',
    address: '123 Test Street, San Francisco, CA 94105',
    latitude: 37.7749,
    longitude: -122.4194,
    industry_type: 'commercial',
    project_types: ['energy_efficiency', 'solar'],
    annual_budget: 500000,
    is_dac: false,
    notes: '',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create a coverage area with defaults
 */
export function createCoverageArea(overrides = {}) {
  const id = overrides.id || ++idCounter;
  return {
    id: typeof id === 'string' ? id : Number(id),
    name: `Test Area ${id}`,
    kind: 'utility',
    state_code: 'CA',
    ...overrides,
  };
}

/**
 * Create a funding source with defaults
 */
export function createFundingSource(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    name: `Test Source ${id}`,
    api_url: null,
    content_type: 'html',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create a match record between client and opportunity
 */
export function createMatch(clientId, opportunityId, overrides = {}) {
  return {
    client_id: clientId,
    opportunity_id: opportunityId,
    match_score: 75,
    match_reasons: ['project_type_overlap', 'coverage_area_match'],
    is_hidden: false,
    ...overrides,
  };
}

/**
 * Create a processing run with defaults
 */
export function createRun(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    source_id: 'test-source-1',
    status: 'completed',
    started_at: '2025-01-15T10:00:00Z',
    completed_at: '2025-01-15T10:05:00Z',
    records_processed: 50,
    records_created: 45,
    records_updated: 3,
    records_failed: 2,
    error_log: null,
    ...overrides,
  };
}

/**
 * Create a staging record with defaults
 */
export function createStagingRecord(overrides = {}) {
  const id = overrides.id || nextId();
  return {
    id,
    source_id: 'test-source-1',
    title: `Staging Program ${id}`,
    url: `https://example.com/program/${id}`,
    content_type: 'html',
    discovery_method: 'cc_agent',
    discovered_by: 'discovery_agent',
    extraction_status: 'pending',
    analysis_status: 'pending',
    storage_status: 'pending',
    extraction_data: null,
    raw_content: null,
    analysis_data: null,
    created_at: '2025-01-15T00:00:00Z',
    ...overrides,
  };
}

/**
 * Batch create multiple entities
 */
export function createBatch(factory, count, overridesFn = () => ({})) {
  return Array.from({ length: count }, (_, i) => factory(overridesFn(i)));
}

/**
 * Reset the ID counter (useful in beforeEach)
 */
export function resetFactoryIds() {
  idCounter = 1000;
}
