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

describe('PUT /api/clients/[id]', () => {
  it('updates an existing client and restores original', async () => {
    // Find an existing client
    const listRes = await fetch(apiUrl('/api/clients'));
    const listBody = await listRes.json();

    expect(listBody.clients.length).toBeGreaterThan(0);

    const client = listBody.clients[0];
    const originalName = client.name;
    const tempName = `E2E-Test-Update-${Date.now()}`;

    // PUT with updated name
    const updateRes = await fetch(apiUrl(`/api/clients/${client.id}`), {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name: tempName, type: client.type }),
    });
    expect(updateRes.status).toBe(200);

    const updateBody = await updateRes.json();
    expect(updateBody.success).toBe(true);
    expect(typeof updateBody.client).toBe('object');
    expect(updateBody.client).not.toBeNull();
    expect(updateBody.client.name).toBe(tempName);

    // Restore original name
    await fetch(apiUrl(`/api/clients/${client.id}`), {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name: originalName, type: client.type }),
    });
  });

  it('returns 404 for nonexistent client', async () => {
    const res = await fetch(
      apiUrl('/api/clients/00000000-0000-0000-0000-000000000000'),
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ name: 'Test', type: 'Municipality' }),
      }
    );
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('not found');
  });
});

describe('DELETE /api/clients/[id] - lifecycle', () => {
  it('can create and delete a test client', async () => {
    // Create a temp client
    const createRes = await fetch(apiUrl('/api/clients'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name: `E2E-TEMP-DELETE-${Date.now()}`,
        type: 'Municipality',
        address: '1600 Pennsylvania Ave NW, Washington, DC 20500',
      }),
    });

    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    expect(typeof createBody.client).toBe('object');
    expect(createBody.client).not.toBeNull();

    const clientId = createBody.client.id;

    // Delete the temp client
    const deleteRes = await fetch(apiUrl(`/api/clients/${clientId}`), {
      method: 'DELETE',
    });
    expect(deleteRes.status).toBe(200);

    const deleteBody = await deleteRes.json();
    expect(deleteBody.success).toBe(true);
    expect(deleteBody.message).toContain('deleted');

    // Verify it's gone
    const getRes = await fetch(apiUrl(`/api/clients/${clientId}`));
    expect(getRes.status).toBe(404);
  });
});

describe('Client CRUD lifecycle', () => {
  it('GET /api/clients/[id] - can fetch an existing client', async () => {
    // First, get the client list to find a real ID
    const listRes = await fetch(apiUrl('/api/clients'));
    const listBody = await listRes.json();

    expect(listBody.clients.length).toBeGreaterThan(0);

    const existingId = listBody.clients[0].id;
    const res = await fetch(apiUrl(`/api/clients/${existingId}`));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.client).toBe('object');
    expect(body.client).not.toBeNull();
    expect(body.client.id).toBe(existingId);
    expect(typeof body.client.name).toBe('string');
    expect(typeof body.client.type).toBe('string');
  });
});
