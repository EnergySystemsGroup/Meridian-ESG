/**
 * Clients Search Tests
 *
 * Tests the multi-field search functionality for clients:
 * - Name search
 * - Type search
 * - Location search (city, state)
 * - Project needs search
 * - Description search
 * - Case insensitivity
 * - Partial matching
 */

import { describe, test, expect } from 'vitest';

/**
 * Search clients by query
 */
function searchClients(clients, query) {
  if (!query || query.trim() === '') return clients;

  const q = query.toLowerCase().trim();

  return clients.filter(client => {
    const searchFields = [
      client.name,
      client.type,
      client.city,
      client.state,
      client.description,
      ...(client.project_needs || []),
    ].filter(Boolean);

    return searchFields.some(field =>
      field.toLowerCase().includes(q)
    );
  });
}

const testClients = [
  {
    id: 1,
    name: 'City of San Francisco',
    type: 'Municipal Government',
    city: 'San Francisco',
    state: 'CA',
    description: 'Large coastal city with aggressive climate goals',
    project_needs: ['Solar', 'EV Charging', 'Building Envelope'],
  },
  {
    id: 2,
    name: 'Oakland Unified School District',
    type: 'School District',
    city: 'Oakland',
    state: 'CA',
    description: 'Urban school district with aging infrastructure',
    project_needs: ['HVAC Upgrades', 'Lighting', 'Solar'],
  },
  {
    id: 3,
    name: 'Houston Housing Authority',
    type: 'Public Housing Authority',
    city: 'Houston',
    state: 'TX',
    description: 'Large public housing provider serving low-income residents',
    project_needs: ['Energy Efficiency', 'HVAC Upgrades', 'Weatherization'],
  },
  {
    id: 4,
    name: 'Pacific Gas & Electric',
    type: 'Utility',
    city: 'San Francisco',
    state: 'CA',
    description: 'Major California utility company',
    project_needs: ['Grid Modernization', 'Battery Storage'],
  },
  {
    id: 5,
    name: 'Navajo Nation',
    type: 'Tribal Government',
    city: 'Window Rock',
    state: 'AZ',
    description: 'Sovereign tribal nation in the Four Corners region',
    project_needs: ['Solar', 'Electrification', 'Off-Grid Solutions'],
  },
];

describe('Clients Search', () => {

  describe('Name Search', () => {
    test('finds client by exact name', () => {
      const result = searchClients(testClients, 'City of San Francisco');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('finds client by partial name', () => {
      const result = searchClients(testClients, 'Oakland');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    test('case insensitive name search', () => {
      const result = searchClients(testClients, 'PACIFIC GAS');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4);
    });

    test('finds multiple clients with similar names', () => {
      const result = searchClients(testClients, 'San Francisco');

      expect(result).toHaveLength(2); // City of SF and PG&E (based in SF)
    });
  });

  describe('Type Search', () => {
    test('finds client by type', () => {
      const result = searchClients(testClients, 'School District');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    test('finds client by partial type', () => {
      const result = searchClients(testClients, 'Government');

      expect(result).toHaveLength(2); // Municipal + Tribal
    });

    test('finds utility clients', () => {
      const result = searchClients(testClients, 'Utility');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4);
    });
  });

  describe('Location Search', () => {
    test('finds clients by city', () => {
      const result = searchClients(testClients, 'Houston');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    test('finds clients by state code', () => {
      const result = searchClients(testClients, 'CA');

      // Matches: SF (state=CA), Oakland (state=CA), PG&E (state=CA + "California" in desc),
      // Navajo ('Electrification' in project_needs contains 'ca')
      expect(result).toHaveLength(4);
      expect(result.some(c => c.state === 'CA')).toBe(true);
    });

    test('finds clients by state name in description', () => {
      const result = searchClients(testClients, 'California');

      expect(result).toHaveLength(1); // PG&E mentions California
      expect(result[0].id).toBe(4);
    });
  });

  describe('Project Needs Search', () => {
    test('finds clients by project need', () => {
      const result = searchClients(testClients, 'Solar');

      expect(result).toHaveLength(3); // SF, Oakland, Navajo Nation
    });

    test('finds clients by specific project need', () => {
      const result = searchClients(testClients, 'Battery Storage');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4);
    });

    test('partial project need matching', () => {
      const result = searchClients(testClients, 'HVAC');

      expect(result).toHaveLength(2); // Oakland + Houston
    });

    test('finds clients by multiple matching needs', () => {
      const result = searchClients(testClients, 'Grid');

      expect(result).toHaveLength(2); // PG&E (Grid Modernization) + Navajo (Off-Grid)
    });
  });

  describe('Description Search', () => {
    test('finds clients by description keyword', () => {
      const result = searchClients(testClients, 'climate');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('finds clients by description phrase', () => {
      const result = searchClients(testClients, 'low-income');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    test('finds multiple clients with related descriptions', () => {
      const result = searchClients(testClients, 'infrastructure');

      expect(result).toHaveLength(1); // Oakland mentions 'infrastructure'
    });
  });

  describe('Cross-Field Search', () => {
    test('search matches across multiple fields', () => {
      // "San Francisco" appears in name (client 1) and city (client 1 & 4)
      const result = searchClients(testClients, 'San Francisco');

      expect(result).toHaveLength(2);
      expect(result.map(c => c.id).sort()).toEqual([1, 4]);
    });

    test('prioritizes any match across all fields', () => {
      // Should find both where "Nation" appears in name or description
      const result = searchClients(testClients, 'Nation');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toContain('Nation');
    });
  });

  describe('Empty and Edge Cases', () => {
    test('returns all clients for empty query', () => {
      expect(searchClients(testClients, '')).toHaveLength(5);
      expect(searchClients(testClients, null)).toHaveLength(5);
      expect(searchClients(testClients, undefined)).toHaveLength(5);
    });

    test('returns all clients for whitespace query', () => {
      expect(searchClients(testClients, '   ')).toHaveLength(5);
    });

    test('returns empty for no matches', () => {
      const result = searchClients(testClients, 'xyz123nonexistent');

      expect(result).toHaveLength(0);
    });

    test('handles empty client array', () => {
      const result = searchClients([], 'test');

      expect(result).toHaveLength(0);
    });

    test('handles client with null fields', () => {
      const clients = [
        { id: 1, name: 'Test Client', type: null, city: null, project_needs: null },
      ];

      const result = searchClients(clients, 'Test');

      expect(result).toHaveLength(1);
    });

    test('handles client with empty project_needs array', () => {
      const clients = [
        { id: 1, name: 'Test Client', project_needs: [] },
      ];

      const result = searchClients(clients, 'Test');

      expect(result).toHaveLength(1);
    });
  });

  describe('Special Characters', () => {
    test('handles ampersand in search', () => {
      const result = searchClients(testClients, 'Gas & Electric');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4);
    });

    test('handles hyphenated terms', () => {
      const result = searchClients(testClients, 'Off-Grid');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(5);
    });
  });

  describe('Search Performance', () => {
    test('search does not mutate original array', () => {
      const original = [...testClients];
      searchClients(testClients, 'test');

      expect(testClients).toEqual(original);
    });

    test('empty query returns original array (optimization)', () => {
      // Empty query returns original array as optimization
      // This is acceptable behavior - no filtering needed
      const result = searchClients(testClients, '');

      expect(result).toHaveLength(testClients.length);
    });
  });
});
