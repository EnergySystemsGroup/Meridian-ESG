/**
 * Tracked (Starred) Opportunities Tests
 *
 * Tests the logic for tracking/untracking opportunities:
 * - Adding to tracked list
 * - Removing from tracked list
 * - Filtering opportunities by tracked status
 * - Persistence format (array of IDs)
 */

import { describe, test, expect } from 'vitest';
import { opportunities } from '../../fixtures/opportunities.js';

/**
 * Add opportunity ID to tracked list
 */
function addTracked(trackedIds, oppId) {
  if (trackedIds.includes(oppId)) return trackedIds;
  return [...trackedIds, oppId];
}

/**
 * Remove opportunity ID from tracked list
 */
function removeTracked(trackedIds, oppId) {
  return trackedIds.filter(id => id !== oppId);
}

/**
 * Toggle tracked status
 */
function toggleTracked(trackedIds, oppId) {
  return trackedIds.includes(oppId)
    ? removeTracked(trackedIds, oppId)
    : addTracked(trackedIds, oppId);
}

/**
 * Filter opportunities to show only tracked ones
 */
function filterTracked(opps, trackedIds) {
  return opps.filter(opp => trackedIds.includes(opp.id));
}

/**
 * Check if an opportunity is tracked
 */
function isTracked(trackedIds, oppId) {
  return trackedIds.includes(oppId);
}

/**
 * Get tracked count
 */
function getTrackedCount(trackedIds) {
  return trackedIds.length;
}

const allOpps = Object.values(opportunities);

describe('Tracked Opportunities', () => {

  describe('Add to Tracked', () => {
    test('adds new opportunity to empty list', () => {
      const result = addTracked([], 'opp-1');
      expect(result).toEqual(['opp-1']);
    });

    test('adds new opportunity to existing list', () => {
      const result = addTracked(['opp-1'], 'opp-2');
      expect(result).toEqual(['opp-1', 'opp-2']);
    });

    test('does not duplicate existing ID', () => {
      const result = addTracked(['opp-1', 'opp-2'], 'opp-1');
      expect(result).toEqual(['opp-1', 'opp-2']);
    });

    test('preserves order', () => {
      let tracked = [];
      tracked = addTracked(tracked, 'opp-3');
      tracked = addTracked(tracked, 'opp-1');
      tracked = addTracked(tracked, 'opp-2');
      expect(tracked).toEqual(['opp-3', 'opp-1', 'opp-2']);
    });
  });

  describe('Remove from Tracked', () => {
    test('removes existing ID', () => {
      const result = removeTracked(['opp-1', 'opp-2', 'opp-3'], 'opp-2');
      expect(result).toEqual(['opp-1', 'opp-3']);
    });

    test('returns same array when ID not found', () => {
      const result = removeTracked(['opp-1', 'opp-2'], 'opp-99');
      expect(result).toEqual(['opp-1', 'opp-2']);
    });

    test('returns empty array when removing last item', () => {
      const result = removeTracked(['opp-1'], 'opp-1');
      expect(result).toEqual([]);
    });

    test('handles empty array', () => {
      const result = removeTracked([], 'opp-1');
      expect(result).toEqual([]);
    });
  });

  describe('Toggle Tracked', () => {
    test('adds when not tracked', () => {
      const result = toggleTracked([], 'opp-1');
      expect(result).toEqual(['opp-1']);
    });

    test('removes when already tracked', () => {
      const result = toggleTracked(['opp-1'], 'opp-1');
      expect(result).toEqual([]);
    });

    test('toggle twice returns to original', () => {
      const original = ['opp-1', 'opp-2'];
      const toggled1 = toggleTracked(original, 'opp-3');
      const toggled2 = toggleTracked(toggled1, 'opp-3');
      expect(toggled2).toEqual(original);
    });
  });

  describe('Filter by Tracked', () => {
    test('returns only tracked opportunities', () => {
      const trackedIds = [
        opportunities.nationalGrant.id,
        opportunities.pgeUtilityGrant.id,
      ];

      const result = filterTracked(allOpps, trackedIds);

      expect(result).toHaveLength(2);
      expect(result.map(o => o.id)).toContain(opportunities.nationalGrant.id);
      expect(result.map(o => o.id)).toContain(opportunities.pgeUtilityGrant.id);
    });

    test('returns empty when no tracked IDs', () => {
      const result = filterTracked(allOpps, []);
      expect(result).toEqual([]);
    });

    test('returns empty when tracked IDs dont match any opportunities', () => {
      const result = filterTracked(allOpps, ['nonexistent-1', 'nonexistent-2']);
      expect(result).toEqual([]);
    });

    test('ignores tracked IDs that dont exist in opportunities', () => {
      const trackedIds = [opportunities.nationalGrant.id, 'nonexistent-1'];
      const result = filterTracked(allOpps, trackedIds);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(opportunities.nationalGrant.id);
    });
  });

  describe('isTracked Check', () => {
    test('returns true for tracked ID', () => {
      expect(isTracked(['opp-1', 'opp-2'], 'opp-1')).toBe(true);
    });

    test('returns false for untracked ID', () => {
      expect(isTracked(['opp-1', 'opp-2'], 'opp-3')).toBe(false);
    });

    test('returns false for empty list', () => {
      expect(isTracked([], 'opp-1')).toBe(false);
    });
  });

  describe('Tracked Count', () => {
    test('returns 0 for empty list', () => {
      expect(getTrackedCount([])).toBe(0);
    });

    test('returns correct count', () => {
      expect(getTrackedCount(['a', 'b', 'c'])).toBe(3);
    });
  });
});
