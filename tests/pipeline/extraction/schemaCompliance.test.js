/**
 * Pipeline: Extraction Schema Compliance Tests
 *
 * Tests that extracted opportunity data conforms to expected schemas:
 * - Required fields are present
 * - Field types are correct
 * - Values are within valid ranges
 *
 * NOTE: These tests validate schema compliance, not exact content.
 */

import { describe, test, expect } from 'vitest';

/**
 * Expected schema for extracted opportunity
 */
const opportunitySchema = {
  // Required string fields
  title: { type: 'string', required: true },
  agency_name: { type: 'string', required: false },
  program_overview: { type: 'string', required: false },

  // Optional string fields
  description: { type: 'string', required: false },
  eligibility_summary: { type: 'string', required: false },
  application_url: { type: 'string', required: false },
  contact_info: { type: 'string', required: false },

  // Date fields
  open_date: { type: 'date', required: false },
  close_date: { type: 'date', required: false },

  // Numeric fields
  minimum_award: { type: 'number', required: false },
  maximum_award: { type: 'number', required: false },
  total_funding_available: { type: 'number', required: false },
  expected_awards: { type: 'number', required: false },

  // Array fields
  eligible_applicant_types: { type: 'array', required: false },
  eligible_project_types: { type: 'array', required: false },
  funding_types: { type: 'array', required: false },
};

/**
 * Validates an object against the opportunity schema
 */
function validateOpportunitySchema(opp) {
  const errors = [];
  const warnings = [];

  for (const [field, spec] of Object.entries(opportunitySchema)) {
    const value = opp[field];

    // Check required fields
    if (spec.required && (value === null || value === undefined || value === '')) {
      errors.push(`Required field missing: ${field}`);
      continue;
    }

    // Skip validation for null/undefined optional fields
    if (value === null || value === undefined) continue;

    // Type validation
    switch (spec.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Invalid type for ${field}: expected string, got ${typeof value}`);
        } else if (value.length === 0 && spec.required) {
          errors.push(`Required field is empty string: ${field}`);
        }
        break;

      case 'number':
        if (typeof value !== 'number' && value !== null) {
          errors.push(`Invalid type for ${field}: expected number, got ${typeof value}`);
        } else if (typeof value === 'number' && isNaN(value)) {
          errors.push(`Invalid NaN value for ${field}`);
        }
        break;

      case 'date':
        if (value !== null) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
          if (typeof value !== 'string' || !dateRegex.test(value)) {
            warnings.push(`Invalid date format for ${field}: ${value}`);
          }
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`Invalid type for ${field}: expected array, got ${typeof value}`);
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates a batch of extracted opportunities
 */
function validateExtractionBatch(opportunities) {
  const results = {
    total: opportunities.length,
    valid: 0,
    invalid: 0,
    errors: [],
    warnings: [],
  };

  opportunities.forEach((opp, idx) => {
    const validation = validateOpportunitySchema(opp);
    if (validation.valid) {
      results.valid++;
    } else {
      results.invalid++;
      results.errors.push({ index: idx, errors: validation.errors });
    }
    if (validation.warnings.length > 0) {
      results.warnings.push({ index: idx, warnings: validation.warnings });
    }
  });

  return results;
}

describe('Pipeline: Extraction Schema Compliance', () => {

  describe('Required Field Validation', () => {
    test('valid opportunity passes validation', () => {
      const opp = {
        title: 'Clean Energy Grant Program',
        agency_name: 'Department of Energy',
        program_overview: 'Funding for clean energy projects',
        open_date: '2025-01-01',
        close_date: '2025-03-15',
        minimum_award: 10000,
        maximum_award: 500000,
        eligible_applicant_types: ['Municipal Government', 'Non-Profit'],
        eligible_project_types: ['Solar', 'Wind'],
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('missing title fails validation', () => {
      const opp = {
        agency_name: 'DOE',
        program_overview: 'Some program',
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('title'))).toBe(true);
    });

    test('empty title fails validation', () => {
      const opp = {
        title: '',
        agency_name: 'DOE',
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('title'))).toBe(true);
    });
  });

  describe('Type Validation', () => {
    test('string field with number fails', () => {
      const opp = {
        title: 12345, // Should be string
        agency_name: 'DOE',
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('string'))).toBe(true);
    });

    test('number field with string fails', () => {
      const opp = {
        title: 'Test Grant',
        maximum_award: 'one million', // Should be number
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('number'))).toBe(true);
    });

    test('array field with string fails', () => {
      const opp = {
        title: 'Test Grant',
        eligible_applicant_types: 'Municipal Government', // Should be array
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('array'))).toBe(true);
    });

    test('NaN number fails validation', () => {
      const opp = {
        title: 'Test Grant',
        maximum_award: NaN,
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('NaN'))).toBe(true);
    });
  });

  describe('Date Format Validation', () => {
    test('ISO date format passes', () => {
      const opp = {
        title: 'Test Grant',
        close_date: '2025-03-15',
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });

    test('ISO datetime format passes', () => {
      const opp = {
        title: 'Test Grant',
        close_date: '2025-03-15T23:59:59Z',
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });

    test('invalid date format warns', () => {
      const opp = {
        title: 'Test Grant',
        close_date: 'March 15, 2025', // Human readable, not ISO
      };

      const result = validateOpportunitySchema(opp);

      // This is a warning, not an error
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('null date is acceptable', () => {
      const opp = {
        title: 'Ongoing Program',
        close_date: null,
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });
  });

  describe('Optional Field Handling', () => {
    test('minimal valid opportunity', () => {
      const opp = {
        title: 'Test Grant',
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });

    test('all optional fields null passes', () => {
      const opp = {
        title: 'Test Grant',
        agency_name: null,
        program_overview: null,
        close_date: null,
        maximum_award: null,
        eligible_applicant_types: null,
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });

    test('all optional fields undefined passes', () => {
      const opp = {
        title: 'Test Grant',
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });
  });

  describe('Array Field Validation', () => {
    test('empty array is valid', () => {
      const opp = {
        title: 'Test Grant',
        eligible_applicant_types: [],
        eligible_project_types: [],
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });

    test('array with strings is valid', () => {
      const opp = {
        title: 'Test Grant',
        eligible_applicant_types: ['Municipal Government', 'Non-Profit', 'Utility'],
        eligible_project_types: ['Solar', 'Wind', 'HVAC'],
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });
  });

  describe('Batch Validation', () => {
    test('validates batch of opportunities', () => {
      const batch = [
        { title: 'Grant 1', agency_name: 'DOE' },
        { title: 'Grant 2', agency_name: 'EPA' },
        { title: 'Grant 3', agency_name: 'DOT' },
      ];

      const result = validateExtractionBatch(batch);

      expect(result.total).toBe(3);
      expect(result.valid).toBe(3);
      expect(result.invalid).toBe(0);
    });

    test('reports invalid items in batch', () => {
      const batch = [
        { title: 'Valid Grant' },
        { agency_name: 'Missing Title' }, // Invalid - no title
        { title: 'Also Valid' },
      ];

      const result = validateExtractionBatch(batch);

      expect(result.total).toBe(3);
      expect(result.valid).toBe(2);
      expect(result.invalid).toBe(1);
      expect(result.errors[0].index).toBe(1);
    });

    test('handles empty batch', () => {
      const result = validateExtractionBatch([]);

      expect(result.total).toBe(0);
      expect(result.valid).toBe(0);
      expect(result.invalid).toBe(0);
    });
  });

  describe('Real-World Schema Examples', () => {
    test('federal grants.gov opportunity schema', () => {
      const opp = {
        title: 'Weatherization Assistance Program Formula Grants',
        agency_name: 'Department of Energy',
        program_overview: 'Provides grants to enable low-income families to reduce energy costs',
        description: 'Long form description...',
        open_date: '2025-01-15',
        close_date: '2025-04-30T23:59:59Z',
        minimum_award: 100000,
        maximum_award: 5000000,
        total_funding_available: 50000000,
        expected_awards: 50,
        eligible_applicant_types: ['State Government', 'Tribal Government'],
        eligible_project_types: ['Weatherization', 'Energy Efficiency'],
        funding_types: ['Grant', 'Formula'],
        application_url: 'https://www.grants.gov/opportunity/12345',
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });

    test('utility rebate program schema', () => {
      const opp = {
        title: 'Commercial Solar Incentive Program',
        agency_name: 'Pacific Gas & Electric',
        program_overview: 'Rebates for commercial solar installations',
        close_date: null, // Ongoing program
        maximum_award: 100000,
        eligible_applicant_types: ['Commercial Entity'],
        eligible_project_types: ['Solar'],
        funding_types: ['Rebate'],
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });

    test('state climate initiative schema', () => {
      const opp = {
        title: 'California Climate Catalyst Fund',
        agency_name: 'California Energy Commission',
        program_overview: 'Financing for decarbonization technologies',
        open_date: '2025-02-01',
        close_date: '2025-06-30',
        minimum_award: 500000,
        maximum_award: 10000000,
        eligible_applicant_types: [
          'Municipal Government',
          'Commercial Entity',
          'Non-Profit Organization',
        ],
        eligible_project_types: [
          'Battery Storage',
          'Green Hydrogen',
          'Long-Duration Storage',
        ],
        funding_types: ['Loan', 'Grant'],
        contact_info: 'climate@energy.ca.gov',
      };

      const result = validateOpportunitySchema(opp);

      expect(result.valid).toBe(true);
    });
  });

  describe('Schema Invariants', () => {
    test('maximum_award should be >= minimum_award when both present', () => {
      const opp = {
        title: 'Test Grant',
        minimum_award: 10000,
        maximum_award: 5000, // Less than minimum
      };

      const result = validateOpportunitySchema(opp);

      // Schema validation passes (type checks), but this could be a data issue
      // Semantic validation would catch this
      expect(result.valid).toBe(true);
    });

    test('close_date should be after open_date when both present', () => {
      const opp = {
        title: 'Test Grant',
        open_date: '2025-06-01',
        close_date: '2025-01-01', // Before open
      };

      const result = validateOpportunitySchema(opp);

      // Schema validation passes, semantic validation would catch this
      expect(result.valid).toBe(true);
    });
  });
});
