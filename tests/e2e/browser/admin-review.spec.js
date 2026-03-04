/**
 * Admin Review Browser E2E Tests
 *
 * Tests the admin review page UI: heading, filters, table.
 * Does NOT click approve/reject to avoid data mutation.
 * Requires: npm run dev (localhost:3000)
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Review Page', () => {
  test('loads with heading and filter controls', async ({ page }) => {
    await page.goto('/admin/review');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Page should load without errors
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();

    // Should show the review queue heading
    const heading = page.locator('text=/Review|Opportunity/i');
    await expect(heading.first()).toBeVisible();

    // Should have a search input
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="search"]'
    );
    await expect(searchInput.first()).toBeVisible();
  });

  test('shows table or empty state with action buttons', async ({ page }) => {
    await page.goto('/admin/review');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should show either a table with rows or an empty state message
    const tableRows = page.locator('table tbody tr, [role="row"]');
    const emptyState = page.locator('text=/No records|No opportunities|empty/i');

    const rowCount = await tableRows.count();
    const emptyCount = await emptyState.count();

    // One of these must be true — the page renders something meaningful
    expect(rowCount > 0 || emptyCount > 0).toBe(true);

    if (rowCount > 0) {
      // Rows exist: approve/reject buttons must be present (verify only, don't click)
      const approveBtn = page.locator('button:has-text("Approve")');
      const rejectBtn = page.locator('button:has-text("Reject")');

      const approveCount = await approveBtn.count();
      const rejectCount = await rejectBtn.count();
      expect(approveCount + rejectCount).toBeGreaterThan(0);
    } else {
      // Empty state: verify the empty message is actually visible
      await expect(emptyState.first()).toBeVisible();
    }
  });
});
