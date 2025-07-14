// Script to test the new configuration system
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { sourceManagerAgent } = require('../lib/agents/sourceManagerAgent');
const { apiHandlerAgent } = require('../lib/agents/apiHandlerAgent');

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

async function testConfigurationSystem() {
	try {
		console.log('Testing the new configuration system...');

		// Get a source with configurations
		const { data: sources, error: sourceError } = await supabase
			.from('api_sources')
			.select('*')
			.eq('active', true)
			.limit(1);

		if (sourceError) {
			throw sourceError;
		}

		if (!sources || sources.length === 0) {
			console.log('No active sources found. Please add a source first.');
			return;
		}

		const source = sources[0];
		console.log(`Testing with source: ${source.name} (${source.id})`);

		// Get the source configurations
		const { data: configurations, error: configError } = await supabase
			.from('api_source_configurations')
			.select('*')
			.eq('source_id', source.id);

		if (configError) {
			throw configError;
		}

		// Group configurations by type
		const configObject = {};
		configurations.forEach((config) => {
			configObject[config.config_type] = config.configuration;
		});

		// Add configurations to the source
		const sourceWithConfig = {
			...source,
			configurations: configObject,
		};

		console.log(
			'Source with configurations:',
			JSON.stringify(sourceWithConfig, null, 2)
		);

		// Process the source with the Source Manager Agent
		console.log('\nProcessing with Source Manager Agent...');
		const processingDetails = await sourceManagerAgent(sourceWithConfig);

		console.log(
			'\nProcessing details:',
			JSON.stringify(processingDetails, null, 2)
		);

		// Process the source with the API Handler Agent
		console.log('\nProcessing with API Handler Agent...');
		const handlerResult = await apiHandlerAgent(
			sourceWithConfig,
			processingDetails
		);

		console.log('\nHandler result:');
		console.log(`- Total opportunities: ${handlerResult.opportunities.length}`);
		console.log(`- Raw response ID: ${handlerResult.rawResponseId}`);

		if (handlerResult.opportunities.length > 0) {
			console.log('\nSample opportunity:');
			console.log(JSON.stringify(handlerResult.opportunities[0], null, 2));
		}

		console.log('\nTest completed successfully!');
	} catch (error) {
		console.error('Error testing configuration system:', error);
	}
}

// Run the test
testConfigurationSystem();
