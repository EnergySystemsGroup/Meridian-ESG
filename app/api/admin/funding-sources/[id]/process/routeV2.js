import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { processApiSourceV2 } from '@/lib/services/processCoordinatorV2';
import { RunManagerV2 } from '@/lib/services/runManagerV2';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request, { params }) {
	try {
		console.log('Process API route called (V2)');

		// Await params before accessing id
		const { id } = await params;
		console.log(`Processing source with ID: ${id} using V2 pipeline`);

		// Initialize Supabase client
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
		);

		// Initialize Anthropic client
		const anthropic = new Anthropic({
			apiKey: process.env.ANTHROPIC_API_KEY,
		});

		// Create a new V2 run manager
		const runManager = new RunManagerV2(null, supabase);
		console.log('Creating new V2 run');

		// Start a new V2 run
		const runId = await runManager.startRun(id, {
			pipeline_version: 'v2.0',
			optimization_enabled: true,
			early_duplicate_detection: true,
			api_route: 'process-v2'
		});
		console.log(`Created V2 run with ID: ${runId}`);

		// Get the run details
		const { data: run, error: runError } = await supabase
			.from('pipeline_runs')
			.select('*')
			.eq('id', runId)
			.single();

		if (runError) {
			console.error('Error fetching V2 run:', runError);
			throw runError;
		}

		// Start V2 processing in the background
		console.log(
			`Starting V2 background processing for source: ${id}, run: ${runId}`
		);
		processApiSourceV2(id, runId, supabase, anthropic).catch((error) => {
			console.error('Error processing source with V2:', error);
			// Update run status to failed
			runManager
				.updateRunError(error, 'v2_pipeline')
				.then(() => {
					console.log('Updated V2 run status to failed');
				})
				.catch((updateError) => {
					console.error('Error updating V2 run status:', updateError);
				});
		});

		return NextResponse.json({
			success: true,
			message: 'V2 Processing started',
			version: 'v2.0',
			pipeline: 'v2-optimized-with-metrics',
			runId: runId,
			sourceId: id,
			status: run.status,
			startedAt: run.started_at,
			optimizations: {
				earlyDuplicateDetection: true,
				tokenSavingsEnabled: true,
				advancedMetrics: true
			}
		});
	} catch (error) {
		console.error('Error processing source (V2):', error);
		return NextResponse.json(
			{
				error: 'Internal server error',
				details: error.message,
				stack: error.stack,
				version: 'v2.0',
				pipeline: 'v2-optimized-with-metrics'
			},
			{ status: 500 }
		);
	}
}