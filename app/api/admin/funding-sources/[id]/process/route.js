import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { processApiSource } from '@/app/lib/services/processCoordinator';

export async function POST(request, { params }) {
	try {
		// Await params before accessing id
		const { id } = await params;

		// Initialize Supabase client
		const supabase = createClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
		);

		// Create a new run record
		const { data: run, error: runError } = await supabase
			.from('api_source_runs')
			.insert({
				source_id: id,
				status: 'started',
				source_manager_status: 'pending',
				api_handler_status: 'pending',
				detail_processor_status: 'pending',
				data_processor_status: 'pending',
			})
			.select()
			.single();

		if (runError) throw runError;

		// Start processing in the background
		processApiSource(id, run.id).catch((error) => {
			console.error('Error processing source:', error);
			// Update run status to failed
			supabase
				.from('api_source_runs')
				.update({
					status: 'failed',
					error: error.message,
				})
				.eq('id', run.id)
				.then(() => {
					console.log('Updated run status to failed');
				})
				.catch((updateError) => {
					console.error('Error updating run status:', updateError);
				});
		});

		return NextResponse.json(run);
	} catch (error) {
		console.error('Error processing source:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}
