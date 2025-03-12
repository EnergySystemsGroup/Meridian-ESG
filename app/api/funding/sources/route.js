import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/lib/supabase';

// GET /api/funding/sources - Get all API sources
export async function GET(request) {
	try {
		const supabase = createSupabaseClient();

		// Get query parameters
		const { searchParams } = new URL(request.url);
		const active = searchParams.get('active');
		const type = searchParams.get('type');

		// Build the query
		let query = supabase.from('api_sources').select('*');

		// Apply filters if provided
		if (active !== null) {
			query = query.eq('active', active === 'true');
		}

		if (type) {
			query = query.eq('type', type);
		}

		// Execute the query
		const { data, error } = await query.order('name');

		if (error) {
			throw error;
		}

		return NextResponse.json({ sources: data });
	} catch (error) {
		console.error('Error fetching API sources:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch API sources' },
			{ status: 500 }
		);
	}
}

// POST /api/funding/sources - Create a new API source
export async function POST(request) {
	try {
		const supabase = createSupabaseClient();
		const body = await request.json();

		// Validate required fields
		if (!body.name || !body.type || !body.url) {
			return NextResponse.json(
				{ error: 'Name, type, and URL are required' },
				{ status: 400 }
			);
		}

		// Insert the new source
		const { data, error } = await supabase
			.from('api_sources')
			.insert({
				name: body.name,
				organization: body.organization,
				type: body.type,
				url: body.url,
				api_endpoint: body.api_endpoint,
				api_documentation_url: body.api_documentation_url,
				auth_type: body.auth_type || 'none',
				auth_details: body.auth_details,
				update_frequency: body.update_frequency,
				priority: body.priority || 5,
				notes: body.notes,
				active: body.active !== undefined ? body.active : true,
			})
			.select()
			.single();

		if (error) {
			throw error;
		}

		// If configurations are provided, insert them
		if (body.configurations && Object.keys(body.configurations).length > 0) {
			const configInserts = Object.entries(body.configurations).map(
				([configType, configuration]) => ({
					source_id: data.id,
					config_type: configType,
					configuration,
				})
			);

			await supabase.from('api_source_configurations').insert(configInserts);
		}

		return NextResponse.json({ source: data }, { status: 201 });
	} catch (error) {
		console.error('Error creating API source:', error);
		return NextResponse.json(
			{ error: 'Failed to create API source' },
			{ status: 500 }
		);
	}
}
