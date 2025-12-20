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

	// IMPORTANT: Do not run code between createServerClient and
	// supabase.auth.getUser(). A simple mistake could make it very
	// difficult to debug issues.

	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	// Public routes that don't require authentication
	const publicRoutes = ['/login', '/auth/callback'];
	const isPublicRoute = publicRoutes.some((route) =>
		request.nextUrl.pathname.startsWith(route)
	);

	// If on public route, allow access
	if (isPublicRoute) {
		return supabaseResponse;
	}

	// TEMPORARILY DISABLED - waiting for IT to configure Azure AD
	// If not authenticated, redirect to login
	// if (!user || error) {
	// 	const loginUrl = new URL('/login', request.url);
	// 	loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
	// 	return NextResponse.redirect(loginUrl);
	// }

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
