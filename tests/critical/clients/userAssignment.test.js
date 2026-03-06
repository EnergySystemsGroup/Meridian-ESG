/**
 * Client User Assignment Tests
 *
 * Tests the logic for syncing assigned users on client create/update.
 * Inline pure functions mirroring production logic.
 */
import { describe, test, expect } from 'vitest';

// Mirrors POST /api/clients: resolve assigned_users from body
function resolveAssignedUsers(assignedUsers, ownerId) {
  if (Array.isArray(assignedUsers) && assignedUsers.length > 0) {
    return assignedUsers;
  }
  return ownerId ? [ownerId] : [];
}

// Mirrors PUT /api/clients/[id]: check if user sync should run
function shouldSyncUsers(body) {
  return Array.isArray(body.assigned_users);
}

// Mirrors building rows for batch insert
function buildClientUsersRows(clientId, userIds) {
  return userIds.map((userId) => ({ client_id: clientId, user_id: userId }));
}

describe('resolveAssignedUsers (POST)', () => {
  test('uses assigned_users when provided', () => {
    const result = resolveAssignedUsers(['u1', 'u2'], 'u3');
    expect(result).toEqual(['u1', 'u2']);
  });

  test('falls back to ownerId when assigned_users not provided', () => {
    expect(resolveAssignedUsers(undefined, 'u3')).toEqual(['u3']);
  });

  test('falls back to ownerId when assigned_users is empty array', () => {
    expect(resolveAssignedUsers([], 'u3')).toEqual(['u3']);
  });

  test('returns empty array when no ownerId and no assigned_users', () => {
    expect(resolveAssignedUsers(undefined, null)).toEqual([]);
  });

  test('uses assigned_users even if it contains only one user', () => {
    expect(resolveAssignedUsers(['u5'], 'u3')).toEqual(['u5']);
  });

  test('does not deduplicate — caller is responsible', () => {
    expect(resolveAssignedUsers(['u1', 'u1'], 'u3')).toEqual(['u1', 'u1']);
  });
});

describe('shouldSyncUsers (PUT)', () => {
  test('syncs when assigned_users is an array', () => {
    expect(shouldSyncUsers({ assigned_users: ['u1'] })).toBe(true);
  });

  test('syncs when assigned_users is empty array (clears all)', () => {
    expect(shouldSyncUsers({ assigned_users: [] })).toBe(true);
  });

  test('does not sync when assigned_users is absent', () => {
    expect(shouldSyncUsers({ name: 'Test' })).toBe(false);
  });

  test('does not sync when assigned_users is not an array', () => {
    expect(shouldSyncUsers({ assigned_users: 'u1' })).toBe(false);
  });
});

describe('syncUserAssignments error handling (PUT)', () => {
  // Mirrors the PUT handler: delete failure or insert failure should signal error
  function syncResult(deleteError, insertError, userIds) {
    if (deleteError) return { success: false, error: 'Failed to update user assignments' };
    if (userIds.length > 0 && insertError) return { success: false, error: 'Failed to save user assignments' };
    return { success: true };
  }

  test('returns error when delete fails', () => {
    const result = syncResult('delete failed', null, ['u1']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('update user assignments');
  });

  test('returns error when insert fails after successful delete', () => {
    const result = syncResult(null, 'insert failed', ['u1']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('save user assignments');
  });

  test('returns success when both operations succeed', () => {
    const result = syncResult(null, null, ['u1', 'u2']);
    expect(result.success).toBe(true);
  });

  test('returns success when clearing all users (empty array)', () => {
    const result = syncResult(null, null, []);
    expect(result.success).toBe(true);
  });
});

describe('buildClientUsersRows', () => {
  test('builds correct rows for multiple users', () => {
    const rows = buildClientUsersRows('c1', ['u1', 'u2']);
    expect(rows).toEqual([
      { client_id: 'c1', user_id: 'u1' },
      { client_id: 'c1', user_id: 'u2' },
    ]);
  });

  test('builds single row', () => {
    const rows = buildClientUsersRows('c1', ['u1']);
    expect(rows).toEqual([{ client_id: 'c1', user_id: 'u1' }]);
  });

  test('returns empty array for no users', () => {
    expect(buildClientUsersRows('c1', [])).toEqual([]);
  });
});
