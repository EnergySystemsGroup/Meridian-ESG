/**
 * Taxonomy test fixture — mirrors lib/constants/taxonomies.js
 *
 * DO NOT import from app code — Next.js module resolution breaks in Vitest.
 * This fixture is the single source of truth for taxonomy data in tests.
 */

export const HOT_ACTIVITIES = [
  'New Construction',
  'Renovation',
  'Modernization',
  'Demolition',
  'Removal',
  'Installation',
  'Replacement',
  'Upgrade',
  'Repair',
  'Maintenance',
  'Site Preparation',
  'Infrastructure Development',
];

export const CLIENT_TYPE_SYNONYMS = {
  city_municipal: ['City Government', 'Municipal Government', 'Township Government'],
  colleges_universities: ['Colleges', 'Universities'],
  community_technical: ['Community Colleges', 'Technical Colleges'],
  k12: ['K-12 School Districts', 'K-12 Schools'],
  healthcare: ['Hospitals', 'Health Centers', 'FQHCs', 'Community Health Centers'],
};

export const CLIENT_TYPE_HIERARCHY = {
  'Local Governments': [
    'City Government',
    'County Government',
    'Municipal Government',
    'Township Government',
    'Special Districts',
    'Public Housing Authorities',
  ],
  'Public Agencies': [
    'Federal Agencies',
    'State Governments',
    'City Government',
    'County Government',
    'Municipal Government',
    'Township Government',
    'Special Districts',
    'Public Housing Authorities',
    'Tribal Governments',
  ],
  'Institutions of Higher Education': [
    'Colleges',
    'Universities',
    'Community Colleges',
    'Technical Colleges',
  ],
  'Healthcare Facilities': [
    'Hospitals',
    'Health Centers',
    'FQHCs',
    'Community Health Centers',
  ],
  'Nonprofit Organizations 501(c)(3)': [
    'Other Nonprofits',
    'Faith-Based Organizations',
    'Community-Based Organizations',
  ],
  'For-Profit Businesses': [
    'Large Enterprises',
    'Small/Medium Businesses (SMB)',
    'Hospitality',
  ],
  'Individuals': [
    'Homeowners',
    'Property Owners',
    'Farmers/Ranchers',
    'Renters',
    'Property Managers',
  ],
};

export const STANDALONE_CLIENT_TYPES = [
  'Tribal Governments',
  'Federal Agencies',
  'State Governments',
  'Public Utilities',
  'Private Utilities',
  'Electric Cooperatives',
  'Transportation Authorities',
  'Port Authorities',
  'Airport Authorities',
  'Research Institutions',
  'Libraries',
  'Museums',
  'K-12 School Districts',
];

export const TAXONOMIES = {
  CLIENT_TYPE_SYNONYMS,
  CLIENT_TYPE_HIERARCHY,
  STANDALONE_CLIENT_TYPES,
};

/**
 * Expand a client type via synonyms (horizontal) and hierarchy (vertical).
 * Mirrors lib/constants/taxonomies.js getExpandedClientTypes.
 */
export function getExpandedClientTypes(clientType) {
  const expanded = new Set([clientType]);

  // Step 1: synonyms (horizontal expansion)
  for (const synonymGroup of Object.values(CLIENT_TYPE_SYNONYMS)) {
    if (synonymGroup.some((s) => s.toLowerCase() === clientType.toLowerCase())) {
      synonymGroup.forEach((s) => expanded.add(s));
    }
  }

  // Step 2: hierarchy parents (vertical expansion)
  for (const type of [...expanded]) {
    for (const [parent, children] of Object.entries(CLIENT_TYPE_HIERARCHY)) {
      if (children.some((c) => c.toLowerCase() === type.toLowerCase())) {
        expanded.add(parent);
      }
    }
  }

  return Array.from(expanded);
}
