/**
 * Location Parsing Utility
 * 
 * Parses location strings to state codes.
 * Handles regions, state names, abbreviations, and complex location descriptions.
 */

/**
 * State code mappings
 */
const STATE_CODES = {
  'alabama': 'AL', 'al': 'AL',
  'alaska': 'AK', 'ak': 'AK',
  'arizona': 'AZ', 'az': 'AZ',
  'arkansas': 'AR', 'ar': 'AR',
  'california': 'CA', 'ca': 'CA',
  'colorado': 'CO', 'co': 'CO',
  'connecticut': 'CT', 'ct': 'CT',
  'delaware': 'DE', 'de': 'DE',
  'florida': 'FL', 'fl': 'FL',
  'georgia': 'GA', 'ga': 'GA',
  'hawaii': 'HI', 'hi': 'HI',
  'idaho': 'ID', 'id': 'ID',
  'illinois': 'IL', 'il': 'IL',
  'indiana': 'IN', 'in': 'IN',
  'iowa': 'IA', 'ia': 'IA',
  'kansas': 'KS', 'ks': 'KS',
  'kentucky': 'KY', 'ky': 'KY',
  'louisiana': 'LA', 'la': 'LA',
  'maine': 'ME', 'me': 'ME',
  'maryland': 'MD', 'md': 'MD',
  'massachusetts': 'MA', 'ma': 'MA',
  'michigan': 'MI', 'mi': 'MI',
  'minnesota': 'MN', 'mn': 'MN',
  'mississippi': 'MS', 'ms': 'MS',
  'missouri': 'MO', 'mo': 'MO',
  'montana': 'MT', 'mt': 'MT',
  'nebraska': 'NE', 'ne': 'NE',
  'nevada': 'NV', 'nv': 'NV',
  'new hampshire': 'NH', 'nh': 'NH',
  'new jersey': 'NJ', 'nj': 'NJ',
  'new mexico': 'NM', 'nm': 'NM',
  'new york': 'NY', 'ny': 'NY',
  'north carolina': 'NC', 'nc': 'NC',
  'north dakota': 'ND', 'nd': 'ND',
  'ohio': 'OH', 'oh': 'OH',
  'oklahoma': 'OK', 'ok': 'OK',
  'oregon': 'OR', 'or': 'OR',
  'pennsylvania': 'PA', 'pa': 'PA',
  'rhode island': 'RI', 'ri': 'RI',
  'south carolina': 'SC', 'sc': 'SC',
  'south dakota': 'SD', 'sd': 'SD',
  'tennessee': 'TN', 'tn': 'TN',
  'texas': 'TX', 'tx': 'TX',
  'utah': 'UT', 'ut': 'UT',
  'vermont': 'VT', 'vt': 'VT',
  'virginia': 'VA', 'va': 'VA',
  'washington': 'WA', 'wa': 'WA',
  'west virginia': 'WV', 'wv': 'WV',
  'wisconsin': 'WI', 'wi': 'WI',
  'wyoming': 'WY', 'wy': 'WY',
  'district of columbia': 'DC', 'dc': 'DC',
  'washington dc': 'DC', 'washington d.c.': 'DC'
};

/**
 * Regional mappings
 */
const REGIONAL_MAPPINGS = {
  'new england': ['CT', 'ME', 'MA', 'NH', 'RI', 'VT'],
  'northeast': ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  'mid-atlantic': ['NJ', 'NY', 'PA'],
  'southeast': ['AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
  'south': ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV'],
  'midwest': ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
  'great lakes': ['IL', 'IN', 'MI', 'MN', 'NY', 'OH', 'PA', 'WI'],
  'plains': ['IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
  'southwest': ['AZ', 'NM', 'TX', 'OK'],
  'west': ['AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY'],
  'pacific': ['AK', 'CA', 'HI', 'OR', 'WA'],
  'pacific northwest': ['OR', 'WA'],
  'mountain': ['AZ', 'CO', 'ID', 'MT', 'NV', 'NM', 'UT', 'WY'],
  'rocky mountains': ['CO', 'ID', 'MT', 'WY'],
  'sunbelt': ['AL', 'AZ', 'CA', 'FL', 'GA', 'LA', 'MS', 'NV', 'NM', 'NC', 'SC', 'TN', 'TX'],
  'rust belt': ['IL', 'IN', 'MI', 'NY', 'OH', 'PA', 'WI'],
  'bible belt': ['AL', 'AR', 'GA', 'KY', 'LA', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA']
};

/**
 * Parses a location string to state codes
 * @param {string} locationStr - Location string to parse
 * @returns {Array} - Array of state codes
 */
function parseLocationToStateCodes(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') {
    return [];
  }
  
  const location = locationStr.toLowerCase().trim();
  
  // Check for explicit "national" indicators
  if (isNationalLocation(location)) {
    return []; // National locations return empty array
  }
  
  const stateCodes = new Set();
  
  // Check for regional mappings first
  for (const [region, codes] of Object.entries(REGIONAL_MAPPINGS)) {
    if (location.includes(region)) {
      codes.forEach(code => stateCodes.add(code));
    }
  }
  
  // Parse individual states from the string
  const individualStates = parseIndividualStates(location);
  individualStates.forEach(code => stateCodes.add(code));
  
  return Array.from(stateCodes).sort();
}

/**
 * Checks if location indicates national scope
 * @param {string} location - Normalized location string
 * @returns {boolean} - Whether location is national
 */
function isNationalLocation(location) {
  const nationalIndicators = [
    'national',
    'nationwide',
    'all states',
    'united states',
    'usa',
    'us',
    'all 50 states',
    'entire country',
    'country-wide',
    'countrywide'
  ];
  
  return nationalIndicators.some(indicator => location.includes(indicator));
}

/**
 * Parses individual state mentions from location string
 * @param {string} location - Normalized location string
 * @returns {Array} - Array of state codes
 */
function parseIndividualStates(location) {
  const stateCodes = new Set();
  
  // Split by common delimiters
  const parts = location.split(/[,;|&\n\r]/);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    
    // Check for exact state name or abbreviation matches
    const stateCode = STATE_CODES[trimmed];
    if (stateCode) {
      stateCodes.add(stateCode);
      continue;
    }
    
    // Check for partial matches within the part
    for (const [stateName, code] of Object.entries(STATE_CODES)) {
      if (trimmed.includes(stateName)) {
        stateCodes.add(code);
      }
    }
  }
  
  return Array.from(stateCodes);
}

/**
 * Validates a state code
 * @param {string} stateCode - State code to validate
 * @returns {boolean} - Whether state code is valid
 */
function isValidStateCode(stateCode) {
  if (!stateCode || typeof stateCode !== 'string') return false;
  
  const code = stateCode.toUpperCase();
  return Object.values(STATE_CODES).includes(code);
}

/**
 * Gets state name from state code
 * @param {string} stateCode - State code
 * @returns {string|null} - State name or null
 */
function getStateName(stateCode) {
  if (!isValidStateCode(stateCode)) return null;
  
  const code = stateCode.toUpperCase();
  
  for (const [name, stateCodeValue] of Object.entries(STATE_CODES)) {
    if (stateCodeValue === code && name.length > 2) {
      return name.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    }
  }
  
  return null;
}

/**
 * Gets all state codes for a region
 * @param {string} region - Region name
 * @returns {Array} - Array of state codes
 */
function getStatesInRegion(region) {
  const normalizedRegion = region.toLowerCase().trim();
  return REGIONAL_MAPPINGS[normalizedRegion] || [];
}

/**
 * Gets all available regions
 * @returns {Array} - Array of region names
 */
function getAvailableRegions() {
  return Object.keys(REGIONAL_MAPPINGS);
}

/**
 * Expands a mixed array of state codes and regions to just state codes
 * @param {Array} locations - Array of state codes and/or regions
 * @returns {Array} - Array of unique state codes
 */
function expandLocationsToStateCodes(locations) {
  if (!Array.isArray(locations)) return [];
  
  const stateCodes = new Set();
  
  for (const location of locations) {
    if (!location || typeof location !== 'string') continue;
    
    const codes = parseLocationToStateCodes(location);
    codes.forEach(code => stateCodes.add(code));
  }
  
  return Array.from(stateCodes).sort();
}

/**
 * Checks if a location string mentions multiple states
 * @param {string} locationStr - Location string
 * @returns {boolean} - Whether multiple states are mentioned
 */
function isMultiStateLocation(locationStr) {
  const codes = parseLocationToStateCodes(locationStr);
  return codes.length > 1;
}

/**
 * Gets a human-readable description of parsed locations
 * @param {Array} stateCodes - Array of state codes
 * @returns {string} - Human-readable description
 */
function getLocationDescription(stateCodes) {
  if (!Array.isArray(stateCodes) || stateCodes.length === 0) {
    return 'No specific states';
  }
  
  if (stateCodes.length === 1) {
    const stateName = getStateName(stateCodes[0]);
    return stateName || stateCodes[0];
  }
  
  if (stateCodes.length <= 5) {
    const stateNames = stateCodes.map(code => getStateName(code) || code);
    return stateNames.join(', ');
  }
  
  return `${stateCodes.length} states`;
}

export const locationParsing = {
  parseLocationToStateCodes,
  isNationalLocation,
  parseIndividualStates,
  isValidStateCode,
  getStateName,
  getStatesInRegion,
  getAvailableRegions,
  expandLocationsToStateCodes,
  isMultiStateLocation,
  getLocationDescription
}; 