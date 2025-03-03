import { NextResponse } from 'next/server';
import { supabase, fundingApi } from '@/app/lib/supabase';

export async function GET(request) {
	try {
		// Get URL parameters
		const { searchParams } = new URL(request.url);

		// Build filters from query parameters
		const filters = {
			status: searchParams.get('status'),
			source_type: searchParams.get('source_type'),
			min_amount: searchParams.get('min_amount'),
			max_amount: searchParams.get('max_amount'),
			close_date_after: searchParams.get('close_date_after'),
			close_date_before: searchParams.get('close_date_before'),
			sort_by: searchParams.get('sort_by'),
			sort_direction: searchParams.get('sort_direction'),
			page: parseInt(searchParams.get('page') || '1'),
			page_size: parseInt(searchParams.get('page_size') || '10'),
		};

		// Handle tags as array
		const tags = searchParams.get('tags');
		if (tags) {
			filters.tags = tags.split(',');
		}

		// Fetch opportunities with filters
		let opportunities;
		try {
			opportunities = await fundingApi.getOpportunities(filters);
		} catch (error) {
			console.error('Error fetching from Supabase:', error);
			// Fallback to mock data
			opportunities = getMockOpportunities(filters);
		}

		return NextResponse.json({
			success: true,
			data: opportunities,
			pagination: {
				page: filters.page,
				pageSize: filters.page_size,
				total: opportunities.length, // Note: For proper pagination, we'd need a count query
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

// Endpoint to get a single opportunity by ID
export async function POST(request) {
	try {
		const body = await request.json();

		if (!body.id) {
			return NextResponse.json(
				{ success: false, error: 'Opportunity ID is required' },
				{ status: 400 }
			);
		}

		let opportunity;
		try {
			opportunity = await fundingApi.getOpportunityById(body.id);
		} catch (error) {
			console.error('Error fetching from Supabase:', error);
			// Fallback to mock data
			opportunity = getMockOpportunityById(body.id);
		}

		return NextResponse.json({
			success: true,
			data: opportunity,
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}

// Mock data for fallback
function getMockOpportunities(filters) {
	const mockData = [
		{
			id: 1,
			title: 'Building Energy Efficiency Grant',
			source_name: 'Department of Energy',
			min_amount: 500000,
			max_amount: 2000000,
			close_date: '2023-04-15',
			status: 'Open',
			description:
				'Funding for commercial building energy efficiency improvements including HVAC upgrades, lighting retrofits, and building envelope enhancements.',
			tags: ['Energy Efficiency', 'Commercial', 'Federal'],
			source_type: 'Federal',
		},
		{
			id: 2,
			title: 'School Modernization Program',
			source_name: 'Department of Education',
			min_amount: 1000000,
			max_amount: 5000000,
			close_date: '2023-05-01',
			status: 'Open',
			description:
				'Grants for K-12 schools to modernize facilities with a focus on energy efficiency, indoor air quality, and sustainability improvements.',
			tags: ['K-12', 'Modernization', 'Federal'],
			source_type: 'Federal',
		},
		{
			id: 3,
			title: 'Clean Energy Innovation Fund',
			source_name: 'California Energy Commission',
			min_amount: 250000,
			max_amount: 1000000,
			close_date: '2023-04-30',
			status: 'Open',
			description:
				'Funding for innovative clean energy projects that reduce greenhouse gas emissions and promote energy independence.',
			tags: ['Clean Energy', 'Innovation', 'California'],
			source_type: 'State',
		},
		{
			id: 4,
			title: 'Community Climate Resilience Grant',
			source_name: 'EPA',
			min_amount: 100000,
			max_amount: 500000,
			close_date: '2023-05-15',
			status: 'Upcoming',
			description:
				'Support for communities to develop and implement climate resilience strategies, including building upgrades and infrastructure improvements.',
			tags: ['Climate', 'Resilience', 'Federal'],
			source_type: 'Federal',
		},
		{
			id: 5,
			title: 'Municipal Building Retrofit Program',
			source_name: 'Department of Energy',
			min_amount: 500000,
			max_amount: 3000000,
			close_date: '2023-06-01',
			status: 'Upcoming',
			description:
				'Funding for local governments to retrofit municipal buildings for improved energy efficiency and reduced operational costs.',
			tags: ['Municipal', 'Retrofit', 'Federal'],
			source_type: 'Federal',
		},
		{
			id: 6,
			title: 'Solar for Schools Initiative',
			source_name: 'California Energy Commission',
			min_amount: 100000,
			max_amount: 750000,
			close_date: '2023-05-20',
			status: 'Open',
			description:
				'Grants to install solar photovoltaic systems on K-12 school facilities to reduce energy costs and provide educational opportunities.',
			tags: ['Solar', 'K-12', 'California'],
			source_type: 'State',
		},
		{
			id: 7,
			title: 'Building Electrification Program',
			source_name: 'Oregon Department of Energy',
			min_amount: 50000,
			max_amount: 250000,
			close_date: '2023-06-15',
			status: 'Upcoming',
			description:
				'Incentives for building owners to convert from fossil fuel systems to electric alternatives for heating, cooling, and water heating.',
			tags: ['Electrification', 'Oregon', 'State'],
			source_type: 'State',
		},
		{
			id: 8,
			title: 'Energy Storage Demonstration Grant',
			source_name: 'Department of Energy',
			min_amount: 1000000,
			max_amount: 4000000,
			close_date: '2023-07-01',
			status: 'Upcoming',
			description:
				'Funding for demonstration projects that integrate energy storage with renewable energy systems in commercial and institutional buildings.',
			tags: ['Energy Storage', 'Renewable', 'Federal'],
			source_type: 'Federal',
		},
		{
			id: 9,
			title: 'Zero Emission School Bus Program',
			source_name: 'EPA',
			min_amount: 300000,
			max_amount: 2000000,
			close_date: '2023-05-30',
			status: 'Open',
			description:
				'Grants to replace diesel school buses with zero-emission electric buses and install necessary charging infrastructure.',
			tags: ['Electric Vehicles', 'K-12', 'Federal'],
			source_type: 'Federal',
		},
	];

	// Apply filters to mock data
	let filteredData = [...mockData];

	if (filters.status) {
		filteredData = filteredData.filter(
			(item) => item.status === filters.status
		);
	}

	if (filters.source_type) {
		filteredData = filteredData.filter(
			(item) => item.source_type === filters.source_type
		);
	}

	if (filters.tags && filters.tags.length > 0) {
		filteredData = filteredData.filter((item) =>
			filters.tags.some((tag) => item.tags.includes(tag))
		);
	}

	if (filters.min_amount) {
		filteredData = filteredData.filter(
			(item) => item.min_amount >= parseInt(filters.min_amount)
		);
	}

	if (filters.max_amount) {
		filteredData = filteredData.filter(
			(item) => item.max_amount <= parseInt(filters.max_amount)
		);
	}

	// Apply pagination
	const startIndex = (filters.page - 1) * filters.page_size;
	const endIndex = startIndex + filters.page_size;

	return filteredData.slice(startIndex, endIndex);
}

function getMockOpportunityById(id) {
	const mockData = getMockOpportunities({ page: 1, page_size: 100 });
	return mockData.find((item) => item.id === parseInt(id)) || null;
}
