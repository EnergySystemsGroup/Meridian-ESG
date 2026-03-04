/**
 * Map Drill-Down Browser E2E Tests
 *
 * Tests the map page state drill-down via URL params.
 * Uses /map?view=state&state=OR to bypass SVG click fragility.
 * Requires: npm run dev (localhost:3000)
 */

import { test, expect } from '@playwright/test';

test.describe('Map Drill-Down', () => {
  test('state view shows state name and opportunities', async ({ page }) => {
    await page.goto('/map?view=state&state=OR');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Page should load without errors
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();

    // Should show Oregon in the page content
    const oregonText = page.locator('text=Oregon');
    await expect(oregonText.first()).toBeVisible();

    // Should show opportunity links or a count indicator
    const opportunityLinks = page.locator('a[href*="/funding/opportunities/"]');
    expect(await opportunityLinks.count()).toBeGreaterThan(0);
  });

  test('back to US view works', async ({ page }) => {
    await page.goto('/map?view=state&state=OR');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // A back/US button must exist
    const backButton = page.locator(
      'button:has-text("US"), button:has-text("Back"), button:has-text("All States")'
    );
    expect(await backButton.count()).toBeGreaterThan(0);

    await backButton.first().click();
    await page.waitForTimeout(2000);

    // Should return to the national view — map SVG should be visible
    const mapElement = page.locator('svg, [class*="map"], [data-testid*="map"]');
    expect(await mapElement.count()).toBeGreaterThan(0);
  });
});
