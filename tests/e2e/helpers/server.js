/**
 * E2E Test Server Configuration
 *
 * Both API e2e (Vitest) and browser e2e (Playwright) tests require
 * a running dev server. Start it before running tests:
 *
 *   npm run dev
 *
 * Override the base URL with the E2E_BASE_URL environment variable:
 *
 *   E2E_BASE_URL=http://localhost:3001 npm run test:e2e
 */

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

/**
 * Build a full URL for an API endpoint.
 * @param {string} path - API path starting with / (e.g. '/api/counts')
 * @returns {string} Full URL
 */
export function apiUrl(path) {
  return `${BASE_URL}${path}`;
}
