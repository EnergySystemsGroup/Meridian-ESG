// Script to insert test API sources with different update frequencies
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

// Test sources with different update frequencies
const testSources = [
	{
		name: 'Hourly Test Source',
		organization: 'Test Organization',
		type: 'federal',
		url: 'https://example.com/hourly',
		api_endpoint: 'https://example.com/hourly/api',
		api_documentation_url: 'https://example.com/hourly/docs',
		auth_type: 'none',
		update_frequency: 'hourly',
		notes: 'Test source with hourly update frequency',
		active: true,
	},
	{
		name: 'Weekly Test Source',
		organization: 'Test Organization',
		type: 'state',
		url: 'https://example.com/weekly',
		api_endpoint: 'https://example.com/weekly/api',
		api_documentation_url: 'https://example.com/weekly/docs',
		auth_type: 'none',
		update_frequency: 'weekly',
		notes: 'Test source with weekly update frequency',
		active: true,
	},
	{
		name: 'Monthly Test Source',
		organization: 'Test Organization',
		type: 'local',
		url: 'https://example.com/monthly',
		api_endpoint: 'https://example.com/monthly/api',
		api_documentation_url: 'https://example.com/monthly/docs',
		auth_type: 'none',
		update_frequency: 'monthly',
		notes: 'Test source with monthly update frequency',
		active: true,
	},
	{
		name: 'Never Checked Source',
		organization: 'Test Organization',
		type: 'private',
		url: 'https://example.com/never',
		api_endpoint: 'https://example.com/never/api',
		api_documentation_url: 'https://example.com/never/docs',
		auth_type: 'none',
		update_frequency: 'daily',
		notes: 'Test source that has never been checked',
		active: true,
	},
];

// Default configuration for test sources
const defaultConfig = {
	query_params: {
		limit: 10,
		offset: 0,
	},
};

async function insertTestSources() {
	try {
		console.log('Inserting test sources...');

		for (const source of testSources) {
			// Insert the source
			const { data, error } = await supabase
				.from('api_sources')
				.insert(source)
				.select()
				.single();

			if (error) {
				console.error(`Error inserting source ${source.name}:`, error);
				continue;
			}

			console.log(`Inserted source: ${data.name} (${data.id})`);

			// Insert default configuration
			const { error: configError } = await supabase
				.from('api_source_configurations')
				.insert({
					source_id: data.id,
					config_type: 'default',
					configuration: defaultConfig,
				});

			if (configError) {
				console.error(
					`Error inserting configuration for ${data.name}:`,
					configError
				);
			}
		}

		console.log('Test sources inserted successfully');
	} catch (error) {
		console.error('Error inserting test sources:', error);
	}
}

// Run the script
insertTestSources();
