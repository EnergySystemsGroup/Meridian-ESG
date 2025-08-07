import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

// GET /api/funding/sources/[id] - Get a specific API source
export async function GET(request, { params }) {
	try {
		const supabase = createSupabaseClient();
		const { id } = await params;

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
				detailResponseDataPath: '',
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
		const { id } = await params;
		const body = await request.json();

		// Build update object - only include fields that are provided
		const updateData = {};
		if (body.name !== undefined) updateData.name = body.name;
		if (body.organization !== undefined) updateData.organization = body.organization;
		if (body.type !== undefined) updateData.type = body.type;
		if (body.url !== undefined) updateData.url = body.url;
		if (body.api_endpoint !== undefined) updateData.api_endpoint = body.api_endpoint;
		if (body.api_documentation_url !== undefined) updateData.api_documentation_url = body.api_documentation_url;
		if (body.auth_type !== undefined) updateData.auth_type = body.auth_type;
		if (body.auth_details !== undefined) updateData.auth_details = body.auth_details;
		if (body.update_frequency !== undefined) updateData.update_frequency = body.update_frequency;
		if (body.handler_type !== undefined) updateData.handler_type = body.handler_type || 'standard';
		if (body.notes !== undefined) updateData.notes = body.notes;
		if (body.active !== undefined) updateData.active = body.active;
		if (body.force_full_reprocessing !== undefined) updateData.force_full_reprocessing = body.force_full_reprocessing;

		// Update the source
		const { data: source, error: sourceError } = await supabase
			.from('api_sources')
			.update(updateData)
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

		// If configurations are provided, update them transactionally
		if (body.configurations && Object.keys(body.configurations).length > 0) {
			// Prepare configurations object for the stored procedure
			const configurationsToUpdate = {};

			// Process query_params if provided
			if (
				body.configurations.query_params &&
				Object.keys(body.configurations.query_params).length > 0
			) {
				configurationsToUpdate.query_params = body.configurations.query_params;
			}

			// Process request_body if provided
			if (
				body.configurations.request_body &&
				Object.keys(body.configurations.request_body).length > 0
			) {
				configurationsToUpdate.request_body = body.configurations.request_body;
			}

			// Process request_config if provided
			if (body.configurations.request_config) {
				configurationsToUpdate.request_config = body.configurations.request_config;
			}

			// Process pagination_config if provided
			if (
				body.configurations.pagination_config &&
				body.configurations.pagination_config.enabled
			) {
				configurationsToUpdate.pagination_config = body.configurations.pagination_config;
			}

			// Process detail_config if provided
			if (
				body.configurations.detail_config &&
				body.configurations.detail_config.enabled
			) {
				configurationsToUpdate.detail_config = body.configurations.detail_config;
			}

			// Process response_config if provided
			if (body.configurations.response_config) {
				configurationsToUpdate.response_config = body.configurations.response_config;
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
					configurationsToUpdate.response_mapping = filteredMapping;
				}
			}

			// Use the transactional stored procedure to update configurations
			if (Object.keys(configurationsToUpdate).length > 0) {
				const { error: configError } = await supabase.rpc('update_source_configurations', {
					p_source_id: id,
					p_configurations: configurationsToUpdate
				});

				if (configError) {
					console.error('Error updating configurations:', configError);
					throw configError;
				}
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
		const { id } = await params;

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
