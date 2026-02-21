/**
 * Admin Review API E2E Tests
 *
 * Tests for GET /api/admin/review, POST approve/reject/demote.
 * Requires: npm run dev (localhost:3000)
 */

import { describe, it, expect } from 'vitest';
import { apiUrl } from '../helpers/server.js';
import { getHeaders } from '../helpers/auth.js';

describe('GET /api/admin/review', () => {
  it('returns 200 with pending_review records', async () => {
    const res = await fetch(apiUrl('/api/admin/review'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total_count).toBe('number');
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination.page).toBe('number');
    expect(typeof body.pagination.page_size).toBe('number');
  });

  it('supports status=all filter', async () => {
    const res = await fetch(apiUrl('/api/admin/review?status=all'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('supports pagination', async () => {
    const res = await fetch(apiUrl('/api/admin/review?page=1&page_size=5'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(body.pagination.page_size).toBe(5);
  });
});

describe('POST /api/admin/review/approve - validation', () => {
  it('returns 400 when ids are missing', async () => {
    const res = await fetch(apiUrl('/api/admin/review/approve'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reviewed_by: 'test' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('ids');
  });

  it('returns 400 when reviewed_by is missing', async () => {
    const res = await fetch(apiUrl('/api/admin/review/approve'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ids: ['some-id'] }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('reviewed_by');
  });
});

describe('POST /api/admin/review/reject - validation', () => {
  it('returns 400 when ids are missing', async () => {
    const res = await fetch(apiUrl('/api/admin/review/reject'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reviewed_by: 'test' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('ids');
  });

  it('returns 400 when reviewed_by is missing', async () => {
    const res = await fetch(apiUrl('/api/admin/review/reject'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ids: ['some-id'] }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('reviewed_by');
  });
});

describe('POST /api/admin/review/demote - validation', () => {
  it('returns 400 when id is missing', async () => {
    const res = await fetch(apiUrl('/api/admin/review/demote'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reviewed_by: 'test' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('id');
  });

  it('returns 400 when reviewed_by is missing', async () => {
    const res = await fetch(apiUrl('/api/admin/review/demote'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ id: 'some-id' }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('reviewed_by');
  });

  it('returns 404 for nonexistent record', async () => {
    const res = await fetch(apiUrl('/api/admin/review/demote'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000000',
        reviewed_by: 'e2e-test',
      }),
    });
    expect(res.status).toBe(404);
  });
});
