import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { processApiSource } from '@/app/lib/services/processCoordinator';

export async function POST(request, { params }) {
	try {
		// Await both params and cookies
		const [{ id }, cookieStore] = await Promise.all([params, cookies()]);
		const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

		// Check if user is authenticated and has admin access
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

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
