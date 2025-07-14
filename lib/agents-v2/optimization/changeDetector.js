/**
 * Change Detector
 * 
 * Detects material changes in opportunities to prevent spam updates.
 * Only updates opportunities when critical fields change significantly.
 */

/**
 * Detects if an opportunity has material changes worth updating
 * @param {Object} existing - Existing opportunity from database
 * @param {Object} opportunity - New opportunity data
 * @returns {boolean} - Whether material changes were detected
 */
function detectMaterialChanges(existing, opportunity) {
  const criticalFields = [
    'openDate',
    'closeDate', 
    'status',
    'minimumAward',
    'maximumAward',
    'totalFundingAvailable'
  ];
  
  let hasChanges = false;
  
  for (const field of criticalFields) {
    if (hasFieldChanged(existing, opportunity, field)) {
      console.log(`[ChangeDetector] 📝 Material change detected in ${field}: ${existing[field]} → ${opportunity[field]}`);
      hasChanges = true;
    }
  }
  
  // Check for description changes (only if significantly different)
  if (hasDescriptionChanged(existing.description, opportunity.description)) {
    console.log(`[ChangeDetector] 📝 Significant description change detected`);
    hasChanges = true;
  }
  
  return hasChanges;
}

/**
 * Checks if a specific field has changed significantly
 * @param {Object} existing - Existing opportunity
 * @param {Object} opportunity - New opportunity data
 * @param {string} field - Field name to check
 * @returns {boolean} - Whether field has changed
 */
function hasFieldChanged(existing, opportunity, field) {
  const existingValue = existing[field];
  const newValue = opportunity[field];
  
  // Handle monetary fields with percentage threshold
  if (['minimumAward', 'maximumAward', 'totalFundingAvailable'].includes(field)) {
    return hasAmountChanged(existingValue, newValue);
  }
  
  // Handle date fields
  if (['openDate', 'closeDate'].includes(field)) {
    return hasDateChanged(existingValue, newValue);
  }
  
  // Handle status and other string fields
  return hasDirectValueChanged(existingValue, newValue);
}

/**
 * Checks if monetary amounts have changed significantly (>5% difference)
 * @param {number|null} existingAmount - Existing amount
 * @param {number|null} newAmount - New amount
 * @returns {boolean} - Whether amount has changed significantly
 */
function hasAmountChanged(existingAmount, newAmount) {
  // Handle null values
  if (existingAmount === null && newAmount === null) return false;
  if (existingAmount === null || newAmount === null) return true;
  
  // Convert to numbers
  const existing = parseFloat(existingAmount) || 0;
  const newVal = parseFloat(newAmount) || 0;
  
  // If both are zero, no change
  if (existing === 0 && newVal === 0) return false;
  
  // If one is zero and other isn't, that's a change
  if (existing === 0 || newVal === 0) return true;
  
  // Calculate percentage difference
  const percentageDiff = Math.abs((newVal - existing) / existing);
  
  // Consider significant if >5% change
  return percentageDiff > 0.05;
}

/**
 * Checks if dates have changed
 * @param {string|null} existingDate - Existing date
 * @param {string|null} newDate - New date
 * @returns {boolean} - Whether date has changed
 */
function hasDateChanged(existingDate, newDate) {
  // Handle null values
  if (existingDate === null && newDate === null) return false;
  if (existingDate === null || newDate === null) return true;
  
  // Normalize dates to YYYY-MM-DD format for comparison
  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return dateStr; // Return as-is if can't parse
    }
  };
  
  const existingNorm = normalizeDate(existingDate);
  const newNorm = normalizeDate(newDate);
  
  return existingNorm !== newNorm;
}

/**
 * Checks if string values have changed (case-insensitive)
 * @param {string|null} existingValue - Existing value
 * @param {string|null} newValue - New value
 * @returns {boolean} - Whether value has changed
 */
function hasDirectValueChanged(existingValue, newValue) {
  // Handle null values
  if (existingValue === null && newValue === null) return false;
  if (existingValue === null || newValue === null) return true;
  
  // Case-insensitive string comparison
  const existing = String(existingValue).toLowerCase().trim();
  const newVal = String(newValue).toLowerCase().trim();
  
  return existing !== newVal;
}

/**
 * Checks if description has changed significantly
 * @param {string|null} existingDescription - Existing description
 * @param {string|null} newDescription - New description
 * @returns {boolean} - Whether description has changed significantly
 */
function hasDescriptionChanged(existingDescription, newDescription) {
  // Handle null values
  if (!existingDescription && !newDescription) return false;
  if (!existingDescription || !newDescription) return true;
  
  // Normalize descriptions for comparison
  const normalize = (text) => text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const existingNorm = normalize(existingDescription);
  const newNorm = normalize(newDescription);
  
  // If exactly the same, no change
  if (existingNorm === newNorm) return false;
  
  // Calculate word-level similarity
  const existingWords = new Set(existingNorm.split(' ').filter(w => w.length > 3));
  const newWords = new Set(newNorm.split(' ').filter(w => w.length > 3));
  
  if (existingWords.size === 0 && newWords.size === 0) return false;
  if (existingWords.size === 0 || newWords.size === 0) return true;
  
  const intersection = new Set([...existingWords].filter(w => newWords.has(w)));
  const union = new Set([...existingWords, ...newWords]);
  
  const similarity = intersection.size / union.size;
  
  // Consider changed if less than 80% word similarity
  return similarity < 0.8;
}

/**
 * Gets a detailed change summary for logging
 * @param {Object} existing - Existing opportunity
 * @param {Object} opportunity - New opportunity data
 * @returns {Object} - Detailed change summary
 */
function getChangesSummary(existing, opportunity) {
  const changes = {};
  
  const fieldsToCheck = [
    'openDate',
    'closeDate',
    'status', 
    'minimumAward',
    'maximumAward',
    'totalFundingAvailable'
  ];
  
  for (const field of fieldsToCheck) {
    if (hasFieldChanged(existing, opportunity, field)) {
      changes[field] = {
        from: existing[field],
        to: opportunity[field]
      };
    }
  }
  
  if (hasDescriptionChanged(existing.description, opportunity.description)) {
    changes.description = {
      from: existing.description ? `${existing.description.substring(0, 100)}...` : null,
      to: opportunity.description ? `${opportunity.description.substring(0, 100)}...` : null
    };
  }
  
  return changes;
}

export const changeDetector = {
  detectMaterialChanges,
  hasFieldChanged,
  hasAmountChanged,
  hasDateChanged,
  hasDirectValueChanged,
  hasDescriptionChanged,
  getChangesSummary
}; 