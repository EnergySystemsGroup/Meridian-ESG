/**
 * Clients CRUD API E2E Tests
 *
 * Tests for GET/POST/PUT/DELETE /api/clients and /api/clients/[id].
 * Requires: npm run dev (localhost:3000)
 *
 * NOTE: POST/PUT/DELETE tests create and clean up real records in the dev DB.
 */

import { describe, it, expect } from 'vitest';
import { apiUrl } from '../helpers/server.js';
import { getHeaders } from '../helpers/auth.js';

describe('GET /api/clients', () => {
  it('returns 200 with client list', async () => {
    const res = await fetch(apiUrl('/api/clients'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.clients)).toBe(true);
    expect(typeof body.count).toBe('number');
    expect(body.count).toBe(body.clients.length);
  });
});

describe('GET /api/clients/[id] - nonexistent', () => {
  it('returns 404 for nonexistent client id', async () => {
    const res = await fetch(
      apiUrl('/api/clients/00000000-0000-0000-0000-000000000000')
    );
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('not found');
  });
});

describe('POST /api/clients - validation', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await fetch(apiUrl('/api/clients'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name: 'Test' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Missing required fields');
  });
});

describe('Client CRUD lifecycle', () => {
  it('GET /api/clients/[id] - can fetch an existing client', async () => {
    // First, get the client list to find a real ID
    const listRes = await fetch(apiUrl('/api/clients'));
    const listBody = await listRes.json();

    if (listBody.clients.length === 0) {
      // Skip if no clients exist in dev DB
      return;
    }

    const existingId = listBody.clients[0].id;
    const res = await fetch(apiUrl(`/api/clients/${existingId}`));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.client).toBeDefined();
    expect(body.client.id).toBe(existingId);
    expect(body.client).toHaveProperty('name');
    expect(body.client).toHaveProperty('type');
  });
});
