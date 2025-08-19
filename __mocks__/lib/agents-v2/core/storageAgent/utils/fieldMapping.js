// Mock fieldMapping module

const FIELD_MAPPINGS = {
  // Core fields
  'id': 'api_opportunity_id',
  'title': 'title',
  'description': 'description',
  'url': 'url',
  'status': 'status',
  
  // Monetary fields
  'minimumAward': 'minimum_award',
  'maximumAward': 'maximum_award',
  'totalFundingAvailable': 'total_funding_available',
  
  // Date fields
  'openDate': 'open_date',
  'closeDate': 'close_date',
  
  // Array fields
  'eligibleApplicants': 'eligible_applicants',
  'eligibleProjectTypes': 'eligible_project_types',
  'eligibleLocations': 'eligible_locations',
  'categories': 'categories',
  'tags': 'tags',
  
  // Boolean fields
  'matchingRequired': 'cost_share_required',
  'isNational': 'is_national',
  
  // Percentage fields
  'matchingPercentage': 'cost_share_percentage',
  
  // Agency fields
  'agencyName': 'agency_name',
  'agencyEmail': 'agency_email',
  'agencyPhone': 'agency_phone',
  'agencyWebsite': 'agency_website',
  'fundingAgency': 'funding_agency',
  
  // Additional fields
  'fundingType': 'funding_type',
  'relevanceScore': 'relevance_score',
  'materialChangeDescription': 'material_change_description',
  'isMaterialChange': 'is_material_change',
  
  // Scoring fields (nested object)
  'scoring': 'scoring',
  'fundingDetails': 'funding_details',
  'applicationInfo': 'application_info',
  'analysisFields': 'analysis_fields'
}

const REVERSE_MAPPINGS = Object.entries(FIELD_MAPPINGS).reduce((acc, [api, db]) => {
  acc[db] = api;
  return acc;
}, {});

export const fieldMapping = {
  getFieldMappings: jest.fn(() => ({ ...FIELD_MAPPINGS })),
  getReverseFieldMappings: jest.fn(() => ({ ...REVERSE_MAPPINGS })),
  camelToSnake: jest.fn((str) => {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }),
  snakeToCamel: jest.fn((str) => {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }),
  convertObjectToSnakeCase: jest.fn((obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = FIELD_MAPPINGS[key] || key;
      converted[snakeKey] = value;
    }
    return converted;
  }),
  convertObjectToCamelCase: jest.fn((obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = REVERSE_MAPPINGS[key] || key;
      converted[camelKey] = value;
    }
    return converted;
  }),
  isCamelCase: jest.fn((str) => /^[a-z][a-zA-Z0-9]*$/.test(str)),
  isSnakeCase: jest.fn((str) => /^[a-z][a-z0-9_]*$/.test(str)),
  getDatabaseFields: jest.fn(() => Object.values(FIELD_MAPPINGS)),
  getApiFields: jest.fn(() => Object.keys(FIELD_MAPPINGS)),
  validateFieldFormat: jest.fn(() => true)
}