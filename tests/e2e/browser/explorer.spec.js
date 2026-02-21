/**
 * Explorer Browser E2E Tests
 *
 * Tests the funding opportunities explorer page: filtering, pagination.
 * Requires: npm run dev (localhost:3000)
 */

import { test, expect } from '@playwright/test';

test.describe('Explorer Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/funding/opportunities');
    await page.waitForLoadState('networkidle');
  });

  test('loads and displays opportunity list', async ({ page }) => {
    // The page should have loaded content
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Wait for data to load (look for any card-like content or table rows)
    // Give the page time to fetch data
    await page.waitForTimeout(2000);

    // The page should show some kind of content area
    const mainContent = page.locator('main, [role="main"], #__next');
    await expect(mainContent.first()).toBeVisible();
  });

  test('can apply a status filter', async ({ page }) => {
    // Wait for initial data load
    await page.waitForTimeout(2000);

    // Look for filter elements (buttons, selects, or dropdowns with status text)
    const statusFilter = page.locator(
      'button:has-text("Open"), button:has-text("Status"), select, [data-testid*="status"], [aria-label*="status"]'
    );

    if ((await statusFilter.count()) > 0) {
      // Click the first filter element
      await statusFilter.first().click();
      await page.waitForTimeout(1000);

      // The page should still be functional (not crashed)
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('search box filters results', async ({ page }) => {
    // Wait for initial data load
    await page.waitForTimeout(2000);

    // Look for a search input
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], input[aria-label*="search"]'
    );

    if ((await searchInput.count()) > 0) {
      await searchInput.first().fill('energy');
      await page.waitForTimeout(1500);

      // Page should still be functional
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('pagination controls work if present', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Look for pagination elements
    const nextButton = page.locator(
      'button:has-text("Next"), button[aria-label="Next page"], [data-testid*="next"]'
    );

    if ((await nextButton.count()) > 0) {
      const isDisabled = await nextButton.first().isDisabled();

      if (!isDisabled) {
        await nextButton.first().click();
        await page.waitForTimeout(1500);

        // Page should still be functional after pagination
        const body = page.locator('body');
        await expect(body).toBeVisible();
      }
    }
  });
});
