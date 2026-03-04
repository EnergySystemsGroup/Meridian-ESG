import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'trackedOpportunities';

/**
 * Custom PersistStorage adapter that handles backward compatibility with the
 * old TrackedOpportunitiesContext format. The old context stored a raw JSON
 * array (e.g. ["id1","id2"]), while Zustand persist expects StorageValue
 * objects ({ state: {...}, version: 0 }).
 *
 * Zustand v5's `storage` option expects PersistStorage<S>, where:
 * - getItem returns StorageValue<S> | null (parsed objects, not strings)
 * - setItem receives StorageValue<S> (objects, not strings)
 */
const backwardCompatibleStorage = {
	getItem: (name) => {
		const raw = localStorage.getItem(name);
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				return {
					state: { trackedOpportunityIds: parsed },
					version: 0,
				};
			}
			return parsed;
		} catch {
			return null;
		}
	},
	setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
	removeItem: (name) => localStorage.removeItem(name),
};

export const useTrackedOpportunitiesStore = create(
	persist(
		(set, get) => ({
			trackedOpportunityIds: [],
			isInitialized: false,

			isTracked: (id) => get().trackedOpportunityIds.includes(id),

			toggleTracked: (id) => {
				set((state) => {
					const exists = state.trackedOpportunityIds.includes(id);
					return {
						trackedOpportunityIds: exists
							? state.trackedOpportunityIds.filter((tid) => tid !== id)
							: [...state.trackedOpportunityIds, id],
					};
				});
			},

			clearTracked: () => set({ trackedOpportunityIds: [] }),

			getTrackedCount: () => get().trackedOpportunityIds.length,
		}),
		{
			name: STORAGE_KEY,
			storage: backwardCompatibleStorage,
			partialize: (state) => ({
				trackedOpportunityIds: state.trackedOpportunityIds,
			}),
			onRehydrateStorage: () => () => {
				useTrackedOpportunitiesStore.setState({ isInitialized: true });
			},
		}
	)
);
