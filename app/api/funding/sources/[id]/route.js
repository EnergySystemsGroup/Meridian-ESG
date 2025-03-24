import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/lib/supabase';

// GET /api/funding/sources/[id] - Get a specific API source
export async function GET(request, { params }) {
	try {
		const supabase = createSupabaseClient();
		const { id } = params;

		// Get the source
		const { data: source, error: sourceError } = await supabase
			.from('api_sources')
			.select('*')
			.eq('id', id)
			.single();

		if (sourceError) {
			if (sourceError.code === 'PGRST116') {
				return NextResponse.json(
					{ error: 'API source not found' },
					{ status: 404 }
				);
			}
			throw sourceError;
		}

		// Get the source configurations
		const { data: configurations, error: configError } = await supabase
			.from('api_source_configurations')
			.select('*')
			.eq('source_id', id);

		if (configError) {
			throw configError;
		}

		// Format configurations as an object
		const configObject = {
			query_params: {},
			request_body: {},
			request_config: {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			},
			response_config: {
				responseDataPath: '',
				totalCountPath: '',
			},
			pagination_config: {
				enabled: false,
				type: 'offset',
				limitParam: 'limit',
				offsetParam: 'offset',
				pageSize: 100,
				maxPages: 5,
				paginationInBody: false,
			},
			detail_config: {
				enabled: false,
				endpoint: '',
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
				idField: '',
				idParam: '',
			},
			response_mapping: {
				title: '',
				description: '',
				fundingType: '',
				agency: '',
				totalFunding: '',
				minAward: '',
				maxAward: '',
				openDate: '',
				closeDate: '',
				eligibility: '',
				url: '',
			},
		};

		// Populate the config object with the actual configurations
		configurations.forEach((config) => {
			configObject[config.config_type] = config.configuration;
		});

		// Return the source with configurations
		return NextResponse.json({
			source: {
				...source,
				configurations: configObject,
			},
		});
	} catch (error) {
		console.error('Error fetching API source:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch API source' },
			{ status: 500 }
		);
	}
}

// PUT /api/funding/sources/[id] - Update a specific API source
export async function PUT(request, { params }) {
	try {
		const supabase = createSupabaseClient();
		const { id } = params;
		const body = await request.json();

		// Update the source
		const { data: source, error: sourceError } = await supabase
			.from('api_sources')
			.update({
				name: body.name,
				organization: body.organization,
				type: body.type,
				url: body.url,
				api_endpoint: body.api_endpoint,
				api_documentation_url: body.api_documentation_url,
				auth_type: body.auth_type,
				auth_details: body.auth_details,
				update_frequency: body.update_frequency,
				handler_type: body.handler_type || 'standard',
				notes: body.notes,
				active: body.active,
			})
			.eq('id', id)
			.select()
			.single();

		if (sourceError) {
			if (sourceError.code === 'PGRST116') {
				return NextResponse.json(
					{ error: 'API source not found' },
					{ status: 404 }
				);
			}
			throw sourceError;
		}

		// If configurations are provided, update them
		if (body.configurations && Object.keys(body.configurations).length > 0) {
			// Delete existing configurations
			await supabase
				.from('api_source_configurations')
				.delete()
				.eq('source_id', id);

			// Insert new configurations
			const configInserts = [];

			// Process query_params if provided
			if (
				body.configurations.query_params &&
				Object.keys(body.configurations.query_params).length > 0
			) {
				configInserts.push({
					source_id: id,
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
					source_id: id,
					config_type: 'request_body',
					configuration: body.configurations.request_body,
				});
			}

			// Process request_config if provided
			if (body.configurations.request_config) {
				configInserts.push({
					source_id: id,
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
					source_id: id,
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
					source_id: id,
					config_type: 'detail_config',
					configuration: body.configurations.detail_config,
				});
			}

			// Process response_config if provided
			if (body.configurations.response_config) {
				configInserts.push({
					source_id: id,
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
						source_id: id,
						config_type: 'response_mapping',
						configuration: filteredMapping,
					});
				}
			}

			if (configInserts.length > 0) {
				await supabase.from('api_source_configurations').insert(configInserts);
			}
		}

		return NextResponse.json({ source });
	} catch (error) {
		console.error('Error updating API source:', error);
		return NextResponse.json(
			{ error: 'Failed to update API source' },
			{ status: 500 }
		);
	}
}

// DELETE /api/funding/sources/[id] - Delete a specific API source
export async function DELETE(request, { params }) {
	try {
		const supabase = createSupabaseClient();
		const { id } = params;

		// Delete the source (cascade will delete configurations)
		const { error } = await supabase.from('api_sources').delete().eq('id', id);

		if (error) {
			if (error.code === 'PGRST116') {
				return NextResponse.json(
					{ error: 'API source not found' },
					{ status: 404 }
				);
			}
			throw error;
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error deleting API source:', error);
		return NextResponse.json(
			{ error: 'Failed to delete API source' },
			{ status: 500 }
		);
	}
}
