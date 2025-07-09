/**
 * Data Sanitizer
 * 
 * Cleans and prepares opportunity data for database storage.
 * Handles field mapping and data validation.
 */

import { fieldMapping } from './utils/fieldMapping.js';

/**
 * Prepares opportunity data for insertion into database
 * @param {Object} opportunity - Opportunity data
 * @param {string} sourceId - API source ID
 * @param {string|null} fundingSourceId - Funding source ID
 * @returns {Object} - Sanitized data for insertion
 */
function prepareForInsert(opportunity, sourceId, fundingSourceId) {
  const sanitized = sanitizeFields(opportunity);
  
  // Add required fields for insert
  sanitized.source_id = sourceId;
  sanitized.funding_source_id = fundingSourceId;
  sanitized.created_at = new Date().toISOString();
  sanitized.updated_at = new Date().toISOString();
  
  return sanitized;
}

/**
 * Prepares opportunity data for updating existing record
 * @param {Object} opportunity - Opportunity data
 * @param {string|null} fundingSourceId - Funding source ID
 * @returns {Object} - Sanitized data for update
 */
function prepareForUpdate(opportunity, fundingSourceId) {
  const sanitized = sanitizeFields(opportunity);
  
  // Add update fields
  sanitized.funding_source_id = fundingSourceId;
  sanitized.updated_at = new Date().toISOString();
  
  // Never update creation timestamp
  delete sanitized.created_at;
  
  return sanitized;
}

/**
 * Sanitizes and validates opportunity fields
 * @param {Object} opportunity - Raw opportunity data
 * @returns {Object} - Sanitized opportunity data
 */
function sanitizeFields(opportunity) {
  const sanitized = {};
  
  // Map fields using the field mapping utility
  for (const [sourceField, dbField] of Object.entries(fieldMapping.getFieldMappings())) {
    if (opportunity.hasOwnProperty(sourceField)) {
      sanitized[dbField] = sanitizeValue(opportunity[sourceField], dbField);
    }
  }
  
  // Handle special fields that need custom processing
  sanitized.opportunity_id = sanitizeOpportunityId(opportunity.id);
  sanitized.title = sanitizeTitle(opportunity.title);
  sanitized.description = sanitizeDescription(opportunity.description);
  sanitized.url = sanitizeUrl(opportunity.url);
  sanitized.status = sanitizeStatus(opportunity.status);
  
  // Handle API tracking fields
  sanitized.api_updated_at = sanitizeDate(opportunity.api_updated_at);
  sanitized.raw_response_id = opportunity.rawResponseId || null;
  
  // Handle monetary fields
  sanitized.minimum_award = sanitizeAmount(opportunity.minimumAward);
  sanitized.maximum_award = sanitizeAmount(opportunity.maximumAward);
  sanitized.total_funding_available = sanitizeAmount(opportunity.totalFundingAvailable);
  
  // Handle date fields
  sanitized.open_date = sanitizeDate(opportunity.openDate);
  sanitized.close_date = sanitizeDate(opportunity.closeDate);
  sanitized.posted_date = sanitizeDate(opportunity.postedDate);
  
  // Handle arrays
  sanitized.eligible_applicants = sanitizeArray(opportunity.eligibleApplicants);
  sanitized.eligible_project_types = sanitizeArray(opportunity.eligibleProjectTypes);
  sanitized.eligible_locations = sanitizeArray(opportunity.eligibleLocations);
  sanitized.eligible_activities = sanitizeArray(opportunity.eligibleActivities);
  sanitized.categories = sanitizeArray(opportunity.categories);
  sanitized.tags = sanitizeArray(opportunity.tags);
  
  // Handle boolean fields
  sanitized.cost_share_required = sanitizeBoolean(opportunity.matchingRequired);
  sanitized.is_national = sanitizeBoolean(opportunity.isNational);
  
  // Handle percentage fields
  sanitized.cost_share_percentage = sanitizePercentage(opportunity.matchingPercentage);
  
  // Handle analysis scoring object - extract relevance score
  if (opportunity.scoring) {
    sanitized.relevance_score = sanitizeRelevanceScore(opportunity.scoring.overallScore);
    sanitized.scoring = opportunity.scoring; // Store the full scoring object as JSONB
  }
  
  // Handle additional text fields
  sanitized.opportunity_number = opportunity.opportunityNumber || null;
  sanitized.disbursement_type = opportunity.disbursementType || null;
  sanitized.award_process = opportunity.awardProcess || null;
  sanitized.notes = opportunity.notes || null;
  
  // Derive agency_name from funding_source if not explicitly provided
  sanitized.agency_name = opportunity.agencyName || 
    (opportunity.funding_source && opportunity.funding_source.name) || 
    opportunity.fundingAgency || 
    null;
  
  // Handle analysis fields explicitly (debug - these should come from field mapping)
  if (opportunity.actionableSummary) {
    sanitized.actionable_summary = sanitizeDescription(opportunity.actionableSummary);
  }
  if (opportunity.enhancedDescription) {
    sanitized.enhanced_description = sanitizeDescription(opportunity.enhancedDescription);
  }
  if (opportunity.relevanceReasoning) {
    sanitized.relevance_reasoning = sanitizeDescription(opportunity.relevanceReasoning);
  }
  
  return sanitized;
}

/**
 * Sanitizes a single value based on field type
 * @param {any} value - Value to sanitize
 * @param {string} fieldName - Database field name
 * @returns {any} - Sanitized value
 */
function sanitizeValue(value, fieldName) {
  if (value === null || value === undefined) {
    return null;
  }
  
  // String fields
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  
  // Array fields
  if (Array.isArray(value)) {
    return value.filter(item => item !== null && item !== undefined && item !== '');
  }
  
  return value;
}

/**
 * Sanitizes opportunity ID
 * @param {string} id - Opportunity ID
 * @returns {string|null} - Sanitized ID
 */
function sanitizeOpportunityId(id) {
  if (!id) return null;
  return String(id).trim() || null;
}

/**
 * Sanitizes title field
 * @param {string} title - Title
 * @returns {string|null} - Sanitized title
 */
function sanitizeTitle(title) {
  if (!title) return null;
  
  const cleaned = String(title).trim();
  if (cleaned.length === 0) return null;
  
  // Truncate if too long (PostgreSQL varchar limit)
  return cleaned.length > 500 ? cleaned.substring(0, 500) : cleaned;
}

/**
 * Sanitizes description field
 * @param {string} description - Description
 * @returns {string|null} - Sanitized description
 */
function sanitizeDescription(description) {
  if (!description) return null;
  
  const cleaned = String(description).trim();
  return cleaned.length === 0 ? null : cleaned;
}

/**
 * Sanitizes URL field
 * @param {string} url - URL
 * @returns {string|null} - Sanitized URL
 */
function sanitizeUrl(url) {
  if (!url) return null;
  
  const cleaned = String(url).trim();
  if (cleaned.length === 0) return null;
  
  // Basic URL validation
  try {
    new URL(cleaned);
    return cleaned;
  } catch {
    // If not a valid URL, check if it's just missing protocol
    if (!cleaned.startsWith('http')) {
      try {
        new URL(`https://${cleaned}`);
        return `https://${cleaned}`;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Sanitizes status field
 * @param {string} status - Status
 * @returns {string|null} - Sanitized status
 */
function sanitizeStatus(status) {
  if (!status) return null;
  
  const cleaned = String(status).toLowerCase().trim();
  
  // Normalize common status values
  const statusMappings = {
    'open': 'open',
    'active': 'open',
    'available': 'open',
    'closed': 'closed',
    'inactive': 'closed',
    'expired': 'closed',
    'upcoming': 'upcoming',
    'pending': 'upcoming',
    'future': 'upcoming'
  };
  
  return statusMappings[cleaned] || cleaned;
}

/**
 * Sanitizes monetary amounts
 * @param {number|string} amount - Amount
 * @returns {number|null} - Sanitized amount
 */
function sanitizeAmount(amount) {
  if (amount === null || amount === undefined) return null;
  
  // Convert string to number if needed
  if (typeof amount === 'string') {
    // Remove currency symbols and commas
    const cleaned = amount.replace(/[$,]/g, '').trim();
    if (cleaned === '' || cleaned === '0') return null;
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  
  if (typeof amount === 'number') {
    return isNaN(amount) || amount === 0 ? null : amount;
  }
  
  return null;
}

/**
 * Sanitizes date fields
 * @param {string|Date} date - Date
 * @returns {string|null} - Sanitized date in ISO format
 */
function sanitizeDate(date) {
  if (!date) return null;
  
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return null;
    
    return parsed.toISOString();
  } catch {
    return null;
  }
}

/**
 * Sanitizes array fields
 * @param {Array} array - Array to sanitize
 * @returns {Array|null} - Sanitized array
 */
function sanitizeArray(array) {
  if (!Array.isArray(array)) return null;
  
  const cleaned = array
    .filter(item => item !== null && item !== undefined)
    .map(item => String(item).trim())
    .filter(item => item.length > 0);
  
  return cleaned.length === 0 ? null : cleaned;
}

/**
 * Sanitizes boolean fields
 * @param {boolean|string} value - Boolean value
 * @returns {boolean|null} - Sanitized boolean
 */
function sanitizeBoolean(value) {
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'boolean') return value;
  
  if (typeof value === 'string') {
    const cleaned = value.toLowerCase().trim();
    if (cleaned === 'true' || cleaned === 'yes' || cleaned === '1') return true;
    if (cleaned === 'false' || cleaned === 'no' || cleaned === '0') return false;
  }
  
  return null;
}

/**
 * Sanitizes percentage fields
 * @param {number|string} percentage - Percentage value
 * @returns {number|null} - Sanitized percentage (0-100)
 */
function sanitizePercentage(percentage) {
  if (percentage === null || percentage === undefined) return null;
  
  let value = parseFloat(percentage);
  if (isNaN(value)) return null;
  
  // Ensure percentage is between 0 and 100
  if (value < 0) value = 0;
  if (value > 100) value = 100;
  
  return value;
}

/**
 * Sanitizes relevance score from scoring analysis
 * @param {number|string} score - Relevance score value (0-10)
 * @returns {number|null} - Sanitized relevance score (0-10)
 */
function sanitizeRelevanceScore(score) {
  if (score === null || score === undefined) return null;
  
  let value = parseFloat(score);
  if (isNaN(value)) return null;
  
  // Ensure score is between 0 and 10
  if (value < 0) value = 0;
  if (value > 10) value = 10;
  
  return Math.round(value * 100) / 100; // Round to 2 decimal places
}

export const dataSanitizer = {
  prepareForInsert,
  prepareForUpdate,
  sanitizeFields,
  sanitizeValue,
  sanitizeOpportunityId,
  sanitizeTitle,
  sanitizeDescription,
  sanitizeUrl,
  sanitizeStatus,
  sanitizeAmount,
  sanitizeDate,
  sanitizeArray,
  sanitizeBoolean,
  sanitizePercentage,
  sanitizeRelevanceScore
}; 