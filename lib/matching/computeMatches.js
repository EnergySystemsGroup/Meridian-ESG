/**
 * Background match computation engine
 *
 * Computes client-opportunity matches and persists results to client_matches.
 * Supports full recomputation (cron) and scoped computation (event triggers).
 *
 * Uses evaluateMatch.js as the single source of truth for matching logic.
 */

import { evaluateMatch } from './evaluateMatch.js';
import { TAXONOMIES, getExpandedClientTypes } from '../constants/taxonomies.js';

const MATCH_DEPS = {
  hotActivities: TAXONOMIES.ELIGIBLE_ACTIVITIES.hot,
  getExpandedClientTypes
};

/**
 * Compute matches for ALL clients against ALL open opportunities.
 * Used by the daily cron job.
 */
export async function computeAllMatches(supabase) {
  return runMatchComputation(supabase, {
    trigger: 'cron',
    scope: {}
  });
}

/**
 * Compute matches for a single client against all open opportunities.
 * Used after client create/update.
 */
export async function computeMatchesForClient(supabase, clientId, { trigger = 'client_updated' } = {}) {
  return runMatchComputation(supabase, {
    trigger,
    scope: { clientIds: [clientId] }
  });
}

/**
 * Compute matches for specific opportunities against all clients.
 * Used after pipeline Phase 6 stores new opportunities.
 */
export async function computeMatchesForOpportunities(supabase, opportunityIds) {
  return runMatchComputation(supabase, {
    trigger: 'opportunity_stored',
    scope: { opportunityIds }
  });
}

/**
 * Core computation engine. Fetches data, runs evaluateMatch for each pair,
 * UPSERTs results, and marks stale matches.
 *
 * @param {Object} supabase - Supabase client with service_role key
 * @param {Object} options
 * @param {string} options.trigger - What triggered this computation
 * @param {Object} options.scope - { clientIds?: string[], opportunityIds?: string[] }
 * @returns {Object} stats - { new_matches, updated_matches, stale_matches, duration_ms, ... }
 */
async function runMatchComputation(supabase, { trigger, scope }) {
  const startTime = Date.now();

  // Log job start
  const { data: jobLog } = await supabase
    .from('match_job_logs')
    .insert({
      trigger,
      scope: scope || {},
      status: 'running'
    })
    .select('id')
    .single();

  const jobId = jobLog?.id;

  try {
    // 1. Fetch clients (limit raised from Supabase default of 1,000)
    let clientQuery = supabase.from('clients').select('id, name, type, coverage_area_ids, project_needs').limit(10000);
    if (scope.clientIds?.length) {
      clientQuery = clientQuery.in('id', scope.clientIds);
    }
    const { data: clients, error: clientError } = await clientQuery;
    if (clientError) throw new Error(`Failed to fetch clients: ${clientError.message}`);
    if (!clients?.length) {
      return finishJob(supabase, jobId, startTime, { clients_processed: 0, message: 'No clients found' });
    }

    // 2. Fetch open opportunities (non-closed, promoted or null promotion_status)
    let oppQuery = supabase
      .from('funding_opportunities')
      .select('id, eligible_applicants, eligible_project_types, eligible_activities, is_national')
      .neq('status', 'closed')
      .or('promotion_status.is.null,promotion_status.eq.promoted')
      .limit(10000);
    if (scope.opportunityIds?.length) {
      oppQuery = oppQuery.in('id', scope.opportunityIds);
    }
    const { data: opportunities, error: oppError } = await oppQuery;
    if (oppError) throw new Error(`Failed to fetch opportunities: ${oppError.message}`);
    if (!opportunities?.length) {
      return finishJob(supabase, jobId, startTime, { clients_processed: clients.length, opportunities_evaluated: 0, message: 'No opportunities found' });
    }

    // 3. Fetch coverage areas for opportunities
    // For full runs, fetch all coverage links (avoids URL length limit with large ID lists).
    // For scoped runs, filter by the specific opportunity IDs.
    let coverageQuery = supabase
      .from('opportunity_coverage_areas')
      .select('opportunity_id, coverage_area_id')
      .limit(50000);
    if (scope.opportunityIds?.length) {
      coverageQuery = coverageQuery.in('opportunity_id', scope.opportunityIds);
    }
    const { data: coverageLinks, error: coverageError } = await coverageQuery;
    if (coverageError) throw new Error(`Failed to fetch coverage areas: ${coverageError.message}`);

    // Build coverage area map
    const coverageMap = {};
    for (const link of coverageLinks || []) {
      if (!coverageMap[link.opportunity_id]) coverageMap[link.opportunity_id] = [];
      coverageMap[link.opportunity_id].push(link.coverage_area_id);
    }
    for (const opp of opportunities) {
      opp.coverage_area_ids = coverageMap[opp.id] || [];
    }

    // 4. Compute all matches
    const matchRows = [];
    for (const client of clients) {
      for (const opportunity of opportunities) {
        const result = evaluateMatch(client, opportunity, MATCH_DEPS);
        if (result.isMatch) {
          matchRows.push({
            client_id: client.id,
            opportunity_id: opportunity.id,
            score: result.score,
            match_details: result.details
          });
        }
      }
    }

    // 5. Fetch existing matches for the scope (needed for delta detection)
    let existingQuery = supabase
      .from('client_matches')
      .select('client_id, opportunity_id')
      .limit(100000);
    if (scope.clientIds?.length) {
      existingQuery = existingQuery.in('client_id', scope.clientIds);
    }
    if (scope.opportunityIds?.length) {
      existingQuery = existingQuery.in('opportunity_id', scope.opportunityIds);
    }
    const { data: existingMatches } = await existingQuery;
    const existingSet = new Set(
      (existingMatches || []).map(m => `${m.client_id}:${m.opportunity_id}`)
    );

    // 6. UPSERT matches in batches
    // Excludes is_new and first_matched_at from the payload so that:
    // - New rows get DB defaults: is_new=true, first_matched_at=NOW()
    // - Existing rows preserve their is_new and first_matched_at values
    // Using .upsert() instead of separate INSERT+UPDATE avoids race conditions
    // between concurrent triggers (cron, pipeline, client CRUD).
    const newMatchKeys = new Set();
    let newCount = 0;
    let updatedCount = 0;
    const BATCH_SIZE = 500;
    const now = new Date().toISOString();

    for (let i = 0; i < matchRows.length; i += BATCH_SIZE) {
      const batch = matchRows.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('client_matches')
        .upsert(
          batch.map(row => ({
            client_id: row.client_id,
            opportunity_id: row.opportunity_id,
            score: row.score,
            match_details: row.match_details,
            last_matched_at: now,
            is_stale: false,
            stale_at: null
          })),
          { onConflict: 'client_id,opportunity_id' }
        );
      if (upsertError) throw new Error(`UPSERT failed: ${upsertError.message}`);

      for (const row of batch) {
        const key = `${row.client_id}:${row.opportunity_id}`;
        newMatchKeys.add(key);
        if (existingSet.has(key)) {
          updatedCount++;
        } else {
          newCount++;
        }
      }
    }

    // 7. Mark stale matches (existed before but not in new computation)
    // Only mark stale within the scope being processed
    const staleKeys = [];
    for (const existing of existingMatches || []) {
      const key = `${existing.client_id}:${existing.opportunity_id}`;
      if (!newMatchKeys.has(key)) {
        staleKeys.push(existing);
      }
    }

    let staleCount = staleKeys.length;
    if (staleKeys.length > 0) {
      // Batch stale marking by client_id groups
      const staleByClient = {};
      for (const stale of staleKeys) {
        if (!staleByClient[stale.client_id]) staleByClient[stale.client_id] = [];
        staleByClient[stale.client_id].push(stale.opportunity_id);
      }

      for (const [clientId, oppIds] of Object.entries(staleByClient)) {
        const { error: staleError } = await supabase
          .from('client_matches')
          .update({
            is_stale: true,
            stale_at: new Date().toISOString()
          })
          .eq('client_id', clientId)
          .in('opportunity_id', oppIds)
          .eq('is_stale', false); // Only update if not already stale

        if (staleError) {
          console.error(`[ComputeMatches] Stale marking failed for client ${clientId}:`, staleError.message);
        }
      }
    }

    // 8. Return stats
    const stats = {
      clients_processed: clients.length,
      opportunities_evaluated: opportunities.length,
      pairs_evaluated: clients.length * opportunities.length,
      new_matches: newCount,
      updated_matches: updatedCount,
      stale_matches: staleCount,
      total_active_matches: matchRows.length,
      duration_ms: Date.now() - startTime
    };

    return finishJob(supabase, jobId, startTime, stats);

  } catch (error) {
    // Log failure
    if (jobId) {
      await supabase
        .from('match_job_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error: error.message,
          stats: { duration_ms: Date.now() - startTime }
        })
        .eq('id', jobId);
    }
    console.error(`[ComputeMatches] Job failed (${trigger}):`, error.message);
    throw error;
  }
}

/**
 * Finalize a job log with stats.
 */
async function finishJob(supabase, jobId, startTime, stats) {
  const duration = Date.now() - startTime;
  stats.duration_ms = duration;

  if (jobId) {
    await supabase
      .from('match_job_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        stats
      })
      .eq('id', jobId);
  }

  console.log(`[ComputeMatches] Job completed in ${duration}ms:`, {
    new: stats.new_matches,
    updated: stats.updated_matches,
    stale: stats.stale_matches,
    total: stats.total_active_matches
  });

  return stats;
}
