/**
 * Standardized taxonomies for funding opportunities
 *
 * These taxonomies are used to guide the LLM processing agents toward consistent
 * categorization while still allowing flexibility through "Other: [specific]" values.
 */

export const TAXONOMIES = {
	ELIGIBLE_ACTIVITIES: {
		hot: [
			// Construction & Physical Work - CORE REVENUE ACTIVITIES (drives matching)
			'New Construction',
			'Renovation',
			'Modernization',
			'Installation',
			'Replacement',
			'Upgrade',
			'Repair',
			'Retrofit', // Common ESCO term — DOE weatherization retrofits, energy efficiency retrofits
			'Energy Audits', // Gateway to ESCO contracts — distinct from Feasibility Studies
		],

		strong: [
			// Supporting Construction Activities
			'Site Preparation',
			'Maintenance',
			'Demolition',
			'Removal',

			// Professional Services
			'Design',
			'Architecture',
			'Engineering',
			'Planning',
			'Feasibility Studies',
			'Environmental Assessment',
			'Consulting Services',
			'Project Management',
		],

		mild: [
			// Inspection & Testing
			'Inspection',
			'Testing',

			// Procurement — consolidated into single term
			'Equipment Purchase', // Covers materials, vehicles, technology, software, supplies
		],

		weak: [
			// Operations & Programs — utility/client may use these
			'Program Operations',
			'Service Delivery',
			'Staffing',
			'Training',
			'Technical Assistance',
			'Community Outreach',
			'Marketing',

			// Research
			'Research',
			'Pilot Programs',

			// Administrative
			'Program Administration',
			'Reporting',
			'Permits',
			'Fees',
			'Insurance',
			'Legal Services',

			// Property Transactions
			'Land Acquisition', // Consolidates Property Purchase, Right-of-Way, Easements
		],
	},

	ELIGIBLE_PROJECT_TYPES: {
		hot: [
			// Building Systems - CORE BUSINESS
			'HVAC Systems', // Parent: includes Heat Pump Systems, Boiler Systems, Chiller Systems, Building Air Filtration Systems
			'Heat Pump Systems', // HVAC sub — IRA 25C rebates, DOE deployment, utility incentives
			'Building Air Filtration Systems', // HVAC sub — building HVAC filtration, NOT industrial/CDC. Post-COVID relevance.
			'Lighting Systems', // Parent: includes LED Lighting Upgrades, Street Lighting
			'LED Lighting Upgrades', // Lighting sub — utility per-fixture rebates, DOE Better Buildings, 179D
			'Plumbing Systems',
			'Electrical Systems', // Parent: includes EV Charging Stations, Electrical Panel Upgrades
			'EV Charging Stations', // Electrical sub — NEVI, utility make-ready, IRA 30C
			'Electrical Panel Upgrades', // Electrical sub — IRA electrification, state panel upgrade programs
			'Security Systems', // Access control, intrusion detection, surveillance
			'Building Controls', // Thermostats, DDC, BAS/BMS, pneumatic-to-digital conversions
			'Refrigeration Systems',
			'Water Heater Systems', // Heat pump water heaters — major electrification measure

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
			'Solar Panel Systems', // Consolidates Solar Panels + Solar Arrays
			'Wind Turbines',
			'Battery Storage Systems',
			'Geothermal Systems',
			'Microgrids',
			'Fuel Cells',
		],

		strong: [
			// Water Infrastructure
			'Drinking Water Infrastructure', // Municipal/facility water treatment, distribution, piping. NOT dams/reservoirs/heavy civil.
			'Water Metering Systems', // Drinking Water sub — smart meters, AMI deployments
			'Water Storage Tanks', // Drinking Water sub — specifically funded in capital improvement programs
			'Wastewater Infrastructure', // Wastewater treatment + collection systems
			'Sewer Systems', // Wastewater sub — sewer line replacement/rehabilitation
			'Stormwater Infrastructure', // Detention basins, piping, bioswales

			// Technology & Infrastructure
			'Data Centers', // GCs build data center facilities (power, cooling, raised floors)
			'Intercom Systems', // Building intercoms, PA, nurse call, clock/bell systems
			'Cogeneration Systems', // CHP — hospitals, universities, large municipal. Niche but real.
			'Fire Suppression Systems', // Sprinklers, fire alarm systems
			'Elevators', // Elevator modernization
			'Lifts', // Wheelchair/platform lifts
			'Boiler Systems', // HVAC sub — DOE heating equipment programs, state replacement grants
			'Chiller Systems', // HVAC sub — DOE chiller replacement, utility optimization rebates
			'Street Lighting', // Lighting sub — LED street lighting conversions
			'Emergency Backup Power Systems', // Generators, UPS, ATS — alongside Battery Storage in energy

			// Facility Types
			'Classroom Facilities', // Generic school facility catch-all (covers labs, media centers, auditoriums)
			'Kitchen Facilities', // CDE kitchen infrastructure grants — own funding lane
			'Gymnasium Facilities', // School bond measures
			'Community Center Facilities', // CDBG, state community development
			'Library Facilities', // State library construction grants, bond measures
			'Healthcare Facilities', // Consolidates hospitals, clinics, health centers
			'Student Housing', // Dorm construction — higher ed core client
			'ADA Accessibility Improvements', // Ramps, restrooms, door automation — federal/state ADA compliance

			// Grounds & Site Work
			'Playgrounds',
			'Athletic Fields', // Turf, grading, drainage, lighting
			'Athletic Courts',
			'Perimeter Fencing', // School security fencing, CDBG facility fencing. Consolidates Fencing + Gates.
			'Shade Structures', // School/park shade canopies, outdoor covers. Heat resilience funding.
			'Landscaping', // Parent: includes Landscape Irrigation Systems
			'Landscape Irrigation Systems', // Landscaping sub — sprinkler zones, drip lines. Facility landscape ONLY, not agricultural.

			// Environmental Remediation
			'Asbestos Abatement', // EPA programs, state school facility programs. Prerequisite to renovation.
			'Lead Paint Remediation', // EPA/HUD dedicated programs for schools and public housing
		],

		mild: [
			// Transportation
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
			'Bus Stops',
			'Bus Shelters',
			'Rail Infrastructure',
			'Pedestrian Crossings',
			'Fleet Vehicles',
			'Airports', // Terminal/hangar facility work
			'EV Fleet', // Tangential — school bus/municipal fleet electrification leads to GC depot work

			// Public Safety
			'Fire Stations',
			'Police Stations',
			'Emergency Operations Centers',
			'911 Centers',
			'Dispatch Centers',
			'Correctional Facilities',

			// Climate Resilience
			'Flood Barriers',
			'Heat Resilience Infrastructure', // Parent: cool roofs, splash pads, cool pavements, misting. NOT planning studies.
			'Cooling Centers', // Heat Resilience sub — specifically funded as standalone facilities
			'Warming Centers', // Cold resilience — standalone
			'Urban Greening', // Green roofs, urban tree canopy, tree planting. NOT rural forestry/wetland/habitat.
			'Recreational Park Facilities', // Local/neighborhood park construction. NOT state/regional land acquisition or conservation.

			// Technology
			'Building IT Infrastructure', // Cable, racks, server rooms. NOT cloud/SaaS/data analytics.
			'Fire Hydrants', // Municipal water — cities may need specific funding
		],

		weak: [
			// Tangential but tracked
			'Kitchen Equipment', // Commercial kitchen projects
			'Brownfield Remediation', // EPA brownfield grants — door-opener to construction on cleaned sites
			'Industrial Parks', // Site development
			'Ports', // Heavy civil but GC-adjacent
			'Harbors', // Same as Ports
			'Fire Trucks', // Vehicle procurement — door-opener for fire station work
			'Ambulances', // Vehicle procurement — door-opener for healthcare/emergency facility work
		],
	},

	/**
	 * Project type parent-child hierarchy for matching expansion.
	 *
	 * One-way DOWNWARD expansion only:
	 * - Selecting "HVAC Systems" also matches Heat Pump Systems, Boiler Systems, etc.
	 * - Selecting "Heat Pump Systems" matches ONLY Heat Pump Systems (no upward expansion).
	 *
	 * Modeled after CLIENT_TYPE_HIERARCHY but simpler (no synonyms or cross-categories).
	 */
	PROJECT_TYPE_HIERARCHY: {
		'HVAC Systems': ['Heat Pump Systems', 'Boiler Systems', 'Chiller Systems', 'Building Air Filtration Systems'],
		'Lighting Systems': ['LED Lighting Upgrades', 'Street Lighting'],
		'Electrical Systems': ['EV Charging Stations', 'Electrical Panel Upgrades'],
		'Landscaping': ['Landscape Irrigation Systems'],
		'Drinking Water Infrastructure': ['Water Metering Systems', 'Water Storage Tanks'],
		'Wastewater Infrastructure': ['Sewer Systems'],
		'Heat Resilience Infrastructure': ['Cooling Centers'],
	},

	FUNDING_TYPES: {
		hot: [
			// Direct Funding - MOST VALUABLE
			'Grant',
			'Direct Payment',
		],

		strong: [
			// Upfront value or near-grant mechanisms - STRONG VALUE, NO REPAYMENT
			'Tax Credit',
			'Tax Incentive',
			'Tax Deduction',
			'Tax Exemption',
			'Voucher',
			'Cooperative Agreement',
		],

		mild: [
			// Loans, credit & delayed-value mechanisms - NEEDS REPAYMENT OR DELAYED
			'Loan',
			'Forgivable Loan',
			'Guarantee',
			'Bond',
			'Incentive',
		],

		weak: [
			// Support Services - NON-MONETARY
			'Technical Assistance',
			'In-Kind Support',
			'Contract',
		],
	},

	ELIGIBLE_APPLICANTS: {
		hot: [
			// Government - PRIMARY CLIENTS
			'Federal Agencies',
			'State Governments',
			'Local Governments',
			'Public Agencies',
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
			'Technical Colleges',
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
			'Education',               // Education sector (client relevance captured via ELIGIBLE_APPLICANTS)
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
	 * Client Type Hierarchy for Matching
	 *
	 * Parent-child hierarchy where:
	 * - Child type selected → matches opportunities with child OR parent
	 * - Parent type selected → matches only that parent
	 *
	 * This enables one-way expansion (child → parent) for precise matching.
	 */
	CLIENT_TYPE_HIERARCHY: {
		'Local Governments': [
			'City Government',
			'County Government',
			'Municipal Government',
			'Township Government',
			'Special Districts',
			'Public Housing Authorities',
		],
		// Public Agencies is a cross-cutting umbrella for all government types
		// Types can have multiple parents - expansion logic handles this
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
		// K-12 removed from hierarchy - now handled via synonyms
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
	},

	/**
	 * Synonym groups for client types.
	 * Types within the same group are interchangeable for matching purposes.
	 * Horizontal expansion: if client has one type, they match opportunities with any synonym.
	 */
	CLIENT_TYPE_SYNONYMS: {
		// City, Municipal, and Township governments are interchangeable
		city_municipal: ['City Government', 'Municipal Government', 'Township Government'],
		// Colleges and Universities are interchangeable
		colleges_universities: ['Colleges', 'Universities'],
		// Community Colleges and Technical Colleges are interchangeable
		community_technical: ['Community Colleges', 'Technical Colleges'],
		// K-12 terms are interchangeable (no parent hierarchy needed)
		k12: ['K-12 School Districts', 'K-12 Schools'],
		// Healthcare facility types are interchangeable
		healthcare: ['Hospitals', 'Health Centers', 'FQHCs', 'Community Health Centers'],
	},

	/**
	 * Standalone client types with no parent hierarchy.
	 * These types only match themselves.
	 */
	STANDALONE_CLIENT_TYPES: [
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
		'K-12 School Districts', // No longer in hierarchy, now a standalone with synonym
	],

	/**
	 * Cross-category expansions for client types.
	 * These represent real-world overlaps where an entity qualifies under
	 * multiple unrelated categories (e.g., a college is also a nonprofit).
	 * Lateral expansion: added on top of hierarchy (vertical) and synonyms (horizontal).
	 */
	CLIENT_TYPE_CROSS_CATEGORIES: {
		// Higher education institutions are generally tax-exempt nonprofits
		'Colleges': ['Nonprofit Organizations 501(c)(3)'],
		'Universities': ['Nonprofit Organizations 501(c)(3)'],
		'Community Colleges': ['Nonprofit Organizations 501(c)(3)', 'Local Governments'],
		'Technical Colleges': ['Nonprofit Organizations 501(c)(3)'],
		// K-12 school districts are local government special-purpose districts
		'K-12 School Districts': ['Local Governments', 'Special Districts'],
		'K-12 Schools': ['Local Governments'],
		// Healthcare facilities are commonly nonprofits
		'Hospitals': ['Nonprofit Organizations 501(c)(3)'],
		'Health Centers': ['Nonprofit Organizations 501(c)(3)'],
		'FQHCs': ['Nonprofit Organizations 501(c)(3)'],
		'Community Health Centers': ['Nonprofit Organizations 501(c)(3)'],
		// Public libraries are local government entities; many are also nonprofits
		'Libraries': ['Local Governments', 'Nonprofit Organizations 501(c)(3)'],
		// Museums are commonly nonprofits
		'Museums': ['Nonprofit Organizations 501(c)(3)'],
		// Research institutions are commonly nonprofits
		'Research Institutions': ['Nonprofit Organizations 501(c)(3)'],
		// Rural electric cooperatives are member-owned nonprofits
		'Electric Cooperatives': ['Nonprofit Organizations 501(c)(3)'],
	},

	/**
	 * Parent types that should still be selectable in UI (exceptions).
	 * These are core client types that users should be able to select directly.
	 */
	SELECTABLE_PARENT_TYPES: [], // K-12 moved to STANDALONE with synonym expansion
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

/**
 * Get expanded client types for matching (synonyms + hierarchy + cross-category)
 *
 * Expansion order:
 * 1. Add self
 * 2. Add all synonyms from the same synonym group (horizontal expansion)
 * 3. Add parent from hierarchy if applicable (vertical expansion)
 * 4. Add cross-category types if applicable (lateral expansion)
 *
 * Example: "Colleges" expands to:
 * ["Colleges", "Universities", "Institutions of Higher Education", "Nonprofit Organizations 501(c)(3)"]
 *
 * @param {string} clientType - The client's selected type
 * @returns {string[]} Array of types to match against
 */
export function getExpandedClientTypes(clientType) {
	const expanded = new Set([clientType]);

	// Step 1: Add all synonyms from the same group (horizontal expansion)
	for (const synonymGroup of Object.values(TAXONOMIES.CLIENT_TYPE_SYNONYMS)) {
		if (synonymGroup.some((s) => s.toLowerCase() === clientType.toLowerCase())) {
			synonymGroup.forEach((s) => expanded.add(s));
		}
	}

	// Step 2: Add parent from hierarchy (vertical expansion)
	// Check each type in expanded set (including synonyms) for parent relationships
	for (const type of [...expanded]) {
		for (const [parent, children] of Object.entries(
			TAXONOMIES.CLIENT_TYPE_HIERARCHY
		)) {
			if (children.some((c) => c.toLowerCase() === type.toLowerCase())) {
				expanded.add(parent);
			}
		}
	}

	// Step 3: Add cross-category expansions (lateral expansion)
	// Check each type in expanded set for cross-category relationships
	for (const type of [...expanded]) {
		const crossCategories = TAXONOMIES.CLIENT_TYPE_CROSS_CATEGORIES[type];
		if (crossCategories) {
			crossCategories.forEach((cat) => expanded.add(cat));
		}
	}

	return Array.from(expanded);
}

/**
 * Expand a project type via hierarchy (downward only).
 *
 * If the project type is a parent in PROJECT_TYPE_HIERARCHY, returns the parent
 * plus all its children. If it's a child or standalone term, returns just itself.
 *
 * One-way expansion: "HVAC Systems" → ["HVAC Systems", "Heat Pump Systems", "Boiler Systems", ...]
 * No upward expansion: "Heat Pump Systems" → ["Heat Pump Systems"] (stays specific)
 *
 * @param {string} projectNeed - The client's selected project need
 * @returns {string[]} Array of project types to match against
 */
export function getExpandedProjectTypes(projectNeed) {
	const expanded = new Set([projectNeed]);

	// Downward expansion: if projectNeed is a parent, add all children
	const children = TAXONOMIES.PROJECT_TYPE_HIERARCHY[projectNeed];
	if (children) {
		children.forEach((child) => expanded.add(child));
	}

	return Array.from(expanded);
}

/**
 * Get selectable client types for UI dropdowns
 *
 * Returns children + standalone types + selectable parent exceptions.
 * This encourages users to select specific types rather than broad parent categories.
 *
 * @returns {string[]} Sorted array of selectable client types
 */
export function getSelectableClientTypes() {
	// Get all children from hierarchy (use Set to dedupe multi-parent types)
	const allChildren = Object.values(TAXONOMIES.CLIENT_TYPE_HIERARCHY).flat();

	// Combine with standalone types and selectable parent exceptions, deduplicate
	const selectableTypes = new Set([
		...allChildren,
		...TAXONOMIES.STANDALONE_CLIENT_TYPES,
		...TAXONOMIES.SELECTABLE_PARENT_TYPES,
	]);

	return Array.from(selectableTypes).sort();
}

/**
 * Funding type display groups for UI — ordered by desirability.
 * Used by client matches, opportunity explorer, and any view that groups by funding type.
 * The "other" group is a catch-all for types not explicitly listed (e.g., Technical Assistance, Contract).
 */
export const FUNDING_TYPE_GROUPS = [
	{
		key: 'grants',
		label: 'Grants',
		description: 'Direct Grant Funding',
		types: ['Grant', 'Cooperative Agreement'],
	},
	{
		key: 'tax',
		label: 'Tax Benefits',
		description: 'Tax Incentives',
		types: ['Tax Credit', 'Tax Incentive', 'Tax Deduction', 'Tax Exemption'],
	},
	{
		key: 'loans',
		label: 'Loans',
		description: 'Loans & Credit',
		types: ['Loan', 'Forgivable Loan', 'Guarantee', 'Bond'],
	},
	{
		key: 'incentives',
		label: 'Incentives',
		description: 'Utility Incentives',
		types: ['Incentive', 'Direct Payment', 'Voucher'],
	},
	{
		key: 'other',
		label: 'Other',
		description: 'Support & Services',
		types: [], // catch-all: Technical Assistance, Contract, Procurement Contract land here
	},
];

/**
 * Grouped project types for UI display.
 * Derived from the taxonomy tier comments — each group maps to a domain.
 * Used by the Combobox grouped mode for categorized browsing.
 */
export const PROJECT_TYPE_GROUPS = [
	{
		label: 'Building Systems',
		items: [
			'HVAC Systems', 'Heat Pump Systems', 'Building Air Filtration Systems',
			'Lighting Systems', 'LED Lighting Upgrades',
			'Plumbing Systems', 'Electrical Systems', 'EV Charging Stations',
			'Electrical Panel Upgrades', 'Security Systems', 'Building Controls',
			'Refrigeration Systems', 'Water Heater Systems', 'Intercom Systems',
			'Fire Suppression Systems', 'Elevators', 'Lifts',
			'Boiler Systems', 'Chiller Systems',
		],
	},
	{
		label: 'Building Envelope',
		items: [
			'Roofing', 'Windows', 'Doors', 'Insulation', 'Exterior Walls', 'Siding',
			'Foundation Repair', 'Weatherization', 'Flooring',
		],
	},
	{
		label: 'Energy & Power',
		items: [
			'Solar Panel Systems', 'Wind Turbines', 'Battery Storage Systems',
			'Emergency Backup Power Systems', 'Geothermal Systems',
			'Microgrids', 'Fuel Cells', 'Cogeneration Systems',
		],
	},
	{
		label: 'Water Infrastructure',
		items: [
			'Drinking Water Infrastructure', 'Water Metering Systems', 'Water Storage Tanks',
			'Wastewater Infrastructure', 'Sewer Systems', 'Stormwater Infrastructure',
			'Fire Hydrants',
		],
	},
	{
		label: 'Facility Types',
		items: [
			'Classroom Facilities', 'Kitchen Facilities', 'Gymnasium Facilities',
			'Community Center Facilities', 'Library Facilities',
			'Healthcare Facilities', 'Student Housing',
			'ADA Accessibility Improvements',
		],
	},
	{
		label: 'Grounds & Site Work',
		items: [
			'Playgrounds', 'Athletic Fields', 'Athletic Courts',
			'Perimeter Fencing', 'Shade Structures',
			'Landscaping', 'Landscape Irrigation Systems',
			'Recreational Park Facilities',
		],
	},
	{
		label: 'Transportation',
		items: [
			'Roads', 'Streets', 'Bridges', 'Sidewalks', 'Walkways', 'Bike Lanes', 'Bike Paths',
			'Parking Lots', 'Parking Structures', 'Traffic Signals', 'Street Lighting',
			'Bus Stops', 'Bus Shelters', 'Rail Infrastructure',
			'Pedestrian Crossings', 'Fleet Vehicles', 'Airports', 'EV Fleet',
			'Ports', 'Harbors',
		],
	},
	{
		label: 'Public Safety',
		items: [
			'Fire Stations', 'Police Stations', 'Emergency Operations Centers',
			'911 Centers', 'Dispatch Centers', 'Correctional Facilities',
		],
	},
	{
		label: 'Climate Resilience',
		items: [
			'Flood Barriers', 'Heat Resilience Infrastructure', 'Cooling Centers',
			'Warming Centers', 'Urban Greening',
		],
	},
	{
		label: 'Environmental Remediation',
		items: [
			'Asbestos Abatement', 'Lead Paint Remediation', 'Brownfield Remediation',
		],
	},
	{
		label: 'Technology',
		items: [
			'Data Centers', 'Building IT Infrastructure',
		],
	},
	{
		label: 'Other',
		items: [
			'Kitchen Equipment', 'Industrial Parks', 'Fire Trucks', 'Ambulances',
		],
	},
];

/**
 * Grouped client types for UI display.
 * Derived from CLIENT_TYPE_HIERARCHY + STANDALONE_CLIENT_TYPES.
 */
export const CLIENT_TYPE_GROUPS = [
	{
		label: 'Local Government',
		items: ['City Government', 'County Government', 'Municipal Government', 'Township Government', 'Special Districts', 'Public Housing Authorities'],
	},
	{
		label: 'State & Federal',
		items: ['Federal Agencies', 'State Governments'],
	},
	{
		label: 'Tribal',
		items: ['Tribal Governments'],
	},
	{
		label: 'Education',
		items: ['K-12 School Districts', 'Colleges', 'Universities', 'Community Colleges', 'Technical Colleges'],
	},
	{
		label: 'Healthcare',
		items: ['Hospitals', 'Health Centers', 'FQHCs', 'Community Health Centers'],
	},
	{
		label: 'Utilities & Authorities',
		items: ['Public Utilities', 'Private Utilities', 'Electric Cooperatives', 'Transportation Authorities', 'Port Authorities', 'Airport Authorities'],
	},
	{
		label: 'Nonprofits',
		items: ['Other Nonprofits', 'Faith-Based Organizations', 'Community-Based Organizations'],
	},
	{
		label: 'Private Sector',
		items: ['Large Enterprises', 'Small/Medium Businesses (SMB)', 'Hospitality', 'Farms and Agricultural Producers'],
	},
	{
		label: 'Other Institutions',
		items: ['Research Institutions', 'Libraries', 'Museums'],
	},
	{
		label: 'Individuals',
		items: ['Homeowners', 'Property Owners', 'Farmers/Ranchers', 'Renters', 'Property Managers'],
	},
];

export default TAXONOMIES;
