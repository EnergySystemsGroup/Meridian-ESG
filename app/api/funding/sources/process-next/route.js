import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { processApiSource } from '@/lib/services/processCoordinator';

// POST /api/funding/sources/process-next - Process the next API source in the queue
export async function POST(request) {
	try {
		// Process the next source in the queue
		const result = await processApiSource();

		return NextResponse.json(result);
	} catch (error) {
		console.error('Error processing next API source:', error);
		return NextResponse.json(
			{ error: 'Failed to process next API source', details: error.message },
			{ status: 500 }
		);
	}
}
