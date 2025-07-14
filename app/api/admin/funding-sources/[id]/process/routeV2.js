import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { processApiSourceV2 } from '@/lib/services/processCoordinatorV2';
import { RunManagerV2 } from '@/lib/services/runManagerV2';
import { AnthropicClient } from '@/lib/agents-v2/utils/anthropicClient';

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

		// Initialize Anthropic client (V2 wrapper with callWithSchema)
		const anthropic = new AnthropicClient();

		console.log('Starting V2 background processing - let processCoordinatorV2 manage the run');
		
		// Start V2 processing in the background (let processCoordinatorV2 create and manage the run)
		console.log(
			`Starting V2 background processing for source: ${id}`
		);
		
		const processPromise = processApiSourceV2(id, null, supabase, anthropic, {
			pipeline_version: 'v2.0',
			optimization_enabled: true,
			early_duplicate_detection: true,
			api_route: 'process-v2'
		});

		// Get the run ID from the promise (the processCoordinatorV2 returns it)
		let runId = null;
		processPromise.then((result) => {
			runId = result.runId;
			console.log(`V2 processing completed for run: ${runId}`);
		}).catch((error) => {
			console.error('Error processing source with V2:', error);
		});

		return NextResponse.json({
			success: true,
			message: 'V2 Processing started',
			version: 'v2.0',
			pipeline: 'v2-optimized-with-metrics',
			sourceId: id,
			status: 'started',
			startedAt: new Date().toISOString(),
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