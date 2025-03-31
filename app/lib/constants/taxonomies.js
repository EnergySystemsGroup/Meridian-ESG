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
		// Location types rather than specific locations
		'National',
		'State-specific',
		'County-specific',
		'City/Municipal',
		'Rural',
		'Urban',
		'Tribal Lands',
		'Underserved Communities',
		'Opportunity Zones',
		'Specific Geographic Features',
	],
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

export default TAXONOMIES;
