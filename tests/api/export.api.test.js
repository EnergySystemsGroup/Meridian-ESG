/**
 * Export API Contract Tests
 *
 * Validates the response structure for PDF/data export endpoints:
 * - Export request schema
 * - Export response metadata
 * - Content type headers
 */

import { describe, test, expect } from 'vitest';

const exportRequestSchema = {
  clientId: 'string',
  format: 'string', // 'pdf' | 'csv'
  includeHidden: 'boolean',
};

const exportMetadataSchema = {
  filename: 'string',
  contentType: 'string',
  generatedAt: 'string',
  matchCount: 'number',
};

function validateSchema(obj, schema) {
  const errors = [];
  for (const [field, expectedType] of Object.entries(schema)) {
    if (!(field in obj)) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof obj[field] !== expectedType) {
      errors.push(`Field ${field}: expected ${expectedType}, got ${typeof obj[field]}`);
    }
  }
  return errors;
}

describe('Export API Contracts', () => {

  describe('Export Request', () => {
    test('validates complete request', () => {
      const request = {
        clientId: 'client-001',
        format: 'pdf',
        includeHidden: false,
      };
      const errors = validateSchema(request, exportRequestSchema);
      expect(errors).toHaveLength(0);
    });

    test('format must be string', () => {
      const request = {
        clientId: 'client-001',
        format: 123,
        includeHidden: false,
      };
      const errors = validateSchema(request, exportRequestSchema);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('rejects missing clientId', () => {
      const request = { format: 'pdf', includeHidden: false };
      const errors = validateSchema(request, exportRequestSchema);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Export Response Metadata', () => {
    const validMetadata = {
      filename: 'city-of-sf-matches-2025-01-15.pdf',
      contentType: 'application/pdf',
      generatedAt: '2025-01-15T12:00:00Z',
      matchCount: 12,
    };

    test('validates complete metadata', () => {
      const errors = validateSchema(validMetadata, exportMetadataSchema);
      expect(errors).toHaveLength(0);
    });

    test('filename ends with correct extension', () => {
      expect(validMetadata.filename).toMatch(/\.(pdf|csv)$/);
    });

    test('generatedAt is valid ISO date', () => {
      const date = new Date(validMetadata.generatedAt);
      expect(isNaN(date.getTime())).toBe(false);
    });

  });

  describe('Export Content Shape', () => {
    test('CSV export rows have consistent column count', () => {
      const csvRows = [
        ['Title', 'Agency', 'Funding', 'Deadline', 'Score'],
        ['Grant A', 'DOE', '$5M', '2025-06-30', '85%'],
        ['Grant B', 'EPA', '$2M', '2025-03-15', '72%'],
      ];

      const headerCount = csvRows[0].length;
      csvRows.forEach(row => {
        expect(row.length).toBe(headerCount);
      });
    });
  });
});
