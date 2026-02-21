/**
 * Synonym Expansion Tests
 *
 * Tests the getExpandedClientTypes function which provides:
 * 1. Horizontal expansion via synonyms (City Government ↔ Municipal Government)
 * 2. Vertical expansion via hierarchy (Municipal Government → Local Governments)
 */

import { describe, test, expect } from 'vitest';
import { TAXONOMIES, getExpandedClientTypes } from '../../fixtures/taxonomies.js';

describe('Client Type Synonym Expansion', () => {

  describe('Self Inclusion', () => {
    test('always includes the original type', () => {
      const types = [
        'City Government',
        'Municipal Government',
        'School District',
        'Hospital',
        'Unknown Type'
      ];

      types.forEach(type => {
        const expanded = getExpandedClientTypes(type);
        expect(expanded).toContain(type);
      });
    });

    test('handles unknown types gracefully (returns only self)', () => {
      const expanded = getExpandedClientTypes('Made Up Type');

      expect(expanded).toContain('Made Up Type');
      expect(expanded).toHaveLength(1);
    });
  });

  describe('Synonym Expansion (Horizontal)', () => {
    test('City Government expands to include synonyms', () => {
      const expanded = getExpandedClientTypes('City Government');

      expect(expanded).toContain('City Government');
      expect(expanded).toContain('Municipal Government');
      expect(expanded).toContain('Township Government');
    });

    test('Municipal Government expands to include synonyms', () => {
      const expanded = getExpandedClientTypes('Municipal Government');

      expect(expanded).toContain('Municipal Government');
      expect(expanded).toContain('City Government');
      expect(expanded).toContain('Township Government');
    });

    test('Township Government expands to include synonyms', () => {
      const expanded = getExpandedClientTypes('Township Government');

      expect(expanded).toContain('Township Government');
      expect(expanded).toContain('City Government');
      expect(expanded).toContain('Municipal Government');
    });

    test('K-12 School Districts and K-12 Schools are synonyms', () => {
      const expanded1 = getExpandedClientTypes('K-12 School Districts');
      const expanded2 = getExpandedClientTypes('K-12 Schools');

      expect(expanded1).toContain('K-12 School Districts');
      expect(expanded1).toContain('K-12 Schools');

      expect(expanded2).toContain('K-12 School Districts');
      expect(expanded2).toContain('K-12 Schools');
    });

    test('Colleges and Universities are synonyms', () => {
      const expanded1 = getExpandedClientTypes('Colleges');
      const expanded2 = getExpandedClientTypes('Universities');

      expect(expanded1).toContain('Colleges');
      expect(expanded1).toContain('Universities');

      expect(expanded2).toContain('Colleges');
      expect(expanded2).toContain('Universities');
    });

    test('Community Colleges and Technical Colleges are synonyms', () => {
      const expanded1 = getExpandedClientTypes('Community Colleges');
      const expanded2 = getExpandedClientTypes('Technical Colleges');

      expect(expanded1).toContain('Community Colleges');
      expect(expanded1).toContain('Technical Colleges');

      expect(expanded2).toContain('Community Colleges');
      expect(expanded2).toContain('Technical Colleges');
    });

    test('Healthcare facility types are synonyms', () => {
      const types = ['Hospitals', 'Health Centers', 'FQHCs', 'Community Health Centers'];

      types.forEach(type => {
        const expanded = getExpandedClientTypes(type);
        types.forEach(synonym => {
          expect(expanded).toContain(synonym);
        });
      });
    });
  });

  describe('Hierarchy Expansion (Vertical)', () => {
    test('City Government expands to Local Governments parent', () => {
      const expanded = getExpandedClientTypes('City Government');

      expect(expanded).toContain('Local Governments');
    });

    test('Municipal Government expands to Local Governments parent', () => {
      const expanded = getExpandedClientTypes('Municipal Government');

      expect(expanded).toContain('Local Governments');
    });

    test('Township Government expands to Local Governments parent', () => {
      const expanded = getExpandedClientTypes('Township Government');

      expect(expanded).toContain('Local Governments');
    });

    test('County Government expands to Local Governments parent', () => {
      const expanded = getExpandedClientTypes('County Government');

      expect(expanded).toContain('Local Governments');
    });

    test('Special Districts expands to Local Governments parent', () => {
      const expanded = getExpandedClientTypes('Special Districts');

      expect(expanded).toContain('Local Governments');
    });

    test('Colleges expands to Institutions of Higher Education parent', () => {
      const expanded = getExpandedClientTypes('Colleges');

      expect(expanded).toContain('Institutions of Higher Education');
    });

    test('Universities expands to Institutions of Higher Education parent', () => {
      const expanded = getExpandedClientTypes('Universities');

      expect(expanded).toContain('Institutions of Higher Education');
    });

    test('Hospitals expands to Healthcare Facilities parent', () => {
      const expanded = getExpandedClientTypes('Hospitals');

      expect(expanded).toContain('Healthcare Facilities');
    });

    test('Small/Medium Businesses (SMB) expands to For-Profit Businesses parent', () => {
      const expanded = getExpandedClientTypes('Small/Medium Businesses (SMB)');

      expect(expanded).toContain('For-Profit Businesses');
    });

    test('Homeowners expands to Individuals parent', () => {
      const expanded = getExpandedClientTypes('Homeowners');

      expect(expanded).toContain('Individuals');
    });
  });

  describe('Combined Expansion (Synonyms + Hierarchy)', () => {
    test('City Government gets full expansion chain', () => {
      const expanded = getExpandedClientTypes('City Government');

      // Should include: self, synonyms, and parent
      expect(expanded).toContain('City Government');           // Self
      expect(expanded).toContain('Municipal Government');      // Synonym
      expect(expanded).toContain('Township Government');       // Synonym
      expect(expanded).toContain('Local Governments');         // Parent
      expect(expanded).toContain('Public Agencies');           // Also a parent for city gov
    });

    test('Hospitals gets synonyms and parent', () => {
      const expanded = getExpandedClientTypes('Hospitals');

      expect(expanded).toContain('Hospitals');
      expect(expanded).toContain('Health Centers');            // Synonym
      expect(expanded).toContain('FQHCs');                     // Synonym
      expect(expanded).toContain('Community Health Centers');  // Synonym
      expect(expanded).toContain('Healthcare Facilities');     // Parent
    });

    test('Community Colleges gets synonyms and parent', () => {
      const expanded = getExpandedClientTypes('Community Colleges');

      expect(expanded).toContain('Community Colleges');
      expect(expanded).toContain('Technical Colleges');        // Synonym
      expect(expanded).toContain('Institutions of Higher Education'); // Parent
    });
  });

  describe('Standalone Types (No Expansion)', () => {
    test('standalone types (non-K-12) only include self and any parent', () => {
      // Non-K-12 standalone types should always contain themselves.
      // Some (e.g. Tribal Governments, Federal Agencies) have a parent in the
      // hierarchy — but they should NOT pick up unrelated synonyms.
      const nonK12Standalones = TAXONOMIES.STANDALONE_CLIENT_TYPES.filter(
        t => !t.includes('K-12')
      );

      nonK12Standalones.forEach(type => {
        const expanded = getExpandedClientTypes(type);

        // Must always contain itself
        expect(expanded).toContain(type);

        // Must NOT contain types from unrelated synonym groups
        // (City Government synonyms, college synonyms, healthcare synonyms)
        expect(expanded).not.toContain('City Government');
        expect(expanded).not.toContain('Colleges');
        expect(expanded).not.toContain('Hospitals');
      });
    });

    test('Tribal Governments is standalone', () => {
      const expanded = getExpandedClientTypes('Tribal Governments');

      expect(expanded).toContain('Tribal Governments');
      // Should also include Public Agencies parent since it's in that hierarchy
      expect(expanded).toContain('Public Agencies');
    });

    test('Federal Agencies expands to Public Agencies', () => {
      const expanded = getExpandedClientTypes('Federal Agencies');

      expect(expanded).toContain('Federal Agencies');
      expect(expanded).toContain('Public Agencies');
    });

    test('State Governments expands to Public Agencies', () => {
      const expanded = getExpandedClientTypes('State Governments');

      expect(expanded).toContain('State Governments');
      expect(expanded).toContain('Public Agencies');
    });
  });

  describe('Case Insensitivity', () => {
    test('expansion is case insensitive — all variants produce equivalent synonym content', () => {
      const lower = getExpandedClientTypes('city government');
      const upper = getExpandedClientTypes('CITY GOVERNMENT');
      const mixed = getExpandedClientTypes('City Government');

      // All three variants should trigger synonym + hierarchy expansion
      // regardless of the input's case. The exact set may differ by the
      // literal input string added (e.g. 'city government' vs 'City Government'),
      // but all must include the canonical synonyms and the parent.
      const mustContain = ['Municipal Government', 'Township Government', 'Local Governments', 'Public Agencies'];

      mustContain.forEach(type => {
        expect(lower).toContain(type);
        expect(upper).toContain(type);
        expect(mixed).toContain(type);
      });
    });
  });

  describe('Full Synonym Groups from Taxonomy', () => {
    test('city_municipal synonym group is complete', () => {
      const group = TAXONOMIES.CLIENT_TYPE_SYNONYMS.city_municipal;

      expect(group).toContain('City Government');
      expect(group).toContain('Municipal Government');
      expect(group).toContain('Township Government');
    });

    test('colleges_universities synonym group is complete', () => {
      const group = TAXONOMIES.CLIENT_TYPE_SYNONYMS.colleges_universities;

      expect(group).toContain('Colleges');
      expect(group).toContain('Universities');
    });

    test('k12 synonym group is complete', () => {
      const group = TAXONOMIES.CLIENT_TYPE_SYNONYMS.k12;

      expect(group).toContain('K-12 School Districts');
      expect(group).toContain('K-12 Schools');
    });

    test('healthcare synonym group is complete', () => {
      const group = TAXONOMIES.CLIENT_TYPE_SYNONYMS.healthcare;

      expect(group).toContain('Hospitals');
      expect(group).toContain('Health Centers');
      expect(group).toContain('FQHCs');
      expect(group).toContain('Community Health Centers');
    });
  });

  describe('Hierarchy Structure Validation', () => {
    test('Local Governments hierarchy is complete', () => {
      const children = TAXONOMIES.CLIENT_TYPE_HIERARCHY['Local Governments'];

      expect(children).toContain('City Government');
      expect(children).toContain('County Government');
      expect(children).toContain('Municipal Government');
      expect(children).toContain('Township Government');
      expect(children).toContain('Special Districts');
      expect(children).toContain('Public Housing Authorities');
    });

    test('Public Agencies hierarchy is complete', () => {
      const children = TAXONOMIES.CLIENT_TYPE_HIERARCHY['Public Agencies'];

      expect(children).toContain('Federal Agencies');
      expect(children).toContain('State Governments');
      expect(children).toContain('City Government');
      expect(children).toContain('Tribal Governments');
    });

    test('Institutions of Higher Education hierarchy is complete', () => {
      const children = TAXONOMIES.CLIENT_TYPE_HIERARCHY['Institutions of Higher Education'];

      expect(children).toContain('Colleges');
      expect(children).toContain('Universities');
      expect(children).toContain('Community Colleges');
      expect(children).toContain('Technical Colleges');
    });
  });
});
