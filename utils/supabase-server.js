import { createClient } from '@supabase/supabase-js';

// This is a server-side client and should only be used in Server Components or API routes
export const createServerSupabaseClient = () => {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Missing Supabase environment variables');
	}

	return createClient(supabaseUrl, supabaseAnonKey, {
		auth: {
			persistSession: false,
		},
	});
};

// Create a singleton instance for server-side usage
let serverSupabase;

export const getServerSupabaseClient = () => {
	if (!serverSupabase) {
		serverSupabase = createServerSupabaseClient();
	}
	return serverSupabase;
};

// Helper function to fetch data from Supabase on the server
export async function fetchFromSupabase(tableName, query = {}) {
	const supabase = getServerSupabaseClient();

	let queryBuilder = supabase.from(tableName).select();

	// Apply filters if provided
	if (query.filters) {
		for (const [column, value] of Object.entries(query.filters)) {
			queryBuilder = queryBuilder.eq(column, value);
		}
	}

	// Apply order if provided
	if (query.orderBy) {
		queryBuilder = queryBuilder.order(query.orderBy.column, {
			ascending: query.orderBy.ascending,
		});
	}

	// Apply pagination if provided
	if (query.limit) {
		queryBuilder = queryBuilder.limit(query.limit);
	}

	if (query.offset) {
		queryBuilder = queryBuilder.range(
			query.offset,
			query.offset + (query.limit || 10) - 1
		);
	}

	const { data, error } = await queryBuilder;

	if (error) {
		console.error('Error fetching from Supabase:', error);
		throw error;
	}

	return data;
}
