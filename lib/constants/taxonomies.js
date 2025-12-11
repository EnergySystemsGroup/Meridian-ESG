/**
 * Standardized taxonomies for funding opportunities
 *
 * These taxonomies are used to guide the LLM processing agents toward consistent
 * categorization while still allowing flexibility through "Other: [specific]" values.
 */

export const TAXONOMIES = {
	ELIGIBLE_ACTIVITIES: {
		hot: [
			// Construction & Physical Work - CORE IMPLEMENTATION ACTIVITIES
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
		],

		strong: [
			// Professional Services - SUPPORTING SERVICES
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
		],

		mild: [
			// Equipment & Materials - PROCUREMENT ACTIVITIES
			'Equipment Purchase',
			'Materials Purchase',
			'Supplies Purchase',
			'Vehicle Purchase',
			'Technology Purchase',
			'Software Purchase',

			// Operations & Programs - OPERATIONAL ACTIVITIES
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

			// Land & Property - PROPERTY TRANSACTIONS
			'Land Acquisition',
			'Property Purchase',
			'Right-of-Way Acquisition',
			'Easements',
		],

		weak: [
			// Research & Development - RESEARCH FOCUS
			'Research',
			'Data Collection',
			'Data Analysis',
			'Pilot Programs',
			'Testing',
			'Evaluation',
			'Demonstration Projects',

			// Administrative - OVERHEAD/ADMIN
			'Program Administration',
			'Grant Management',
			'Monitoring',
			'Reporting',
			'Compliance Activities',
			'Permits',
			'Fees',
			'Insurance',
		],
	},

	ELIGIBLE_PROJECT_TYPES: {
		hot: [
			// Building Systems - CORE BUSINESS
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

			// Building Envelope - CORE BUSINESS
			'Roofing',
			'Windows',
			'Doors',
			'Insulation',
			'Exterior Walls',
			'Siding',
			'Foundation Repair',
			'Weatherization',
			'Flooring',

			// Energy Infrastructure - CORE BUSINESS
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
		],

		strong: [
			// Water Infrastructure - IMPORTANT INFRASTRUCTURE
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

			// Technology & Equipment - MODERNIZATION FOCUS
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

			// Educational Infrastructure - KEY CLIENT SECTOR
			'Classrooms',
			'Laboratories',
			'Computer Labs',
			'Cafeterias',
			'Kitchens',
			'Gymnasiums',
			'Media Centers',
			'Vocational Facilities',
			'CTE Facilities',

			// Facilities & Grounds - COMMON PROJECTS
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
		],

		mild: [
			// Transportation Infrastructure - OCCASIONAL
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

			// Public Safety Infrastructure - SPECIALIZED
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

			// Climate Resilience & Adaptation - GROWING BUT SPECIALIZED
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

			// Health & Safety Equipment - SUPPLEMENTAL
			'Personal Protective Equipment',
			'Safety Equipment',
			'Hazmat Equipment',
			'Decontamination Systems',
			'Air Filtration Systems',
			'Ventilation Improvements',
			'Biosafety Equipment',
			'Radiation Detection Equipment',
		],

		weak: [
			// Healthcare Infrastructure - NOT CORE MARKET
			'Medical Equipment',
			'Hospital Facilities',
			'Clinics',
			'Health Centers',
			'Emergency Rooms',
			'Mental Health Facilities',
			'Rehabilitation Centers',
			'Ambulances',
			'Emergency Vehicles',

			// Housing & Shelter - NOT CORE MARKET
			'Affordable Housing Units',
			'Homeless Shelters',
			'Transitional Housing',
			'Senior Housing',
			'Student Housing',

			// Environmental & Conservation - SPECIALIZED
			'Wetland Restoration',
			'Forest Management',
			'Wildlife Habitat',
			'Erosion Control',
			'Brownfield Remediation',
			'Air Quality Monitoring',
			'Recycling Facilities',
			'Composting Systems',

			// Economic Development Infrastructure - TANGENTIAL
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

			// Disaster Preparedness - EMERGENCY ONLY
			'Emergency Shelters',
			'Disaster Response Equipment',
			'Emergency Supplies Storage',
			'Mobile Command Centers',
			'Emergency Communication Systems',
			'Backup Water Systems',
			'Emergency Medical Supplies',
			'Search and Rescue Equipment',
		],
	},

	FUNDING_TYPES: {
		hot: [
			// Direct Funding - MOST VALUABLE
			'Grant',
			'Direct Payment',
			'Voucher',
			'Rebate',
		],

		strong: [
			// Tax Benefits - STRONG VALUE, NO REPAYMENT
			'Tax Credit',
			'Tax Incentive',
			'Tax Deduction',
			'Tax Exemption',
		],

		mild: [
			// Loans & Credit - NEEDS REPAYMENT
			'Loan',
			'Forgivable Loan',
			'Guarantee',
			'Bond',
		],

		weak: [
			// Support Services & Agreements - NON-MONETARY
			'Technical Assistance',
			'In-Kind Support',
			'Cooperative Agreement',
			'Contract',
		],
	},

	ELIGIBLE_APPLICANTS: {
		hot: [
			// Government - PRIMARY CLIENTS
			'Federal Agencies',
			'State Governments',
			'Local Governments',
			'City Government',
			'County Government',
			'Municipal Government',
			'Township Government',
			'Tribal Governments',
			'Special Districts',
			'Public Housing Authorities',

			// Education - CORE CLIENT SECTOR
			'K-12 School Districts',
			'K-12 Schools',
			'Institutions of Higher Education',
			'Colleges',
			'Universities',
			'Community Colleges',
			'Vocational/Technical Schools',
		],

		strong: [
			// Healthcare - STRONG SECTOR
			'Hospitals',
			'Health Centers',
			'Healthcare Facilities',
			'FQHCs',
			'Community Health Centers',

			// Utilities & Authorities - INFRASTRUCTURE FOCUS
			'Public Utilities',
			'Private Utilities',
			'Electric Cooperatives',
			'Transportation Authorities',
			'Port Authorities',
			'Airport Authorities',
		],

		mild: [
			// Organizations - OCCASIONAL CLIENTS
			'Nonprofit Organizations 501(c)(3)',
			'Other Nonprofits',
			'Faith-Based Organizations',
			'Community-Based Organizations',

			// Research & Cultural - SPECIALIZED
			'Research Institutions',
			'Libraries',
			'Museums',

			// Private Sector - BUSINESS CLIENTS
			'Large Enterprises',
			'Small/Medium Businesses (SMB)',
			'Farms and Agricultural Producers',
			'For-Profit Businesses',
			'Hospitality',
		],

		weak: [
			// Individuals - RARELY DIRECT CLIENTS
			'Individuals',
			'Homeowners',
			'Property Owners',
			'Farmers/Ranchers',
			'Renters',
			'Property Managers',
		],
	},

	CATEGORIES: {
		hot: [
			// CORE BUSINESS AREAS
			'Energy',                    // Solar, HVAC efficiency, energy systems
			'Infrastructure',            // Core infrastructure projects
			'Facilities & Buildings',    // Building systems and envelope
			'Education',                 // Primary client sector
			'Sustainability',           // Green building, efficiency
		],

		strong: [
			// IMPORTANT SECONDARY AREAS
			'Water',                    // Water infrastructure
			'Wastewater',              // Wastewater infrastructure
			'Healthcare',              // Healthcare facilities
			'Recreation & Parks',      // Park facilities, recreation centers
			'Climate',                  // Climate resilience, adaptation
			'Transportation',           // Transportation infrastructure
			'Public Safety',           // Emergency systems, safety infrastructure
			'Emergency Services',       // Emergency backup systems
			'Environment',             // Environmental compliance, improvements
		],

		mild: [
			// OCCASIONAL RELEVANCE
			'Community Development',    // Community facilities
			'Economic Development',     // Business infrastructure
			'Workforce Development',   // Training facilities
			'Science & Technology',    // Tech infrastructure, labs
		],

		weak: [
			// LIMITED ALIGNMENT
			'Agriculture',             // Farm infrastructure (less common)
			'Food Systems',           // Food processing facilities
			'Housing',                // Residential (not core)
			'Human Services',         // Social services
			'Arts & Culture',         // Museums, theaters (specialized)
			'Disaster Recovery',      // Emergency response (reactive)
			'Conservation',           // Environmental conservation
		],
	},

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

	// US States with codes for dropdown filtering
	US_STATES: [
		{ code: 'AL', name: 'Alabama' },
		{ code: 'AK', name: 'Alaska' },
		{ code: 'AZ', name: 'Arizona' },
		{ code: 'AR', name: 'Arkansas' },
		{ code: 'CA', name: 'California' },
		{ code: 'CO', name: 'Colorado' },
		{ code: 'CT', name: 'Connecticut' },
		{ code: 'DE', name: 'Delaware' },
		{ code: 'DC', name: 'District of Columbia' },
		{ code: 'FL', name: 'Florida' },
		{ code: 'GA', name: 'Georgia' },
		{ code: 'HI', name: 'Hawaii' },
		{ code: 'ID', name: 'Idaho' },
		{ code: 'IL', name: 'Illinois' },
		{ code: 'IN', name: 'Indiana' },
		{ code: 'IA', name: 'Iowa' },
		{ code: 'KS', name: 'Kansas' },
		{ code: 'KY', name: 'Kentucky' },
		{ code: 'LA', name: 'Louisiana' },
		{ code: 'ME', name: 'Maine' },
		{ code: 'MD', name: 'Maryland' },
		{ code: 'MA', name: 'Massachusetts' },
		{ code: 'MI', name: 'Michigan' },
		{ code: 'MN', name: 'Minnesota' },
		{ code: 'MS', name: 'Mississippi' },
		{ code: 'MO', name: 'Missouri' },
		{ code: 'MT', name: 'Montana' },
		{ code: 'NE', name: 'Nebraska' },
		{ code: 'NV', name: 'Nevada' },
		{ code: 'NH', name: 'New Hampshire' },
		{ code: 'NJ', name: 'New Jersey' },
		{ code: 'NM', name: 'New Mexico' },
		{ code: 'NY', name: 'New York' },
		{ code: 'NC', name: 'North Carolina' },
		{ code: 'ND', name: 'North Dakota' },
		{ code: 'OH', name: 'Ohio' },
		{ code: 'OK', name: 'Oklahoma' },
		{ code: 'OR', name: 'Oregon' },
		{ code: 'PA', name: 'Pennsylvania' },
		{ code: 'RI', name: 'Rhode Island' },
		{ code: 'SC', name: 'South Carolina' },
		{ code: 'SD', name: 'South Dakota' },
		{ code: 'TN', name: 'Tennessee' },
		{ code: 'TX', name: 'Texas' },
		{ code: 'UT', name: 'Utah' },
		{ code: 'VT', name: 'Vermont' },
		{ code: 'VA', name: 'Virginia' },
		{ code: 'WA', name: 'Washington' },
		{ code: 'WV', name: 'West Virginia' },
		{ code: 'WI', name: 'Wisconsin' },
		{ code: 'WY', name: 'Wyoming' },
		{ code: 'PR', name: 'Puerto Rico' },
		{ code: 'VI', name: 'U.S. Virgin Islands' },
		{ code: 'GU', name: 'Guam' },
		{ code: 'AS', name: 'American Samoa' },
		{ code: 'MP', name: 'Northern Mariana Islands' },
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

	/**
	 * Client Type Expansions for Matching
	 *
	 * Maps client types (as stored in DB) to all applicable eligible_applicants
	 * values they should match against. This enables hierarchical matching
	 * without changing how clients or opportunities are stored.
	 *
	 * When a client has type X, they should also match opportunities that list
	 * any of the expanded types as eligible applicants.
	 */
	CLIENT_TYPE_EXPANSIONS: {
		// Education Sector
		'K-12 School Districts': [
			'K-12 School Districts',
			'K-12 Schools',
			'Local Governments', // School districts are local gov entities
			'Special Districts', // Education special districts
			'Nonprofit Organizations 501(c)(3)', // Public schools are tax-exempt
		],
		'K-12 Schools': [
			'K-12 Schools',
			'K-12 School Districts',
			'Nonprofit Organizations 501(c)(3)',
		],
		'Universities': [
			'Universities',
			'Institutions of Higher Education',
			'Colleges',
			'Nonprofit Organizations 501(c)(3)', // Most universities are nonprofits
			'Research Institutions',
		],
		'Community Colleges': [
			'Community Colleges',
			'Institutions of Higher Education',
			'Colleges',
			'Nonprofit Organizations 501(c)(3)',
			'Local Governments', // Often governed by local districts
		],
		'Colleges': [
			'Colleges',
			'Institutions of Higher Education',
			'Nonprofit Organizations 501(c)(3)',
		],

		// Government Sector
		'Municipal Government': [
			'Municipal Government',
			'Local Governments',
			'City Government',
		],
		'County Government': [
			'County Government',
			'Local Governments',
		],
		'City Government': [
			'City Government',
			'Local Governments',
			'Municipal Government',
		],
		'State Government': [
			'State Governments',
			'State Government',
		],

		// Healthcare Sector
		'Healthcare Facilities': [
			'Healthcare Facilities',
			'Hospitals',
			'Health Centers',
			'Nonprofit Organizations 501(c)(3)', // Many are nonprofits
		],
		'Hospitals': [
			'Hospitals',
			'Healthcare Facilities',
			'Health Centers',
			'Nonprofit Organizations 501(c)(3)',
		],

		// Private Sector
		'For-Profit Businesses': [
			'For-Profit Businesses',
			'Large Enterprises',
			'Small/Medium Businesses (SMB)',
		],
		'Small/Medium Businesses (SMB)': [
			'Small/Medium Businesses (SMB)',
			'For-Profit Businesses',
		],
		'Hospitality': [
			'Hospitality',
			'For-Profit Businesses',
			'Small/Medium Businesses (SMB)',
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

	// Check if it's a tiered structure (object with tier keys) or flat array
	const isTiered = taxonomy && typeof taxonomy === 'object' && !Array.isArray(taxonomy);
	
	// Flatten if tiered, use as-is if array
	const flatList = isTiered 
		? Object.values(taxonomy).flat()
		: taxonomy;

	return `For ${fieldName}, you MUST select from these standardized options:
${flatList.join(', ')}

REQUIREMENTS:
- Select ALL applicable options (multiple selections encouraged)
- Choose the closest match for edge cases - NO exceptions
- Be exhaustive - don't miss relevant options
- Map creatively to find best fits within the taxonomy
- NO "Other" values allowed - work within the provided taxonomy`;
}

/**
 * Generate clear instructions for location eligibility formatting
 * @returns {string} Formatted instruction for the eligible_locations field
 */
export function generateLocationEligibilityInstruction() {
	return `
For ELIGIBLE_LOCATIONS, extract ONLY the MOST SPECIFIC geographic boundary mentioned for eligibility.

CRITICAL RULE: Extract the SMALLEST geographic area mentioned. Do NOT include parent regions.
- If a utility is specified → Extract ONLY the utility (not the state/county it's in)
- If a county is specified → Extract ONLY the county (not the state it's in)
- If multiple SAME-LEVEL areas are mentioned → Extract all of them
- If both specific AND general areas are mentioned → Extract ONLY the most specific

SPECIFICITY HIERARCHY (most specific to least specific):
1. Utility territories → "PG&E service territory", "SMUD territory", "SDG&E service area"
2. Counties → "Los Angeles County", "Sacramento County", "Marin County"
3. Cities/Municipalities → "City of San Francisco", "Sacramento", "Los Angeles"
4. States → "California", "New York", "Texas"
5. Regions → "Western states", "Northeast region"
6. National → "National", "Nationwide", "All U.S. states"

EXTRACTION GUIDELINES:
- Extract EXACT location phrases as they appear in the source
- Use standardized naming formats:
  * Utilities: "[Utility Name] service territory" or "[Utility Name] service area"
  * Counties: "[Name] County" (e.g., "Los Angeles County")
  * States: Full state name, not abbreviations (e.g., "California" not "CA")
  * Cities: "City of [Name]" or "[Name]" as written in source
  * National: "National"

EXTRACTION EXAMPLES:
✓ "Available in PG&E service area" → ["PG&E service territory"]
✓ "Los Angeles County residents" → ["Los Angeles County"]
✓ "SMUD customers only" → ["SMUD territory"]
✓ "Statewide California program" → ["California"]
✓ "San Diego Gas & Electric territory" → ["SDG&E service area"]
✓ "Bay Area counties: Alameda, Contra Costa, Marin" → ["Alameda County", "Contra Costa County", "Marin County"]
✓ "Nationwide eligibility" → ["National"]
✓ "Southern California Edison and SDG&E customers" → ["SCE service territory", "SDG&E service area"]
✓ "California, Oregon, and Washington" → ["California", "Oregon", "Washington"]
✓ "PG&E customers in Northern California" → ["PG&E service territory"]
✓ "Sacramento and Placer counties" → ["Sacramento County", "Placer County"]

INCORRECT EXAMPLES (what NOT to do):
✗ "PG&E service area" → ["PG&E service territory", "California"] - NO! Extract ONLY "PG&E service territory"
✗ "Los Angeles County" → ["Los Angeles County", "California"] - NO! Extract ONLY "Los Angeles County"
✗ "SMUD territory" → ["SMUD territory", "Sacramento County"] - NO! Extract ONLY "SMUD territory"

KEY PRINCIPLE:
Extract the MOST SPECIFIC boundary only. The matching system will handle geographic hierarchies on the client side.`;
}

export default TAXONOMIES;
