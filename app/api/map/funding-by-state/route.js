import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Make sure this is exported as a named export for Next.js 15
export async function GET(request) {
	try {
		// Get URL parameters
		const { searchParams } = new URL(request.url);

		// Map API parameters to function parameters with correct names
		const filters = {
			p_status: searchParams.get('status'),
			p_source_type: searchParams.get('source_type'),
			p_min_amount: searchParams.get('min_amount')
				? parseFloat(searchParams.get('min_amount'))
				: null,
		};

		// Only add max_amount if it's greater than 0
		const maxAmount = searchParams.get('max_amount');
		if (maxAmount && parseFloat(maxAmount) > 0) {
			filters.p_max_amount = parseFloat(maxAmount);
		} else {
			// Don't include max_amount if it's 0 or null
			filters.p_max_amount = null;
		}

		// Handle categories as array
		const categories = searchParams.get('categories');
		if (categories) {
			filters.p_categories = categories.split(',');
		}

		// Log the filters being sent to the database
		console.log(
			'API filters being sent to database:',
			JSON.stringify(filters, null, 2)
		);

		// Fetch aggregated funding data by state using the v3 function that correctly calculates total funding
		const { data, error } = await supabase.rpc(
			'get_funding_by_state_v3',
			filters
		);

		if (error) {
			console.error('Error fetching funding data:', error);
			// Fallback to the original function if the new one fails
			const fallbackResult = await supabase.rpc(
				'get_funding_by_state',
				filters
			);

			if (fallbackResult.error) {
				console.error(
					'Fallback also failed, using mock data:',
					fallbackResult.error
				);
				// Use mock data as final fallback
				return NextResponse.json({
					success: true,
					data: generateMockStateData(),
					source: 'mock',
				});
			}

			return NextResponse.json({
				success: true,
				data: fallbackResult.data,
				source: 'v1',
			});
		}

		// Fetch all three metrics using the specialized functions
		// 1. Total Funding Available
		const { data: totalFundingResult, error: totalFundingError } =
			await supabase.rpc('get_total_funding_available', filters);

		// 2. Total Opportunities Count
		const { data: totalOpportunitiesResult, error: totalOpportunitiesError } =
			await supabase.rpc('get_total_opportunities_count', filters);

		// 3. States with Funding Count
		const { data: statesWithFundingResult, error: statesWithFundingError } =
			await supabase.rpc('get_states_with_funding_count', filters);

		// Initialize with defaults in case of errors
		let totalFundingAvailable = 0;
		let totalOpportunitiesCount = 0;
		let statesWithFundingCount = 0;

		// Update values if successful
		if (!totalFundingError && totalFundingResult !== null) {
			totalFundingAvailable = totalFundingResult;
			console.log('Successfully fetched total funding:', totalFundingAvailable);
		} else {
			console.error(
				'Error fetching total funding available:',
				totalFundingError
			);
		}

		if (!totalOpportunitiesError && totalOpportunitiesResult !== null) {
			totalOpportunitiesCount = totalOpportunitiesResult;
			console.log(
				'Successfully fetched total opportunities:',
				totalOpportunitiesCount
			);
		} else {
			console.error(
				'Error fetching total opportunities count:',
				totalOpportunitiesError
			);
		}

		if (!statesWithFundingError && statesWithFundingResult !== null) {
			statesWithFundingCount = statesWithFundingResult;
			console.log(
				'Successfully fetched states with funding count:',
				statesWithFundingCount
			);
		} else {
			console.error(
				'Error fetching states with funding count:',
				statesWithFundingError
			);
		}

		// Log the metrics results
		console.log('Metrics to be returned:', {
			totalFunding: totalFundingAvailable,
			totalOpportunities: totalOpportunitiesCount,
			statesWithFunding: statesWithFundingCount,
		});

		// Return the data with all calculated metrics
		return NextResponse.json({
			success: true,
			data: data,
			source: 'v3',
			totalFunding: totalFundingAvailable,
			totalOpportunities: totalOpportunitiesCount,
			statesWithFunding: statesWithFundingCount,
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
function generateMockStateData() {
	const states = [
		'Alabama',
		'Alaska',
		'Arizona',
		'Arkansas',
		'California',
		'Colorado',
		'Connecticut',
		'Delaware',
		'Florida',
		'Georgia',
		'Hawaii',
		'Idaho',
		'Illinois',
		'Indiana',
		'Iowa',
		'Kansas',
		'Kentucky',
		'Louisiana',
		'Maine',
		'Maryland',
		'Massachusetts',
		'Michigan',
		'Minnesota',
		'Mississippi',
		'Missouri',
		'Montana',
		'Nebraska',
		'Nevada',
		'New Hampshire',
		'New Jersey',
		'New Mexico',
		'New York',
		'North Carolina',
		'North Dakota',
		'Ohio',
		'Oklahoma',
		'Oregon',
		'Pennsylvania',
		'Rhode Island',
		'South Carolina',
		'South Dakota',
		'Tennessee',
		'Texas',
		'Utah',
		'Vermont',
		'Virginia',
		'Washington',
		'West Virginia',
		'Wisconsin',
		'Wyoming',
		'District of Columbia',
	];

	return states.map((state) => {
		// Generate random funding values, weighted toward certain states
		let value = Math.random() * 10000000;

		// Boost values for certain states to create a more realistic distribution
		if (
			['California', 'New York', 'Texas', 'Florida', 'Illinois'].includes(state)
		) {
			value *= 2.5;
		} else if (
			[
				'Washington',
				'Massachusetts',
				'Colorado',
				'Michigan',
				'Pennsylvania',
			].includes(state)
		) {
			value *= 1.8;
		}

		return {
			state,
			state_code: getStateCode(state),
			value: Math.round(value),
			opportunities: Math.floor(Math.random() * 20) + 1,
		};
	});
}

// Helper function to get state code
function getStateCode(stateName) {
	const stateAbbreviations = {
		Alabama: 'AL',
		Alaska: 'AK',
		Arizona: 'AZ',
		Arkansas: 'AR',
		California: 'CA',
		Colorado: 'CO',
		Connecticut: 'CT',
		Delaware: 'DE',
		Florida: 'FL',
		Georgia: 'GA',
		Hawaii: 'HI',
		Idaho: 'ID',
		Illinois: 'IL',
		Indiana: 'IN',
		Iowa: 'IA',
		Kansas: 'KS',
		Kentucky: 'KY',
		Louisiana: 'LA',
		Maine: 'ME',
		Maryland: 'MD',
		Massachusetts: 'MA',
		Michigan: 'MI',
		Minnesota: 'MN',
		Mississippi: 'MS',
		Missouri: 'MO',
		Montana: 'MT',
		Nebraska: 'NE',
		Nevada: 'NV',
		'New Hampshire': 'NH',
		'New Jersey': 'NJ',
		'New Mexico': 'NM',
		'New York': 'NY',
		'North Carolina': 'NC',
		'North Dakota': 'ND',
		Ohio: 'OH',
		Oklahoma: 'OK',
		Oregon: 'OR',
		Pennsylvania: 'PA',
		'Rhode Island': 'RI',
		'South Carolina': 'SC',
		'South Dakota': 'SD',
		Tennessee: 'TN',
		Texas: 'TX',
		Utah: 'UT',
		Vermont: 'VT',
		Virginia: 'VA',
		Washington: 'WA',
		'West Virginia': 'WV',
		Wisconsin: 'WI',
		Wyoming: 'WY',
		'District of Columbia': 'DC',
	};

	return stateAbbreviations[stateName] || '';
}
