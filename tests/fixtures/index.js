/**
 * Test Fixtures Index
 *
 * Central export for all test fixtures.
 */

export { clients, getAllClients, getClientsByState, getClientsByType, getDacClients } from './clients.js';

export {
  opportunities,
  getAllOpportunities,
  getOpenOpportunities,
  getNationalOpportunities,
  getOpportunitiesByCoverageArea,
} from './opportunities.js';

export {
  coverageAreas,
  getAllCoverageAreas,
  getCoverageAreasByKind,
  getCoverageAreasByState,
  getUtilities,
  getCounties,
  getStates,
  opportunityCoverageLinks,
} from './coverageAreas.js';

export {
  matchScenarios,
  getAllScenarios,
  getMatchingScenarios,
  getNonMatchingScenarios,
  getScenariosForCriteria,
} from './matchScenarios.js';

export {
  createDeadlineScenarios,
  staticDeadlines,
  colorThresholds,
  getExpectedColor,
  getDeadlinesSortedByUrgency,
} from './deadlines.js';

/**
 * Create a complete test database with all fixtures
 */
export function createTestDatabase() {
  const { clients } = require('./clients.js');
  const { opportunities } = require('./opportunities.js');
  const { coverageAreas, opportunityCoverageLinks } = require('./coverageAreas.js');

  return {
    clients: Object.values(clients),
    funding_opportunities: Object.values(opportunities),
    coverage_areas: Object.values(coverageAreas),
    opportunity_coverage_areas: opportunityCoverageLinks,
    hidden_matches: [],
    tracked_opportunities: [],
  };
}
