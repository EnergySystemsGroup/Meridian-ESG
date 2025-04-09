import { useState, useEffect, useCallback } from 'react';

// Key used for localStorage
const TRACKED_OPPORTUNITIES_KEY = 'trackedOpportunities';

/**
 * Custom hook to manage tracked/favorited opportunities using localStorage
 * @returns {Object} Methods and state for tracked opportunities
 */
export function useTrackedOpportunities() {
	// State to track the favorited opportunity IDs
	const [trackedOpportunityIds, setTrackedOpportunityIds] = useState([]);
	// State to track if localStorage is available (for SSR compatibility)
	const [isInitialized, setIsInitialized] = useState(false);

	// Load tracked opportunities from localStorage on mount
	useEffect(() => {
		// Avoid localStorage during SSR
		if (typeof window !== 'undefined') {
			try {
				const storedIds = JSON.parse(
					localStorage.getItem(TRACKED_OPPORTUNITIES_KEY) || '[]'
				);
				setTrackedOpportunityIds(storedIds);
			} catch (error) {
				console.error('Failed to load tracked opportunities:', error);
				// If there's an error parsing, initialize with empty array
				setTrackedOpportunityIds([]);
			}
			setIsInitialized(true);
		}
	}, []);

	// Save to localStorage whenever the tracked opportunities change
	useEffect(() => {
		if (isInitialized && typeof window !== 'undefined') {
			localStorage.setItem(
				TRACKED_OPPORTUNITIES_KEY,
				JSON.stringify(trackedOpportunityIds)
			);
		}
	}, [trackedOpportunityIds, isInitialized]);

	/**
	 * Check if an opportunity is being tracked
	 * @param {string} opportunityId - ID of the opportunity to check
	 * @returns {boolean} Whether the opportunity is tracked
	 */
	const isTracked = useCallback(
		(opportunityId) => {
			return trackedOpportunityIds.includes(opportunityId);
		},
		[trackedOpportunityIds]
	);

	/**
	 * Toggle the tracked status of an opportunity
	 * @param {string} opportunityId - ID of the opportunity to toggle
	 */
	const toggleTracked = useCallback((opportunityId) => {
		setTrackedOpportunityIds((prevIds) => {
			if (prevIds.includes(opportunityId)) {
				// If already tracked, remove it
				return prevIds.filter((id) => id !== opportunityId);
			} else {
				// If not tracked, add it
				return [...prevIds, opportunityId];
			}
		});
	}, []);

	/**
	 * Get all tracked opportunity IDs
	 * @returns {Array} Array of tracked opportunity IDs
	 */
	const getTrackedIds = useCallback(() => {
		return [...trackedOpportunityIds];
	}, [trackedOpportunityIds]);

	/**
	 * Clear all tracked opportunities
	 */
	const clearTracked = useCallback(() => {
		setTrackedOpportunityIds([]);
	}, []);

	return {
		isTracked,
		toggleTracked,
		getTrackedIds,
		clearTracked,
		trackedCount: trackedOpportunityIds.length,
		isInitialized,
	};
}
