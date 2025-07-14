import { NextResponse } from 'next/server';
import { processNextSource } from '@/lib/agents/sourceManagerAgent';

// POST /api/funding/process - Process the next API source in the queue
export async function POST() {
	try {
		// Process the next source
		const result = await processNextSource();

		if (!result) {
			return NextResponse.json({
				success: true,
				message: 'No sources to process',
			});
		}

		return NextResponse.json({
			success: true,
			source: result.source.id,
			processingDetails: result.processingDetails,
		});
	} catch (error) {
		console.error('Error processing next API source:', error);
		return NextResponse.json(
			{ error: 'Failed to process next API source', details: String(error) },
			{ status: 500 }
		);
	}
}
