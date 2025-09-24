/**
 * Client Matching Summary API
 *
 * Returns total number of client matches for dashboard display
 */

import { createClient } from '@supabase/supabase-js';
import { TAXONOMIES } from '@/lib/constants/taxonomies';
import clientsData from '@/data/clients.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Simple in-memory cache
let cache = {
  data: null,
  timestamp: null,
  ttl: 5 * 60 * 1000 // 5 minutes
};

export async function GET() {
  try {
    // Check cache
    const now = Date.now();
    if (cache.data && cache.timestamp && (now - cache.timestamp) < cache.ttl) {
      return Response.json({
        success: true,
        totalMatches: cache.data,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    console.log('[ClientMatchingSummary] Calculating total matches');

    // Get all opportunities from database
    const { data: opportunities, error } = await supabase
      .from('funding_opportunities_with_geography')
      .select(`
        id, title, eligible_locations, eligible_applicants,
        eligible_project_types, eligible_activities, is_national
      `);

    if (error) {
      console.error('[ClientMatchingSummary] Database error:', error);
      return Response.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
    }

    let totalMatches = 0;

    // Calculate matches for each client and sum them up
    for (const client of clientsData.clients) {
      const clientMatches = calculateMatches(client, opportunities);
      totalMatches += clientMatches.length;
    }

    // Cache the result
    cache.data = totalMatches;
    cache.timestamp = now;

    console.log(`[ClientMatchingSummary] Found ${totalMatches} total matches across all clients`);

    return Response.json({
      success: true,
      totalMatches,
      cached: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ClientMatchingSummary] API error:', error);
    return Response.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}

/**
 * Calculate matches between a client and opportunities
 * Simplified version for counting only
 */
function calculateMatches(client, opportunities) {
  const matches = [];

  for (const opportunity of opportunities) {
    const matchResult = evaluateMatch(client, opportunity);
    if (matchResult.isMatch) {
      matches.push(opportunity.id);
    }
  }

  return matches;
}

/**
 * Evaluate if an opportunity matches a client
 * Simplified version focusing on match determination
 */
function evaluateMatch(client, opportunity) {
  // 1. Location Match
  let locationMatch = false;
  if (opportunity.is_national) {
    locationMatch = true;
  } else if (opportunity.eligible_locations && Array.isArray(opportunity.eligible_locations)) {
    const clientState = client.location;
    locationMatch = opportunity.eligible_locations.some(location =>
      location.toLowerCase().includes(clientState.toLowerCase()) ||
      clientState.toLowerCase().includes(location.toLowerCase())
    );
  }

  // 2. Applicant Type Match
  let applicantTypeMatch = false;
  if (opportunity.eligible_applicants && Array.isArray(opportunity.eligible_applicants)) {
    applicantTypeMatch = opportunity.eligible_applicants.some(applicant =>
      applicant.toLowerCase().includes(client.type.toLowerCase()) ||
      client.type.toLowerCase().includes(applicant.toLowerCase())
    );
  }

  // 3. Project Needs Match
  let projectNeedsMatch = false;
  if (opportunity.eligible_project_types && Array.isArray(opportunity.eligible_project_types) &&
      client.projectNeeds && Array.isArray(client.projectNeeds)) {

    for (const need of client.projectNeeds) {
      const hasMatch = opportunity.eligible_project_types.some(projectType =>
        projectType.toLowerCase().includes(need.toLowerCase()) ||
        need.toLowerCase().includes(projectType.toLowerCase())
      );

      if (hasMatch) {
        projectNeedsMatch = true;
        break;
      }
    }
  }

  // 4. Activities Match (must include "hot" activities for construction/implementation)
  let activitiesMatch = false;
  if (opportunity.eligible_activities && Array.isArray(opportunity.eligible_activities)) {
    const hotActivities = TAXONOMIES.ELIGIBLE_ACTIVITIES.hot;
    activitiesMatch = opportunity.eligible_activities.some(activity =>
      hotActivities.some(hotActivity =>
        activity.toLowerCase().includes(hotActivity.toLowerCase()) ||
        hotActivity.toLowerCase().includes(activity.toLowerCase())
      )
    );
  }

  // Check if all criteria are met
  const isMatch = locationMatch && applicantTypeMatch && projectNeedsMatch && activitiesMatch;

  return { isMatch };
}