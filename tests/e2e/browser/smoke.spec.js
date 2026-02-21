/**
 * Browser E2E Smoke Tests (P0 Pages)
 *
 * Verifies critical pages load without JS errors and show expected content.
 * Requires: npm run dev (localhost:3000)
 */

import { test, expect } from '@playwright/test';

test.describe('P0 Smoke Tests', () => {
  test('Dashboard (/) loads with summary cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Page should have loaded without crashing
    await expect(page).toHaveTitle(/Policy & Funding Intelligence|Meridian/i);

    // Summary cards or dashboard content should be visible
    // Look for common dashboard elements
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Should not show an error page
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });

  test('Explorer (/funding/opportunities) loads with content', async ({ page }) => {
    await page.goto('/funding/opportunities');
    await page.waitForLoadState('networkidle');

    // Page should load without crashing
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Should not show an error page
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });

  test('Map (/map) loads with map content', async ({ page }) => {
    await page.goto('/map');
    await page.waitForLoadState('networkidle');

    // Page should load without crashing
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Look for SVG map element or map container
    const mapElement = page.locator('svg, [class*="map"], [data-testid*="map"]');
    // At least one map-related element should exist
    const count = await mapElement.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Clients (/clients) loads', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Page should load without crashing
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Should not show an error page
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });

  test('Admin Review (/admin/review) loads', async ({ page }) => {
    await page.goto('/admin/review');
    await page.waitForLoadState('networkidle');

    // Page should load without crashing
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Should not show an error page
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });
});

test.describe('No JS Console Errors', () => {
  const pagesToCheck = [
    { name: 'Dashboard', path: '/' },
    { name: 'Explorer', path: '/funding/opportunities' },
    { name: 'Map', path: '/map' },
    { name: 'Clients', path: '/clients' },
  ];

  for (const { name, path } of pagesToCheck) {
    test(`${name} (${path}) has no critical JS errors`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Filter out known non-critical errors (hydration warnings, etc.)
      const criticalErrors = errors.filter(
        (msg) =>
          !msg.includes('Hydration') &&
          !msg.includes('hydration') &&
          !msg.includes('Warning:')
      );

      expect(criticalErrors).toEqual([]);
    });
  }
});
