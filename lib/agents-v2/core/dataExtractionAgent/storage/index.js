/**
 * Storage Module
 * 
 * Handles storage of raw API responses with deduplication
 */

import { createSupabaseClient } from '@/utils/supabase.js';
import crypto from 'crypto';

/**
 * Stores raw API response in database with deduplication
 * @param {string} sourceId - The source ID
 * @param {Object} rawResponse - The raw API response data
 * @param {Object} requestDetails - Request details
 * @param {Object} metadata - Optional metadata with api_endpoint, call_type, execution_time_ms, opportunity_count
 */
export async function storeRawResponse(sourceId, rawResponse, requestDetails, metadata = {}) {
  const supabase = createSupabaseClient();
  
  try {
    // Generate content hash for deduplication using source configuration
    const contentHash = generateContentHash(rawResponse, requestDetails?.source);
    
    // Check for existing response with same hash
    const existingResponse = await checkForExistingResponse(supabase, sourceId, contentHash);
    
    if (existingResponse) {
      // UPDATE existing record with fresh metadata
      console.log(`[DataExtractionAgent] 🔄 Updating existing raw response: ${existingResponse.id}`);
      
      const { error: updateError } = await supabase
        .from('api_raw_responses')
        .update({
          last_seen_at: new Date().toISOString(),
          call_count: (existingResponse.call_count || 0) + 1,
          api_endpoint: metadata.api_endpoint || existingResponse.api_endpoint,
          call_type: metadata.call_type || existingResponse.call_type,
          execution_time_ms: metadata.execution_time_ms || existingResponse.execution_time_ms,
          opportunity_count: metadata.opportunity_count || existingResponse.opportunity_count,
          request_details: requestDetails
        })
        .eq('id', existingResponse.id);
      
      if (updateError) {
        console.error('[DataExtractionAgent] ❌ Error updating raw response:', updateError);
      } else {
        console.log(`[DataExtractionAgent] ✅ Updated raw response with fresh metadata`);
      }
      
      return existingResponse.id;
    }
    
    // Create new raw response record
    const rawResponseId = crypto.randomUUID ? crypto.randomUUID() : 'test-' + Math.random().toString(36).substring(2, 15);
    const currentTime = new Date().toISOString();
    
    const { error } = await supabase.from('api_raw_responses').insert({
      id: rawResponseId,
      api_source_id: sourceId,
      content: rawResponse,
      content_hash: contentHash,
      request_details: requestDetails,
      created_at: currentTime,
      last_seen_at: currentTime,
      call_count: 1,
      api_endpoint: metadata.api_endpoint || null,
      call_type: metadata.call_type || null,
      execution_time_ms: metadata.execution_time_ms || null,
      opportunity_count: metadata.opportunity_count || 0
    });
    
    if (error) {
      console.error('[DataExtractionAgent] ❌ Error storing raw response:', error);
    } else {
      console.log(`[DataExtractionAgent] 💾 Stored new raw response: ${rawResponseId}`);
    }
    
    return rawResponseId;
  } catch (error) {
    console.error('[DataExtractionAgent] ❌ Error in storeRawResponse:', error);
    // Return fallback ID even on error
    return crypto.randomUUID ? crypto.randomUUID() : 'test-' + Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Generate content hash for deduplication based on stable opportunity data fields
 * Excludes dynamic fields like timestamps, IDs, and request metadata
 */
function generateContentHash(rawResponse, source) {
  try {
    if (typeof rawResponse === 'object') {
      // Extract stable opportunity data fields for hashing
      const stableData = extractStableOpportunityData(rawResponse, source);
      
      // Handle both object and string stable data
      let hashContent;
      if (typeof stableData === 'object') {
        // Sort keys for consistent hashing
        const sortedKeys = Object.keys(stableData).sort();
        const sortedData = {};
        sortedKeys.forEach(key => {
          sortedData[key] = stableData[key];
        });
        hashContent = JSON.stringify(sortedData);
      } else {
        // Fallback string data
        hashContent = String(stableData);
      }
      
      return crypto
        .createHash('sha256')
        .update(hashContent)
        .digest('hex');
    } else {
      return crypto
        .createHash('sha256')
        .update(String(rawResponse))
        .digest('hex');
    }
  } catch (error) {
    console.error('[DataExtractionAgent] ❌ Error generating content hash:', error);
    return 'hash-error-' + Date.now();
  }
}

/**
 * Extract stable opportunity data for consistent hashing
 * Uses multiple fields for robust deduplication
 */
function extractStableOpportunityData(rawResponse, source) {
  try {
    const stableFields = {
      title: normalizeText(extractTitle(rawResponse, source)),
      description: normalizeText(extractDescription(rawResponse, source)?.substring(0, 200)),
      deadline: extractDeadline(rawResponse, source),
      amount: extractAmount(rawResponse, source),
      agency: normalizeText(extractAgency(rawResponse, source))
    };

    // Remove empty/null values
    const cleanedFields = Object.fromEntries(
      Object.entries(stableFields).filter(([, value]) => value && value.toString().trim())
    );

    // If no stable fields found, use a minimal hash of the raw response
    if (Object.keys(cleanedFields).length === 0) {
      return { fallback: JSON.stringify(rawResponse).substring(0, 1000) };
    }

    return cleanedFields;
    
  } catch (error) {
    console.error('[DataExtractionAgent] ❌ Error extracting stable opportunity data:', error);
    // Fallback to stringified response if extraction fails
    return { fallback: JSON.stringify(rawResponse).substring(0, 1000) };
  }
}

/**
 * Extract title from raw API response
 * Uses response_mapping configuration if available, otherwise falls back to common field names
 */
function extractTitle(rawResponse, source) {
  let titleField = 'title'; // Default field name
  
  // Check if source has response_mapping configuration
  if (source?.configurations?.response_mapping?.title) {
    titleField = source.configurations.response_mapping.title;
    console.log(`[DataExtractionAgent] 📍 Using configured title field: ${titleField}`);
    
    // Try to find the title using the configured field name
    const configuredTitle = findFieldValue(rawResponse, [titleField]);
    if (configuredTitle) {
      return normalizeText(configuredTitle);
    }
  }
  
  // Fallback to common field names if configured field not found or no configuration
  const titleFields = [
    'title', 'opportunityTitle', 'name', 'programTitle', 
    'fundingTitle', 'grantTitle', 'announcementTitle',
    'opportunityName', 'projectTitle'
  ];
  
  // Find title in the response
  const title = findFieldValue(rawResponse, titleFields);
  
  // Normalize text for consistent hashing
  return normalizeText(title);
}

/**
 * Extract description from raw API response
 */
function extractDescription(rawResponse, source) {
  // Check configured field first
  if (source?.configurations?.response_mapping?.description) {
    const configuredDesc = findFieldValue(rawResponse, [source.configurations.response_mapping.description]);
    if (configuredDesc) {
      return configuredDesc;
    }
  }
  
  // Common description field names
  const descriptionFields = [
    'description', 'summary', 'abstract', 'overview', 
    'details', 'synopsis', 'opportunityDescription',
    'programDescription', 'briefDescription', 'fullDescription'
  ];
  
  return findFieldValue(rawResponse, descriptionFields);
}

/**
 * Extract deadline/due date from raw API response
 */
function extractDeadline(rawResponse, source) {
  // Check configured field first
  if (source?.configurations?.response_mapping?.deadline) {
    const configuredDeadline = findFieldValue(rawResponse, [source.configurations.response_mapping.deadline]);
    if (configuredDeadline) {
      return normalizeDate(configuredDeadline);
    }
  }
  
  // Common deadline field names
  const deadlineFields = [
    'deadline', 'dueDate', 'applicationDeadline', 'submissionDeadline',
    'closeDate', 'endDate', 'expirationDate', 'applicationDueDate',
    'proposalDeadline', 'closingDate'
  ];
  
  const deadline = findFieldValue(rawResponse, deadlineFields);
  return normalizeDate(deadline);
}

/**
 * Extract funding amount from raw API response
 */
function extractAmount(rawResponse, source) {
  // Check configured field first
  if (source?.configurations?.response_mapping?.amount) {
    const configuredAmount = findFieldValue(rawResponse, [source.configurations.response_mapping.amount]);
    if (configuredAmount) {
      return normalizeAmount(configuredAmount);
    }
  }
  
  // Common amount field names
  const amountFields = [
    'amount', 'fundingAmount', 'totalFunding', 'maxAmount',
    'awardAmount', 'grantAmount', 'budget', 'value',
    'estimatedTotalProgram', 'ceiling', 'floor'
  ];
  
  const amount = findFieldValue(rawResponse, amountFields);
  return normalizeAmount(amount);
}

/**
 * Extract agency/source from raw API response
 */
function extractAgency(rawResponse, source) {
  // Check configured field first
  if (source?.configurations?.response_mapping?.agency) {
    const configuredAgency = findFieldValue(rawResponse, [source.configurations.response_mapping.agency]);
    if (configuredAgency) {
      return configuredAgency;
    }
  }
  
  // Common agency field names
  const agencyFields = [
    'agency', 'organization', 'sponsor', 'fundingOrganization',
    'agencyName', 'department', 'office', 'bureau',
    'fundingAgency', 'sponsoringAgency', 'grantor'
  ];
  
  return findFieldValue(rawResponse, agencyFields);
}

/**
 * Find a field value by checking multiple possible field names
 * Recursively searches through nested objects
 */
function findFieldValue(obj, fieldNames) {
  if (typeof obj !== 'object' || obj === null) {
    return '';
  }
  
  // Check direct field matches first
  for (const fieldName of fieldNames) {
    if (obj[fieldName] && typeof obj[fieldName] === 'string') {
      return obj[fieldName];
    }
  }
  
  // Check nested objects (like data.opportunityTitle)
  for (const [, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      const nestedResult = findFieldValue(value, fieldNames);
      if (nestedResult) {
        return nestedResult;
      }
    }
  }
  
  // No special handling needed for title-only approach
  
  return '';
}

/**
 * Normalize text for consistent comparison
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, ' ') // Clean up any double spaces
    .trim();
}

/**
 * Normalize date for consistent comparison
 */
function normalizeDate(dateValue) {
  if (!dateValue) {
    return '';
  }
  
  try {
    // Handle various date formats
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return String(dateValue).trim();
    }
    
    // Return ISO date string (YYYY-MM-DD)
    return date.toISOString().split('T')[0];
  } catch (error) {
    return String(dateValue).trim();
  }
}

/**
 * Normalize amount/funding values for consistent comparison
 */
function normalizeAmount(amount) {
  if (!amount) {
    return '';
  }
  
  try {
    // Extract numeric value from string if needed
    const numericMatch = String(amount).match(/[\d,]+\.?\d*/);
    if (numericMatch) {
      const numericValue = parseFloat(numericMatch[0].replace(/,/g, ''));
      if (!isNaN(numericValue)) {
        return Math.round(numericValue).toString(); // Round to avoid floating point issues
      }
    }
    
    // Fallback to string normalization
    return String(amount)
      .toLowerCase()
      .replace(/[^\w\d]/g, '')
      .trim();
  } catch (error) {
    return String(amount).trim();
  }
}

/**
 * Check for existing response with same content hash
 * Returns full record for update operations
 */
async function checkForExistingResponse(supabase, sourceId, contentHash) {
  try {
    const { data: existingResponse, error } = await supabase
      .from('api_raw_responses')
      .select('id, call_count, api_endpoint, call_type, execution_time_ms, opportunity_count')
      .eq('api_source_id', sourceId)
      .eq('content_hash', contentHash)
      .limit(1);
    
    if (error) {
      console.error('[DataExtractionAgent] ❌ Error checking for existing response:', error);
      return null;
    }
    
    return existingResponse && existingResponse.length > 0 ? existingResponse[0] : null;
  } catch (error) {
    console.error('[DataExtractionAgent] ❌ Error in checkForExistingResponse:', error);
    return null;
  }
} 