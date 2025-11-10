/**
 * Fuzzy Location Matcher
 *
 * Matches location strings extracted by the LLM to coverage_area IDs in the database.
 * Handles utilities, counties, states, and national coverage with confidence scoring.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Normalize location text for matching
 */
function normalizeLocation(text) {
  if (!text) return '';

  return text
    .toLowerCase()
    .trim()
    // Remove common suffixes/prefixes
    .replace(/^(the|city of|county of)\s+/i, '')
    .replace(/\s+(territory|service area|service territory|customers|area)$/i, '')
    // Normalize punctuation
    .replace(/&/g, 'and')
    .replace(/[.,]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ');
}

/**
 * Calculate Levenshtein distance for fuzzy string matching
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) based on Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  const normalized1 = normalizeLocation(str1);
  const normalized2 = normalizeLocation(str2);

  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) return 1.0;

  const distance = levenshteinDistance(normalized1, normalized2);
  return 1.0 - (distance / maxLength);
}

/**
 * Detect location type from text patterns
 */
function detectLocationType(text) {
  const normalized = normalizeLocation(text);

  // Check for national indicators (match both input and DB naming)
  if (/^(national|nationwide|all states|united states)/.test(normalized)) {
    return 'national';
  }

  // Check for utility indicators
  if (
    /utility|power|electric|energy|water|gas|district|edison/.test(normalized) ||
    /(territory|service area|customers)$/.test(normalized) ||
    /pg&?e|sce|sdg&?e|smud|ladwp/i.test(text)
  ) {
    return 'utility';
  }

  // Check for county
  if (/county/.test(normalized)) {
    return 'county';
  }

  // Check for city/municipality
  if (/city|municipality|town/.test(normalized)) {
    return 'city';
  }

  // Default to state
  return 'state';
}

/**
 * Fuzzy match a single location string to coverage areas
 *
 * @param {string} locationText - The location string to match
 * @returns {Promise<Object>} Match result with coverage_area_id, confidence, and metadata
 */
export async function fuzzyMatchLocation(locationText) {
  if (!locationText || typeof locationText !== 'string') {
    return {
      success: false,
      error: 'Invalid location text',
      confidence: 0
    };
  }

  const locationType = detectLocationType(locationText);

  try {
    // Strategy 1: Exact match
    const { data: exactMatches, error: exactError } = await supabase
      .from('coverage_areas')
      .select('*')
      .ilike('name', locationText)
      .eq('kind', locationType);

    if (exactError) throw exactError;

    if (exactMatches && exactMatches.length > 0) {
      return {
        success: true,
        coverage_area_id: exactMatches[0].id,
        name: exactMatches[0].name,
        kind: exactMatches[0].kind,
        code: exactMatches[0].code,
        confidence: 1.0,
        match_type: 'exact',
        original_text: locationText
      };
    }

    // Strategy 1.5: Handle national - there's only one national coverage area
    if (locationType === 'national') {
      const { data: nationalMatches, error: nationalError } = await supabase
        .from('coverage_areas')
        .select('*')
        .eq('kind', 'national')
        .limit(1);

      if (nationalError) throw nationalError;

      if (nationalMatches && nationalMatches.length > 0) {
        return {
          success: true,
          coverage_area_id: nationalMatches[0].id,
          name: nationalMatches[0].name,
          kind: nationalMatches[0].kind,
          code: nationalMatches[0].code,
          confidence: 0.95,
          match_type: 'national',
          original_text: locationText
        };
      }
    }

    // Strategy 2: Fuzzy matching on both name and code fields
    const { data: candidates, error: candidatesError } = await supabase
      .from('coverage_areas')
      .select('*')
      .eq('kind', locationType);

    if (candidatesError) throw candidatesError;

    if (candidates && candidates.length > 0) {
      let bestMatch = null;
      let bestScore = 0;

      for (const candidate of candidates) {
        // Calculate similarity against both name and code fields
        const nameSimilarity = calculateSimilarity(locationText, candidate.name);
        const codeSimilarity = candidate.code
          ? calculateSimilarity(locationText, candidate.code)
          : 0;

        // Take the better of the two scores
        const similarity = Math.max(nameSimilarity, codeSimilarity);

        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = candidate;
        }
      }

      // Only return fuzzy matches with ≥70% confidence
      if (bestScore >= 0.7) {
        return {
          success: true,
          coverage_area_id: bestMatch.id,
          name: bestMatch.name,
          kind: bestMatch.kind,
          code: bestMatch.code,
          confidence: bestScore,
          match_type: bestScore === 1.0 ? 'exact' : 'fuzzy',
          original_text: locationText
        };
      }
    }

    // No match found
    return {
      success: false,
      error: 'No matching coverage area found',
      confidence: 0,
      original_text: locationText,
      detected_type: locationType,
      suggestions: candidates?.slice(0, 3).map(c => c.name) || []
    };

  } catch (error) {
    console.error('Error in fuzzyMatchLocation:', error);
    return {
      success: false,
      error: error.message,
      confidence: 0,
      original_text: locationText
    };
  }
}

/**
 * Match multiple locations for an opportunity
 *
 * @param {string[]} locationTexts - Array of location strings
 * @returns {Promise<Object>} Results with matches and unmatched locations
 */
export async function matchOpportunityLocations(locationTexts) {
  if (!Array.isArray(locationTexts)) {
    return {
      success: false,
      error: 'locationTexts must be an array'
    };
  }

  const matches = [];
  const unmatched = [];
  const lowConfidence = [];

  for (const locationText of locationTexts) {
    const result = await fuzzyMatchLocation(locationText);

    if (result.success) {
      if (result.confidence >= 0.7) {
        matches.push(result);
      } else {
        lowConfidence.push(result);
      }
    } else {
      unmatched.push({
        text: locationText,
        reason: result.error,
        detected_type: result.detected_type,
        suggestions: result.suggestions
      });
    }
  }

  return {
    success: true,
    total: locationTexts.length,
    matched: matches.length,
    unmatched: unmatched.length,
    low_confidence: lowConfidence.length,
    matches,
    unmatched_locations: unmatched,
    low_confidence_matches: lowConfidence
  };
}

/**
 * Link opportunity to coverage areas in the junction table
 *
 * @param {string} opportunityId - UUID of the opportunity
 * @param {string[]} locationTexts - Array of location strings to match
 * @returns {Promise<Object>} Results with linked coverage areas
 */
export async function linkOpportunityToCoverageAreas(opportunityId, locationTexts) {
  if (!opportunityId) {
    return {
      success: false,
      error: 'opportunityId is required'
    };
  }

  // Match all locations
  const matchResults = await matchOpportunityLocations(locationTexts);

  if (!matchResults.success) {
    return matchResults;
  }

  // Insert into junction table (using high-confidence matches only)
  const insertPromises = matchResults.matches
    .filter(m => m.confidence >= 0.7)
    .map(match =>
      supabase
        .from('opportunity_coverage_areas')
        .insert({
          opportunity_id: opportunityId,
          coverage_area_id: match.coverage_area_id
        })
        .select()
    );

  try {
    const results = await Promise.all(insertPromises);
    const errors = results.filter(r => r.error);

    return {
      success: errors.length === 0,
      opportunity_id: opportunityId,
      linked_count: results.length - errors.length,
      match_summary: matchResults,
      errors: errors.length > 0 ? errors.map(r => r.error) : undefined
    };

  } catch (error) {
    console.error('Error linking opportunity to coverage areas:', error);
    return {
      success: false,
      error: error.message,
      opportunity_id: opportunityId
    };
  }
}

export default {
  fuzzyMatchLocation,
  matchOpportunityLocations,
  linkOpportunityToCoverageAreas
};
