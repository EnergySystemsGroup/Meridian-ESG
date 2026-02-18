/**
 * Review Opportunity Test Fixtures
 *
 * Sample records for testing admin review (Phase 7) endpoints.
 * Each fixture represents a different promotion_status state.
 */

import { opportunities } from './opportunities.js';

export const reviewOpportunities = {
  // Pending review - high score (should be approved)
  pendingHighScore: {
    ...opportunities.nationalGrant,
    id: 'review-pending-001',
    funding_type: 'Grant',
    open_date: '2026-01-01T00:00:00Z',
    url: 'https://example.com/grant-001',
    program_id: 'prog-001',
    promotion_status: 'pending_review',
    relevance_score: 8.5,
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    funding_source_id: 'source-001',
  },

  // Pending review - low score (might be rejected)
  pendingLowScore: {
    ...opportunities.californiaStateGrant,
    id: 'review-pending-002',
    funding_type: 'Rebate',
    open_date: '2026-02-01T00:00:00Z',
    url: 'https://example.com/rebate-002',
    program_id: 'prog-002',
    promotion_status: 'pending_review',
    relevance_score: 3.2,
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    funding_source_id: 'source-002',
  },

  // Already approved (promoted)
  approvedRecord: {
    ...opportunities.nationalGrant,
    id: 'review-approved-001',
    funding_type: 'Grant',
    open_date: '2026-01-15T00:00:00Z',
    url: 'https://example.com/grant-approved',
    program_id: 'prog-001',
    promotion_status: 'promoted',
    relevance_score: 7.5,
    reviewed_by: 'admin',
    reviewed_at: '2026-02-15T10:00:00Z',
    review_notes: null,
    funding_source_id: 'source-001',
  },

  // Already rejected
  rejectedRecord: {
    ...opportunities.californiaStateGrant,
    id: 'review-rejected-001',
    funding_type: 'Tax Credit',
    open_date: null,
    url: null,
    program_id: null,
    promotion_status: 'rejected',
    relevance_score: 4.0,
    reviewed_by: 'admin',
    reviewed_at: '2026-02-15T11:00:00Z',
    review_notes: 'Duplicate of existing API record',
    funding_source_id: 'source-002',
  },

  // API record (null promotion_status - legacy)
  apiRecord: {
    ...opportunities.nationalGrant,
    id: 'review-api-001',
    funding_type: null,
    open_date: null,
    url: null,
    program_id: null,
    promotion_status: null,
    relevance_score: 6.0,
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    funding_source_id: null,
  },
};
