'use client';

import { createClient } from '@supabase/supabase-js';

// Client-side only Supabase utilities
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Missing Supabase environment variables');
}

// Client-side Supabase instance with auth persistence
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
	},
});

// Re-export client utilities that need 'use client'
export const getCurrentUser = async () => {
	const {
		data: { user },
	} = await supabaseClient.auth.getUser();
	return user;
};

export const isAuthenticated = async () => {
	const user = await getCurrentUser();
	return !!user;
};

export const signOut = async () => {
	const { error } = await supabaseClient.auth.signOut();
	return { error };
};