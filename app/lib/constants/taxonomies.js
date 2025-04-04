/**
 * Standardized taxonomies for funding opportunities
 *
 * These taxonomies are used to guide the LLM processing agents toward consistent
 * categorization while still allowing flexibility through "Other: [specific]" values.
 */

export const TAXONOMIES = {
	ELIGIBLE_PROJECT_TYPES: [
		// From client-matching documentation
		'Building Envelope',
		'HVAC Systems',
		'Lighting',
		'Roofing',
		'Flooring',
		'Windows',
		'Solar/Renewable Energy',
		'Energy Management Systems',
		'Water Conservation',
		'Electrical Systems',
		'Plumbing',
		'Security Systems',
		'ADA Compliance',
		'Asbestos/Lead Abatement',
		'Technology Infrastructure',
		'Outdoor Facilities',
	],

	FUNDING_TYPES: [
		'Grant',
		'Loan',
		'Rebate',
		'Tax Credit',
		'Tax Incentive',
		'Technical Assistance',
		'Bond',
		'Guarantee',
		'Direct Payment',
		'Cooperative Agreement',
	],

	ELIGIBLE_APPLICANTS: [
		'K-12 Schools',
		'Higher Education',
		'State Agencies',
		'Local Government',
		'County Government',
		'Municipal Government',
		'Tribal Nations',
		'Nonprofit Organizations',
		'For-profit Businesses',
		'Small Businesses',
		'Housing Authorities',
		'Healthcare Facilities',
		'Public Utilities',
		'Individuals',
	],

	CATEGORIES: [
		'Energy Efficiency',
		'Renewable Energy',
		'Water Conservation',
		'Sustainability',
		'Infrastructure',
		'Transportation',
		'Facility Improvements',
		'Education',
		'Environmental',
		'Community Development',
		'Health & Safety',
		'Planning & Assessment',
		'Research & Development',
		'Economic Development',
		'Disaster Recovery',
	],

	ELIGIBLE_LOCATIONS: [
		// Primary location designations
		'National', // For opportunities available across all states
		'Regional', // For multi-state regions (specify which in the format below)

		// All U.S. States and Territories (use exact names for database matching)
		'Alabama',
		'Alaska',
		'Arizona',
		'Arkansas',
		'California',
		'Colorado',
		'Connecticut',
		'Delaware',
		'Florida',
		'Georgia',
		'Hawaii',
		'Idaho',
		'Illinois',
		'Indiana',
		'Iowa',
		'Kansas',
		'Kentucky',
		'Louisiana',
		'Maine',
		'Maryland',
		'Massachusetts',
		'Michigan',
		'Minnesota',
		'Mississippi',
		'Missouri',
		'Montana',
		'Nebraska',
		'Nevada',
		'New Hampshire',
		'New Jersey',
		'New Mexico',
		'New York',
		'North Carolina',
		'North Dakota',
		'Ohio',
		'Oklahoma',
		'Oregon',
		'Pennsylvania',
		'Rhode Island',
		'South Carolina',
		'South Dakota',
		'Tennessee',
		'Texas',
		'Utah',
		'Vermont',
		'Virginia',
		'Washington',
		'West Virginia',
		'Wisconsin',
		'Wyoming',
		'District of Columbia',
		'Puerto Rico',
		'U.S. Virgin Islands',
		'Guam',
		'American Samoa',
		'Northern Mariana Islands',

		// Other location designations (to be used in addition to specific states)
		'Tribal Lands',
		'Rural Communities',
		'Urban Areas',
		'Underserved Communities',
		'Opportunity Zones',
	],

	// Standardized U.S. regions for processing regional designations
	US_REGIONS: {
		Northeast: [
			'Maine',
			'New Hampshire',
			'Vermont',
			'Massachusetts',
			'Rhode Island',
			'Connecticut',
			'New York',
			'New Jersey',
			'Pennsylvania',
		],
		Southeast: [
			'Virginia',
			'North Carolina',
			'South Carolina',
			'Georgia',
			'Florida',
			'Alabama',
			'Mississippi',
			'Tennessee',
			'Kentucky',
			'West Virginia',
		],
		Midwest: [
			'Ohio',
			'Michigan',
			'Indiana',
			'Illinois',
			'Wisconsin',
			'Minnesota',
			'Iowa',
			'Missouri',
			'North Dakota',
			'South Dakota',
			'Nebraska',
			'Kansas',
		],
		Southwest: ['Texas', 'Oklahoma', 'New Mexico', 'Arizona'],
		West: [
			'Colorado',
			'Wyoming',
			'Montana',
			'Idaho',
			'Washington',
			'Oregon',
			'Nevada',
			'California',
			'Alaska',
			'Hawaii',
		],
	},
};

/**
 * Format a taxonomy list as a string for inclusion in prompts
 * @param {string[]} taxonomyList - The taxonomy list to format
 * @returns {string} Formatted taxonomy string
 */
export function formatTaxonomyForPrompt(taxonomyList) {
	return taxonomyList.join(', ');
}

/**
 * Generate a standard instruction for using a taxonomy in prompts
 * @param {string} taxonomyName - The name of the taxonomy (e.g., "ELIGIBLE_PROJECT_TYPES")
 * @param {string} fieldName - The field name to use in the instruction
 * @returns {string} Formatted instruction string
 */
export function generateTaxonomyInstruction(taxonomyName, fieldName) {
	const taxonomy = TAXONOMIES[taxonomyName];
	if (!taxonomy) return '';

	return `When categorizing ${fieldName}, please use the following standard options whenever possible:
${taxonomy.join(', ')}

If a ${fieldName.replace(
		/s$/,
		''
	)} doesn't fit these categories, you must use "Other: [specific detail]"`;
}

/**
 * Generate clear instructions for location eligibility formatting
 * @returns {string} Formatted instruction for the eligible_locations field
 */
export function generateLocationEligibilityInstruction() {
	return `
When specifying ELIGIBLE_LOCATIONS, follow these strict guidelines:

1. If the opportunity is available nationwide, include ONLY "National" in the list.

2. If the opportunity is available in specific states, list the full name of each eligible state:
   - Examples: "California", "New York", "Texas"
   - Always use the full state name, not abbreviations

3. If the opportunity is available in a region, you can include both:
   - The individual states in that region
   - Common regional terms may include: Northeast, Southeast, Midwest, Southwest, West, etc.

4. Other designations like "Tribal Lands" or "Rural Communities" should be included when applicable.

IMPORTANT: The eligible_locations field MUST always include specific state names or "National", as this is critical for matching opportunities to users in different geographic areas.`;
}

export default TAXONOMIES;
