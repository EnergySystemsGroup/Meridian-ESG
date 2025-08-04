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

		// Monitor background processing with enhanced error handling
		let runId = null;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => {
			console.error('[RouteV2] ⏰ API route timeout - background process may be stuck');
		}, 30 * 60 * 1000); // 30 minutes

		processPromise.then((result) => {
			clearTimeout(timeoutId);
			runId = result.runId;
			console.log(`[RouteV2] ✅ V2 processing completed successfully for run: ${runId}`);
		}).catch(async (error) => {
			clearTimeout(timeoutId);
			console.error('[RouteV2] ❌ V2 processing failed:', error);
			
			// If we have a runId, the error was handled by processCoordinatorV2
			// If not, this was an early failure before run creation
			if (!runId) {
				console.error('[RouteV2] ❌ Early failure - no run ID available for cleanup');
				
				// Log the failure to api_activities for tracking
				try {
					await supabase.from('api_activities').insert({
						source_id: id,
						activity_type: 'process_start',
						status: 'failure',
						details: {
							error: String(error),
							pipeline: 'v2-optimized',
							failure_stage: 'pre_run_creation',
							api_route: 'process-v2'
						}
					});
				} catch (logError) {
					console.error('[RouteV2] ❌ Failed to log early failure:', logError);
				}
			}
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