import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/app/lib/supabase';
import { sourceManagerAgent } from '@/app/lib/agents/sourceManagerAgent';
import { apiHandlerAgent } from '@/app/lib/agents/apiHandlerAgent';
import { dataProcessorAgent } from '@/app/lib/agents/dataProcessorAgent';
import { processDetailedInfo } from '@/app/lib/agents/detailProcessorAgent';

// POST /api/funding/sources/[id]/process - Process a specific API source
export async function POST(request, context) {
	try {
		const supabase = createSupabaseClient();
		const { id } = context.params;

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

		// Process the source with the API Handler Agent
		const handlerResult = await apiHandlerAgent(
			sourceWithConfig,
			processingDetails
		);

		// Check if this is a two-step API source
		const isDetailEnabled =
			processingDetails.detailConfig && processingDetails.detailConfig.enabled;

		let opportunities = handlerResult.opportunities;
		let finalResult;

		if (isDetailEnabled) {
			// For two-step API sources, process with Detail Processor Agent
			console.log(
				`Processing ${opportunities.length} opportunities with Detail Processor Agent`
			);
			const detailResult = await processDetailedInfo(
				opportunities,
				sourceWithConfig
			);

			// Use the filtered opportunities from the Detail Processor
			opportunities = detailResult.opportunities;

			// Process the filtered opportunities with the Data Processor Agent
			finalResult = await dataProcessorAgent(
				opportunities,
				id,
				handlerResult.rawResponseId
			);

			// Return the combined results
			return NextResponse.json({
				success: true,
				source: {
					id: source.id,
					name: source.name,
				},
				handlerResult: {
					opportunitiesFound: handlerResult.opportunities.length,
				},
				detailResult: {
					opportunitiesFiltered: detailResult.opportunities.length,
					filteredCount: detailResult.filteredCount,
					metrics: detailResult.processingMetrics,
				},
				processorResult: finalResult,
			});
		} else {
			// For single-API sources, process directly with Data Processor Agent
			finalResult = await dataProcessorAgent(
				opportunities,
				id,
				handlerResult.rawResponseId
			);

			// Return the results
			return NextResponse.json({
				success: true,
				source: {
					id: source.id,
					name: source.name,
				},
				handlerResult: {
					opportunitiesFound: handlerResult.opportunities.length,
				},
				processorResult: finalResult,
			});
		}
	} catch (error) {
		console.error('Error processing API source:', error);
		return NextResponse.json(
			{ error: 'Failed to process API source', details: error.message },
			{ status: 500 }
		);
	}
}
