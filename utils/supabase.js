import { createClient } from '@supabase/supabase-js';

// Create a single supabase client for the entire app
// Works on both client and server
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Missing Supabase environment variables');
}

// Server-side Supabase instance (no auth persistence)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: false,
		autoRefreshToken: false,
	},
});

// These functions are moved to supabase-client.js for client-side use
// Keeping stubs here for backward compatibility
export const getCurrentUser = async () => {
	console.warn('getCurrentUser should be imported from @/utils/supabase-client for client-side use');
	return null;
};

export const isAuthenticated = async () => {
	console.warn('isAuthenticated should be imported from @/utils/supabase-client for client-side use');
	return false;
};

export const signOut = async () => {
	console.warn('signOut should be imported from @/utils/supabase-client for client-side use');
	return { error: new Error('Use supabase-client for client-side auth') };
};

// Factory function to create a new Supabase client (for RunManagerV2 compatibility)
// Works on both client and server
export const createSupabaseClient = () => {
	// Use environment variables that work on both client and server
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	
	if (!url || !key) {
		throw new Error('Missing Supabase environment variables');
	}
	
	return createClient(url, key, {
		auth: {
			persistSession: typeof window !== 'undefined', // Only persist on client
			autoRefreshToken: typeof window !== 'undefined', // Only auto-refresh on client
		},
	});
};

// Agent execution logging function (for agents-v2 compatibility)
export const logAgentExecution = async (agentName, executionData) => {
	try {
		const { error } = await supabase
			.from('agent_execution_logs')
			.insert({
				agent_name: agentName,
				execution_data: executionData,
				timestamp: new Date().toISOString()
			});
		
		if (error) {
			console.warn(`Failed to log agent execution for ${agentName}:`, error);
		}
	} catch (err) {
		console.warn(`Error logging agent execution for ${agentName}:`, err);
	}
};

// Export other helper functions as needed
