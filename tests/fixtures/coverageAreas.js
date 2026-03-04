/**
 * Coverage Area Test Fixtures
 *
 * Sample coverage areas representing utilities, counties, and states.
 */

export const coverageAreas = {
  // California utilities
  pge: {
    id: 1,
    name: 'Pacific Gas & Electric',
    kind: 'utility',
    state_code: 'CA',
    parent_id: 6, // CA state
  },
  sce: {
    id: 4,
    name: 'Southern California Edison',
    kind: 'utility',
    state_code: 'CA',
    parent_id: 6, // CA state
  },
  sdge: {
    id: 15,
    name: 'San Diego Gas & Electric',
    kind: 'utility',
    state_code: 'CA',
    parent_id: 6, // CA state
  },
  eastBayMud: {
    id: 8,
    name: 'East Bay Municipal Utility District',
    kind: 'utility',
    state_code: 'CA',
    parent_id: 6, // CA state
  },

  // California counties
  sanFranciscoCounty: {
    id: 2,
    name: 'San Francisco County',
    kind: 'county',
    state_code: 'CA',
    parent_id: 6, // CA state
  },
  losAngelesCounty: {
    id: 5,
    name: 'Los Angeles County',
    kind: 'county',
    state_code: 'CA',
    parent_id: 6, // CA state
  },
  alamedaCounty: {
    id: 7,
    name: 'Alameda County',
    kind: 'county',
    state_code: 'CA',
    parent_id: 6, // CA state
  },
  sacramentoCounty: {
    id: 9,
    name: 'Sacramento County',
    kind: 'county',
    state_code: 'CA',
    parent_id: 6, // CA state
  },
  santaClaraCounty: {
    id: 12,
    name: 'Santa Clara County',
    kind: 'county',
    state_code: 'CA',
    parent_id: 6, // CA state
  },
  fresnoCounty: {
    id: 13,
    name: 'Fresno County',
    kind: 'county',
    state_code: 'CA',
    parent_id: 6, // CA state
  },
  marinCounty: {
    id: 14,
    name: 'Marin County',
    kind: 'county',
    state_code: 'CA',
    parent_id: 6, // CA state
  },

  // Texas areas
  harrisCounty: {
    id: 10,
    name: 'Harris County',
    kind: 'county',
    state_code: 'TX',
    parent_id: 11, // TX state
  },

  // Oregon areas
  multnomahCounty: {
    id: 20,
    name: 'Multnomah County',
    kind: 'county',
    state_code: 'OR',
    parent_id: 21, // OR state
  },

  // States
  california: {
    id: 6,
    name: 'California',
    kind: 'state',
    state_code: 'CA',
    parent_id: null,
  },
  texas: {
    id: 11,
    name: 'Texas',
    kind: 'state',
    state_code: 'TX',
    parent_id: null,
  },
  oregon: {
    id: 21,
    name: 'Oregon',
    kind: 'state',
    state_code: 'OR',
    parent_id: null,
  },

  // Additional coverage areas used in linking
  pgeServiceArea3: {
    id: 3,
    name: 'PG&E Service Territory - Northern',
    kind: 'utility',
    state_code: 'CA',
    parent_id: 6,
  },
};

/**
 * Get all coverage areas as array
 */
export function getAllCoverageAreas() {
  return Object.values(coverageAreas);
}

/**
 * Get coverage areas by kind
 */
export function getCoverageAreasByKind(kind) {
  return getAllCoverageAreas().filter((a) => a.kind === kind);
}

/**
 * Get coverage areas by state
 */
export function getCoverageAreasByState(stateCode) {
  return getAllCoverageAreas().filter((a) => a.state_code === stateCode);
}

/**
 * Get utilities only
 */
export function getUtilities() {
  return getCoverageAreasByKind('utility');
}

/**
 * Get counties only
 */
export function getCounties() {
  return getCoverageAreasByKind('county');
}

/**
 * Get states only
 */
export function getStates() {
  return getCoverageAreasByKind('state');
}

/**
 * Simulate opportunity_coverage_areas join table data
 */
export const opportunityCoverageLinks = [
  // California state grant
  { opportunity_id: 'opp-ca-state-001', coverage_area_id: 6 },

  // PG&E utility grant
  { opportunity_id: 'opp-pge-001', coverage_area_id: 1 },
  { opportunity_id: 'opp-pge-001', coverage_area_id: 2 },
  { opportunity_id: 'opp-pge-001', coverage_area_id: 7 },

  // SCE utility grant
  { opportunity_id: 'opp-sce-001', coverage_area_id: 4 },
  { opportunity_id: 'opp-sce-001', coverage_area_id: 5 },

  // Texas grant
  { opportunity_id: 'opp-texas-001', coverage_area_id: 10 },
  { opportunity_id: 'opp-texas-001', coverage_area_id: 11 },

  // No hot activities grant (CA)
  { opportunity_id: 'opp-no-hot-001', coverage_area_id: 6 },

  // No deadline grant
  { opportunity_id: 'opp-no-deadline-001', coverage_area_id: 1 },
  { opportunity_id: 'opp-no-deadline-001', coverage_area_id: 2 },
];

export default coverageAreas;
