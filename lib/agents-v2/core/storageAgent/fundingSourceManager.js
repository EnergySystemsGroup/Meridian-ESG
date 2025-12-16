/**
 * Funding Source Manager
 *
 * Handles creation and management of funding source records.
 * Prevents duplicate funding source information across opportunities.
 */

/**
 * Gets or creates a funding source record
 * @param {Object} opportunity - Opportunity data
 * @param {Object} source - API source data
 * @param {Object} client - Supabase client
 * @returns {Promise<string|null>} - Funding source ID
 */
async function getOrCreate(opportunity, source, client) {
  const sourceName = opportunity.funding_source?.name;

  if (!sourceName) {
    console.warn(`[FundingSourceManager] ⚠️ No funding source name for: ${opportunity.title}`);
    return null;
  }

  // Check if funding source already exists
  const existing = await findByName(sourceName, client);
  if (existing) {
    return await updateIfNeeded(existing, opportunity, source, client);
  }

  // Create new funding source
  return await create(opportunity, source, sourceName, client);
}

/**
 * Finds funding source by name
 * @param {string} name - Funding source name
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
  const fs = opportunity.funding_source;
  const updates = {};

  if (fs?.contact_email && !existing.contact_email) {
    updates.contact_email = fs.contact_email;
  }

  if (fs?.contact_phone && !existing.contact_phone) {
    updates.contact_phone = fs.contact_phone;
  }

  if (fs?.website && !existing.website) {
    updates.website = fs.website;
  }

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
 * @param {string} sourceName - Funding source name
 * @param {Object} client - Supabase client
 * @returns {Promise<string>} - New funding source ID
 */
async function create(opportunity, source, sourceName, client) {
  const fs = opportunity.funding_source;

  const fundingSourceData = {
    name: sourceName,
    type: categorizeSourceType(fs?.type || source.type, sourceName),
    website: fs?.website || source.website || null,
    contact_email: fs?.contact_email || null,
    contact_phone: fs?.contact_phone || null,
    description: fs?.description || `Funding opportunities from ${sourceName}`,
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

  console.log(`[FundingSourceManager] ✨ Created new funding source: ${sourceName}`);
  return inserted.id;
}

/**
 * Categorizes source type based on provided type and name
 * @param {string} sourceType - Source type
 * @param {string} sourceName - Funding source name
 * @returns {string} - Categorized type
 */
function categorizeSourceType(sourceType, sourceName) {
  // Use source type if available
  if (sourceType && sourceType !== 'unknown') {
    return sourceType;
  }
  
  // Categorize based on name patterns
  const name = sourceName.toLowerCase();
  
  // Check for state indicators first (more specific)
  if (name.includes('state') || name.includes('california') || name.includes('texas') ||
      name.includes('new york') || name.includes('florida')) {
    return 'State';
  }

  // Then check for federal indicators (but not generic "department of")
  if (name.includes('federal') || name.includes('u.s.') || name.includes('united states') ||
      name.includes('epa') || name.includes('doe') || name.includes('usda') ||
      name.includes('treasury')) {
    return 'Federal';
  }
  
  if (name.includes('county')) {
    return 'County';
  }

  if (name.includes('city') || name.includes('municipal')) {
    return 'Municipality';
  }
  
  if (name.includes('foundation') || name.includes('fund') || name.includes('trust')) {
    return 'Foundation';
  }

  if (name.includes('utility') || name.includes('electric') || name.includes('gas')) {
    return 'Utility';
  }
  
  // Default to Other for unknown types
  return 'Other';
}

export const fundingSourceManager = {
  getOrCreate,
  findByName,
  updateIfNeeded,
  create,
  categorizeSourceType
}; 