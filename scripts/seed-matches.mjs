/**
 * One-time build-time match seeder.
 *
 * Runs after `next build` to populate client_matches before the
 * deployment goes live. Skips instantly if matches already exist.
 *
 * Remove this script (and the package.json build change) after
 * first successful deployment to both staging and production.
 */

import { createClient } from '@supabase/supabase-js';
import { computeAllMatches } from '../lib/matching/computeMatches.js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    console.log('[SeedMatches] Missing Supabase credentials, skipping');
    return;
  }

  const supabase = createClient(url, key);

  // Fast check: do matches already exist?
  const { count, error: countError } = await supabase
    .from('client_matches')
    .select('id', { count: 'exact', head: true });

  if (countError) {
    console.warn('[SeedMatches] Could not check client_matches:', countError.message);
    return;
  }

  if (count > 0) {
    console.log(`[SeedMatches] ${count} matches already exist, skipping`);
    return;
  }

  // Check if there are clients to match
  const { count: clientCount, error: clientError } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true });

  if (clientError) {
    console.warn('[SeedMatches] Could not check clients:', clientError.message);
    return;
  }

  if (!clientCount) {
    console.log('[SeedMatches] No clients found, skipping');
    return;
  }

  console.log(`[SeedMatches] Seeding matches for ${clientCount} clients...`);
  const stats = await computeAllMatches(supabase);
  console.log('[SeedMatches] Complete:', JSON.stringify(stats));
}

main().catch(err => {
  // Non-fatal: log and exit cleanly so build succeeds
  console.warn('[SeedMatches] Non-fatal error:', err.message);
});
