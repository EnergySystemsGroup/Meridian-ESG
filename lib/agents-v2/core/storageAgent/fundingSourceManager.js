/**
 * Funding Source Manager
 * 
 * Handles creation and management of funding source records.
 * Prevents duplicate agency information across opportunities.
 */

/**
 * Gets or creates a funding source record
 * @param {Object} opportunity - Opportunity data
 * @param {Object} source - API source data
 * @param {Object} client - Supabase client
 * @returns {Promise<string|null>} - Funding source ID
 */
async function getOrCreate(opportunity, source, client) {
  // Extract funding source info from opportunity or use source defaults
  const agencyName = opportunity.agencyName || 
                    opportunity.fundingAgency || 
                    source.name || 
                    'Unknown Agency';
  
  if (!agencyName || agencyName === 'Unknown Agency') {
    return null; // No funding source to create
  }
  
  // Check if funding source already exists
  const existing = await findByName(agencyName, client);
  if (existing) {
    return await updateIfNeeded(existing, opportunity, source, client);
  }
  
  // Create new funding source
  return await create(opportunity, source, agencyName, client);
}

/**
 * Finds funding source by name
 * @param {string} name - Agency name
 * @param {Object} client - Supabase client
 * @returns {Promise<Object|null>} - Existing funding source or null
 */
async function findByName(name, client) {
  const { data: existing } = await client
    .from('funding_sources')
    .select('*')
    .eq('name', name)
    .maybeSingle();
  
  return existing;
}

/**
 * Updates funding source if new information is available
 * @param {Object} existing - Existing funding source record
 * @param {Object} opportunity - Opportunity data
 * @param {Object} source - API source data
 * @param {Object} client - Supabase client
 * @returns {Promise<string>} - Funding source ID
 */
async function updateIfNeeded(existing, opportunity, source, client) {
  const updates = {};
  
  // Check for new contact information
  if (opportunity.agencyEmail && !existing.contact_email) {
    updates.contact_email = opportunity.agencyEmail;
  }
  
  if (opportunity.agencyPhone && !existing.contact_phone) {
    updates.contact_phone = opportunity.agencyPhone;
  }
  
  if (opportunity.agencyWebsite && !existing.website) {
    updates.website = opportunity.agencyWebsite;
  } else if (source.website && !existing.website) {
    updates.website = source.website;
  }
  
  // Update if we have new information
  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
    
    const { error } = await client
      .from('funding_sources')
      .update(updates)
      .eq('id', existing.id);
    
    if (error) {
      console.error(`[FundingSourceManager] ❌ Error updating funding source:`, error);
    } else {
      console.log(`[FundingSourceManager] 📝 Updated funding source: ${existing.name}`);
    }
  }
  
  return existing.id;
}

/**
 * Creates a new funding source
 * @param {Object} opportunity - Opportunity data
 * @param {Object} source - API source data
 * @param {string} agencyName - Agency name
 * @param {Object} client - Supabase client
 * @returns {Promise<string>} - New funding source ID
 */
async function create(opportunity, source, agencyName, client) {
  const fundingSourceData = {
    name: agencyName,
    type: categorizeAgencyType(source.type, agencyName),
    website: opportunity.agencyWebsite || source.website || null,
    contact_email: opportunity.agencyEmail || null,
    contact_phone: opportunity.agencyPhone || null,
    description: `Funding opportunities from ${agencyName}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { data: inserted, error } = await client
    .from('funding_sources')
    .insert(fundingSourceData)
    .select('id')
    .single();
  
  if (error) {
    console.error(`[FundingSourceManager] ❌ Error creating funding source:`, error);
    return null;
  }
  
  console.log(`[FundingSourceManager] ✨ Created new funding source: ${agencyName}`);
  return inserted.id;
}

/**
 * Categorizes agency type based on source and name
 * @param {string} sourceType - Source type
 * @param {string} agencyName - Agency name
 * @returns {string} - Categorized type
 */
function categorizeAgencyType(sourceType, agencyName) {
  // Use source type if available
  if (sourceType && sourceType !== 'unknown') {
    return sourceType;
  }
  
  // Categorize based on agency name patterns
  const name = agencyName.toLowerCase();
  
  if (name.includes('federal') || name.includes('department of') || name.includes('epa') || 
      name.includes('doe') || name.includes('usda') || name.includes('treasury')) {
    return 'federal';
  }
  
  if (name.includes('state') || name.includes('california') || name.includes('texas') || 
      name.includes('new york') || name.includes('florida')) {
    return 'state';
  }
  
  if (name.includes('county') || name.includes('city') || name.includes('municipal')) {
    return 'local';
  }
  
  if (name.includes('foundation') || name.includes('fund') || name.includes('trust')) {
    return 'foundation';
  }
  
  if (name.includes('utility') || name.includes('electric') || name.includes('gas')) {
    return 'utility';
  }
  
  // Default to government for unknown types
  return 'government';
}

export const fundingSourceManager = {
  getOrCreate,
  findByName,
  updateIfNeeded,
  create,
  categorizeAgencyType
}; 