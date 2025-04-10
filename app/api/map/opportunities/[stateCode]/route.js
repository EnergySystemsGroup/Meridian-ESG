import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

// Make sure this is exported as a named export for Next.js 15
export async function GET(request, context) {
	try {
		// Properly await the params object before accessing its properties
		const params = await context.params;
		const stateCode = params.stateCode;

		if (!stateCode) {
			return NextResponse.json(
				{ success: false, error: 'State code is required' },
				{ status: 400 }
			);
		}

		// Get URL parameters
		const { searchParams } = new URL(request.url);

		// Build filters from query parameters
		const filters = {
			status: searchParams.get('status'),
			source_type: searchParams.get('source_type'),
			min_amount: searchParams.get('min_amount'),
			max_amount: searchParams.get('max_amount'),
			include_national: searchParams.get('include_national') !== 'false', // Default to true
			deadline_start: searchParams.get('deadline_start'),
			deadline_end: searchParams.get('deadline_end'),
			// Pagination parameters
			page: parseInt(searchParams.get('page') || '1', 10),
			pageSize: parseInt(searchParams.get('pageSize') || '10', 10),
		};

		// Ensure page and pageSize are valid
		if (isNaN(filters.page) || filters.page < 1) filters.page = 1;
		if (
			isNaN(filters.pageSize) ||
			filters.pageSize < 1 ||
			filters.pageSize > 50
		)
			filters.pageSize = 10;

		// Calculate pagination values
		const from = (filters.page - 1) * filters.pageSize;
		const to = from + filters.pageSize - 1;

		// Log the filters for debugging
		console.log(
			`Map API opportunities for ${stateCode} with filters:`,
			filters
		);

		// Fetch opportunities for the specified state - first get count for pagination
		let countQuery = supabase
			.from('funding_opportunities_with_geography')
			.select('id', { count: 'exact', head: true });

		// Apply filters
		// State filter
		countQuery = countQuery.or(
			`is_national.eq.true,eligible_states.cs.{${stateCode}}`
		);

		// Additional filters
		if (filters.status && filters.status !== 'all') {
			countQuery = countQuery.eq('status', filters.status);
		}

		if (filters.source_type && filters.source_type !== 'all') {
			countQuery = countQuery.eq('source_type', filters.source_type);
		}

		if (filters.min_amount) {
			countQuery = countQuery.gte('minimum_award', filters.min_amount);
		}

		if (filters.max_amount) {
			countQuery = countQuery.lte('maximum_award', filters.max_amount);
		}

		// Apply deadline range filters if provided
		if (filters.deadline_start) {
			countQuery = countQuery.gte('close_date', filters.deadline_start);
		}

		if (filters.deadline_end) {
			countQuery = countQuery.lte('close_date', filters.deadline_end);
		}

		// Exclude national opportunities if specified
		if (!filters.include_national) {
			countQuery = countQuery.eq('is_national', false);
		}

		// Execute count query
		const { count, error: countError } = await countQuery;

		if (countError) {
			console.error(
				`Error counting opportunities for state ${stateCode}:`,
				countError
			);
			return NextResponse.json(
				{ success: false, error: countError.message },
				{ status: 500 }
			);
		}

		// Now fetch the actual opportunities with pagination
		let query = supabase
			.from('funding_opportunities_with_geography')
			.select('*');

		// Apply state filter
		query = query.or(`is_national.eq.true,eligible_states.cs.{${stateCode}}`);

		// Apply additional filters
		if (filters.status && filters.status !== 'all') {
			query = query.eq('status', filters.status);
		}

		if (filters.source_type && filters.source_type !== 'all') {
			query = query.eq('source_type', filters.source_type);
		}

		if (filters.min_amount) {
			query = query.gte('minimum_award', filters.min_amount);
		}

		if (filters.max_amount) {
			query = query.lte('maximum_award', filters.max_amount);
		}

		// Apply deadline range filters if provided
		if (filters.deadline_start) {
			query = query.gte('close_date', filters.deadline_start);
		}

		if (filters.deadline_end) {
			query = query.lte('close_date', filters.deadline_end);
		}

		// Exclude national opportunities if specified
		if (!filters.include_national) {
			query = query.eq('is_national', false);
		}

		// Order by close date
		query = query.order('close_date', { ascending: true });

		// Apply pagination
		query = query.range(from, to);

		const { data, error } = await query;

		if (error) {
			console.error(
				`Error fetching opportunities for state ${stateCode}:`,
				error
			);
			return NextResponse.json(
				{ success: false, error: error.message },
				{ status: 500 }
			);
		}

		if (!data || data.length === 0) {
			console.log(
				`No opportunities found for state ${stateCode} with the given filters`
			);
		}

		return NextResponse.json({
			success: true,
			data: {
				opportunities: data || [],
				total: count || 0,
				page: filters.page,
				pageSize: filters.pageSize,
				totalPages: count ? Math.ceil(count / filters.pageSize) : 0,
			},
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}

// Mock data generation function for fallback
function generateMockOpportunitiesForState(stateCode) {
	// Get state name from code
	const stateName = getStateName(stateCode);

	// Number of opportunities to generate
	const count = Math.floor(Math.random() * 8) + 2;

	// Generate mock opportunities
	const opportunities = [];
	for (let i = 0; i < count; i++) {
		const isFederal = Math.random() > 0.5;
		const isNational = isFederal && Math.random() > 0.3;

		opportunities.push({
			id: `opp-${stateCode.toLowerCase()}-${i}`,
			title: isFederal
				? `Federal ${getRandomFundingType()} for ${getRandomSector()}`
				: `${stateName} ${getRandomFundingType()} for ${getRandomSector()}`,
			minimum_award: Math.floor(Math.random() * 100000) + 50000,
			maximum_award: Math.floor(Math.random() * 900000) + 100000,
			close_date: getRandomFutureDate(),
			source_name: isFederal
				? getRandomFederalAgency()
				: `${stateName} Department of ${getRandomStateAgency()}`,
			source_type: isFederal ? 'Federal' : 'State',
			is_national: isNational,
			status: getRandomStatus(),
			eligible_states: isNational ? [] : [stateCode],
		});
	}

	return opportunities;
}

// Helper functions for mock data
function getStateName(stateCode) {
	const stateNames = {
		AL: 'Alabama',
		AK: 'Alaska',
		AZ: 'Arizona',
		AR: 'Arkansas',
		CA: 'California',
		CO: 'Colorado',
		CT: 'Connecticut',
		DE: 'Delaware',
		FL: 'Florida',
		GA: 'Georgia',
		HI: 'Hawaii',
		ID: 'Idaho',
		IL: 'Illinois',
		IN: 'Indiana',
		IA: 'Iowa',
		KS: 'Kansas',
		KY: 'Kentucky',
		LA: 'Louisiana',
		ME: 'Maine',
		MD: 'Maryland',
		MA: 'Massachusetts',
		MI: 'Michigan',
		MN: 'Minnesota',
		MS: 'Mississippi',
		MO: 'Missouri',
		MT: 'Montana',
		NE: 'Nebraska',
		NV: 'Nevada',
		NH: 'New Hampshire',
		NJ: 'New Jersey',
		NM: 'New Mexico',
		NY: 'New York',
		NC: 'North Carolina',
		ND: 'North Dakota',
		OH: 'Ohio',
		OK: 'Oklahoma',
		OR: 'Oregon',
		PA: 'Pennsylvania',
		RI: 'Rhode Island',
		SC: 'South Carolina',
		SD: 'South Dakota',
		TN: 'Tennessee',
		TX: 'Texas',
		UT: 'Utah',
		VT: 'Vermont',
		VA: 'Virginia',
		WA: 'Washington',
		WV: 'West Virginia',
		WI: 'Wisconsin',
		WY: 'Wyoming',
		DC: 'District of Columbia',
	};

	return stateNames[stateCode] || stateCode;
}

function getRandomFundingType() {
	const types = [
		'Grant',
		'Loan Program',
		'Tax Credit',
		'Rebate',
		'Incentive Program',
	];
	return types[Math.floor(Math.random() * types.length)];
}

function getRandomSector() {
	const sectors = [
		'Energy Efficiency',
		'Renewable Energy',
		'Building Modernization',
		'Infrastructure',
		'Climate Resilience',
		'Water Conservation',
	];
	return sectors[Math.floor(Math.random() * sectors.length)];
}

function getRandomFederalAgency() {
	const agencies = [
		'Department of Energy',
		'EPA',
		'Department of Agriculture',
		'Department of Transportation',
		'Department of Housing',
	];
	return agencies[Math.floor(Math.random() * agencies.length)];
}

function getRandomStateAgency() {
	const agencies = [
		'Energy',
		'Environmental Protection',
		'Natural Resources',
		'Transportation',
		'Housing',
	];
	return agencies[Math.floor(Math.random() * agencies.length)];
}

function getRandomFutureDate() {
	const today = new Date();
	const futureDate = new Date(today);
	futureDate.setDate(today.getDate() + Math.floor(Math.random() * 90) + 10);
	return futureDate.toISOString();
}

function getRandomStatus() {
	const statuses = ['Open', 'Upcoming', 'Closed'];
	const weights = [0.6, 0.3, 0.1]; // 60% Open, 30% Upcoming, 10% Closed

	const random = Math.random();
	let sum = 0;

	for (let i = 0; i < statuses.length; i++) {
		sum += weights[i];
		if (random < sum) {
			return statuses[i];
		}
	}

	return statuses[0];
}
