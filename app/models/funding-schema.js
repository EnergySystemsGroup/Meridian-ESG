/**
 * Funding Opportunities Database Schema
 *
 * This schema is designed for Supabase and includes fields that can be
 * realistically obtained from public funding sources like Grants.gov,
 * state funding portals, and agency websites.
 */

// Table: funding_opportunities
const fundingOpportunitiesSchema = {
	id: 'uuid primary key default uuid_generate_v4()', // Unique identifier

	// Basic Information - Available from opportunity listings
	title: 'text not null', // Opportunity title
	opportunity_number: 'text', // Opportunity number/ID from source
	source_agency: 'text not null', // Funding agency name
	source_type: 'text', // Federal, State, Local, Private, etc.

	// Funding Details - Available from opportunity announcements
	min_amount: 'numeric', // Minimum award amount
	max_amount: 'numeric', // Maximum award amount
	total_funding: 'numeric', // Total program funding
	match_required: 'boolean', // Whether matching funds are required
	match_percentage: 'numeric', // Percentage of matching required

	// Dates - Available from opportunity listings
	posted_date: 'timestamp with time zone', // When opportunity was posted
	open_date: 'timestamp with time zone', // When applications can begin
	close_date: 'timestamp with time zone not null', // Application deadline
	estimated_award_date: 'timestamp with time zone', // Estimated notification date

	// Description - Available from opportunity announcements
	short_description: 'text', // Brief summary
	full_description: 'text', // Full description

	// Eligibility - Available from opportunity guidelines
	eligible_applicants: 'text[]', // Types of eligible organizations
	geographic_restrictions: 'text[]', // Geographic limitations

	// Links - Available from opportunity listings
	application_url: 'text', // URL to apply
	guidelines_url: 'text', // URL to guidelines document

	// Status - Calculated based on dates
	status: 'text not null', // Open, Upcoming, Closed

	// Categorization - Can be extracted or manually tagged
	tags: 'text[]', // Categories/tags for filtering
	cfda_numbers: 'text[]', // Catalog of Federal Domestic Assistance numbers

	// Metadata
	created_at: 'timestamp with time zone default now()',
	updated_at: 'timestamp with time zone default now()',
	last_sync_source: 'text', // Source of last data sync
	last_sync_date: 'timestamp with time zone', // When data was last synced
};

// Table: funding_sources
const fundingSourcesSchema = {
	id: 'uuid primary key default uuid_generate_v4()',
	name: 'text not null', // Agency name
	type: 'text not null', // Federal, State, Local, Private, etc.
	parent_agency: 'text', // Parent department/agency
	description: 'text', // Agency description
	website: 'text', // Agency website
	logo_url: 'text', // Agency logo
	contact_email: 'text', // General contact email
	contact_phone: 'text', // General contact phone
	created_at: 'timestamp with time zone default now()',
	updated_at: 'timestamp with time zone default now()',
};

// Table: funding_applications
const fundingApplicationsSchema = {
	id: 'uuid primary key default uuid_generate_v4()',
	opportunity_id: 'uuid references funding_opportunities(id)',
	client_id: 'uuid references clients(id)',
	status: 'text not null', // Draft, In Progress, Submitted, Awarded, Rejected
	submission_date: 'timestamp with time zone',
	amount_requested: 'numeric',
	notes: 'text',
	next_steps: 'text',
	next_deadline: 'timestamp with time zone',
	created_at: 'timestamp with time zone default now()',
	updated_at: 'timestamp with time zone default now()',
};

// Table: funding_contacts
const fundingContactsSchema = {
	id: 'uuid primary key default uuid_generate_v4()',
	opportunity_id: 'uuid references funding_opportunities(id)',
	name: 'text',
	title: 'text',
	email: 'text',
	phone: 'text',
	is_primary: 'boolean default false',
	created_at: 'timestamp with time zone default now()',
	updated_at: 'timestamp with time zone default now()',
};

// Table: funding_eligibility_criteria
const fundingEligibilityCriteriaSchema = {
	id: 'uuid primary key default uuid_generate_v4()',
	opportunity_id: 'uuid references funding_opportunities(id)',
	criterion_type: 'text not null', // Applicant Type, Geographic, Financial, etc.
	criterion_value: 'text not null', // The specific requirement
	created_at: 'timestamp with time zone default now()',
	updated_at: 'timestamp with time zone default now()',
};

// Table: funding_opportunity_updates
const fundingOpportunityUpdatesSchema = {
	id: 'uuid primary key default uuid_generate_v4()',
	opportunity_id: 'uuid references funding_opportunities(id)',
	update_type: 'text not null', // Deadline Extension, Amendment, etc.
	update_date: 'timestamp with time zone not null',
	update_description: 'text not null',
	created_at: 'timestamp with time zone default now()',
	updated_at: 'timestamp with time zone default now()',
};

// Data Sources for Funding Opportunities
const dataSources = [
	{
		name: 'Grants.gov',
		type: 'Federal',
		description: 'Primary source for federal grant opportunities',
		data_available: [
			'title',
			'opportunity_number',
			'source_agency',
			'posted_date',
			'close_date',
			'total_funding',
			'eligible_applicants',
			'application_url',
		],
		api_available: true,
		scraping_required: false,
	},
	{
		name: 'State Funding Portals',
		type: 'State',
		description: 'Various state grant and funding portals',
		data_available: [
			'title',
			'source_agency',
			'close_date',
			'short_description',
			'application_url',
			'eligible_applicants',
		],
		api_available: 'varies by state',
		scraping_required: 'often required',
	},
	{
		name: 'Agency Websites',
		type: 'Various',
		description: 'Direct agency websites for funding opportunities',
		data_available: [
			'title',
			'source_agency',
			'close_date',
			'full_description',
			'eligibility criteria',
			'guidelines_url',
		],
		api_available: 'rarely',
		scraping_required: 'usually required',
	},
	{
		name: 'Federal Register',
		type: 'Federal',
		description: 'Official journal of federal government notices',
		data_available: [
			'title',
			'opportunity_number',
			'source_agency',
			'posted_date',
			'close_date',
			'full_description',
			'eligible_applicants',
		],
		api_available: true,
		scraping_required: false,
	},
];

export {
	fundingOpportunitiesSchema,
	fundingSourcesSchema,
	fundingApplicationsSchema,
	fundingContactsSchema,
	fundingEligibilityCriteriaSchema,
	fundingOpportunityUpdatesSchema,
	dataSources,
};
