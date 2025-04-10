'use client';

import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
} from 'react';

// Key used for localStorage
const TRACKED_OPPORTUNITIES_KEY = 'trackedOpportunities';

// Create the context
const TrackedOpportunitiesContext = createContext(null);

/**
 * Provider component that wraps your app and makes tracked opportunities context available to the entire app
 */
export function TrackedOpportunitiesProvider({ children }) {
	// State to track the favorited opportunity IDs
	const [trackedOpportunityIds, setTrackedOpportunityIds] = useState([]);
	// State to track if localStorage is available (for SSR compatibility)
	const [isInitialized, setIsInitialized] = useState(false);

	// Load tracked opportunities from localStorage on mount
	useEffect(() => {
		// Avoid localStorage during SSR
		if (typeof window !== 'undefined') {
			console.log('[Context] Initializing from localStorage...');
			try {
				const storedIds = JSON.parse(
					localStorage.getItem(TRACKED_OPPORTUNITIES_KEY) || '[]'
				);
				console.log('[Context] Loaded IDs from localStorage:', storedIds);
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
	 */
	const isTracked = useCallback(
		(opportunityId) => {
			return trackedOpportunityIds.includes(opportunityId);
		},
		[trackedOpportunityIds]
	);

	/**
	 * Toggle the tracked status of an opportunity
	 */
	const toggleTracked = useCallback((opportunityId) => {
		console.log(`[Context] Toggling track for ID: ${opportunityId}`);
		setTrackedOpportunityIds((currentIds) => {
			console.log('[Context] Current IDs before toggle:', currentIds);
			const alreadyTracked = currentIds.includes(opportunityId);
			if (alreadyTracked) {
				// If already tracked, remove it
				console.log('[Context] ID found, removing...');
				const newIds = currentIds.filter((id) => id !== opportunityId);
				console.log('[Context] New IDs after removing:', newIds);
				return newIds;
			} else {
				// If not tracked, add it
				console.log('[Context] ID not found, adding...');
				const newIds = [...currentIds, opportunityId];
				console.log('[Context] New IDs after adding:', newIds);
				return newIds;
			}
		});
	}, []);

	/**
	 * Clear all tracked opportunities
	 */
	const clearTracked = useCallback(() => {
		setTrackedOpportunityIds([]);
	}, []);

	// Calculate trackedCount from the actual state
	const trackedCount = trackedOpportunityIds.length;

	// Create the context value object
	const contextValue = {
		trackedOpportunityIds,
		isTracked,
		toggleTracked,
		clearTracked,
		trackedCount,
		isInitialized,
	};

	return (
		<TrackedOpportunitiesContext.Provider value={contextValue}>
			{children}
		</TrackedOpportunitiesContext.Provider>
	);
}

/**
 * Custom hook to use the tracked opportunities context
 */
export function useTrackedOpportunities() {
	const context = useContext(TrackedOpportunitiesContext);

	if (!context) {
		throw new Error(
			'useTrackedOpportunities must be used within a TrackedOpportunitiesProvider'
		);
	}

	return context;
}
