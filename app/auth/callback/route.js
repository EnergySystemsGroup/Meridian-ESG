import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
	const requestUrl = new URL(request.url);
	const code = requestUrl.searchParams.get('code');
	const redirectTo = requestUrl.searchParams.get('redirectTo') || '/';
	const error = requestUrl.searchParams.get('error');
	const errorDescription = requestUrl.searchParams.get('error_description');

	// Handle OAuth errors from the provider
	if (error) {
		const loginUrl = new URL('/login', requestUrl.origin);
		loginUrl.searchParams.set('error', error);
		if (errorDescription) {
			loginUrl.searchParams.set('error_description', errorDescription);
		}
		return NextResponse.redirect(loginUrl);
	}

	if (code) {
		const cookieStore = await cookies();

		const supabase = createServerClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
				process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
			{
				cookies: {
					getAll() {
						return cookieStore.getAll();
					},
					setAll(cookiesToSet) {
						cookiesToSet.forEach(({ name, value, options }) => {
							cookieStore.set(name, value, options);
						});
					},
				},
			}
		);

		const { error: exchangeError } =
			await supabase.auth.exchangeCodeForSession(code);

		if (exchangeError) {
			console.error('Code exchange error:', exchangeError);
			const loginUrl = new URL('/login', requestUrl.origin);
			loginUrl.searchParams.set('error', 'exchange_failed');
			loginUrl.searchParams.set('error_description', exchangeError.message);
			return NextResponse.redirect(loginUrl);
		}

		// Successfully authenticated - redirect to intended destination
		return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
	}

	// No code provided - redirect to login
	return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
