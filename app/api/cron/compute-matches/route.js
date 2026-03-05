/**
 * Match Computation Cron Endpoint
 *
 * GET  — called by pg_cron daily to recompute all matches
 * POST — manual trigger for testing, supports scoped computation
 *
 * Both handlers require CRON_SECRET auth.
 *
 * Endpoint: /api/cron/compute-matches
 */

import { createClient } from '@supabase/supabase-js';
import {
  computeAllMatches,
  computeMatchesForClient,
  computeMatchesForOpportunities
} from '../../../../lib/matching/computeMatches.js';

/**
 * Verify the request has a valid Bearer token matching CRON_SECRET.
 * Returns null if valid, or a Response if invalid.
 */
function verifyAuth(request) {
  const expectedAuth = process.env.CRON_SECRET;

  if (!expectedAuth) {
    console.error('[ComputeMatchesCron] CRON_SECRET is not set');
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${expectedAuth}`) {
    console.warn('[ComputeMatchesCron] Unauthorized request');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

/**
 * GET /api/cron/compute-matches
 * Called by pg_cron daily via pg_net.
 */
export async function GET(request) {
  const startTime = Date.now();

  const authError = verifyAuth(request);
  if (authError) return authError;

  try {
    console.log(`[ComputeMatchesCron] Daily match computation triggered at ${new Date().toISOString()}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    const stats = await computeAllMatches(supabase);

    return Response.json({
      success: true,
      trigger: 'cron',
      stats,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime
    });

  } catch (error) {
    console.error('[ComputeMatchesCron] Cron failed:', error);
    return Response.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime
    }, { status: 500 });
  }
}

/**
 * POST /api/cron/compute-matches
 * Manual trigger for testing. Accepts optional scope.
 *
 * Body: { clientId?: string, opportunityIds?: string[] }
 */
export async function POST(request) {
  const startTime = Date.now();

  const authError = verifyAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));

    console.log('[ComputeMatchesCron] Manual trigger:', body);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    let stats;
    let trigger = 'manual';

    if (body.clientId) {
      trigger = 'manual_client';
      stats = await computeMatchesForClient(supabase, body.clientId);
    } else if (body.opportunityIds?.length) {
      trigger = 'manual_opportunities';
      stats = await computeMatchesForOpportunities(supabase, body.opportunityIds);
    } else {
      trigger = 'manual_full';
      stats = await computeAllMatches(supabase);
    }

    return Response.json({
      success: true,
      trigger,
      stats,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime
    });

  } catch (error) {
    console.error('[ComputeMatchesCron] Manual trigger failed:', error);
    return Response.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime
    }, { status: 500 });
  }
}
