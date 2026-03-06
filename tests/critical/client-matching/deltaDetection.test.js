/**
 * Delta Detection Tests
 *
 * Tests the logic that determines whether a match is new, updated, or stale
 * when comparing computed matches against existing persisted matches.
 *
 * Mirrors the delta detection logic in lib/matching/computeMatches.js
 */

import { describe, test, expect } from 'vitest';

// --- Inline functions mirroring computeMatches.js delta detection logic ---

/**
 * Classify a computed match as 'new' or 'updated' based on existing matches.
 *
 * @param {string} clientId
 * @param {string} opportunityId
 * @param {Set<string>} existingMatchKeys - Set of "clientId:opportunityId" strings
 * @returns {'new' | 'updated'}
 */
function classifyMatch(clientId, opportunityId, existingMatchKeys) {
  const key = `${clientId}:${opportunityId}`;
  return existingMatchKeys.has(key) ? 'updated' : 'new';
}

/**
 * Find stale matches: existed before but not in current computation.
 *
 * @param {Array<{client_id: string, opportunity_id: string}>} existingMatches
 * @param {Set<string>} computedMatchKeys - Set of "clientId:opportunityId" strings
 * @returns {Array<{client_id: string, opportunity_id: string}>}
 */
function findStaleMatches(existingMatches, computedMatchKeys) {
  return existingMatches.filter(m => {
    const key = `${m.client_id}:${m.opportunity_id}`;
    return !computedMatchKeys.has(key);
  });
}

/**
 * Build UPSERT row for a match.
 * is_new and first_matched_at are intentionally excluded from the payload:
 * - New rows get DB defaults: is_new=true, first_matched_at=NOW()
 * - Existing rows preserve their values via ON CONFLICT (columns not in payload are untouched)
 * This approach also avoids race conditions between concurrent triggers.
 *
 * @param {Object} match - { client_id, opportunity_id, score, match_details }
 * @returns {Object} UPSERT row (same shape for new and existing matches)
 */
function buildUpsertRow(match) {
  const now = new Date().toISOString();
  return {
    client_id: match.client_id,
    opportunity_id: match.opportunity_id,
    score: match.score,
    match_details: match.match_details,
    last_matched_at: now,
    is_stale: false,
    stale_at: null
  };
}

/**
 * Build stale update for a match that no longer qualifies.
 *
 * @param {Object} match - { client_id, opportunity_id }
 * @param {boolean} alreadyStale - Whether the match is already marked stale
 * @returns {Object|null} Update payload or null if already stale
 */
function buildStaleUpdate(match, alreadyStale) {
  if (alreadyStale) return null; // Don't re-stale
  return {
    is_stale: true,
    stale_at: new Date().toISOString()
  };
}

/**
 * Compute delta stats from classification results.
 *
 * @param {Array<{client_id: string, opportunity_id: string, score: number}>} computedMatches
 * @param {Set<string>} existingMatchKeys
 * @param {Array<{client_id: string, opportunity_id: string}>} staleMatches
 * @returns {{ new_matches: number, updated_matches: number, stale_matches: number }}
 */
function computeDeltaStats(computedMatches, existingMatchKeys, staleMatches) {
  let newCount = 0;
  let updatedCount = 0;

  for (const match of computedMatches) {
    const key = `${match.client_id}:${match.opportunity_id}`;
    if (existingMatchKeys.has(key)) {
      updatedCount++;
    } else {
      newCount++;
    }
  }

  return {
    new_matches: newCount,
    updated_matches: updatedCount,
    stale_matches: staleMatches.length
  };
}

// --- Tests ---

describe('Delta Detection: Match Classification', () => {
  test('match not in existing set is classified as new', () => {
    const existing = new Set(['clientA:opp1', 'clientA:opp2']);
    expect(classifyMatch('clientA', 'opp3', existing)).toBe('new');
  });

  test('match in existing set is classified as updated', () => {
    const existing = new Set(['clientA:opp1', 'clientA:opp2']);
    expect(classifyMatch('clientA', 'opp1', existing)).toBe('updated');
  });

  test('empty existing set means all matches are new', () => {
    const existing = new Set();
    expect(classifyMatch('clientA', 'opp1', existing)).toBe('new');
    expect(classifyMatch('clientB', 'opp2', existing)).toBe('new');
  });
});

describe('Delta Detection: Stale Match Detection', () => {
  test('existing match not in computed set is stale', () => {
    const existing = [
      { client_id: 'c1', opportunity_id: 'o1' },
      { client_id: 'c1', opportunity_id: 'o2' },
      { client_id: 'c1', opportunity_id: 'o3' }
    ];
    const computed = new Set(['c1:o1', 'c1:o3']); // o2 dropped
    const stale = findStaleMatches(existing, computed);
    expect(stale).toEqual([{ client_id: 'c1', opportunity_id: 'o2' }]);
  });

  test('no stale matches when all existing are still computed', () => {
    const existing = [
      { client_id: 'c1', opportunity_id: 'o1' },
      { client_id: 'c1', opportunity_id: 'o2' }
    ];
    const computed = new Set(['c1:o1', 'c1:o2']);
    const stale = findStaleMatches(existing, computed);
    expect(stale).toEqual([]);
  });

  test('all existing matches become stale when nothing computes', () => {
    const existing = [
      { client_id: 'c1', opportunity_id: 'o1' },
      { client_id: 'c1', opportunity_id: 'o2' }
    ];
    const computed = new Set();
    const stale = findStaleMatches(existing, computed);
    expect(stale).toHaveLength(2);
  });

  test('empty existing set produces no stale matches', () => {
    const stale = findStaleMatches([], new Set(['c1:o1']));
    expect(stale).toEqual([]);
  });
});

describe('Delta Detection: UPSERT Row Building', () => {
  test('upsert row excludes is_new and first_matched_at (DB defaults handle them)', () => {
    const row = buildUpsertRow(
      { client_id: 'c1', opportunity_id: 'o1', score: 75, match_details: { locationMatch: true } }
    );
    // is_new and first_matched_at are NOT in the payload — DB handles them
    expect(row.is_new).toBeUndefined();
    expect(row.first_matched_at).toBeUndefined();
    expect(row.last_matched_at).toBeDefined();
    expect(row.score).toBe(75);
    expect(row.is_stale).toBe(false);
    expect(row.stale_at).toBeNull();
  });

  test('upsert row shape is identical for new and existing matches', () => {
    const match = { client_id: 'c1', opportunity_id: 'o1', score: 80, match_details: {} };
    const row = buildUpsertRow(match);
    // Same payload regardless — ON CONFLICT handles the difference
    expect(Object.keys(row).sort()).toEqual([
      'client_id', 'is_stale', 'last_matched_at', 'match_details',
      'opportunity_id', 'score', 'stale_at'
    ]);
  });
});

describe('Delta Detection: Stale Update Building', () => {
  test('non-stale match gets stale update', () => {
    const update = buildStaleUpdate({ client_id: 'c1', opportunity_id: 'o1' }, false);
    expect(update).not.toBeNull();
    expect(update.is_stale).toBe(true);
    expect(update.stale_at).toBeDefined();
  });

  test('already-stale match returns null (no-op)', () => {
    const update = buildStaleUpdate({ client_id: 'c1', opportunity_id: 'o1' }, true);
    expect(update).toBeNull();
  });
});

describe('Delta Detection: Stats Computation', () => {
  test('correct counts for mixed new, updated, and stale', () => {
    const computed = [
      { client_id: 'c1', opportunity_id: 'o1', score: 80 }, // existing → updated
      { client_id: 'c1', opportunity_id: 'o2', score: 60 }, // existing → updated
      { client_id: 'c1', opportunity_id: 'o4', score: 90 }  // new
    ];
    const existing = new Set(['c1:o1', 'c1:o2', 'c1:o3']);
    const stale = [{ client_id: 'c1', opportunity_id: 'o3' }]; // o3 dropped

    const stats = computeDeltaStats(computed, existing, stale);
    expect(stats.new_matches).toBe(1);
    expect(stats.updated_matches).toBe(2);
    expect(stats.stale_matches).toBe(1);
  });

  test('all new when no existing matches', () => {
    const computed = [
      { client_id: 'c1', opportunity_id: 'o1', score: 80 },
      { client_id: 'c1', opportunity_id: 'o2', score: 60 }
    ];
    const stats = computeDeltaStats(computed, new Set(), []);
    expect(stats.new_matches).toBe(2);
    expect(stats.updated_matches).toBe(0);
    expect(stats.stale_matches).toBe(0);
  });

  test('zero matches when nothing computes', () => {
    const stats = computeDeltaStats([], new Set(['c1:o1']), [{ client_id: 'c1', opportunity_id: 'o1' }]);
    expect(stats.new_matches).toBe(0);
    expect(stats.updated_matches).toBe(0);
    expect(stats.stale_matches).toBe(1);
  });
});

describe('Delta Detection: Edge Cases', () => {
  test('client with empty project_needs produces score 0 (match still valid)', () => {
    // evaluateMatch returns score=0 when client has no project_needs
    // The delta detection should still classify it correctly
    const computed = [{ client_id: 'c1', opportunity_id: 'o1', score: 0 }];
    const stats = computeDeltaStats(computed, new Set(), []);
    expect(stats.new_matches).toBe(1);
  });

  test('multiple clients and opportunities produce correct keys', () => {
    const existing = new Set(['c1:o1', 'c2:o1', 'c1:o2']);
    expect(classifyMatch('c1', 'o1', existing)).toBe('updated');
    expect(classifyMatch('c2', 'o1', existing)).toBe('updated');
    expect(classifyMatch('c1', 'o2', existing)).toBe('updated');
    expect(classifyMatch('c2', 'o2', existing)).toBe('new');
    expect(classifyMatch('c3', 'o1', existing)).toBe('new');
  });

  test('previously stale match that reappears gets un-staled', () => {
    // When a match was stale but now computes again, the UPSERT row
    // should set is_stale=false and stale_at=null
    const row = buildUpsertRow(
      { client_id: 'c1', opportunity_id: 'o1', score: 70, match_details: {} }
    );
    expect(row.is_stale).toBe(false);
    expect(row.stale_at).toBeNull();
  });
});
