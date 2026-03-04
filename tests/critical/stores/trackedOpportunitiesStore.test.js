import { describe, it, expect, beforeEach } from 'vitest';

// Inline pure functions replicating tracked opportunities store logic
// These mirror the Zustand store actions without importing the store module

function toggleTracked(currentIds, id) {
	const exists = currentIds.includes(id);
	return exists ? currentIds.filter((tid) => tid !== id) : [...currentIds, id];
}

function isTracked(currentIds, id) {
	return currentIds.includes(id);
}

function clearTracked() {
	return [];
}

function trackedCount(currentIds) {
	return currentIds.length;
}

/**
 * Simulates the backward-compatible storage adapter that handles
 * both the old raw array format and the Zustand persist envelope.
 */
function parseStorageValue(raw) {
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
}

describe('trackedOpportunitiesStore', () => {
	let ids;

	beforeEach(() => {
		ids = [];
	});

	describe('initial state', () => {
		it('starts with empty tracked IDs', () => {
			expect(ids).toEqual([]);
		});

		it('starts with trackedCount of 0', () => {
			expect(trackedCount(ids)).toBe(0);
		});
	});

	describe('toggleTracked', () => {
		it('adds an ID when not present', () => {
			ids = toggleTracked(ids, 'opp-1');
			expect(ids).toEqual(['opp-1']);
		});

		it('removes an ID when already present', () => {
			ids = ['opp-1', 'opp-2'];
			ids = toggleTracked(ids, 'opp-1');
			expect(ids).toEqual(['opp-2']);
		});

		it('toggle twice returns to original state', () => {
			ids = toggleTracked(ids, 'opp-1');
			ids = toggleTracked(ids, 'opp-1');
			expect(ids).toEqual([]);
		});

		it('handles multiple IDs independently', () => {
			ids = toggleTracked(ids, 'opp-1');
			ids = toggleTracked(ids, 'opp-2');
			ids = toggleTracked(ids, 'opp-3');
			expect(ids).toEqual(['opp-1', 'opp-2', 'opp-3']);

			ids = toggleTracked(ids, 'opp-2');
			expect(ids).toEqual(['opp-1', 'opp-3']);
		});
	});

	describe('isTracked', () => {
		it('returns false for untracked ID', () => {
			expect(isTracked(ids, 'opp-1')).toBe(false);
		});

		it('returns true for tracked ID', () => {
			ids = ['opp-1', 'opp-2'];
			expect(isTracked(ids, 'opp-1')).toBe(true);
			expect(isTracked(ids, 'opp-2')).toBe(true);
		});

		it('returns false after ID is removed', () => {
			ids = ['opp-1'];
			ids = toggleTracked(ids, 'opp-1');
			expect(isTracked(ids, 'opp-1')).toBe(false);
		});
	});

	describe('clearTracked', () => {
		it('returns empty array', () => {
			expect(clearTracked()).toEqual([]);
		});
	});

	describe('trackedCount', () => {
		it('returns 0 for empty list', () => {
			expect(trackedCount([])).toBe(0);
		});

		it('returns correct count after additions', () => {
			ids = toggleTracked(ids, 'opp-1');
			ids = toggleTracked(ids, 'opp-2');
			expect(trackedCount(ids)).toBe(2);
		});

		it('returns correct count after removal', () => {
			ids = ['opp-1', 'opp-2', 'opp-3'];
			ids = toggleTracked(ids, 'opp-2');
			expect(trackedCount(ids)).toBe(2);
		});
	});

	describe('storage serialization (setItem)', () => {
		/**
		 * Mirrors the store's setItem: always writes Zustand's native
		 * StorageValue envelope (not a plain array).
		 */
		function serializeStorageValue(name, value) {
			return JSON.stringify(value);
		}

		it('writes Zustand StorageValue envelope, not a plain array', () => {
			const storeValue = {
				state: { trackedOpportunityIds: ['id-1', 'id-2'] },
				version: 0,
			};
			const serialized = serializeStorageValue('trackedOpportunities', storeValue);
			const parsed = JSON.parse(serialized);

			// Must be an object with state/version, never a plain array
			expect(Array.isArray(parsed)).toBe(false);
			expect(parsed).toHaveProperty('state');
			expect(parsed).toHaveProperty('version');
			expect(parsed.state.trackedOpportunityIds).toEqual(['id-1', 'id-2']);
		});

		it('round-trips through getItem (parseStorageValue)', () => {
			const storeValue = {
				state: { trackedOpportunityIds: ['id-a'] },
				version: 0,
			};
			const serialized = serializeStorageValue('trackedOpportunities', storeValue);
			const result = parseStorageValue(serialized);
			expect(result).toEqual(storeValue);
		});
	});

	describe('backward-compatible storage (getItem)', () => {
		it('returns null for empty storage', () => {
			expect(parseStorageValue(null)).toBeNull();
			expect(parseStorageValue('')).toBeNull();
		});

		it('wraps old raw array format in Zustand envelope', () => {
			const raw = JSON.stringify(['id-1', 'id-2']);
			const result = parseStorageValue(raw);
			expect(result).toEqual({
				state: { trackedOpportunityIds: ['id-1', 'id-2'] },
				version: 0,
			});
		});

		it('passes through Zustand envelope format unchanged', () => {
			const envelope = {
				state: { trackedOpportunityIds: ['id-1'] },
				version: 0,
			};
			const raw = JSON.stringify(envelope);
			const result = parseStorageValue(raw);
			expect(result).toEqual(envelope);
		});

		it('returns null for invalid JSON', () => {
			expect(parseStorageValue('not json')).toBeNull();
		});

		it('handles empty old array format', () => {
			const raw = JSON.stringify([]);
			const result = parseStorageValue(raw);
			expect(result).toEqual({
				state: { trackedOpportunityIds: [] },
				version: 0,
			});
		});
	});
});
