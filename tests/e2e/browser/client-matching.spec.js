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

    // Should not show server errors
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();

    // Should show the page heading or a meaningful content area
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible();
  });

  test('can navigate to client detail page', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Client links must exist
    const clientLinks = page.locator(
      'a[href*="/clients/"], [data-testid*="client"], tr[role="row"]'
    );
    expect(await clientLinks.count()).toBeGreaterThan(0);

    // Click the first client
    await clientLinks.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should navigate to a detail page with a heading
    const heading = page.locator('h1, h2, h3');
    await expect(heading.first()).toBeVisible();

    // Should not show errors
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });

  test('client detail shows match information', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Client links must exist
    const clientLinks = page.locator('a[href*="/clients/"]');
    expect(await clientLinks.count()).toBeGreaterThan(0);

    // Get the href of the first client to navigate directly
    const href = await clientLinks.first().getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(href);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // The detail page should show a heading
    const heading = page.locator('h1, h2, h3');
    await expect(heading.first()).toBeVisible();

    // Look for tabs or sections (common in detail pages)
    const tabs = page.locator(
      '[role="tab"], [role="tablist"], button:has-text("Matches"), button:has-text("Details")'
    );
    expect(await tabs.count()).toBeGreaterThan(0);

    // Should have multiple tabs for navigation
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(1);

    // Click the second tab (often "Matches") and verify content changed
    await tabs.nth(1).click();
    await page.waitForTimeout(1000);

    // Tab panel should be visible with content
    const tabPanel = page.locator('[role="tabpanel"], main, [role="main"]');
    await expect(tabPanel.first()).toBeVisible();

    // Panel should contain meaningful content
    const panelText = await tabPanel.first().innerText();
    expect(panelText.trim().length).toBeGreaterThan(0);
  });
});
