/**
 * Supabase Client for Server Components and Server Actions
 * 
 * This utility creates a Supabase client for use in React Server Components and Server Actions.
 * It uses the @supabase/ssr package with Next.js cookies() for proper authentication handling.
 * 
 * @module utils/supabase/server
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for server-side operations
 * 
 * Features:
 * - Cookie-based authentication using Next.js cookies()
 * - Read-only cookie access (suitable for Server Components)
 * - Automatic session validation
 * - Works with Next.js 15 App Router server components
 * - Support for both anon and service role keys
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} [options.serviceRole=false] - Use service role key for admin operations
 * @returns {import('@supabase/supabase-js').SupabaseClient} Configured Supabase client
 * @throws {Error} If required environment variables are missing
 * 
 * @example
 * // In a Server Component
 * import { createClient } from '@/utils/supabase/server';
 * 
 * export default async function Page() {
 *   const supabase = createClient();
 *   const { data } = await supabase.from('table').select();
 *   // ...
 * }
 * 
 * @example
 * // With service role for admin operations
 * const supabase = createClient({ serviceRole: true });
 */
export function createClient(options = {}) {
  const { serviceRole = false } = options;
  const cookieStore = cookies();
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = serviceRole 
    ? process.env.SUPABASE_SERVICE_ROLE_KEY 
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      `Missing required Supabase environment variables. ` +
      `Please ensure NEXT_PUBLIC_SUPABASE_URL and ${
        serviceRole ? 'SUPABASE_SERVICE_ROLE_KEY' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
      } are set.`
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Creates an admin Supabase client with service role privileges
 * 
 * WARNING: This bypasses Row Level Security (RLS) policies.
 * Only use for administrative operations that require elevated privileges.
 * 
 * @returns {import('@supabase/supabase-js').SupabaseClient} Admin Supabase client
 * @throws {Error} If SUPABASE_SERVICE_ROLE_KEY is not set
 * 
 * @example
 * import { createAdminClient } from '@/utils/supabase/server';
 * 
 * const supabase = createAdminClient();
 * // Performs operations with admin privileges
 */
export function createAdminClient() {
  return createClient({ serviceRole: true });
}

/**
 * Auth utility functions for server components
 */

/**
 * Gets the currently authenticated user from server context
 * @returns {Promise<import('@supabase/supabase-js').User | null>} The current user or null
 */
export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
  
  return user;
}

/**
 * Gets the current session from server context
 * @returns {Promise<import('@supabase/supabase-js').Session | null>} The current session or null
 */
export async function getSession() {
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error fetching session:', error);
    return null;
  }
  
  return session;
}

/**
 * Checks if a user is authenticated in server context
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Legacy compatibility functions
 */

/**
 * Creates a server Supabase client (legacy naming)
 * @deprecated Use createClient() instead
 */
export function createServerSupabaseClient() {
  return createClient();
}

/**
 * Gets a singleton server Supabase client (legacy pattern)
 * @deprecated Use createClient() instead - SSR doesn't need singletons
 */
export function getServerSupabaseClient() {
  return createClient();
}

/**
 * Helper function to fetch data from Supabase on the server
 * Maintained for backward compatibility
 * 
 * @param {string} tableName - Name of the table to query
 * @param {Object} query - Query configuration
 * @param {Object} [query.filters] - Column filters as key-value pairs
 * @param {Object} [query.orderBy] - Order configuration
 * @param {string} query.orderBy.column - Column to order by
 * @param {boolean} query.orderBy.ascending - Sort direction
 * @param {number} [query.limit] - Maximum number of rows to return
 * @param {number} [query.offset] - Number of rows to skip
 * @returns {Promise<Array>} Query results
 * @throws {Error} If query fails
 * 
 * @example
 * const data = await fetchFromSupabase('funding_opportunities', {
 *   filters: { status: 'open' },
 *   orderBy: { column: 'created_at', ascending: false },
 *   limit: 10
 * });
 */
export async function fetchFromSupabase(tableName, query = {}) {
  const supabase = createClient();

  let queryBuilder = supabase.from(tableName).select();

  // Apply filters if provided
  if (query.filters) {
    for (const [column, value] of Object.entries(query.filters)) {
      queryBuilder = queryBuilder.eq(column, value);
    }
  }

  // Apply order if provided
  if (query.orderBy) {
    queryBuilder = queryBuilder.order(query.orderBy.column, {
      ascending: query.orderBy.ascending,
    });
  }

  // Apply pagination if provided
  if (query.limit) {
    queryBuilder = queryBuilder.limit(query.limit);
  }

  if (query.offset) {
    queryBuilder = queryBuilder.range(
      query.offset,
      query.offset + (query.limit || 10) - 1
    );
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('Error fetching from Supabase:', error);
    throw error;
  }

  return data;
}

// Default export for convenience
export default createClient;