/**
 * Client Filtering Utility
 *
 * Provides user-based filtering for client API routes.
 * Reads the `user_id` query param to determine which clients to return:
 *   - `user_id=all`       → no filtering (all clients)
 *   - `user_id=<uuid>`    → clients assigned to that user via client_users
 *   - (no param)          → defaults to current authenticated user's clients
 *   - (not authenticated) → no filtering (graceful fallback, e.g. dev mode)
 */

import { requireAuth } from '@/utils/supabase/api';

/**
 * Resolve the set of client IDs visible to the requesting user.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Service-role client for querying client_users
 * @param {import('next/server').NextRequest} request - Incoming request (for auth + query params)
 * @returns {Promise<{ clientIds: string[] | null, userId: string | null }>}
 *   clientIds=null means "no filtering" (return all clients).
 *   clientIds=[] means the user has no assigned clients.
 */
export async function getFilteredClientIds(supabase, request) {
  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get('user_id');

  // Explicit "all" — no filtering
  if (userIdParam === 'all') {
    return { clientIds: null, userId: null };
  }

  // Determine which user to filter by
  let filterUserId = userIdParam;

  if (!filterUserId) {
    // Default: current authenticated user
    try {
      const { user } = await requireAuth(request);
      if (user?.id) {
        filterUserId = user.id;
      }
    } catch {
      // Auth failed (e.g. dev mode) — fall through
    }

    // Not authenticated and no explicit user_id → show all
    if (!filterUserId) {
      return { clientIds: null, userId: null };
    }
  }

  // Query client_users for this user's assigned client IDs
  const { data, error } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', filterUserId);

  if (error) {
    console.error('[ClientFiltering] Error querying client_users:', error.message);
    // On error, fall back to showing all clients rather than blocking
    return { clientIds: null, userId: filterUserId };
  }

  return {
    clientIds: (data || []).map(row => row.client_id),
    userId: filterUserId,
  };
}
