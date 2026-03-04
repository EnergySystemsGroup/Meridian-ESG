/**
 * Client PDF Export Tests
 *
 * Tests the data preparation for PDF export:
 * - Client header data assembly
 * - Match data formatting for PDF
 * - Funding amount formatting
 * - Section generation (matches, hidden matches, summary)
 */

import { describe, test, expect } from 'vitest';
import { clients } from '../../fixtures/clients.js';
import { opportunities } from '../../fixtures/opportunities.js';

/**
 * Prepare client header for PDF
 */
function prepareClientHeader(client) {
  return {
    name: client.name,
    type: client.type || 'N/A',
    location: [client.city, client.state_code].filter(Boolean).join(', ') || 'N/A',
    budget: client.budget ? formatCurrency(client.budget) : 'Not specified',
    projectNeeds: (client.project_needs || []).join(', ') || 'None listed',
    dacStatus: client.dac_status ? 'Yes' : 'No',
  };
}

/**
 * Format currency value for PDF display
 */
function formatCurrency(amount) {
  if (!amount && amount !== 0) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Prepare match data for PDF table
 */
function prepareMatchRow(match) {
  return {
    title: match.title || 'Untitled',
    agency: match.agency_name || 'Unknown',
    funding: match.maximum_award
      ? formatCurrency(match.maximum_award)
      : 'Not specified',
    deadline: match.close_date
      ? new Date(match.close_date).toLocaleDateString('en-US')
      : 'Rolling',
    score: match.score != null ? `${match.score}%` : 'N/A',
    isNational: match.is_national ? 'National' : 'Regional',
  };
}

/**
 * Generate PDF sections from matches
 */
function generatePdfSections(client, matches, hiddenMatches = []) {
  const sections = [];

  // Header section
  sections.push({
    type: 'header',
    data: prepareClientHeader(client),
  });

  // Summary section
  sections.push({
    type: 'summary',
    data: {
      totalMatches: matches.length,
      hiddenMatches: hiddenMatches.length,
      averageScore: matches.length > 0
        ? Math.round(matches.reduce((sum, m) => sum + (m.score || 0), 0) / matches.length)
        : 0,
    },
  });

  // Matches table
  if (matches.length > 0) {
    sections.push({
      type: 'matches',
      data: matches.map(prepareMatchRow),
    });
  }

  return sections;
}

/**
 * Calculate export filename
 */
function generateExportFilename(clientName) {
  const sanitized = clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = new Date().toISOString().split('T')[0];
  return `${sanitized}-matches-${date}.pdf`;
}

describe('Client PDF Export', () => {

  describe('Client Header Preparation', () => {
    test('formats complete client data', () => {
      const header = prepareClientHeader(clients.pgeBayAreaClient);

      expect(header.name).toBe('City of San Francisco');
      expect(header.type).toBe('Municipal Government');
      expect(header.location).toBe('San Francisco, CA');
      expect(header.budget).toBe('$5,000,000');
      expect(header.projectNeeds).toContain('Energy Efficiency');
      expect(header.dacStatus).toBe('No');
    });

    test('handles missing optional fields', () => {
      const header = prepareClientHeader({
        name: 'Test Client',
        city: null,
        state_code: null,
      });

      expect(header.type).toBe('N/A');
      expect(header.location).toBe('N/A');
      expect(header.budget).toBe('Not specified');
      expect(header.projectNeeds).toBe('None listed');
    });

    test('location with only city', () => {
      const header = prepareClientHeader({ name: 'Test', city: 'Portland' });
      expect(header.location).toBe('Portland');
    });

    test('location with only state', () => {
      const header = prepareClientHeader({ name: 'Test', state_code: 'OR' });
      expect(header.location).toBe('OR');
    });
  });

  describe('Currency Formatting', () => {
    test('formats standard amounts', () => {
      expect(formatCurrency(5000000)).toBe('$5,000,000');
      expect(formatCurrency(500000)).toBe('$500,000');
      expect(formatCurrency(1000)).toBe('$1,000');
    });

    test('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0');
    });

    test('handles null/undefined', () => {
      expect(formatCurrency(null)).toBe('N/A');
      expect(formatCurrency(undefined)).toBe('N/A');
    });
  });

  describe('Match Row Preparation', () => {
    test('formats complete match', () => {
      const row = prepareMatchRow({
        title: 'Federal Clean Energy Grant',
        agency_name: 'DOE',
        maximum_award: 5000000,
        close_date: '2025-06-30T23:59:59Z',
        score: 85,
        is_national: true,
      });

      expect(row.title).toBe('Federal Clean Energy Grant');
      expect(row.agency).toBe('DOE');
      expect(row.funding).toBe('$5,000,000');
      expect(row.deadline).toContain('2025');
      expect(row.score).toBe('85%');
      expect(row.isNational).toBe('National');
    });

    test('handles missing fields', () => {
      const row = prepareMatchRow({});

      expect(row.title).toBe('Untitled');
      expect(row.agency).toBe('Unknown');
      expect(row.funding).toBe('Not specified');
      expect(row.deadline).toBe('Rolling');
      expect(row.score).toBe('N/A');
      expect(row.isNational).toBe('Regional');
    });

    test('regional opportunities labeled correctly', () => {
      const row = prepareMatchRow({ is_national: false });
      expect(row.isNational).toBe('Regional');
    });
  });

  describe('PDF Section Generation', () => {
    const client = clients.pgeBayAreaClient;
    const matches = [
      { ...opportunities.nationalGrant, score: 90 },
      { ...opportunities.californiaStateGrant, score: 75 },
    ];

    test('generates all required sections', () => {
      const sections = generatePdfSections(client, matches);

      expect(sections).toHaveLength(3); // header + summary + matches
      expect(sections[0].type).toBe('header');
      expect(sections[1].type).toBe('summary');
      expect(sections[2].type).toBe('matches');
    });

    test('summary has correct counts', () => {
      const sections = generatePdfSections(client, matches, [{ id: 'hidden' }]);

      expect(sections[1].data.totalMatches).toBe(2);
      expect(sections[1].data.hiddenMatches).toBe(1);
    });

    test('summary calculates average score', () => {
      const sections = generatePdfSections(client, matches);

      expect(sections[1].data.averageScore).toBe(83); // (90 + 75) / 2 rounded
    });

    test('skips matches section when no matches', () => {
      const sections = generatePdfSections(client, []);

      expect(sections).toHaveLength(2); // header + summary only
      expect(sections.every(s => s.type !== 'matches')).toBe(true);
    });

    test('summary with no matches has 0 average score', () => {
      const sections = generatePdfSections(client, []);
      expect(sections[1].data.averageScore).toBe(0);
    });
  });

  describe('Export Filename', () => {
    test('generates sanitized filename', () => {
      const filename = generateExportFilename('City of San Francisco');
      expect(filename).toMatch(/^city-of-san-francisco-matches-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    test('handles special characters', () => {
      const filename = generateExportFilename('PG&E (Bay Area)');
      expect(filename).toMatch(/^pg-e-bay-area-matches-/);
    });

    test('handles leading/trailing hyphens', () => {
      const filename = generateExportFilename('---Test---');
      expect(filename).toMatch(/^test-matches-/);
    });
  });
});
