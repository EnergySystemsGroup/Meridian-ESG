/**
 * Storage Module
 * 
 * Handles storage of raw API responses with deduplication
 */

import { createSupabaseClient } from '../../../../supabase.js';
import crypto from 'crypto';

/**
 * Stores raw API response in database with deduplication
 */
export async function storeRawResponse(sourceId, rawResponse, requestDetails) {
  const supabase = createSupabaseClient();
  
  try {
    // Generate content hash for deduplication
    const contentHash = generateContentHash(rawResponse);
    
    // Check for existing response with same hash
    const existingResponseId = await checkForExistingResponse(supabase, sourceId, contentHash);
    if (existingResponseId) {
      console.log(`[DataExtractionAgent] 📄 Reusing existing raw response: ${existingResponseId}`);
      return existingResponseId;
    }
    
    // Create new raw response record
    const rawResponseId = crypto.randomUUID ? crypto.randomUUID() : 'test-' + Math.random().toString(36).substring(2, 15);
    
    const { error } = await supabase.from('api_raw_responses').insert({
      id: rawResponseId,
      source_id: sourceId,
      content: rawResponse,
      content_hash: contentHash,
      request_details: requestDetails,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    
    if (error) {
      console.error('[DataExtractionAgent] ❌ Error storing raw response:', error);
    } else {
      console.log(`[DataExtractionAgent] 💾 Stored raw response: ${rawResponseId}`);
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
 */
async function checkForExistingResponse(supabase, sourceId, contentHash) {
  try {
    const { data: existingResponse, error } = await supabase
      .from('api_raw_responses')
      .select('id')
      .eq('source_id', sourceId)
      .eq('content_hash', contentHash)
      .limit(1);
    
    if (error) {
      console.error('[DataExtractionAgent] ❌ Error checking for existing response:', error);
      return null;
    }
    
    return existingResponse && existingResponse.length > 0 ? existingResponse[0].id : null;
  } catch (error) {
    console.error('[DataExtractionAgent] ❌ Error in checkForExistingResponse:', error);
    return null;
  }
} 