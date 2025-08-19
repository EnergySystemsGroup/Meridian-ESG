/**
 * Supabase Client for Browser/Client Components
 * 
 * This utility creates a Supabase client optimized for use in React Client Components.
 * It uses the @supabase/ssr package for proper cookie-based authentication in Next.js 15.
 * 
 * @module utils/supabase/client
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';

let supabaseClientInstance = null;

/**
 * Creates or returns a singleton Supabase client for browser/client components
 * 
 * Features:
 * - Singleton pattern to prevent multiple client instances
 * - Automatic session persistence via cookies
 * - Auto token refresh for authenticated sessions
 * - Works with Next.js 15 App Router client components
 * 
 * @returns {import('@supabase/supabase-js').SupabaseClient} Configured Supabase client
 * @throws {Error} If required environment variables are missing
 * 
 * @example
 * // In a React Client Component
 * 'use client';
 * import { createClient } from '@/utils/supabase/client';
 * 
 * export default function MyComponent() {
 *   const supabase = createClient();
 *   // Use supabase client...
 * }
 */
export function createClient() {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing required Supabase environment variables. ' +
      'Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  supabaseClientInstance = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );

  return supabaseClientInstance;
}

/**
 * Auth utility functions for client components
 */

/**
 * Gets the currently authenticated user
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
 * Checks if a user is currently authenticated
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Signs out the current user
 * @returns {Promise<{error: Error | null}>} Error object if sign out fails
 */
export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Gets the current session
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
 * Signs in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{user: import('@supabase/supabase-js').User | null, error: Error | null}>}
 */
export async function signInWithPassword(email, password) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  return {
    user: data?.user || null,
    error,
  };
}

/**
 * Legacy compatibility export
 * @deprecated Use createClient() instead
 */
export const supabaseClient = new Proxy({}, {
  get(target, prop) {
    const client = createClient();
    return client[prop];
  }
});

// Default export for convenience
export default createClient;