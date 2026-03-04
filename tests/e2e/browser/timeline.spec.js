/**
 * Timeline Browser E2E Tests
 *
 * Tests the timeline page: heading, month groups, event cards.
 * Requires: npm run dev (localhost:3000)
 */

import { test, expect } from '@playwright/test';

test.describe('Timeline Page', () => {
  test('loads with Timeline heading', async ({ page }) => {
    await page.goto('/timeline');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Page should load without errors
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();

    // Should show the Timeline heading
    const heading = page.locator('h1:has-text("Timeline")');
    await expect(heading).toBeVisible();
  });

  test('shows deadline events or empty state', async ({ page }) => {
    await page.goto('/timeline');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should show either event cards or an empty/fallback state
    const eventCards = page.locator('[class*="Card"], [class*="card"]');
    const viewDetailsLinks = page.locator('a:has-text("View Details")');
    const deadlineBadges = page.locator('text=Funding Deadline');
    const emptyState = page.locator('text=/No .*(events|deadlines|items)|upcoming/i');

    const cardCount = await eventCards.count();
    const emptyCount = await emptyState.count();

    // Either cards exist or we see an empty state message
    expect(cardCount > 0 || emptyCount > 0).toBe(true);

    if (cardCount > 0) {
      // Events exist — verify expected structure unconditionally
      expect(cardCount).toBeGreaterThan(0);

      const badgeCount = await deadlineBadges.count();
      expect(badgeCount).toBeGreaterThan(0);

      // View Details links should be present
      const linkCount = await viewDetailsLinks.count();
      expect(linkCount).toBeGreaterThan(0);
    } else {
      // Empty state: verify the empty message is actually visible
      await expect(emptyState.first()).toBeVisible();
    }
  });
});
