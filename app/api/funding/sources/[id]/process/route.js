import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/api';
import { processApiSource } from '@/lib/services/processCoordinator';

// POST /api/funding/sources/[id]/process - Process a specific API source
export async function POST(request, context) {
	try {
		const { id } = context.params;

		// Process the source using our new coordinator
		const result = await processApiSource(id);

		// Return the results
		return NextResponse.json(result);
	} catch (error) {
		console.error('Error processing API source:', error);
		return NextResponse.json(
			{ error: 'Failed to process API source', details: error.message },
			{ status: 500 }
		);
	}
}
