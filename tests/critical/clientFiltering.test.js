/**
 * Client Filtering Logic Tests
 *
 * Tests the user-based filtering logic used by client and matching API routes.
 * Inline functions replicate the production logic in lib/utils/clientFiltering.js.
 */

import { describe, test, expect } from 'vitest';

/**
 * Inline version of the filtering resolution logic.
 * Determines which client IDs to return based on user_id param and auth state.
 *
 * @param {string|null} userIdParam - The user_id query parameter
 * @param {string|null} authenticatedUserId - The current user's ID (null if not authenticated)
 * @param {{ client_id: string, user_id: string }[]} clientUsersRows - Rows from client_users table
 * @returns {{ clientIds: string[] | null, userId: string | null }}
 */
function resolveClientFilter(userIdParam, authenticatedUserId, clientUsersRows) {
  // Explicit "all" — no filtering
  if (userIdParam === 'all') {
    return { clientIds: null, userId: null };
  }

  // Determine which user to filter by
  let filterUserId = userIdParam;

  if (!filterUserId) {
    if (authenticatedUserId) {
      filterUserId = authenticatedUserId;
    } else {
      // Not authenticated and no explicit user_id → show all
      return { clientIds: null, userId: null };
    }
  }

  // Filter client_users rows for this user
  const userClients = clientUsersRows
    .filter(row => row.user_id === filterUserId)
    .map(row => row.client_id);

  return {
    clientIds: userClients,
    userId: filterUserId,
  };
}

/**
 * Inline version of the query filtering logic applied after resolving client IDs.
 * Mirrors how routes use clientIds to filter results.
 */
function filterByClientIds(allClients, clientIds) {
  if (clientIds === null) return allClients; // no filtering
  const idSet = new Set(clientIds);
  return allClients.filter(c => idSet.has(c.id));
}

// --- Test data ---
const clientUsersData = [
  { client_id: 'client-1', user_id: 'user-A' },
  { client_id: 'client-2', user_id: 'user-A' },
  { client_id: 'client-3', user_id: 'user-B' },
  { client_id: 'client-1', user_id: 'user-B' }, // client-1 assigned to both users
];

const allClients = [
  { id: 'client-1', name: 'City of SF' },
  { id: 'client-2', name: 'City of LA' },
  { id: 'client-3', name: 'City of NYC' },
  { id: 'client-4', name: 'City of Chicago' }, // not assigned to any user
];

describe('Client Filtering Logic', () => {
  describe('resolveClientFilter', () => {
    test('user_id=all returns null clientIds (no filtering)', () => {
      const result = resolveClientFilter('all', 'user-A', clientUsersData);
      expect(result.clientIds).toBeNull();
      expect(result.userId).toBeNull();
    });

    test('explicit user_id returns that user\'s assigned clients', () => {
      const result = resolveClientFilter('user-A', null, clientUsersData);
      expect(result.clientIds).toEqual(['client-1', 'client-2']);
      expect(result.userId).toBe('user-A');
    });

    test('explicit user_id for user-B returns their clients', () => {
      const result = resolveClientFilter('user-B', null, clientUsersData);
      expect(result.clientIds).toEqual(['client-3', 'client-1']);
      expect(result.userId).toBe('user-B');
    });

    test('no user_id + authenticated defaults to current user', () => {
      const result = resolveClientFilter(null, 'user-A', clientUsersData);
      expect(result.clientIds).toEqual(['client-1', 'client-2']);
      expect(result.userId).toBe('user-A');
    });

    test('no user_id + not authenticated returns null (all clients)', () => {
      const result = resolveClientFilter(null, null, clientUsersData);
      expect(result.clientIds).toBeNull();
      expect(result.userId).toBeNull();
    });

    test('user with no client_users entries returns empty array', () => {
      const result = resolveClientFilter('user-C', null, clientUsersData);
      expect(result.clientIds).toEqual([]);
      expect(result.userId).toBe('user-C');
    });

    test('explicit user_id takes precedence over authenticated user', () => {
      const result = resolveClientFilter('user-B', 'user-A', clientUsersData);
      expect(result.clientIds).toEqual(['client-3', 'client-1']);
      expect(result.userId).toBe('user-B');
    });
  });

  describe('filterByClientIds', () => {
    test('null clientIds returns all clients (no filtering)', () => {
      const result = filterByClientIds(allClients, null);
      expect(result).toHaveLength(4);
      expect(result).toEqual(allClients);
    });

    test('filters to only specified client IDs', () => {
      const result = filterByClientIds(allClients, ['client-1', 'client-2']);
      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toEqual(['client-1', 'client-2']);
    });

    test('empty clientIds returns no clients', () => {
      const result = filterByClientIds(allClients, []);
      expect(result).toHaveLength(0);
    });

    test('unassigned clients are excluded when filtering', () => {
      // client-4 is not in any user's assignment
      const result = filterByClientIds(allClients, ['client-1', 'client-3']);
      expect(result.map(c => c.id)).not.toContain('client-4');
    });

    test('shared client appears for both users', () => {
      // client-1 is assigned to both user-A and user-B
      const userAClients = resolveClientFilter(null, 'user-A', clientUsersData);
      const userBClients = resolveClientFilter(null, 'user-B', clientUsersData);

      expect(userAClients.clientIds).toContain('client-1');
      expect(userBClients.clientIds).toContain('client-1');
    });
  });

  describe('Cache key derivation', () => {
    test('cache key is userId when filtering by user', () => {
      const { userId } = resolveClientFilter(null, 'user-A', clientUsersData);
      const cacheKey = userId || 'all';
      expect(cacheKey).toBe('user-A');
    });

    test('cache key is "all" when not filtering', () => {
      const { userId } = resolveClientFilter('all', 'user-A', clientUsersData);
      const cacheKey = userId || 'all';
      expect(cacheKey).toBe('all');
    });

    test('cache key is "all" when not authenticated', () => {
      const { userId } = resolveClientFilter(null, null, clientUsersData);
      const cacheKey = userId || 'all';
      expect(cacheKey).toBe('all');
    });

    test('different users produce different cache keys', () => {
      const resultA = resolveClientFilter(null, 'user-A', clientUsersData);
      const resultB = resolveClientFilter(null, 'user-B', clientUsersData);
      expect(resultA.userId).not.toBe(resultB.userId);
    });
  });
});
