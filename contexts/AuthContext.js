'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

// Create the authentication context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};

// Auth provider component
export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const supabase = createClient();

	// Function to sign in with Microsoft SSO
	const signInWithMicrosoft = async (redirectTo = '/') => {
		try {
			setLoading(true);
			setError(null);

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
			// User will be redirected to Microsoft
		} catch (error) {
			setError(error.message);
			return { error };
		} finally {
			setLoading(false);
		}
	};

	// Function to sign out
	const signOut = async () => {
		try {
			setLoading(true);
			const { error } = await supabase.auth.signOut();

			if (error) {
				throw error;
			}

			setUser(null);
			// Redirect to login after sign out
			window.location.href = '/login';
		} catch (error) {
			setError(error.message);
			return { error };
		} finally {
			setLoading(false);
		}
	};

	// Listen for authentication state changes
	useEffect(() => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			if (session?.user) {
				setUser(session.user);
			} else {
				setUser(null);
			}
			setLoading(false);
		});

		// Check for existing session
		const checkUser = async () => {
			try {
				const {
					data: { user },
				} = await supabase.auth.getUser();
				setUser(user);
			} catch (error) {
				setError(error.message);
			} finally {
				setLoading(false);
			}
		};

		checkUser();

		return () => {
			subscription?.unsubscribe();
		};
	}, [supabase]);

	// Value to be provided by the context
	const value = {
		user,
		loading,
		error,
		signInWithMicrosoft,
		signOut,
		isAuthenticated: !!user,
		// Helper to get user display name from Microsoft user metadata
		displayName:
			user?.user_metadata?.full_name ||
			user?.user_metadata?.name ||
			user?.email,
		// Helper to get user email
		email: user?.email,
		// Helper to get user avatar from Microsoft
		avatarUrl: user?.user_metadata?.avatar_url || user?.user_metadata?.picture,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
