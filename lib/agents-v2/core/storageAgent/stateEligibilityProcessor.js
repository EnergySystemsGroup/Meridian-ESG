/**
 * State Eligibility Processor
 *
 * @deprecated This module is scheduled for deprecation. DO NOT use for any new analysis.
 *
 * This processor populates the `opportunity_state_eligibility` junction table which has
 * known bugs (substring matching in locationParsing.js causes false positives like
 * "territory" matching Oregon/Rhode Island).
 *
 * It is ONLY being kept temporarily because the map feature still reads from this table.
 * Once the map is updated to use `opportunity_coverage_areas` (populated by
 * linkOpportunityToCoverageAreas in locationMatcher.js), this module should be removed.
 *
 * For geographic filtering, use `opportunity_coverage_areas` table instead.
 *
 * Handles location parsing and state eligibility processing.
 * Maps regions to individual states and creates eligibility records.
 */

import { locationParsing } from './utils/locationParsing.js';

/**
 * Processes state eligibility for a new opportunity
 * @param {string} opportunityId - Opportunity ID
 * @param {Object} opportunity - Opportunity data
 * @param {Object} client - Supabase client
 * @returns {Promise<Object>} - Processing results
 */
async function processEligibility(opportunityId, opportunity, client) {
  // Handle null or undefined opportunity data
  if (!opportunity) {
    console.log(`[StateEligibilityProcessor] ⚠️ No opportunity data for: ${opportunityId}`);
    return { stateCount: 0, isNational: false };
  }
  
  // Handle national opportunities
  if (opportunity.isNational) {
    console.log(`[StateEligibilityProcessor] 🌍 National opportunity: ${opportunityId}`);
    return { stateCount: 0, isNational: true };
  }
  
  // Parse locations to state codes
  const stateCodes = await parseLocationsToStateCodes(opportunity.eligibleLocations || []);
  
  if (stateCodes.length === 0) {
    console.log(`[StateEligibilityProcessor] ⚠️ No valid states found for: ${opportunityId}`);
    return { stateCount: 0, isNational: false };
  }
  
  // Create eligibility records
  await createEligibilityRecords(opportunityId, stateCodes, client);
  
  console.log(`[StateEligibilityProcessor] 📍 Created eligibility for ${stateCodes.length} states`);
  return { stateCount: stateCodes.length, isNational: false };
}

/**
 * Updates state eligibility for an existing opportunity
 * @param {string} opportunityId - Opportunity ID
 * @param {Object} opportunity - Opportunity data
 * @param {Object} client - Supabase client
 * @returns {Promise<Object>} - Processing results
 */
async function updateEligibility(opportunityId, opportunity, client) {
  // Clear existing eligibility records
  await clearExistingEligibility(opportunityId, client);
  
  // Process new eligibility
  return await processEligibility(opportunityId, opportunity, client);
}

/**
 * Parses location strings to state codes
 * @param {Array} eligibleLocations - Array of location strings
 * @returns {Promise<Array>} - Array of state codes
 */
async function parseLocationsToStateCodes(eligibleLocations) {
  if (!Array.isArray(eligibleLocations) || eligibleLocations.length === 0) {
    return [];
  }
  
  const stateCodesSet = new Set();
  
  for (const location of eligibleLocations) {
    if (!location || typeof location !== 'string') continue;
    
    const locationStr = location.trim();
    if (locationStr.length === 0) continue;
    
    // Parse location to state codes
    const codes = locationParsing.parseLocationToStateCodes(locationStr);
    codes.forEach(code => stateCodesSet.add(code));
  }
  
  return Array.from(stateCodesSet).sort();
}

/**
 * Creates eligibility records for state codes
 * @param {string} opportunityId - Opportunity ID
 * @param {Array} stateCodes - Array of state codes
 * @param {Object} client - Supabase client
 */
async function createEligibilityRecords(opportunityId, stateCodes, client) {
  if (stateCodes.length === 0) return;
  
  // Get state IDs from codes
  const { data: states } = await client
    .from('states')
    .select('id, code')
    .in('code', stateCodes);
  
  if (!states || states.length === 0) {
    console.warn(`[StateEligibilityProcessor] ⚠️ No states found for codes: ${stateCodes.join(', ')}`);
    return;
  }
  
  // Create eligibility records
  const eligibilityRecords = states.map(state => ({
    opportunity_id: opportunityId,
    state_id: state.id,
    created_at: new Date().toISOString()
  }));
  
  const { error } = await client
    .from('opportunity_state_eligibility')
    .insert(eligibilityRecords);
  
  if (error) {
    console.error(`[StateEligibilityProcessor] ❌ Error creating eligibility records:`, error);
    throw error;
  }
  
  console.log(`[StateEligibilityProcessor] ✅ Created ${eligibilityRecords.length} eligibility records`);
}

/**
 * Clears existing eligibility records for an opportunity
 * @param {string} opportunityId - Opportunity ID
 * @param {Object} client - Supabase client
 */
async function clearExistingEligibility(opportunityId, client) {
  const { error } = await client
    .from('opportunity_state_eligibility')
    .delete()
    .eq('opportunity_id', opportunityId);
  
  if (error) {
    console.error(`[StateEligibilityProcessor] ❌ Error clearing existing eligibility:`, error);
    throw error;
  }
  
  console.log(`[StateEligibilityProcessor] 🧹 Cleared existing eligibility for: ${opportunityId}`);
}

/**
 * Gets eligible states for an opportunity
 * @param {string} opportunityId - Opportunity ID
 * @param {Object} client - Supabase client
 * @returns {Promise<Array>} - Array of state objects
 */
async function getEligibleStates(opportunityId, client) {
  const { data: eligibility } = await client
    .from('opportunity_state_eligibility')
    .select(`
      state_id,
      states (
        id,
        code,
        name,
        abbreviation
      )
    `)
    .eq('opportunity_id', opportunityId);
  
  if (!eligibility) return [];
  
  return eligibility.map(record => record.states);
}

/**
 * Validates state eligibility data
 * @param {string} opportunityId - Opportunity ID
 * @param {Object} client - Supabase client
 * @returns {Promise<Object>} - Validation results
 */
async function validateEligibility(opportunityId, client) {
  const { data: opportunity } = await client
    .from('funding_opportunities')
    .select('is_national, title')
    .eq('id', opportunityId)
    .single();
  
  if (!opportunity) {
    return { isValid: false, error: 'Opportunity not found' };
  }
  
  const eligibleStates = await getEligibleStates(opportunityId, client);
  
  // National opportunities should have no state eligibility records
  if (opportunity.is_national && eligibleStates.length > 0) {
    return {
      isValid: false,
      error: 'National opportunity should not have state eligibility records'
    };
  }
  
  // Non-national opportunities should have at least one state
  if (!opportunity.is_national && eligibleStates.length === 0) {
    return {
      isValid: false,
      error: 'Non-national opportunity should have at least one eligible state'
    };
  }
  
  return {
    isValid: true,
    stateCount: eligibleStates.length,
    isNational: opportunity.is_national
  };
}

export const stateEligibilityProcessor = {
  processEligibility,
  updateEligibility,
  parseLocationsToStateCodes,
  createEligibilityRecords,
  clearExistingEligibility,
  getEligibleStates,
  validateEligibility
}; 