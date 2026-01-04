'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

function LoginContent() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [checkingAuth, setCheckingAuth] = useState(true);
	const searchParams = useSearchParams();
	const router = useRouter();
	const supabase = createClient();

	// Check for error in URL (from failed OAuth callback)
	useEffect(() => {
		const errorParam = searchParams.get('error');
		const errorDescription = searchParams.get('error_description');
		if (errorParam) {
			setError(errorDescription || 'Authentication failed. Please try again.');
		}
	}, [searchParams]);

	// Check if already authenticated
	useEffect(() => {
		async function checkAuth() {
			try {
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (user) {
					const redirectTo = searchParams.get('redirectTo') || '/';
					router.replace(redirectTo);
				}
			} catch (err) {
				console.error('Auth check error:', err);
			} finally {
				setCheckingAuth(false);
			}
		}
		checkAuth();
	}, [supabase, router, searchParams]);

	const handleMicrosoftSignIn = async () => {
		try {
			setLoading(true);
			setError(null);

			const redirectTo = searchParams.get('redirectTo') || '/';

			const { error } = await supabase.auth.signInWithOAuth({
				provider: 'azure',
				options: {
					scopes: 'email profile openid',
					redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
				},
			});

			if (error) {
				throw error;
			}
			// User will be redirected to Microsoft login
		} catch (err) {
			console.error('Sign in error:', err);
			setError(err.message || 'Failed to initiate sign in. Please try again.');
			setLoading(false);
		}
	};

	// Show loading while checking auth status
	if (checkingAuth) {
		return (
			<div className='min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950'>
				<Spinner className='h-8 w-8' />
			</div>
		);
	}

	return (
		<div className='min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4'>
			<Card className='w-full max-w-md'>
				<CardHeader className='text-center'>
					<div className='mb-4'>
						<span className='font-extrabold text-3xl text-blue-600 dark:text-blue-400'>
							Meridian
						</span>
						<p className='text-sm text-neutral-500 dark:text-neutral-400 mt-1'>
							Policy & Funding Intelligence
						</p>
					</div>
					<CardTitle className='text-2xl'>Welcome Back</CardTitle>
					<CardDescription>
						Sign in with your organization account to continue
					</CardDescription>
				</CardHeader>
				<CardContent className='space-y-4'>
					{error && (
						<Alert variant='destructive'>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<Button
						onClick={handleMicrosoftSignIn}
						disabled={loading}
						className='w-full h-12 text-base'
						size='lg'>
						{loading ? (
							<>
								<Spinner className='mr-2 h-5 w-5' />
								Redirecting to Microsoft...
							</>
						) : (
							<>
								{/* Microsoft Logo */}
								<svg className='mr-2 h-5 w-5' viewBox='0 0 21 21'>
									<rect x='1' y='1' width='9' height='9' fill='#f25022' />
									<rect x='11' y='1' width='9' height='9' fill='#00a4ef' />
									<rect x='1' y='11' width='9' height='9' fill='#7fba00' />
									<rect x='11' y='11' width='9' height='9' fill='#ffb900' />
								</svg>
								Sign in with Microsoft
							</>
						)}
					</Button>

					<p className='text-center text-sm text-neutral-500 dark:text-neutral-400'>
						Contact your administrator if you need access
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<div className='min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950'>
					<Spinner className='h-8 w-8' />
				</div>
			}>
			<LoginContent />
		</Suspense>
	);
}
