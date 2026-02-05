/**
 * Client Test Fixtures
 *
 * Sample client records for testing client-matching and client management.
 */

export const clients = {
  // Bay Area municipal government client (PG&E territory)
  pgeBayAreaClient: {
    id: 'client-pge-bay-area',
    name: 'City of San Francisco',
    type: 'Municipal Government',
    city: 'San Francisco',
    state_code: 'CA',
    coverage_area_ids: [1, 2, 3], // PG&E utility, San Francisco county, CA state
    project_needs: ['Energy Efficiency', 'Solar', 'EV Charging'],
    budget: 5000000,
    description: 'City government seeking renewable energy funding',
    dac_status: false,
    created_at: '2024-01-15T10:00:00Z',
  },

  // Southern California utility client (SCE territory)
  sceUtilityClient: {
    id: 'client-sce-utility',
    name: 'SCE Municipal Services',
    type: 'Electric Utility',
    city: 'Los Angeles',
    state_code: 'CA',
    coverage_area_ids: [4, 5, 6], // SCE utility, LA county, CA state
    project_needs: ['Grid Modernization', 'Battery Storage'],
    budget: 10000000,
    description: 'Utility company upgrading grid infrastructure',
    dac_status: false,
    created_at: '2024-02-01T10:00:00Z',
  },

  // Texas commercial client (no utility coverage areas)
  texasCommercialClient: {
    id: 'client-texas-commercial',
    name: 'Texas Energy Corp',
    type: 'Commercial Entity',
    city: 'Houston',
    state_code: 'TX',
    coverage_area_ids: [10, 11], // Harris county, TX state
    project_needs: ['HVAC Upgrades', 'Lighting'],
    budget: 500000,
    description: 'Commercial building owner seeking efficiency upgrades',
    dac_status: false,
    created_at: '2024-02-15T10:00:00Z',
  },

  // School district client
  schoolDistrictClient: {
    id: 'client-school-district',
    name: 'Oakland Unified School District',
    type: 'School District',
    city: 'Oakland',
    state_code: 'CA',
    coverage_area_ids: [7, 8, 6], // Alameda county, East Bay MUD, CA state
    project_needs: ['Solar', 'HVAC Upgrades', 'Building Envelope'],
    budget: 2000000,
    description: 'K-12 school district seeking clean energy improvements',
    dac_status: true,
    created_at: '2024-03-01T10:00:00Z',
  },

  // Nonprofit client
  nonprofitClient: {
    id: 'client-nonprofit',
    name: 'Green Community Foundation',
    type: 'Non-Profit Organization',
    city: 'Sacramento',
    state_code: 'CA',
    coverage_area_ids: [9, 6], // Sacramento county, CA state
    project_needs: ['Community Solar', 'Energy Education'],
    budget: 100000,
    description: 'Environmental nonprofit seeking community programs',
    dac_status: true,
    created_at: '2024-03-15T10:00:00Z',
  },

  // Hospital client
  hospitalClient: {
    id: 'client-hospital',
    name: 'Regional Medical Center',
    type: 'Hospital',
    city: 'San Jose',
    state_code: 'CA',
    coverage_area_ids: [2, 12, 6], // PG&E, Santa Clara county, CA state
    project_needs: ['Energy Efficiency', 'Backup Power', 'HVAC Upgrades'],
    budget: 8000000,
    description: 'Healthcare facility seeking reliability upgrades',
    dac_status: false,
    created_at: '2024-04-01T10:00:00Z',
  },

  // Client with empty project needs
  emptyNeedsClient: {
    id: 'client-empty-needs',
    name: 'New Client Inc',
    type: 'Commercial Entity',
    city: 'Portland',
    state_code: 'OR',
    coverage_area_ids: [20, 21], // Portland area
    project_needs: [],
    budget: 0,
    description: 'Newly added client without defined needs',
    dac_status: false,
    created_at: '2024-04-15T10:00:00Z',
  },

  // City government (synonym test)
  cityGovernmentClient: {
    id: 'client-city-gov',
    name: 'City of Fresno',
    type: 'City Government',
    city: 'Fresno',
    state_code: 'CA',
    coverage_area_ids: [13, 6], // Fresno county, CA state
    project_needs: ['Solar', 'EV Charging', 'Energy Efficiency'],
    budget: 3000000,
    description: 'Central Valley city government',
    dac_status: true,
    created_at: '2024-05-01T10:00:00Z',
  },

  // Township government (hierarchy test)
  townshipClient: {
    id: 'client-township',
    name: 'Marin Township',
    type: 'Township Government',
    city: 'Marin',
    state_code: 'CA',
    coverage_area_ids: [14, 6], // Marin county, CA state
    project_needs: ['Building Envelope', 'Water Heating'],
    budget: 750000,
    description: 'Small township seeking efficiency improvements',
    dac_status: false,
    created_at: '2024-05-15T10:00:00Z',
  },
};

/**
 * Get all clients as array
 */
export function getAllClients() {
  return Object.values(clients);
}

/**
 * Get clients by state
 */
export function getClientsByState(stateCode) {
  return getAllClients().filter((c) => c.state_code === stateCode);
}

/**
 * Get clients by type
 */
export function getClientsByType(type) {
  return getAllClients().filter((c) => c.type === type);
}

/**
 * Get DAC clients
 */
export function getDacClients() {
  return getAllClients().filter((c) => c.dac_status === true);
}

export default clients;
