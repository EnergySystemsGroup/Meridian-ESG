import { TAXONOMIES } from '@/app/lib/constants/taxonomies';

/**
 * Normalizes raw categories by mapping them to standard categories when appropriate
 * Uses a combination of string similarity and basic domain knowledge
 *
 * @param {string[]} rawCategories - Array of unique raw category strings
 * @param {string[]} standardCategories - Array of standard category strings from taxonomy
 * @param {Object.<string, number>} categoryCounts - Optional map of rawCategory -> count
 * @returns {{normalizedMapping: Object.<string, string>, categoryGroups: Object.<string, object>}}
 */
export function getNormalizedCategories(
	rawCategories,
	standardCategories,
	categoryCounts = {} // Default to empty object if counts not needed
) {
	const normalizedMapping = {};
	const categoryGroups = {};

	rawCategories.forEach((rawCategory) => {
		if (standardCategories.includes(rawCategory)) {
			normalizedMapping[rawCategory] = rawCategory;
			if (
				!categoryGroups[rawCategory] &&
				categoryCounts[rawCategory] !== undefined
			) {
				categoryGroups[rawCategory] = {
					count: categoryCounts[rawCategory],
					variants: [{ name: rawCategory, count: categoryCounts[rawCategory] }],
				};
			}
			return;
		}

		let comparisonCategory = rawCategory;
		if (rawCategory.startsWith('Other: ')) {
			comparisonCategory = rawCategory.substring(7);
		}

		let bestMatch = null;
		let highestSimilarity = 0;

		for (const standardCategory of standardCategories) {
			const similarity = calculateCategorySimilarity(
				comparisonCategory,
				standardCategory
			);

			if (similarity > highestSimilarity && similarity > 0.3) {
				highestSimilarity = similarity;
				bestMatch = standardCategory;
			}
		}

		const normalizedCategory = bestMatch || rawCategory;
		normalizedMapping[rawCategory] = normalizedCategory;

		if (categoryCounts[rawCategory] !== undefined) {
			if (!categoryGroups[normalizedCategory]) {
				categoryGroups[normalizedCategory] = {
					count: 0,
					variants: [],
				};
			}
			categoryGroups[normalizedCategory].variants.push({
				name: rawCategory,
				count: categoryCounts[rawCategory],
				similarity: bestMatch ? highestSimilarity : 1.0,
			});
			categoryGroups[normalizedCategory].count += categoryCounts[rawCategory];
		}
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
export function calculateCategorySimilarity(category1, category2) {
	const words1 = category1.toLowerCase().split(/\s+/);
	const words2 = category2.toLowerCase().split(/\s+/);

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
		'facility',
		'improvement',
		'safety',
		'planning',
		'assessment',
		'disaster',
		'recovery',
	];

	let weightedMatches = 0;
	let totalWeight = 0;

	for (const word of words1) {
		if (word.length <= 2) continue; // Adjusted threshold

		const wordWeight = keyDomainWords.includes(word) ? 2.0 : 1.0;
		totalWeight += wordWeight;

		if (words2.includes(word)) {
			weightedMatches += wordWeight;
		} else {
			for (const word2 of words2) {
				if (word2.length <= 2) continue; // Adjusted threshold
				if (word2.includes(word) || word.includes(word2)) {
					weightedMatches += wordWeight * 0.7; // Adjusted weight for partial
					break;
				}
			}
		}
	}

	if (totalWeight === 0) return 0;
	return weightedMatches / totalWeight;
}
