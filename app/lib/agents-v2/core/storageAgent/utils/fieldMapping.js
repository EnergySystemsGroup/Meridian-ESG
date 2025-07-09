/**
 * Field Mapping Utility
 * 
 * Handles mapping between camelCase API responses and snake_case database fields.
 * Centralizes field name mappings to avoid duplication.
 */

/**
 * Mapping from camelCase API fields to snake_case database fields
 */
const FIELD_MAPPINGS = {
  // Core fields
  'id': 'opportunity_id',
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
  'applicationDeadline': 'application_deadline',
  'announcementDate': 'announcement_date',
  'lastUpdated': 'last_updated',
  
  // Analysis fields (from AnalysisAgent)
  'actionableSummary': 'actionable_summary',
  'relevanceScore': 'relevance_score',
  'enhancedDescription': 'enhanced_description',
  'relevanceReasoning': 'relevance_reasoning'
};

/**
 * Reverse mapping from snake_case database fields to camelCase API fields
 */
const REVERSE_FIELD_MAPPINGS = Object.fromEntries(
  Object.entries(FIELD_MAPPINGS).map(([camel, snake]) => [snake, camel])
);

/**
 * Gets the complete field mappings object
 * @returns {Object} - Field mappings from camelCase to snake_case
 */
function getFieldMappings() {
  return { ...FIELD_MAPPINGS };
}

/**
 * Gets the reverse field mappings object
 * @returns {Object} - Field mappings from snake_case to camelCase
 */
function getReverseFieldMappings() {
  return { ...REVERSE_FIELD_MAPPINGS };
}

/**
 * Converts a camelCase field name to snake_case
 * @param {string} camelField - CamelCase field name
 * @returns {string} - snake_case field name
 */
function camelToSnake(camelField) {
  return FIELD_MAPPINGS[camelField] || camelField;
}

/**
 * Converts a snake_case field name to camelCase
 * @param {string} snakeField - snake_case field name
 * @returns {string} - camelCase field name
 */
function snakeToCamel(snakeField) {
  return REVERSE_FIELD_MAPPINGS[snakeField] || snakeField;
}

/**
 * Converts an entire object from camelCase to snake_case
 * @param {Object} camelObj - Object with camelCase keys
 * @returns {Object} - Object with snake_case keys
 */
function convertObjectToSnakeCase(camelObj) {
  if (!camelObj || typeof camelObj !== 'object') {
    return camelObj;
  }
  
  const snakeObj = {};
  
  for (const [key, value] of Object.entries(camelObj)) {
    const snakeKey = camelToSnake(key);
    snakeObj[snakeKey] = value;
  }
  
  return snakeObj;
}

/**
 * Converts an entire object from snake_case to camelCase
 * @param {Object} snakeObj - Object with snake_case keys
 * @returns {Object} - Object with camelCase keys
 */
function convertObjectToCamelCase(snakeObj) {
  if (!snakeObj || typeof snakeObj !== 'object') {
    return snakeObj;
  }
  
  const camelObj = {};
  
  for (const [key, value] of Object.entries(snakeObj)) {
    const camelKey = snakeToCamel(key);
    camelObj[camelKey] = value;
  }
  
  return camelObj;
}

/**
 * Checks if a field name is in camelCase format
 * @param {string} fieldName - Field name to check
 * @returns {boolean} - Whether field is camelCase
 */
function isCamelCase(fieldName) {
  return /^[a-z][a-zA-Z0-9]*$/.test(fieldName) && fieldName.includes(fieldName.toLowerCase());
}

/**
 * Checks if a field name is in snake_case format
 * @param {string} fieldName - Field name to check
 * @returns {boolean} - Whether field is snake_case
 */
function isSnakeCase(fieldName) {
  return /^[a-z][a-z0-9_]*$/.test(fieldName) && fieldName.includes('_');
}

/**
 * Gets all database field names
 * @returns {Array} - Array of snake_case database field names
 */
function getDatabaseFields() {
  return Object.values(FIELD_MAPPINGS);
}

/**
 * Gets all API field names
 * @returns {Array} - Array of camelCase API field names
 */
function getApiFields() {
  return Object.keys(FIELD_MAPPINGS);
}

/**
 * Validates that an object has the expected field format
 * @param {Object} obj - Object to validate
 * @param {string} expectedFormat - 'camelCase' or 'snake_case'
 * @returns {Object} - Validation result
 */
function validateFieldFormat(obj, expectedFormat) {
  if (!obj || typeof obj !== 'object') {
    return { isValid: false, error: 'Object is required' };
  }
  
  const keys = Object.keys(obj);
  const invalidFields = [];
  
  for (const key of keys) {
    if (expectedFormat === 'camelCase' && !isCamelCase(key)) {
      invalidFields.push(key);
    } else if (expectedFormat === 'snake_case' && !isSnakeCase(key)) {
      invalidFields.push(key);
    }
  }
  
  if (invalidFields.length > 0) {
    return {
      isValid: false,
      error: `Invalid ${expectedFormat} fields: ${invalidFields.join(', ')}`
    };
  }
  
  return { isValid: true };
}

export const fieldMapping = {
  getFieldMappings,
  getReverseFieldMappings,
  camelToSnake,
  snakeToCamel,
  convertObjectToSnakeCase,
  convertObjectToCamelCase,
  isCamelCase,
  isSnakeCase,
  getDatabaseFields,
  getApiFields,
  validateFieldFormat
}; 