/**
 * Supabase Client for Next.js Middleware
 * 
 * This utility creates a Supabase client for use in Next.js middleware.
 * It handles cookie-based authentication with proper request/response management.
 * 
 * @module utils/supabase/middleware
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * Updates the session and handles authentication in middleware
 * 
 * This function should be called in your middleware to:
 * - Refresh expired sessions
 * - Validate authentication tokens
 * - Update session cookies
 * - Handle protected routes
 * 
 * @param {import('next/server').NextRequest} request - The incoming request
 * @param {import('next/server').NextResponse} [response] - Optional response to modify
 * @returns {Promise<import('next/server').NextResponse>} Modified response with updated cookies
 * 
 * @example
 * // In middleware.js
 * import { updateSession } from '@/utils/supabase/middleware';
 * 
 * export async function middleware(request) {
 *   return await updateSession(request);
 * }
 * 
 * @example
 * // With custom logic
 * export async function middleware(request) {
 *   const response = await updateSession(request);
 *   
 *   // Add custom headers or logic
 *   response.headers.set('x-custom-header', 'value');
 *   
 *   return response;
 * }
 */
export async function updateSession(request, response) {
  // Create a response if not provided
  let supabaseResponse = response || NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if expired - crucial for Server Components
  const { data: { user }, error } = await supabase.auth.getUser();

  // Handle auth errors (e.g., invalid refresh token)
  if (error && !user) {
    // Clear invalid session cookies
    supabaseResponse.cookies.delete('sb-access-token');
    supabaseResponse.cookies.delete('sb-refresh-token');
  }

  return supabaseResponse;
}

/**
 * Creates a Supabase client for use in middleware with full cookie management
 * 
 * @param {import('next/server').NextRequest} request - The incoming request
 * @param {import('next/server').NextResponse} response - The response being built
 * @returns {Object} Object containing the Supabase client and response
 * 
 * @example
 * // In middleware.js for custom auth logic
 * import { createMiddlewareClient } from '@/utils/supabase/middleware';
 * 
 * export async function middleware(request) {
 *   const { supabase, response } = createMiddlewareClient(request);
 *   
 *   const { data: { user } } = await supabase.auth.getUser();
 *   
 *   if (!user && request.nextUrl.pathname.startsWith('/protected')) {
 *     return NextResponse.redirect(new URL('/login', request.url));
 *   }
 *   
 *   return response;
 * }
 */
export function createMiddlewareClient(request, response = null) {
  const supabaseResponse = response || NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing required Supabase environment variables. ' +
      'Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  return { supabase, response: supabaseResponse };
}

/**
 * Middleware helper to protect routes requiring authentication
 * 
 * @param {import('next/server').NextRequest} request - The incoming request
 * @param {string[]} protectedPaths - Array of path prefixes to protect
 * @param {string} [loginPath='/login'] - Path to redirect unauthenticated users
 * @returns {Promise<import('next/server').NextResponse>} Response with auth handling
 * 
 * @example
 * // In middleware.js
 * import { protectRoutes } from '@/utils/supabase/middleware';
 * 
 * export async function middleware(request) {
 *   return protectRoutes(request, ['/dashboard', '/admin', '/api/protected']);
 * }
 */
export async function protectRoutes(request, protectedPaths, loginPath = '/login') {
  const { supabase, response } = createMiddlewareClient(request);
  
  // Check if current path needs protection
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );
  
  if (isProtectedPath) {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (!user || error) {
      // Redirect to login with return URL
      const redirectUrl = new URL(loginPath, request.url);
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }
  
  return response;
}

/**
 * Middleware helper to handle role-based access control
 * 
 * @param {import('next/server').NextRequest} request - The incoming request
 * @param {Object} roleConfig - Configuration for role-based routes
 * @param {string} [unauthorizedPath='/unauthorized'] - Path for unauthorized access
 * @returns {Promise<import('next/server').NextResponse>} Response with RBAC handling
 * 
 * @example
 * // In middleware.js
 * import { enforceRBAC } from '@/utils/supabase/middleware';
 * 
 * export async function middleware(request) {
 *   return enforceRBAC(request, {
 *     '/admin': ['admin', 'super_admin'],
 *     '/dashboard': ['user', 'admin', 'super_admin'],
 *   });
 * }
 */
export async function enforceRBAC(request, roleConfig, unauthorizedPath = '/unauthorized') {
  const { supabase, response } = createMiddlewareClient(request);
  
  // Find matching role requirement
  const requiredRoles = Object.entries(roleConfig).find(([path]) => 
    request.nextUrl.pathname.startsWith(path)
  )?.[1];
  
  if (requiredRoles) {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (!user || error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Check user role (assumes role is stored in user metadata or custom claims)
    const userRole = user.user_metadata?.role || user.role;
    
    if (!requiredRoles.includes(userRole)) {
      return NextResponse.redirect(new URL(unauthorizedPath, request.url));
    }
  }
  
  return response;
}

// Default export
export default updateSession;