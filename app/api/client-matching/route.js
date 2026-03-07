/**
 * Client-Opportunity Matching API
 *
 * Reads pre-computed matches from the client_matches table (populated by
 * the background match computation job). JOINs funding_opportunities for
 * full opportunity details.
 *
 * Much faster than the previous approach which recomputed matches from
 * scratch on every request using O(n*m) evaluateMatch() calls.
 */

import { createClient } from '@supabase/supabase-js';
import { getFilteredClientIds } from '@/lib/utils/clientFiltering';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

/**
 * Transform a raw client_matches row (with joined opportunity) into the
 * response shape the frontend expects.
 */
function transformMatch(row) {
  const opp = row.opportunity;
  return {
    ...opp,
    source_type: opp.funding_sources?.type || null,
    funding_sources: undefined,
    score: row.score,
    matchDetails: row.match_details,
    is_new: row.is_new,
    first_matched_at: row.first_matched_at,
    last_matched_at: row.last_matched_at
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    console.log(`[ClientMatching] Reading persisted matches${clientId ? ` for client: ${clientId}` : ' for all clients'}`);

    if (clientId) {
      return handleSingleClient(clientId);
    }

    // Resolve user-based filtering for all-clients mode
    const { clientIds } = await getFilteredClientIds(supabase, request);
    return handleAllClients(clientIds);
  } catch (error) {
    console.error('[ClientMatching] API error:', error);
    return Response.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Single-client mode: returns matches for one client.
 */
async function handleSingleClient(clientId) {
  // 1. Fetch the client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    console.error('[ClientMatching] Error fetching client:', clientError);
    return Response.json({ error: 'Client not found' }, { status: 404 });
  }

  // 2. Fetch hidden opportunity IDs for this client
  const { data: hiddenRows, error: hiddenError } = await supabase
    .from('hidden_matches')
    .select('opportunity_id')
    .eq('client_id', clientId)
    .limit(10000);

  if (hiddenError) {
    console.error('[ClientMatching] Error fetching hidden matches:', hiddenError);
  }

  const hiddenIds = new Set((hiddenRows || []).map(h => h.opportunity_id));

  // 3. Query persisted matches with opportunity details
  const { data: matchRows, error: matchError } = await supabase
    .from('client_matches')
    .select(`
      score, match_details, is_new, first_matched_at, last_matched_at,
      opportunity:funding_opportunities!inner(
        *, funding_sources(type)
      )
    `)
    .eq('client_id', clientId)
    .eq('is_stale', false)
    .limit(10000);

  if (matchError) {
    console.error('[ClientMatching] Error fetching matches:', matchError);
    return Response.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }

  // 4. Filter hidden and transform
  const matches = (matchRows || [])
    .filter(row => !hiddenIds.has(row.opportunity.id))
    .map(transformMatch)
    .sort((a, b) => b.score - a.score);

  const result = {
    client,
    matches,
    matchCount: matches.length,
    hiddenCount: hiddenIds.size,
    topMatches: matches.slice(0, 3)
  };

  console.log(`[ClientMatching] Found ${matches.length} matches for ${client.name}`);

  return Response.json({
    success: true,
    results: result,
    timestamp: new Date().toISOString()
  });
}

/**
 * All-clients mode: returns matches grouped by client.
 */
async function handleAllClients(clientIds = null) {
  // 1. Fetch clients (filtered if clientIds provided)
  if (clientIds !== null && clientIds.length === 0) {
    return Response.json({
      success: true,
      results: {},
      timestamp: new Date().toISOString()
    });
  }

  let clientQuery = supabase.from('clients').select('*');
  if (clientIds !== null) {
    clientQuery = clientQuery.in('id', clientIds);
  }
  const { data: clients, error: clientError } = await clientQuery;

  if (clientError) {
    console.error('[ClientMatching] Error fetching clients:', clientError);
    return Response.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }

  if (!clients || clients.length === 0) {
    return Response.json({ error: 'No clients found' }, { status: 404 });
  }

  // 2. Fetch non-stale matches with opportunity details (filtered if applicable)
  let matchQuery = supabase
    .from('client_matches')
    .select(`
      client_id, score, match_details, is_new, first_matched_at, last_matched_at,
      opportunity:funding_opportunities!inner(
        *, funding_sources(type)
      )
    `)
    .eq('is_stale', false)
    .limit(10000);

  if (clientIds !== null) {
    matchQuery = matchQuery.in('client_id', clientIds);
  }
  const { data: matchRows, error: matchError } = await matchQuery;

  if (matchError) {
    console.error('[ClientMatching] Error fetching matches:', matchError);
    return Response.json({ error: 'Failed to fetch matches' }, { status: 500 });
  }

  // 3. Batch-fetch hidden matches (filtered if applicable)
  let hiddenQuery = supabase
    .from('hidden_matches')
    .select('client_id, opportunity_id')
    .limit(10000);

  if (clientIds !== null) {
    hiddenQuery = hiddenQuery.in('client_id', clientIds);
  }
  const { data: allHiddenMatches, error: hiddenError } = await hiddenQuery;

  if (hiddenError) {
    console.error('[ClientMatching] Error fetching hidden matches:', hiddenError);
  }

  const hiddenMap = new Map();
  for (const h of allHiddenMatches || []) {
    if (!hiddenMap.has(h.client_id)) hiddenMap.set(h.client_id, new Set());
    hiddenMap.get(h.client_id).add(h.opportunity_id);
  }

  // 4. Group matches by client, filter hidden, transform
  const matchesByClient = new Map();
  for (const row of matchRows || []) {
    const cid = row.client_id;
    const hiddenIds = hiddenMap.get(cid);
    if (hiddenIds && hiddenIds.has(row.opportunity.id)) continue;

    if (!matchesByClient.has(cid)) matchesByClient.set(cid, []);
    matchesByClient.get(cid).push(transformMatch(row));
  }

  // 5. Build results keyed by client ID
  const results = {};

  for (const client of clients) {
    const clientMatches = matchesByClient.get(client.id) || [];
    clientMatches.sort((a, b) => b.score - a.score);

    const hiddenIds = hiddenMap.get(client.id);
    const hiddenCount = hiddenIds ? hiddenIds.size : 0;

    results[client.id] = {
      client,
      matches: clientMatches,
      matchCount: clientMatches.length,
      hiddenCount,
      topMatches: clientMatches.slice(0, 3)
    };
  }

  console.log(`[ClientMatching] Returned matches for ${clients.length} clients`);

  return Response.json({
    success: true,
    results,
    timestamp: new Date().toISOString()
  });
}
