/**
 * Core API E2E Tests
 *
 * Smoke tests for core user-facing endpoints.
 * Requires: npm run dev (localhost:3000)
 */

import { describe, it, expect } from 'vitest';
import { apiUrl } from '../helpers/server.js';

describe('GET /api/funding', () => {
  it('returns 200 with paginated array', async () => {
    const res = await fetch(apiUrl('/api/funding'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.pagination).toBe('object');
    expect(body.pagination).not.toBeNull();
    expect(typeof body.pagination.page).toBe('number');
    expect(typeof body.pagination.pageSize).toBe('number');
    expect(typeof body.pagination.total).toBe('number');
  });

  it('respects page_size parameter', async () => {
    const res = await fetch(apiUrl('/api/funding?page_size=2'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(2);
    expect(body.pagination.pageSize).toBe(2);
  });

  it('supports status filter', async () => {
    const res = await fetch(apiUrl('/api/funding?status=Open'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    // Every returned item must match the requested status
    body.data.forEach((item) => {
      expect(item.status).toBe('Open');
    });
  });

  it('supports state filter', async () => {
    const res = await fetch(apiUrl('/api/funding?state=FL'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    // Every returned item must cover FL (state-specific or national)
    body.data.forEach((item) => {
      const coversFL =
        item.is_national === true ||
        (Array.isArray(item.coverage_state_codes) &&
          item.coverage_state_codes.includes('FL'));
      expect(coversFL).toBe(true);
    });
  });
});

describe('GET /api/counts', () => {
  it('returns 200 with count for open_opportunities type', async () => {
    const res = await fetch(apiUrl('/api/counts?type=open_opportunities'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.count).toBe('number');
  });

  it('returns 400 for missing type', async () => {
    const res = await fetch(apiUrl('/api/counts'));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('GET /api/deadlines', () => {
  it('returns 200 with sorted deadline data', async () => {
    const res = await fetch(apiUrl('/api/deadlines'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    expect(body.data.length).toBeGreaterThan(0);

    const first = body.data[0];
    expect(typeof first.close_date).toBe('string');
    expect(typeof first.daysLeft).toBe('number');
    expect(typeof first.urgency).toBe('string');

    // Verify sorted by date ascending (earliest deadlines first)
    expect(body.data.length).toBeGreaterThan(1);
    for (let i = 1; i < body.data.length; i++) {
      const prev = new Date(body.data[i - 1].close_date);
      const curr = new Date(body.data[i].close_date);
      expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime());
    }
  });

  it('returns thirty_day_count as integer', async () => {
    const res = await fetch(apiUrl('/api/deadlines?type=thirty_day_count'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.count).toBe('number');
    expect(Number.isInteger(body.count)).toBe(true);
  });
});

describe('GET /api/categories', () => {
  it('returns 200 with categories array', async () => {
    const res = await fetch(apiUrl('/api/categories'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.categories)).toBe(true);

    expect(body.categories.length).toBeGreaterThan(0);
    expect(typeof body.categories[0]).toBe('string');

    expect(typeof body.categoryGroups).toBe('object');
    expect(body.categoryGroups).not.toBeNull();
  });
});

describe('GET /api/project-types', () => {
  it('returns 200 with project types array', async () => {
    const res = await fetch(apiUrl('/api/project-types'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.projectTypes)).toBe(true);

    expect(body.projectTypes.length).toBeGreaterThan(0);
    expect(typeof body.projectTypes[0]).toBe('string');

    expect(typeof body.projectTypeGroups).toBe('object');
    expect(body.projectTypeGroups).not.toBeNull();
  });
});

describe('GET /api/funding/coverage-counts', () => {
  it('returns 200 with counts object (no state filter)', async () => {
    const res = await fetch(apiUrl('/api/funding/coverage-counts'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.counts).toBe('object');

    // Counts object must have entries and each value must be a number
    const values = Object.values(body.counts);
    expect(values.length).toBeGreaterThan(0);
    values.forEach((v) => expect(typeof v).toBe('number'));
  });

  it('returns 200 with state-filtered counts', async () => {
    const res = await fetch(apiUrl('/api/funding/coverage-counts?state=OR'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.counts).toBe('object');
  });
});

describe('GET /api/funding/total-available', () => {
  it('returns 200 with total funding amount', async () => {
    const res = await fetch(apiUrl('/api/funding/total-available'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.timestamp).toBe('string');
    expect(typeof body.cached).toBe('boolean');
  });
});

describe('Error handling', () => {
  it('returns 404 for nonexistent API endpoint', async () => {
    const res = await fetch(apiUrl('/api/this-endpoint-does-not-exist'));
    expect(res.status).toBe(404);
  });
});
