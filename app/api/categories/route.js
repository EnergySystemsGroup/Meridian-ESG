import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import TAXONOMIES from '@/app/lib/constants/taxonomies';

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
		// This is the only change needed to fix the counting issue
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

/**
 * Normalizes raw categories by mapping them to standard categories when appropriate
 * Uses a combination of string similarity and basic domain knowledge
 */
function getNormalizedCategories(
	rawCategories,
	standardCategories,
	categoryCounts
) {
	// Mapping of raw categories to normalized categories
	const normalizedMapping = {};

	// Store information about each normalized category group
	const categoryGroups = {};

	// Process each raw category
	rawCategories.forEach((rawCategory) => {
		// Skip if it's already an exact match with a standard category
		if (standardCategories.includes(rawCategory)) {
			normalizedMapping[rawCategory] = rawCategory;

			// Initialize the category group if it doesn't exist
			if (!categoryGroups[rawCategory]) {
				categoryGroups[rawCategory] = {
					count: categoryCounts[rawCategory],
					variants: [{ name: rawCategory, count: categoryCounts[rawCategory] }],
				};
			}
			return;
		}

		// Remove "Other:" prefix for comparison purposes only
		let comparisonCategory = rawCategory;
		if (rawCategory.startsWith('Other: ')) {
			comparisonCategory = rawCategory.substring(7);
		}

		// Find best matching standard category
		let bestMatch = null;
		let highestSimilarity = 0;

		// Check against each standard category
		for (const standardCategory of standardCategories) {
			// Calculate similarity based on words - using the cleaned comparison category
			const similarity = calculateCategorySimilarity(
				comparisonCategory,
				standardCategory
			);

			if (similarity > highestSimilarity && similarity > 0.3) {
				// Threshold
				highestSimilarity = similarity;
				bestMatch = standardCategory;
			}
		}

		// Use the best match if found, otherwise keep raw category
		const normalizedCategory = bestMatch || rawCategory;
		normalizedMapping[rawCategory] = normalizedCategory;

		// Update category groups
		if (!categoryGroups[normalizedCategory]) {
			categoryGroups[normalizedCategory] = {
				count: 0,
				variants: [],
			};
		}

		categoryGroups[normalizedCategory].variants.push({
			name: rawCategory,
			count: categoryCounts[rawCategory],
			similarity: bestMatch ? highestSimilarity : 1.0, // 1.0 for exact matches
		});

		categoryGroups[normalizedCategory].count += categoryCounts[rawCategory];
	});

	return {
		normalizedMapping,
		categoryGroups,
	};
}

/**
 * Calculate similarity between two category strings
 * Uses a word-based comparison with some domain-specific weighting
 */
function calculateCategorySimilarity(category1, category2) {
	// Convert to lowercase and split into words
	const words1 = category1.toLowerCase().split(/\s+/);
	const words2 = category2.toLowerCase().split(/\s+/);

	// Important domain-specific words get higher weight
	const keyDomainWords = [
		'climate',
		'energy',
		'water',
		'environment',
		'infrastructure',
		'transportation',
		'community',
		'economic',
		'development',
		'education',
		'research',
		'health',
		'sustainability',
		'renewable',
		'conservation',
		'efficiency',
		'resilience',
		'adaptation',
	];

	// Calculate word overlap with weighting
	let weightedMatches = 0;
	let totalWeight = 0;

	// Check each word in the first category
	for (const word of words1) {
		if (word.length <= 3) continue; // Skip very short words

		// Base weight - higher for domain-specific terms
		const wordWeight = keyDomainWords.includes(word) ? 2.0 : 1.0;
		totalWeight += wordWeight;

		// Check if this word (or a similar word) exists in the second category
		if (words2.includes(word)) {
			weightedMatches += wordWeight;
		} else {
			// Check for partial matches (e.g., "climate" in "climatic")
			for (const word2 of words2) {
				if (word2.includes(word) || word.includes(word2)) {
					weightedMatches += wordWeight * 0.8; // Partial match gets 80% weight
					break;
				}
			}
		}
	}

	// If no meaningful words to compare, return 0
	if (totalWeight === 0) return 0;

	// Normalized similarity score (0-1)
	return weightedMatches / totalWeight;
}
