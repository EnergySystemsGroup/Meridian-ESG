import { NextResponse } from 'next/server';
import { fundingApi, calculateDaysLeft } from '@/app/lib/supabase';

export async function GET(request) {
	try {
		// Get URL parameters
		const { searchParams } = new URL(request.url);
		const limit = parseInt(searchParams.get('limit') || '5');

		// Fetch upcoming deadlines
		const deadlines = await fundingApi.getUpcomingDeadlines(limit);

		// Enhance the data with additional information
		const enhancedDeadlines = deadlines.map((deadline) => {
			const daysLeft = calculateDaysLeft(deadline.close_date);

			return {
				...deadline,
				daysLeft,
				urgency: daysLeft <= 7 ? 'high' : daysLeft <= 30 ? 'medium' : 'low',
				formattedDate: new Date(deadline.close_date).toLocaleDateString(
					'en-US',
					{
						year: 'numeric',
						month: 'short',
						day: 'numeric',
					}
				),
			};
		});

		return NextResponse.json({
			success: true,
			data: enhancedDeadlines,
		});
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
