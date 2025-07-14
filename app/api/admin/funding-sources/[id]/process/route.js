import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { processApiSource } from '@/lib/services/processCoordinator';
import { RunManager } from '@/lib/services/runManager';

export async function POST(request, { params }) {
	try {
		console.log('Process API route called');

		// Await params before accessing id
		const { id } = await params;
		console.log(`Processing source with ID: ${id}`);

		// Initialize Supabase client
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
		);

		// Create a new run manager
		const runManager = new RunManager();
		console.log('Creating new run');

		// Start a new run
		const runId = await runManager.startRun(id);
		console.log(`Created run with ID: ${runId}`);

		// Get the run details
		const { data: run, error: runError } = await supabase
			.from('api_source_runs')
			.select('*')
			.eq('id', runId)
			.single();

		if (runError) {
			console.error('Error fetching run:', runError);
			throw runError;
		}

		// Start processing in the background
		console.log(
			`Starting background processing for source: ${id}, run: ${runId}`
		);
		processApiSource(id, runId).catch((error) => {
			console.error('Error processing source:', error);
			// Update run status to failed
			runManager
				.updateRunError(error)
				.then(() => {
					console.log('Updated run status to failed');
				})
				.catch((updateError) => {
					console.error('Error updating run status:', updateError);
				});
		});

		return NextResponse.json({
			success: true,
			message: 'Processing started',
			runId: runId,
			sourceId: id,
			status: run.status,
			startedAt: run.started_at,
		});
	} catch (error) {
		console.error('Error processing source:', error);
		return NextResponse.json(
			{
				error: 'Internal server error',
				details: error.message,
				stack: error.stack,
			},
			{ status: 500 }
		);
	}
}
