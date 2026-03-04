/**
 * Opportunity Detail Browser E2E Tests
 *
 * Tests the funding opportunity detail page: tabs, content, navigation.
 * Requires: npm run dev (localhost:3000)
 */

import { test, expect } from '@playwright/test';

test.describe('Opportunity Detail Page', () => {
  test('loads detail page with title and status badge', async ({ page }) => {
    // Fetch a real opportunity ID via the browser
    const res = await page.request.get('/api/funding?page_size=1');
    const body = await res.json();

    if (!body.data || body.data.length === 0) {
      test.skip(true, 'No opportunities in dev DB');
      return;
    }

    const opportunityId = body.data[0].id;

    await page.goto(`/funding/opportunities/${opportunityId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Page should load without errors
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();

    // Should show the opportunity title (h3 CardTitle)
    const heading = page.locator('h3').first();
    await expect(heading).toBeVisible();

    // Should show a status badge (Open, Upcoming, or Closed)
    const statusBadge = page.locator('text=/Open|Upcoming|Closed/');
    await expect(statusBadge.first()).toBeVisible();
  });

  test('has navigable tabs', async ({ page }) => {
    // Fetch a real opportunity ID via the browser
    const res = await page.request.get('/api/funding?page_size=1');
    const body = await res.json();

    if (!body.data || body.data.length === 0) {
      test.skip(true, 'No opportunities in dev DB');
      return;
    }

    const opportunityId = body.data[0].id;

    await page.goto(`/funding/opportunities/${opportunityId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should have tab buttons (overview, eligibility, relevance, admin)
    const tabs = page.locator('button:has-text("overview"), button:has-text("eligibility"), button:has-text("relevance"), button:has-text("admin")');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(3);

    // Click through tabs — each should render meaningful content
    for (let i = 0; i < Math.min(tabCount, 4); i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(500);

      // Tab panel should contain visible content (heading, text, or list items)
      const tabPanel = page.locator('[role="tabpanel"], main, [role="main"]');
      await expect(tabPanel.first()).toBeVisible();

      // The panel should have at least some text content (not just an empty container)
      const panelText = await tabPanel.first().innerText();
      expect(panelText.trim().length).toBeGreaterThan(0);
    }
  });
});
