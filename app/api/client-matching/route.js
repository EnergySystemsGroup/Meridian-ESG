/**
 * Client-Opportunity Matching API
 *
 * Matches clients from data/clients.json against real opportunities in the database
 * Returns match scores based on location, applicant type, project needs, and activities
 */

import { createClient } from '@supabase/supabase-js';
import { TAXONOMIES } from '@/lib/constants/taxonomies';
import clientsData from '@/data/clients.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    console.log(`[ClientMatching] Starting matching process${clientId ? ` for client: ${clientId}` : ' for all clients'}`);

    // Get clients to process
    const clientsToProcess = clientId
      ? clientsData.clients.filter(client => client.id === clientId)
      : clientsData.clients;

    if (clientsToProcess.length === 0) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get all opportunities from database
    const { data: opportunities, error } = await supabase
      .from('funding_opportunities_with_geography')
      .select(`
        id, title, eligible_locations, eligible_applicants,
        eligible_project_types, eligible_activities, is_national,
        minimum_award, maximum_award, total_funding_available,
        close_date, agency_name, categories, relevance_score,
        status, created_at
      `);

    if (error) {
      console.error('[ClientMatching] Database error:', error);
      return Response.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
    }

    console.log(`[ClientMatching] Found ${opportunities.length} opportunities to match against`);

    // Calculate matches for each client
    const results = {};

    for (const client of clientsToProcess) {
      console.log(`[ClientMatching] Processing client: ${client.name}`);
      const matches = calculateMatches(client, opportunities);

      results[client.id] = {
        client,
        matches: matches.sort((a, b) => b.score - a.score), // Sort by score descending
        matchCount: matches.length,
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

  // 1. Location Match
  if (opportunity.is_national) {
    details.locationMatch = true;
  } else if (opportunity.eligible_locations && Array.isArray(opportunity.eligible_locations)) {
    // Check if client's location (state) is in eligible locations
    const clientState = client.location; // e.g., "California"
    details.locationMatch = opportunity.eligible_locations.some(location =>
      location.toLowerCase().includes(clientState.toLowerCase()) ||
      clientState.toLowerCase().includes(location.toLowerCase())
    );
  }

  // 2. Applicant Type Match
  if (opportunity.eligible_applicants && Array.isArray(opportunity.eligible_applicants)) {
    details.applicantTypeMatch = opportunity.eligible_applicants.some(applicant =>
      applicant.toLowerCase().includes(client.type.toLowerCase()) ||
      client.type.toLowerCase().includes(applicant.toLowerCase())
    );
  }

  // 3. Project Needs Match
  if (opportunity.eligible_project_types && Array.isArray(opportunity.eligible_project_types) &&
      client.projectNeeds && Array.isArray(client.projectNeeds)) {

    for (const need of client.projectNeeds) {
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

  // Calculate score (% of project needs matched)
  let score = 0;
  if (isMatch && client.projectNeeds && client.projectNeeds.length > 0) {
    score = Math.round((details.matchedProjectNeeds.length / client.projectNeeds.length) * 100);
  }

  return {
    isMatch,
    score,
    details
  };
}