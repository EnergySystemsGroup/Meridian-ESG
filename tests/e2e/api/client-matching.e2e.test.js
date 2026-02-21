/**
 * Client-Matching API E2E Tests
 *
 * Tests for client-matching, summary, and top-matches endpoints.
 * Requires: npm run dev (localhost:3000)
 */

import { describe, it, expect } from 'vitest';
import { apiUrl } from '../helpers/server.js';

describe('GET /api/client-matching', () => {
  it('returns 200 with results', async () => {
    const res = await fetch(apiUrl('/api/client-matching'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results).toBeDefined();
    expect(typeof body.results).toBe('object');
    expect(body.timestamp).toBeDefined();
  });

  it('returns 404 for nonexistent clientId', async () => {
    const res = await fetch(
      apiUrl('/api/client-matching?clientId=00000000-0000-0000-0000-000000000000')
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/client-matching/summary', () => {
  it('returns 200 with summary counts', async () => {
    const res = await fetch(apiUrl('/api/client-matching/summary'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.clientsWithMatches).toBe('number');
    expect(typeof body.totalMatches).toBe('number');
    expect(typeof body.totalClients).toBe('number');
    expect(body.timestamp).toBeDefined();
  });
});

describe('GET /api/client-matching/top-matches', () => {
  it('returns 200 with ranked matches array', async () => {
    const res = await fetch(apiUrl('/api/client-matching/top-matches'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.matches)).toBe(true);

    // Top matches should be at most 5
    expect(body.matches.length).toBeLessThanOrEqual(5);

    // Verify match shape if any exist
    if (body.matches.length > 0) {
      const match = body.matches[0];
      expect(match).toHaveProperty('client_id');
      expect(match).toHaveProperty('client_name');
      expect(match).toHaveProperty('match_count');
      expect(typeof match.match_count).toBe('number');
      expect(match).toHaveProperty('top_opportunity_title');
      expect(match).toHaveProperty('top_opportunity_score');
    }

    // Verify sorted by match_count descending
    if (body.matches.length > 1) {
      for (let i = 1; i < body.matches.length; i++) {
        expect(body.matches[i - 1].match_count).toBeGreaterThanOrEqual(
          body.matches[i].match_count
        );
      }
    }

    expect(body.timestamp).toBeDefined();
  });
});
