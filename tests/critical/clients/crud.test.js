/**
 * Client CRUD Tests
 *
 * Tests the validation and data preparation for client create/edit/delete:
 * - Required field validation
 * - Data normalization before save
 * - Delete cascade awareness
 * - Edit: only changed fields included
 */

import { describe, test, expect } from 'vitest';
import { clients } from '../../fixtures/clients.js';

/**
 * Validate client data before creation/update
 */
function validateClient(data) {
  const errors = [];

  if (!data.name || data.name.trim() === '') {
    errors.push({ field: 'name', message: 'Client name is required' });
  }

  if (!data.type || data.type.trim() === '') {
    errors.push({ field: 'type', message: 'Client type is required' });
  }

  if (!data.state_code || data.state_code.trim() === '') {
    errors.push({ field: 'state_code', message: 'State is required' });
  }

  if (data.state_code && data.state_code.length !== 2) {
    errors.push({ field: 'state_code', message: 'State code must be 2 characters' });
  }

  if (data.budget !== undefined && data.budget !== null) {
    const VALID_BUDGET_TIERS = ['small', 'medium', 'large', 'very_large'];
    if (typeof data.budget !== 'string' || !VALID_BUDGET_TIERS.includes(data.budget)) {
      errors.push({ field: 'budget', message: 'Budget must be a valid tier: small, medium, large, very_large' });
    }
  }

  if (data.project_needs && !Array.isArray(data.project_needs)) {
    errors.push({ field: 'project_needs', message: 'Project needs must be an array' });
  }

  return errors;
}

/**
 * Normalize client data before save
 */
function normalizeClientData(data) {
  return {
    name: data.name?.trim(),
    type: data.type?.trim(),
    city: data.city?.trim() || null,
    state_code: data.state_code?.toUpperCase().trim() || null,
    address: data.address?.trim() || null,
    description: data.description?.trim() || null,
    budget: data.budget || null,
    project_needs: (data.project_needs || []).filter(n => n && n.trim()),
    dac_status: data.dac_status || false,
    coverage_area_ids: data.coverage_area_ids || [],
  };
}

/**
 * Get the changed fields between original and updated client
 */
function getChangedFields(original, updated) {
  const changed = {};

  for (const [key, value] of Object.entries(updated)) {
    const origValue = original[key];

    if (Array.isArray(value)) {
      if (JSON.stringify(value) !== JSON.stringify(origValue)) {
        changed[key] = value;
      }
    } else if (value !== origValue) {
      changed[key] = value;
    }
  }

  return changed;
}

/**
 * Prepare client for deletion (returns related data that will be affected)
 */
function getDeleteImpact(clientId, matches) {
  const affectedMatches = matches.filter(m => m.client_id === clientId);
  return {
    clientId,
    matchesWillBeRemoved: affectedMatches.length,
    hasActiveMatches: affectedMatches.length > 0,
  };
}

describe('Client CRUD', () => {

  describe('Validation', () => {
    test('valid client produces no errors', () => {
      const errors = validateClient({
        name: 'Test Client',
        type: 'Municipal Government',
        state_code: 'CA',
      });
      expect(errors).toHaveLength(0);
    });

    test('missing name produces error', () => {
      const errors = validateClient({ name: '', type: 'Test', state_code: 'CA' });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });

    test('missing type produces error', () => {
      const errors = validateClient({ name: 'Test', type: '', state_code: 'CA' });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'type' })
      );
    });

    test('missing state_code produces error', () => {
      const errors = validateClient({ name: 'Test', type: 'Test' });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'state_code' })
      );
    });

    test('invalid state_code length produces error', () => {
      const errors = validateClient({
        name: 'Test',
        type: 'Test',
        state_code: 'California',
      });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'state_code', message: expect.stringContaining('2 characters') })
      );
    });

    test('valid budget tier produces no error', () => {
      const errors = validateClient({
        name: 'Test',
        type: 'Test',
        state_code: 'CA',
        budget: 'medium',
      });
      expect(errors.filter(e => e.field === 'budget')).toHaveLength(0);
    });

    test('invalid budget tier produces error', () => {
      const errors = validateClient({
        name: 'Test',
        type: 'Test',
        state_code: 'CA',
        budget: 'extra_large',
      });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'budget' })
      );
    });

    test('numeric budget produces error', () => {
      const errors = validateClient({
        name: 'Test',
        type: 'Test',
        state_code: 'CA',
        budget: 5000,
      });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'budget' })
      );
    });

    test('null budget is valid', () => {
      const errors = validateClient({
        name: 'Test',
        type: 'Test',
        state_code: 'CA',
        budget: null,
      });
      expect(errors.filter(e => e.field === 'budget')).toHaveLength(0);
    });

    test('non-array project_needs produces error', () => {
      const errors = validateClient({
        name: 'Test',
        type: 'Test',
        state_code: 'CA',
        project_needs: 'Solar',
      });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'project_needs' })
      );
    });

    test('whitespace-only name fails', () => {
      const errors = validateClient({ name: '   ', type: 'Test', state_code: 'CA' });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });

    test('multiple errors collected', () => {
      const errors = validateClient({});
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Data Normalization', () => {
    test('trims whitespace from string fields', () => {
      const result = normalizeClientData({
        name: '  City of SF  ',
        type: '  Municipal Government  ',
        city: '  San Francisco  ',
        state_code: ' ca ',
      });

      expect(result.name).toBe('City of SF');
      expect(result.type).toBe('Municipal Government');
      expect(result.city).toBe('San Francisco');
    });

    test('uppercases state_code', () => {
      const result = normalizeClientData({
        name: 'Test',
        type: 'Test',
        state_code: 'ca',
      });
      expect(result.state_code).toBe('CA');
    });

    test('null for empty optional fields', () => {
      const result = normalizeClientData({
        name: 'Test',
        type: 'Test',
        city: '',
        address: '',
        description: '',
      });

      expect(result.city).toBeNull();
      expect(result.address).toBeNull();
      expect(result.description).toBeNull();
    });

    test('filters empty project needs', () => {
      const result = normalizeClientData({
        name: 'Test',
        type: 'Test',
        project_needs: ['Solar', '', '  ', 'Wind'],
      });
      expect(result.project_needs).toEqual(['Solar', 'Wind']);
    });

    test('defaults project_needs to empty array', () => {
      const result = normalizeClientData({ name: 'Test', type: 'Test' });
      expect(result.project_needs).toEqual([]);
    });

    test('defaults dac_status to false', () => {
      const result = normalizeClientData({ name: 'Test', type: 'Test' });
      expect(result.dac_status).toBe(false);
    });
  });

  describe('Changed Fields Detection', () => {
    test('detects name change', () => {
      const original = { name: 'Old Name', type: 'Test' };
      const updated = { name: 'New Name', type: 'Test' };
      const changed = getChangedFields(original, updated);
      expect(changed).toEqual({ name: 'New Name' });
    });

    test('detects array change', () => {
      const original = { project_needs: ['Solar'] };
      const updated = { project_needs: ['Solar', 'Wind'] };
      const changed = getChangedFields(original, updated);
      expect(changed).toEqual({ project_needs: ['Solar', 'Wind'] });
    });

    test('no changes returns empty object', () => {
      const original = { name: 'Test', type: 'Gov' };
      const changed = getChangedFields(original, { name: 'Test', type: 'Gov' });
      expect(Object.keys(changed)).toHaveLength(0);
    });
  });

  describe('Delete Impact', () => {
    const matches = [
      { client_id: 'client-1', opportunity_id: 'opp-1' },
      { client_id: 'client-1', opportunity_id: 'opp-2' },
      { client_id: 'client-2', opportunity_id: 'opp-1' },
    ];

    test('calculates matches to be removed', () => {
      const impact = getDeleteImpact('client-1', matches);
      expect(impact.matchesWillBeRemoved).toBe(2);
      expect(impact.hasActiveMatches).toBe(true);
    });

    test('client with no matches', () => {
      const impact = getDeleteImpact('client-99', matches);
      expect(impact.matchesWillBeRemoved).toBe(0);
      expect(impact.hasActiveMatches).toBe(false);
    });
  });
});
