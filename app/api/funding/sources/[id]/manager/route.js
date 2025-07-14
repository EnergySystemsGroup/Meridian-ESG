import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { sourceManagerAgent } from '@/lib/agents/sourceManagerAgent';

// POST /api/funding/sources/[id]/manager - Get the source manager agent output for a specific API source
export async function POST(request, context) {
	try {
		const supabase = createSupabaseClient();
		const { id } = await context.params;

		// Get the source with configurations
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

		// Add configurations to the source
		const sourceWithConfig = {
			...source,
			configurations: configObject,
		};

		// Process the source with the Source Manager Agent
		const processingDetails = await sourceManagerAgent(sourceWithConfig);

		return NextResponse.json({
			success: true,
			source: id,
			processingDetails,
		});
	} catch (error) {
		console.error('Error processing API source:', error);
		return NextResponse.json(
			{
				error: 'Failed to process API source',
				details: error.message || String(error),
				stack: error.stack,
			},
			{ status: 500 }
		);
	}
}
