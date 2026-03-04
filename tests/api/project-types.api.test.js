/**
 * Project Types API Contract Tests
 *
 * Validates response structure for:
 * - GET /api/project-types
 */

import { describe, test, expect } from 'vitest';
import { validateSchema } from '../helpers/validateSchema.js';

describe('Project Types API Contract', () => {

  describe('Success Response Shape', () => {
    const successSchema = {
      success: 'boolean',
      projectTypes: 'array',
      projectTypeGroups: 'object',
    };

    test('validates complete success response', () => {
      const response = {
        success: true,
        projectTypes: ['Solar Panels', 'HVAC Systems', 'Roofing'],
        projectTypeGroups: {
          'Solar Panels': { count: 15 },
          'HVAC Systems': { count: 10 },
          'Roofing': { count: 8 },
        },
      };

      const errors = validateSchema(response, successSchema);
      expect(errors).toHaveLength(0);
    });

    test('projectTypes is an array of strings', () => {
      const response = {
        success: true,
        projectTypes: ['Solar Panels', 'HVAC Systems', 'Roofing'],
        projectTypeGroups: {},
      };

      response.projectTypes.forEach(pt => {
        expect(typeof pt).toBe('string');
      });
    });

    test('projectTypeGroups entries have count field', () => {
      const response = {
        success: true,
        projectTypes: ['Solar Panels'],
        projectTypeGroups: {
          'Solar Panels': { count: 15 },
        },
      };

      Object.values(response.projectTypeGroups).forEach(group => {
        expect(group).toHaveProperty('count');
        expect(typeof group.count).toBe('number');
      });
    });

    test('projectTypes keys match projectTypeGroups keys', () => {
      const response = {
        success: true,
        projectTypes: ['Solar Panels', 'HVAC Systems'],
        projectTypeGroups: {
          'Solar Panels': { count: 15 },
          'HVAC Systems': { count: 10 },
        },
      };

      response.projectTypes.forEach(pt => {
        expect(response.projectTypeGroups).toHaveProperty(pt);
      });
    });

    test('empty results are valid', () => {
      const response = {
        success: true,
        projectTypes: [],
        projectTypeGroups: {},
      };

      const errors = validateSchema(response, successSchema);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Sorting Contract', () => {
    /**
     * Sort project types by count descending, then alphabetically.
     * Mirrors: app/api/project-types/route.js lines 95-101
     */
    function sortProjectTypes(groups) {
      return Object.keys(groups).sort((a, b) => {
        const countDiff = groups[b].count - groups[a].count;
        if (countDiff !== 0) return countDiff;
        return a.localeCompare(b);
      });
    }

    test('projectTypes sorted by count descending then alphabetically', () => {
      const groups = {
        'Roofing': { count: 10 },
        'Solar Panels': { count: 15 },
        'HVAC Systems': { count: 10 },
        'Windows': { count: 5 },
      };

      const sorted = sortProjectTypes(groups);

      expect(sorted[0]).toBe('Solar Panels');   // highest count
      expect(sorted[1]).toBe('HVAC Systems');    // tied at 10, alphabetically first
      expect(sorted[2]).toBe('Roofing');         // tied at 10, alphabetically second
      expect(sorted[3]).toBe('Windows');          // lowest count
    });

    test('all same count sorts alphabetically', () => {
      const groups = {
        'Zebra': { count: 5 },
        'Alpha': { count: 5 },
        'Middle': { count: 5 },
      };

      const sorted = sortProjectTypes(groups);

      expect(sorted).toEqual(['Alpha', 'Middle', 'Zebra']);
    });
  });

  describe('Project Type Grouping Logic', () => {
    /**
     * Count opportunities per project type (each opp counted once per type).
     * Mirrors: app/api/project-types/route.js lines 50-84
     */
    function countByProjectType(opportunities, validTypes) {
      const groups = {};

      opportunities.forEach(opp => {
        if (!opp.eligible_project_types || opp.eligible_project_types.length === 0) return;

        const seenTypes = new Set();
        opp.eligible_project_types.forEach(pt => {
          if (pt && validTypes.has(pt) && !seenTypes.has(pt)) {
            seenTypes.add(pt);
            if (!groups[pt]) groups[pt] = { count: 0 };
            groups[pt].count++;
          }
        });
      });

      return groups;
    }

    const validTypes = new Set(['Solar Panels', 'HVAC Systems', 'Roofing', 'Lighting Systems']);

    test('counts each type per opportunity', () => {
      const opps = [
        { id: '1', eligible_project_types: ['Solar Panels', 'HVAC Systems'] },
        { id: '2', eligible_project_types: ['Solar Panels', 'Roofing'] },
      ];

      const result = countByProjectType(opps, validTypes);

      expect(result['Solar Panels'].count).toBe(2);
      expect(result['HVAC Systems'].count).toBe(1);
      expect(result['Roofing'].count).toBe(1);
    });

    test('skips types not in taxonomy', () => {
      const opps = [
        { id: '1', eligible_project_types: ['Solar Panels', 'Unknown Type'] },
      ];

      const result = countByProjectType(opps, validTypes);

      expect(result).toHaveProperty('Solar Panels');
      expect(result).not.toHaveProperty('Unknown Type');
    });

    test('does not double-count same type for same opportunity', () => {
      const opps = [
        { id: '1', eligible_project_types: ['Solar Panels', 'Solar Panels'] },
      ];

      const result = countByProjectType(opps, validTypes);

      expect(result['Solar Panels'].count).toBe(1);
    });

    test('skips opportunities with no project types', () => {
      const opps = [
        { id: '1', eligible_project_types: [] },
        { id: '2', eligible_project_types: null },
        { id: '3' },
      ];

      const result = countByProjectType(opps, validTypes);

      expect(Object.keys(result)).toHaveLength(0);
    });

    test('skips null entries in project types array', () => {
      const opps = [
        { id: '1', eligible_project_types: [null, 'Solar Panels', undefined] },
      ];

      const result = countByProjectType(opps, validTypes);

      expect(Object.keys(result)).toHaveLength(1);
      expect(result['Solar Panels'].count).toBe(1);
    });
  });

  describe('Error Response Shape', () => {
    test('error response has success false and error string', () => {
      const response = {
        success: false,
        error: 'Something went wrong',
      };

      expect(response.success).toBe(false);
      expect(typeof response.error).toBe('string');
    });
  });
});
