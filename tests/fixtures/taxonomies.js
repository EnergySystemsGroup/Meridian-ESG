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
  'Installation',
  'Replacement',
  'Upgrade',
  'Repair',
  'Retrofit',
  'Energy Audits',
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

export const CLIENT_TYPE_CROSS_CATEGORIES = {
  'Colleges': ['Nonprofit Organizations 501(c)(3)'],
  'Universities': ['Nonprofit Organizations 501(c)(3)'],
  'Community Colleges': ['Nonprofit Organizations 501(c)(3)', 'Local Governments'],
  'Technical Colleges': ['Nonprofit Organizations 501(c)(3)'],
  'K-12 School Districts': ['Local Governments', 'Special Districts'],
  'K-12 Schools': ['Local Governments'],
  'Hospitals': ['Nonprofit Organizations 501(c)(3)'],
  'Health Centers': ['Nonprofit Organizations 501(c)(3)'],
  'FQHCs': ['Nonprofit Organizations 501(c)(3)'],
  'Community Health Centers': ['Nonprofit Organizations 501(c)(3)'],
  'Libraries': ['Local Governments', 'Nonprofit Organizations 501(c)(3)'],
  'Museums': ['Nonprofit Organizations 501(c)(3)'],
  'Research Institutions': ['Nonprofit Organizations 501(c)(3)'],
  'Electric Cooperatives': ['Nonprofit Organizations 501(c)(3)'],
};

export const PROJECT_TYPE_HIERARCHY = {
  'HVAC Systems': ['Heat Pump Systems', 'Boiler Systems', 'Chiller Systems', 'Building Air Filtration Systems'],
  'Lighting Systems': ['LED Lighting Upgrades', 'Street Lighting'],
  'Electrical Systems': ['EV Charging Stations', 'Electrical Panel Upgrades'],
  'Landscaping': ['Landscape Irrigation Systems'],
  'Drinking Water Infrastructure': ['Water Metering Systems', 'Water Storage Tanks'],
  'Wastewater Infrastructure': ['Sewer Systems'],
  'Heat Resilience Infrastructure': ['Cooling Centers'],
};

export const TAXONOMIES = {
  CLIENT_TYPE_SYNONYMS,
  CLIENT_TYPE_HIERARCHY,
  CLIENT_TYPE_CROSS_CATEGORIES,
  STANDALONE_CLIENT_TYPES,
  PROJECT_TYPE_HIERARCHY,
};

/**
 * Expand a client type via synonyms (horizontal), hierarchy (vertical),
 * and cross-categories (lateral).
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

  // Step 3: cross-category expansions (lateral expansion)
  for (const type of [...expanded]) {
    const crossCategories = CLIENT_TYPE_CROSS_CATEGORIES[type];
    if (crossCategories) {
      crossCategories.forEach((cat) => expanded.add(cat));
    }
  }

  return Array.from(expanded);
}

/**
 * Expand a project type via hierarchy (downward only).
 * Mirrors lib/constants/taxonomies.js getExpandedProjectTypes.
 */
export function getExpandedProjectTypes(projectNeed) {
  const expanded = new Set([projectNeed]);
  const children = PROJECT_TYPE_HIERARCHY[projectNeed];
  if (children) {
    children.forEach((child) => expanded.add(child));
  }
  return Array.from(expanded);
}
