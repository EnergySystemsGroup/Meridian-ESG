/**
 * Standardized taxonomies for funding opportunities
 *
 * These taxonomies are used to guide the LLM processing agents toward consistent
 * categorization while still allowing flexibility through "Other: [specific]" values.
 */

export const TAXONOMIES = {
	// Target client types - our preferred/core clients
	TARGET_CLIENT_TYPES: [
		'K-12 School Districts',
		'Municipal Government',
		'City Government',
		'County Government',
		'Colleges & Universities'
	],

	// Target project types - our preferred/core project focus areas
	TARGET_PROJECT_TYPES: [
		'HVAC Systems',
		'Lighting Systems',
		'Solar Installation',
		'Building Envelope',
		'Infrastructure Improvements',
	],

	// Preferred activities - activities that align with our expertise
	PREFERRED_ACTIVITIES: [
		// Construction & Physical Work (your core business)
		'Installation',
		'Replacement',
		'Upgrade',
		'Renovation',
		'Modernization',
		'Retrofit',
		'New Construction',
		'Repair',
		'Maintenance',

		// Professional Services (you also do these)
		'Design',
		'Engineering',
		'Project Management',
		'Inspection',

		// Equipment & Materials (you handle purchasing)
		'Equipment Purchase',
		'Materials Purchase',
	],

	PREFERRED_PROJECT_TYPES: [
		// Building Systems (your wheelhouse)
		'HVAC Systems',
		'Lighting Systems',
		'Electrical Systems',
		'Building Automation Systems',
		'Energy Management Systems',

		// Building Envelope (also your wheelhouse)
		'Roofing',
		'Windows',
		'Doors',
		'Insulation',
		'Weatherization',

		// Energy Infrastructure (your focus)
		'Solar Panels',
		'Solar Arrays',
		'Battery Storage Systems',
		'EV Charging Stations',
		'Microgrids',

		// Water Infrastructure (expanding capabilities)
		'Water Storage Tanks',
	],

	ELIGIBLE_ACTIVITIES: [
		// Construction & Physical Work
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

		// Professional Services
		'Design',
		'Architecture',
		'Engineering',
		'Planning',
		'Feasibility Studies',
		'Environmental Assessment',
		'Consulting Services',
		'Project Management',
		'Legal Services',
		'Inspection',
		'Testing',

		// Equipment & Materials
		'Equipment Purchase',
		'Materials Purchase',
		'Supplies Purchase',
		'Vehicle Purchase',
		'Technology Purchase',
		'Software Purchase',

		// Research & Development
		'Research',
		'Data Collection',
		'Data Analysis',
		'Pilot Programs',
		'Testing',
		'Evaluation',
		'Demonstration Projects',

		// Operations & Programs
		'Program Operations',
		'Service Delivery',
		'Staffing',
		'Personnel',
		'Training',
		'Education',
		'Technical Assistance',
		'Capacity Building',
		'Community Outreach',
		'Marketing',
		'Communications',

		// Administrative
		'Program Administration',
		'Grant Management',
		'Monitoring',
		'Reporting',
		'Compliance Activities',
		'Permits',
		'Fees',
		'Insurance',

		// Land & Property
		'Land Acquisition',
		'Property Purchase',
		'Right-of-Way Acquisition',
		'Easements',
	],

	ELIGIBLE_PROJECT_TYPES: [
		// Building Systems
		'HVAC Systems',
		'Lighting Systems',
		'Plumbing Systems',
		'Electrical Systems',
		'Fire Suppression Systems',
		'Elevators',
		'Lifts',
		'Security Systems',
		'Communication Systems',
		'Building Automation Systems',
		'Refrigeration Systems',

		// Building Envelope
		'Roofing',
		'Windows',
		'Doors',
		'Insulation',
		'Exterior Walls',
		'Siding',
		'Foundation Repair',
		'Weatherization',
		'Flooring',

		// Energy Infrastructure
		'Solar Panels',
		'Solar Arrays',
		'Wind Turbines',
		'Battery Storage Systems',
		'EV Charging Stations',
		'Geothermal Systems',
		'Energy Management Systems',
		'Microgrids',
		'Fuel Cells',
		'Cogeneration Systems',

		// Water Infrastructure
		'Water Treatment Plants',
		'Wastewater Treatment Plants',
		'Water Distribution Systems',
		'Sewer Systems',
		'Stormwater Management Systems',
		'Water Storage Tanks',
		'Water Reservoirs',
		'Irrigation Systems',
		'Water Meters',
		'Pump Stations',
		'Fire Hydrants',

		// Transportation Infrastructure
		'Roads',
		'Streets',
		'Bridges',
		'Sidewalks',
		'Walkways',
		'Bike Lanes',
		'Bike Paths',
		'Parking Lots',
		'Parking Structures',
		'Traffic Signals',
		'Street Lighting',
		'Bus Stops',
		'Bus Shelters',
		'Rail Infrastructure',
		'Ports',
		'Harbors',
		'Airports',
		'Runways',
		'Pedestrian Crossings',
		'Fleet Vehicles',

		// Facilities & Grounds
		'Playgrounds',
		'Athletic Fields',
		'Athletic Courts',
		'Parks',
		'Green Spaces',
		'Community Centers',
		'Libraries',
		'Museums',
		'Theaters',
		'Auditoriums',
		'Fencing',
		'Gates',
		'Landscaping',
		'Pavilions',
		'Shelters',

		// Educational Infrastructure
		'Classrooms',
		'Laboratories',
		'Computer Labs',
		'Cafeterias',
		'Kitchens',
		'Gymnasiums',
		'Media Centers',
		'Vocational Facilities',
		'CTE Facilities',

		// Healthcare Infrastructure
		'Medical Equipment',
		'Hospital Facilities',
		'Clinics',
		'Health Centers',
		'Emergency Rooms',
		'Mental Health Facilities',
		'Rehabilitation Centers',
		'Ambulances',
		'Emergency Vehicles',

		// Public Safety Infrastructure
		'Fire Stations',
		'Police Stations',
		'Emergency Operations Centers',
		'911 Centers',
		'Dispatch Centers',
		'Correctional Facilities',
		'Security Cameras',
		'Surveillance Systems',
		'Emergency Alert Systems',
		'Fire Trucks',
		'Fire Equipment',

		// Technology & Equipment
		'IT Infrastructure',
		'Networks',
		'Data Centers',
		'Telecommunications Equipment',
		'Broadband Infrastructure',
		'Computers',
		'Tablets',
		'Software Systems',
		'Laboratory Equipment',
		'Kitchen Equipment',
		'Office Equipment',
		'Manufacturing Equipment',
		'Agricultural Equipment',

		// Housing & Shelter
		'Affordable Housing Units',
		'Homeless Shelters',
		'Transitional Housing',
		'Senior Housing',
		'Student Housing',

		// Environmental & Conservation
		'Wetland Restoration',
		'Forest Management',
		'Wildlife Habitat',
		'Erosion Control',
		'Brownfield Remediation',
		'Air Quality Monitoring',
		'Recycling Facilities',
		'Composting Systems',

		// Climate Resilience & Adaptation
		'Flood Barriers',
		'Seawalls',
		'Levees',
		'Storm Surge Protection',
		'Cooling Centers',
		'Warming Centers',
		'Drought Mitigation Systems',
		'Wildfire Prevention Infrastructure',
		'Emergency Backup Power Systems',
		'Climate Monitoring Equipment',
		'Green Infrastructure',
		'Urban Heat Island Mitigation',

		// Economic Development Infrastructure
		'Business Incubators',
		'Co-working Spaces',
		'Industrial Parks',
		'Commercial Kitchens',
		'Food Banks',
		'Food Processing Facilities',
		'Farmers Markets',
		'Workforce Development Centers',
		'Job Training Facilities',
		'Conference Centers',
		'Tourism Infrastructure',

		// Health & Safety Equipment
		'Personal Protective Equipment',
		'Safety Equipment',
		'Hazmat Equipment',
		'Decontamination Systems',
		'Air Filtration Systems',
		'Ventilation Improvements',
		'Biosafety Equipment',
		'Radiation Detection Equipment',

		// Disaster Preparedness
		'Emergency Shelters',
		'Disaster Response Equipment',
		'Emergency Supplies Storage',
		'Mobile Command Centers',
		'Emergency Communication Systems',
		'Backup Water Systems',
		'Emergency Medical Supplies',
		'Search and Rescue Equipment',
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
		'K-12 School Districts',
		'Colleges & Universities', 
		'City Government',
		'County Government',
		'State Agencies',
		'Municipal Government',
		'Special Districts',
		'Tribal Nations',
		'Nonprofit Organizations',
		'For-profit Businesses',
		'Small Businesses',
		'Medium Businesses',
		'Large Businesses',
		'Housing Authorities',
		'Healthcare Facilities',
		'Public Utilities',
		'Private Utilities',
		'Religious Organizations',
		'Community Organizations',
		'Research Institutions',
		'Libraries',
		'Museums',
		'Agricultural Organizations',
		'Transportation Authorities',
		'Port Authorities',
		'Airport Authorities',
		'Individuals',
		'Homeowners',
		'Renters',
		'Property Managers',
	],

	CATEGORIES: [
		'Agriculture',
		'Arts & Culture',
		'Climate',
		'Community Development',
		'Conservation',
		'Disaster Recovery',
		'Economic Development',
		'Education',
		'Emergency Services',
		'Energy',
		'Environment',
		'Facilities & Buildings',
		'Food Systems',
		'Healthcare',
		'Housing',
		'Human Services',
		'Infrastructure',
		'Public Safety',
		'Recreation & Parks',
		'Science & Technology',
		'Sustainability',
		'Transportation',
		'Water',
		'Wastewater',
		'Workforce Development',
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
	)} doesn't fit these categories, you must use "Other: [descriptive category]" where [descriptive category] is your best judgment of how to categorize it. For example, if the source mentions "paving roads", use "Other: Road Infrastructure".`;
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
