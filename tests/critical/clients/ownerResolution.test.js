/**
 * Client Owner Resolution Tests
 *
 * Tests the soft-auth owner resolution logic in POST /api/clients:
 * - Resolving owner_id from authenticated session
 * - Graceful fallback when no session exists
 * - client_users association creation after client insert
 */

import { describe, test, expect } from 'vitest';

// --- Inline functions mirroring production logic in app/api/clients/route.js ---

/**
 * Resolve owner ID from an auth session result.
 * Mirrors the soft-auth pattern: attempt to get user, fallback to null.
 */
function resolveOwnerId(authResult) {
  if (authResult?.user?.id) {
    return authResult.user.id;
  }
  return null;
}

/**
 * Build client data object with optional owner_id.
 * Mirrors the clientData construction in the POST handler.
 */
function buildClientData(body, ownerId) {
  return {
    name: body.name,
    type: body.type,
    address: body.address,
    project_needs: body.project_needs || [],
    contact: body.contact || null,
    description: body.description || null,
    dac: body.dac || false,
    salesforce_id: body.salesforce_id || null,
    owner_id: ownerId
  };
}

/**
 * Determine whether a client_users association should be created.
 * Mirrors the conditional: only insert if ownerId is truthy.
 */
function shouldCreateAssociation(ownerId) {
  return !!ownerId;
}

/**
 * Build the client_users row for insertion.
 */
function buildClientUsersRow(clientId, userId) {
  return {
    client_id: clientId,
    user_id: userId
  };
}

// --- Tests ---

describe('Owner Resolution: Soft Auth', () => {
  test('resolves owner_id from valid auth result', () => {
    const authResult = { user: { id: 'user-abc-123' } };
    expect(resolveOwnerId(authResult)).toBe('user-abc-123');
  });

  test('returns null when auth result has no user', () => {
    const authResult = { user: null };
    expect(resolveOwnerId(authResult)).toBeNull();
  });

  test('returns null when auth result is null (no session)', () => {
    expect(resolveOwnerId(null)).toBeNull();
  });

  test('returns null when auth result is undefined (error case)', () => {
    expect(resolveOwnerId(undefined)).toBeNull();
  });

  test('returns null when user has no id', () => {
    const authResult = { user: { email: 'test@example.com' } };
    expect(resolveOwnerId(authResult)).toBeNull();
  });
});

describe('Owner Resolution: Client Data Construction', () => {
  const baseBody = {
    name: 'City of Springfield',
    type: 'Municipal Government',
    address: '123 Main St'
  };

  test('includes owner_id when authenticated', () => {
    const data = buildClientData(baseBody, 'user-123');
    expect(data.owner_id).toBe('user-123');
    expect(data.name).toBe('City of Springfield');
  });

  test('owner_id is null when not authenticated', () => {
    const data = buildClientData(baseBody, null);
    expect(data.owner_id).toBeNull();
  });

  test('owner_id field always present in data object', () => {
    const data = buildClientData(baseBody, null);
    expect('owner_id' in data).toBe(true);
  });

  test('other fields unaffected by owner_id', () => {
    const bodyWithExtras = {
      ...baseBody,
      project_needs: ['Solar'],
      contact: 'Jane Doe',
      dac: true,
      salesforce_id: 'SF-001'
    };
    const data = buildClientData(bodyWithExtras, 'user-123');
    expect(data.project_needs).toEqual(['Solar']);
    expect(data.contact).toBe('Jane Doe');
    expect(data.dac).toBe(true);
    expect(data.salesforce_id).toBe('SF-001');
  });
});

describe('Owner Resolution: Client Users Association', () => {
  test('association created when owner_id exists', () => {
    expect(shouldCreateAssociation('user-123')).toBe(true);
  });

  test('association NOT created when owner_id is null', () => {
    expect(shouldCreateAssociation(null)).toBe(false);
  });

  test('association NOT created when owner_id is undefined', () => {
    expect(shouldCreateAssociation(undefined)).toBe(false);
  });

  test('association NOT created when owner_id is empty string', () => {
    expect(shouldCreateAssociation('')).toBe(false);
  });

  test('builds correct client_users row', () => {
    const row = buildClientUsersRow('client-abc', 'user-xyz');
    expect(row).toEqual({
      client_id: 'client-abc',
      user_id: 'user-xyz'
    });
  });
});
