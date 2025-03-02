'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

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

	// Function to sign in with email and password
	const signInWithEmail = async (email, password) => {
		try {
			setLoading(true);
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				throw error;
			}

			setUser(data.user);
			return data;
		} catch (error) {
			setError(error.message);
			return { error };
		} finally {
			setLoading(false);
		}
	};

	// Function to sign up with email and password
	const signUpWithEmail = async (email, password) => {
		try {
			setLoading(true);
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
			});

			if (error) {
				throw error;
			}

			return data;
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
	}, []);

	// Value to be provided by the context
	const value = {
		user,
		loading,
		error,
		signInWithEmail,
		signUpWithEmail,
		signOut,
		isAuthenticated: !!user,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
