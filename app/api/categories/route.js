import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export async function GET() {
	try {
		// Fetch all unique categories from opportunities table
		const { data, error } = await supabase
			.from('funding_opportunities_with_geography') // Using the view with geography
			.select('categories')
			.not('categories', 'is', null);

		if (error) {
			throw new Error(error.message);
		}

		// Extract and flatten all categories
		const allCategories = data
			.flatMap((item) => item.categories || [])
			.filter(Boolean);

		// Create a unique sorted list
		const uniqueCategories = [...new Set(allCategories)].sort();

		return NextResponse.json({
			success: true,
			data: uniqueCategories,
		});
	} catch (error) {
		console.error('Error fetching categories:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
