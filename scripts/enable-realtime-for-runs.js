import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	console.error('Error: Required environment variables are missing.');
	console.error(
		'Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.'
	);
	process.exit(1);
}

async function enableRealtimeForRuns() {
	try {
		console.log('Connecting to Supabase...');

		// Create Supabase client with service role key for admin privileges
		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		// Direct SQL to add api_source_runs table to the supabase_realtime publication
		console.log('Enabling realtime for api_source_runs table...');

		const { data, error } = await supabase.rpc('enable_realtime_for_runs');

		if (error) {
			console.error('Error enabling realtime:', error);

			// Try an alternative approach if the RPC doesn't exist
			console.log('Trying alternative approach...');

			const { error: sqlError } = await supabase.from('_manual_sql').insert({
				query: 'ALTER PUBLICATION supabase_realtime ADD TABLE api_source_runs;',
			});

			if (sqlError) {
				console.error('Alternative approach failed:', sqlError);
				console.log('\nManual steps to enable realtime:');
				console.log('1. Go to Supabase dashboard');
				console.log('2. Navigate to the SQL Editor');
				console.log('3. Run the following SQL command:');
				console.log(
					'   ALTER PUBLICATION supabase_realtime ADD TABLE api_source_runs;'
				);
				process.exit(1);
			} else {
				console.log('Successfully enabled realtime for api_source_runs table!');
			}
		} else {
			console.log('Successfully enabled realtime for api_source_runs table!');
		}

		// Verify the table is now in the publication
		console.log('Verifying configuration...');

		const { data: verifyData, error: verifyError } = await supabase
			.from('_manual_sql')
			.insert({
				query:
					"SELECT * FROM pg_publication_tables WHERE tablename = 'api_source_runs';",
			});

		if (verifyError) {
			console.warn(
				'Could not verify if configuration was successful:',
				verifyError
			);
		} else if (verifyData && verifyData.length > 0) {
			console.log(
				'Verification successful! Realtime is now enabled for api_source_runs.'
			);
		} else {
			console.warn(
				'Verification failed. Realtime might not be enabled correctly.'
			);
			console.log('\nPlease try the manual steps:');
			console.log('1. Go to Supabase dashboard');
			console.log('2. Navigate to the SQL Editor');
			console.log('3. Run the following SQL command:');
			console.log(
				'   ALTER PUBLICATION supabase_realtime ADD TABLE api_source_runs;'
			);
		}
	} catch (err) {
		console.error('Unexpected error:', err);
		process.exit(1);
	}
}

// Run the function
enableRealtimeForRuns()
	.then(() => {
		console.log('Done!');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Script failed:', err);
		process.exit(1);
	});
