import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
	// Create a response object to modify
	let supabaseResponse = NextResponse.next({
		request: {
			headers: request.headers,
		},
	});

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
			process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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

	// In development mode, auto-authenticate as dev admin user.
	// This creates a real session so all auth code (requireRole, getUser, etc.)
	// works through the normal code path — no special dev bypasses needed.
	if (process.env.NODE_ENV === 'development') {
		const { data: { user } } = await supabase.auth.getUser();

		if (!user) {
			// No session yet — sign in as the seeded dev admin
			const { error: signInError } = await supabase.auth.signInWithPassword({
				email: process.env.DEV_ADMIN_EMAIL,
				password: process.env.DEV_ADMIN_PASSWORD,
			});

			if (signInError) {
				// Dev user may not exist (fresh DB) — fall through without auth
				console.warn('[Dev Auth] Auto sign-in failed:', signInError.message);
			}
		}

		return supabaseResponse;
	}

	// IMPORTANT: Do not run code between createServerClient and
	// supabase.auth.getUser(). A simple mistake could make it very
	// difficult to debug issues.

	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	// Public routes that don't require authentication
	const publicRoutes = ['/login', '/auth/callback', '/api/cron'];
	const isPublicRoute = publicRoutes.some((route) =>
		request.nextUrl.pathname.startsWith(route)
	);

	// If on public route, allow access
	if (isPublicRoute) {
		return supabaseResponse;
	}

	// If not authenticated, redirect to login
	if (!user || error) {
		const loginUrl = new URL('/login', request.url);
		loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
		return NextResponse.redirect(loginUrl);
	}

	// Admin routes require admin role
	if (request.nextUrl.pathname.startsWith('/admin')) {
		const userRole = user.app_metadata?.role;
		if (userRole !== 'admin') {
			return NextResponse.redirect(new URL('/', request.url));
		}
	}

	// User is authenticated - allow access
	return supabaseResponse;
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public files (images, etc)
		 * - api routes that should be public (if any)
		 */
		'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
	],
};
