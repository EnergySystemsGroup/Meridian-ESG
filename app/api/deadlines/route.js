import { NextResponse } from 'next/server';
import { supabase, calculateDaysLeft } from '@/lib/supabase';

export async function GET(request) {
	try {
		// Get URL parameters
		const { searchParams } = new URL(request.url);
		const type = searchParams.get('type') || 'upcoming'; // 'upcoming' or 'thirty_day_count'
		const limit = parseInt(searchParams.get('limit') || '5');

		// For thirty-day count request type
		if (type === 'thirty_day_count') {
			const today = new Date();
			const thirtyDaysFromNow = new Date();
			thirtyDaysFromNow.setDate(today.getDate() + 30);

			const { count, error } = await supabase
				.from('funding_opportunities')
				.select('id', { count: 'exact' })
				.gte('close_date', today.toISOString())
				.lt('close_date', thirtyDaysFromNow.toISOString());

			if (error) {
				throw error;
			}

			return NextResponse.json({
				success: true,
				count: count || 0,
			});
		}

		// Original behavior for 'upcoming' type - return closest deadlines
		const today = new Date().toISOString();

		const { data, error } = await supabase
			.from('funding_opportunities')
			.select(
				`
				*,
				funding_sources:funding_source_id (
					name,
					type
				)
			`
			)
			.gte('close_date', today)
			.order('close_date', { ascending: true })
			.limit(limit);

		if (error) {
			throw error;
		}

		// Enhance the data with additional information
		const enhancedDeadlines = data.map((deadline) => {
			const daysLeft = calculateDaysLeft(deadline.close_date);

			return {
				...deadline,
				// Extract source name from the joined funding_sources object
				source_name: deadline.funding_sources?.name || 'Unknown Source',
				source_type: deadline.funding_sources?.type || null,
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
		console.error('Error fetching upcoming deadlines:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
