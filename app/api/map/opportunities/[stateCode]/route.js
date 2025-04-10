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

		// Build filters from query parameters with extra safeguards
		const filters = {
			status: searchParams.get('status') || 'all',
			source_type: searchParams.get('source_type') || 'all',
			min_amount: searchParams.get('min_amount'),
			max_amount: searchParams.get('max_amount'),
			include_national: searchParams.get('include_national') !== 'false', // Default to true
			deadline_start: searchParams.get('deadline_start'),
			deadline_end: searchParams.get('deadline_end'),
			// Pagination parameters
			page: parseInt(searchParams.get('page') || '1', 10),
			pageSize: parseInt(searchParams.get('pageSize') || '10', 10),
		};

		// Handle categories as array
		const categories = searchParams.get('categories');
		if (categories) {
			filters.categories = categories.split(',');
		}

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

		// Enhanced logging for debugging
		console.log(
			`Map API opportunities for ${stateCode} with filters:`,
			JSON.stringify(filters, null, 2)
		);

		try {
			// --- Step 1: Fetch ALL matching IDs to get the total count ---
			let idQuery = supabase
				.from('funding_opportunities_with_geography')
				.select('id'); // Select only ID

			// Apply state filter
			idQuery = idQuery.or(
				`is_national.eq.true,eligible_states.cs.{${stateCode}}`
			);

			// Apply additional filters (same as before, but with safer handling)
			if (filters.status && filters.status !== 'all') {
				idQuery = idQuery.eq('status', filters.status);
			}

			// Add extra safeguards around source_type filtering
			if (filters.source_type && filters.source_type !== 'all') {
				console.log(`Applying source_type filter: ${filters.source_type}`);
				// Try with ilike for case-insensitive matching which could be more forgiving
				idQuery = idQuery.ilike('source_type_display', filters.source_type);
			}

			// Apply categories filter if present
			if (filters.categories && filters.categories.length > 0) {
				// Filter opportunities where any of the selected categories is in the opportunity's categories array
				idQuery = idQuery.overlaps('categories', filters.categories);
			}

			if (filters.min_amount) {
				idQuery = idQuery.gte('minimum_award', filters.min_amount);
			}

			if (filters.max_amount) {
				idQuery = idQuery.lte('maximum_award', filters.max_amount);
			}

			if (filters.deadline_start) {
				idQuery = idQuery.gte('close_date', filters.deadline_start);
			}

			if (filters.deadline_end) {
				idQuery = idQuery.lte('close_date', filters.deadline_end);
			}

			if (!filters.include_national) {
				idQuery = idQuery.eq('is_national', false);
			}

			// Execute ID query
			const { data: idData, error: idError } = await idQuery;

			if (idError) {
				console.error(
					`Error fetching opportunity IDs for count, state ${stateCode}:`,
					idError
				);
				// Return specific error for count failure
				return NextResponse.json(
					{
						success: false,
						error: `Failed to count opportunities: ${idError.message}`,
						details: { filters },
					},
					{ status: 500 }
				);
			}

			const totalCount = idData ? idData.length : 0;
			console.log(
				`Found ${totalCount} matching opportunities for the given filters`
			);

			// --- Step 2: Fetch the paginated data ---
			let dataQuery = supabase
				.from('funding_opportunities_with_geography')
				.select('*'); // Select all columns for the actual data

			// Apply state filter
			dataQuery = dataQuery.or(
				`is_national.eq.true,eligible_states.cs.{${stateCode}}`
			);

			// Apply additional filters (same as for idQuery, with safe handling)
			if (filters.status && filters.status !== 'all') {
				dataQuery = dataQuery.eq('status', filters.status);
			}

			// Add extra safeguards around source_type filtering
			if (filters.source_type && filters.source_type !== 'all') {
				console.log(
					`Applying source_type filter to data query: ${filters.source_type}`
				);
				// Try with ilike for case-insensitive matching
				dataQuery = dataQuery.ilike('source_type_display', filters.source_type);
			}

			// Apply categories filter if present
			if (filters.categories && filters.categories.length > 0) {
				// Filter opportunities where any of the selected categories is in the opportunity's categories array
				dataQuery = dataQuery.overlaps('categories', filters.categories);
			}

			if (filters.min_amount) {
				dataQuery = dataQuery.gte('minimum_award', filters.min_amount);
			}

			if (filters.max_amount) {
				dataQuery = dataQuery.lte('maximum_award', filters.max_amount);
			}

			if (filters.deadline_start) {
				dataQuery = dataQuery.gte('close_date', filters.deadline_start);
			}

			if (filters.deadline_end) {
				dataQuery = dataQuery.lte('close_date', filters.deadline_end);
			}

			if (!filters.include_national) {
				dataQuery = dataQuery.eq('is_national', false);
			}

			// Order by close date
			dataQuery = dataQuery.order('close_date', { ascending: true });

			// Apply pagination
			dataQuery = dataQuery.range(from, to);

			// Execute data query
			const { data, error } = await dataQuery;

			if (error) {
				console.error(
					`Error fetching opportunities data for state ${stateCode}:`,
					error
				);
				return NextResponse.json(
					{
						success: false,
						error: error.message,
						details: { filters },
					},
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
					total: totalCount, // Use the count derived from idData.length
					page: filters.page,
					pageSize: filters.pageSize,
					totalPages: totalCount ? Math.ceil(totalCount / filters.pageSize) : 0,
				},
			});
		} catch (innerError) {
			console.error('Error in query execution:', innerError);
			return NextResponse.json(
				{
					success: false,
					error: `Query execution error: ${innerError.message}`,
					details: { stateCode, filters },
				},
				{ status: 500 }
			);
		}
	} catch (outerError) {
		console.error('API Error:', outerError);
		return NextResponse.json(
			{ success: false, error: `API processing error: ${outerError.message}` },
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
