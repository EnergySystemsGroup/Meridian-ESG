/**
 * Supabase Client for API Routes and Route Handlers
 * 
 * This utility creates a Supabase client optimized for Next.js 15 API routes.
 * It handles cookie-based authentication with NextRequest and NextResponse.
 * 
 * @module utils/supabase/api
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * Creates a Supabase client for API route handlers
 * 
 * Features:
 * - Cookie-based authentication via NextRequest/NextResponse
 * - Support for both GET and POST request methods
 * - Automatic session handling and refresh
 * - Works with Next.js 15 App Router route handlers
 * 
 * @param {import('next/server').NextRequest} request - The incoming API request
 * @param {Object} options - Configuration options
 * @param {boolean} [options.serviceRole=false] - Use service role key for admin operations
 * @returns {{supabase: import('@supabase/supabase-js').SupabaseClient, response: import('next/server').NextResponse}}
 * @throws {Error} If required environment variables are missing
 * 
 * @example
 * // In app/api/route.js
 * import { createClient } from '@/utils/supabase/api';
 * 
 * export async function GET(request) {
 *   const { supabase, response } = createClient(request);
 *   
 *   const { data, error } = await supabase
 *     .from('table')
 *     .select();
 *   
 *   if (error) {
 *     return NextResponse.json({ error: error.message }, { status: 500 });
 *   }
 *   
 *   return NextResponse.json({ data });
 * }
 * 
 * @example
 * // With service role for admin operations
 * export async function POST(request) {
 *   const { supabase } = createClient(request, { serviceRole: true });
 *   // Performs operations with elevated privileges
 * }
 */
export function createClient(request, options = {}) {
  const { serviceRole = false } = options;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use new key nomenclature: publishable key (anon) vs secret key (service role)
  const supabaseKey = serviceRole
    ? process.env.SUPABASE_SECRET_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      `Missing required Supabase environment variables. ` +
      `Please ensure NEXT_PUBLIC_SUPABASE_URL and ${
        serviceRole ? 'SUPABASE_SECRET_KEY' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
      } are set.`
    );
  }

  // Create a NextResponse that we'll use for setting cookies
  const response = NextResponse.next();

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  return { supabase, response };
}

/**
 * Creates an admin Supabase client for API routes
 * 
 * WARNING: This bypasses Row Level Security (RLS) policies.
 * Only use for administrative operations that require elevated privileges.
 *
 * @param {import('next/server').NextRequest} request - The incoming API request
 * @returns {{supabase: import('@supabase/supabase-js').SupabaseClient, response: import('next/server').NextResponse}}
 * @throws {Error} If SUPABASE_SECRET_KEY is not set
 * 
 * @example
 * import { createAdminClient } from '@/utils/supabase/api';
 * 
 * export async function POST(request) {
 *   const { supabase } = createAdminClient(request);
 *   // Performs operations with admin privileges
 * }
 */
export function createAdminClient(request) {
  return createClient(request, { serviceRole: true });
}

/**
 * Helper to verify authentication in API routes
 * 
 * @param {import('next/server').NextRequest} request - The incoming API request
 * @returns {Promise<{user: import('@supabase/supabase-js').User | null, supabase: import('@supabase/supabase-js').SupabaseClient, response: import('next/server').NextResponse}>}
 * 
 * @example
 * export async function POST(request) {
 *   const { user, supabase, response } = await requireAuth(request);
 *   
 *   if (!user) {
 *     return NextResponse.json(
 *       { error: 'Unauthorized' },
 *       { status: 401 }
 *     );
 *   }
 *   
 *   // Proceed with authenticated request
 * }
 */
export async function requireAuth(request) {
  const { supabase, response } = createClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Auth error in API route:', error);
  }
  
  return { user, supabase, response };
}

/**
 * Helper for API routes that need role-based access control
 * 
 * @param {import('next/server').NextRequest} request - The incoming API request
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Promise<{authorized: boolean, user: import('@supabase/supabase-js').User | null, supabase: import('@supabase/supabase-js').SupabaseClient, response: import('next/server').NextResponse}>}
 * 
 * @example
 * export async function DELETE(request) {
 *   const { authorized, user, supabase } = await requireRole(request, ['admin', 'super_admin']);
 *   
 *   if (!authorized) {
 *     return NextResponse.json(
 *       { error: 'Forbidden: Insufficient permissions' },
 *       { status: 403 }
 *     );
 *   }
 *   
 *   // Proceed with admin operation
 * }
 */
export async function requireRole(request, allowedRoles) {
  const { user, supabase, response } = await requireAuth(request);
  
  if (!user) {
    return { authorized: false, user: null, supabase, response };
  }
  
  // Check user role (assumes role is stored in user metadata or custom claims)
  const userRole = user.user_metadata?.role || user.role;
  const authorized = allowedRoles.includes(userRole);
  
  return { authorized, user, supabase, response };
}

/**
 * Legacy compatibility functions to maintain existing patterns
 */

/**
 * Creates a Supabase client compatible with existing lib/supabase.js patterns
 * 
 * @param {import('next/server').NextRequest} [request] - Optional request for API routes
 * @returns {import('@supabase/supabase-js').SupabaseClient} Supabase client
 */
export function createSupabaseClient(request = null) {
  if (request) {
    const { supabase } = createClient(request);
    return supabase;
  }
  
  // Fallback for non-API route usage (though this should use server.js instead)
  const { createClient: createBasicClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  return createBasicClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Creates an admin Supabase client compatible with lib/supabase.js
 * 
 * @param {import('next/server').NextRequest} [request] - Optional request for API routes
 * @returns {import('@supabase/supabase-js').SupabaseClient} Admin Supabase client
 */
export function createAdminSupabaseClient(request = null) {
  if (request) {
    const { supabase } = createAdminClient(request);
    return supabase;
  }

  const { createClient: createBasicClient } = require('@supabase/supabase-js');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Missing Supabase admin environment variables (SUPABASE_SECRET_KEY)');
  }

  return createBasicClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Helper function to log API activity (maintained for compatibility)
 * 
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {string} sourceId - Source identifier
 * @param {string} action - Action being performed
 * @param {string} status - Status of the action
 * @param {Object} [details={}] - Additional details to log
 */
export async function logApiActivity(
  supabase,
  sourceId,
  action,
  status,
  details = {}
) {
  try {
    await supabase.from('api_activity_logs').insert({
      source_id: sourceId,
      action,
      status,
      details,
    });
  } catch (error) {
    console.error('Error logging API activity:', error);
  }
}

/**
 * Helper function to log agent execution (maintained for compatibility)
 * 
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {string} agentType - Type of agent
 * @param {*} input - Agent input
 * @param {*} output - Agent output
 * @param {number} executionTime - Execution time in ms
 * @param {Object} tokenUsage - Token usage statistics
 * @param {Error} [error=null] - Error if any
 */
export async function logAgentExecution(
  supabase,
  agentType,
  input,
  output,
  executionTime,
  tokenUsage,
  error = null
) {
  try {
    await supabase.from('agent_executions').insert({
      agent_type: agentType,
      input,
      output,
      execution_time: executionTime,
      token_usage: tokenUsage,
      error: error ? String(error) : null,
    });
  } catch (logError) {
    console.error('Error logging agent execution:', logError);
  }
}

// Default export for convenience
export default createClient;