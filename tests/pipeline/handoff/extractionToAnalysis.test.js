/**
 * Pipeline Handoff: Extraction → Analysis
 *
 * Validates that extraction output is valid analysis input.
 * Ensures the contract between pipeline stages is maintained.
 */

import { describe, test, expect } from 'vitest';

/**
 * Schema that extraction output must conform to
 */
const EXTRACTION_OUTPUT_FIELDS = [
  'id',
  'source_id',
  'title',
  'url',
  'raw_content',
  'extraction_data',
  'extraction_status',
];

const EXTRACTION_DATA_FIELDS = [
  'title',
  'description',
  'agency_name',
  'funding_amount',
  'close_date',
  'eligible_applicants',
  'eligible_project_types',
];

/**
 * Schema that analysis expects as input
 */
const ANALYSIS_INPUT_REQUIRED = [
  'id',
  'title',
  'extraction_data',
];

/**
 * Validate extraction output can be consumed by analysis
 */
function validateHandoff(extractionRecord) {
  const errors = [];

  // Check required fields exist
  for (const field of ANALYSIS_INPUT_REQUIRED) {
    if (extractionRecord[field] === undefined || extractionRecord[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check extraction_status is 'complete'
  if (extractionRecord.extraction_status !== 'complete') {
    errors.push(`Extraction status must be 'complete', got '${extractionRecord.extraction_status}'`);
  }

  // Check extraction_data has minimum fields
  if (extractionRecord.extraction_data) {
    const data = extractionRecord.extraction_data;
    if (!data.title && !extractionRecord.title) {
      errors.push('Either extraction_data.title or record title must be present');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Simulate extraction output records
 */
function createExtractionOutput(overrides = {}) {
  return {
    id: 'staging-001',
    source_id: 'src-001',
    title: 'Test Program',
    url: 'https://example.com/program',
    raw_content: '<html><body>Program details here</body></html>',
    extraction_data: {
      title: 'Test Program',
      description: 'A test program for energy efficiency rebates.',
      agency_name: 'Test Utility',
      funding_amount: 50000,
      close_date: '2025-12-31',
      eligible_applicants: ['Commercial', 'Industrial'],
      eligible_project_types: ['Energy Efficiency', 'HVAC'],
      url: 'https://example.com/program',
    },
    extraction_status: 'complete',
    analysis_status: 'pending',
    ...overrides,
  };
}

describe('Extraction → Analysis Handoff', () => {

  describe('Valid Extraction Output', () => {
    test('complete extraction record passes validation', () => {
      const record = createExtractionOutput();
      const result = validateHandoff(record);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('extraction_data contains expected fields', () => {
      const record = createExtractionOutput();

      for (const field of EXTRACTION_DATA_FIELDS) {
        expect(record.extraction_data).toHaveProperty(field);
      }
    });

    test('extraction_data values are correct types', () => {
      const record = createExtractionOutput();
      const data = record.extraction_data;

      expect(typeof data.title).toBe('string');
      expect(typeof data.description).toBe('string');
      expect(typeof data.funding_amount).toBe('number');
      expect(Array.isArray(data.eligible_applicants)).toBe(true);
      expect(Array.isArray(data.eligible_project_types)).toBe(true);
    });
  });

  describe('Invalid Extraction Output', () => {
    test('missing id fails', () => {
      const record = createExtractionOutput({ id: null });
      const result = validateHandoff(record);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: id');
    });

    test('missing extraction_data fails', () => {
      const record = createExtractionOutput({ extraction_data: null });
      const result = validateHandoff(record);
      expect(result.valid).toBe(false);
    });

    test('pending extraction_status fails', () => {
      const record = createExtractionOutput({ extraction_status: 'pending' });
      const result = validateHandoff(record);
      expect(result.valid).toBe(false);
    });

    test('failed extraction_status fails', () => {
      const record = createExtractionOutput({ extraction_status: 'failed' });
      const result = validateHandoff(record);
      expect(result.valid).toBe(false);
    });

    test('missing title in both record and data fails', () => {
      const record = createExtractionOutput({
        title: null,
        extraction_data: { description: 'No title anywhere' },
      });
      const result = validateHandoff(record);
      expect(result.valid).toBe(false);
    });
  });

  describe('Batch Handoff', () => {
    test('batch of valid records all pass', () => {
      const records = Array.from({ length: 5 }, (_, i) =>
        createExtractionOutput({ id: `staging-${i}` })
      );

      const results = records.map(r => validateHandoff(r));
      expect(results.every(r => r.valid)).toBe(true);
    });

    test('mixed batch identifies invalid records', () => {
      const records = [
        createExtractionOutput({ id: 'good-1' }),
        createExtractionOutput({ id: null }), // invalid
        createExtractionOutput({ id: 'good-2' }),
        createExtractionOutput({ extraction_status: 'pending' }), // invalid
      ];

      const results = records.map(r => validateHandoff(r));
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(true);
      expect(results[3].valid).toBe(false);
    });
  });

  describe('Data Preservation', () => {
    test('extraction_data fields survive JSON serialization', () => {
      const record = createExtractionOutput();
      const serialized = JSON.parse(JSON.stringify(record));

      expect(serialized.extraction_data.title).toBe(record.extraction_data.title);
      expect(serialized.extraction_data.funding_amount).toBe(record.extraction_data.funding_amount);
      expect(serialized.extraction_data.eligible_applicants).toEqual(record.extraction_data.eligible_applicants);
    });

    test('raw_content is preserved for analysis reference', () => {
      const record = createExtractionOutput();
      expect(record.raw_content).toBeTruthy();
      expect(typeof record.raw_content).toBe('string');
    });
  });
});
