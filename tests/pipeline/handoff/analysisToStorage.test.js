/**
 * Pipeline Handoff: Analysis → Storage
 *
 * Validates that analysis output is valid storage input.
 * Ensures analyzed records have all fields needed for upsert.
 */

import { describe, test, expect } from 'vitest';

const ENHANCED_FIELDS = [
  'program_overview',
  'program_insights',
  'eligibility_criteria',
  'application_process',
  'key_dates',
  'contact_information',
];

const SCORE_FIELDS = [
  'funding_clarity',
  'eligibility_specificity',
  'program_maturity',
  'application_accessibility',
  'strategic_alignment',
];

const STORAGE_REQUIRED_FIELDS = [
  'id',
  'title',
  'source_id',
  'analysis_data',
  'analysis_status',
];

/**
 * Validate analysis output can be consumed by storage
 */
function validateHandoff(analysisRecord) {
  const errors = [];

  for (const field of STORAGE_REQUIRED_FIELDS) {
    if (analysisRecord[field] === undefined || analysisRecord[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (analysisRecord.analysis_status !== 'complete') {
    errors.push(`Analysis status must be 'complete', got '${analysisRecord.analysis_status}'`);
  }

  if (analysisRecord.analysis_data) {
    const data = analysisRecord.analysis_data;

    // Must have v2_score
    if (data.v2_score === undefined || data.v2_score === null) {
      errors.push('Missing v2_score in analysis_data');
    } else if (data.v2_score < 0 || data.v2_score > 10) {
      errors.push(`v2_score out of range: ${data.v2_score}`);
    }

    // Must have score details
    if (!data.v2_score_details) {
      errors.push('Missing v2_score_details');
    } else {
      for (const field of SCORE_FIELDS) {
        if (data.v2_score_details[field] === undefined) {
          errors.push(`Missing score detail: ${field}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Build a storage-ready record from analysis output
 */
function buildStorageRecord(analysisRecord) {
  const data = analysisRecord.analysis_data || {};
  const extraction = analysisRecord.extraction_data || {};

  return {
    title: extraction.title || analysisRecord.title,
    description: extraction.description || null,
    agency_name: extraction.agency_name || null,
    source_id: analysisRecord.source_id,
    url: extraction.url || analysisRecord.url,
    funding_amount: extraction.funding_amount || null,
    close_date: extraction.close_date || null,
    eligible_applicants: extraction.eligible_applicants || [],
    eligible_project_types: extraction.eligible_project_types || [],
    v2_score: data.v2_score,
    v2_score_details: data.v2_score_details,
    program_overview: data.program_overview || null,
    program_insights: data.program_insights || null,
    eligibility_criteria: data.eligibility_criteria || null,
    application_process: data.application_process || null,
    key_dates: data.key_dates || null,
    contact_information: data.contact_information || null,
    status: 'open',
  };
}

function createAnalysisOutput(overrides = {}) {
  return {
    id: 'staging-001',
    source_id: 'src-001',
    title: 'Test Program',
    url: 'https://example.com/program',
    extraction_data: {
      title: 'Test Program',
      description: 'Energy efficiency rebate program.',
      agency_name: 'Test Utility',
      funding_amount: 50000,
      close_date: '2025-12-31',
      eligible_applicants: ['Commercial'],
      eligible_project_types: ['Energy Efficiency'],
      url: 'https://example.com/program',
    },
    analysis_data: {
      v2_score: 7.2,
      v2_score_details: {
        funding_clarity: 8,
        eligibility_specificity: 7,
        program_maturity: 7,
        application_accessibility: 7,
        strategic_alignment: 7,
      },
      program_overview: 'Overview of the test program.',
      program_insights: 'Key insight about the program.',
      eligibility_criteria: 'Must be a commercial entity.',
      application_process: 'Apply online at website.',
      key_dates: 'Applications due December 31, 2025.',
      contact_information: 'contact@example.com',
      coverage_score: 5,
      enhanced_fields_count: 6,
    },
    extraction_status: 'complete',
    analysis_status: 'complete',
    storage_status: 'pending',
    ...overrides,
  };
}

describe('Analysis → Storage Handoff', () => {

  describe('Valid Analysis Output', () => {
    test('complete analysis record passes validation', () => {
      const record = createAnalysisOutput();
      const result = validateHandoff(record);
      expect(result.valid).toBe(true);
    });

    test('v2_score matches fixture value', () => {
      const record = createAnalysisOutput();
      expect(record.analysis_data.v2_score).toBe(7.2);
    });

    test('all score detail fields present', () => {
      const record = createAnalysisOutput();
      expect(record.analysis_data.v2_score_details).toHaveProperty('funding_clarity');
      expect(record.analysis_data.v2_score_details).toHaveProperty('eligibility_specificity');
      expect(record.analysis_data.v2_score_details).toHaveProperty('program_maturity');
      expect(record.analysis_data.v2_score_details).toHaveProperty('application_accessibility');
      expect(record.analysis_data.v2_score_details).toHaveProperty('strategic_alignment');
    });

    test('enhanced fields match fixture values', () => {
      const record = createAnalysisOutput();
      expect(record.analysis_data.program_overview).toBe('Overview of the test program.');
      expect(record.analysis_data.program_insights).toBe('Key insight about the program.');
      expect(record.analysis_data.eligibility_criteria).toBe('Must be a commercial entity.');
      expect(record.analysis_data.application_process).toBe('Apply online at website.');
      expect(record.analysis_data.key_dates).toBe('Applications due December 31, 2025.');
      expect(record.analysis_data.contact_information).toBe('contact@example.com');
    });
  });

  describe('Invalid Analysis Output', () => {
    test('missing analysis_data fails', () => {
      const record = createAnalysisOutput({ analysis_data: null });
      const result = validateHandoff(record);
      expect(result.valid).toBe(false);
    });

    test('pending analysis_status fails', () => {
      const record = createAnalysisOutput({ analysis_status: 'pending' });
      const result = validateHandoff(record);
      expect(result.valid).toBe(false);
    });

    test('score out of range fails', () => {
      const record = createAnalysisOutput({
        analysis_data: {
          ...createAnalysisOutput().analysis_data,
          v2_score: 15,
        },
      });
      const result = validateHandoff(record);
      expect(result.valid).toBe(false);
    });

    test('missing score details fails', () => {
      const record = createAnalysisOutput({
        analysis_data: {
          v2_score: 7.0,
          v2_score_details: null,
        },
      });
      const result = validateHandoff(record);
      expect(result.valid).toBe(false);
    });
  });

  describe('Storage Record Building', () => {
    test('builds complete storage record', () => {
      const record = createAnalysisOutput();
      const storageRecord = buildStorageRecord(record);

      expect(storageRecord.title).toBe('Test Program');
      expect(storageRecord.v2_score).toBe(7.2);
      expect(storageRecord.source_id).toBe('src-001');
      expect(storageRecord.status).toBe('open');
    });

    test('maps all enhanced fields to storage', () => {
      const record = createAnalysisOutput();
      const storageRecord = buildStorageRecord(record);

      expect(storageRecord.program_overview).toBe('Overview of the test program.');
      expect(storageRecord.program_insights).toBe('Key insight about the program.');
      expect(storageRecord.eligibility_criteria).toBe('Must be a commercial entity.');
      expect(storageRecord.application_process).toBe('Apply online at website.');
      expect(storageRecord.key_dates).toBe('Applications due December 31, 2025.');
      expect(storageRecord.contact_information).toBe('contact@example.com');
    });

    test('extraction data flows through to storage', () => {
      const record = createAnalysisOutput();
      const storageRecord = buildStorageRecord(record);

      expect(storageRecord.funding_amount).toBe(50000);
      expect(storageRecord.close_date).toBe('2025-12-31');
      expect(storageRecord.eligible_applicants).toEqual(['Commercial']);
    });

    test('handles missing extraction data gracefully', () => {
      const record = createAnalysisOutput({ extraction_data: null });
      const storageRecord = buildStorageRecord(record);

      expect(storageRecord.title).toBe('Test Program');
      expect(storageRecord.description).toBeNull();
      expect(storageRecord.eligible_applicants).toEqual([]);
    });
  });
});
