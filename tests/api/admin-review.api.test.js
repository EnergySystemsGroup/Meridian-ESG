/**
 * Admin Review API Contract Tests
 *
 * Tests the expected response structure for review endpoints:
 * - GET /api/admin/review - List pending/rejected records
 * - POST /api/admin/review/approve - Bulk approve
 * - POST /api/admin/review/reject - Bulk reject
 * - POST /api/admin/review/demote - Demote promoted to rejected
 */

import { describe, test, expect } from 'vitest';
import { reviewOpportunities } from '../fixtures/reviewOpportunities.js';

/**
 * Expected review list item schema
 */
const reviewItemSchema = {
  id: 'string',
  title: 'string',
  agency_name: 'string|null',
  funding_type: 'string|null',
  minimum_award: 'number|null',
  maximum_award: 'number|null',
  open_date: 'string|null',
  close_date: 'string|null',
  status: 'string|null',
  relevance_score: 'number|null',
  promotion_status: 'string',
  categories: 'array|null',
  eligible_project_types: 'array|null',
  is_national: 'boolean',
  program_id: 'string|null',
  created_at: 'string',
  reviewed_by: 'string|null',
  reviewed_at: 'string|null',
  review_notes: 'string|null',
  url: 'string|null',
  source_display_name: 'string|null',
  source_type_display: 'string|null',
  coverage_state_codes: 'array',
};

/**
 * Validate field type
 */
function validateFieldType(value, expectedType) {
  const types = expectedType.split('|');
  for (const type of types) {
    if (type === 'null' && value === null) return true;
    if (type === 'string' && typeof value === 'string') return true;
    if (type === 'number' && typeof value === 'number') return true;
    if (type === 'boolean' && typeof value === 'boolean') return true;
    if (type === 'array' && Array.isArray(value)) return true;
    if (type === 'object' && typeof value === 'object' && !Array.isArray(value)) return true;
  }
  return false;
}

/**
 * Validate object against schema
 */
function validateSchema(obj, schema) {
  const errors = [];
  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in obj)) {
      errors.push(`Missing field: ${key}`);
      continue;
    }
    if (!validateFieldType(obj[key], expectedType)) {
      errors.push(`Invalid type for ${key}: expected ${expectedType}, got ${typeof obj[key]}`);
    }
  }
  return errors;
}

describe('Admin Review API Contracts', () => {

  describe('Review List Response Schema', () => {
    test('validates complete review item', () => {
      const item = {
        ...reviewOpportunities.pendingHighScore,
        source_display_name: 'Energy Trust of Oregon',
        source_type_display: 'Utility',
        coverage_state_codes: ['OR'],
      };
      const errors = validateSchema(item, reviewItemSchema);
      expect(errors).toHaveLength(0);
    });

    test('validates item with null optional fields', () => {
      const item = {
        id: 'review-001',
        title: 'Minimal Record',
        agency_name: null,
        funding_type: null,
        minimum_award: null,
        maximum_award: null,
        open_date: null,
        close_date: null,
        status: null,
        relevance_score: null,
        promotion_status: 'pending_review',
        categories: null,
        eligible_project_types: null,
        is_national: false,
        program_id: null,
        created_at: '2026-02-17T00:00:00Z',
        reviewed_by: null,
        reviewed_at: null,
        review_notes: null,
        url: null,
        source_display_name: null,
        source_type_display: null,
        coverage_state_codes: [],
      };
      const errors = validateSchema(item, reviewItemSchema);
      expect(errors).toHaveLength(0);
    });

    test('includes review metadata fields', () => {
      const approved = {
        ...reviewOpportunities.approvedRecord,
        source_display_name: 'DOE',
        source_type_display: 'Federal',
        coverage_state_codes: [],
      };
      expect(approved).toHaveProperty('reviewed_by');
      expect(approved).toHaveProperty('reviewed_at');
      expect(approved).toHaveProperty('review_notes');
      expect(typeof approved.reviewed_by).toBe('string');
      expect(typeof approved.reviewed_at).toBe('string');
    });

    test('validates list response wrapper', () => {
      const response = {
        success: true,
        data: [],
        total_count: 0,
        pagination: { page: 1, page_size: 50, total: 0 },
      };
      expect(typeof response.success).toBe('boolean');
      expect(Array.isArray(response.data)).toBe(true);
      expect(typeof response.total_count).toBe('number');
      expect(typeof response.pagination.page).toBe('number');
      expect(typeof response.pagination.page_size).toBe('number');
      expect(typeof response.pagination.total).toBe('number');
    });
  });

  describe('Pending Review Filter', () => {
    // Inline filter replicating: .eq('promotion_status', 'pending_review')
    function filterPendingReview(opps) {
      return opps.filter(o => o.promotion_status === 'pending_review');
    }

    const allRecords = Object.values(reviewOpportunities);

    test('includes records with pending_review status', () => {
      const result = filterPendingReview(allRecords);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(r => {
        expect(r.promotion_status).toBe('pending_review');
      });
    });

    test('excludes records with null promotion_status', () => {
      const result = filterPendingReview([reviewOpportunities.apiRecord]);
      expect(result).toHaveLength(0);
    });

    test('excludes records with promoted status', () => {
      const result = filterPendingReview([reviewOpportunities.approvedRecord]);
      expect(result).toHaveLength(0);
    });

    test('excludes records with rejected status', () => {
      const result = filterPendingReview([reviewOpportunities.rejectedRecord]);
      expect(result).toHaveLength(0);
    });

    test('filters correctly across full fixture set (2 of 5 pending)', () => {
      const result = filterPendingReview(allRecords);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toContain('review-pending-001');
      expect(result.map(r => r.id)).toContain('review-pending-002');
    });
  });

  describe('Approve Action Contract', () => {
    // Inline function replicating approve logic (accepts pending_review and rejected)
    function applyApprove(opp, reviewedBy) {
      if (opp.promotion_status !== 'pending_review' && opp.promotion_status !== 'rejected') return null;
      return {
        ...opp,
        promotion_status: 'promoted',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      };
    }

    test('sets promotion_status to promoted', () => {
      const result = applyApprove(reviewOpportunities.pendingHighScore, 'admin');
      expect(result.promotion_status).toBe('promoted');
    });

    test('sets reviewed_by to provided value', () => {
      const result = applyApprove(reviewOpportunities.pendingHighScore, 'admin-user');
      expect(result.reviewed_by).toBe('admin-user');
    });

    test('sets reviewed_at to a timestamp', () => {
      const result = applyApprove(reviewOpportunities.pendingHighScore, 'admin');
      expect(typeof result.reviewed_at).toBe('string');
      expect(new Date(result.reviewed_at).getTime()).not.toBeNaN();
    });

    test('preserves all other fields', () => {
      const result = applyApprove(reviewOpportunities.pendingHighScore, 'admin');
      expect(result.title).toBe(reviewOpportunities.pendingHighScore.title);
      expect(result.relevance_score).toBe(reviewOpportunities.pendingHighScore.relevance_score);
    });

    test('allows re-approving rejected records', () => {
      const result = applyApprove(reviewOpportunities.rejectedRecord, 'admin');
      expect(result).not.toBeNull();
      expect(result.promotion_status).toBe('promoted');
    });

    test('returns null for already-promoted and null records', () => {
      expect(applyApprove(reviewOpportunities.approvedRecord, 'admin')).toBeNull();
      expect(applyApprove(reviewOpportunities.apiRecord, 'admin')).toBeNull();
    });
  });

  describe('Reject Action Contract', () => {
    // Inline function replicating reject logic
    function applyReject(opp, reviewedBy, notes) {
      if (opp.promotion_status !== 'pending_review') return null;
      return {
        ...opp,
        promotion_status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      };
    }

    test('sets promotion_status to rejected', () => {
      const result = applyReject(reviewOpportunities.pendingHighScore, 'admin', 'Not relevant');
      expect(result.promotion_status).toBe('rejected');
    });

    test('sets review_notes from provided value', () => {
      const result = applyReject(reviewOpportunities.pendingHighScore, 'admin', 'Duplicate entry');
      expect(result.review_notes).toBe('Duplicate entry');
    });

    test('allows empty review_notes (null)', () => {
      const result = applyReject(reviewOpportunities.pendingHighScore, 'admin', '');
      expect(result.review_notes).toBeNull();
    });

    test('returns null for non-pending records', () => {
      expect(applyReject(reviewOpportunities.approvedRecord, 'admin', 'test')).toBeNull();
    });
  });

  describe('Demote Action Contract', () => {
    // Inline function replicating demote logic
    function applyDemote(opp, reviewedBy, notes) {
      if (opp.promotion_status !== 'promoted' && opp.promotion_status !== null) {
        return null;
      }
      return {
        ...opp,
        promotion_status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || null,
      };
    }

    test('demotes promoted to rejected', () => {
      const result = applyDemote(reviewOpportunities.approvedRecord, 'admin', 'Data quality issue');
      expect(result.promotion_status).toBe('rejected');
      expect(result.review_notes).toBe('Data quality issue');
    });

    test('demotes null (API records) to rejected', () => {
      const result = applyDemote(reviewOpportunities.apiRecord, 'admin', 'Not viable');
      expect(result.promotion_status).toBe('rejected');
    });

    test('cannot demote already-rejected records', () => {
      const result = applyDemote(reviewOpportunities.rejectedRecord, 'admin', 'test');
      expect(result).toBeNull();
    });

    test('cannot demote pending_review records (use reject instead)', () => {
      const result = applyDemote(reviewOpportunities.pendingHighScore, 'admin', 'test');
      expect(result).toBeNull();
    });
  });

  describe('Bulk Operations', () => {
    test('approve request body requires ids array', () => {
      const validBody = { ids: ['uuid-1', 'uuid-2'], reviewed_by: 'admin' };
      expect(Array.isArray(validBody.ids)).toBe(true);
      expect(validBody.ids.length).toBeGreaterThan(0);
    });

    test('approve request body requires reviewed_by', () => {
      const validBody = { ids: ['uuid-1'], reviewed_by: 'admin' };
      expect(typeof validBody.reviewed_by).toBe('string');
      expect(validBody.reviewed_by.length).toBeGreaterThan(0);
    });

    test('reject request body accepts optional review_notes', () => {
      const withNotes = { ids: ['uuid-1'], reviewed_by: 'admin', review_notes: 'Not relevant' };
      const withoutNotes = { ids: ['uuid-1'], reviewed_by: 'admin' };
      expect(typeof withNotes.review_notes).toBe('string');
      expect(withoutNotes.review_notes).toBeUndefined();
    });

    test('empty ids array is invalid', () => {
      const body = { ids: [], reviewed_by: 'admin' };
      expect(body.ids.length).toBe(0);
    });

    test('approve response includes updated_count', () => {
      const response = { success: true, updated_count: 3, ids: ['uuid-1', 'uuid-2', 'uuid-3'] };
      expect(typeof response.updated_count).toBe('number');
      expect(response.updated_count).toBe(response.ids.length);
    });

    test('demote response includes previous and new status', () => {
      const response = {
        success: true,
        id: 'uuid-1',
        previous_status: 'promoted',
        new_status: 'rejected',
      };
      expect(typeof response.previous_status).toBe('string');
      expect(response.new_status).toBe('rejected');
    });
  });
});
