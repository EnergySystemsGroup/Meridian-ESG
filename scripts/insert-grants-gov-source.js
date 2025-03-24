// Script to insert a sample API source for Grants.gov
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('Missing Supabase environment variables');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Grants.gov API source data
const grantsGovSource = {
	name: 'Grants.gov',
	organization: 'U.S. Federal Government',
	type: 'federal',
	url: 'https://www.grants.gov',
	api_endpoint: 'https://api.grants.gov/v1/api/search2',
	api_documentation_url:
		'https://www.grants.gov/web/grants/developers/grantsws.html',
	auth_type: 'none',
	update_frequency: 'daily',
	priority: 1,
	notes:
		'The Grants.gov API provides access to federal funding opportunities from across the U.S. government. This source uses a two-step process: first searching for opportunities, then fetching details for each opportunity.',
	active: true,
};

// Grants.gov API configurations
const grantsGovConfigurations = {
	// Search configuration for the first step
	query_params: {
		rows: 100,
		oppStatuses: 'forecasted,posted',
		dateRange: '56', // Last 8 weeks of posted opportunities
		searchOnly: false,
		resultType: 'json',
	},
	request_config: {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
	},
	// Pagination configuration for the search results
	pagination_config: {
		enabled: true,
		type: 'offset',
		limitParam: 'rows',
		offsetParam: 'startRecordNum',
		pageSize: 100,
		maxPages: 5,
		responseDataPath: 'oppHits',
		totalCountPath: 'hitCount',
	},
	// Second step configuration for fetching opportunity details
	detail_config: {
		enabled: true,
		endpoint: 'https://api.grants.gov/v1/api/fetchOpportunity',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		idField: 'id', // Field in search results that contains the opportunity ID
		idParam: 'opportunityId', // Parameter name for the opportunity ID in the detail request
	},
};

async function insertGrantsGovSource() {
	try {
		// Insert the source
		const { data: source, error: sourceError } = await supabase
			.from('api_sources')
			.insert(grantsGovSource)
			.select()
			.single();

		if (sourceError) {
			throw sourceError;
		}

		console.log('Inserted Grants.gov source:', source);

		// Insert the configurations
		const configInserts = Object.entries(grantsGovConfigurations).map(
			([configType, configuration]) => ({
				source_id: source.id,
				config_type: configType,
				configuration,
			})
		);

		const { data: configs, error: configError } = await supabase
			.from('api_source_configurations')
			.insert(configInserts)
			.select();

		if (configError) {
			throw configError;
		}

		console.log('Inserted Grants.gov configurations:', configs);

		console.log(
			'Successfully inserted Grants.gov API source and configurations'
		);
	} catch (error) {
		console.error('Error inserting Grants.gov source:', error);
	}
}

// Run the script
insertGrantsGovSource();
