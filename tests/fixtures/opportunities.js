/**
 * Opportunity Test Fixtures
 *
 * Sample funding opportunities for testing matching, filtering, and display.
 */

export const opportunities = {
  // National opportunity - matches all clients
  nationalGrant: {
    id: 'opp-national-001',
    title: 'Federal Clean Energy Grant',
    agency_name: 'Department of Energy',
    is_national: true,
    coverage_area_ids: [], // National = all locations
    eligible_applicants: ['Local Governments', 'State Governments', 'Utilities', 'Non-Profit Organizations'],
    eligible_project_types: ['Energy Efficiency', 'Solar', 'Wind', 'Battery Storage'],
    eligible_activities: ['Construction', 'Installation', 'Equipment Purchase'],
    minimum_award: 100000,
    maximum_award: 5000000,
    total_funding_available: 500000000,
    close_date: '2025-06-30T23:59:59Z',
    status: 'open',
    relevance_score: 8.5,
    categories: ['Energy', 'Infrastructure'],
    program_overview: 'Federal funding for clean energy projects',
    program_insights: 'High competition, strong environmental impact focus',
    created_at: '2024-01-01T10:00:00Z',
  },

  // California state-wide opportunity
  californiaStateGrant: {
    id: 'opp-ca-state-001',
    title: 'California Climate Investments',
    agency_name: 'California Energy Commission',
    is_national: false,
    coverage_area_ids: [6], // CA state only
    eligible_applicants: ['Local Governments', 'School Districts', 'Tribal Governments'],
    eligible_project_types: ['Solar', 'EV Charging', 'Building Envelope'],
    eligible_activities: ['Construction', 'Implementation', 'Feasibility Study'],
    minimum_award: 50000,
    maximum_award: 2000000,
    total_funding_available: 100000000,
    close_date: '2025-03-15T23:59:59Z',
    status: 'open',
    relevance_score: 9.0,
    categories: ['Climate', 'Transportation'],
    program_overview: 'State funding for climate initiatives',
    program_insights: 'DAC communities receive priority',
    created_at: '2024-02-01T10:00:00Z',
  },

  // PG&E utility-specific opportunity
  pgeUtilityGrant: {
    id: 'opp-pge-001',
    title: 'PG&E Commercial Rebate Program',
    agency_name: 'Pacific Gas & Electric',
    is_national: false,
    coverage_area_ids: [1, 2, 7], // PG&E utility area IDs
    eligible_applicants: ['Commercial Entities', 'Municipal Governments', 'Hospitals'],
    eligible_project_types: ['Energy Efficiency', 'HVAC Upgrades', 'Lighting'],
    eligible_activities: ['Equipment Purchase', 'Installation', 'Retrofit'],
    minimum_award: 5000,
    maximum_award: 500000,
    total_funding_available: 10000000,
    close_date: '2025-12-31T23:59:59Z',
    status: 'open',
    relevance_score: 7.5,
    categories: ['Utility Rebates', 'Efficiency'],
    program_overview: 'Utility rebates for efficiency improvements',
    program_insights: 'Quick turnaround, pre-approval required',
    created_at: '2024-03-01T10:00:00Z',
  },

  // SCE utility-specific opportunity
  sceUtilityGrant: {
    id: 'opp-sce-001',
    title: 'SCE Grid Modernization Initiative',
    agency_name: 'Southern California Edison',
    is_national: false,
    coverage_area_ids: [4, 5], // SCE utility area IDs
    eligible_applicants: ['Electric Utilities', 'Local Governments'],
    eligible_project_types: ['Grid Modernization', 'Battery Storage', 'Smart Grid'],
    eligible_activities: ['Construction', 'Technology Deployment', 'Implementation'],
    minimum_award: 100000,
    maximum_award: 3000000,
    total_funding_available: 50000000,
    close_date: '2025-09-30T23:59:59Z',
    status: 'open',
    relevance_score: 8.0,
    categories: ['Grid', 'Technology'],
    program_overview: 'Grid modernization funding for SCE territory',
    program_insights: 'Focus on resilience and distributed energy',
    created_at: '2024-04-01T10:00:00Z',
  },

  // Texas-only opportunity
  texasOnlyGrant: {
    id: 'opp-texas-001',
    title: 'Texas Energy Efficiency Program',
    agency_name: 'Texas State Energy Conservation Office',
    is_national: false,
    coverage_area_ids: [10, 11], // Texas coverage areas
    eligible_applicants: ['Commercial Entities', 'Industrial Facilities'],
    eligible_project_types: ['HVAC Upgrades', 'Lighting', 'Building Controls'],
    eligible_activities: ['Equipment Purchase', 'Installation', 'Commissioning'],
    minimum_award: 10000,
    maximum_award: 250000,
    total_funding_available: 15000000,
    close_date: '2025-08-31T23:59:59Z',
    status: 'open',
    relevance_score: 6.5,
    categories: ['Efficiency', 'Commercial'],
    program_overview: 'Texas commercial efficiency incentives',
    program_insights: 'Fast processing, limited documentation',
    created_at: '2024-05-01T10:00:00Z',
  },

  // Closed opportunity (for status filtering tests)
  closedOpportunity: {
    id: 'opp-closed-001',
    title: 'Expired Federal Grant',
    agency_name: 'Department of Energy',
    is_national: true,
    coverage_area_ids: [],
    eligible_applicants: ['Local Governments', 'State Governments'],
    eligible_project_types: ['Solar', 'Wind'],
    eligible_activities: ['Construction', 'Installation'],
    minimum_award: 50000,
    maximum_award: 1000000,
    total_funding_available: 50000000,
    close_date: '2024-06-30T23:59:59Z',
    status: 'closed',
    relevance_score: 7.0,
    categories: ['Energy'],
    program_overview: 'Expired federal energy grant',
    program_insights: 'Deadline has passed',
    created_at: '2023-01-01T10:00:00Z',
  },

  // Upcoming opportunity
  upcomingOpportunity: {
    id: 'opp-upcoming-001',
    title: 'Future Infrastructure Grant',
    agency_name: 'Department of Transportation',
    is_national: true,
    coverage_area_ids: [],
    eligible_applicants: ['Local Governments', 'State Governments', 'Transit Agencies'],
    eligible_project_types: ['EV Charging', 'Transportation Electrification'],
    eligible_activities: ['Planning', 'Design', 'Construction'],
    minimum_award: 500000,
    maximum_award: 10000000,
    total_funding_available: 200000000,
    close_date: '2026-03-31T23:59:59Z',
    status: 'upcoming',
    relevance_score: 8.0,
    categories: ['Transportation', 'Infrastructure'],
    program_overview: 'Future transportation electrification funding',
    program_insights: 'Anticipated high demand',
    created_at: '2024-06-01T10:00:00Z',
  },

  // No hot activities (should NOT match due to activities requirement)
  noHotActivitiesGrant: {
    id: 'opp-no-hot-001',
    title: 'Planning Only Grant',
    agency_name: 'State Planning Agency',
    is_national: false,
    coverage_area_ids: [6], // CA state
    eligible_applicants: ['Local Governments', 'School Districts'],
    eligible_project_types: ['Solar', 'Energy Efficiency'],
    eligible_activities: ['Planning', 'Feasibility Study', 'Assessment'], // No hot activities!
    minimum_award: 25000,
    maximum_award: 100000,
    total_funding_available: 5000000,
    close_date: '2025-05-15T23:59:59Z',
    status: 'open',
    relevance_score: 5.0,
    categories: ['Planning'],
    program_overview: 'Planning and assessment funding only',
    program_insights: 'Good for early-stage projects',
    created_at: '2024-07-01T10:00:00Z',
  },

  // Opportunity with null deadline
  noDeadlineGrant: {
    id: 'opp-no-deadline-001',
    title: 'Ongoing Rebate Program',
    agency_name: 'Local Utility',
    is_national: false,
    coverage_area_ids: [1, 2],
    eligible_applicants: ['Commercial Entities', 'Residential'],
    eligible_project_types: ['Energy Efficiency', 'Lighting'],
    eligible_activities: ['Equipment Purchase', 'Installation'],
    minimum_award: 100,
    maximum_award: 10000,
    total_funding_available: null,
    close_date: null, // No deadline
    status: 'open',
    relevance_score: 4.0,
    categories: ['Rebates'],
    program_overview: 'Ongoing utility rebate program',
    program_insights: 'Always available, first-come-first-served',
    created_at: '2024-01-15T10:00:00Z',
  },

  // School-specific opportunity
  schoolOnlyGrant: {
    id: 'opp-school-001',
    title: 'K-12 Clean Energy Initiative',
    agency_name: 'Department of Education',
    is_national: true,
    coverage_area_ids: [],
    eligible_applicants: ['School Districts', 'K-12 Schools'],
    eligible_project_types: ['Solar', 'HVAC Upgrades', 'Building Envelope'],
    eligible_activities: ['Construction', 'Installation', 'Retrofit'],
    minimum_award: 100000,
    maximum_award: 2000000,
    total_funding_available: 75000000,
    close_date: '2025-07-15T23:59:59Z',
    status: 'open',
    relevance_score: 9.5,
    categories: ['Education', 'Energy'],
    program_overview: 'Federal funding for school energy projects',
    program_insights: 'Title I schools receive priority',
    created_at: '2024-08-01T10:00:00Z',
  },
};

/**
 * Get all opportunities as array
 */
export function getAllOpportunities() {
  return Object.values(opportunities);
}

/**
 * Get open opportunities only
 */
export function getOpenOpportunities() {
  return getAllOpportunities().filter((o) => o.status === 'open');
}

/**
 * Get national opportunities
 */
export function getNationalOpportunities() {
  return getAllOpportunities().filter((o) => o.is_national === true);
}

/**
 * Get opportunities by coverage area
 */
export function getOpportunitiesByCoverageArea(coverageAreaId) {
  return getAllOpportunities().filter(
    (o) => o.is_national || o.coverage_area_ids.includes(coverageAreaId)
  );
}

export default opportunities;
