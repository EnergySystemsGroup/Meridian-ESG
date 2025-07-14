/**
 * UI Helper functions for consistent visual styling across the application
 */

/**
 * Returns a consistent color scheme for a given category name
 * @param {string} categoryName - The name of the category
 * @returns {Object} An object with color and bgColor properties
 */
export const getCategoryColor = (categoryName) => {
	// Define a color map for the standard categories from taxonomies
	const categoryColors = {
		// Energy categories with orange-yellow hues
		'Energy Efficiency': { color: '#F57C00', bgColor: '#FFF3E0' },
		'Renewable Energy': { color: '#FF9800', bgColor: '#FFF8E1' },

		// Environmental/Water with blue-green hues
		'Water Conservation': { color: '#0288D1', bgColor: '#E1F5FE' },
		Environmental: { color: '#00796B', bgColor: '#E0F2F1' },
		Sustainability: { color: '#43A047', bgColor: '#E8F5E9' },

		// Infrastructure/Facilities with gray-blue hues
		Infrastructure: { color: '#546E7A', bgColor: '#ECEFF1' },
		Transportation: { color: '#455A64', bgColor: '#E0E6EA' },
		'Facility Improvements': { color: '#607D8B', bgColor: '#F5F7F8' },

		// Education/Development with purple hues
		Education: { color: '#7B1FA2', bgColor: '#F3E5F5' },
		'Research & Development': { color: '#9C27B0', bgColor: '#F5E9F7' },
		'Economic Development': { color: '#6A1B9A', bgColor: '#EFE5F7' },

		// Community/Health with red-pink hues
		'Community Development': { color: '#C62828', bgColor: '#FFEBEE' },
		'Health & Safety': { color: '#D32F2F', bgColor: '#FFEBEE' },
		'Disaster Recovery': { color: '#E53935', bgColor: '#FFEBEE' },

		// Planning with neutral hues
		'Planning & Assessment': { color: '#5D4037', bgColor: '#EFEBE9' },
	};

	// Check if it's one of our standard categories
	if (categoryColors[categoryName]) {
		return categoryColors[categoryName];
	}

	// For non-standard categories, generate a color using the hash function
	let hash = 0;
	for (let i = 0; i < categoryName.length; i++) {
		hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Multiply by a prime number to better distribute the hue values
	const hue = (hash * 13) % 360;

	return {
		color: `hsl(${hue}, 65%, 45%)`,
		bgColor: `hsl(${hue}, 65%, 95%)`,
	};
};

/**
 * Format category name for display - handles "Other: Description" format
 * @param {string} category - The category name
 * @returns {string} Formatted category name
 */
export const formatCategoryForDisplay = (category) => {
	// If the category starts with "Other: ", extract just the description part
	if (category && category.startsWith('Other: ')) {
		return category.substring(7); // Remove "Other: " prefix
	}
	return category;
};
