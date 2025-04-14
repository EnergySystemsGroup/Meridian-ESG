import { NextResponse } from 'next/server';
import { processNextSourceWithHandler } from '@/app/lib/agents/apiHandlerAgent';
import { createSupabaseClient } from '@/app/lib/supabase';

/**
 * Process the next API source in the queue
 * @route POST /api/funding/process-next-source
 * @returns {Object} The processing result
 */
export async function POST() {
	try {
		// Check if the request is authorized
		const supabase = createSupabaseClient();
		const {
			data: { session },
		} = await supabase.auth.getSession();

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get the user's role
		const { data: userRoles } = await supabase
			.from('user_roles')
			.select('role')
			.eq('user_id', session.user.id)
			.single();

		// Check if the user is an admin
		if (!userRoles || userRoles.role !== 'admin') {
			return NextResponse.json(
				{ error: 'Forbidden - Admin access required' },
				{ status: 403 }
			);
		}

		// Process the next source
		const result = await processNextSourceWithHandler();

		if (!result) {
			return NextResponse.json(
				{ message: 'No sources to process' },
				{ status: 200 }
			);
		}

		// Return the processing result
		return NextResponse.json(
			{
				message: 'Source processed successfully',
				source: {
					id: result.source.id,
					name: result.source.name,
					organization: result.source.organization,
					type: result.source.type,
				},
				opportunitiesFound: result.handlerResult.opportunities.length,
				totalCount: result.handlerResult.totalCount,
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error('Error processing next source:', error);

		return NextResponse.json(
			{ error: 'Failed to process next source', details: error.message },
			{ status: 500 }
		);
	}
}
