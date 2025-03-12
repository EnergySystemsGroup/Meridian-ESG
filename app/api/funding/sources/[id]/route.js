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
		const configObject = {};
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
				priority: body.priority,
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
			const configInserts = Object.entries(body.configurations).map(
				([configType, configuration]) => ({
					source_id: id,
					config_type: configType,
					configuration,
				})
			);

			await supabase.from('api_source_configurations').insert(configInserts);
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
