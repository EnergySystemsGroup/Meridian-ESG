import { createClient } from '@supabase/supabase-js';

// Create a default supabase client for direct imports
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Export a default supabase client for direct imports
export const supabase = createClient(supabaseUrl, supabaseKey, {
	auth: {
		persistSession: false,
	},
});

// Initialize the Supabase client with environment variables
export function createSupabaseClient() {
	if (!supabaseUrl || !supabaseKey) {
		throw new Error('Missing Supabase environment variables');
	}

	return createClient(supabaseUrl, supabaseKey, {
		auth: {
			persistSession: false,
		},
	});
}

// Initialize the Supabase client with admin privileges for server-side operations
export function createAdminSupabaseClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !supabaseServiceRoleKey) {
		throw new Error('Missing Supabase admin environment variables');
	}

	return createClient(supabaseUrl, supabaseServiceRoleKey, {
		auth: {
			persistSession: false,
		},
	});
}

// Initialize the Supabase client for client-side operations
export function createClientSupabaseClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Missing Supabase client environment variables');
	}

	return createClient(supabaseUrl, supabaseAnonKey);
}

// Helper function to log API activity
export async function logApiActivity(
	supabase,
	sourceId,
	action,
	status,
	details = {}
) {
	try {
		await supabase.from('api_activity_logs').insert({
			source_id: sourceId,
			action,
			status,
			details,
		});
	} catch (error) {
		console.error('Error logging API activity:', error);
	}
}

// Helper function to log agent execution
export async function logAgentExecution(
	supabase,
	agentType,
	input,
	output,
	executionTime,
	tokenUsage,
	error = null
) {
	try {
		await supabase.from('agent_executions').insert({
			agent_type: agentType,
			input,
			output,
			execution_time: executionTime,
			token_usage: tokenUsage,
			error: error ? String(error) : null,
		});
	} catch (logError) {
		console.error('Error logging agent execution:', logError);
	}
}

// Funding Opportunities API
export const fundingApi = {
	// Get all funding opportunities with optional filters
	getOpportunities: async (filters = {}) => {
		try {
			let query = supabase
				.from('funding_opportunities_with_geography')
				.select('*');

			// Apply filters
			if (filters.status) {
				// Convert status to lowercase to match database values
				query = query.ilike('status', filters.status.toLowerCase());
			}

			if (filters.min_amount) {
				query = query.gte('minimum_award', filters.min_amount);
			}

			if (filters.max_amount) {
				query = query.lte('maximum_award', filters.max_amount);
			}

			if (filters.close_date_after) {
				query = query.gte('close_date', filters.close_date_after);
			}

			if (filters.close_date_before) {
				query = query.lte('close_date', filters.close_date_before);
			}

			// Apply categories filter
			if (filters.categories && filters.categories.length > 0) {
				query = query.contains('categories', filters.categories);
			}

			// Apply states filter
			if (filters.states && filters.states.length > 0) {
				// National filter is handled specially
				if (filters.states.includes('National')) {
					// Include both national opportunities and those for any other selected states
					const otherStates = filters.states.filter(
						(state) => state !== 'National'
					);
					if (otherStates.length > 0) {
						// If other states are selected along with National, get both national opportunities
						// and opportunities specific to those states
						query = query.or(
							`is_national.eq.true,eligible_locations.cs.{${otherStates.join(
								','
							)}}`
						);
					} else {
						// If only National is selected, just get national opportunities
						query = query.eq('is_national', true);
					}
				} else {
					// Filter for specific states using eligible_locations which has full state names
					// rather than eligible_states which has abbreviations
					query = query.or(
						`is_national.eq.true,eligible_locations.cs.{${filters.states.join(
							','
						)}}`
					);
				}
			}

			// Apply sorting
			if (filters.sort_by) {
				const direction = filters.sort_direction === 'desc' ? true : false;
				query = query.order(filters.sort_by, { ascending: !direction });
			} else {
				// Default sort by close_date
				query = query.order('close_date', { ascending: true });
			}

			// Apply pagination
			const page = filters.page || 1;
			const pageSize = filters.page_size || 10;
			const start = (page - 1) * pageSize;
			const end = start + pageSize - 1;
			query = query.range(start, end);

			// Debug: Log the constructed query
			console.log('Supabase query:', query);

			const { data, error } = await query;

			if (error) throw error;
			return data;
		} catch (error) {
			console.error('Error fetching opportunities:', error);
			throw error;
		}
	},

	// Get a single funding opportunity by ID
	getOpportunityById: async (id) => {
		try {
			const { data, error } = await supabase
				.from('funding_opportunities_with_geography')
				.select('*')
				.eq('id', id)
				.single();

			if (error) throw error;
			return data;
		} catch (error) {
			console.error('Error fetching opportunity by ID:', error);
			throw error;
		}
	},

	// Get recent opportunities
	getRecentOpportunities: async (limit = 5) => {
		const { data, error } = await supabase
			.from('funding_opportunities')
			.select('*')
			.order('posted_date', { ascending: false })
			.limit(limit);

		if (error) {
			console.error('Error fetching recent opportunities:', error);
			throw error;
		}

		return data;
	},

	// Get upcoming deadlines
	getUpcomingDeadlines: async (limit = 5) => {
		try {
			const today = new Date().toISOString();

			const { data, error } = await supabase
				.from('funding_opportunities')
				.select('*')
				.gte('close_date', today)
				.order('close_date', { ascending: true })
				.limit(limit);

			if (error) {
				throw error;
			}

			return data;
		} catch (error) {
			console.error('Error fetching upcoming deadlines:', error);
			// Return mock data as fallback
			return getMockDeadlines(limit);
		}
	},

	// Get funding sources
	getFundingSources: async () => {
		try {
			const { data, error } = await supabase
				.from('funding_sources')
				.select('*')
				.order('name', { ascending: true });

			if (error) {
				throw error;
			}

			return data;
		} catch (error) {
			console.error('Error fetching funding sources:', error);
			// Return mock data as fallback
			return getMockFundingSources();
		}
	},

	// Get funding applications for a client
	getClientApplications: async (clientId) => {
		try {
			const { data, error } = await supabase
				.from('funding_applications')
				.select('*') // Simplified query without joins
				.eq('client_id', clientId)
				.order('next_deadline', { ascending: true });

			if (error) {
				throw error;
			}

			return data;
		} catch (error) {
			console.error(
				`Error fetching applications for client ${clientId}:`,
				error
			);
			// Return mock data as fallback
			return getMockClientApplications(clientId);
		}
	},
};

// Helper function to calculate days left until a deadline
export const calculateDaysLeft = (closeDate) => {
	const today = new Date();
	const deadline = new Date(closeDate);
	const diffTime = Math.abs(deadline - today);
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	return diffDays;
};

// Helper function to determine status based on dates
export const determineStatus = (openDate, closeDate) => {
	const today = new Date();
	const open = openDate ? new Date(openDate) : null;
	const close = new Date(closeDate);

	if (close < today) {
		return 'Closed';
	} else if (open && open > today) {
		return 'Upcoming';
	} else {
		return 'Open';
	}
};

// Mock data functions for fallback
function getMockDeadlines(limit = 5) {
	const mockDeadlines = [
		{
			id: 1,
			title: 'Clean Energy Innovation Fund',
			source_name: 'California Energy Commission',
			close_date: '2023-04-30T00:00:00Z',
			description:
				'Funding for innovative clean energy projects that reduce greenhouse gas emissions and promote energy independence.',
		},
		{
			id: 2,
			title: 'School Modernization Program',
			source_name: 'Department of Education',
			close_date: '2023-05-01T00:00:00Z',
			description:
				'Grants for K-12 schools to modernize facilities with a focus on energy efficiency, indoor air quality, and sustainability improvements.',
		},
		{
			id: 3,
			title: 'Community Climate Resilience Grant',
			source_name: 'EPA',
			close_date: '2023-05-15T00:00:00Z',
			description:
				'Support for communities to develop and implement climate resilience strategies, including building upgrades and infrastructure improvements.',
		},
		{
			id: 4,
			title: 'Solar for Schools Initiative',
			source_name: 'California Energy Commission',
			close_date: '2023-05-20T00:00:00Z',
			description:
				'Grants to install solar photovoltaic systems on K-12 school facilities to reduce energy costs and provide educational opportunities.',
		},
		{
			id: 5,
			title: 'Zero Emission School Bus Program',
			source_name: 'EPA',
			close_date: '2023-05-30T00:00:00Z',
			description:
				'Grants to replace diesel school buses with zero-emission electric buses and install necessary charging infrastructure.',
		},
		{
			id: 6,
			title: 'Municipal Building Retrofit Program',
			source_name: 'Department of Energy',
			close_date: '2023-06-01T00:00:00Z',
			description:
				'Funding for local governments to retrofit municipal buildings for improved energy efficiency and reduced operational costs.',
		},
		{
			id: 7,
			title: 'Building Electrification Program',
			source_name: 'Oregon Department of Energy',
			close_date: '2023-06-15T00:00:00Z',
			description:
				'Incentives for building owners to convert from fossil fuel systems to electric alternatives for heating, cooling, and water heating.',
		},
		{
			id: 8,
			title: 'Energy Storage Demonstration Grant',
			source_name: 'Department of Energy',
			close_date: '2023-07-01T00:00:00Z',
			description:
				'Funding for demonstration projects that integrate energy storage with renewable energy systems in commercial and institutional buildings.',
		},
	];

	return mockDeadlines.slice(0, limit);
}

function getMockFundingSources() {
	return [
		{ id: 1, name: 'Department of Energy', type: 'Federal' },
		{ id: 2, name: 'Environmental Protection Agency', type: 'Federal' },
		{ id: 3, name: 'Department of Education', type: 'Federal' },
		{ id: 4, name: 'California Energy Commission', type: 'State' },
		{ id: 5, name: 'Oregon Department of Energy', type: 'State' },
	];
}

function getMockClientApplications(clientId) {
	return [
		{
			id: 1,
			client_id: clientId,
			opportunity_id: 1,
			status: 'In Progress',
			next_deadline: '2023-04-15T00:00:00Z',
			notes: 'Need to complete budget section',
		},
		{
			id: 2,
			client_id: clientId,
			opportunity_id: 3,
			status: 'Draft',
			next_deadline: '2023-05-01T00:00:00Z',
			notes: 'Waiting for client to provide project details',
		},
	];
}
