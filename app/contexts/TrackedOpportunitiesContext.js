'use client';

import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	useRef,
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
	// Reference to track scroll position when toggling tracked opportunities
	const scrollPositionRef = useRef(0);

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

	// Restore scroll position when trackedOpportunityIds changes
	useEffect(() => {
		// Only run on client side and when we have a saved scroll position
		if (typeof window === 'undefined' || scrollPositionRef.current <= 0) return;

		// Use setTimeout to ensure React has finished rendering
		const timeout = setTimeout(() => {
			window.scrollTo({
				top: scrollPositionRef.current,
				behavior: 'instant', // Use instant to avoid smooth scrolling animation
			});
		}, 0);

		// Clean up timeout if component unmounts
		return () => clearTimeout(timeout);
	}, [trackedOpportunityIds]);

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
	const toggleTracked = useCallback(
		(opportunityId) => {
			console.log(`[Context] Toggling track for ID: ${opportunityId}`);
			// Save the current scroll position before state updates
			if (typeof window !== 'undefined') {
				scrollPositionRef.current = window.scrollY;
			}
			// Create a one-time scroll restoration that will execute right after this event loop
			Promise.resolve().then(() => {
				requestAnimationFrame(() => {
					window.scrollTo(0, scrollPositionRef.current);
				});
			});
			setTrackedOpportunityIds((currentIds) => {
				console.log('[Context] Current IDs before toggle:', currentIds);
				const alreadyTracked = currentIds.includes(opportunityId);
				let newIds;

				if (alreadyTracked) {
					// If already tracked, remove it
					console.log('[Context] ID found, removing...');
					newIds = currentIds.filter((id) => id !== opportunityId);
					console.log('[Context] New IDs after removing:', newIds);
				} else {
					// If not tracked, add it
					console.log('[Context] ID not found, adding...');
					newIds = [...currentIds, opportunityId];
					console.log('[Context] New IDs after adding:', newIds);
				}

				// Update localStorage with minimal overhead
				if (typeof window !== 'undefined' && isInitialized) {
					// Use requestAnimationFrame to defer the localStorage update
					// This helps prevent blocking the main thread during state updates
					requestAnimationFrame(() => {
						localStorage.setItem(
							TRACKED_OPPORTUNITIES_KEY,
							JSON.stringify(newIds)
						);
					});
				}

				return newIds;
			});
		},
		[isInitialized]
	);

	/**
	 * Clear all tracked opportunities
	 */
	const clearTracked = useCallback(() => {
		setTrackedOpportunityIds([]);
		// Use requestAnimationFrame to defer the localStorage update
		if (typeof window !== 'undefined' && isInitialized) {
			requestAnimationFrame(() => {
				localStorage.setItem(TRACKED_OPPORTUNITIES_KEY, '[]');
			});
		}
	}, [isInitialized]);

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
