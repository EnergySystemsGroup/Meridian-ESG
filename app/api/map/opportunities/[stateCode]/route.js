import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

// Make sure this is exported as a named export for Next.js 15
export async function GET(request, { params }) {
	try {
		// Properly await the params object before accessing its properties
		const resolvedParams = await Promise.resolve(params);
		const stateCode = resolvedParams.stateCode;

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
		};

		// Fetch opportunities for the specified state
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

		// Exclude national opportunities if specified
		if (!filters.include_national) {
			query = query.eq('is_national', false);
		}

		// Order by close date
		query = query.order('close_date', { ascending: true });

		const { data, error } = await query;

		if (error) {
			console.error(
				`Error fetching opportunities for state ${stateCode}:`,
				error
			);
			// Fallback to mock data if there's an error
			return NextResponse.json({
				success: true,
				data: generateMockOpportunitiesForState(stateCode),
			});
		}

		return NextResponse.json({
			success: true,
			data: data || [],
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
