/**
 * Storage Module
 * 
 * Handles storage of raw API responses with deduplication
 */

import { createSupabaseClient } from '../../../../supabase.js';
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
    // Generate content hash for deduplication
    const contentHash = generateContentHash(rawResponse);
    
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
          request_details: requestDetails,
          timestamp: new Date().toISOString()
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
      source_id: sourceId,
      content: rawResponse,
      content_hash: contentHash,
      request_details: requestDetails,
      timestamp: currentTime,
      created_at: currentTime,
      first_seen_at: currentTime,
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
 * Generate content hash for deduplication
 */
function generateContentHash(rawResponse) {
  try {
    if (typeof rawResponse === 'object') {
      const normalizedContent = JSON.stringify(
        rawResponse,
        Object.keys(rawResponse).sort()
      );
      return crypto
        .createHash('sha256')
        .update(normalizedContent)
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
 * Check for existing response with same content hash
 * Returns full record for update operations
 */
async function checkForExistingResponse(supabase, sourceId, contentHash) {
  try {
    const { data: existingResponse, error } = await supabase
      .from('api_raw_responses')
      .select('id, call_count, api_endpoint, call_type, execution_time_ms, opportunity_count')
      .eq('source_id', sourceId)
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