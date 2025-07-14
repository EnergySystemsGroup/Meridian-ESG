/**
 * Utility functions for dynamically prioritizing API sources
 */

/**
 * Calculate the priority score for an API source based on its update frequency and last checked time
 *
 * @param {Object} source - The API source object
 * @param {string} source.update_frequency - How often the source should be updated ('hourly', 'daily', 'weekly', 'monthly')
 * @param {string|Date} source.last_checked - When the source was last checked (ISO string or Date object)
 * @returns {number} - Priority score (higher means higher priority)
 */
function calculateSourcePriority(source) {
	if (!source) return 0;

	// Convert last_checked to a Date object if it's a string
	const lastChecked =
		source.last_checked instanceof Date
			? source.last_checked
			: source.last_checked
			? new Date(source.last_checked)
			: null;

	// If the source has never been checked, give it highest priority
	if (!lastChecked) return 100;

	const now = new Date();
	const elapsedHours = (now - lastChecked) / (1000 * 60 * 60);

	// Define expected update intervals in hours
	const updateIntervals = {
		hourly: 1,
		daily: 24,
		weekly: 168, // 7 days * 24 hours
		monthly: 720, // 30 days * 24 hours
		// Default to daily if not specified
		default: 24,
	};

	// Get the expected interval for this source
	const expectedInterval =
		updateIntervals[source.update_frequency] || updateIntervals.default;

	// Calculate priority as a ratio of elapsed time to expected interval
	// This means sources that are more overdue get higher priority
	const priorityScore = (elapsedHours / expectedInterval) * 10;

	// Cap the priority at 100 and ensure it's at least 1
	return Math.min(100, Math.max(1, priorityScore));
}

/**
 * Sort an array of sources by their calculated priority
 *
 * @param {Array} sources - Array of API source objects
 * @returns {Array} - Sorted array of sources (highest priority first)
 */
function sortSourcesByPriority(sources) {
	if (!Array.isArray(sources)) return [];

	return [...sources].sort((a, b) => {
		const priorityA = calculateSourcePriority(a);
		const priorityB = calculateSourcePriority(b);
		return priorityB - priorityA; // Sort descending (highest priority first)
	});
}

// Export the functions for use in other modules
module.exports = {
	calculateSourcePriority,
	sortSourcesByPriority,
};
