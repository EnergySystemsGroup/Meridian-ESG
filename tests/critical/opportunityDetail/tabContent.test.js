/**
 * Opportunity Detail - Tab Content Tests
 *
 * Tests the tabbed content structure for opportunity detail page:
 * - Overview tab content extraction
 * - Eligibility tab content extraction
 * - Details tab content extraction
 * - Contact tab content extraction
 * - Handling missing/null fields
 */

import { describe, test, expect } from 'vitest';

/**
 * Extract Overview tab content
 */
function extractOverviewContent(opportunity) {
  return {
    title: opportunity.title || 'Untitled Opportunity',
    agencyName: opportunity.agency_name || 'Unknown Agency',
    programOverview: opportunity.program_overview || null,
    programInsights: opportunity.program_insights || null,
    fundingRange: formatFundingRange(
      opportunity.minimum_award,
      opportunity.maximum_award
    ),
    totalFunding: opportunity.total_funding_available
      ? formatCurrency(opportunity.total_funding_available)
      : null,
    status: opportunity.status || 'unknown',
    closeDate: opportunity.close_date || null,
    categories: opportunity.categories || [],
  };
}

/**
 * Extract Eligibility tab content
 */
function extractEligibilityContent(opportunity) {
  return {
    eligibleApplicants: opportunity.eligible_applicants || [],
    eligibleProjectTypes: opportunity.eligible_project_types || [],
    eligibleActivities: opportunity.eligible_activities || [],
    geographicScope: getGeographicScope(opportunity),
    additionalRequirements: opportunity.additional_requirements || null,
  };
}

/**
 * Extract Details tab content
 */
function extractDetailsContent(opportunity) {
  return {
    applicationProcess: opportunity.application_process || null,
    matchingRequirements: opportunity.matching_requirements || null,
    performancePeriod: opportunity.performance_period || null,
    reportingRequirements: opportunity.reporting_requirements || null,
    sourceUrl: opportunity.source_url || null,
    lastUpdated: opportunity.updated_at || opportunity.created_at || null,
  };
}

/**
 * Extract Contact tab content
 */
function extractContactContent(opportunity) {
  return {
    contactName: opportunity.contact_name || null,
    contactEmail: opportunity.contact_email || null,
    contactPhone: opportunity.contact_phone || null,
    agencyName: opportunity.agency_name || null,
    agencyWebsite: opportunity.agency_website || null,
  };
}

/**
 * Format funding range for display
 */
function formatFundingRange(min, max) {
  if (!min && !max) return null;
  if (min && max) return `${formatCurrency(min)} - ${formatCurrency(max)}`;
  if (max) return `Up to ${formatCurrency(max)}`;
  if (min) return `Minimum ${formatCurrency(min)}`;
  return null;
}

/**
 * Format currency value
 */
function formatCurrency(value) {
  if (!value) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Get geographic scope description
 */
function getGeographicScope(opportunity) {
  if (opportunity.is_national) return 'National (all states)';
  const areaCount = opportunity.coverage_area_ids?.length || 0;
  if (areaCount === 0) return 'Geographic scope not specified';
  if (areaCount === 1) return '1 coverage area';
  return `${areaCount} coverage areas`;
}

describe('Opportunity Detail Tab Content', () => {

  describe('Overview Tab', () => {
    test('extracts complete overview', () => {
      const opp = {
        title: 'Clean Energy Grant',
        agency_name: 'DOE',
        program_overview: 'Funding for clean energy projects',
        program_insights: 'High competition',
        minimum_award: 100000,
        maximum_award: 5000000,
        total_funding_available: 500000000,
        status: 'open',
        close_date: '2025-06-30T23:59:59Z',
        categories: ['Energy', 'Infrastructure'],
      };

      const content = extractOverviewContent(opp);

      expect(content.title).toBe('Clean Energy Grant');
      expect(content.agencyName).toBe('DOE');
      expect(content.programOverview).toBe('Funding for clean energy projects');
      expect(content.programInsights).toBe('High competition');
      expect(content.fundingRange).toBe('$100,000 - $5,000,000');
      expect(content.totalFunding).toBe('$500,000,000');
      expect(content.status).toBe('open');
      expect(content.closeDate).toBe('2025-06-30T23:59:59Z');
      expect(content.categories).toEqual(['Energy', 'Infrastructure']);
    });

    test('handles missing fields with defaults', () => {
      const opp = {};

      const content = extractOverviewContent(opp);

      expect(content.title).toBe('Untitled Opportunity');
      expect(content.agencyName).toBe('Unknown Agency');
      expect(content.programOverview).toBeNull();
      expect(content.fundingRange).toBeNull();
      expect(content.status).toBe('unknown');
      expect(content.categories).toEqual([]);
    });

    test('handles max-only funding', () => {
      const opp = { maximum_award: 1000000 };
      const content = extractOverviewContent(opp);
      expect(content.fundingRange).toBe('Up to $1,000,000');
    });

    test('handles min-only funding', () => {
      const opp = { minimum_award: 50000 };
      const content = extractOverviewContent(opp);
      expect(content.fundingRange).toBe('Minimum $50,000');
    });
  });

  describe('Eligibility Tab', () => {
    test('extracts complete eligibility', () => {
      const opp = {
        eligible_applicants: ['Local Governments', 'School Districts'],
        eligible_project_types: ['Solar', 'Wind'],
        eligible_activities: ['Construction', 'Installation'],
        is_national: true,
        additional_requirements: 'Must be tax-exempt',
      };

      const content = extractEligibilityContent(opp);

      expect(content.eligibleApplicants).toEqual(['Local Governments', 'School Districts']);
      expect(content.eligibleProjectTypes).toEqual(['Solar', 'Wind']);
      expect(content.eligibleActivities).toEqual(['Construction', 'Installation']);
      expect(content.geographicScope).toBe('National (all states)');
      expect(content.additionalRequirements).toBe('Must be tax-exempt');
    });

    test('handles state-level opportunity', () => {
      const opp = {
        is_national: false,
        coverage_area_ids: [1, 2, 3],
      };

      const content = extractEligibilityContent(opp);
      expect(content.geographicScope).toBe('3 coverage areas');
    });

    test('handles single coverage area', () => {
      const opp = {
        is_national: false,
        coverage_area_ids: [1],
      };

      const content = extractEligibilityContent(opp);
      expect(content.geographicScope).toBe('1 coverage area');
    });

    test('handles empty arrays', () => {
      const opp = {};
      const content = extractEligibilityContent(opp);

      expect(content.eligibleApplicants).toEqual([]);
      expect(content.eligibleProjectTypes).toEqual([]);
      expect(content.eligibleActivities).toEqual([]);
    });
  });

  describe('Details Tab', () => {
    test('extracts complete details', () => {
      const opp = {
        application_process: 'Submit online through Grants.gov',
        matching_requirements: '25% cost share required',
        performance_period: '36 months',
        reporting_requirements: 'Quarterly financial reports',
        source_url: 'https://grants.gov/opportunity/123',
        updated_at: '2024-03-15T10:00:00Z',
      };

      const content = extractDetailsContent(opp);

      expect(content.applicationProcess).toBe('Submit online through Grants.gov');
      expect(content.matchingRequirements).toBe('25% cost share required');
      expect(content.performancePeriod).toBe('36 months');
      expect(content.reportingRequirements).toBe('Quarterly financial reports');
      expect(content.sourceUrl).toBe('https://grants.gov/opportunity/123');
      expect(content.lastUpdated).toBe('2024-03-15T10:00:00Z');
    });

    test('falls back to created_at if no updated_at', () => {
      const opp = {
        created_at: '2024-01-01T10:00:00Z',
      };

      const content = extractDetailsContent(opp);
      expect(content.lastUpdated).toBe('2024-01-01T10:00:00Z');
    });

    test('handles all null fields', () => {
      const opp = {};
      const content = extractDetailsContent(opp);

      expect(content.applicationProcess).toBeNull();
      expect(content.matchingRequirements).toBeNull();
      expect(content.performancePeriod).toBeNull();
      expect(content.sourceUrl).toBeNull();
      expect(content.lastUpdated).toBeNull();
    });
  });

  describe('Contact Tab', () => {
    test('extracts complete contact info', () => {
      const opp = {
        contact_name: 'John Doe',
        contact_email: 'john@doe.gov',
        contact_phone: '555-123-4567',
        agency_name: 'Department of Energy',
        agency_website: 'https://energy.gov',
      };

      const content = extractContactContent(opp);

      expect(content.contactName).toBe('John Doe');
      expect(content.contactEmail).toBe('john@doe.gov');
      expect(content.contactPhone).toBe('555-123-4567');
      expect(content.agencyName).toBe('Department of Energy');
      expect(content.agencyWebsite).toBe('https://energy.gov');
    });

    test('handles partial contact info', () => {
      const opp = {
        contact_email: 'grants@agency.gov',
        agency_name: 'Grants Agency',
      };

      const content = extractContactContent(opp);

      expect(content.contactName).toBeNull();
      expect(content.contactEmail).toBe('grants@agency.gov');
      expect(content.contactPhone).toBeNull();
      expect(content.agencyName).toBe('Grants Agency');
    });

    test('handles no contact info', () => {
      const opp = {};
      const content = extractContactContent(opp);

      expect(content.contactName).toBeNull();
      expect(content.contactEmail).toBeNull();
      expect(content.contactPhone).toBeNull();
      expect(content.agencyName).toBeNull();
    });
  });

  describe('Currency Formatting', () => {
    test('formats large amounts correctly', () => {
      expect(formatCurrency(500000000)).toBe('$500,000,000');
      expect(formatCurrency(1000000)).toBe('$1,000,000');
      expect(formatCurrency(50000)).toBe('$50,000');
    });

    test('formats small amounts correctly', () => {
      expect(formatCurrency(1000)).toBe('$1,000');
      expect(formatCurrency(100)).toBe('$100');
    });

    test('handles null/undefined', () => {
      expect(formatCurrency(null)).toBeNull();
      expect(formatCurrency(undefined)).toBeNull();
    });

    test('handles zero (treated as falsy)', () => {
      // In JavaScript, 0 is falsy, so formatCurrency treats it like null
      // This documents actual behavior - zero funding amounts are rare
      expect(formatCurrency(0)).toBeNull();
    });
  });

  describe('Complete Opportunity', () => {
    test('all tabs have content for complete opportunity', () => {
      const opp = {
        title: 'Complete Grant',
        agency_name: 'Test Agency',
        program_overview: 'Overview text',
        program_insights: 'Insights text',
        minimum_award: 10000,
        maximum_award: 100000,
        total_funding_available: 1000000,
        status: 'open',
        close_date: '2025-06-30',
        categories: ['Test'],
        eligible_applicants: ['All'],
        eligible_project_types: ['All'],
        eligible_activities: ['All'],
        is_national: true,
        application_process: 'Apply online',
        contact_email: 'test@test.gov',
      };

      const overview = extractOverviewContent(opp);
      const eligibility = extractEligibilityContent(opp);
      const details = extractDetailsContent(opp);
      const contact = extractContactContent(opp);

      // Overview has required content
      expect(overview.title).toBeTruthy();
      expect(overview.fundingRange).toBeTruthy();

      // Eligibility has lists
      expect(eligibility.eligibleApplicants.length).toBeGreaterThan(0);
      expect(eligibility.geographicScope).toBeTruthy();

      // Details has at least some content
      expect(details.applicationProcess).toBeTruthy();

      // Contact has at least email
      expect(contact.contactEmail).toBeTruthy();
    });
  });
});
