// Script to test the request body configuration
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const axios = require('axios');

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

// Create a test source with request body configuration
async function createTestSource() {
	try {
		console.log('Creating a test source with request body configuration...');

		// Create the source
		const { data: source, error: sourceError } = await supabase
			.from('api_sources')
			.insert({
				name: 'Grants.gov Test Source',
				organization: 'U.S. Federal Government',
				type: 'federal',
				url: 'https://www.grants.gov',
				api_endpoint: 'https://api.grants.gov/v1/api/search2',
				api_documentation_url:
					'https://www.grants.gov/web/grants/developers/grantsws.html',
				auth_type: 'none',
				update_frequency: 'daily',
				handler_type: 'standard',
				notes: 'Test source for Grants.gov API with request body configuration',
				active: true,
			})
			.select()
			.single();

		if (sourceError) {
			if (sourceError.code === '23505') {
				console.log('Test source already exists, retrieving it...');
				const { data: existingSource, error: getError } = await supabase
					.from('api_sources')
					.select('*')
					.eq('name', 'Grants.gov Test Source')
					.eq('organization', 'U.S. Federal Government')
					.single();

				if (getError) {
					throw getError;
				}

				return existingSource;
			}
			throw sourceError;
		}

		// Add configurations
		const configInserts = [
			{
				source_id: source.id,
				config_type: 'request_config',
				configuration: {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
				},
			},
			{
				source_id: source.id,
				config_type: 'request_body',
				configuration: {
					rows: 10,
					oppStatuses: 'forecasted,posted',
					dateRange: '56', // Last 8 weeks of posted opportunities
					searchOnly: false,
					resultType: 'json',
				},
			},
			{
				source_id: source.id,
				config_type: 'pagination_config',
				configuration: {
					enabled: true,
					type: 'offset',
					limitParam: 'rows',
					offsetParam: 'startRecordNum',
					pageSize: 10,
					maxPages: 1,
					responseDataPath: 'oppHits',
					totalCountPath: 'hitCount',
				},
			},
			{
				source_id: source.id,
				config_type: 'detail_config',
				configuration: {
					enabled: false,
					endpoint: '',
					method: 'GET',
					headers: {},
				},
			},
			{
				source_id: source.id,
				config_type: 'response_mapping',
				configuration: {
					title: 'title',
					description: 'synopsis',
					fundingType: 'fundingCategory',
					agency: 'agencyName',
					totalFunding: 'awardCeiling',
					url: 'opportunityUrl',
				},
			},
		];

		const { error: configError } = await supabase
			.from('api_source_configurations')
			.insert(configInserts);

		if (configError) {
			throw configError;
		}

		console.log(`Created test source: ${source.name} (${source.id})`);
		return source;
	} catch (error) {
		console.error('Error creating test source:', error);
		throw error;
	}
}

// Get the source manager agent output directly
async function getSourceManagerOutput(source) {
	try {
		console.log('\nGetting source manager agent output...');

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

		console.log('Source with configurations:');
		console.log(JSON.stringify(sourceWithConfig.configurations, null, 2));

		// Make a request to the source manager agent endpoint
		console.log('\nMaking a request to the source manager agent...');
		const response = await axios.post(
			`http://localhost:3000/api/funding/sources/${source.id}/manager`,
			{},
			{
				headers: {
					'Content-Type': 'application/json',
				},
			}
		);

		console.log('\nSource Manager Agent Response:');
		console.log(JSON.stringify(response.data, null, 2));

		// Verify that the request body is included in the processing details
		if (
			response.data.processingDetails &&
			response.data.processingDetails.requestBody
		) {
			console.log('\n✅ Request body is included in the processing details');
			console.log(
				JSON.stringify(response.data.processingDetails.requestBody, null, 2)
			);
		} else {
			console.log(
				'\n❌ Request body is NOT included in the processing details'
			);
		}

		// Verify that the response mapping is used
		if (
			response.data.processingDetails &&
			response.data.processingDetails.responseMapping
		) {
			console.log(
				'\n✅ Response mapping is included in the processing details'
			);
			console.log(
				JSON.stringify(response.data.processingDetails.responseMapping, null, 2)
			);
		} else {
			console.log(
				'\n❌ Response mapping is NOT included in the processing details'
			);
		}

		// Verify that the handler type is used
		if (
			response.data.processingDetails &&
			response.data.processingDetails.handlerType
		) {
			console.log('\n✅ Handler type is included in the processing details');
			console.log(
				JSON.stringify(response.data.processingDetails.handlerType, null, 2)
			);
		}

		return response.data;
	} catch (error) {
		console.error('Error getting source manager output:', error);
		if (error.response) {
			console.error('Response data:', error.response.data);
		}
		throw error;
	}
}

// Run the test
async function runTest() {
	try {
		const source = await createTestSource();
		await getSourceManagerOutput(source);
		console.log('\nTest completed successfully!');
	} catch (error) {
		console.error('Test failed:', error);
	}
}

runTest();
