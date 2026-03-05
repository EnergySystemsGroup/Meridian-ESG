/**
 * Client-Opportunity Matching API
 *
 * Matches clients from the database against real opportunities
 * Returns match scores based on location, applicant type, project needs, and activities
 *
 * Location matching uses coverage_area_ids for precise geographic matching:
 * - Utility-level precision (e.g., PG&E vs SCE)
 * - County-level precision (e.g., Marin County)
 * - State-level matching
 * - National opportunities match all clients
 */

import { createClient } from '@supabase/supabase-js';
import { TAXONOMIES, getExpandedClientTypes } from '@/lib/constants/taxonomies';
import { evaluateMatch } from '@/lib/matching/evaluateMatch';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    console.log(`[ClientMatching] Starting matching process${clientId ? ` for client: ${clientId}` : ' for all clients'}`);

    // Get clients from database
    let clientQuery = supabase.from('clients').select('*');

    if (clientId) {
      clientQuery = clientQuery.eq('id', clientId);
    }

    const { data: clientsToProcess, error: clientError } = await clientQuery;

    if (clientError) {
      console.error('[ClientMatching] Error fetching clients:', clientError);
      return Response.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    if (!clientsToProcess || clientsToProcess.length === 0) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get all open opportunities with source type from funding_sources (exclude closed)
    const { data: rawOpportunities, error } = await supabase
      .from('funding_opportunities')
      .select(`
        id, title, eligible_locations, eligible_applicants,
        eligible_project_types, eligible_activities, is_national,
        minimum_award, maximum_award, total_funding_available,
        close_date, agency_name, categories, relevance_score,
        status, created_at, program_overview, program_insights,
        funding_sources(type)
      `)
      .neq('status', 'closed')
      .or('promotion_status.is.null,promotion_status.eq.promoted');

    if (error) {
      console.error('[ClientMatching] Database error:', error);
      return Response.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
    }

    // Flatten funding_sources.type to source_type on each opportunity
    const opportunities = (rawOpportunities || []).map(opp => ({
      ...opp,
      source_type: opp.funding_sources?.type || null,
      funding_sources: undefined // Remove nested object
    }));

    // Get opportunity coverage areas separately (since we need to join)
    const { data: opportunityCoverageAreas, error: coverageError } = await supabase
      .from('opportunity_coverage_areas')
      .select('opportunity_id, coverage_area_id');

    if (coverageError) {
      console.error('[ClientMatching] Error fetching coverage areas:', coverageError);
      return Response.json({ error: 'Failed to fetch opportunity coverage areas' }, { status: 500 });
    }

    // Build lookup map: opportunityId -> coverageAreaIds[]
    const opportunityCoverageMap = {};
    for (const link of opportunityCoverageAreas || []) {
      if (!opportunityCoverageMap[link.opportunity_id]) {
        opportunityCoverageMap[link.opportunity_id] = [];
      }
      opportunityCoverageMap[link.opportunity_id].push(link.coverage_area_id);
    }

    // Attach coverage area IDs to each opportunity
    for (const opp of opportunities) {
      opp.coverage_area_ids = opportunityCoverageMap[opp.id] || [];
    }

    console.log(`[ClientMatching] Found ${opportunities.length} opportunities to match against`);

    // Batch-fetch all hidden matches in a single query (eliminates N+1 pattern)
    const { data: allHiddenMatches, error: hiddenError } = await supabase
      .from('hidden_matches')
      .select('client_id, opportunity_id');

    if (hiddenError) {
      console.error('[ClientMatching] Error fetching hidden matches:', hiddenError);
    }

    const hiddenMap = new Map();
    for (const h of allHiddenMatches || []) {
      if (!hiddenMap.has(h.client_id)) hiddenMap.set(h.client_id, new Set());
      hiddenMap.get(h.client_id).add(h.opportunity_id);
    }

    // Calculate matches for each client
    const results = {};

    for (const client of clientsToProcess) {
      console.log(`[ClientMatching] Processing client: ${client.name}`);
      console.log(`[ClientMatching] Client details:`, {
        type: client.type,
        project_needs: client.project_needs,
        coverage_area_count: client.coverage_area_ids?.length || 0,
        city: client.city,
        state_code: client.state_code
      });

      const hiddenOpportunityIds = hiddenMap.get(client.id) || new Set();
      const hiddenCount = hiddenOpportunityIds.size;

      // Filter out hidden opportunities before matching
      const visibleOpportunities = opportunities.filter(opp => !hiddenOpportunityIds.has(opp.id));

      if (hiddenCount > 0) {
        console.log(`[ClientMatching] Filtered out ${hiddenCount} hidden matches for ${client.name}`);
      }

      const matches = calculateMatches(client, visibleOpportunities);

      results[client.id] = {
        client,
        matches: matches.sort((a, b) => b.score - a.score), // Sort by score descending
        matchCount: matches.length,
        hiddenCount, // Include hidden count in response
        topMatches: matches.slice(0, 3) // Top 3 for card display
      };

      console.log(`[ClientMatching] Found ${matches.length} matches for ${client.name}`);
    }

    return Response.json({
      success: true,
      results: clientId ? results[clientId] : results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ClientMatching] API error:', error);
    return Response.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Calculate matches between a client and opportunities
 */
function calculateMatches(client, opportunities) {
  const matches = [];
  const deps = {
    hotActivities: TAXONOMIES.ELIGIBLE_ACTIVITIES.hot,
    getExpandedClientTypes
  };

  for (const opportunity of opportunities) {
    const matchResult = evaluateMatch(client, opportunity, deps);

    if (matchResult.isMatch) {
      matches.push({
        ...opportunity,
        score: matchResult.score,
        matchDetails: matchResult.details
      });
    }
  }

  return matches;
}