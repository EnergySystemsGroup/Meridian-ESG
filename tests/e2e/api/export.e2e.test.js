/**
 * Export API E2E Tests
 *
 * Tests for POST /api/export/client-matches-pdf.
 * Requires: npm run dev (localhost:3000)
 */

import { describe, it, expect } from 'vitest';
import { apiUrl } from '../helpers/server.js';
import { getHeaders } from '../helpers/auth.js';

describe('POST /api/export/client-matches-pdf', () => {
  it('returns 400 when clientId is missing', async () => {
    const res = await fetch(apiUrl('/api/export/client-matches-pdf'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Client ID is required');
  });

  it('returns 404 for nonexistent client', async () => {
    const res = await fetch(apiUrl('/api/export/client-matches-pdf'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        clientId: '00000000-0000-0000-0000-000000000000',
      }),
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toContain('Client not found');
  });

  it('accepts valid client and attempts PDF generation', async () => {
    // Find a real client ID
    const listRes = await fetch(apiUrl('/api/clients'));
    const listBody = await listRes.json();

    expect(listBody.clients.length).toBeGreaterThan(0);

    const clientId = listBody.clients[0].id;

    const res = await fetch(apiUrl('/api/export/client-matches-pdf'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ clientId }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    expect(res.headers.get('content-disposition')).toContain('attachment');
  }, 60000); // PDF generation may be slow
});
