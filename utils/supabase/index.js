/**
 * Supabase SSR Utilities Index
 * 
 * Central export point for all Supabase SSR utilities.
 * Choose the appropriate utility based on your use case:
 * 
 * - Client Components: Use exports from './client'
 * - Server Components: Use exports from './server'  
 * - API Routes: Use exports from './api'
 * - Middleware: Use exports from './middleware'
 * 
 * @module utils/supabase
 */

// Client utilities (for React Client Components)
export {
  createClient as createBrowserClient,
  getCurrentUser as getClientUser,
  isAuthenticated as isClientAuthenticated,
  signOut as clientSignOut,
  getSession as getClientSession,
  signInWithPassword,
  supabaseClient,
} from './client';

// Server utilities (for React Server Components)
export {
  createClient as createServerClient,
  createAdminClient as createServerAdminClient,
  getCurrentUser as getServerUser,
  getSession as getServerSession,
  isAuthenticated as isServerAuthenticated,
  fetchFromSupabase,
  // Legacy exports for compatibility
  createServerSupabaseClient,
  getServerSupabaseClient,
} from './server';

// API utilities (for Route Handlers)
export {
  createClient as createApiClient,
  createAdminClient as createApiAdminClient,
  requireAuth,
  requireRole,
  logApiActivity,
  logAgentExecution,
  // Legacy exports for compatibility
  createSupabaseClient,
  createAdminSupabaseClient,
} from './api';

// Middleware utilities
export {
  updateSession,
  createMiddlewareClient,
  protectRoutes,
  enforceRBAC,
} from './middleware';

/**
 * Migration Guide from @supabase/auth-helpers-nextjs to @supabase/ssr
 * 
 * OLD PATTERN:
 * ```js
 * import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
 * const supabase = createClientComponentClient();
 * ```
 * 
 * NEW PATTERN:
 * ```js
 * import { createClient } from '@/utils/supabase/client';
 * const supabase = createClient();
 * ```
 * 
 * MIGRATION MAP:
 * - createClientComponentClient() → createClient() from './client'
 * - createServerComponentClient() → createClient() from './server'
 * - createRouteHandlerClient() → createClient() from './api'
 * - createMiddlewareClient() → createMiddlewareClient() from './middleware'
 * 
 * KEY DIFFERENCES:
 * 1. No need to pass cookies() to server clients - handled internally
 * 2. API routes return both supabase client and response object
 * 3. Middleware requires explicit session update for auth refresh
 * 4. All utilities use cookie-based sessions (no localStorage)
 * 
 * ENVIRONMENT VARIABLES:
 * - NEXT_PUBLIC_SUPABASE_URL (required)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY (required)
 * - SUPABASE_SERVICE_ROLE_KEY (optional, for admin operations)
 */

// Default exports based on environment
const isServer = typeof window === 'undefined';

/**
 * Smart default export that returns appropriate client based on environment
 * Note: For explicit control, import from specific modules instead
 * 
 * @returns {Function} Appropriate createClient function for the environment
 */
export default function createClient() {
  if (isServer) {
    // In server environment, try to detect context
    try {
      // Check if we're in a Next.js server context with cookies available
      require('next/headers');
      const { createClient: createServer } = require('./server');
      return createServer();
    } catch {
      // Fallback to basic server client
      const { createSupabaseClient } = require('./api');
      return createSupabaseClient();
    }
  } else {
    // In browser environment
    const { createClient: createBrowser } = require('./client');
    return createBrowser();
  }
}