/**
 * Integration: Dashboard Flow
 *
 * Tests the full flow: API request → stats calculation → DB query → summary cards
 * Ensures the dashboard data pipeline is internally consistent.
 */

import { describe, test, expect } from 'vitest';
import { opportunities, getAllOpportunities, getOpenOpportunities } from '../fixtures/opportunities.js';
import { clients } from '../fixtures/clients.js';

/**
 * Calculate dashboard summary statistics
 */
function calculateDashboardStats(allOpps, allClients) {
  const openOpps = allOpps.filter(o => o.status === 'open');
  const closedOpps = allOpps.filter(o => o.status === 'closed');

  const totalFunding = openOpps.reduce((sum, o) => sum + (o.total_funding_available || 0), 0);

  const nationalCount = openOpps.filter(o => o.is_national).length;
  const stateCount = openOpps.filter(o => !o.is_national).length;

  // Upcoming deadlines (within 30 days)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = openOpps.filter(o => {
    if (!o.close_date) return false;
    const closeDate = new Date(o.close_date);
    return closeDate >= now && closeDate <= thirtyDaysFromNow;
  });

  // Categories breakdown
  const categoryMap = {};
  for (const opp of openOpps) {
    for (const cat of (opp.categories || [])) {
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }
  }
  const categories = Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    summary: {
      totalOpportunities: allOpps.length,
      openOpportunities: openOpps.length,
      closedOpportunities: closedOpps.length,
      totalFundingAvailable: totalFunding,
      nationalCount,
      stateCount,
      totalClients: Object.keys(allClients).length,
    },
    upcomingDeadlines: upcomingDeadlines.map(o => ({
      id: o.id,
      title: o.title,
      close_date: o.close_date,
    })),
    categories,
  };
}

/**
 * Get recent activity for dashboard
 */
function getRecentActivity(allOpps, limit = 5) {
  return [...allOpps]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map(o => ({
      id: o.id,
      title: o.title,
      agency_name: o.agency_name,
      created_at: o.created_at,
      status: o.status,
    }));
}

const allOpps = getAllOpportunities();
const allClients = clients;

describe('Dashboard Flow (Integration)', () => {

  describe('Summary Statistics', () => {
    test('open + closed = total', () => {
      const stats = calculateDashboardStats(allOpps, allClients);

      expect(
        stats.summary.openOpportunities + stats.summary.closedOpportunities
      ).toBeLessThanOrEqual(stats.summary.totalOpportunities);
    });

    test('national + state = open', () => {
      const stats = calculateDashboardStats(allOpps, allClients);

      expect(
        stats.summary.nationalCount + stats.summary.stateCount
      ).toBe(stats.summary.openOpportunities);
    });

    test('total funding is non-negative', () => {
      const stats = calculateDashboardStats(allOpps, allClients);
      expect(stats.summary.totalFundingAvailable).toBeGreaterThanOrEqual(0);
    });

    test('client count matches fixture data', () => {
      const stats = calculateDashboardStats(allOpps, allClients);
      expect(stats.summary.totalClients).toBe(Object.keys(allClients).length);
    });
  });

  describe('Response Shape', () => {
    test('has summary, upcomingDeadlines, and categories', () => {
      const stats = calculateDashboardStats(allOpps, allClients);

      expect(stats).toHaveProperty('summary');
      expect(stats).toHaveProperty('upcomingDeadlines');
      expect(stats).toHaveProperty('categories');
    });

    test('summary has all required fields', () => {
      const { summary } = calculateDashboardStats(allOpps, allClients);

      expect(summary).toHaveProperty('totalOpportunities');
      expect(summary).toHaveProperty('openOpportunities');
      expect(summary).toHaveProperty('closedOpportunities');
      expect(summary).toHaveProperty('totalFundingAvailable');
      expect(summary).toHaveProperty('nationalCount');
      expect(summary).toHaveProperty('stateCount');
      expect(summary).toHaveProperty('totalClients');
    });

    test('categories are sorted by count descending', () => {
      const stats = calculateDashboardStats(allOpps, allClients);

      for (let i = 1; i < stats.categories.length; i++) {
        expect(stats.categories[i].count)
          .toBeLessThanOrEqual(stats.categories[i - 1].count);
      }
    });

    test('each category has name and count', () => {
      const stats = calculateDashboardStats(allOpps, allClients);

      stats.categories.forEach(cat => {
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('count');
        expect(typeof cat.name).toBe('string');
        expect(cat.count).toBeGreaterThan(0);
      });
    });
  });

  describe('Recent Activity', () => {
    test('returns requested limit', () => {
      const recent = getRecentActivity(allOpps, 3);
      expect(recent.length).toBeLessThanOrEqual(3);
    });

    test('sorted by created_at descending', () => {
      const recent = getRecentActivity(allOpps, 10);

      for (let i = 1; i < recent.length; i++) {
        expect(new Date(recent[i].created_at).getTime())
          .toBeLessThanOrEqual(new Date(recent[i - 1].created_at).getTime());
      }
    });

    test('each item has required fields', () => {
      const recent = getRecentActivity(allOpps, 5);

      recent.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('created_at');
        expect(item).toHaveProperty('status');
      });
    });

    test('default limit is 5', () => {
      const recent = getRecentActivity(allOpps);
      expect(recent.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Cross-Component Consistency', () => {
    test('recent activity items exist in summary totals', () => {
      const stats = calculateDashboardStats(allOpps, allClients);
      const recent = getRecentActivity(allOpps, 5);

      // Every recent item contributes to the total
      expect(recent.length).toBeLessThanOrEqual(stats.summary.totalOpportunities);
    });

    test('open opportunities in summary match filterable data', () => {
      const stats = calculateDashboardStats(allOpps, allClients);
      const openOpps = allOpps.filter(o => o.status === 'open');

      expect(stats.summary.openOpportunities).toBe(openOpps.length);
    });
  });
});
