/**
 * Duplicate Detector
 * 
 * Finds existing opportunities using ID-based and title-based matching.
 * Handles APIs that change IDs but keep consistent titles.
 */

/**
 * Finds existing opportunity by ID or title matching
 * @param {Object} opportunity - Opportunity to search for
 * @param {string} sourceId - API source ID
 * @param {Object} client - Supabase client
 * @returns {Promise<Object|null>} - Existing opportunity or null
 */
async function findExisting(opportunity, sourceId, client) {
  // First try by opportunity ID (most reliable)
  const existingById = await findByOpportunityId(opportunity.id, sourceId, client);
  if (existingById) {
    return existingById;
  }
  
  // Fall back to title matching (for APIs that change IDs)
  if (opportunity.title) {
    const existingByTitle = await findByTitle(opportunity.title, sourceId, client);
    if (existingByTitle) {
      return existingByTitle;
    }
  }
  
  return null;
}

/**
 * Finds opportunity by opportunity ID
 * @param {string} opportunityId - Opportunity ID from API
 * @param {string} sourceId - API source ID
 * @param {Object} client - Supabase client
 * @returns {Promise<Object|null>} - Existing opportunity or null
 */
async function findByOpportunityId(opportunityId, sourceId, client) {
  if (!opportunityId) {
    return null;
  }
  
  const { data: existing } = await client
    .from('funding_opportunities')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .eq('api_source_id', sourceId)
    .maybeSingle();
  
  if (existing) {
    console.log(`[DuplicateDetector] 🔍 Found existing opportunity by ID: ${opportunityId}`);
  }
  
  return existing;
}

/**
 * Finds opportunity by title matching
 * @param {string} title - Opportunity title
 * @param {string} sourceId - API source ID
 * @param {Object} client - Supabase client
 * @returns {Promise<Object|null>} - Existing opportunity or null
 */
async function findByTitle(title, sourceId, client) {
  if (!title || title.trim().length < 10) {
    return null; // Skip very short titles that might match incorrectly
  }
  
  const { data: existing } = await client
    .from('funding_opportunities')
    .select('*')
    .eq('title', title.trim())
    .eq('api_source_id', sourceId)
    .maybeSingle();
  
  if (existing) {
    console.log(`[DuplicateDetector] 🔍 Found existing opportunity by title: ${title}`);
  }
  
  return existing;
}

/**
 * Finds opportunities with similar titles (fuzzy matching)
 * @param {string} title - Opportunity title
 * @param {string} sourceId - API source ID
 * @param {Object} client - Supabase client
 * @returns {Promise<Array>} - Array of similar opportunities
 */
async function findSimilarByTitle(title, sourceId, client) {
  if (!title || title.trim().length < 10) {
    return [];
  }
  
  // Extract key words from title (longer than 3 characters)
  const keywords = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 5); // Use first 5 keywords
  
  if (keywords.length === 0) {
    return [];
  }
  
  // Search for opportunities containing most of the keywords
  const searchPattern = keywords.join('|');
  
  const { data: similar } = await client
    .from('funding_opportunities')
    .select('*')
    .eq('api_source_id', sourceId)
    .textSearch('title', searchPattern)
    .limit(10);
  
  return similar || [];
}

/**
 * Checks if two titles are likely the same opportunity
 * @param {string} title1 - First title
 * @param {string} title2 - Second title
 * @returns {boolean} - Whether titles are likely the same
 */
function titlesAreSimilar(title1, title2) {
  if (!title1 || !title2) return false;
  
  // Exact match
  if (title1.trim() === title2.trim()) return true;
  
  // Normalize titles for comparison
  const normalize = (str) => str.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const norm1 = normalize(title1);
  const norm2 = normalize(title2);
  
  // Check if one title contains the other (accounting for year variations)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true;
  }
  
  // Calculate word overlap
  const words1 = new Set(norm1.split(' ').filter(w => w.length > 3));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return false;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  // Consider similar if 70% word overlap
  const similarity = intersection.size / union.size;
  return similarity >= 0.7;
}

export const duplicateDetector = {
  findExisting,
  findByOpportunityId,
  findByTitle,
  findSimilarByTitle,
  titlesAreSimilar
}; 