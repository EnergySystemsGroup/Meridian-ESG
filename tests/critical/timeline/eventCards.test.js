/**
 * Timeline Event Cards Tests
 *
 * Tests the event card data extraction and display logic:
 * - Card data extraction
 * - Relevance score badge
 * - Event type badges
 * - Days-left calculation for cards
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Extract card data from opportunity
 */
function extractCardData(opportunity) {
  return {
    id: opportunity.id,
    title: opportunity.title || 'Untitled',
    source: opportunity.agency_name || 'Unknown Source',
    deadline: opportunity.close_date || null,
    relevanceScore: opportunity.relevance_score ?? null,
    eventType: determineEventType(opportunity),
    fundingAmount: formatFundingDisplay(opportunity),
    categories: opportunity.categories || [],
  };
}

/**
 * Determine event type based on opportunity data
 */
function determineEventType(opportunity) {
  if (opportunity.is_national) return 'National';
  if (opportunity.coverage_area_ids?.length > 0) {
    return 'Regional';
  }
  return 'Local';
}

/**
 * Format funding amount for card display
 */
function formatFundingDisplay(opportunity) {
  const max = opportunity.maximum_award;
  const total = opportunity.total_funding_available;

  if (max) {
    return formatCompactCurrency(max);
  }
  if (total) {
    return formatCompactCurrency(total) + ' total';
  }
  return 'Amount varies';
}

/**
 * Format currency in compact form
 */
function formatCompactCurrency(value) {
  if (!value) return 'N/A';
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
}

/**
 * Get relevance badge variant
 */
function getRelevanceBadgeVariant(score) {
  if (score === null || score === undefined) return 'default';
  if (score >= 8) return 'success';
  if (score >= 6) return 'warning';
  if (score >= 4) return 'info';
  return 'default';
}

/**
 * Calculate days left for card
 */
function getCardDaysLeft(closeDate, now = new Date()) {
  if (!closeDate) return null;

  const deadline = new Date(closeDate);
  const diffMs = deadline.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get days-left color for card
 */
function getCardDaysLeftColor(daysLeft) {
  if (daysLeft === null) return 'gray';
  if (daysLeft < 0) return 'gray';
  if (daysLeft <= 3) return 'red';
  if (daysLeft <= 7) return 'orange';
  if (daysLeft <= 14) return 'yellow';
  return 'green';
}

describe('Timeline Event Cards', () => {

  describe('Card Data Extraction', () => {
    test('extracts complete card data', () => {
      const opp = {
        id: 'opp-1',
        title: 'Clean Energy Grant',
        agency_name: 'DOE',
        close_date: '2025-06-30T23:59:59Z',
        relevance_score: 8.5,
        is_national: true,
        maximum_award: 5000000,
        categories: ['Energy', 'Infrastructure'],
      };

      const card = extractCardData(opp);

      expect(card.id).toBe('opp-1');
      expect(card.title).toBe('Clean Energy Grant');
      expect(card.source).toBe('DOE');
      expect(card.deadline).toBe('2025-06-30T23:59:59Z');
      expect(card.relevanceScore).toBe(8.5);
      expect(card.eventType).toBe('National');
      expect(card.fundingAmount).toBe('$5.0M');
      expect(card.categories).toEqual(['Energy', 'Infrastructure']);
    });

    test('handles missing fields with defaults', () => {
      const opp = { id: 'opp-2' };
      const card = extractCardData(opp);

      expect(card.title).toBe('Untitled');
      expect(card.source).toBe('Unknown Source');
      expect(card.deadline).toBeNull();
      expect(card.relevanceScore).toBeNull();
      expect(card.fundingAmount).toBe('Amount varies');
      expect(card.categories).toEqual([]);
    });
  });

  describe('Event Type Detection', () => {
    test('detects national opportunity', () => {
      const opp = { is_national: true };
      expect(determineEventType(opp)).toBe('National');
    });

    test('detects regional opportunity', () => {
      const opp = { is_national: false, coverage_area_ids: [1, 2, 3] };
      expect(determineEventType(opp)).toBe('Regional');
    });

    test('detects local opportunity (no coverage areas)', () => {
      const opp = { is_national: false, coverage_area_ids: [] };
      expect(determineEventType(opp)).toBe('Local');
    });

    test('handles missing coverage_area_ids', () => {
      const opp = { is_national: false };
      expect(determineEventType(opp)).toBe('Local');
    });

    test('national takes precedence over coverage_area_ids', () => {
      const opp = { is_national: true, coverage_area_ids: [1, 2] };
      expect(determineEventType(opp)).toBe('National');
    });
  });

  describe('Funding Display', () => {
    test('formats maximum award in millions', () => {
      const opp = { maximum_award: 5000000 };
      expect(formatFundingDisplay(opp)).toBe('$5.0M');
    });

    test('formats maximum award in billions', () => {
      const opp = { maximum_award: 1500000000 };
      expect(formatFundingDisplay(opp)).toBe('$1.5B');
    });

    test('formats maximum award in thousands', () => {
      const opp = { maximum_award: 250000 };
      expect(formatFundingDisplay(opp)).toBe('$250K');
    });

    test('falls back to total_funding_available', () => {
      const opp = { total_funding_available: 100000000 };
      expect(formatFundingDisplay(opp)).toBe('$100.0M total');
    });

    test('shows amount varies when no funding data', () => {
      const opp = {};
      expect(formatFundingDisplay(opp)).toBe('Amount varies');
    });

    test('maximum_award takes precedence', () => {
      const opp = { maximum_award: 1000000, total_funding_available: 500000000 };
      expect(formatFundingDisplay(opp)).toBe('$1.0M');
    });
  });

  describe('Compact Currency Formatting', () => {
    test('formats billions', () => {
      expect(formatCompactCurrency(1000000000)).toBe('$1.0B');
      expect(formatCompactCurrency(2500000000)).toBe('$2.5B');
    });

    test('formats millions', () => {
      expect(formatCompactCurrency(1000000)).toBe('$1.0M');
      expect(formatCompactCurrency(15500000)).toBe('$15.5M');
    });

    test('formats thousands', () => {
      expect(formatCompactCurrency(1000)).toBe('$1K');
      expect(formatCompactCurrency(250000)).toBe('$250K');
    });

    test('formats small amounts', () => {
      expect(formatCompactCurrency(500)).toBe('$500');
      expect(formatCompactCurrency(50)).toBe('$50');
    });

    test('handles null', () => {
      expect(formatCompactCurrency(null)).toBe('N/A');
    });
  });

  describe('Relevance Badge', () => {
    test('high relevance (8+) is success', () => {
      expect(getRelevanceBadgeVariant(8)).toBe('success');
      expect(getRelevanceBadgeVariant(9.5)).toBe('success');
      expect(getRelevanceBadgeVariant(10)).toBe('success');
    });

    test('medium relevance (6-7.9) is warning', () => {
      expect(getRelevanceBadgeVariant(6)).toBe('warning');
      expect(getRelevanceBadgeVariant(7)).toBe('warning');
      expect(getRelevanceBadgeVariant(7.9)).toBe('warning');
    });

    test('low-medium relevance (4-5.9) is info', () => {
      expect(getRelevanceBadgeVariant(4)).toBe('info');
      expect(getRelevanceBadgeVariant(5)).toBe('info');
      expect(getRelevanceBadgeVariant(5.9)).toBe('info');
    });

    test('low relevance (below 4) is default', () => {
      expect(getRelevanceBadgeVariant(3)).toBe('default');
      expect(getRelevanceBadgeVariant(1)).toBe('default');
      expect(getRelevanceBadgeVariant(0)).toBe('default');
    });

    test('null/undefined is default', () => {
      expect(getRelevanceBadgeVariant(null)).toBe('default');
      expect(getRelevanceBadgeVariant(undefined)).toBe('default');
    });
  });

  describe('Card Days Left', () => {
    const baseDate = new Date('2025-01-15T12:00:00Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(baseDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('calculates days left', () => {
      expect(getCardDaysLeft('2025-01-20T12:00:00Z', baseDate)).toBe(5);
      expect(getCardDaysLeft('2025-01-16T12:00:00Z', baseDate)).toBe(1);
    });

    test('returns null for null deadline', () => {
      expect(getCardDaysLeft(null, baseDate)).toBeNull();
    });

    test('returns negative for past deadlines', () => {
      expect(getCardDaysLeft('2025-01-10T12:00:00Z', baseDate)).toBe(-5);
    });
  });

  describe('Card Days Left Color', () => {
    test('critical (0-3) is red', () => {
      expect(getCardDaysLeftColor(0)).toBe('red');
      expect(getCardDaysLeftColor(3)).toBe('red');
    });

    test('urgent (4-7) is orange', () => {
      expect(getCardDaysLeftColor(4)).toBe('orange');
      expect(getCardDaysLeftColor(7)).toBe('orange');
    });

    test('attention (8-14) is yellow', () => {
      expect(getCardDaysLeftColor(8)).toBe('yellow');
      expect(getCardDaysLeftColor(14)).toBe('yellow');
    });

    test('normal (15+) is green', () => {
      expect(getCardDaysLeftColor(15)).toBe('green');
      expect(getCardDaysLeftColor(100)).toBe('green');
    });

    test('past or null is gray', () => {
      expect(getCardDaysLeftColor(-1)).toBe('gray');
      expect(getCardDaysLeftColor(null)).toBe('gray');
    });
  });

  describe('Complete Card Scenarios', () => {
    const baseDate = new Date('2025-01-15T12:00:00Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(baseDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('urgent national opportunity', () => {
      const opp = {
        id: 'opp-urgent',
        title: 'Urgent Federal Grant',
        agency_name: 'DOE',
        close_date: '2025-01-18T23:59:59Z',
        relevance_score: 9.0,
        is_national: true,
        maximum_award: 10000000,
      };

      const card = extractCardData(opp);
      const daysLeft = getCardDaysLeft(opp.close_date, baseDate);
      const daysColor = getCardDaysLeftColor(daysLeft);
      const relevanceBadge = getRelevanceBadgeVariant(card.relevanceScore);

      expect(card.eventType).toBe('National');
      expect(daysLeft).toBe(4);
      expect(daysColor).toBe('orange');
      expect(relevanceBadge).toBe('success');
    });

    test('low priority regional opportunity', () => {
      const opp = {
        id: 'opp-low',
        title: 'Regional Program',
        agency_name: 'State Agency',
        close_date: '2025-03-15T23:59:59Z',
        relevance_score: 3.5,
        is_national: false,
        coverage_area_ids: [1, 2],
        maximum_award: 50000,
      };

      const card = extractCardData(opp);
      const daysLeft = getCardDaysLeft(opp.close_date, baseDate);
      const daysColor = getCardDaysLeftColor(daysLeft);
      const relevanceBadge = getRelevanceBadgeVariant(card.relevanceScore);

      expect(card.eventType).toBe('Regional');
      expect(daysLeft).toBeGreaterThan(30);
      expect(daysColor).toBe('green');
      expect(relevanceBadge).toBe('default');
    });
  });
});
