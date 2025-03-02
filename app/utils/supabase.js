'use client';

import { createClient } from '@supabase/supabase-js';

// Create a single supabase client for the entire app
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
	},
});

// Helper function to get the current user
export const getCurrentUser = async () => {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user;
};

// Helper function to check if a user is logged in
export const isAuthenticated = async () => {
	const user = await getCurrentUser();
	return !!user;
};

// Helper function for signing out
export const signOut = async () => {
	const { error } = await supabase.auth.signOut();
	return { error };
};

// Export other helper functions as needed
