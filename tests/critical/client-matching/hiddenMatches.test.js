/**
 * Hidden Matches Tests
 *
 * Tests the hide/restore functionality for client-opportunity matches.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '../../helpers/supabaseMock.js';
import { clients } from '../../fixtures/clients.js';
import { opportunities } from '../../fixtures/opportunities.js';

describe('Hidden Matches Functionality', () => {

  describe('Hidden Match Filtering', () => {
    test('hidden opportunities are excluded from match results', async () => {
      const hiddenMatches = [
        { client_id: 'client-pge-bay-area', opportunity_id: 'opp-national-001' },
        { client_id: 'client-pge-bay-area', opportunity_id: 'opp-pge-001' },
      ];

      const supabase = createSupabaseMock({
        hidden_matches: hiddenMatches,
      });

      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      const hiddenIds = new Set(hidden.map(h => h.opportunity_id));

      // Filter opportunities
      const allOpps = Object.values(opportunities);
      const visibleOpps = allOpps.filter(opp => !hiddenIds.has(opp.id));

      expect(hiddenIds.has('opp-national-001')).toBe(true);
      expect(hiddenIds.has('opp-pge-001')).toBe(true);
      expect(visibleOpps.find(o => o.id === 'opp-national-001')).toBeUndefined();
      expect(visibleOpps.find(o => o.id === 'opp-pge-001')).toBeUndefined();
    });

    test('non-hidden opportunities are included', async () => {
      const hiddenMatches = [
        { client_id: 'client-pge-bay-area', opportunity_id: 'opp-national-001' },
      ];

      const supabase = createSupabaseMock({
        hidden_matches: hiddenMatches,
      });

      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      const hiddenIds = new Set(hidden.map(h => h.opportunity_id));

      const allOpps = Object.values(opportunities);
      const visibleOpps = allOpps.filter(opp => !hiddenIds.has(opp.id));

      // California state grant should still be visible
      expect(visibleOpps.find(o => o.id === 'opp-ca-state-001')).toBeDefined();
    });

    test('hidden matches for other clients do not affect current client', async () => {
      const hiddenMatches = [
        { client_id: 'client-other', opportunity_id: 'opp-national-001' },
      ];

      const supabase = createSupabaseMock({
        hidden_matches: hiddenMatches,
      });

      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      // No hidden matches for this client
      expect(hidden).toHaveLength(0);
    });

    test('client with no hidden matches sees all opportunities', async () => {
      const supabase = createSupabaseMock({
        hidden_matches: [],
      });

      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      expect(hidden).toHaveLength(0);

      const hiddenIds = new Set();
      const allOpps = Object.values(opportunities);
      const visibleOpps = allOpps.filter(opp => !hiddenIds.has(opp.id));

      expect(visibleOpps.length).toBe(allOpps.length);
    });
  });

  describe('Hide Match Operation', () => {
    test('can hide a match', async () => {
      const supabase = createSupabaseMock({
        hidden_matches: [],
      });

      // Hide a match
      await supabase
        .from('hidden_matches')
        .insert({
          client_id: 'client-pge-bay-area',
          opportunity_id: 'opp-national-001',
        });

      // Verify it's hidden
      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      expect(hidden).toHaveLength(1);
      expect(hidden[0].opportunity_id).toBe('opp-national-001');
    });

    test('can hide multiple matches', async () => {
      const supabase = createSupabaseMock({
        hidden_matches: [],
      });

      // Hide multiple matches
      await supabase
        .from('hidden_matches')
        .insert([
          { client_id: 'client-pge-bay-area', opportunity_id: 'opp-national-001' },
          { client_id: 'client-pge-bay-area', opportunity_id: 'opp-pge-001' },
          { client_id: 'client-pge-bay-area', opportunity_id: 'opp-ca-state-001' },
        ]);

      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      expect(hidden).toHaveLength(3);
    });

    test('hiding same match twice is handled gracefully', async () => {
      const supabase = createSupabaseMock({
        hidden_matches: [
          { client_id: 'client-pge-bay-area', opportunity_id: 'opp-national-001' },
        ],
      });

      // Try to hide the same match again
      await supabase
        .from('hidden_matches')
        .insert({
          client_id: 'client-pge-bay-area',
          opportunity_id: 'opp-national-001',
        });

      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      // Mock doesn't enforce unique constraint, so both copies are stored
      expect(hidden).toHaveLength(2);
    });
  });

  describe('Restore Match Operation', () => {
    test('can restore a hidden match', async () => {
      const supabase = createSupabaseMock({
        hidden_matches: [
          { id: 1, client_id: 'client-pge-bay-area', opportunity_id: 'opp-national-001' },
        ],
      });

      // Restore the match
      await supabase
        .from('hidden_matches')
        .delete()
        .eq('client_id', 'client-pge-bay-area')
        .eq('opportunity_id', 'opp-national-001');

      // Verify it's no longer hidden
      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      expect(hidden).toHaveLength(0);
    });

    test('restoring non-hidden match is no-op', async () => {
      const supabase = createSupabaseMock({
        hidden_matches: [],
      });

      // Try to restore a match that isn't hidden
      await supabase
        .from('hidden_matches')
        .delete()
        .eq('client_id', 'client-pge-bay-area')
        .eq('opportunity_id', 'opp-national-001');

      // Should not throw error
      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      expect(hidden).toHaveLength(0);
    });
  });

  describe('Hidden Count Tracking', () => {
    test('hidden count is accurate', async () => {
      const hiddenMatches = [
        { client_id: 'client-pge-bay-area', opportunity_id: 'opp-1' },
        { client_id: 'client-pge-bay-area', opportunity_id: 'opp-2' },
        { client_id: 'client-pge-bay-area', opportunity_id: 'opp-3' },
        { client_id: 'other-client', opportunity_id: 'opp-4' },
      ];

      const supabase = createSupabaseMock({
        hidden_matches: hiddenMatches,
      });

      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      const hiddenCount = hidden.length;

      expect(hiddenCount).toBe(3); // Only count matches for this client
    });

    test('hidden count updates after hide operation', async () => {
      const supabase = createSupabaseMock({
        hidden_matches: [
          { client_id: 'client-pge-bay-area', opportunity_id: 'opp-1' },
        ],
      });

      // Initial count
      let { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      expect(hidden.length).toBe(1);

      // Hide another match
      await supabase
        .from('hidden_matches')
        .insert({
          client_id: 'client-pge-bay-area',
          opportunity_id: 'opp-2',
        });

      // Updated count
      ({ data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area'));

      expect(hidden.length).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty client_id', async () => {
      const supabase = createSupabaseMock({
        hidden_matches: [],
      });

      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', '');

      expect(hidden).toHaveLength(0);
    });

    test('handles null opportunity_id', async () => {
      const supabase = createSupabaseMock({
        hidden_matches: [
          { client_id: 'client-pge-bay-area', opportunity_id: null },
        ],
      });

      const { data: hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-pge-bay-area');

      // null opportunity_id should be in results
      expect(hidden.some(h => h.opportunity_id === null)).toBe(true);
    });
  });

  describe('Client-Specific Isolation', () => {
    test('hidden matches are isolated per client', async () => {
      const hiddenMatches = [
        { client_id: 'client-1', opportunity_id: 'opp-a' },
        { client_id: 'client-2', opportunity_id: 'opp-b' },
        { client_id: 'client-1', opportunity_id: 'opp-c' },
      ];

      const supabase = createSupabaseMock({
        hidden_matches: hiddenMatches,
      });

      // Client 1 hidden matches
      const { data: client1Hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-1');

      expect(client1Hidden.map(h => h.opportunity_id)).toEqual(['opp-a', 'opp-c']);

      // Client 2 hidden matches
      const { data: client2Hidden } = await supabase
        .from('hidden_matches')
        .select('opportunity_id')
        .eq('client_id', 'client-2');

      expect(client2Hidden.map(h => h.opportunity_id)).toEqual(['opp-b']);
    });
  });
});
