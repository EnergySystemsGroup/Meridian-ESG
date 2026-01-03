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
      .neq('status', 'closed');

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

    if (error) {
      console.error('[ClientMatching] Database error:', error);
      return Response.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
    }

    console.log(`[ClientMatching] Found ${opportunities.length} opportunities to match against`);

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

      // Fetch hidden matches for this client
      const { data: hiddenMatches, error: hiddenError } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', client.id);

      if (hiddenError) {
        console.error('[ClientMatching] Error fetching hidden matches:', hiddenError);
      }

      const hiddenOpportunityIds = new Set((hiddenMatches || []).map(h => h.opportunity_id));
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

  for (const opportunity of opportunities) {
    const matchResult = evaluateMatch(client, opportunity);

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

/**
 * Evaluate if an opportunity matches a client
 */
function evaluateMatch(client, opportunity) {
  const details = {
    locationMatch: false,
    applicantTypeMatch: false,
    projectNeedsMatch: false,
    activitiesMatch: false,
    matchedProjectNeeds: []
  };

  // 1. Location Match (using coverage_area_ids for precise geographic matching)
  if (opportunity.is_national) {
    // National opportunities match all clients
    details.locationMatch = true;
  } else if (client.coverage_area_ids && Array.isArray(client.coverage_area_ids) &&
             opportunity.coverage_area_ids && Array.isArray(opportunity.coverage_area_ids)) {
    // Check if client's coverage areas intersect with opportunity's coverage areas
    // This provides utility-level, county-level, or state-level precision
    const hasIntersection = client.coverage_area_ids.some(clientAreaId =>
      opportunity.coverage_area_ids.includes(clientAreaId)
    );
    details.locationMatch = hasIntersection;
  }

  // 2. Applicant Type Match (with type expansion for hierarchical matching)
  if (opportunity.eligible_applicants && Array.isArray(opportunity.eligible_applicants)) {
    // Get expanded types for this client (child → parent expansion)
    // e.g., "Hospitals" expands to ["Hospitals", "Healthcare Facilities"]
    const expandedTypes = getExpandedClientTypes(client.type);

    // Check if any expanded type matches any eligible applicant
    details.applicantTypeMatch = opportunity.eligible_applicants.some(applicant =>
      expandedTypes.some(clientType =>
        applicant.toLowerCase() === clientType.toLowerCase() ||
        applicant.toLowerCase().includes(clientType.toLowerCase()) ||
        clientType.toLowerCase().includes(applicant.toLowerCase())
      )
    );
  }

  // 3. Project Needs Match
  if (opportunity.eligible_project_types && Array.isArray(opportunity.eligible_project_types) &&
      client.project_needs && Array.isArray(client.project_needs)) {

    for (const need of client.project_needs) {
      const hasMatch = opportunity.eligible_project_types.some(projectType =>
        projectType.toLowerCase().includes(need.toLowerCase()) ||
        need.toLowerCase().includes(projectType.toLowerCase())
      );

      if (hasMatch) {
        details.matchedProjectNeeds.push(need);
      }
    }

    details.projectNeedsMatch = details.matchedProjectNeeds.length > 0;
  }

  // 4. Activities Match (must include "hot" activities for construction/implementation)
  if (opportunity.eligible_activities && Array.isArray(opportunity.eligible_activities)) {
    const hotActivities = TAXONOMIES.ELIGIBLE_ACTIVITIES.hot;
    details.activitiesMatch = opportunity.eligible_activities.some(activity =>
      hotActivities.some(hotActivity =>
        activity.toLowerCase().includes(hotActivity.toLowerCase()) ||
        hotActivity.toLowerCase().includes(activity.toLowerCase())
      )
    );
  }

  // Check if all criteria are met
  const isMatch = details.locationMatch &&
                  details.applicantTypeMatch &&
                  details.projectNeedsMatch &&
                  details.activitiesMatch;

  // Debug logging for match failures
  if (!isMatch) {
    console.log(`[ClientMatching] No match for ${client.name} with opportunity ${opportunity.id}:`, {
      locationMatch: details.locationMatch,
      applicantTypeMatch: details.applicantTypeMatch,
      projectNeedsMatch: details.projectNeedsMatch,
      activitiesMatch: details.activitiesMatch,
      clientType: client.type,
      clientProjectNeeds: client.project_needs,
      clientCoverageAreas: client.coverage_area_ids?.length || 0,
      oppCoverageAreas: opportunity.coverage_area_ids?.length || 0,
      oppApplicants: opportunity.eligible_applicants,
      oppProjectTypes: opportunity.eligible_project_types,
      oppActivities: opportunity.eligible_activities
    });
  }

  // Calculate score (% of project needs matched)
  let score = 0;
  if (isMatch && client.project_needs && client.project_needs.length > 0) {
    score = Math.round((details.matchedProjectNeeds.length / client.project_needs.length) * 100);
  }

  return {
    isMatch,
    score,
    details
  };
}