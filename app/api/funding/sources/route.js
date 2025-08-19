import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';

// GET /api/funding/sources - Get all API sources
export async function GET(request) {
	try {
		// Create Supabase client with request context
		const { supabase } = createClient(request);

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
		// Create Supabase client with request context
		const { supabase } = createClient(request);
		const body = await request.json();

		// Validate required fields
		if (!body.name || !body.type || !body.url) {
			return NextResponse.json(
				{ error: 'Name, type, and URL are required' },
				{ status: 400 }
			);
		}

		// Check for similar sources
		const { data: similarSources, error: similarError } = await supabase.rpc(
			'check_similar_sources',
			{
				p_name: body.name,
				p_organization: body.organization || null,
			}
		);

		if (similarError) {
			console.error('Error checking for similar sources:', similarError);
		} else if (similarSources && similarSources.length > 0) {
			// Return the similar sources with a 409 Conflict status
			return NextResponse.json(
				{
					error: 'Similar sources already exist',
					similarSources,
				},
				{ status: 409 }
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
				handler_type: body.handler_type || 'standard',
				notes: body.notes,
				active: body.active !== undefined ? body.active : true,
			})
			.select()
			.single();

		if (error) {
			// Check if this is a unique constraint violation
			if (error.code === '23505') {
				return NextResponse.json(
					{ error: 'A source with this name and organization already exists' },
					{ status: 409 }
				);
			}
			throw error;
		}

		// If configurations are provided, insert them
		if (body.configurations && Object.keys(body.configurations).length > 0) {
			const configInserts = [];

			// Process query_params if provided
			if (
				body.configurations.query_params &&
				Object.keys(body.configurations.query_params).length > 0
			) {
				configInserts.push({
					source_id: data.id,
					config_type: 'query_params',
					configuration: body.configurations.query_params,
				});
			}

			// Process request_body if provided
			if (
				body.configurations.request_body &&
				Object.keys(body.configurations.request_body).length > 0
			) {
				configInserts.push({
					source_id: data.id,
					config_type: 'request_body',
					configuration: body.configurations.request_body,
				});
			}

			// Process request_config if provided
			if (body.configurations.request_config) {
				configInserts.push({
					source_id: data.id,
					config_type: 'request_config',
					configuration: body.configurations.request_config,
				});
			}

			// Process pagination_config if provided
			if (
				body.configurations.pagination_config &&
				body.configurations.pagination_config.enabled
			) {
				configInserts.push({
					source_id: data.id,
					config_type: 'pagination_config',
					configuration: body.configurations.pagination_config,
				});
			}

			// Process detail_config if provided
			if (
				body.configurations.detail_config &&
				body.configurations.detail_config.enabled
			) {
				configInserts.push({
					source_id: data.id,
					config_type: 'detail_config',
					configuration: body.configurations.detail_config,
				});
			}

			// Process response_config if provided
			if (body.configurations.response_config) {
				configInserts.push({
					source_id: data.id,
					config_type: 'response_config',
					configuration: body.configurations.response_config,
				});
			}

			// Process response_mapping if provided
			if (body.configurations.response_mapping) {
				// Filter out empty mappings
				const filteredMapping = Object.fromEntries(
					Object.entries(body.configurations.response_mapping).filter(
						([_, value]) => value
					)
				);

				if (Object.keys(filteredMapping).length > 0) {
					configInserts.push({
						source_id: data.id,
						config_type: 'response_mapping',
						configuration: filteredMapping,
					});
				}
			}

			if (configInserts.length > 0) {
				await supabase.from('api_source_configurations').insert(configInserts);
			}
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
