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
    expect(body.pagination).toBeDefined();
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
  });

  it('supports state filter', async () => {
    const res = await fetch(apiUrl('/api/funding?state=FL'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
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

    // If there are deadlines, verify shape
    if (body.data.length > 0) {
      const first = body.data[0];
      expect(first).toHaveProperty('close_date');
      expect(first).toHaveProperty('daysLeft');
      expect(typeof first.daysLeft).toBe('number');
      expect(first).toHaveProperty('urgency');
    }

    // Verify sorted by date ascending (earliest deadlines first)
    if (body.data.length > 1) {
      for (let i = 1; i < body.data.length; i++) {
        const prev = new Date(body.data[i - 1].close_date);
        const curr = new Date(body.data[i].close_date);
        expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime());
      }
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

    // Each category should be a string
    if (body.categories.length > 0) {
      expect(typeof body.categories[0]).toBe('string');
    }

    // Should also include categoryGroups
    expect(body.categoryGroups).toBeDefined();
    expect(typeof body.categoryGroups).toBe('object');
  });
});

describe('GET /api/project-types', () => {
  it('returns 200 with project types array', async () => {
    const res = await fetch(apiUrl('/api/project-types'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.projectTypes)).toBe(true);

    // Each project type should be a string
    if (body.projectTypes.length > 0) {
      expect(typeof body.projectTypes[0]).toBe('string');
    }

    // Should include projectTypeGroups with counts
    expect(body.projectTypeGroups).toBeDefined();
    expect(typeof body.projectTypeGroups).toBe('object');
  });
});
