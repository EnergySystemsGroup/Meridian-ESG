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

    // Page should have the correct title
    await expect(page).toHaveTitle(/Policy & Funding Intelligence|Meridian/i);

    // Should not show an error page
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();

    // Dashboard should show a heading
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible();
  });

  test('Explorer (/funding/opportunities) loads with content', async ({ page }) => {
    await page.goto('/funding/opportunities');
    await page.waitForLoadState('networkidle');

    // Should not show an error page
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();

    // Explorer should show a heading or content area
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible();
  });

  test('Map (/map) loads with map content', async ({ page }) => {
    await page.goto('/map');
    await page.waitForLoadState('networkidle');

    // Look for SVG map element or map container
    const mapElement = page.locator('svg, [class*="map"], [data-testid*="map"]');
    expect(await mapElement.count()).toBeGreaterThan(0);
  });

  test('Clients (/clients) loads', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Should not show an error page
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();

    // Should show a heading
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible();
  });

  test('Admin Review (/admin/review) loads', async ({ page }) => {
    await page.goto('/admin/review');
    await page.waitForLoadState('networkidle');

    // Should not show an error page
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();

    // Should show a heading
    const heading = page.locator('h1, h2, text=/Review|Opportunity/i');
    await expect(heading.first()).toBeVisible();
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

      // Separate hydration/React warnings from critical errors.
      // Hydration warnings are tracked tech debt — count must not increase.
      const hydrationWarnings = errors.filter(
        (msg) =>
          msg.includes('Hydration') ||
          msg.includes('hydration') ||
          msg.includes('Warning:')
      );
      const criticalErrors = errors.filter(
        (msg) =>
          !msg.includes('Hydration') &&
          !msg.includes('hydration') &&
          !msg.includes('Warning:')
      );

      // TODO: Fix hydration warnings. Current known ceiling: 5 per page.
      // If this fails, a NEW hydration issue was introduced — investigate before bumping.
      expect(hydrationWarnings.length).toBeLessThanOrEqual(5);

      expect(criticalErrors).toEqual([]);
    });
  }
});
