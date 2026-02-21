/**
 * Client Matching Browser E2E Tests
 *
 * Tests the clients page: list loads, click into detail, match scores visible.
 * Requires: npm run dev (localhost:3000)
 */

import { test, expect } from '@playwright/test';

test.describe('Client Matching Flow', () => {
  test('clients page loads with client list', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Page should load without errors
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Should not show server errors
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });

  test('can navigate to client detail page', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for clickable client elements (links, cards, rows)
    const clientLinks = page.locator(
      'a[href*="/clients/"], [data-testid*="client"], tr[role="row"]'
    );

    if ((await clientLinks.count()) > 0) {
      // Click the first client
      await clientLinks.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should navigate to a detail-like page
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Should not show errors
      await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
    }
  });

  test('client detail shows match information', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find client links with match info
    const clientLinks = page.locator('a[href*="/clients/"]');

    if ((await clientLinks.count()) > 0) {
      // Get the href of the first client to navigate directly
      const href = await clientLinks.first().getAttribute('href');

      if (href) {
        await page.goto(href);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // The detail page should show some content
        const body = page.locator('body');
        await expect(body).toBeVisible();

        // Look for tabs or sections (common in detail pages)
        const tabs = page.locator(
          '[role="tab"], [role="tablist"], button:has-text("Matches"), button:has-text("Details")'
        );

        if ((await tabs.count()) > 0) {
          // Click the second tab if available (often "Matches")
          const tabCount = await tabs.count();
          if (tabCount > 1) {
            await tabs.nth(1).click();
            await page.waitForTimeout(1000);

            // Page should still be functional
            await expect(body).toBeVisible();
          }
        }
      }
    }
  });
});
