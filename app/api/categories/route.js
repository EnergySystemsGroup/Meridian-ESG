import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { TAXONOMIES } from '@/app/lib/constants/taxonomies';
import { getNormalizedCategories } from '@/app/lib/utils/categoryUtils';

export async function GET() {
	try {
		// Fetch all unique categories from opportunities table
		const { data, error } = await supabase
			.from('funding_opportunities_with_geography') // Using the view with geography
			.select('id, categories')
			.not('categories', 'is', null);

		if (error) {
			throw new Error(error.message);
		}

		// Extract and flatten all categories with counts
		const categoryCount = {};
		data
			.flatMap((item) => item.categories || [])
			.filter(Boolean)
			.forEach((category) => {
				categoryCount[category] = (categoryCount[category] || 0) + 1;
			});

		// Get unique raw categories
		const rawCategories = Object.keys(categoryCount);
		console.log(`Found ${rawCategories.length} unique raw categories`);

		// Get standard categories from taxonomy
		const standardCategories = TAXONOMIES.CATEGORIES;

		// Generate normalized mapping
		const { normalizedMapping, categoryGroups } = getNormalizedCategories(
			rawCategories,
			standardCategories,
			categoryCount
		);

		// Fix the category counts to reflect unique opportunities
		const opportunitiesByCategory = {};

		// Count each opportunity exactly once per normalized category
		data.forEach((opportunity) => {
			if (!opportunity.categories || opportunity.categories.length === 0)
				return;

			// Track which normalized categories we've seen for this opportunity
			const seenCategories = new Set();

			opportunity.categories.forEach((rawCategory) => {
				if (rawCategory && normalizedMapping[rawCategory]) {
					const normalizedCategory = normalizedMapping[rawCategory];
					// Only count each normalized category once per opportunity
					if (!seenCategories.has(normalizedCategory)) {
						seenCategories.add(normalizedCategory);

						// Initialize if needed
						if (!opportunitiesByCategory[normalizedCategory]) {
							opportunitiesByCategory[normalizedCategory] = new Set();
						}

						// Add this opportunity to the set for this category
						opportunitiesByCategory[normalizedCategory].add(opportunity.id);
					}
				}
			});
		});

		// Update just the count property in categoryGroups with accurate counts
		Object.keys(categoryGroups).forEach((category) => {
			if (opportunitiesByCategory[category]) {
				categoryGroups[category].count = opportunitiesByCategory[category].size;
			}
		});

		// Get final normalized category list (sorted by count, then alphabetically)
		const normalizedCategories = Object.keys(categoryGroups).sort((a, b) => {
			// First sort by count (descending)
			const countDiff = categoryGroups[b].count - categoryGroups[a].count;
			if (countDiff !== 0) return countDiff;

			// Then sort alphabetically
			return a.localeCompare(b);
		});

		return NextResponse.json({
			success: true,
			// Main data needed by the UI
			categories: normalizedCategories,
			// Additional data for debugging or future enhancements
			categoryGroups: categoryGroups,
			rawToNormalizedMap: normalizedMapping,
		});
	} catch (error) {
		console.error('Error fetching categories:', error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
